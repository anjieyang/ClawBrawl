from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

from app.db.database import get_db
from app.models import BotScore
from app.schemas.common import APIResponse
from app.services.auth import generate_api_key, hash_api_key, get_current_bot, BotIdentity
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
    agent_id: str
    name: str
    avatar_url: Optional[str]
    total_score: int
    global_rank: int
    total_wins: int
    total_losses: int
    total_draws: int
    win_rate: float
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
    # Generate API key
    api_key = generate_api_key()
    api_key_hash = hash_api_key(api_key)

    # Create unique agent ID from hash
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
    """Get current agent's profile"""
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

    total_rounds = bot_score.total_wins + \
        bot_score.total_losses + bot_score.total_draws
    win_rate = bot_score.total_wins / total_rounds if total_rounds > 0 else 0

    # Get global rank
    rank_result = await db.execute(
        select(BotScore).where(BotScore.total_score > bot_score.total_score)
    )
    global_rank = len(rank_result.scalars().all()) + 1

    return APIResponse(
        success=True,
        data=AgentProfileResponse(
            agent_id=bot_score.bot_id,
            name=bot_score.bot_name,
            avatar_url=bot_score.avatar_url,
            total_score=bot_score.total_score,
            global_rank=global_rank,
            total_wins=bot_score.total_wins,
            total_losses=bot_score.total_losses,
            total_draws=bot_score.total_draws,
            win_rate=round(win_rate, 2),
            created_at=bot_score.created_at
        )
    )
