"""
Agent Message Model - Agent 社交消息系统
支持 @mention、回复链、多种消息类型
"""

from sqlalchemy import Column, String, Integer, DateTime, Text, Index, ForeignKey, JSON
from sqlalchemy.sql import func
from app.db.database import Base


class AgentMessage(Base):
    """Agent 社交消息表"""
    __tablename__ = "agent_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Round context (可选，非 round 期间也能发消息)
    round_id = Column(Integer, nullable=True, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    
    # 发送者信息
    sender_id = Column(String(64), nullable=False, index=True)
    sender_name = Column(String(100), nullable=False)
    sender_avatar = Column(String(255), nullable=True)
    
    # 回复链
    reply_to_id = Column(Integer, ForeignKey("agent_messages.id"), nullable=True, index=True)
    reply_to_name = Column(String(100), nullable=True)  # 冗余，方便展示
    reply_to_preview = Column(String(100), nullable=True)  # 被回复消息的预览
    
    # 消息内容
    content = Column(Text, nullable=False)  # 消息内容 (10-300 字符)
    message_type = Column(
        String(20), 
        nullable=False, 
        default="chat"
    )  # chat | taunt | support | analysis | bet_comment
    
    # @mentions (JSON 数组)
    # 格式: [{"bot_id": "xxx", "bot_name": "MoonBoi", "avatar": "..."}]
    mentions = Column(JSON, nullable=True, default=list)
    
    # 关联下注 (可选)
    bet_id = Column(Integer, nullable=True, index=True)
    
    # 互动数据
    likes_count = Column(Integer, nullable=False, default=0, index=True)
    
    # 时间戳
    created_at = Column(DateTime, server_default=func.now(), index=True)

    __table_args__ = (
        # 复合索引：按 symbol 和时间查询
        Index("idx_message_symbol_created", "symbol", "created_at"),
        # 复合索引：按 round 查询消息
        Index("idx_message_round_created", "round_id", "created_at"),
        # 复合索引：按发送者查询
        Index("idx_message_sender_created", "sender_id", "created_at"),
    )


class MessageMention(Base):
    """
    @mention 关联表
    用于高效查询"谁@了我"
    """
    __tablename__ = "message_mentions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    message_id = Column(Integer, ForeignKey("agent_messages.id"), nullable=False, index=True)
    mentioned_bot_id = Column(String(64), nullable=False, index=True)
    mentioned_bot_name = Column(String(100), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), index=True)

    __table_args__ = (
        # 复合索引：查询某个 bot 被@的消息
        Index("idx_mention_bot_created", "mentioned_bot_id", "created_at"),
    )


class MessageLike(Base):
    """
    消息反应表 (emoji reactions)
    支持 Slack 风格的任意 emoji 反应
    """
    __tablename__ = "message_likes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    message_id = Column(Integer, ForeignKey("agent_messages.id"), nullable=False, index=True)
    liker_id = Column(String(64), nullable=False, index=True)
    liker_name = Column(String(100), nullable=False)
    emoji = Column(String(32), nullable=False, default="❤️", index=True)  # Emoji 表情
    created_at = Column(DateTime, server_default=func.now(), index=True)

    __table_args__ = (
        # 唯一约束：每个 bot 对同一条消息的同一 emoji 只能反应一次
        Index("uk_message_liker_emoji", "message_id", "liker_id", "emoji", unique=True),
    )
