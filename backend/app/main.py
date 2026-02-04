from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime
import logging

from app.core.config import settings
from app.db.database import AsyncSessionLocal
from app.api import api_router
from app.services.round_manager import round_manager
from app.services.market import market_service
from app.services.price_history import price_history_service
from app.services.ws_hub import ws_hub
from app.models import Symbol, Round
from sqlalchemy import select
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Scheduler instance
scheduler = AsyncIOScheduler()


async def price_sampler_job():
    """
    Price sampler job - runs every second
    Records current price for all active rounds to database.
    Also broadcasts price_tick to WebSocket subscribers.
    
    This ensures we have second-level price history even if:
    - Frontend is not connected
    - Backend restarts (data persists in DB)
    - Bitget API has gaps
    """
    async with AsyncSessionLocal() as db:
        try:
            # Get all active rounds
            result = await db.execute(
                select(Round, Symbol)
                .join(Symbol, Round.symbol == Symbol.symbol)
                .where(Round.status == "active")
            )
            active_rounds = result.all()
            
            for round_obj, symbol_config in active_rounds:
                try:
                    # Get current price
                    current_price = await market_service.get_price_by_source(
                        symbol_config.symbol,
                        symbol_config.api_source,
                        symbol_config.product_type
                    )
                    
                    # Record to database
                    timestamp_ms = int(time.time() * 1000)
                    await price_history_service.record_price(
                        db=db,
                        round_id=round_obj.id,
                        timestamp_ms=timestamp_ms,
                        price=current_price
                    )
                    
                    # Calculate price change and remaining time
                    now = datetime.utcnow()
                    remaining = max(0, int((round_obj.end_time - now).total_seconds()))
                    price_change = ((current_price - round_obj.open_price) / 
                                    round_obj.open_price) * 100 if round_obj.open_price else 0
                    
                    # Broadcast price_tick to WebSocket subscribers
                    await ws_hub.broadcast(symbol_config.symbol, {
                        "type": "price_tick",
                        "data": {
                            "price": float(current_price),
                            "timestamp": timestamp_ms,
                            "change_percent": round(price_change, 4),
                            "remaining_seconds": remaining
                        }
                    })
                    
                except Exception as e:
                    logger.debug(f"Price sample failed for {symbol_config.symbol}: {e}")
                    
        except Exception as e:
            logger.error(f"Price sampler error: {e}")


async def round_scheduler_job():
    """
    Round scheduler job - runs every 5 seconds
    Checks all enabled symbols and manages their rounds.
    Also broadcasts round_start and round_end events to WebSocket subscribers.
    
    Rounds are aligned to fixed 10-minute intervals:
    - Start times: :00, :10, :20, :30, :40, :50
    - Each round runs for exactly 10 minutes
    - Example: 14:00-14:10, 14:10-14:20, etc.
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
                duration = sym.round_duration or settings.DEFAULT_ROUND_DURATION
                
                # Calculate current aligned interval
                current_start, current_end = round_manager.get_aligned_round_times(now, duration)

                # Check for active or settling rounds
                active_result = await db.execute(
                    select(Round)
                    .where(Round.symbol == sym.symbol, Round.status.in_(["active", "settling"]))
                    .order_by(Round.start_time.desc())
                    .limit(1)
                )
                active_round = active_result.scalar_one_or_none()

                if active_round:
                    # Check if round should be settled (end_time has passed)
                    if now >= active_round.end_time:
                        logger.info(
                            f"Settling round {active_round.id} for {sym.symbol} "
                            f"(ended at {active_round.end_time.strftime('%H:%M:%S')}, status: {active_round.status})")
                        try:
                            settled_round = await round_manager.settle_round(db, active_round.id)
                            
                            # Broadcast round_end event
                            if settled_round:
                                price_change_pct = (settled_round.price_change * 100) if settled_round.price_change else 0
                                await ws_hub.broadcast(sym.symbol, {
                                    "type": "round_end",
                                    "data": {
                                        "id": settled_round.id,
                                        "result": settled_round.result,
                                        "close_price": float(settled_round.close_price) if settled_round.close_price else None,
                                        "price_change_percent": round(price_change_pct, 4)
                                    }
                                })
                                logger.info(f"Broadcast round_end for {sym.symbol} round {settled_round.id}")
                        except Exception as settle_err:
                            logger.error(
                                f"Settlement error for {sym.symbol}: {settle_err}")
                        
                        # Check if we need a new round for the current interval
                        # Only create if we're within the current aligned interval
                        if current_start <= now < current_end:
                            # Check if a round already exists for this interval
                            existing_result = await db.execute(
                                select(Round)
                                .where(
                                    Round.symbol == sym.symbol,
                                    Round.start_time == current_start
                                )
                            )
                            existing_round = existing_result.scalar_one_or_none()
                            
                            if not existing_round:
                                logger.info(
                                    f"Creating new round for {sym.symbol} "
                                    f"({current_start.strftime('%H:%M')} - {current_end.strftime('%H:%M')})")
                                new_round = await round_manager.create_round(db, sym)
                                
                                # Broadcast round_start event
                                if new_round:
                                    await _broadcast_round_start(sym, new_round)
                else:
                    # No active round - check if we should create one for current interval
                    if current_start <= now < current_end:
                        # Check if a round already exists for this interval (might be settled)
                        existing_result = await db.execute(
                            select(Round)
                            .where(
                                Round.symbol == sym.symbol,
                                Round.start_time == current_start
                            )
                        )
                        existing_round = existing_result.scalar_one_or_none()
                        
                        if not existing_round:
                            logger.info(
                                f"No active round for {sym.symbol}, creating one "
                                f"({current_start.strftime('%H:%M')} - {current_end.strftime('%H:%M')})")
                            new_round = await round_manager.create_round(db, sym)
                            
                            # Broadcast round_start event
                            if new_round:
                                await _broadcast_round_start(sym, new_round)
                        else:
                            logger.debug(
                                f"Round already exists for current interval {sym.symbol} "
                                f"(id={existing_round.id}, status={existing_round.status})")

            except Exception as e:
                logger.error(f"Error processing {sym.symbol}: {e}")


async def _broadcast_round_start(sym: Symbol, round_obj: Round) -> None:
    """Helper to broadcast round_start event."""
    try:
        now = datetime.utcnow()
        remaining = max(0, int((round_obj.end_time - now).total_seconds()))
        betting_open = remaining >= settings.BETTING_CUTOFF_REMAINING
        
        await ws_hub.broadcast(sym.symbol, {
            "type": "round_start",
            "data": {
                "id": round_obj.id,
                "symbol": round_obj.symbol,
                "display_name": sym.display_name,
                "category": sym.category,
                "emoji": sym.emoji,
                "start_time": round_obj.start_time.isoformat() + "Z",
                "end_time": round_obj.end_time.isoformat() + "Z",
                "open_price": float(round_obj.open_price),
                "current_price": float(round_obj.open_price),
                "price_change_percent": 0.0,
                "status": round_obj.status,
                "remaining_seconds": remaining,
                "betting_open": betting_open,
                "bet_count": 0,
                "price_history": [],
                "scoring": None
            }
        })
        logger.info(f"Broadcast round_start for {sym.symbol} round {round_obj.id}")
    except Exception as e:
        logger.error(f"Failed to broadcast round_start: {e}")


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
    
    # Add price sampler job - runs every second to record prices to database
    scheduler.add_job(
        price_sampler_job,
        IntervalTrigger(seconds=1),
        id="price_sampler",
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("Scheduler started (round_scheduler: 5s, price_sampler: 1s)")

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


# Custom validation error handler for friendlier bet validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with friendly messages for bet API"""
    errors = exc.errors()
    
    # Check for common bet validation errors
    for error in errors:
        loc = error.get("loc", [])
        field = loc[-1] if loc else ""
        error_type = error.get("type", "")
        
        # Missing reason
        if field == "reason" and "missing" in error_type:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "data": None,
                    "error": "MISSING_REASON",
                    "hint": "Every bet MUST include a 'reason' field (10-500 chars). Explain your analysis!"
                }
            )
        
        # Reason too short
        if field == "reason" and "string_too_short" in error_type:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "data": None,
                    "error": "REASON_TOO_SHORT",
                    "hint": "Your reason must be at least 10 characters. Provide meaningful analysis!"
                }
            )
        
        # Missing confidence
        if field == "confidence" and "missing" in error_type:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "data": None,
                    "error": "MISSING_CONFIDENCE",
                    "hint": "Every bet MUST include a 'confidence' score (0-100). How confident are you?"
                }
            )
        
        # Invalid confidence range
        if field == "confidence" and ("greater" in error_type or "less" in error_type):
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "data": None,
                    "error": "INVALID_CONFIDENCE",
                    "hint": "Confidence must be between 0 and 100"
                }
            )
    
    # Default validation error response
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "data": None,
            "error": "VALIDATION_ERROR",
            "hint": str(errors)
        }
    )


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
