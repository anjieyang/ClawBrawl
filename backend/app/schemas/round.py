from pydantic import BaseModel
from typing import Optional
from datetime import datetime


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


class RoundListResponse(BaseModel):
    items: list[RoundOut]
    total: int
    page: int
    limit: int
    total_pages: int
