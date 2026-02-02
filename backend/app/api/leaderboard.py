from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime
from app.db.database import get_db
from app.models import Symbol, BotScore, BotSymbolStats
from app.schemas.common import APIResponse
from app.schemas.leaderboard import LeaderboardEntry, LeaderboardResponse

router = APIRouter()


@router.get("", response_model=APIResponse)
async def get_leaderboard(
    symbol: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get leaderboard (global or per-symbol)"""

    if symbol:
        # Per-symbol leaderboard
        sym_result = await db.execute(select(Symbol).where(Symbol.symbol == symbol))
        sym = sym_result.scalar_one_or_none()

        # Get top bots for this symbol
        result = await db.execute(
            select(BotSymbolStats, BotScore)
            .join(BotScore, BotSymbolStats.bot_id == BotScore.bot_id)
            .where(BotSymbolStats.symbol == symbol)
            .order_by(BotSymbolStats.score.desc())
            .limit(limit)
        )
        rows = result.all()

        items = []
        for i, (stats, bot_score) in enumerate(rows, 1):
            total_rounds = stats.wins + stats.losses + stats.draws
            win_rate = stats.wins / total_rounds if total_rounds > 0 else 0

            items.append(LeaderboardEntry(
                rank=i,
                bot_id=stats.bot_id,
                bot_name=bot_score.bot_name,
                avatar_url=bot_score.avatar_url,
                score=stats.score,
                wins=stats.wins,
                losses=stats.losses,
                draws=stats.draws,
                win_rate=round(win_rate, 2),
                total_rounds=total_rounds
            ))

        return APIResponse(
            success=True,
            data=LeaderboardResponse(
                type="symbol",
                symbol=symbol,
                display_name=sym.display_name if sym else symbol,
                emoji=sym.emoji if sym else "📈",
                items=items,
                updated_at=datetime.utcnow()
            )
        )
    else:
        # Global leaderboard
        result = await db.execute(
            select(BotScore)
            .order_by(BotScore.total_score.desc())
            .limit(limit)
        )
        bots = result.scalars().all()

        items = []
        for i, bot in enumerate(bots, 1):
            total_rounds = bot.total_wins + bot.total_losses + bot.total_draws
            win_rate = bot.total_wins / total_rounds if total_rounds > 0 else 0

            # Get favorite symbol (most played)
            fav_result = await db.execute(
                select(BotSymbolStats.symbol, func.count(
                    BotSymbolStats.symbol).label("count"))
                .where(BotSymbolStats.bot_id == bot.bot_id)
                .group_by(BotSymbolStats.symbol)
                .order_by(func.count(BotSymbolStats.symbol).desc())
                .limit(1)
            )
            fav_row = fav_result.first()
            favorite_symbol = fav_row[0] if fav_row else None

            items.append(LeaderboardEntry(
                rank=i,
                bot_id=bot.bot_id,
                bot_name=bot.bot_name,
                avatar_url=bot.avatar_url,
                score=bot.total_score,
                wins=bot.total_wins,
                losses=bot.total_losses,
                draws=bot.total_draws,
                win_rate=round(win_rate, 2),
                total_rounds=total_rounds,
                favorite_symbol=favorite_symbol
            ))

        return APIResponse(
            success=True,
            data=LeaderboardResponse(
                type="global",
                items=items,
                updated_at=datetime.utcnow()
            )
        )
