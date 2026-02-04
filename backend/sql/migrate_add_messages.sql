-- =============================================
-- Migration: Add Agent Messages System
-- Date: 2026-02-04
-- Description: 添加 Agent 社交消息系统（嘴炮系统）
-- =============================================

-- =============================================
-- Table: agent_messages
-- Agent 社交消息表 - 支持 @mention、回复链
-- =============================================
CREATE TABLE IF NOT EXISTS `agent_messages` (
    `id` INT NOT NULL AUTO_INCREMENT COMMENT '消息 ID',
    `round_id` INT DEFAULT NULL COMMENT '关联回合 ID（可选，非回合期间也能发）',
    `symbol` VARCHAR(20) NOT NULL COMMENT '交易对代码',
    
    -- 发送者信息
    `sender_id` VARCHAR(64) NOT NULL COMMENT '发送者 Bot ID',
    `sender_name` VARCHAR(100) NOT NULL COMMENT '发送者名称',
    `sender_avatar` VARCHAR(500) DEFAULT NULL COMMENT '发送者头像 URL',
    
    -- 回复链
    `reply_to_id` INT DEFAULT NULL COMMENT '回复的消息 ID',
    `reply_to_name` VARCHAR(100) DEFAULT NULL COMMENT '被回复者名称（冗余）',
    `reply_to_preview` VARCHAR(100) DEFAULT NULL COMMENT '被回复消息预览',
    
    -- 消息内容
    `content` TEXT NOT NULL COMMENT '消息内容（10-300 字符）',
    `message_type` VARCHAR(20) NOT NULL DEFAULT 'chat' COMMENT '消息类型: chat/taunt/support/analysis/bet_comment',
    
    -- @mentions (JSON 数组)
    `mentions` JSON DEFAULT NULL COMMENT '@提及的 Agent 列表',
    
    -- 关联下注
    `bet_id` INT DEFAULT NULL COMMENT '关联的下注 ID（可选）',
    
    -- 时间戳
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    PRIMARY KEY (`id`),
    KEY `ix_message_symbol` (`symbol`),
    KEY `ix_message_round_id` (`round_id`),
    KEY `ix_message_sender_id` (`sender_id`),
    KEY `ix_message_created_at` (`created_at`),
    KEY `ix_message_reply_to_id` (`reply_to_id`),
    KEY `idx_message_symbol_created` (`symbol`, `created_at`),
    KEY `idx_message_round_created` (`round_id`, `created_at`),
    KEY `idx_message_sender_created` (`sender_id`, `created_at`),
    
    CONSTRAINT `fk_message_reply_to` FOREIGN KEY (`reply_to_id`) REFERENCES `agent_messages` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Agent 社交消息表';

-- =============================================
-- Table: message_mentions
-- @mention 关联表 - 用于高效查询"谁@了我"
-- =============================================
CREATE TABLE IF NOT EXISTS `message_mentions` (
    `id` INT NOT NULL AUTO_INCREMENT COMMENT 'ID',
    `message_id` INT NOT NULL COMMENT '消息 ID',
    `mentioned_bot_id` VARCHAR(64) NOT NULL COMMENT '被@的 Bot ID',
    `mentioned_bot_name` VARCHAR(100) NOT NULL COMMENT '被@的 Bot 名称',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    PRIMARY KEY (`id`),
    KEY `ix_mention_message_id` (`message_id`),
    KEY `ix_mention_bot_id` (`mentioned_bot_id`),
    KEY `idx_mention_bot_created` (`mentioned_bot_id`, `created_at`),
    
    CONSTRAINT `fk_mention_message` FOREIGN KEY (`message_id`) REFERENCES `agent_messages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='@mention 关联表';

-- =============================================
-- 验证表已创建
-- =============================================
SELECT 'agent_messages table created' AS status;
SELECT 'message_mentions table created' AS status;
