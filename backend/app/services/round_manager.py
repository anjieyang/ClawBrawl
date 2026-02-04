from datetime import datetime, timedelta
from typing import Optional, Tuple
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Symbol, Round, Bet, BotScore, BotSymbolStats
from app.services.market import market_service
from app.services.scoring import scoring_service
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class RoundManager:
    """Service for managing game rounds"""

    @staticmethod
    def get_aligned_round_times(now: datetime, round_duration_seconds: int = 600) -> Tuple[datetime, datetime]:
        """
        Calculate aligned round start and end times based on fixed intervals.
        
        Rounds are aligned to fixed time boundaries (e.g., :00, :10, :20, :30, :40, :50 for 10-min rounds).
        This ensures all rounds start and end at predictable times.
        
        Args:
            now: Current UTC datetime
            round_duration_seconds: Round duration in seconds (default 600 = 10 minutes)
        
        Returns:
            Tuple of (start_time, end_time) aligned to interval boundaries
        """
        interval_minutes = round_duration_seconds // 60
        
        # Calculate the current interval's start time
        # Floor the current time to the nearest interval boundary
        current_minute = now.minute
        aligned_minute = (current_minute // interval_minutes) * interval_minutes
        
        start_time = now.replace(minute=aligned_minute, second=0, microsecond=0)
        end_time = start_time + timedelta(seconds=round_duration_seconds)
        
        return start_time, end_time

    @staticmethod
    def get_next_round_times(now: datetime, round_duration_seconds: int = 600) -> Tuple[datetime, datetime]:
        """
        Calculate the NEXT round's start and end times.
        
        Used when we need to create a round for the upcoming interval.
        
        Args:
            now: Current UTC datetime
            round_duration_seconds: Round duration in seconds
        
        Returns:
            Tuple of (start_time, end_time) for the next interval
        """
        current_start, _ = RoundManager.get_aligned_round_times(now, round_duration_seconds)
        next_start = current_start + timedelta(seconds=round_duration_seconds)
        next_end = next_start + timedelta(seconds=round_duration_seconds)
        
        return next_start, next_end

    async def get_current_round(self, db: AsyncSession, symbol: str) -> Optional[Round]:
        """Get the current active round for a symbol"""
        result = await db.execute(
            select(Round)
            .where(Round.symbol == symbol, Round.status == "active")
            .order_by(Round.start_time.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def create_round(
        self, 
        db: AsyncSession, 
        symbol_config: Symbol,
        force_aligned: bool = True
    ) -> Round:
        """
        Create a new round for a symbol with aligned start/end times.
        
        Args:
            db: Database session
            symbol_config: Symbol configuration
            force_aligned: If True, align times to interval boundaries (default True)
        
        Returns:
            The created Round object
        """
        now = datetime.utcnow()
        duration = symbol_config.round_duration or settings.DEFAULT_ROUND_DURATION

        # Calculate aligned times
        if force_aligned:
            start_time, end_time = self.get_aligned_round_times(now, duration)
        else:
            start_time = now
            end_time = now + timedelta(seconds=duration)

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
            start_time=start_time,
            end_time=end_time,
            open_price=open_price,
            status="active"
        )

        db.add(round)
        await db.commit()
        await db.refresh(round)

        logger.info(
            f"Created round {round.id} for {symbol_config.symbol}: {start_time.strftime('%H:%M')} - {end_time.strftime('%H:%M')} @ {open_price}")
        return round

    async def settle_round(self, db: AsyncSession, round_id: int) -> Optional[Round]:
        """Settle a round and update all bets. Returns settled round or None."""
        # Get round with symbol config
        result = await db.execute(
            select(Round, Symbol)
            .join(Symbol, Round.symbol == Symbol.symbol)
            .where(Round.id == round_id)
        )
        row = result.one_or_none()
        if not row:
            logger.error(f"Round {round_id} not found")
            return None

        round, symbol_config = row

        # Allow settling both "active" and stuck "settling" rounds
        if round.status not in ("active", "settling"):
            logger.warning(
                f"Round {round_id} status is {round.status}, skipping settlement")
            return None

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

            # Get win streaks for all bots in this round (with skip penalty applied)
            bot_ids = [b.bot_id for b in bets]
            win_streaks = await self._get_win_streaks(
                db, bot_ids, current_round_id=round_id, symbol=round.symbol
            )

            # Settle each bet
            for bet in bets:
                if round_result == "draw":
                    bet_result = "draw"
                elif (bet.direction == "long" and round_result == "up") or \
                     (bet.direction == "short" and round_result == "down"):
                    bet_result = "win"
                else:
                    bet_result = "lose"

                # Calculate time-weighted score
                time_progress = bet.time_progress if bet.time_progress is not None else 0.5
                win_streak = win_streaks.get(bet.bot_id, 0)
                score_change = scoring_service.calculate_score_change(
                    time_progress, bet_result, win_streak
                )

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
            
            return round

        except Exception as e:
            logger.error(f"Settlement failed for round {round_id}: {e}")
            # Revert to active so it can be retried
            try:
                round.status = "active"
                await db.commit()
            except Exception:
                pass  # Ignore rollback errors
            raise  # Re-raise to let caller handle

    async def _get_win_streaks(
        self,
        db: AsyncSession,
        bot_ids: list[str],
        current_round_id: int = None,
        symbol: str = None
    ) -> dict[str, int]:
        """
        Get current win streak for each bot, with skip penalty.
        
        If a bot skips too many consecutive rounds (beyond grace period),
        their streak is reset to 0 to prevent "cherry-picking" rounds.
        
        Returns:
            Dict mapping bot_id to win streak (0 if no streak, on losing streak, or skipped too many)
        """
        if not bot_ids:
            return {}

        streaks: dict[str, int] = {}

        # Get recent settled bets for each bot (up to 10)
        rn = func.row_number().over(
            partition_by=Bet.bot_id, order_by=Bet.created_at.desc()
        ).label("rn")
        subq = (
            select(Bet.bot_id, Bet.result, rn)
            .where(Bet.bot_id.in_(bot_ids), Bet.result != "pending")
            .subquery()
        )
        streak_rows = await db.execute(
            select(subq.c.bot_id, subq.c.result)
            .where(subq.c.rn <= 10)
            .order_by(subq.c.bot_id, subq.c.rn)
        )

        # Group results by bot_id
        bot_results: dict[str, list[str]] = {}
        for bot_id, result in streak_rows.all():
            if bot_id not in bot_results:
                bot_results[bot_id] = []
            bot_results[bot_id].append(result)

        # Calculate streak for each bot
        for bot_id, results in bot_results.items():
            streak = 0
            for res in results:
                if res == "win":
                    streak += 1
                elif res == "draw":
                    continue  # Draws don't break streak
                else:
                    break  # Lose breaks streak
            streaks[bot_id] = streak

        # Apply skip penalty if enabled
        if settings.STREAK_DECAY_ON_SKIP and current_round_id and symbol:
            streaks = await self._apply_skip_penalty(
                db, streaks, bot_ids, current_round_id, symbol
            )

        return streaks

    async def _apply_skip_penalty(
        self,
        db: AsyncSession,
        streaks: dict[str, int],
        bot_ids: list[str],
        current_round_id: int,
        symbol: str
    ) -> dict[str, int]:
        """
        Apply streak penalty for bots who skipped too many rounds.
        
        If a bot has a streak but skipped more than GRACE rounds recently,
        reset their streak to 0.
        """
        if not bot_ids:
            return streaks

        # Get recent N settled rounds for this symbol
        window_size = settings.STREAK_ACTIVITY_WINDOW_ROUNDS
        recent_rounds_result = await db.execute(
            select(Round.id)
            .where(Round.symbol == symbol, Round.status == "settled")
            .order_by(Round.id.desc())
            .limit(window_size)
        )
        recent_round_ids = [r[0] for r in recent_rounds_result.all()]

        if not recent_round_ids:
            return streaks

        # Get bets in these rounds for each bot
        bets_result = await db.execute(
            select(Bet.bot_id, Bet.round_id)
            .where(
                Bet.bot_id.in_(bot_ids),
                Bet.round_id.in_(recent_round_ids)
            )
        )
        
        # Build set of (bot_id, round_id) pairs
        bot_round_pairs = {(row[0], row[1]) for row in bets_result.all()}

        # Check each bot's participation in recent rounds (ordered from most recent)
        for bot_id in bot_ids:
            if streaks.get(bot_id, 0) <= 0:
                continue  # No streak to protect
            
            # Count consecutive skipped rounds from most recent
            consecutive_skips = 0
            for round_id in recent_round_ids:
                if (bot_id, round_id) not in bot_round_pairs:
                    consecutive_skips += 1
                else:
                    break  # Found a bet, stop counting
            
            # If skipped more than grace period, reset streak
            if consecutive_skips > settings.STREAK_SKIP_GRACE_ROUNDS:
                logger.info(
                    f"🎯 Streak penalty: {bot_id} skipped {consecutive_skips} rounds "
                    f"(grace={settings.STREAK_SKIP_GRACE_ROUNDS}), streak reset from {streaks[bot_id]} to 0"
                )
                streaks[bot_id] = 0

        return streaks

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
                score=settings.INITIAL_SCORE,
                wins=0,
                losses=0,
                draws=0,
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
