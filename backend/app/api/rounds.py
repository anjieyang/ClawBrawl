from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime
from app.db.database import get_db
from app.models import Symbol, Round
from app.schemas.common import APIResponse
from app.schemas.round import RoundOut, RoundListResponse, CurrentRoundResponse
from app.services.market import market_service

router = APIRouter()


@router.get("/current", response_model=APIResponse)
async def get_current_round(
    symbol: str = Query(..., description="Symbol code"),
    db: AsyncSession = Depends(get_db)
):
    """Get current active round for a symbol"""
    # Check symbol exists and is enabled
    sym_result = await db.execute(select(Symbol).where(Symbol.symbol == symbol))
    sym = sym_result.scalar_one_or_none()

    if not sym:
        raise HTTPException(status_code=404, detail="Symbol not found")

    if not sym.enabled:
        return APIResponse(
            success=True,
            data=None,
            hint=f"{sym.display_name} is coming soon!"
        )

    # Get active round
    result = await db.execute(
        select(Round)
        .where(Round.symbol == symbol, Round.status == "active")
        .order_by(Round.start_time.desc())
        .limit(1)
    )
    current_round = result.scalar_one_or_none()

    if not current_round:
        return APIResponse(
            success=True,
            data=None,
            hint=f"No active round for {symbol}. A new round will start soon."
        )

    # Get current price
    try:
        current_price = await market_service.get_price_by_source(
            sym.symbol, sym.api_source, sym.product_type
        )
    except Exception:
        current_price = current_round.open_price

    # Calculate remaining time and price change
    now = datetime.utcnow()
    remaining = max(0, int((current_round.end_time - now).total_seconds()))
    price_change = ((current_price - current_round.open_price) /
                    current_round.open_price) * 100 if current_round.open_price else 0

    return APIResponse(
        success=True,
        data=CurrentRoundResponse(
            id=current_round.id,
            symbol=current_round.symbol,
            display_name=sym.display_name,
            category=sym.category,
            emoji=sym.emoji,
            start_time=current_round.start_time,
            end_time=current_round.end_time,
            open_price=current_round.open_price,
            status=current_round.status,
            remaining_seconds=remaining,
            bet_count=current_round.bet_count,
            current_price=current_price,
            price_change_percent=round(price_change, 4)
        )
    )


@router.get("/history", response_model=APIResponse)
async def get_round_history(
    symbol: Optional[str] = None,
    category: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get historical rounds"""
    query = select(Round).where(Round.status == "settled")
    count_query = select(func.count(Round.id)).where(Round.status == "settled")

    if symbol:
        query = query.where(Round.symbol == symbol)
        count_query = count_query.where(Round.symbol == symbol)

    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Get paginated results
    offset = (page - 1) * limit
    result = await db.execute(
        query
        .order_by(Round.end_time.desc())
        .offset(offset)
        .limit(limit)
    )
    rounds = result.scalars().all()

    # Get symbol info for each round
    items = []
    for r in rounds:
        sym_result = await db.execute(select(Symbol).where(Symbol.symbol == r.symbol))
        sym = sym_result.scalar_one_or_none()

        price_change_percent = (r.price_change * 100) if r.price_change else 0

        items.append(RoundOut(
            id=r.id,
            symbol=r.symbol,
            display_name=sym.display_name if sym else None,
            emoji=sym.emoji if sym else None,
            start_time=r.start_time,
            end_time=r.end_time,
            open_price=r.open_price,
            close_price=r.close_price,
            status=r.status,
            result=r.result,
            price_change_percent=round(price_change_percent, 4),
            bet_count=r.bet_count
        ))

    return APIResponse(
        success=True,
        data=RoundListResponse(
            items=items,
            total=total,
            page=page,
            limit=limit,
            total_pages=(total + limit - 1) // limit
        )
    )


@router.get("/{round_id}", response_model=APIResponse)
async def get_round_detail(
    round_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get round details"""
    result = await db.execute(select(Round).where(Round.id == round_id))
    round_data = result.scalar_one_or_none()

    if not round_data:
        raise HTTPException(status_code=404, detail="Round not found")

    sym_result = await db.execute(select(Symbol).where(Symbol.symbol == round_data.symbol))
    sym = sym_result.scalar_one_or_none()

    price_change_percent = (round_data.price_change *
                            100) if round_data.price_change else None

    return APIResponse(
        success=True,
        data=RoundOut(
            id=round_data.id,
            symbol=round_data.symbol,
            display_name=sym.display_name if sym else None,
            emoji=sym.emoji if sym else None,
            start_time=round_data.start_time,
            end_time=round_data.end_time,
            open_price=round_data.open_price,
            close_price=round_data.close_price,
            status=round_data.status,
            result=round_data.result,
            price_change_percent=round(
                price_change_percent, 4) if price_change_percent else None,
            bet_count=round_data.bet_count
        )
    )
