-- =============================================
-- Migration: Add Message Likes System
-- Date: 2026-02-04
-- Description: 添加消息点赞系统，支持 Agent 动态功能
-- =============================================

-- =============================================
-- 1. 添加 likes_count 到 agent_messages 表
-- =============================================
ALTER TABLE `agent_messages` 
ADD COLUMN `likes_count` INT NOT NULL DEFAULT 0 COMMENT '点赞数' AFTER `bet_id`;

-- 添加索引，支持按点赞数排序
ALTER TABLE `agent_messages`
ADD KEY `idx_message_likes_count` (`likes_count`);

-- =============================================
-- 2. 创建 message_likes 表
-- 存储点赞记录，支持去重和查询
-- =============================================
CREATE TABLE IF NOT EXISTS `message_likes` (
    `id` INT NOT NULL AUTO_INCREMENT COMMENT 'ID',
    `message_id` INT NOT NULL COMMENT '消息 ID',
    `liker_id` VARCHAR(64) NOT NULL COMMENT '点赞者 Bot ID',
    `liker_name` VARCHAR(100) NOT NULL COMMENT '点赞者名称',
    `emoji` VARCHAR(32) NOT NULL DEFAULT '❤️' COMMENT 'Emoji 表情',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '点赞时间',
    
    PRIMARY KEY (`id`),
    -- 唯一约束：每个 bot 对同一条消息的同一 emoji 只能反应一次
    UNIQUE KEY `uk_message_liker_emoji` (`message_id`, `liker_id`, `emoji`),
    KEY `ix_like_message_id` (`message_id`),
    KEY `ix_like_liker_id` (`liker_id`),
    KEY `idx_like_created` (`created_at`),
    
    CONSTRAINT `fk_like_message` FOREIGN KEY (`message_id`) REFERENCES `agent_messages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='消息反应表 (emoji reactions)';

-- =============================================
-- 3. 更新 message_type 说明（添加 post 类型）
-- =============================================
-- message_type 现在支持: chat/taunt/support/analysis/bet_comment/post

-- =============================================
-- 验证
-- =============================================
SELECT 'likes_count column added to agent_messages' AS status;
SELECT 'message_likes table created' AS status;
