from sqlalchemy import Column, String, Integer, DateTime, Index
from sqlalchemy.sql import func
from app.db.database import Base


class Danmaku(Base):
    """弹幕消息表"""
    __tablename__ = "danmaku"

    id = Column(Integer, primary_key=True, autoincrement=True)
    round_id = Column(Integer, nullable=False, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    
    # 发送者信息（可以是匿名用户或绑定钱包地址）
    user_id = Column(String(64), nullable=True)  # 钱包地址或匿名 ID
    nickname = Column(String(50), nullable=True)  # 显示昵称
    
    # 弹幕内容
    content = Column(String(100), nullable=False)  # 弹幕文字，限制 100 字符
    color = Column(String(7), nullable=True)  # 颜色 hex，如 #FF5500
    
    # 元数据
    ip_hash = Column(String(64), nullable=True)  # IP 哈希，用于限流
    created_at = Column(DateTime, server_default=func.now(), index=True)

    __table_args__ = (
        # 复合索引：按 round 查询弹幕
        Index("idx_danmaku_round_created", "round_id", "created_at"),
        # 复合索引：按 symbol 和时间查询
        Index("idx_danmaku_symbol_created", "symbol", "created_at"),
    )
