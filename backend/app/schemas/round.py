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
    bet_count: int
    current_price: float
    price_change_percent: float
    price_history: list[PriceSnapshot] = []


class RoundListResponse(BaseModel):
    items: list[RoundOut]
    total: int
    page: int
    limit: int
    total_pages: int
