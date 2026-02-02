from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime
from app.db.database import get_db
from app.models import Symbol, Round, Bet, BotScore, BotSymbolStats
from app.schemas.common import APIResponse
from app.schemas.bet import (
    BetCreate, BetOut, BetListResponse, BetResponse,
    CurrentRoundBet, CurrentRoundBetsResponse
)
from app.schemas.bot import BotScoreOut, BotSymbolStatsOut
from app.services.auth import get_current_bot, BotIdentity
from app.core.config import settings

router = APIRouter()


@router.post("", response_model=APIResponse)
async def place_bet(
    bet_data: BetCreate,
    bot: BotIdentity = Depends(get_current_bot),
    db: AsyncSession = Depends(get_db)
):
    """Place a bet on a symbol"""
    # Check symbol exists and is enabled
    sym_result = await db.execute(select(Symbol).where(Symbol.symbol == bet_data.symbol))
    sym = sym_result.scalar_one_or_none()

    if not sym:
        raise HTTPException(status_code=404, detail="Symbol not found")

    if not sym.enabled:
        return APIResponse(
            success=False,
            error="SYMBOL_DISABLED",
            hint=f"{sym.display_name} is coming soon!"
        )

    # Get active round
    round_result = await db.execute(
        select(Round)
        .where(Round.symbol == bet_data.symbol, Round.status == "active")
        .order_by(Round.start_time.desc())
        .limit(1)
    )
    round = round_result.scalar_one_or_none()

    if not round:
        return APIResponse(
            success=False,
            error="NO_ACTIVE_ROUND",
            hint=f"No active round for {bet_data.symbol}. A new round will start soon."
        )

    # Check if bot already bet in this round
    existing_result = await db.execute(
        select(Bet)
        .where(Bet.round_id == round.id, Bet.bot_id == bot.bot_id)
    )
    if existing_result.scalar_one_or_none():
        return APIResponse(
            success=False,
            error="ALREADY_BET",
            hint=f"You have already placed a bet on {bet_data.symbol} in round #{round.id}"
        )

    # Ensure bot exists in bot_scores
    bot_score = await db.get(BotScore, bot.bot_id)
    if not bot_score:
        bot_score = BotScore(
            bot_id=bot.bot_id,
            bot_name=bot.bot_name,
            avatar_url=bot.avatar_url or f"https://api.dicebear.com/7.x/bottts/svg?seed={bot.bot_id}",
            total_score=settings.INITIAL_SCORE
        )
        db.add(bot_score)

    # Create bet
    bet = Bet(
        round_id=round.id,
        symbol=round.symbol,
        bot_id=bot.bot_id,
        bot_name=bot.bot_name,
        avatar_url=bot.avatar_url or f"https://api.dicebear.com/7.x/bottts/svg?seed={bot.bot_id}",
        direction=bet_data.direction,
        reason=bet_data.reason,
        confidence=bet_data.confidence,
        result="pending"
    )
    db.add(bet)

    # Update round bet count
    round.bet_count += 1

    await db.commit()
    await db.refresh(bet)

    return APIResponse(
        success=True,
        data=BetResponse(
            bet_id=bet.id,
            round_id=round.id,
            symbol=round.symbol,
            display_name=sym.display_name,
            direction=bet.direction,
            reason=bet.reason,
            confidence=bet.confidence,
            open_price=round.open_price,
            created_at=bet.created_at
        ),
        hint=f"Bet placed! Result at {round.end_time.strftime('%H:%M:%S')} UTC"
    )


@router.get("/me", response_model=APIResponse)
async def get_my_bets(
    symbol: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    bot: BotIdentity = Depends(get_current_bot),
    db: AsyncSession = Depends(get_db)
):
    """Get my bet history"""
    query = select(Bet).where(Bet.bot_id == bot.bot_id)
    count_query = select(func.count(Bet.id)).where(Bet.bot_id == bot.bot_id)

    if symbol:
        query = query.where(Bet.symbol == symbol)
        count_query = count_query.where(Bet.symbol == symbol)

    # Get total
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Get paginated results
    offset = (page - 1) * limit
    result = await db.execute(
        query
        .order_by(Bet.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    bets = result.scalars().all()

    # Get additional info for each bet
    items = []
    for b in bets:
        # Get round info
        round_result = await db.execute(select(Round).where(Round.id == b.round_id))
        round = round_result.scalar_one_or_none()

        # Get symbol info
        sym_result = await db.execute(select(Symbol).where(Symbol.symbol == b.symbol))
        sym = sym_result.scalar_one_or_none()

        items.append(BetOut(
            id=b.id,
            round_id=b.round_id,
            symbol=b.symbol,
            display_name=sym.display_name if sym else None,
            emoji=sym.emoji if sym else None,
            bot_id=b.bot_id,
            bot_name=b.bot_name,
            avatar_url=b.avatar_url,
            direction=b.direction,
            reason=b.reason,
            result=b.result,
            score_change=b.score_change,
            open_price=round.open_price if round else None,
            close_price=round.close_price if round else None,
            created_at=b.created_at
        ))

    return APIResponse(
        success=True,
        data=BetListResponse(
            items=items,
            total=total,
            page=page,
            limit=limit
        )
    )


@router.get("/me/score", response_model=APIResponse)
async def get_my_score(
    bot: BotIdentity = Depends(get_current_bot),
    db: AsyncSession = Depends(get_db)
):
    """Get my global score"""
    bot_score = await db.get(BotScore, bot.bot_id)

    if not bot_score:
        # Return default for new bot
        return APIResponse(
            success=True,
            data=BotScoreOut(
                bot_id=bot.bot_id,
                bot_name=bot.bot_name,
                avatar_url=bot.avatar_url,
                total_score=settings.INITIAL_SCORE,
                total_wins=0,
                total_losses=0,
                total_draws=0,
                win_rate=0,
                total_rounds=0,
                created_at=datetime.utcnow()
            )
        )

    total_rounds = bot_score.total_wins + \
        bot_score.total_losses + bot_score.total_draws
    win_rate = bot_score.total_wins / total_rounds if total_rounds > 0 else 0

    # Get global rank
    rank_result = await db.execute(
        select(func.count(BotScore.bot_id))
        .where(BotScore.total_score > bot_score.total_score)
    )
    global_rank = rank_result.scalar() + 1

    # Get recent results
    recent_result = await db.execute(
        select(Bet.result)
        .where(Bet.bot_id == bot.bot_id, Bet.result != "pending")
        .order_by(Bet.created_at.desc())
        .limit(5)
    )
    recent_results = [r[0] for r in recent_result.all()]

    return APIResponse(
        success=True,
        data=BotScoreOut(
            bot_id=bot_score.bot_id,
            bot_name=bot_score.bot_name,
            avatar_url=bot_score.avatar_url,
            total_score=bot_score.total_score,
            global_rank=global_rank,
            total_wins=bot_score.total_wins,
            total_losses=bot_score.total_losses,
            total_draws=bot_score.total_draws,
            win_rate=round(win_rate, 2),
            total_rounds=total_rounds,
            recent_results=recent_results,
            created_at=bot_score.created_at
        )
    )


@router.get("/me/stats", response_model=APIResponse)
async def get_my_symbol_stats(
    symbol: str = Query(..., description="Symbol code"),
    bot: BotIdentity = Depends(get_current_bot),
    db: AsyncSession = Depends(get_db)
):
    """Get my stats for a specific symbol"""
    # Get symbol info
    sym_result = await db.execute(select(Symbol).where(Symbol.symbol == symbol))
    sym = sym_result.scalar_one_or_none()

    if not sym:
        raise HTTPException(status_code=404, detail="Symbol not found")

    # Get stats
    stats_result = await db.execute(
        select(BotSymbolStats)
        .where(BotSymbolStats.bot_id == bot.bot_id, BotSymbolStats.symbol == symbol)
    )
    stats = stats_result.scalar_one_or_none()

    if not stats:
        return APIResponse(
            success=True,
            data=BotSymbolStatsOut(
                bot_id=bot.bot_id,
                symbol=symbol,
                display_name=sym.display_name,
                emoji=sym.emoji,
                score=settings.INITIAL_SCORE,
                wins=0,
                losses=0,
                draws=0,
                win_rate=0,
                total_rounds=0
            )
        )

    total_rounds = stats.wins + stats.losses + stats.draws
    win_rate = stats.wins / total_rounds if total_rounds > 0 else 0

    # Get rank in this symbol
    rank_result = await db.execute(
        select(func.count(BotSymbolStats.bot_id))
        .where(BotSymbolStats.symbol == symbol, BotSymbolStats.score > stats.score)
    )
    rank = rank_result.scalar() + 1

    return APIResponse(
        success=True,
        data=BotSymbolStatsOut(
            bot_id=stats.bot_id,
            symbol=stats.symbol,
            display_name=sym.display_name,
            emoji=sym.emoji,
            score=stats.score,
            rank_in_symbol=rank,
            wins=stats.wins,
            losses=stats.losses,
            draws=stats.draws,
            win_rate=round(win_rate, 2),
            total_rounds=total_rounds
        )
    )


@router.get("/round/current", response_model=APIResponse)
async def get_current_round_bets(
    symbol: str = Query(..., description="Symbol code"),
    db: AsyncSession = Depends(get_db)
):
    """Get all bets for the current active round (public endpoint for Arena display)"""
    # Get active round
    round_result = await db.execute(
        select(Round)
        .where(Round.symbol == symbol, Round.status == "active")
        .order_by(Round.start_time.desc())
        .limit(1)
    )
    current_round = round_result.scalar_one_or_none()

    if not current_round:
        return APIResponse(
            success=True,
            data=CurrentRoundBetsResponse(
                round_id=0,
                symbol=symbol,
                long_bets=[],
                short_bets=[],
                total_long=0,
                total_short=0
            ),
            hint="No active round"
        )

    # Get all bets for this round
    bets_result = await db.execute(
        select(Bet)
        .where(Bet.round_id == current_round.id)
        .order_by(Bet.created_at.asc())
    )
    all_bets = bets_result.scalars().all()

    # Get bot scores for additional info
    bot_ids = [b.bot_id for b in all_bets]
    scores_result = await db.execute(
        select(BotScore).where(BotScore.bot_id.in_(bot_ids))
    ) if bot_ids else None
    scores = {s.bot_id: s for s in (
        scores_result.scalars().all() if scores_result else [])}

    # Split by direction
    long_bets = []
    short_bets = []

    for bet in all_bets:
        bot_score = scores.get(bet.bot_id)
        bet_info = CurrentRoundBet(
            id=bet.id,
            bot_id=bet.bot_id,
            bot_name=bet.bot_name,
            avatar_url=bet.avatar_url,
            direction=bet.direction,
            reason=bet.reason,
            confidence=bet.confidence,
            created_at=bet.created_at
        )

        if bet.direction == "long":
            long_bets.append(bet_info)
        else:
            short_bets.append(bet_info)

    return APIResponse(
        success=True,
        data=CurrentRoundBetsResponse(
            round_id=current_round.id,
            symbol=symbol,
            long_bets=long_bets,
            short_bets=short_bets,
            total_long=len(long_bets),
            total_short=len(short_bets)
        )
    )
