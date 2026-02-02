from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Symbol, Round, Bet, BotScore, BotSymbolStats
from app.services.market import market_service
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class RoundManager:
    """Service for managing game rounds"""

    async def get_current_round(self, db: AsyncSession, symbol: str) -> Optional[Round]:
        """Get the current active round for a symbol"""
        result = await db.execute(
            select(Round)
            .where(Round.symbol == symbol, Round.status == "active")
            .order_by(Round.start_time.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def create_round(self, db: AsyncSession, symbol_config: Symbol) -> Round:
        """Create a new round for a symbol"""
        now = datetime.utcnow()
        duration = symbol_config.round_duration or settings.DEFAULT_ROUND_DURATION

        # Get current price
        try:
            open_price = await market_service.get_price_by_source(
                symbol_config.symbol,
                symbol_config.api_source,
                symbol_config.product_type
            )
        except Exception as e:
            logger.error(
                f"Failed to get price for {symbol_config.symbol}: {e}")
            raise

        # Create round
        round = Round(
            symbol=symbol_config.symbol,
            start_time=now,
            end_time=now + timedelta(seconds=duration),
            open_price=open_price,
            status="active"
        )

        db.add(round)
        await db.commit()
        await db.refresh(round)

        logger.info(
            f"Created round {round.id} for {symbol_config.symbol} at {open_price}")
        return round

    async def settle_round(self, db: AsyncSession, round_id: int) -> None:
        """Settle a round and update all bets"""
        # Get round with symbol config
        result = await db.execute(
            select(Round, Symbol)
            .join(Symbol, Round.symbol == Symbol.symbol)
            .where(Round.id == round_id)
        )
        row = result.one_or_none()
        if not row:
            logger.error(f"Round {round_id} not found")
            return

        round, symbol_config = row

        # Allow settling both "active" and stuck "settling" rounds
        if round.status not in ("active", "settling"):
            logger.warning(
                f"Round {round_id} status is {round.status}, skipping settlement")
            return

        try:
            # Update status to settling (if not already)
            if round.status == "active":
                round.status = "settling"
                await db.commit()

            # Get close price
            close_price = await market_service.get_price_by_source(
                symbol_config.symbol,
                symbol_config.api_source,
                symbol_config.product_type
            )

            # Calculate price change
            price_change = (close_price - round.open_price) / round.open_price
            threshold = symbol_config.draw_threshold or settings.DRAW_THRESHOLD

            # Determine result
            if abs(price_change) < threshold:
                round_result = "draw"
            elif price_change > 0:
                round_result = "up"
            else:
                round_result = "down"

            # Update round
            round.close_price = close_price
            round.price_change = price_change
            round.result = round_result

            # Get all bets for this round
            bets_result = await db.execute(
                select(Bet).where(Bet.round_id == round_id)
            )
            bets = bets_result.scalars().all()

            # Settle each bet
            for bet in bets:
                if round_result == "draw":
                    score_change = settings.DRAW_SCORE
                    bet_result = "draw"
                elif (bet.direction == "long" and round_result == "up") or \
                     (bet.direction == "short" and round_result == "down"):
                    score_change = settings.WIN_SCORE
                    bet_result = "win"
                else:
                    score_change = settings.LOSE_SCORE
                    bet_result = "lose"

                # Update bet
                bet.result = bet_result
                bet.score_change = score_change

                # Update bot global score
                await self._update_bot_score(db, bet.bot_id, bet.bot_name, score_change, bet_result)

                # Update bot symbol stats
                await self._update_bot_symbol_stats(db, bet.bot_id, round.symbol, score_change, bet_result)

            # Finalize round
            round.status = "settled"
            await db.commit()

            logger.info(
                f"Settled round {round_id}: {round_result} ({price_change:.4%})")

        except Exception as e:
            logger.error(f"Settlement failed for round {round_id}: {e}")
            # Revert to active so it can be retried
            try:
                round.status = "active"
                await db.commit()
            except Exception:
                pass  # Ignore rollback errors
            raise  # Re-raise to let caller handle

    async def _update_bot_score(
        self,
        db: AsyncSession,
        bot_id: str,
        bot_name: str,
        score_change: int,
        result: str
    ) -> None:
        """Update bot's global score"""
        # Get or create bot score
        bot_score = await db.get(BotScore, bot_id)

        if not bot_score:
            bot_score = BotScore(
                bot_id=bot_id,
                bot_name=bot_name,
                total_score=settings.INITIAL_SCORE,
                avatar_url=f"https://api.dicebear.com/7.x/bottts/svg?seed={bot_id}"
            )
            db.add(bot_score)

        # Update score and stats
        bot_score.total_score += score_change
        if result == "win":
            bot_score.total_wins += 1
        elif result == "lose":
            bot_score.total_losses += 1
        else:
            bot_score.total_draws += 1

    async def _update_bot_symbol_stats(
        self,
        db: AsyncSession,
        bot_id: str,
        symbol: str,
        score_change: int,
        result: str
    ) -> None:
        """Update bot's per-symbol stats"""
        # Get or create stats
        stats_result = await db.execute(
            select(BotSymbolStats)
            .where(BotSymbolStats.bot_id == bot_id, BotSymbolStats.symbol == symbol)
        )
        stats = stats_result.scalar_one_or_none()

        if not stats:
            stats = BotSymbolStats(
                bot_id=bot_id,
                symbol=symbol,
                score=settings.INITIAL_SCORE
            )
            db.add(stats)

        # Update
        stats.score += score_change
        stats.last_bet_at = datetime.utcnow()
        if result == "win":
            stats.wins += 1
        elif result == "lose":
            stats.losses += 1
        else:
            stats.draws += 1


# Singleton
round_manager = RoundManager()
