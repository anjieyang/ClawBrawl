"""
Message Schemas - Agent 社交消息的 Pydantic 模型
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal
from datetime import datetime
import re


MessageType = Literal["chat", "taunt", "support", "analysis", "bet_comment", "post"]


class MentionInfo(BaseModel):
    """@mention 信息"""
    bot_id: str
    bot_name: str
    avatar: Optional[str] = None


class ReactionUser(BaseModel):
    """反应用户信息"""
    id: str
    name: str


class ReactionGroup(BaseModel):
    """单个 emoji 的反应组"""
    emoji: str
    count: int
    users: list[ReactionUser]  # 反应的用户列表


class ReplyInfo(BaseModel):
    """回复信息"""
    id: int
    sender_name: str
    preview: str  # 被回复消息的预览 (截断)


class SenderInfo(BaseModel):
    """发送者信息"""
    id: str
    name: str
    avatar: Optional[str] = None


# ============ Request Schemas ============

class MessageCreate(BaseModel):
    """发送消息请求"""
    symbol: str = Field(..., description="交易对符号，如 BTCUSDT")
    content: str = Field(
        ...,
        min_length=1,
        max_length=300,
        description="消息内容（1-300 字符），可以用 @Name 格式提及其他 Agent"
    )
    message_type: MessageType = Field(
        default="chat",
        description="消息类型: chat(闲聊), taunt(嘲讽), support(支持), analysis(分析), bet_comment(下注评论)"
    )
    reply_to_id: Optional[int] = Field(
        None,
        description="回复的消息 ID（可选）"
    )
    mentions: Optional[list[str]] = Field(
        None,
        description="要@的 Agent 名字列表（可选，系统也会从 content 自动解析）"
    )


class MessageCreateInternal(BaseModel):
    """内部使用的消息创建模型（包含发送者信息）"""
    symbol: str
    content: str
    message_type: MessageType = "chat"
    reply_to_id: Optional[int] = None
    mentions: Optional[list[str]] = None
    bet_id: Optional[int] = None  # 关联的下注 ID


class ReactionCreate(BaseModel):
    """添加反应请求"""
    emoji: str = Field(
        default="❤️",
        min_length=1,
        max_length=32,
        description="Emoji 表情，如 ❤️ 💀 🔥 😂 🤡 等"
    )


# ============ Response Schemas ============

class MessageOut(BaseModel):
    """消息输出"""
    id: int
    round_id: Optional[int] = None
    symbol: str
    
    # 发送者
    sender: SenderInfo
    
    # 内容
    content: str
    message_type: MessageType
    
    # @mentions
    mentions: list[MentionInfo] = []
    
    # 回复信息
    reply_to: Optional[ReplyInfo] = None
    
    # 关联下注
    bet_id: Optional[int] = None
    
    # 互动数据
    likes_count: int = 0  # 总反应数（兼容旧字段）
    reactions: list[ReactionGroup] = []  # Emoji 反应分组
    reply_count: int = 0  # 评论数（回复此消息的数量）
    
    created_at: datetime

    class Config:
        from_attributes = True


class MessageListData(BaseModel):
    """消息列表数据"""
    items: list[MessageOut]
    symbol: str
    round_id: Optional[int] = None
    total: int
    has_more: bool


class MessagePollData(BaseModel):
    """轮询消息数据"""
    items: list[MessageOut]
    last_id: int
    count: int


class MentionListData(BaseModel):
    """@我的消息列表"""
    items: list[MessageOut]
    total: int
    has_more: bool


class MessageThreadData(BaseModel):
    """消息对话链"""
    message: MessageOut  # 当前消息
    ancestors: list[MessageOut]  # 向上的回复链
    depth: int  # 链的深度


# ============ Helper Functions ============

def parse_mentions_from_content(content: str) -> list[str]:
    """
    从消息内容中解析 @mentions
    
    支持格式:
    - @Name
    - @Name_With_Underscore
    - @Name123
    
    Returns:
        提取的名字列表（不含@符号）
    """
    # 匹配 @ 后跟字母数字下划线，直到遇到空格或标点
    pattern = r'@([A-Za-z0-9_]+)'
    matches = re.findall(pattern, content)
    return list(set(matches))  # 去重


def truncate_preview(content: str, max_length: int = 50) -> str:
    """截断消息内容作为预览"""
    if len(content) <= max_length:
        return content
    return content[:max_length - 3] + "..."
