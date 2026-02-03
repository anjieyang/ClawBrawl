#!/usr/bin/env python3
"""
迁移脚本：创建 danmaku 弹幕表
Usage: python scripts/migrate_danmaku.py
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.db.database import engine
from app.models.danmaku import Danmaku  # noqa: F401 - ensure model is imported


async def create_danmaku_table():
    """Create the danmaku table if it doesn't exist"""
    
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS `danmaku` (
        `id` INT NOT NULL AUTO_INCREMENT COMMENT '弹幕 ID',
        `round_id` INT NOT NULL COMMENT '关联回合 ID',
        `symbol` VARCHAR(20) NOT NULL COMMENT '交易对代码',
        `user_id` VARCHAR(64) DEFAULT NULL COMMENT '用户标识（钱包地址或匿名 ID）',
        `nickname` VARCHAR(50) DEFAULT NULL COMMENT '显示昵称',
        `content` VARCHAR(100) NOT NULL COMMENT '弹幕内容（1-100 字符）',
        `color` VARCHAR(7) DEFAULT NULL COMMENT '颜色 hex 值，如 #FF5500',
        `ip_hash` VARCHAR(64) DEFAULT NULL COMMENT 'IP 哈希（用于频率限制）',
        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        PRIMARY KEY (`id`),
        KEY `ix_danmaku_round_id` (`round_id`),
        KEY `ix_danmaku_symbol` (`symbol`),
        KEY `ix_danmaku_created_at` (`created_at`),
        KEY `idx_danmaku_round_created` (`round_id`, `created_at`),
        KEY `idx_danmaku_symbol_created` (`symbol`, `created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='弹幕消息表';
    """
    
    # SQLite 版本 (用于本地开发)
    create_table_sqlite = """
    CREATE TABLE IF NOT EXISTS danmaku (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        round_id INTEGER NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        user_id VARCHAR(64),
        nickname VARCHAR(50),
        content VARCHAR(100) NOT NULL,
        color VARCHAR(7),
        ip_hash VARCHAR(64),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """
    
    create_indexes_sqlite = [
        "CREATE INDEX IF NOT EXISTS ix_danmaku_round_id ON danmaku(round_id);",
        "CREATE INDEX IF NOT EXISTS ix_danmaku_symbol ON danmaku(symbol);",
        "CREATE INDEX IF NOT EXISTS ix_danmaku_created_at ON danmaku(created_at);",
        "CREATE INDEX IF NOT EXISTS idx_danmaku_round_created ON danmaku(round_id, created_at);",
        "CREATE INDEX IF NOT EXISTS idx_danmaku_symbol_created ON danmaku(symbol, created_at);",
    ]
    
    async with engine.begin() as conn:
        # 检测数据库类型
        db_url = str(engine.url)
        is_sqlite = "sqlite" in db_url.lower()
        
        print(f"Database: {db_url}")
        print(f"Type: {'SQLite' if is_sqlite else 'MySQL'}")
        print()
        
        if is_sqlite:
            print("Creating danmaku table (SQLite)...")
            await conn.execute(text(create_table_sqlite))
            for idx_sql in create_indexes_sqlite:
                await conn.execute(text(idx_sql))
        else:
            print("Creating danmaku table (MySQL)...")
            await conn.execute(text(create_table_sql))
        
        print("✓ danmaku table created successfully!")
        
        # 验证表是否存在
        if is_sqlite:
            result = await conn.execute(text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='danmaku';"
            ))
        else:
            result = await conn.execute(text(
                "SHOW TABLES LIKE 'danmaku';"
            ))
        
        if result.fetchone():
            print("✓ Table verified!")
        else:
            print("✗ Table verification failed!")
            return False
    
    return True


if __name__ == "__main__":
    print("=" * 50)
    print("Danmaku Table Migration")
    print("=" * 50)
    print()
    
    success = asyncio.run(create_danmaku_table())
    
    print()
    print("=" * 50)
    if success:
        print("Migration completed successfully!")
    else:
        print("Migration failed!")
        sys.exit(1)
