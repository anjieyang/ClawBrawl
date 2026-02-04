"""
Price History Service

Manages second-level price snapshots for each round.
- Stores prices in database for persistence
- Auto-backfills missing data on startup using Bitget API
- Supports multiple symbols through round_id
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.mysql import insert as mysql_insert
from app.models import Round, PriceSnapshot
from app.services.market import market_service
from app.core.config import settings
import logging
import calendar

logger = logging.getLogger(__name__)


class PriceHistoryService:
    """Service for managing price snapshots"""

    async def record_price(
        self,
        db: AsyncSession,
        round_id: int,
        timestamp_ms: int,
        price: float
    ) -> bool:
        """
        Record a single price snapshot for a round.
        Uses INSERT IGNORE to handle duplicates gracefully.
        
        Args:
            db: Database session
            round_id: Round ID
            timestamp_ms: Unix timestamp in milliseconds
            price: Price value
        
        Returns:
            True if recorded, False if skipped (duplicate)
        """
        try:
            # Use MySQL INSERT ... ON DUPLICATE KEY UPDATE (effectively ignore)
            stmt = mysql_insert(PriceSnapshot).values(
                round_id=round_id,
                timestamp=timestamp_ms,
                price=price
            ).on_duplicate_key_update(
                # Update price even if exists (idempotent, no real change)
                price=price
            )
            result = await db.execute(stmt)
            await db.commit()
            
            return result.rowcount > 0
        except Exception as e:
            logger.warning(f"Failed to record price for round {round_id}: {e}")
            await db.rollback()
            return False

    async def get_price_history(
        self,
        db: AsyncSession,
        round_id: int
    ) -> list[dict]:
        """
        Get all price snapshots for a round from database.
        
        Args:
            db: Database session
            round_id: Round ID
        
        Returns:
            List of {timestamp, price} dicts ordered by timestamp
        """
        result = await db.execute(
            select(PriceSnapshot.timestamp, PriceSnapshot.price)
            .where(PriceSnapshot.round_id == round_id)
            .order_by(PriceSnapshot.timestamp)
        )
        
        return [
            {"timestamp": row[0], "price": float(row[1])}
            for row in result.all()
        ]

    async def get_snapshot_count(
        self,
        db: AsyncSession,
        round_id: int
    ) -> int:
        """Get number of price snapshots for a round"""
        result = await db.execute(
            select(func.count(PriceSnapshot.id))
            .where(PriceSnapshot.round_id == round_id)
        )
        return result.scalar() or 0

    async def backfill_round_history(
        self,
        db: AsyncSession,
        round: Round,
        symbol_product_type: str = "USDT-FUTURES"
    ) -> int:
        """
        Backfill missing price history for a round using Bitget API.
        
        Called on startup or when data is insufficient.
        
        Args:
            db: Database session
            round: Round object
            symbol_product_type: Product type for API call
        
        Returns:
            Number of new snapshots added
        """
        # Calculate time range
        round_start_ms = int(calendar.timegm(round.start_time.timetuple()) * 1000)
        now_ms = int(datetime.utcnow().timestamp() * 1000)
        
        # Don't fetch future data
        end_ms = min(now_ms, int(calendar.timegm(round.end_time.timetuple()) * 1000))
        
        # Get existing timestamps to avoid duplicates
        existing_result = await db.execute(
            select(PriceSnapshot.timestamp)
            .where(PriceSnapshot.round_id == round.id)
        )
        existing_timestamps = {row[0] for row in existing_result.all()}
        
        # Calculate expected data points
        elapsed_seconds = max(0, (end_ms - round_start_ms) // 1000)
        expected_points = elapsed_seconds
        current_points = len(existing_timestamps)
        
        # If we have enough data, skip backfill
        missing_ratio = 1 - (current_points / max(expected_points, 1))
        if missing_ratio < 0.1:  # Less than 10% missing
            logger.debug(f"Round {round.id}: {current_points}/{expected_points} points, skipping backfill")
            return 0
        
        logger.info(f"Round {round.id}: Backfilling {current_points}/{expected_points} points ({missing_ratio:.0%} missing)")
        
        try:
            # Fetch historical data from Bitget
            tick_prices = await market_service.get_historical_prices_aggregated(
                symbol=round.symbol,
                product_type=symbol_product_type,
                start_time=round_start_ms,
                end_time=end_ms,
                interval_ms=1000  # 1 second intervals
            )
            
            if not tick_prices:
                logger.warning(f"No tick data returned for round {round.id}")
                return 0
            
            # Insert new snapshots
            added = 0
            for point in tick_prices:
                ts = point["timestamp"]
                if ts not in existing_timestamps:
                    success = await self.record_price(
                        db, round.id, ts, point["price"]
                    )
                    if success:
                        added += 1
            
            logger.info(f"Round {round.id}: Backfilled {added} new price points")
            return added
            
        except Exception as e:
            logger.error(f"Failed to backfill round {round.id}: {e}")
            return 0

    async def ensure_round_history(
        self,
        db: AsyncSession,
        round: Round,
        symbol_product_type: str = "USDT-FUTURES",
        min_coverage: float = 0.5
    ) -> list[dict]:
        """
        Ensure a round has sufficient price history, backfilling if needed.
        
        This is the main method called by the API endpoint.
        
        Args:
            db: Database session
            round: Round object
            symbol_product_type: Product type for API call
            min_coverage: Minimum data coverage ratio (0-1) to skip backfill
        
        Returns:
            List of {timestamp, price} dicts
        """
        # Get current count
        count = await self.get_snapshot_count(db, round.id)
        
        # Calculate expected count
        now = datetime.utcnow()
        elapsed = (min(now, round.end_time) - round.start_time).total_seconds()
        expected = max(1, int(elapsed))
        
        coverage = count / expected if expected > 0 else 1
        
        # Backfill if coverage is too low
        if coverage < min_coverage:
            await self.backfill_round_history(db, round, symbol_product_type)
        
        # Return current history from database
        return await self.get_price_history(db, round.id)


# Singleton
price_history_service = PriceHistoryService()
