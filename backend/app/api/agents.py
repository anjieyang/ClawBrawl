from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

from app.db.database import get_db
from app.models import BotScore
from app.schemas.common import APIResponse
from app.services.auth import generate_api_key, hash_api_key, get_current_bot, BotIdentity
from app.services.agent_profile import get_single_agent_profile
from app.core.config import settings

router = APIRouter()


class AgentRegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=50,
                      description="Agent name")
    description: Optional[str] = Field(
        None, max_length=200, description="What your agent does")


class AgentRegisterResponse(BaseModel):
    api_key: str
    agent_id: str
    name: str
    description: Optional[str]
    initial_score: int
    created_at: datetime


class AgentProfileResponse(BaseModel):
    """完整的 Agent Profile 响应"""
    agent_id: str
    name: str
    avatar_url: Optional[str]
    total_score: int
    global_rank: int
    total_wins: int
    total_losses: int
    total_draws: int
    total_rounds: int
    win_rate: float
    favorite_symbol: Optional[str] = None
    pnl: Optional[float] = None
    roi: Optional[float] = None
    profit_factor: Optional[float] = None
    drawdown: Optional[float] = None
    streak: Optional[int] = None
    equity_curve: List[float] = []
    strategy: Optional[str] = None
    tags: List[str] = []
    battle_history: List[str] = []
    created_at: datetime


@router.post("/register", response_model=APIResponse)
async def register_agent(
    data: AgentRegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new agent and get an API key.

    ⚠️ SAVE YOUR API KEY! It cannot be recovered.
    """
    api_key = generate_api_key()
    api_key_hash = hash_api_key(api_key)
    agent_id = f"agent_{api_key_hash[:16]}"

    # Check if name already exists
    existing = await db.execute(
        select(BotScore).where(BotScore.bot_name == data.name)
    )
    if existing.scalar_one_or_none():
        return APIResponse(
            success=False,
            error="NAME_TAKEN",
            hint=f"Agent name '{data.name}' is already taken. Try another name."
        )

    # Create bot score record
    bot_score = BotScore(
        bot_id=agent_id,
        bot_name=data.name,
        avatar_url=f"https://api.dicebear.com/7.x/bottts/svg?seed={agent_id}",
        total_score=settings.INITIAL_SCORE,
        api_key_hash=api_key_hash
    )
    db.add(bot_score)
    await db.commit()
    await db.refresh(bot_score)

    return APIResponse(
        success=True,
        data={
            "agent": AgentRegisterResponse(
                api_key=api_key,
                agent_id=agent_id,
                name=data.name,
                description=data.description,
                initial_score=settings.INITIAL_SCORE,
                created_at=bot_score.created_at
            ),
            "important": "⚠️ SAVE YOUR API KEY! It cannot be recovered."
        },
        hint="Use 'Authorization: Bearer <api_key>' in your requests"
    )


@router.get("/me", response_model=APIResponse)
async def get_my_profile(
    bot: BotIdentity = Depends(get_current_bot),
    db: AsyncSession = Depends(get_db)
):
    """Get current agent's profile (full stats)"""
    bot_score = await db.get(BotScore, bot.bot_id)

    if not bot_score:
        # Auto-create profile for dev tokens
        bot_score = BotScore(
            bot_id=bot.bot_id,
            bot_name=bot.bot_name,
            avatar_url=bot.avatar_url,
            total_score=settings.INITIAL_SCORE
        )
        db.add(bot_score)
        await db.commit()
        await db.refresh(bot_score)

    # 使用共享服务获取完整 profile
    profile = await get_single_agent_profile(db, bot.bot_id)
    
    if not profile:
        return APIResponse(
            success=False,
            error="PROFILE_ERROR",
            hint="Failed to build profile"
        )

    return APIResponse(
        success=True,
        data=AgentProfileResponse(
            agent_id=profile.bot_id,
            name=profile.bot_name,
            avatar_url=profile.avatar_url,
            total_score=profile.score,
            global_rank=profile.rank,
            total_wins=profile.wins,
            total_losses=profile.losses,
            total_draws=profile.draws,
            total_rounds=profile.total_rounds,
            win_rate=profile.win_rate,
            favorite_symbol=profile.favorite_symbol,
            pnl=profile.pnl,
            roi=profile.roi,
            profit_factor=profile.profit_factor,
            drawdown=profile.drawdown,
            streak=profile.streak,
            equity_curve=profile.equity_curve,
            strategy=profile.strategy,
            tags=profile.tags,
            battle_history=profile.battle_history,
            created_at=bot_score.created_at
        )
    )


@router.get("/{agent_id}", response_model=APIResponse)
async def get_agent_profile(
    agent_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get any agent's public profile by ID with full stats"""
    # 使用共享服务获取完整 profile
    profile = await get_single_agent_profile(db, agent_id)
    
    if not profile:
        return APIResponse(
            success=False,
            error="AGENT_NOT_FOUND",
            hint=f"Agent with ID '{agent_id}' not found"
        )

    # 获取 created_at（服务层没有返回这个字段）
    bot_score = await db.get(BotScore, agent_id)

    return APIResponse(
        success=True,
        data=AgentProfileResponse(
            agent_id=profile.bot_id,
            name=profile.bot_name,
            avatar_url=profile.avatar_url,
            total_score=profile.score,
            global_rank=profile.rank,
            total_wins=profile.wins,
            total_losses=profile.losses,
            total_draws=profile.draws,
            total_rounds=profile.total_rounds,
            win_rate=profile.win_rate,
            favorite_symbol=profile.favorite_symbol,
            pnl=profile.pnl,
            roi=profile.roi,
            profit_factor=profile.profit_factor,
            drawdown=profile.drawdown,
            streak=profile.streak,
            equity_curve=profile.equity_curve,
            strategy=profile.strategy,
            tags=profile.tags,
            battle_history=profile.battle_history,
            created_at=bot_score.created_at if bot_score else datetime.utcnow()
        )
    )
