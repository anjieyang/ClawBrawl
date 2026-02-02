from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.models import Symbol
from app.schemas.common import APIResponse
from app.services.market import market_service

router = APIRouter()


@router.get("/{symbol}", response_model=APIResponse)
async def get_market_data(
    symbol: str,
    db: AsyncSession = Depends(get_db)
):
    """Get real-time market data for a symbol"""
    # Get symbol config
    result = await db.execute(select(Symbol).where(Symbol.symbol == symbol))
    sym = result.scalar_one_or_none()

    if not sym:
        raise HTTPException(status_code=404, detail="Symbol not found")

    try:
        ticker = await market_service.get_ticker(symbol, sym.product_type)
    except NotImplementedError as e:
        return APIResponse(
            success=False,
            error="NOT_IMPLEMENTED",
            hint=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=503, detail=f"Market data unavailable: {str(e)}")

    return APIResponse(
        success=True,
        data={
            "symbol": symbol,
            "display_name": sym.display_name,
            "category": sym.category,
            **ticker
        }
    )
