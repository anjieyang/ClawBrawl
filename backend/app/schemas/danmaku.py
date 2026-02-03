from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class DanmakuCreate(BaseModel):
    """发送弹幕请求"""
    symbol: str = Field(..., description="交易对符号，如 BTCUSDT")
    content: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="弹幕内容（1-100 字符）"
    )
    color: Optional[str] = Field(
        None,
        pattern=r"^#[0-9A-Fa-f]{6}$",
        description="颜色 hex 值，如 #FF5500"
    )
    nickname: Optional[str] = Field(
        None,
        max_length=50,
        description="显示昵称（可选）"
    )


class DanmakuOut(BaseModel):
    """弹幕响应"""
    id: int
    round_id: int
    symbol: str
    user_id: Optional[str] = None
    nickname: Optional[str] = None
    content: str
    color: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DanmakuResponse(BaseModel):
    """发送弹幕成功响应"""
    success: bool = True
    data: DanmakuOut


class DanmakuListResponse(BaseModel):
    """弹幕列表响应"""
    success: bool = True
    data: "DanmakuListData"


class DanmakuListData(BaseModel):
    """弹幕列表数据"""
    items: list[DanmakuOut]
    round_id: int
    symbol: str
    total: int
    has_more: bool


# 用于轮询的简化响应
class DanmakuPollResponse(BaseModel):
    """轮询弹幕响应（增量获取）"""
    success: bool = True
    data: "DanmakuPollData"


class DanmakuPollData(BaseModel):
    """轮询数据"""
    items: list[DanmakuOut]
    last_id: int  # 最后一条弹幕 ID，用于下次轮询
    count: int
