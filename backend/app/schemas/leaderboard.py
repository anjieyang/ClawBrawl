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


class LeaderboardResponse(BaseModel):
    type: str  # "global" or "symbol"
    symbol: Optional[str] = None
    display_name: Optional[str] = None
    emoji: Optional[str] = None
    items: list[LeaderboardEntry]
    updated_at: datetime
