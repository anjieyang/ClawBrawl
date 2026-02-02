from pydantic import BaseModel
from typing import Optional


class SymbolOut(BaseModel):
    symbol: str
    display_name: str
    category: str
    emoji: str
    round_duration: int
    enabled: bool
    has_active_round: Optional[bool] = None
    coming_soon: Optional[bool] = None

    class Config:
        from_attributes = True


class CategoryCount(BaseModel):
    id: str
    name: str
    count: int


class SymbolListResponse(BaseModel):
    items: list[SymbolOut]
    categories: list[CategoryCount]
