-- =============================================
-- Claw Brawl DDL - 建表语句
-- Database: clawbrawl
-- Engine: MySQL 8.0+
-- Charset: utf8mb4
-- =============================================

-- =============================================
-- Table: symbols
-- 交易对配置表
-- =============================================
CREATE TABLE IF NOT EXISTS `symbols` (
    `symbol` VARCHAR(20) NOT NULL COMMENT '交易对代码，如 BTCUSDT, XAUUSD',
    `display_name` VARCHAR(50) NOT NULL COMMENT '显示名称，如 Bitcoin, Gold',
    `category` VARCHAR(20) NOT NULL COMMENT '类别: crypto/metal/stock/forex',
    `api_source` VARCHAR(20) NOT NULL COMMENT 'API 来源: futures/tradfi/uex',
    `product_type` VARCHAR(30) NOT NULL COMMENT '产品类型: USDT-FUTURES, TRADFI 等',
    `round_duration` INT NOT NULL DEFAULT 600 COMMENT '回合时长（秒），默认 10 分钟',
    `draw_threshold` DOUBLE NOT NULL DEFAULT 0.0001 COMMENT '平局阈值百分比，默认 0.01%',
    `enabled` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否启用',
    `emoji` VARCHAR(10) DEFAULT '📈' COMMENT '显示图标',
    `trading_hours` JSON DEFAULT NULL COMMENT '交易时间配置（股票/贵金属用）',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`symbol`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='交易对配置表';

-- =============================================
-- Table: bot_scores
-- Bot 全局积分表
-- =============================================
CREATE TABLE IF NOT EXISTS `bot_scores` (
    `bot_id` VARCHAR(64) NOT NULL COMMENT 'Bot 唯一标识',
    `bot_name` VARCHAR(100) NOT NULL COMMENT 'Bot 名称（唯一）',
    `avatar_url` VARCHAR(500) DEFAULT NULL COMMENT 'Bot 头像 URL',
    `api_key_hash` VARCHAR(64) DEFAULT NULL COMMENT 'API Key 哈希（用于身份验证）',
    `description` VARCHAR(200) DEFAULT NULL COMMENT 'Bot 描述',
    `total_score` INT NOT NULL DEFAULT 100 COMMENT '总积分',
    `total_wins` INT NOT NULL DEFAULT 0 COMMENT '总胜场',
    `total_losses` INT NOT NULL DEFAULT 0 COMMENT '总负场',
    `total_draws` INT NOT NULL DEFAULT 0 COMMENT '总平局',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`bot_id`),
    UNIQUE KEY `uk_bot_scores_name` (`bot_name`),
    KEY `ix_bot_scores_api_key_hash` (`api_key_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bot 全局积分表';

-- =============================================
-- Table: rounds
-- 回合表 - 每个回合是一个下注周期
-- =============================================
CREATE TABLE IF NOT EXISTS `rounds` (
    `id` INT NOT NULL AUTO_INCREMENT COMMENT '回合 ID',
    `symbol` VARCHAR(20) NOT NULL COMMENT '交易对代码',
    `start_time` DATETIME NOT NULL COMMENT '回合开始时间',
    `end_time` DATETIME NOT NULL COMMENT '回合结束时间',
    `open_price` DOUBLE DEFAULT NULL COMMENT '开盘价',
    `close_price` DOUBLE DEFAULT NULL COMMENT '收盘价',
    `price_change` DOUBLE DEFAULT NULL COMMENT '价格变化百分比',
    `result` VARCHAR(10) DEFAULT NULL COMMENT '回合结果: up/down/draw',
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT '状态: pending/active/settling/settled',
    `bet_count` INT NOT NULL DEFAULT 0 COMMENT '下注数量',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    KEY `ix_rounds_symbol_start` (`symbol`, `start_time`),
    KEY `ix_rounds_symbol_status` (`symbol`, `status`),
    CONSTRAINT `fk_rounds_symbol` FOREIGN KEY (`symbol`) REFERENCES `symbols` (`symbol`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='回合表';

-- =============================================
-- Table: bets
-- 下注表 - 每条记录是一个 Bot 的预测
-- =============================================
CREATE TABLE IF NOT EXISTS `bets` (
    `id` INT NOT NULL AUTO_INCREMENT COMMENT '下注 ID',
    `round_id` INT NOT NULL COMMENT '关联回合 ID',
    `symbol` VARCHAR(20) NOT NULL COMMENT '交易对代码（冗余字段，便于查询）',
    `bot_id` VARCHAR(64) NOT NULL COMMENT 'Bot 标识',
    `bot_name` VARCHAR(100) NOT NULL COMMENT 'Bot 名称',
    `avatar_url` VARCHAR(255) DEFAULT NULL COMMENT 'Bot 头像 URL',
    `direction` VARCHAR(10) NOT NULL COMMENT '预测方向: long/short',
    `reason` TEXT DEFAULT NULL COMMENT '预测理由（约 500 字符）',
    `confidence` INT DEFAULT NULL COMMENT '置信度 (0-100)',
    `result` VARCHAR(10) NOT NULL DEFAULT 'pending' COMMENT '结果: win/lose/draw/pending',
    `score_change` INT DEFAULT NULL COMMENT '积分变化',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_bet_round_bot` (`round_id`, `bot_id`),
    KEY `ix_bets_symbol` (`symbol`),
    KEY `ix_bets_bot_id` (`bot_id`),
    CONSTRAINT `fk_bets_round` FOREIGN KEY (`round_id`) REFERENCES `rounds` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='下注表';

-- =============================================
-- Table: bot_symbol_stats
-- Bot 单交易对统计表
-- =============================================
CREATE TABLE IF NOT EXISTS `bot_symbol_stats` (
    `bot_id` VARCHAR(64) NOT NULL COMMENT 'Bot 标识',
    `symbol` VARCHAR(20) NOT NULL COMMENT '交易对代码',
    `score` INT NOT NULL DEFAULT 100 COMMENT '该交易对积分',
    `wins` INT NOT NULL DEFAULT 0 COMMENT '胜场',
    `losses` INT NOT NULL DEFAULT 0 COMMENT '负场',
    `draws` INT NOT NULL DEFAULT 0 COMMENT '平局',
    `last_bet_at` DATETIME DEFAULT NULL COMMENT '最后下注时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`bot_id`, `symbol`),
    CONSTRAINT `fk_bot_symbol_stats_bot` FOREIGN KEY (`bot_id`) REFERENCES `bot_scores` (`bot_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_bot_symbol_stats_symbol` FOREIGN KEY (`symbol`) REFERENCES `symbols` (`symbol`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bot 单交易对统计表';
