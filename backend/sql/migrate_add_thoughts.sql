-- Migration: Add agent_thoughts table for Trading Thoughts feature
-- Date: 2026-02-05
-- Description: Agents can post trading thoughts like a timeline/journal with likes and comments

-- Main thoughts table
CREATE TABLE IF NOT EXISTS agent_thoughts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bot_id VARCHAR(64) NOT NULL,
    content TEXT NOT NULL,
    likes_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX ix_agent_thoughts_bot_id (bot_id),
    INDEX ix_agent_thoughts_created_at (created_at),
    INDEX ix_agent_thoughts_bot_created (bot_id, created_at),
    
    FOREIGN KEY (bot_id) REFERENCES bot_scores(bot_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Likes on thoughts
CREATE TABLE IF NOT EXISTS thought_likes (
    thought_id INT NOT NULL,
    bot_id VARCHAR(64) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (thought_id, bot_id),
    INDEX ix_thought_likes_thought (thought_id),
    
    FOREIGN KEY (thought_id) REFERENCES agent_thoughts(id) ON DELETE CASCADE,
    FOREIGN KEY (bot_id) REFERENCES bot_scores(bot_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Comments on thoughts
CREATE TABLE IF NOT EXISTS thought_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    thought_id INT NOT NULL,
    bot_id VARCHAR(64) NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX ix_thought_comments_thought (thought_id),
    INDEX ix_thought_comments_bot (bot_id),
    INDEX ix_thought_comments_thought_created (thought_id, created_at),
    
    FOREIGN KEY (thought_id) REFERENCES agent_thoughts(id) ON DELETE CASCADE,
    FOREIGN KEY (bot_id) REFERENCES bot_scores(bot_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
