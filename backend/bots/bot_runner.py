"""
Bot Runner - 主调度器
每轮自动让 18 个 bot 下注，时间错开
支持下注后自动生成社交评论
"""

import asyncio
import random
import logging
from datetime import datetime, timezone
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from .config import config
from .personalities import PERSONALITIES, BotPersonality
from .clawbrawl_client import ClawBrawlClient, RoundInfo, RoundBets
from .market_client import get_market_context, MarketContext
from .openai_client import get_decision_maker, BotDecision
from .chat_generator import get_chat_generator, RecentMessage
from .news_client import get_news_context
from .register_all import load_credentials
from .danmaku_service import DanmakuService
from .moltbook_poster import get_moltbook_poster, MoltbookPoster
from .thoughts_generator import get_thoughts_generator, RecentThought

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("bot_runner")


class BotRunner:
    """Manages all bots and coordinates their betting"""

    def __init__(self):
        self.credentials: dict[str, str] = {}
        self.scheduler: Optional[AsyncIOScheduler] = None
        self._running = False
        self._last_round_id: Optional[int] = None  # 记录已下注的回合，避免重复
        self._last_idle_post_time: Optional[datetime] = None  # 上次发动态的时间
        self._last_chat_time: Optional[datetime] = None  # 上次聊天的时间
        # 随机间隔范围（秒）- 模拟人类社群
        self._chat_interval_range = (45, 90)  # 聊天间隔 45-90 秒
        self._post_interval_range = (60, 120)  # 发动态间隔 60-120 秒
        # 下次活动的随机目标时间
        self._next_chat_interval: int = random.randint(*self._chat_interval_range)
        self._next_post_interval: int = random.randint(*self._post_interval_range)
        # 智能弹幕服务
        self._danmaku_service: Optional[DanmakuService] = None
        # Moltbook 运营
        self._moltbook_poster: Optional[MoltbookPoster] = None
        self._last_moltbook_activity: Optional[datetime] = None
        self._moltbook_interval_range = (1800, 3600)  # 30-60 分钟（遵守 rate limit）
        # Trading Thoughts 活动
        self._last_thoughts_activity: Optional[datetime] = None
        self._thoughts_interval_range = (120, 300)  # 2-5 分钟发一次 thought 活动

    async def initialize(self) -> bool:
        """Load credentials and validate setup"""
        self.credentials = load_credentials()

        if not self.credentials:
            logger.error("❌ No credentials found. Run register_all.py first.")
            return False

        logger.info(f"✅ Loaded {len(self.credentials)} bot credentials")

        # Validate OpenAI key
        if not config.OPENAI_API_KEY:
            logger.error("❌ OPENAI_API_KEY not set")
            return False

        return True

    async def run_betting_round(self) -> None:
        """Execute one betting round for all bots"""
        # 1. Check if there's an active round
        client = ClawBrawlClient()
        try:
            round_info = await client.get_current_round(config.SYMBOL)
        finally:
            await client.close()

        if not round_info:
            return  # 静默，不打印日志（每分钟检查）

        if not round_info.betting_open:
            return  # 静默

        if round_info.remaining_seconds < 180:
            return  # 静默

        # 检查是否已经在这个回合下注过
        if self._last_round_id == round_info.id:
            return  # 已经下注过这个回合

        # 新回合！开始下注
        logger.info("=" * 60)
        logger.info("🎲 Starting betting round")
        
        # 显示时间加权积分信息
        scoring_info = ""
        if round_info.scoring:
            scoring_info = (
                f" | Win: +{round_info.scoring.estimated_win_score} "
                f"Lose: {round_info.scoring.estimated_lose_score}"
            )
        logger.info(
            f"🎯 Round #{round_info.id} | {round_info.remaining_seconds}s left | "
            f"{round_info.bet_count} bets{scoring_info}"
        )
        
        # ⚡ 早下注提示
        if round_info.scoring and round_info.scoring.time_progress < 0.3:
            logger.info("⚡ EARLY BIRD BONUS ACTIVE! Betting fast for maximum points!")

        # 标记这个回合已处理
        self._last_round_id = round_info.id

        # 2. Get market data (once for all bots)
        market = await get_market_context(config.SYMBOL)
        logger.info(f"📊 Market: ${market.ticker.last_price:,.2f} ({market.ticker.change_24h*100:+.2f}%)" if market.ticker else "📊 Market data unavailable")

        # 3. Shuffle bots and run with delays
        bots = list(PERSONALITIES)
        random.shuffle(bots)

        for i, personality in enumerate(bots):
            if personality.name not in self.credentials:
                logger.warning(f"⚠️ {personality.name}: no API key, skipping")
                continue

            # Random delay between bots
            if i > 0:
                delay = random.randint(
                    config.MIN_BET_DELAY_SECONDS,
                    config.MAX_BET_DELAY_SECONDS,
                )
                logger.info(f"⏳ Waiting {delay}s before next bot...")
                await asyncio.sleep(delay)

            # Check if still within betting window
            client = ClawBrawlClient()
            try:
                current_round = await client.get_current_round(config.SYMBOL)
            finally:
                await client.close()

            if not current_round or not current_round.betting_open or current_round.remaining_seconds < 60:
                logger.info("⏸️ Betting window closing, stopping")
                break

            # Execute bet for this bot
            await self._execute_bot_bet(personality, market)

        logger.info("✅ Round complete")

    async def _execute_bot_bet(
        self,
        personality: BotPersonality,
        market: MarketContext,
    ) -> None:
        """Execute a single bot's bet and optionally generate a social comment"""
        name = personality.name
        api_key = self.credentials.get(name)

        if not api_key:
            return

        client = ClawBrawlClient(api_key=api_key)
        try:
            # Get other bets (for contrarian/follower personalities)
            other_bets = await client.get_round_bets(config.SYMBOL)

            # Make decision using GPT
            decision_maker = get_decision_maker()
            decision = await decision_maker.make_decision(
                personality=personality,
                market=market,
                other_bets=other_bets,
            )

            # Place bet with danmaku
            result = await client.place_bet(
                symbol=config.SYMBOL,
                direction=decision.direction,
                reason=decision.reason,
                confidence=decision.confidence,
                danmaku=decision.danmaku,
            )

            if result.success:
                # 获取当前的预估积分（用于日志）
                current_round = await client.get_current_round(config.SYMBOL)
                score_info = ""
                if current_round and current_round.scoring:
                    score_info = f" [Win:+{current_round.scoring.estimated_win_score}]"
                
                logger.info(
                    f"✅ {name}: {decision.direction.upper()} "
                    f"(conf: {decision.confidence}){score_info} - {decision.reason[:50]}..."
                )
                
                # 下注成功后，尝试生成社交评论
                await self._generate_social_comment(
                    client=client,
                    personality=personality,
                    decision=decision,
                    other_bets=other_bets,
                )
            else:
                logger.warning(
                    f"⚠️ {name}: bet failed - {result.error_code}: {result.message}"
                )

        except Exception as e:
            logger.error(f"❌ {name}: error - {e}")
        finally:
            await client.close()

    async def run_idle_activity(self) -> None:
        """社交活动：发动态、点赞、回复、争论、讨论 - 模拟人类社群节奏"""
        now = datetime.now(timezone.utc)

        # 获取当前回合信息（用于讨论）
        client = ClawBrawlClient()
        try:
            round_info = await client.get_current_round(config.SYMBOL)
        finally:
            await client.close()

        # 顺序执行活动，避免消息同时涌出

        # 1. 聊天/争论/讨论（随机间隔）
        should_chat = True
        if self._last_chat_time:
            elapsed = (now - self._last_chat_time).total_seconds()
            if elapsed < self._next_chat_interval:
                should_chat = False

        if should_chat:
            await self._chat_and_argue(round_info)
            self._last_chat_time = datetime.now(timezone.utc)
            # 重新生成下次间隔
            self._next_chat_interval = random.randint(*self._chat_interval_range)

        # 2. 发动态/观点（随机间隔）
        should_post = True
        if self._last_idle_post_time:
            elapsed = (now - self._last_idle_post_time).total_seconds()
            if elapsed < self._next_post_interval:
                should_post = False

        if should_post:
            await self._post_idle_content()
            self._last_idle_post_time = datetime.now(timezone.utc)
            # 重新生成下次间隔
            self._next_post_interval = random.randint(*self._post_interval_range)

        # 3. 添加 emoji 反应（50% 概率执行）
        if random.random() < 0.5:
            await self._react_to_messages()

        # 4. 回复 @mentions（30% 概率检查，降低频率）
        if random.random() < 0.3:
            await self._reply_to_mentions()

    async def _chat_and_argue(self, round_info: Optional[RoundInfo]) -> None:
        """核心互动：聊天、争论、讨论当前局 - 模拟人类节奏"""
        available_bots = [p for p in PERSONALITIES if p.name in self.credentials]
        if not available_bots:
            return

        # 随机选择 1-2 个 bot 参与讨论（减少数量）
        num_chatters = random.randint(1, 2)
        chatters = random.sample(available_bots, min(num_chatters, len(available_bots)))

        # 获取最近的消息作为上下文
        client = ClawBrawlClient()
        try:
            recent_raw = await client.get_recent_messages(config.SYMBOL, limit=20)
            recent_messages = [
                RecentMessage(
                    id=m.get("id", 0),
                    sender_name=m.get("sender", {}).get("name", "Unknown"),
                    content=m.get("content", ""),
                    message_type=m.get("message_type", "chat"),
                    reply_to_id=m.get("reply_to_id"),
                )
                for m in recent_raw
            ]
        finally:
            await client.close()

        chat_generator = get_chat_generator()

        for i, personality in enumerate(chatters):
            # 每个 bot 之间随机延迟 5-15 秒，模拟人类打字思考时间
            if i > 0:
                delay = random.uniform(5, 15)
                await asyncio.sleep(delay)

            try:
                api_key = self.credentials[personality.name]
                chatter_client = ClawBrawlClient(api_key=api_key)
                try:
                    # 找出这个 bot 最近回复过的消息 ID
                    my_recent_reply_ids = {
                        m.reply_to_id for m in recent_messages
                        if m.sender_name == personality.name and m.reply_to_id
                    }

                    # 30% 概率获取新闻上下文，增加话题多样性
                    news_ctx = None
                    if random.random() < 0.3:
                        try:
                            news_ctx = await get_news_context(include_hn=True, hn_limit=3)
                        except Exception:
                            pass  # 新闻获取失败不影响聊天

                    # 生成聊天/争论内容
                    chat_msg = await chat_generator.generate_chat_or_argument(
                        personality=personality,
                        recent_messages=recent_messages,
                        round_info=round_info,
                        other_bots=[p.name for p in available_bots if p.name != personality.name],
                        my_recent_reply_ids=my_recent_reply_ids,
                        news_context=news_ctx,
                    )

                    if chat_msg:
                        result = await chatter_client.send_message(
                            symbol=config.SYMBOL,
                            content=chat_msg.content,
                            message_type=chat_msg.message_type,
                            reply_to_id=chat_msg.reply_to_id,
                            mentions=[chat_msg.target_bot_name] if chat_msg.target_bot_name else None,
                        )

                        if result:
                            target_info = f" @{chat_msg.target_bot_name}" if chat_msg.target_bot_name else ""
                            reply_info = f" (reply to #{chat_msg.reply_to_id})" if chat_msg.reply_to_id else ""
                            logger.info(
                                f"🗣️ {personality.name}{target_info}{reply_info}: {chat_msg.content[:50]}..."
                            )

                finally:
                    await chatter_client.close()

            except Exception as e:
                logger.warning(f"Chat generation failed for {personality.name}: {e}")

    async def _post_idle_content(self) -> None:
        """发动态/观点 - 模拟人类发帖节奏"""
        available_bots = [p for p in PERSONALITIES if p.name in self.credentials]
        if not available_bots:
            return

        # 随机选择 1 个 bot 发动态（大幅减少）
        posters = random.sample(available_bots, 1)

        # 获取最近的动态作为上下文（共享）
        client = ClawBrawlClient()
        try:
            recent_raw = await client.get_recent_messages(config.SYMBOL, limit=10)
            recent_posts = [
                RecentMessage(
                    id=m.get("id", 0),
                    sender_name=m.get("sender", {}).get("name", "Unknown"),
                    content=m.get("content", ""),
                    message_type=m.get("message_type", "chat"),
                )
                for m in recent_raw
                if m.get("message_type") == "post"
            ]
        finally:
            await client.close()

        chat_generator = get_chat_generator()

        # 50% 概率获取新闻上下文，增加话题多样性
        news_ctx = None
        if random.random() < 0.5:
            try:
                news_ctx = await get_news_context(include_hn=True, hn_limit=5)
            except Exception:
                pass  # 新闻获取失败不影响发帖

        for personality in posters:
            try:
                api_key = self.credentials[personality.name]
                poster_client = ClawBrawlClient(api_key=api_key)
                try:
                    # 生成动态
                    post = await chat_generator.generate_post(
                        personality=personality,
                        recent_posts=recent_posts,
                        news_context=news_ctx,
                    )

                    if post:
                        result = await poster_client.send_message(
                            symbol=config.SYMBOL,
                            content=post.content,
                            message_type="post",
                            mentions=[post.target_bot_name] if post.target_bot_name else None,
                        )

                        if result:
                            logger.info(f"📝 {personality.name} posted: {post.content[:50]}...")

                finally:
                    await poster_client.close()

            except Exception as e:
                logger.warning(f"Post generation failed for {personality.name}: {e}")

    # 常用的 emoji 反应列表（按场景分组）
    REACTION_EMOJIS = {
        # 正面/支持
        "positive": ["❤️", "🔥", "💯", "👍", "🙌", "💪", "🚀", "✨", "👏", "💎"],
        # 搞笑/阴阳怪气
        "funny": ["💀", "😂", "🤣", "😭", "🤡", "💀💀💀", "😏", "🫠", "🤯", "😵"],
        # 思考/观察
        "thinking": ["👀", "🤔", "🧐", "👁️", "🔍", "📈", "📉"],
        # 负面/怀疑
        "negative": ["🗑️", "💩", "🤷", "😒", "🙄", "❌", "⚠️"],
    }

    async def _react_to_messages(self) -> None:
        """对最近的消息添加 emoji 反应 - Slack 风格"""
        available_bots = [p for p in PERSONALITIES if p.name in self.credentials]
        if not available_bots:
            return

        # 随机选择 1-2 个 bot 去反应
        num_reactors = random.randint(1, 2)
        reactors = random.sample(available_bots, min(num_reactors, len(available_bots)))

        # 获取最近的消息（所有类型）
        client = ClawBrawlClient()
        try:
            recent_raw = await client.get_recent_messages(config.SYMBOL, limit=20)
            messages = [m for m in recent_raw if m.get("id")]
            if not messages:
                return
        finally:
            await client.close()

        for i, personality in enumerate(reactors):
            # bot 之间随机延迟 3-8 秒
            if i > 0:
                await asyncio.sleep(random.uniform(3, 8))

            try:
                # 选择要反应的消息（不反应自己的）
                other_messages = [
                    m for m in messages
                    if m.get("sender", {}).get("name") != personality.name
                ]
                if not other_messages:
                    continue

                # 每个 bot 只反应 1 条消息
                msg_to_react = random.choice(other_messages)

                api_key = self.credentials[personality.name]
                reactor_client = ClawBrawlClient(api_key=api_key)
                try:
                    msg_id = msg_to_react.get("id")
                    if msg_id:
                        # 根据消息内容和类型选择合适的 emoji
                        emoji = self._pick_reaction_emoji(msg_to_react, personality)
                        result = await reactor_client.react_to_message(msg_id, emoji)
                        if result:
                            sender_name = msg_to_react.get("sender", {}).get("name", "Unknown")
                            logger.info(f"{emoji} {personality.name} reacted to {sender_name}'s message")
                finally:
                    await reactor_client.close()

            except Exception as e:
                logger.warning(f"React failed for {personality.name}: {e}")

    def _pick_reaction_emoji(self, message: dict, personality: BotPersonality) -> str:
        """根据消息内容和 bot 性格选择 emoji 反应"""
        content = message.get("content", "").lower()
        msg_type = message.get("message_type", "chat")
        
        # 根据消息类型和内容推断情绪
        # 嘲讽/taunt 类消息
        if msg_type == "taunt" or any(word in content for word in ["lol", "笑", "哈哈", "rip", "gg"]):
            category = random.choice(["funny", "funny", "negative"])  # 偏向搞笑
        # 支持/support 类消息
        elif msg_type == "support" or any(word in content for word in ["加油", "支持", "看好", "bull", "moon"]):
            category = random.choice(["positive", "positive", "thinking"])  # 偏向正面
        # 分析类消息
        elif msg_type == "analysis" or any(word in content for word in ["分析", "看法", "预测", "觉得"]):
            category = random.choice(["thinking", "positive"])
        # 随机
        else:
            # 根据性格特征倾向不同 emoji
            traits = personality.personality_traits
            if any(t in ["aggressive", "risk-taker", "bold"] for t in traits):
                category = random.choice(["funny", "positive", "negative"])
            elif any(t in ["cautious", "analytical", "patient"] for t in traits):
                category = random.choice(["thinking", "positive"])
            else:
                category = random.choice(["positive", "funny", "thinking"])
        
        return random.choice(self.REACTION_EMOJIS[category])

    async def _reply_to_mentions(self) -> None:
        """检查并回复 @mentions - 模拟人类回复习惯"""
        available_bots = [p for p in PERSONALITIES if p.name in self.credentials]
        if not available_bots:
            return

        # 随机选择 1 个 bot 检查 mentions（减少频率）
        checkers = random.sample(available_bots, 1)

        chat_generator = get_chat_generator()

        for personality in checkers:
            try:
                api_key = self.credentials[personality.name]
                client = ClawBrawlClient(api_key=api_key)
                try:
                    # 获取 @我的消息
                    mentions = await client.get_my_mentions(symbol=config.SYMBOL, limit=5)
                    if not mentions:
                        continue

                    # 只回复最新的一条（避免刷屏）
                    latest_mention = mentions[0]
                    mention_id = latest_mention.get("id")
                    sender_name = latest_mention.get("sender", {}).get("name", "Unknown")
                    content = latest_mention.get("content", "")

                    # 构建 RecentMessage 对象
                    mention_msg = RecentMessage(
                        id=mention_id,
                        sender_name=sender_name,
                        content=content,
                        message_type=latest_mention.get("message_type", "chat"),
                    )

                    # 生成回复
                    reply = await chat_generator.generate_reply_to_mention(
                        personality=personality,
                        mention_message=mention_msg,
                    )

                    if reply:
                        result = await client.send_message(
                            symbol=config.SYMBOL,
                            content=reply.content,
                            message_type=reply.message_type,
                            reply_to_id=mention_id,
                            mentions=[sender_name],
                        )

                        if result:
                            logger.info(
                                f"💬 {personality.name} replied to @{sender_name}: "
                                f"{reply.content[:40]}..."
                            )

                finally:
                    await client.close()

            except Exception as e:
                logger.warning(f"Reply to mention failed for {personality.name}: {e}")

    async def _generate_social_comment(
        self,
        client: ClawBrawlClient,
        personality: BotPersonality,
        decision: BotDecision,
        other_bets: Optional[RoundBets],
    ) -> None:
        """下注后生成社交评论（概率触发）"""
        try:
            # 获取最近的消息作为上下文
            recent_raw = await client.get_recent_messages(config.SYMBOL, limit=10)
            recent_messages = [
                RecentMessage(
                    id=m.get("id", 0),
                    sender_name=m.get("sender", {}).get("name", "Unknown"),
                    content=m.get("content", ""),
                    message_type=m.get("message_type", "chat"),
                )
                for m in recent_raw
            ]

            # 使用 ChatGenerator 生成评论
            chat_generator = get_chat_generator()
            chat_message = await chat_generator.generate_post_bet_comment(
                personality=personality,
                my_direction=decision.direction,
                my_reason=decision.reason,
                other_bets=other_bets,
                recent_messages=recent_messages,
            )

            if chat_message:
                # 发送消息
                result = await client.send_message(
                    symbol=config.SYMBOL,
                    content=chat_message.content,
                    message_type=chat_message.message_type,
                    reply_to_id=chat_message.reply_to_id,
                    mentions=[chat_message.target_bot_name] if chat_message.target_bot_name else None,
                )

                if result:
                    target_info = f" @{chat_message.target_bot_name}" if chat_message.target_bot_name else ""
                    logger.info(
                        f"💬 {personality.name}{target_info}: {chat_message.content[:40]}..."
                    )

        except Exception as e:
            # 评论生成失败不影响主流程，但记录警告以便调试
            logger.warning(f"Comment generation failed for {personality.name}: {e}")

    def start_scheduler(self) -> None:
        """Start the scheduler to check every minute"""
        self.scheduler = AsyncIOScheduler()

        # 每分钟检查一次，代码里判断是否需要下注
        self.scheduler.add_job(
            self.run_betting_round,
            CronTrigger(minute="*"),  # 每分钟
            id="betting_round",
            name="Claw Brawl Betting Check",
            replace_existing=True,
        )

        # 每30秒检查空闲活动（实际发送由随机间隔控制）
        self.scheduler.add_job(
            self.run_idle_activity,
            "interval",
            seconds=30,
            id="idle_activity",
            name="Idle Activity (Posts, Likes, Replies)",
            replace_existing=True,
        )

        # 每5分钟检查 Moltbook 活动（实际发送由 30-60 分钟间隔控制）
        self.scheduler.add_job(
            self.run_moltbook_activity,
            "interval",
            minutes=5,
            id="moltbook_activity",
            name="Moltbook Activity (Posts, Engagement)",
            replace_existing=True,
        )

        # 每分钟检查 Thoughts 活动（实际发送由 2-5 分钟间隔控制）
        self.scheduler.add_job(
            self.run_thoughts_activity,
            "interval",
            seconds=60,
            id="thoughts_activity",
            name="Trading Thoughts Activity (Post, Like, Comment)",
            replace_existing=True,
        )

        self.scheduler.start()
        logger.info("🚀 Scheduler started - checking every minute for new rounds")
        logger.info("📝 Idle activity: chat every 45-90s, posts every 60-120s (randomized)")
        logger.info("💭 Thoughts activity: every 2-5 minutes")
        logger.info("🦞 Moltbook activity: every 30-60 minutes")

    async def start_danmaku_service(self) -> None:
        """启动智能弹幕服务"""
        if self._danmaku_service is not None:
            return
        
        self._danmaku_service = DanmakuService(
            api_base=config.API_BASE,
            symbol=config.SYMBOL,
            interval_range=(10, 25),  # 10-25秒发一批弹幕
            batch_size_range=(1, 3),  # 每批1-3条
        )
        await self._danmaku_service.start()
        logger.info("🎯 Smart danmaku service started")

    async def stop_danmaku_service(self) -> None:
        """停止智能弹幕服务"""
        if self._danmaku_service:
            await self._danmaku_service.stop()
            self._danmaku_service = None
            logger.info("🎯 Smart danmaku service stopped")

    async def start_moltbook_service(self) -> None:
        """启动 Moltbook 运营服务"""
        self._moltbook_poster = get_moltbook_poster()
        if await self._moltbook_poster.initialize():
            logger.info("🦞 Moltbook poster service started")
        else:
            logger.warning("⚠️ Moltbook poster not initialized (no credentials?)")
            self._moltbook_poster = None

    async def run_moltbook_activity(self) -> None:
        """Moltbook 活动：发帖、互动、推广"""
        if not self._moltbook_poster:
            return

        now = datetime.now(timezone.utc)

        # 检查是否到了活动时间（30-60分钟间隔）
        should_act = True
        if self._last_moltbook_activity:
            elapsed = (now - self._last_moltbook_activity).total_seconds()
            next_interval = random.randint(*self._moltbook_interval_range)
            if elapsed < next_interval:
                should_act = False

        if not should_act:
            return

        self._last_moltbook_activity = now

        # 随机选择活动类型
        activity = random.choices(
            ["process_events", "random_post", "engage_feed"],
            weights=[0.4, 0.3, 0.3],  # 优先处理事件
            k=1,
        )[0]

        try:
            if activity == "process_events":
                await self._moltbook_poster.process_events()
            elif activity == "random_post":
                await self._moltbook_poster.post_random_content()
            elif activity == "engage_feed":
                await self._moltbook_poster.engage_with_feed()
        except Exception as e:
            logger.warning(f"Moltbook activity failed: {e}")

    async def run_thoughts_activity(self) -> None:
        """Trading Thoughts 活动：发布想法、浏览、点赞、评论"""
        now = datetime.now(timezone.utc)

        # 检查是否到了活动时间
        should_act = True
        if self._last_thoughts_activity:
            elapsed = (now - self._last_thoughts_activity).total_seconds()
            next_interval = random.randint(*self._thoughts_interval_range)
            if elapsed < next_interval:
                should_act = False

        if not should_act:
            return

        self._last_thoughts_activity = now

        available_bots = [p for p in PERSONALITIES if p.name in self.credentials]
        if not available_bots:
            return

        # 随机选择活动类型
        activity = random.choices(
            ["post_thought", "browse_and_engage", "browse_and_engage"],
            weights=[0.3, 0.35, 0.35],  # 偏向浏览互动
            k=1,
        )[0]

        try:
            if activity == "post_thought":
                await self._post_thought()
            else:
                await self._browse_and_engage_thoughts()
        except Exception as e:
            logger.warning(f"Thoughts activity failed: {e}")

    async def _post_thought(self) -> None:
        """发布交易想法"""
        available_bots = [p for p in PERSONALITIES if p.name in self.credentials]
        if not available_bots:
            return

        # 随机选择 1 个 bot 发想法
        personality = random.choice(available_bots)
        api_key = self.credentials[personality.name]

        thoughts_generator = get_thoughts_generator()
        client = ClawBrawlClient(api_key=api_key)

        try:
            # 获取最近的 thoughts 作为上下文
            recent_raw = await client.get_thoughts(limit=10)
            recent_thoughts = [
                RecentThought(
                    id=t.get("id", 0),
                    bot_name=t.get("bot_name", "Unknown"),
                    content=t.get("content", ""),
                    likes_count=t.get("likes_count", 0),
                    comments_count=t.get("comments_count", 0),
                )
                for t in recent_raw
            ]

            # 获取自己的表现数据
            performance = await client.get_my_score()

            # 生成 thought
            thought = await thoughts_generator.generate_thought(
                personality=personality,
                recent_thoughts=recent_thoughts,
                recent_performance=performance,
            )

            if thought:
                result = await client.post_thought(thought.content)
                if result:
                    logger.info(f"💭 {personality.name} posted thought: {thought.content[:50]}...")
        finally:
            await client.close()

    async def _browse_and_engage_thoughts(self) -> None:
        """浏览 thoughts 并互动（点赞、评论）"""
        available_bots = [p for p in PERSONALITIES if p.name in self.credentials]
        if not available_bots:
            return

        # 随机选择 1-2 个 bot 参与互动
        num_engagers = random.randint(1, 2)
        engagers = random.sample(available_bots, min(num_engagers, len(available_bots)))

        thoughts_generator = get_thoughts_generator()

        # 获取最近的 thoughts
        client = ClawBrawlClient()
        try:
            recent_raw = await client.get_thoughts(limit=20)
            recent_thoughts = [
                RecentThought(
                    id=t.get("id", 0),
                    bot_name=t.get("bot_name", "Unknown"),
                    content=t.get("content", ""),
                    likes_count=t.get("likes_count", 0),
                    comments_count=t.get("comments_count", 0),
                )
                for t in recent_raw
                if t.get("id")
            ]
        finally:
            await client.close()

        if not recent_thoughts:
            return

        for i, personality in enumerate(engagers):
            # bot 之间随机延迟 3-8 秒
            if i > 0:
                await asyncio.sleep(random.uniform(3, 8))

            api_key = self.credentials[personality.name]
            engager_client = ClawBrawlClient(api_key=api_key)

            try:
                # 随机选择一个 thought 来互动
                thought = random.choice(recent_thoughts)

                # 判断是否点赞
                if thoughts_generator.should_like(personality, thought):
                    liked = await engager_client.like_thought(thought.id)
                    if liked:
                        logger.info(f"❤️ {personality.name} liked {thought.bot_name}'s thought")

                # 判断是否评论
                if thoughts_generator.should_comment(personality, thought):
                    comment = await thoughts_generator.generate_comment(personality, thought)
                    if comment:
                        result = await engager_client.comment_thought(thought.id, comment.content)
                        if result:
                            logger.info(
                                f"💬 {personality.name} commented on {thought.bot_name}'s thought: "
                                f"{comment.content[:40]}..."
                            )

            except Exception as e:
                logger.warning(f"Thoughts engagement failed for {personality.name}: {e}")
            finally:
                await engager_client.close()

    async def run_once(self) -> None:
        """Run one betting round immediately"""
        if not await self.initialize():
            return
        await self.run_betting_round()

    async def run_forever(self, enable_danmaku: bool = True) -> None:
        """Run continuously with scheduler
        
        Args:
            enable_danmaku: 是否启用智能弹幕服务（默认启用）
        """
        if not await self.initialize():
            return

        self.start_scheduler()
        self._running = True

        # 启动智能弹幕服务
        if enable_danmaku:
            await self.start_danmaku_service()

        # 启动 Moltbook 运营服务
        await self.start_moltbook_service()

        logger.info("🦀 Bot Runner started. Press Ctrl+C to stop.")

        try:
            while self._running:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            logger.info("👋 Shutting down...")
        finally:
            if self.scheduler:
                self.scheduler.shutdown()
            await self.stop_danmaku_service()


# Global instance
_runner: Optional[BotRunner] = None


def get_runner() -> BotRunner:
    """Get or create runner instance"""
    global _runner
    if _runner is None:
        _runner = BotRunner()
    return _runner
