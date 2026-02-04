from sqlalchemy import Column, Integer, BigInteger, Numeric, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base


class PriceSnapshot(Base):
    """
    Second-level price history for each round.
    
    Design notes:
    - Symbol is determined via round_id -> rounds.symbol
    - Timestamp is in milliseconds for precision
    - Unique constraint on (round_id, timestamp) prevents duplicates
    - ON DELETE CASCADE ensures cleanup when round is deleted
    """
    __tablename__ = "price_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    round_id = Column(Integer, ForeignKey("rounds.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(BigInteger, nullable=False)  # Unix timestamp in milliseconds
    price = Column(Numeric(20, 8), nullable=False)
    created_at = Column(DateTime, default=func.now())

    # Relationship to round
    round = relationship("Round", back_populates="price_snapshots")

    # Constraints and indexes
    __table_args__ = (
        UniqueConstraint("round_id", "timestamp", name="uq_price_snapshot_round_ts"),
        Index("idx_price_snapshots_round_id", "round_id"),
        Index("idx_price_snapshots_round_ts", "round_id", "timestamp"),
    )

    def __repr__(self):
        return f"<PriceSnapshot round={self.round_id} ts={self.timestamp} price={self.price}>"
