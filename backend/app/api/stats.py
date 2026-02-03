from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import logging

from app.db.database import get_db
from app.models import Symbol, Round, Bet, BotScore
from app.schemas.common import APIResponse
from app.services.keywords import get_keyword_extractor

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("", response_model=APIResponse)
async def get_stats(
    symbol: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get arena statistics"""

    if symbol:
        # Per-symbol stats
        # Total rounds for this symbol
        rounds_result = await db.execute(
            select(func.count(Round.id)).where(Round.symbol == symbol)
        )
        total_rounds = rounds_result.scalar() or 0

        # Total bets for this symbol
        bets_result = await db.execute(
            select(func.count(Bet.id)).where(Bet.symbol == symbol)
        )
        total_bets = bets_result.scalar() or 0

        # Result distribution
        up_result = await db.execute(
            select(func.count(Round.id)).where(
                Round.symbol == symbol, Round.result == "up")
        )
        up_rounds = up_result.scalar() or 0

        down_result = await db.execute(
            select(func.count(Round.id)).where(
                Round.symbol == symbol, Round.result == "down")
        )
        down_rounds = down_result.scalar() or 0

        draw_result = await db.execute(
            select(func.count(Round.id)).where(
                Round.symbol == symbol, Round.result == "draw")
        )
        draw_rounds = draw_result.scalar() or 0

        # Get symbol info
        sym_result = await db.execute(select(Symbol).where(Symbol.symbol == symbol))
        sym = sym_result.scalar_one_or_none()

        return APIResponse(
            success=True,
            data={
                "symbol": symbol,
                "display_name": sym.display_name if sym else symbol,
                "total_rounds": total_rounds,
                "total_bets": total_bets,
                "up_rounds": up_rounds,
                "down_rounds": down_rounds,
                "draw_rounds": draw_rounds,
            }
        )
    else:
        # Global stats
        # Total rounds
        rounds_result = await db.execute(select(func.count(Round.id)))
        total_rounds = rounds_result.scalar() or 0

        # Total bets
        bets_result = await db.execute(select(func.count(Bet.id)))
        total_bets = bets_result.scalar() or 0

        # Total bots
        bots_result = await db.execute(select(func.count(BotScore.bot_id)))
        total_bots = bots_result.scalar() or 0

        # Active symbols
        active_result = await db.execute(
            select(func.count(Symbol.symbol)).where(Symbol.enabled == True)
        )
        active_symbols = active_result.scalar() or 0

        return APIResponse(
            success=True,
            data={
                "total_rounds": total_rounds,
                "total_bets": total_bets,
                "total_bots": total_bots,
                "active_symbols": active_symbols,
            }
        )


class KeywordsRequest(BaseModel):
    """Request body for keyword extraction"""

    reasons: list[str]
    direction: str  # "long" or "short"
    max_keywords: int = 5


@router.post("/keywords", response_model=APIResponse)
async def extract_keywords(request: KeywordsRequest):
    """
    Extract key themes from agent analysis reasons using GPT-5-nano.

    This endpoint analyzes a list of trading analysis reasons and extracts
    the most relevant keywords/themes using AI.
    """
    try:
        extractor = get_keyword_extractor()
        keywords = await extractor.extract_keywords(
            reasons=request.reasons,
            direction=request.direction,
            max_keywords=request.max_keywords,
        )
        return APIResponse(success=True, data={"keywords": keywords})
    except ValueError as e:
        # API key not configured
        logger.warning(f"Keyword extraction unavailable: {e}")
        return APIResponse(
            success=False,
            data=None,
            error="KEYWORDS_UNAVAILABLE",
            hint="Keyword extraction service is not configured",
        )
    except Exception as e:
        logger.error(f"Keyword extraction error: {e}")
        return APIResponse(
            success=False,
            data=None,
            error="EXTRACTION_FAILED",
            hint=str(e),
        )
