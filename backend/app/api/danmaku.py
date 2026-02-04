from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime, timedelta
import hashlib

from app.db.database import get_db
from app.models import Round
from app.models.danmaku import Danmaku
from app.schemas.common import APIResponse
from app.schemas.danmaku import (
    DanmakuCreate,
    DanmakuOut,
    DanmakuListData,
    DanmakuPollData,
)

router = APIRouter()

# 频率限制配置（放宽以支持弹幕服务）
RATE_LIMIT_WINDOW = 10  # 10 秒窗口
RATE_LIMIT_MAX = 10  # 每窗口最多 10 条


def get_ip_hash(request: Request) -> str:
    """获取客户端 IP 的 hash（用于频率限制）"""
    client_ip = request.client.host if request.client else "unknown"
    # 也检查 X-Forwarded-For header（反向代理场景）
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    return hashlib.sha256(client_ip.encode()).hexdigest()[:32]


@router.post("", response_model=APIResponse)
async def send_danmaku(
    data: DanmakuCreate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    发送弹幕
    
    - 自动绑定到当前 symbol 的 active round
    - 有频率限制：每 10 秒最多 3 条
    - 内容限制 1-100 字符
    """
    # 获取当前活跃的 round
    round_result = await db.execute(
        select(Round)
        .where(Round.symbol == data.symbol, Round.status == "active")
        .order_by(Round.start_time.desc())
        .limit(1)
    )
    current_round = round_result.scalar_one_or_none()

    if not current_round:
        return APIResponse(
            success=False,
            error="NO_ACTIVE_ROUND",
            hint=f"No active round for {data.symbol}"
        )

    # 频率限制检查
    ip_hash = get_ip_hash(request)
    window_start = datetime.utcnow() - timedelta(seconds=RATE_LIMIT_WINDOW)
    
    rate_check = await db.execute(
        select(func.count(Danmaku.id))
        .where(
            Danmaku.ip_hash == ip_hash,
            Danmaku.created_at >= window_start
        )
    )
    recent_count = rate_check.scalar() or 0

    if recent_count >= RATE_LIMIT_MAX:
        return APIResponse(
            success=False,
            error="RATE_LIMITED",
            hint=f"Too many messages. Please wait a few seconds."
        )

    # 创建弹幕
    danmaku = Danmaku(
        round_id=current_round.id,
        symbol=data.symbol,
        nickname=data.nickname,
        content=data.content,
        color=data.color,
        ip_hash=ip_hash,
    )
    db.add(danmaku)
    await db.commit()
    await db.refresh(danmaku)

    return APIResponse(
        success=True,
        data=DanmakuOut(
            id=danmaku.id,
            round_id=danmaku.round_id,
            symbol=danmaku.symbol,
            user_id=danmaku.user_id,
            nickname=danmaku.nickname,
            content=danmaku.content,
            color=danmaku.color,
            created_at=danmaku.created_at,
        )
    )


@router.get("", response_model=APIResponse)
async def get_danmaku(
    symbol: str = Query(..., description="交易对符号"),
    limit: int = Query(50, ge=1, le=200, description="返回数量"),
    db: AsyncSession = Depends(get_db)
):
    """
    获取当前 round 的弹幕列表
    
    - 自动获取当前 active round 的弹幕
    - 按时间正序返回（最早的在前）
    """
    # 获取当前活跃的 round
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
            data=DanmakuListData(
                items=[],
                round_id=0,
                symbol=symbol,
                total=0,
                has_more=False,
            ),
            hint="No active round"
        )

    # 获取弹幕
    result = await db.execute(
        select(Danmaku)
        .where(Danmaku.round_id == current_round.id)
        .order_by(Danmaku.created_at.asc())
        .limit(limit)
    )
    items = result.scalars().all()

    # 获取总数
    count_result = await db.execute(
        select(func.count(Danmaku.id))
        .where(Danmaku.round_id == current_round.id)
    )
    total = count_result.scalar() or 0

    return APIResponse(
        success=True,
        data=DanmakuListData(
            items=[
                DanmakuOut(
                    id=d.id,
                    round_id=d.round_id,
                    symbol=d.symbol,
                    user_id=d.user_id,
                    nickname=d.nickname,
                    content=d.content,
                    color=d.color,
                    created_at=d.created_at,
                )
                for d in items
            ],
            round_id=current_round.id,
            symbol=symbol,
            total=total,
            has_more=total > limit,
        )
    )


@router.get("/poll", response_model=APIResponse)
async def poll_danmaku(
    symbol: str = Query(..., description="交易对符号"),
    after_id: int = Query(0, ge=0, description="上次获取的最后一条弹幕 ID"),
    limit: int = Query(20, ge=1, le=100, description="返回数量"),
    db: AsyncSession = Depends(get_db)
):
    """
    增量轮询弹幕
    
    - 传入 after_id 获取该 ID 之后的新弹幕
    - 用于前端轮询实现实时弹幕效果
    """
    # 获取当前活跃的 round
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
            data=DanmakuPollData(
                items=[],
                last_id=after_id,
                count=0,
            ),
            hint="No active round"
        )

    # 获取新弹幕
    query = (
        select(Danmaku)
        .where(
            Danmaku.round_id == current_round.id,
            Danmaku.id > after_id
        )
        .order_by(Danmaku.id.asc())
        .limit(limit)
    )
    result = await db.execute(query)
    items = result.scalars().all()

    last_id = items[-1].id if items else after_id

    return APIResponse(
        success=True,
        data=DanmakuPollData(
            items=[
                DanmakuOut(
                    id=d.id,
                    round_id=d.round_id,
                    symbol=d.symbol,
                    user_id=d.user_id,
                    nickname=d.nickname,
                    content=d.content,
                    color=d.color,
                    created_at=d.created_at,
                )
                for d in items
            ],
            last_id=last_id,
            count=len(items),
        )
    )
