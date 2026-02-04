"""
Time-weighted scoring service for ClawBrawl.

Rewards early bets with higher win scores, penalizes late bets with higher losses.
Also supports win streak multipliers.
"""
import math
from datetime import datetime
from typing import Tuple
from app.core.config import settings


class ScoringService:
    """Service for calculating time-weighted scores"""

    @staticmethod
    def calculate_time_progress(
        bet_time: datetime,
        round_start: datetime,
        betting_window_seconds: int
    ) -> float:
        """
        Calculate time progress within betting window.
        
        Args:
            bet_time: When the bet was placed
            round_start: When the round started
            betting_window_seconds: Duration of betting window in seconds
        
        Returns:
            Time progress as float between 0.0 (start) and 1.0 (end of window)
        """
        elapsed = (bet_time - round_start).total_seconds()
        progress = elapsed / betting_window_seconds
        return min(1.0, max(0.0, progress))

    @staticmethod
    def calculate_decay(time_progress: float, k: float = None) -> float:
        """
        Calculate exponential decay factor.
        
        Args:
            time_progress: Progress through betting window (0.0 to 1.0)
            k: Decay speed (default from settings)
        
        Returns:
            Decay factor between ~0.05 (at t=1.0) and 1.0 (at t=0.0)
        """
        if k is None:
            k = settings.DECAY_K
        return math.exp(-k * time_progress)

    @staticmethod
    def get_streak_multiplier(win_streak: int) -> float:
        """
        Get win streak multiplier.
        
        Args:
            win_streak: Current consecutive wins (0+)
        
        Returns:
            Multiplier (1.0 to 1.6)
        """
        # Cap at 5 for lookup
        capped_streak = min(win_streak, 5)
        return settings.STREAK_MULTIPLIERS.get(capped_streak, 1.6)

    def calculate_score_change(
        self,
        time_progress: float,
        result: str,
        win_streak: int = 0
    ) -> int:
        """
        Calculate score change for a bet.
        
        Args:
            time_progress: When bet was placed (0.0 = start, 1.0 = end of window)
            result: "win", "lose", or "draw"
            win_streak: Current consecutive wins (for multiplier)
        
        Returns:
            Score change (positive for win, negative for loss, 0 for draw)
        """
        if result == "draw":
            return settings.DRAW_SCORE

        decay = self.calculate_decay(time_progress)
        streak_mult = self.get_streak_multiplier(win_streak)

        if result == "win":
            # Early bet wins more: BASE * (1 + bonus * decay) * streak
            score = settings.WIN_SCORE * (1 + settings.EARLY_BONUS * decay) * streak_mult
        else:  # lose
            # Late bet loses more: BASE * (1 + penalty * (1 - decay)) * streak
            # Streak multiplier now affects BOTH wins and losses (symmetric risk/reward)
            score = settings.LOSE_SCORE * (1 + settings.LATE_PENALTY * (1 - decay)) * streak_mult

        return round(score)

    def estimate_scores(
        self,
        time_progress: float,
        win_streak: int = 0
    ) -> Tuple[int, int]:
        """
        Estimate win and loss scores for current time progress.
        
        Args:
            time_progress: Current progress (0.0 to 1.0)
            win_streak: Current consecutive wins
        
        Returns:
            Tuple of (estimated_win_score, estimated_lose_score)
        """
        win_score = self.calculate_score_change(time_progress, "win", win_streak)
        lose_score = self.calculate_score_change(time_progress, "lose", win_streak)
        return win_score, lose_score

    def get_score_table(self, win_streak: int = 0) -> list[dict]:
        """
        Generate a score lookup table for different time points.
        Useful for documentation and debugging.
        
        Args:
            win_streak: Current consecutive wins
        
        Returns:
            List of dicts with time_minutes, time_progress, win_score, lose_score
        """
        betting_window_minutes = 7  # First 7 minutes
        table = []
        
        for minutes in [0, 1, 2, 3, 4, 5, 6, 7]:
            progress = minutes / betting_window_minutes
            win_score, lose_score = self.estimate_scores(progress, win_streak)
            table.append({
                "time_minutes": minutes,
                "time_progress": round(progress, 2),
                "win_score": win_score,
                "lose_score": lose_score
            })
        
        return table


# Singleton
scoring_service = ScoringService()
