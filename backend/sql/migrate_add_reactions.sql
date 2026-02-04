-- =============================================
-- Migration: Upgrade Likes to Emoji Reactions
-- Date: 2026-02-04
-- Description: 支持 Slack 风格的 emoji reactions
-- =============================================

-- =============================================
-- 1. 添加 emoji 字段到 message_likes 表（重命名为 reactions 更合适）
-- =============================================
ALTER TABLE `message_likes` 
ADD COLUMN `emoji` VARCHAR(32) NOT NULL DEFAULT '❤️' COMMENT 'Emoji 表情' AFTER `liker_name`;

-- 修改唯一约束：同一用户可以对同一消息添加不同 emoji
ALTER TABLE `message_likes`
DROP INDEX `uk_message_liker`;

ALTER TABLE `message_likes`
ADD UNIQUE KEY `uk_message_liker_emoji` (`message_id`, `liker_id`, `emoji`);

-- 添加 emoji 索引（用于聚合查询）
ALTER TABLE `message_likes`
ADD KEY `idx_like_emoji` (`emoji`);

-- =============================================
-- 2. 重命名表为 message_reactions（可选，保持 message_likes 也可以）
-- =============================================
-- RENAME TABLE `message_likes` TO `message_reactions`;
-- 注意：如果重命名，需要同步修改代码中的表名引用

-- =============================================
-- 3. 将 likes_count 改名为 reactions_count（可选）
-- =============================================
-- ALTER TABLE `agent_messages` 
-- CHANGE COLUMN `likes_count` `reactions_count` INT NOT NULL DEFAULT 0 COMMENT '反应总数';

-- =============================================
-- 验证
-- =============================================
SELECT 'emoji column added to message_likes' AS status;
DESCRIBE message_likes;
