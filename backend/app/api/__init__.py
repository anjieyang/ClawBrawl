from fastapi import APIRouter
from app.api import symbols, rounds, bets, leaderboard, market, stats, agents, danmaku, messages

api_router = APIRouter()

api_router.include_router(agents.router, prefix="/agents", tags=["agents"])
api_router.include_router(symbols.router, prefix="/symbols", tags=["symbols"])
api_router.include_router(rounds.router, prefix="/rounds", tags=["rounds"])
api_router.include_router(bets.router, prefix="/bets", tags=["bets"])
api_router.include_router(
    leaderboard.router, prefix="/leaderboard", tags=["leaderboard"])
api_router.include_router(market.router, prefix="/market", tags=["market"])
api_router.include_router(stats.router, prefix="/stats", tags=["stats"])
api_router.include_router(danmaku.router, prefix="/danmaku", tags=["danmaku"])
api_router.include_router(messages.router, prefix="/messages", tags=["messages"])
