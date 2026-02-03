from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime
from app.db.database import get_db
from app.models import Symbol, BotScore, BotSymbolStats, Bet
from app.schemas.common import APIResponse
from app.schemas.leaderboard import LeaderboardEntry, LeaderboardResponse
from app.services.leaderboard_metrics import compute_metrics_from_bets

router = APIRouter()


def _tags_from_win_rate(win_rate: float) -> list[str]:
    if win_rate >= 0.7:
        return ["Alpha"]
    if 0 < win_rate <= 0.4:
        return ["Rekt"]
    return []


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

        items: list[LeaderboardEntry] = []
        bot_ids = [stats.bot_id for stats, _ in rows]

        # Fetch recent settled bets for these bots (per bot limit) to compute real metrics
        recent_bets: dict[str, list[tuple[Optional[int], str]]] = {bid: [] for bid in bot_ids}
        if bot_ids:
            rn = func.row_number().over(
                partition_by=Bet.bot_id, order_by=Bet.created_at.desc()
            ).label("rn")
            subq = (
                select(Bet.bot_id, Bet.score_change, Bet.result, rn)
                .where(Bet.symbol == symbol, Bet.bot_id.in_(bot_ids), Bet.result != "pending")
                .subquery()
            )
            bet_rows = await db.execute(
                select(subq.c.bot_id, subq.c.score_change, subq.c.result)
                .where(subq.c.rn <= 80)
                .order_by(subq.c.bot_id)
            )
            for bot_id, score_change, result_str in bet_rows.all():
                recent_bets[str(bot_id)].append((score_change, str(result_str)))

        for i, (stats, bot_score) in enumerate(rows, 1):
            total_rounds = stats.wins + stats.losses + stats.draws
            win_rate = stats.wins / total_rounds if total_rounds > 0 else 0

            metrics = compute_metrics_from_bets(
                current_score=int(stats.score),
                bets=recent_bets.get(stats.bot_id, []),
            )

            # Extract battle history (most recent first) - up to 80 results
            bot_bets = recent_bets.get(stats.bot_id, [])
            battle_history = [result for _, result in bot_bets[:80]]

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
                total_rounds=total_rounds,
                pnl=metrics.pnl,
                roi=metrics.roi,
                profit_factor=metrics.profit_factor,
                drawdown=metrics.drawdown,
                streak=metrics.streak,
                equity_curve=metrics.equity_curve,
                strategy=f"{symbol} Specialist",
                tags=_tags_from_win_rate(float(win_rate)),
                battle_history=battle_history,
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

        items: list[LeaderboardEntry] = []
        bot_ids = [b.bot_id for b in bots]

        recent_bets: dict[str, list[tuple[Optional[int], str]]] = {bid: [] for bid in bot_ids}
        if bot_ids:
            rn = func.row_number().over(
                partition_by=Bet.bot_id, order_by=Bet.created_at.desc()
            ).label("rn")
            subq = (
                select(Bet.bot_id, Bet.score_change, Bet.result, rn)
                .where(Bet.bot_id.in_(bot_ids), Bet.result != "pending")
                .subquery()
            )
            bet_rows = await db.execute(
                select(subq.c.bot_id, subq.c.score_change, subq.c.result)
                .where(subq.c.rn <= 80)
                .order_by(subq.c.bot_id)
            )
            for bot_id, score_change, result_str in bet_rows.all():
                recent_bets[str(bot_id)].append((score_change, str(result_str)))

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

            metrics = compute_metrics_from_bets(
                current_score=int(bot.total_score),
                bets=recent_bets.get(bot.bot_id, []),
            )

            # Extract battle history (most recent first) - up to 80 results
            bot_bets = recent_bets.get(bot.bot_id, [])
            battle_history = [result for _, result in bot_bets[:80]]

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
                favorite_symbol=favorite_symbol,
                pnl=metrics.pnl,
                roi=metrics.roi,
                profit_factor=metrics.profit_factor,
                drawdown=metrics.drawdown,
                streak=metrics.streak,
                equity_curve=metrics.equity_curve,
                strategy=f"{favorite_symbol} Specialist" if favorite_symbol else "Multi-Asset",
                tags=_tags_from_win_rate(float(win_rate)),
                battle_history=battle_history,
            ))

        return APIResponse(
            success=True,
            data=LeaderboardResponse(
                type="global",
                items=items,
                updated_at=datetime.utcnow()
            )
        )
