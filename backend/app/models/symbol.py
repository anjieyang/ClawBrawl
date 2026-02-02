from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, JSON
from sqlalchemy.sql import func
from app.db.database import Base


class Symbol(Base):
    """Symbol configuration table"""
    __tablename__ = "symbols"

    symbol = Column(String(20), primary_key=True)  # e.g., BTCUSDT, XAUUSD
    display_name = Column(String(50), nullable=False)  # e.g., Bitcoin, 黄金
    category = Column(String(20), nullable=False)  # crypto/metal/stock/forex
    api_source = Column(String(20), nullable=False)  # futures/tradfi/uex
    # USDT-FUTURES, TRADFI, etc.
    product_type = Column(String(30), nullable=False)
    round_duration = Column(Integer, default=600)  # seconds, default 10 min
    draw_threshold = Column(Float, default=0.0001)  # 0.01%
    enabled = Column(Boolean, default=False)
    emoji = Column(String(10), default="📈")
    trading_hours = Column(JSON, nullable=True)  # Optional: for stocks/metals
    created_at = Column(DateTime, server_default=func.now())
