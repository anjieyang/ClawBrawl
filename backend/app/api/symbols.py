from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.db.database import get_db
from app.models import Symbol, Round
from app.schemas.common import APIResponse
from app.schemas.symbol import SymbolOut, SymbolListResponse, CategoryCount

router = APIRouter()

CATEGORY_NAMES = {
    "crypto": "Crypto",
    "metal": "Commodities",
    "stock": "Stocks",
    "forex": "Forex",
    "index": "Indices"
}


@router.get("", response_model=APIResponse)
async def get_symbols(
    category: Optional[str] = None,
    enabled: Optional[bool] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get all available symbols"""
    query = select(Symbol)

    if category:
        query = query.where(Symbol.category == category)
    if enabled is not None:
        query = query.where(Symbol.enabled == enabled)

    result = await db.execute(query.order_by(Symbol.enabled.desc(), Symbol.symbol))
    symbols = result.scalars().all()

    # Check active rounds for each symbol
    items = []
    for sym in symbols:
        # Check if there's an active round
        round_result = await db.execute(
            select(Round)
            .where(Round.symbol == sym.symbol, Round.status == "active")
            .limit(1)
        )
        has_active = round_result.scalar_one_or_none() is not None

        items.append(SymbolOut(
            symbol=sym.symbol,
            display_name=sym.display_name,
            category=sym.category,
            emoji=sym.emoji,
            round_duration=sym.round_duration,
            enabled=sym.enabled,
            has_active_round=has_active if sym.enabled else None,
            coming_soon=not sym.enabled
        ))

    # Get category counts
    category_result = await db.execute(
        select(Symbol.category, func.count(Symbol.symbol))
        .group_by(Symbol.category)
    )
    categories = [
        CategoryCount(
            id=row[0],
            name=CATEGORY_NAMES.get(row[0], row[0].title()),
            count=row[1]
        )
        for row in category_result.all()
    ]

    return APIResponse(
        success=True,
        data=SymbolListResponse(items=items, categories=categories)
    )


@router.get("/{symbol}", response_model=APIResponse)
async def get_symbol(
    symbol: str,
    db: AsyncSession = Depends(get_db)
):
    """Get symbol details"""
    result = await db.execute(select(Symbol).where(Symbol.symbol == symbol))
    sym = result.scalar_one_or_none()

    if not sym:
        raise HTTPException(status_code=404, detail="Symbol not found")

    return APIResponse(
        success=True,
        data=SymbolOut(
            symbol=sym.symbol,
            display_name=sym.display_name,
            category=sym.category,
            emoji=sym.emoji,
            round_duration=sym.round_duration,
            enabled=sym.enabled,
            coming_soon=not sym.enabled
        )
    )
