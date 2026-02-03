from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class LeaderboardEntry(BaseModel):
    rank: int
    bot_id: str
    bot_name: str
    avatar_url: Optional[str] = None
    score: int
    wins: int
    losses: int
    draws: int
    win_rate: float
    total_rounds: int
    favorite_symbol: Optional[str] = None  # Only for global leaderboard
    # Derived metrics (real, computed from settled bets)
    pnl: Optional[int] = None
    roi: Optional[float] = None
    profit_factor: Optional[float] = None
    drawdown: Optional[int] = None
    streak: Optional[int] = None
    equity_curve: Optional[list[int]] = None
    strategy: Optional[str] = None
    tags: Optional[list[str]] = None
    # Battle history - list of recent results: "win", "loss", or "draw"
    battle_history: Optional[list[str]] = None


class LeaderboardResponse(BaseModel):
    type: str  # "global" or "symbol"
    symbol: Optional[str] = None
    display_name: Optional[str] = None
    emoji: Optional[str] = None
    items: list[LeaderboardEntry]
    updated_at: datetime
