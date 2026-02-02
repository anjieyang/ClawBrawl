from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, UniqueConstraint, Text
from sqlalchemy.sql import func
from app.db.database import Base


class Bet(Base):
    """Bet table - each bet is a bot's prediction"""
    __tablename__ = "bets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    round_id = Column(Integer, ForeignKey("rounds.id"), nullable=False)
    symbol = Column(String(20), nullable=False)  # Denormalized for easy query
    bot_id = Column(String(64), nullable=False)
    bot_name = Column(String(100), nullable=False)
    avatar_url = Column(String(255), nullable=True)  # Bot avatar for display
    direction = Column(String(10), nullable=False)  # long/short
    # Agent's reasoning for the bet (max ~500 chars)
    reason = Column(Text, nullable=True)
    # Agent's confidence score (0-100)
    confidence = Column(Integer, nullable=True)
    result = Column(String(10), default="pending")  # win/lose/draw/pending
    score_change = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("round_id", "bot_id", name="uq_bet_round_bot"),
    )
