-- =============================================
-- Migration: Add danmaku table
-- Date: 2026-02-03
-- Description: 添加弹幕消息表
-- =============================================

-- 创建弹幕表
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
