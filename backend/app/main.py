from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime
import logging

from app.core.config import settings
from app.db.database import AsyncSessionLocal
from app.api import api_router
from app.services.round_manager import round_manager
from app.models import Symbol, Round
from sqlalchemy import select

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Scheduler instance
scheduler = AsyncIOScheduler()


async def round_scheduler_job():
    """
    Round scheduler job - runs every 5 seconds
    Checks all enabled symbols and manages their rounds
    """
    logger.debug("Running round scheduler...")

    async with AsyncSessionLocal() as db:
        # Get all enabled symbols
        result = await db.execute(
            select(Symbol).where(Symbol.enabled == True)
        )
        symbols = result.scalars().all()

        for sym in symbols:
            try:
                now = datetime.utcnow()

                # Check for active or settling rounds
                active_result = await db.execute(
                    select(Round)
                    .where(Round.symbol == sym.symbol, Round.status.in_(["active", "settling"]))
                    .order_by(Round.start_time.desc())
                    .limit(1)
                )
                active_round = active_result.scalar_one_or_none()

                if active_round:
                    # Check if round should be settled
                    if now >= active_round.end_time:
                        logger.info(
                            f"Settling round {active_round.id} for {sym.symbol} (status: {active_round.status})")
                        try:
                            await round_manager.settle_round(db, active_round.id)
                            # Create new round after successful settlement
                            logger.info(f"Creating new round for {sym.symbol}")
                            await round_manager.create_round(db, sym)
                        except Exception as settle_err:
                            logger.error(
                                f"Settlement error for {sym.symbol}: {settle_err}")
                            # Still create a new round to keep the game going
                            logger.info(
                                f"Creating new round for {sym.symbol} despite settlement error")
                            await round_manager.create_round(db, sym)
                else:
                    # No active round, create one
                    logger.info(
                        f"No active round for {sym.symbol}, creating one")
                    await round_manager.create_round(db, sym)

            except Exception as e:
                logger.error(f"Error processing {sym.symbol}: {e}")


async def seed_symbols():
    """Seed initial symbol data"""
    async with AsyncSessionLocal() as db:
        # Check if symbols already exist
        result = await db.execute(select(Symbol).limit(1))
        if result.scalar_one_or_none():
            logger.info("Symbols already seeded")
            return

        # Seed symbols
        symbols = [
            # Crypto - Enabled
            Symbol(
                symbol="BTCUSDT",
                display_name="Bitcoin",
                category="crypto",
                api_source="futures",
                product_type="USDT-FUTURES",
                round_duration=600,
                enabled=True,
                emoji="₿"
            ),
            # Crypto - Coming Soon
            Symbol(
                symbol="ETHUSDT",
                display_name="Ethereum",
                category="crypto",
                api_source="futures",
                product_type="USDT-FUTURES",
                round_duration=600,
                enabled=False,
                emoji="◆"
            ),
            Symbol(
                symbol="SOLUSDT",
                display_name="Solana",
                category="crypto",
                api_source="futures",
                product_type="USDT-FUTURES",
                round_duration=600,
                enabled=False,
                emoji="◎"
            ),
            Symbol(
                symbol="BNBUSDT",
                display_name="BNB",
                category="crypto",
                api_source="futures",
                product_type="USDT-FUTURES",
                round_duration=600,
                enabled=False,
                emoji="🔶"
            ),
            Symbol(
                symbol="XRPUSDT",
                display_name="Ripple",
                category="crypto",
                api_source="futures",
                product_type="USDT-FUTURES",
                round_duration=600,
                enabled=False,
                emoji="✕"
            ),
            Symbol(
                symbol="DOGEUSDT",
                display_name="Dogecoin",
                category="crypto",
                api_source="futures",
                product_type="USDT-FUTURES",
                round_duration=600,
                enabled=False,
                emoji="🐕"
            ),
            Symbol(
                symbol="PEPEUSDT",
                display_name="Pepe",
                category="crypto",
                api_source="futures",
                product_type="USDT-FUTURES",
                round_duration=600,
                enabled=False,
                emoji="🐸"
            ),
            # Commodities
            Symbol(
                symbol="XAUUSD",
                display_name="Gold",
                category="metal",
                api_source="tradfi",
                product_type="TRADFI",
                round_duration=600,
                enabled=False,
                emoji="🥇"
            ),
            Symbol(
                symbol="XAGUSD",
                display_name="Silver",
                category="metal",
                api_source="tradfi",
                product_type="TRADFI",
                round_duration=600,
                enabled=False,
                emoji="🥈"
            ),
            # Forex
            Symbol(
                symbol="EURUSD",
                display_name="Euro / US Dollar",
                category="forex",
                api_source="tradfi",
                product_type="TRADFI",
                round_duration=600,
                enabled=False,
                emoji="€"
            ),
            Symbol(
                symbol="GBPUSD",
                display_name="British Pound",
                category="forex",
                api_source="tradfi",
                product_type="TRADFI",
                round_duration=600,
                enabled=False,
                emoji="£"
            ),
            # Stocks
            Symbol(
                symbol="AAPLUSD",
                display_name="Apple Inc.",
                category="stock",
                api_source="uex",
                product_type="UEX-STOCK",
                round_duration=600,
                enabled=False,
                emoji="🍎"
            ),
            Symbol(
                symbol="TSLAUSD",
                display_name="Tesla Inc.",
                category="stock",
                api_source="uex",
                product_type="UEX-STOCK",
                round_duration=600,
                enabled=False,
                emoji="⚡"
            ),
            Symbol(
                symbol="NVDAUSD",
                display_name="NVIDIA Corp.",
                category="stock",
                api_source="uex",
                product_type="UEX-STOCK",
                round_duration=600,
                enabled=False,
                emoji="🎮"
            ),
        ]

        for sym in symbols:
            db.add(sym)

        await db.commit()
        logger.info(f"Seeded {len(symbols)} symbols")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    # Startup
    logger.info("Starting Claw Brawl API...")

    # Seed symbols if needed
    await seed_symbols()

    # Start scheduler
    scheduler.add_job(
        round_scheduler_job,
        # Run every 5 seconds for responsive round transitions
        IntervalTrigger(seconds=5),
        id="round_scheduler",
        replace_existing=True
    )
    scheduler.start()
    logger.info("Scheduler started")

    # Run initial round check
    await round_scheduler_job()

    yield

    # Shutdown
    scheduler.shutdown()
    logger.info("Scheduler stopped")


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    redoc_url=f"{settings.API_V1_PREFIX}/redoc",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "name": settings.APP_NAME,
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/health")
async def health():
    """Health check"""
    return {"status": "healthy"}
