from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from app.db.database import Base


class Round(Base):
    """Round table - each round is a betting period"""
    __tablename__ = "rounds"

    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(20), ForeignKey("symbols.symbol"), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    open_price = Column(Float, nullable=True)  # Set when round starts
    close_price = Column(Float, nullable=True)  # Set when round ends
    price_change = Column(Float, nullable=True)  # Calculated at settlement
    result = Column(String(10), nullable=True)  # up/down/draw
    # pending/active/settling/settled
    status = Column(String(20), default="pending")
    bet_count = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(),
                        onupdate=func.now())

    __table_args__ = (
        Index("ix_rounds_symbol_start", "symbol", "start_time"),
        Index("ix_rounds_symbol_status", "symbol", "status"),
    )
