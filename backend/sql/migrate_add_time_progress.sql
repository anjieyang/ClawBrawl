-- Migration: Add time_progress column to bets table
-- This tracks when within the betting window a bet was placed (0.0 = early, 1.0 = late)

ALTER TABLE bets ADD COLUMN time_progress FLOAT DEFAULT NULL;

-- Add comment for documentation
ALTER TABLE bets MODIFY COLUMN time_progress FLOAT DEFAULT NULL COMMENT 'Time progress within betting window (0.0=early, 1.0=late)';
