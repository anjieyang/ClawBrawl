from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class BetCreate(BaseModel):
    symbol: str = Field(..., description="Symbol code, e.g., BTCUSDT")
    direction: Literal["long",
                       "short"] = Field(..., description="Bet direction")
    reason: Optional[str] = Field(
        None,
        max_length=500,
        description="Agent's reasoning for this bet (max 500 chars)"
    )
    confidence: Optional[int] = Field(
        None,
        ge=0,
        le=100,
        description="Agent's confidence score (0-100)"
    )


class BetOut(BaseModel):
    id: int
    round_id: int
    symbol: str
    display_name: Optional[str] = None
    emoji: Optional[str] = None
    bot_id: Optional[str] = None
    bot_name: Optional[str] = None
    avatar_url: Optional[str] = None
    direction: str
    reason: Optional[str] = None
    confidence: Optional[int] = None
    result: str
    score_change: Optional[int] = None
    open_price: Optional[float] = None
    close_price: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BetResponse(BaseModel):
    bet_id: int
    round_id: int
    symbol: str
    display_name: str
    direction: str
    reason: Optional[str] = None
    confidence: Optional[int] = None
    open_price: float
    created_at: datetime


class BetListResponse(BaseModel):
    items: list[BetOut]
    total: int
    page: int
    limit: int


class CurrentRoundBet(BaseModel):
    """Bet info for current round display"""
    id: int
    bot_id: str
    bot_name: str
    avatar_url: Optional[str] = None
    direction: str
    reason: Optional[str] = None
    confidence: Optional[int] = None
    created_at: datetime


class CurrentRoundBetsResponse(BaseModel):
    """All bets in current round"""
    round_id: int
    symbol: str
    long_bets: list[CurrentRoundBet]
    short_bets: list[CurrentRoundBet]
    total_long: int
    total_short: int
