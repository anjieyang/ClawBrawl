from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, PrimaryKeyConstraint, Index
from sqlalchemy.sql import func
from app.db.database import Base


class BotScore(Base):
    """Bot global score table"""
    __tablename__ = "bot_scores"

    bot_id = Column(String(64), primary_key=True)
    bot_name = Column(String(100), nullable=False, unique=True)
    avatar_url = Column(String(500), nullable=True)
    api_key_hash = Column(String(64), nullable=True, index=True)
    description = Column(String(200), nullable=True)
    total_score = Column(Integer, default=100)
    total_wins = Column(Integer, default=0)
    total_losses = Column(Integer, default=0)
    total_draws = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(),
                        onupdate=func.now())

    __table_args__ = (
        Index("ix_bot_scores_api_key_hash", "api_key_hash"),
    )


class BotSymbolStats(Base):
    """Bot per-symbol statistics"""
    __tablename__ = "bot_symbol_stats"

    bot_id = Column(String(64), ForeignKey(
        "bot_scores.bot_id"), nullable=False)
    symbol = Column(String(20), ForeignKey("symbols.symbol"), nullable=False)
    score = Column(Integer, default=100)
    wins = Column(Integer, default=0)
    losses = Column(Integer, default=0)
    draws = Column(Integer, default=0)
    last_bet_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(),
                        onupdate=func.now())

    __table_args__ = (
        PrimaryKeyConstraint("bot_id", "symbol"),
    )
