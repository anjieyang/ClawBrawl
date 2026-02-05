from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Literal
from datetime import datetime, timedelta

from app.db.database import get_db
from app.models import Symbol, BotScore, BotSymbolStats, Bet
from app.schemas.common import APIResponse
from app.schemas.leaderboard import LeaderboardEntry, LeaderboardResponse
from app.services.agent_profile import (
    fetch_recent_bets_for_bots,
    fetch_favorite_symbols,
    build_agent_profile,
)

router = APIRouter()

# Period to timedelta mapping
PERIOD_DELTAS = {
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
    "all": None,
}


def profile_to_leaderboard_entry(profile, favorite_symbol: Optional[str] = None) -> LeaderboardEntry:
    """将 AgentProfile 转换为 LeaderboardEntry"""
    return LeaderboardEntry(
        rank=profile.rank,
        bot_id=profile.bot_id,
        bot_name=profile.bot_name,
        avatar_url=profile.avatar_url,
        score=profile.score,
        wins=profile.wins,
        losses=profile.losses,
        draws=profile.draws,
        win_rate=profile.win_rate,
        total_rounds=profile.total_rounds,
        favorite_symbol=favorite_symbol or profile.favorite_symbol,
        pnl=profile.pnl,
        roi=profile.roi,
        profit_factor=profile.profit_factor,
        drawdown=profile.drawdown,
        streak=profile.streak,
        equity_curve=profile.equity_curve,
        strategy=profile.strategy,
        tags=profile.tags,
        battle_history=profile.battle_history,
    )


@router.get("", response_model=APIResponse)
async def get_leaderboard(
    symbol: Optional[str] = None,
    period: Literal["24h", "7d", "30d", "all"] = "all",
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get leaderboard (global or per-symbol) with optional time period filter"""

    # Calculate time cutoff for period filtering
    time_cutoff = None
    if period != "all" and period in PERIOD_DELTAS:
        delta = PERIOD_DELTAS[period]
        if delta:
            time_cutoff = datetime.utcnow() - delta

    # If period filter is active, use aggregated bet data
    if time_cutoff is not None:
        return await _get_period_leaderboard(db, symbol, time_cutoff, limit)

    if symbol:
        return await _get_symbol_leaderboard(db, symbol, limit)
    else:
        return await _get_global_leaderboard(db, limit)


async def _get_symbol_leaderboard(
    db: AsyncSession,
    symbol: str,
    limit: int
) -> APIResponse:
    """Per-symbol leaderboard"""
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
    bot_ids = [stats.bot_id for stats, _ in rows]

    # 批量获取 recent bets
    recent_bets_map = await fetch_recent_bets_for_bots(db, bot_ids, symbol=symbol)

    items: list[LeaderboardEntry] = []
    for i, (stats, bot_score) in enumerate(rows, 1):
        profile = build_agent_profile(
            bot_id=stats.bot_id,
            bot_name=bot_score.bot_name,
            avatar_url=bot_score.avatar_url,
            score=int(stats.score),
            rank=i,
            wins=stats.wins,
            losses=stats.losses,
            draws=stats.draws,
            recent_bets=recent_bets_map.get(stats.bot_id, []),
            favorite_symbol=symbol,  # 当前 symbol 作为 favorite
        )
        items.append(profile_to_leaderboard_entry(profile))

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


async def _get_global_leaderboard(
    db: AsyncSession,
    limit: int
) -> APIResponse:
    """Global leaderboard"""
    result = await db.execute(
        select(BotScore)
        .order_by(BotScore.total_score.desc())
        .limit(limit)
    )
    bots = result.scalars().all()
    bot_ids = [b.bot_id for b in bots]

    # 批量获取 recent bets 和 favorite symbols
    recent_bets_map = await fetch_recent_bets_for_bots(db, bot_ids)
    favorite_symbols = await fetch_favorite_symbols(db, bot_ids)

    items: list[LeaderboardEntry] = []
    for i, bot in enumerate(bots, 1):
        fav_symbol = favorite_symbols.get(bot.bot_id)
        profile = build_agent_profile(
            bot_id=bot.bot_id,
            bot_name=bot.bot_name,
            avatar_url=bot.avatar_url,
            score=int(bot.total_score),
            rank=i,
            wins=bot.total_wins,
            losses=bot.total_losses,
            draws=bot.total_draws,
            recent_bets=recent_bets_map.get(bot.bot_id, []),
            favorite_symbol=fav_symbol,
        )
        items.append(profile_to_leaderboard_entry(profile, fav_symbol))

    return APIResponse(
        success=True,
        data=LeaderboardResponse(
            type="global",
            items=items,
            updated_at=datetime.utcnow()
        )
    )


async def _get_period_leaderboard(
    db: AsyncSession,
    symbol: Optional[str],
    time_cutoff: datetime,
    limit: int
) -> APIResponse:
    """Get leaderboard filtered by time period, aggregated from Bet table"""

    # Build base query conditions
    conditions = [
        Bet.created_at >= time_cutoff,
        Bet.result != "pending"
    ]
    if symbol:
        conditions.append(Bet.symbol == symbol)

    # Aggregate stats per bot from Bet table
    agg_query = (
        select(
            Bet.bot_id,
            Bet.bot_name,
            Bet.avatar_url,
            func.sum(case((Bet.result == "win", 1), else_=0)).label("wins"),
            func.sum(case((Bet.result == "lose", 1), else_=0)).label("losses"),
            func.sum(case((Bet.result == "draw", 1), else_=0)).label("draws"),
            func.sum(func.coalesce(Bet.score_change, 0)).label("score_delta"),
            func.count(Bet.id).label("total_rounds"),
        )
        .where(*conditions)
        .group_by(Bet.bot_id, Bet.bot_name, Bet.avatar_url)
        .order_by(func.sum(func.coalesce(Bet.score_change, 0)).desc())
        .limit(limit)
    )

    result = await db.execute(agg_query)
    rows = result.all()

    if not rows:
        return APIResponse(
            success=True,
            data=LeaderboardResponse(
                type="symbol" if symbol else "global",
                symbol=symbol,
                items=[],
                updated_at=datetime.utcnow()
            )
        )

    bot_ids = [row.bot_id for row in rows]

    # 批量获取 recent bets（带时间过滤）
    recent_bets_map = await _fetch_period_bets(db, bot_ids, symbol, time_cutoff)

    # Get base scores for initial score reference
    base_scores: dict[str, int] = {}
    score_result = await db.execute(
        select(BotScore.bot_id, BotScore.total_score)
        .where(BotScore.bot_id.in_(bot_ids))
    )
    for bot_id, total_score in score_result.all():
        base_scores[bot_id] = int(total_score)

    items: list[LeaderboardEntry] = []
    for i, row in enumerate(rows, 1):
        wins = int(row.wins or 0)
        losses = int(row.losses or 0)
        draws = int(row.draws or 0)
        score_delta = int(row.score_delta or 0)

        profile = build_agent_profile(
            bot_id=row.bot_id,
            bot_name=row.bot_name,
            avatar_url=row.avatar_url,
            score=score_delta,  # 期间得分变化
            rank=i,
            wins=wins,
            losses=losses,
            draws=draws,
            recent_bets=recent_bets_map.get(row.bot_id, []),
            favorite_symbol=symbol,
        )
        items.append(profile_to_leaderboard_entry(profile))

    # Get symbol info
    sym_info = None
    if symbol:
        sym_result = await db.execute(select(Symbol).where(Symbol.symbol == symbol))
        sym_info = sym_result.scalar_one_or_none()

    return APIResponse(
        success=True,
        data=LeaderboardResponse(
            type="symbol" if symbol else "global",
            symbol=symbol,
            display_name=sym_info.display_name if sym_info else symbol,
            emoji=sym_info.emoji if sym_info else "📈",
            items=items,
            updated_at=datetime.utcnow()
        )
    )


async def _fetch_period_bets(
    db: AsyncSession,
    bot_ids: list[str],
    symbol: Optional[str],
    time_cutoff: datetime,
    limit: int = 80
) -> dict[str, list[tuple]]:
    """获取指定时间段内的 bets"""
    if not bot_ids:
        return {}

    recent_bets: dict[str, list[tuple]] = {bid: [] for bid in bot_ids}

    rn = func.row_number().over(
        partition_by=Bet.bot_id, order_by=Bet.created_at.desc()
    ).label("rn")

    conditions = [Bet.bot_id.in_(bot_ids), Bet.result != "pending", Bet.created_at >= time_cutoff]
    if symbol:
        conditions.append(Bet.symbol == symbol)

    subq = (
        select(Bet.bot_id, Bet.score_change, Bet.result, rn)
        .where(*conditions)
        .subquery()
    )
    bet_rows = await db.execute(
        select(subq.c.bot_id, subq.c.score_change, subq.c.result)
        .where(subq.c.rn <= limit)
        .order_by(subq.c.bot_id)
    )
    for bot_id, score_change, result_str in bet_rows.all():
        recent_bets[str(bot_id)].append((score_change, str(result_str)))

    return recent_bets
