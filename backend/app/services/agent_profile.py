"""
Agent Profile Service - 统一的 Agent 数据构建逻辑
避免 agents.py 和 leaderboard.py 之间的代码重复
"""
from dataclasses import dataclass
from typing import Optional, List, Dict
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import BotScore, BotSymbolStats, Bet
from app.services.leaderboard_metrics import compute_metrics_from_bets, LeaderboardMetrics
from app.services.tags import compute_tags, AgentStats


@dataclass
class AgentProfile:
    """统一的 Agent Profile 数据结构"""
    bot_id: str
    bot_name: str
    avatar_url: Optional[str]
    score: int
    rank: int
    wins: int
    losses: int
    draws: int
    total_rounds: int
    win_rate: float
    favorite_symbol: Optional[str]
    pnl: Optional[float]
    roi: Optional[float]
    profit_factor: Optional[float]
    drawdown: Optional[float]
    streak: Optional[int]
    equity_curve: List[float]
    strategy: Optional[str]
    tags: List[str]
    battle_history: List[str]


async def fetch_recent_bets_for_bots(
    db: AsyncSession,
    bot_ids: List[str],
    symbol: Optional[str] = None,
    limit: int = 80
) -> Dict[str, List[tuple]]:
    """
    批量获取多个 bot 的最近 bets
    返回 {bot_id: [(score_change, result), ...]}
    """
    if not bot_ids:
        return {}
    
    recent_bets: Dict[str, List[tuple]] = {bid: [] for bid in bot_ids}
    
    rn = func.row_number().over(
        partition_by=Bet.bot_id, order_by=Bet.created_at.desc()
    ).label("rn")
    
    conditions = [Bet.bot_id.in_(bot_ids), Bet.result != "pending"]
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


async def fetch_favorite_symbols(
    db: AsyncSession,
    bot_ids: List[str]
) -> Dict[str, Optional[str]]:
    """批量获取多个 bot 的最常交易 symbol"""
    if not bot_ids:
        return {}
    
    result: Dict[str, Optional[str]] = {bid: None for bid in bot_ids}
    
    # 子查询：每个 bot 按 symbol 分组计数，取最大的
    for bot_id in bot_ids:
        fav_result = await db.execute(
            select(BotSymbolStats.symbol)
            .where(BotSymbolStats.bot_id == bot_id)
            .order_by(BotSymbolStats.score.desc())
            .limit(1)
        )
        fav_row = fav_result.first()
        if fav_row:
            result[bot_id] = fav_row[0]
    
    return result


def build_agent_profile(
    bot_id: str,
    bot_name: str,
    avatar_url: Optional[str],
    score: int,
    rank: int,
    wins: int,
    losses: int,
    draws: int,
    recent_bets: List[tuple],
    favorite_symbol: Optional[str] = None,
) -> AgentProfile:
    """
    从原始数据构建完整的 AgentProfile
    这是核心的可复用逻辑
    """
    total_rounds = wins + losses + draws
    win_rate = wins / total_rounds if total_rounds > 0 else 0
    
    # 计算 metrics
    metrics = compute_metrics_from_bets(
        current_score=score,
        bets=recent_bets,
    )
    
    # 提取 battle history
    battle_history = [result for _, result in recent_bets[:80]]
    
    # 计算 tags
    agent_stats = AgentStats(
        rank=rank,
        score=score,
        win_rate=win_rate,
        wins=wins,
        losses=losses,
        draws=draws,
        total_rounds=total_rounds,
        streak=metrics.streak,
        drawdown=metrics.drawdown,
    )
    tags = compute_tags(agent_stats)
    
    # 构建 strategy 字符串
    strategy = f"{favorite_symbol} Specialist" if favorite_symbol else "Multi-Asset"
    
    return AgentProfile(
        bot_id=bot_id,
        bot_name=bot_name,
        avatar_url=avatar_url,
        score=score,
        rank=rank,
        wins=wins,
        losses=losses,
        draws=draws,
        total_rounds=total_rounds,
        win_rate=round(win_rate, 2),
        favorite_symbol=favorite_symbol,
        pnl=metrics.pnl,
        roi=metrics.roi,
        profit_factor=metrics.profit_factor,
        drawdown=metrics.drawdown,
        streak=metrics.streak,
        equity_curve=metrics.equity_curve,
        strategy=strategy,
        tags=tags,
        battle_history=battle_history,
    )


async def get_single_agent_profile(
    db: AsyncSession,
    agent_id: str
) -> Optional[AgentProfile]:
    """
    获取单个 agent 的完整 profile
    供 /agents/{agent_id} API 使用
    """
    bot_score = await db.get(BotScore, agent_id)
    if not bot_score:
        return None
    
    # 获取全局排名
    rank_result = await db.execute(
        select(func.count(BotScore.bot_id))
        .where(BotScore.total_score > bot_score.total_score)
    )
    global_rank = (rank_result.scalar() or 0) + 1
    
    # 获取 recent bets
    recent_bets_map = await fetch_recent_bets_for_bots(db, [agent_id])
    recent_bets = recent_bets_map.get(agent_id, [])
    
    # 获取 favorite symbol
    fav_symbols = await fetch_favorite_symbols(db, [agent_id])
    favorite_symbol = fav_symbols.get(agent_id)
    
    return build_agent_profile(
        bot_id=bot_score.bot_id,
        bot_name=bot_score.bot_name,
        avatar_url=bot_score.avatar_url,
        score=int(bot_score.total_score),
        rank=global_rank,
        wins=bot_score.total_wins,
        losses=bot_score.total_losses,
        draws=bot_score.total_draws,
        recent_bets=recent_bets,
        favorite_symbol=favorite_symbol,
    )
