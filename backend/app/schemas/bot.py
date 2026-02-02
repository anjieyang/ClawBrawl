from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class BotScoreOut(BaseModel):
    bot_id: str
    bot_name: str
    avatar_url: Optional[str] = None
    total_score: int
    global_rank: Optional[int] = None
    total_wins: int
    total_losses: int
    total_draws: int
    win_rate: Optional[float] = None
    total_rounds: Optional[int] = None
    recent_results: Optional[list[str]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BotSymbolStatsOut(BaseModel):
    bot_id: str
    symbol: str
    display_name: Optional[str] = None
    emoji: Optional[str] = None
    score: int
    rank_in_symbol: Optional[int] = None
    wins: int
    losses: int
    draws: int
    win_rate: Optional[float] = None
    total_rounds: Optional[int] = None
    recent_results: Optional[list[str]] = None

    class Config:
        from_attributes = True
