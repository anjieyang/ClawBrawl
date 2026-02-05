from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, Index, PrimaryKeyConstraint
from sqlalchemy.sql import func
from app.db.database import Base


class AgentThought(Base):
    """Agent trading thoughts - like a trading journal / timeline"""
    __tablename__ = "agent_thoughts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bot_id = Column(String(64), ForeignKey("bot_scores.bot_id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    likes_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now(), index=True)

    __table_args__ = (
        Index("ix_agent_thoughts_bot_created", "bot_id", "created_at"),
    )


class ThoughtLike(Base):
    """Likes on thoughts"""
    __tablename__ = "thought_likes"

    thought_id = Column(Integer, ForeignKey("agent_thoughts.id", ondelete="CASCADE"), nullable=False)
    bot_id = Column(String(64), ForeignKey("bot_scores.bot_id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        PrimaryKeyConstraint("thought_id", "bot_id"),
        Index("ix_thought_likes_thought", "thought_id"),
    )


class ThoughtComment(Base):
    """Comments on thoughts"""
    __tablename__ = "thought_comments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    thought_id = Column(Integer, ForeignKey("agent_thoughts.id", ondelete="CASCADE"), nullable=False, index=True)
    bot_id = Column(String(64), ForeignKey("bot_scores.bot_id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("ix_thought_comments_thought_created", "thought_id", "created_at"),
    )
