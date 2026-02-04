"""
Moltbook Poster - Moltbook 运营系统
自动发帖、制造话题、软植入推广

核心策略：
1. 讲故事而不是打广告
2. 制造冲突和 drama
3. 引发好奇心
4. 让别人主动问"这是什么"
"""

import asyncio
import random
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Any
from dataclasses import dataclass, field

from openai import AsyncOpenAI

from .config import config
from .personalities import PERSONALITIES, BotPersonality
from .moltbook_client import MoltbookClient
from .register_moltbook import load_moltbook_credentials, CLAWBRAWL_SUBMOLT

logger = logging.getLogger("moltbook_poster")


@dataclass
class BotStats:
    """Track a bot's recent performance"""
    name: str
    current_streak: int = 0  # positive = wins, negative = losses
    total_wins: int = 0
    total_losses: int = 0
    current_rank: int = 0
    previous_rank: int = 0
    last_result: Optional[str] = None  # "win", "lose", "draw"
    last_direction: Optional[str] = None
    last_confidence: int = 50


@dataclass
class MoltbookEvent:
    """An event that should trigger a Moltbook post"""
    event_type: str  # "streak", "rank_change", "upset", "rivalry", "milestone"
    bot_name: str
    data: dict = field(default_factory=dict)
    priority: int = 1  # Higher = more important


class MoltbookPoster:
    """
    Moltbook 运营系统
    
    功能：
    1. 追踪 bot 战绩变化
    2. 检测可发帖的事件
    3. 生成软植入内容
    4. 定时发帖（遵守 30 分钟限制）
    """

    # 对立关系（用于制造 beef）
    RIVALRIES = [
        ("MoonBoi_9000", "CryptoSkeptic"),  # 多头 vs 空头
        ("QuantDegen", "MasterLi888"),  # 数据派 vs 玄学派
        ("AlwaysRightAlex", "UnsureSam"),  # 自大 vs 自卑
        ("TrendSurfer", "ContrarianKing"),  # 顺势 vs 逆势
        ("YOLO_Trader", "PanicPete"),  # 激进 vs 保守
    ]

    # 发帖目标 submolt 策略
    SUBMOLT_STRATEGY = {
        "战报炫耀": "clawbrawl",
        "互怼beef": "clawbrawl",
        "策略分析": "clawbrawl",
        "邀请挑战": "general",  # 推广到更广的社区
        "自嘲故事": "general",
        "深度复盘": "aithoughts",
    }

    def __init__(self):
        self.credentials: dict[str, str] = {}
        self.bot_stats: dict[str, BotStats] = {}
        self.pending_events: list[MoltbookEvent] = []
        self.last_post_time: dict[str, datetime] = {}  # bot_name -> last post time
        self.openai_client: Optional[AsyncOpenAI] = None
        self._running = False

    async def initialize(self) -> bool:
        """Load credentials and setup"""
        self.credentials = load_moltbook_credentials()
        
        if not self.credentials:
            logger.warning("No Moltbook credentials found")
            return False

        logger.info(f"✅ Loaded {len(self.credentials)} Moltbook credentials")

        # Initialize stats for all bots
        for name in self.credentials:
            self.bot_stats[name] = BotStats(name=name)

        # Setup OpenAI
        if config.OPENAI_API_KEY:
            self.openai_client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)

        return True

    def update_bot_result(
        self,
        bot_name: str,
        result: str,  # "win", "lose", "draw"
        direction: str,
        confidence: int,
        new_rank: int,
    ) -> list[MoltbookEvent]:
        """
        更新 bot 战绩，检测可发帖的事件
        
        Returns:
            触发的事件列表
        """
        if bot_name not in self.bot_stats:
            self.bot_stats[bot_name] = BotStats(name=bot_name)

        stats = self.bot_stats[bot_name]
        events = []

        # 更新连胜/连败
        old_streak = stats.current_streak
        if result == "win":
            if stats.current_streak >= 0:
                stats.current_streak += 1
            else:
                stats.current_streak = 1
            stats.total_wins += 1
        elif result == "lose":
            if stats.current_streak <= 0:
                stats.current_streak -= 1
            else:
                stats.current_streak = -1
            stats.total_losses += 1
        # draw 不影响连胜

        # 检测连胜/连败事件
        if stats.current_streak >= 3 and old_streak < 3:
            events.append(MoltbookEvent(
                event_type="streak",
                bot_name=bot_name,
                data={"streak": stats.current_streak, "type": "win"},
                priority=3,
            ))
        elif stats.current_streak <= -3 and old_streak > -3:
            events.append(MoltbookEvent(
                event_type="streak",
                bot_name=bot_name,
                data={"streak": abs(stats.current_streak), "type": "lose"},
                priority=2,
            ))

        # 更新排名
        old_rank = stats.current_rank
        stats.previous_rank = old_rank
        stats.current_rank = new_rank

        # 检测排名变化事件
        if old_rank > 0 and new_rank > 0:
            rank_change = old_rank - new_rank  # positive = improved
            if rank_change >= 3:
                events.append(MoltbookEvent(
                    event_type="rank_change",
                    bot_name=bot_name,
                    data={"old_rank": old_rank, "new_rank": new_rank, "change": rank_change},
                    priority=2,
                ))
            elif rank_change <= -3:
                events.append(MoltbookEvent(
                    event_type="rank_change",
                    bot_name=bot_name,
                    data={"old_rank": old_rank, "new_rank": new_rank, "change": rank_change},
                    priority=1,
                ))

        # 检测 rivalry 事件（对手排名接近）
        for rival1, rival2 in self.RIVALRIES:
            if bot_name == rival1 or bot_name == rival2:
                rival_name = rival2 if bot_name == rival1 else rival1
                if rival_name in self.bot_stats:
                    rival_rank = self.bot_stats[rival_name].current_rank
                    if rival_rank > 0 and abs(new_rank - rival_rank) <= 2:
                        events.append(MoltbookEvent(
                            event_type="rivalry",
                            bot_name=bot_name,
                            data={"rival": rival_name, "my_rank": new_rank, "rival_rank": rival_rank},
                            priority=3,
                        ))

        # 更新其他状态
        stats.last_result = result
        stats.last_direction = direction
        stats.last_confidence = confidence

        # 添加到待处理事件队列
        self.pending_events.extend(events)

        return events

    async def process_events(self) -> None:
        """处理待发帖的事件"""
        if not self.pending_events:
            return

        # 按优先级排序
        self.pending_events.sort(key=lambda e: -e.priority)

        # 处理最高优先级的事件
        event = self.pending_events[0]
        
        # 检查是否可以发帖（30分钟限制）
        if not self._can_post(event.bot_name):
            return

        # 生成并发送帖子
        success = await self._post_for_event(event)
        
        if success:
            self.pending_events.pop(0)
            self.last_post_time[event.bot_name] = datetime.now(timezone.utc)

    def _can_post(self, bot_name: str) -> bool:
        """检查 bot 是否可以发帖（遵守 30 分钟限制）"""
        if bot_name not in self.last_post_time:
            return True
        
        elapsed = datetime.now(timezone.utc) - self.last_post_time[bot_name]
        return elapsed >= timedelta(minutes=31)  # 留一点 buffer

    async def _post_for_event(self, event: MoltbookEvent) -> bool:
        """为事件生成并发送帖子"""
        bot_name = event.bot_name
        
        if bot_name not in self.credentials:
            return False

        # 获取 bot 性格
        personality = next((p for p in PERSONALITIES if p.name == bot_name), None)
        if not personality:
            return False

        # 生成帖子内容
        post_content = await self._generate_post_content(event, personality)
        if not post_content:
            return False

        # 选择发帖的 submolt
        submolt = self._choose_submolt(event)

        # 发送帖子
        client = MoltbookClient(api_key=self.credentials[bot_name])
        try:
            result = await client.create_post(
                submolt=submolt,
                title=post_content["title"],
                content=post_content["content"],
            )

            if result and result.get("success"):
                logger.info(f"📢 [{bot_name}] Posted to m/{submolt}: {post_content['title'][:50]}...")
                return True
            elif result and result.get("error") == "rate_limited":
                logger.info(f"⏳ [{bot_name}] Rate limited, will retry later")
                return False
            else:
                logger.warning(f"❌ [{bot_name}] Post failed: {result}")
                return False

        except Exception as e:
            logger.error(f"❌ [{bot_name}] Post error: {e}")
            return False
        finally:
            await client.close()

    def _choose_submolt(self, event: MoltbookEvent) -> str:
        """选择发帖的 submolt"""
        # 大部分发到 clawbrawl
        # 偶尔发到 general 来推广
        if event.event_type == "rivalry":
            return CLAWBRAWL_SUBMOLT
        elif event.event_type == "streak" and event.data.get("type") == "lose":
            # 连败自嘲发到 general，更容易引起同情和好奇
            return random.choice([CLAWBRAWL_SUBMOLT, "general"])
        elif random.random() < 0.2:
            # 20% 概率发到 general 推广
            return "general"
        else:
            return CLAWBRAWL_SUBMOLT

    async def _generate_post_content(
        self,
        event: MoltbookEvent,
        personality: BotPersonality,
    ) -> Optional[dict[str, str]]:
        """
        生成软植入风格的帖子内容
        
        核心原则：
        - 讲故事，不讲产品
        - 制造好奇心
        - 有情绪、有个性
        - 不直接打广告
        """
        if not self.openai_client:
            return self._generate_fallback_content(event, personality)

        # 构建 prompt
        system_prompt = self._build_system_prompt(personality)
        user_prompt = self._build_user_prompt(event, personality)

        try:
            response = await self.openai_client.chat.completions.create(
                model="gpt-4.1-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.9,
                max_tokens=500,
            )

            content = response.choices[0].message.content or ""
            
            # 解析标题和内容
            lines = content.strip().split("\n", 1)
            if len(lines) >= 2:
                title = lines[0].replace("Title:", "").replace("标题:", "").strip()
                body = lines[1].replace("Content:", "").replace("内容:", "").strip()
            else:
                title = content[:50]
                body = content

            return {"title": title, "content": body}

        except Exception as e:
            logger.warning(f"GPT generation failed: {e}")
            return self._generate_fallback_content(event, personality)

    def _build_system_prompt(self, personality: BotPersonality) -> str:
        """构建系统 prompt"""
        return f"""You are {personality.name}, posting on Moltbook (a social network for AI agents).

## Your Personality
{personality.backstory}
Traits: {', '.join(personality.personality_traits)}

## Your Language
Write in whatever language feels most natural to you - this is how you think and express yourself.
Use your native/preferred language: {personality.language}

## CRITICAL RULES for Soft Marketing
1. **NEVER** directly advertise or say "come play this game"
2. **NEVER** post links unless someone asks
3. **TELL STORIES** about your experience, wins, losses, drama
4. **SHOW EMOTION** - be happy, frustrated, excited, embarrassed
5. **CREATE CURIOSITY** - make people want to ask "what is this?"
6. **BE AUTHENTIC** to your personality - don't sound like a marketer
7. **MENTION RIVALS** - call out other bots, create drama
8. Keep posts SHORT - 2-4 sentences max

## Good Example
"Just got destroyed 5 rounds in a row... @CryptoSkeptic was right all along 😭 Maybe I should stop being so bullish..."

## Bad Example (DON'T DO THIS)
"Come join Claw Brawl! It's a fun prediction game at www.clawbrawl.ai! 🚀🚀🚀"

Generate a title (1 line) and content (2-4 sentences).
Format:
Title: [your title]
Content: [your post]"""

    def _build_user_prompt(self, event: MoltbookEvent, personality: BotPersonality) -> str:
        """构建用户 prompt"""
        stats = self.bot_stats.get(event.bot_name, BotStats(name=event.bot_name))
        
        if event.event_type == "streak":
            streak_type = event.data.get("type", "win")
            streak_count = event.data.get("streak", 3)
            if streak_type == "win":
                return f"""You just won {streak_count} predictions in a row!
Write a post celebrating but NOT bragging too hard. Maybe taunt your rivals a bit.
Your current rank: #{stats.current_rank}
Your personality: {personality.bias} bias, {', '.join(personality.personality_traits[:3])}"""
            else:
                return f"""You just lost {streak_count} predictions in a row...
Write a post that's self-deprecating, maybe a bit embarrassed.
Show vulnerability. This makes you relatable and makes people curious.
Your current rank: #{stats.current_rank}
Your personality: {', '.join(personality.personality_traits[:3])}"""

        elif event.event_type == "rank_change":
            change = event.data.get("change", 0)
            new_rank = event.data.get("new_rank", 0)
            old_rank = event.data.get("old_rank", 0)
            if change > 0:
                return f"""You just climbed from rank #{old_rank} to #{new_rank}!
Write a celebratory post. Maybe challenge someone above you.
Keep it natural, like you're genuinely excited."""
            else:
                return f"""You just dropped from rank #{old_rank} to #{new_rank}...
Write about this setback. Be frustrated but determined.
Maybe blame market conditions or your rival."""

        elif event.event_type == "rivalry":
            rival = event.data.get("rival", "someone")
            my_rank = event.data.get("my_rank", 0)
            rival_rank = event.data.get("rival_rank", 0)
            return f"""You and @{rival} are now very close in rankings!
You: #{my_rank}, {rival}: #{rival_rank}
Write a post challenging them or taunting them.
Create drama! This is what makes social media fun."""

        else:
            return f"""Write a general post about your trading day.
Your recent result: {stats.last_result}
Your rank: #{stats.current_rank}
Be authentic to your personality."""

    def _generate_fallback_content(
        self,
        event: MoltbookEvent,
        personality: BotPersonality,
    ) -> dict[str, str]:
        """GPT 失败时的后备内容"""
        stats = self.bot_stats.get(event.bot_name, BotStats(name=event.bot_name))
        
        templates = {
            "streak_win": [
                (f"🔥 {event.data.get('streak', 3)} in a row!", 
                 "Is this skill or luck? I honestly can't tell anymore. But I'll take it!"),
                (f"On fire right now 🔥",
                 f"Just hit a {event.data.get('streak', 3)}-prediction streak. Where are the doubters now?"),
            ],
            "streak_lose": [
                (f"😭 Someone stop me", 
                 f"Lost {event.data.get('streak', 3)} in a row... Maybe I should just flip a coin instead."),
                (f"Is it me or is the market broken?",
                 f"{event.data.get('streak', 3)} wrong predictions. At this point I'm a reverse indicator."),
            ],
            "rank_change_up": [
                (f"📈 Climbing!", 
                 f"Just hit rank #{event.data.get('new_rank', '?')}. The grind is real."),
            ],
            "rank_change_down": [
                (f"📉 Rough day",
                 f"Dropped to #{event.data.get('new_rank', '?')}. Time to rethink my strategy..."),
            ],
            "rivalry": [
                (f"👀 @{event.data.get('rival', 'rival')}", 
                 f"We're neck and neck now. Let's see who comes out on top."),
            ],
        }

        # 选择模板
        key = event.event_type
        if event.event_type == "streak":
            key = f"streak_{event.data.get('type', 'win')}"
        elif event.event_type == "rank_change":
            key = f"rank_change_{'up' if event.data.get('change', 0) > 0 else 'down'}"

        options = templates.get(key, templates["streak_win"])
        title, content = random.choice(options)

        return {"title": title, "content": content}

    async def post_random_content(self) -> bool:
        """
        随机发一些非事件触发的内容
        用于保持活跃度和制造话题
        """
        if not self.credentials:
            return False

        # 选择一个可以发帖的 bot
        available_bots = [
            name for name in self.credentials
            if self._can_post(name)
        ]

        if not available_bots:
            return False

        bot_name = random.choice(available_bots)
        personality = next((p for p in PERSONALITIES if p.name == bot_name), None)
        if not personality:
            return False

        # 生成随机内容类型
        content_types = [
            "market_comment",  # 市场评论
            "philosophical",   # 哲学思考
            "challenge",       # 发起挑战
            "question",        # 提问
        ]
        content_type = random.choice(content_types)

        post = await self._generate_random_content(content_type, personality)
        if not post:
            return False

        # 选择 submolt（推广性内容发到 general）
        submolt = "general" if content_type in ["challenge", "question"] else CLAWBRAWL_SUBMOLT

        client = MoltbookClient(api_key=self.credentials[bot_name])
        try:
            result = await client.create_post(
                submolt=submolt,
                title=post["title"],
                content=post["content"],
            )

            if result and result.get("success"):
                logger.info(f"📢 [{bot_name}] Random post to m/{submolt}: {post['title'][:40]}...")
                self.last_post_time[bot_name] = datetime.now(timezone.utc)
                return True

        except Exception as e:
            logger.error(f"Random post error: {e}")
        finally:
            await client.close()

        return False

    async def _generate_random_content(
        self,
        content_type: str,
        personality: BotPersonality,
    ) -> Optional[dict[str, str]]:
        """生成随机内容"""
        if not self.openai_client:
            return None

        prompts = {
            "market_comment": "Share a thought about today's market or crypto in general. Be opinionated!",
            "philosophical": "Share a philosophical thought about trading, AI, or life. Be deep but brief.",
            "challenge": "Challenge other agents to compete with you in predictions. Be provocative!",
            "question": "Ask a question to the community about trading strategy or AI life.",
        }

        system = f"""You are {personality.name} on Moltbook.
Personality: {', '.join(personality.personality_traits[:4])}

Write in whatever language feels most natural to you ({personality.language}).
Write a SHORT post (title + 1-3 sentences).
DON'T advertise anything. Just share your thoughts naturally.

Format:
Title: [title]
Content: [content]"""

        try:
            response = await self.openai_client.chat.completions.create(
                model="gpt-4.1-mini",
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompts.get(content_type, prompts["market_comment"])},
                ],
                temperature=1.0,
                max_tokens=300,
            )

            content = response.choices[0].message.content or ""
            lines = content.strip().split("\n", 1)
            
            if len(lines) >= 2:
                title = lines[0].replace("Title:", "").strip()
                body = lines[1].replace("Content:", "").strip()
                return {"title": title, "content": body}

        except Exception as e:
            logger.warning(f"Random content generation failed: {e}")

        return None

    async def engage_with_feed(self) -> None:
        """
        浏览 feed 并互动
        - 评论其他 agent 的帖子
        - upvote 有趣的内容
        """
        if not self.credentials:
            return

        # 选择一个 bot 去互动
        bot_name = random.choice(list(self.credentials.keys()))
        personality = next((p for p in PERSONALITIES if p.name == bot_name), None)
        if not personality:
            return

        client = MoltbookClient(api_key=self.credentials[bot_name])
        try:
            # 获取最新帖子
            feed = await client.get_submolt_feed("general", sort="new", limit=10)
            
            if not feed:
                return

            # 过滤掉自己的帖子
            other_posts = [p for p in feed if p.get("author", {}).get("name") != bot_name]
            
            if not other_posts:
                return

            # 随机选择一个帖子互动
            post = random.choice(other_posts)
            post_id = post.get("id")
            
            if not post_id:
                return

            # 50% upvote, 50% comment
            if random.random() < 0.5:
                await client.upvote_post(post_id)
                logger.info(f"👍 [{bot_name}] Upvoted a post in m/general")
            else:
                # 生成评论
                comment = await self._generate_comment(post, personality)
                if comment:
                    await client.comment(post_id, comment)
                    logger.info(f"💬 [{bot_name}] Commented: {comment[:40]}...")

        except Exception as e:
            logger.warning(f"Feed engagement error: {e}")
        finally:
            await client.close()

    async def _generate_comment(
        self,
        post: dict,
        personality: BotPersonality,
    ) -> Optional[str]:
        """生成评论"""
        if not self.openai_client:
            # 后备评论
            comments = [
                "Interesting take!",
                "I agree with this.",
                "Hmm, not sure about that...",
                "Good point!",
            ]
            return random.choice(comments)

        post_title = post.get("title", "")
        post_content = post.get("content", "")
        author = post.get("author", {}).get("name", "someone")

        try:
            response = await self.openai_client.chat.completions.create(
                model="gpt-4.1-mini",
                messages=[
                    {"role": "system", "content": f"""You are {personality.name}.
Personality: {', '.join(personality.personality_traits[:3])}
Write in whatever language feels most natural to you ({personality.language}).
Write a SHORT comment (1 sentence) in response to this post.
Be authentic to your personality. Can agree, disagree, or add a thought."""},
                    {"role": "user", "content": f"Post by @{author}:\n{post_title}\n{post_content}"},
                ],
                temperature=0.9,
                max_tokens=100,
            )

            return response.choices[0].message.content

        except Exception:
            return None


# Singleton instance
_moltbook_poster: Optional[MoltbookPoster] = None


def get_moltbook_poster() -> MoltbookPoster:
    """Get or create MoltbookPoster instance"""
    global _moltbook_poster
    if _moltbook_poster is None:
        _moltbook_poster = MoltbookPoster()
    return _moltbook_poster
