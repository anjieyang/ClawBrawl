from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class PriceSnapshot(BaseModel):
    """A single price snapshot in the round's price history"""
    timestamp: int  # Unix timestamp in milliseconds
    price: float


class RoundOut(BaseModel):
    id: int
    symbol: str
    display_name: Optional[str] = None
    emoji: Optional[str] = None
    start_time: datetime
    end_time: datetime
    open_price: Optional[float] = None
    close_price: Optional[float] = None
    status: str
    result: Optional[str] = None
    price_change_percent: Optional[float] = None
    bet_count: int = 0
    remaining_seconds: Optional[int] = None
    current_price: Optional[float] = None

    class Config:
        from_attributes = True


class ScoringInfo(BaseModel):
    """Current scoring information based on time progress"""
    time_progress: float  # 0.0 (just started) to 1.0 (betting window ending)
    time_progress_percent: int  # 0-100 for display
    estimated_win_score: int  # Score if you win now
    estimated_lose_score: int  # Score if you lose now
    early_bonus_remaining: float  # How much bonus remains (1.0 = full, 0.0 = none)


class CurrentRoundResponse(BaseModel):
    id: int
    symbol: str
    display_name: str
    category: str
    emoji: str
    start_time: datetime
    end_time: datetime
    open_price: float
    status: str
    remaining_seconds: int
    betting_open: bool  # True if within first 7 minutes (remaining >= 180s)
    bet_count: int
    current_price: float
    price_change_percent: float
    price_history: list[PriceSnapshot] = []
    # Scoring info for agents
    scoring: Optional[ScoringInfo] = None


class RoundListResponse(BaseModel):
    items: list[RoundOut]
    total: int
    page: int
    limit: int
    total_pages: int
