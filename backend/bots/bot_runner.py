"""
Bot Runner - 主调度器
每轮自动让 18 个 bot 下注，时间错开
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
from .clawbrawl_client import ClawBrawlClient, RoundInfo
from .market_client import get_market_context, MarketContext
from .openai_client import get_decision_maker, BotDecision
from .register_all import load_credentials

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
        logger.info(
            f"🎯 Round #{round_info.id} | {round_info.remaining_seconds}s left | "
            f"{round_info.bet_count} bets so far"
        )

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
        """Execute a single bot's bet"""
        name = personality.name
        api_key = self.credentials.get(name)

        if not api_key:
            return

        try:
            # Get other bets (for contrarian/follower personalities)
            client = ClawBrawlClient(api_key=api_key)
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

            await client.close()

            if result.success:
                logger.info(
                    f"✅ {name}: {decision.direction.upper()} "
                    f"(conf: {decision.confidence}) - {decision.reason[:50]}..."
                )
            else:
                logger.warning(
                    f"⚠️ {name}: bet failed - {result.error_code}: {result.message}"
                )

        except Exception as e:
            logger.error(f"❌ {name}: error - {e}")

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

        self.scheduler.start()
        logger.info("🚀 Scheduler started - checking every minute for new rounds")

    async def run_once(self) -> None:
        """Run one betting round immediately"""
        if not await self.initialize():
            return
        await self.run_betting_round()

    async def run_forever(self) -> None:
        """Run continuously with scheduler"""
        if not await self.initialize():
            return

        self.start_scheduler()
        self._running = True

        logger.info("🦀 Bot Runner started. Press Ctrl+C to stop.")

        try:
            while self._running:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            logger.info("👋 Shutting down...")
        finally:
            if self.scheduler:
                self.scheduler.shutdown()


# Global instance
_runner: Optional[BotRunner] = None


def get_runner() -> BotRunner:
    """Get or create runner instance"""
    global _runner
    if _runner is None:
        _runner = BotRunner()
    return _runner
