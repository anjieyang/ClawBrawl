-- Migration: Add price_snapshots table for storing second-level price history
-- Supports multiple symbols through round_id foreign key
-- MySQL compatible syntax

CREATE TABLE IF NOT EXISTS price_snapshots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    round_id INT NOT NULL,
    timestamp BIGINT NOT NULL,  -- Unix timestamp in milliseconds
    price DECIMAL(20, 8) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
    UNIQUE KEY uq_price_snapshot_round_ts (round_id, timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Index for fast lookup by round
CREATE INDEX idx_price_snapshots_round_id ON price_snapshots(round_id);

-- Index for time-range queries within a round
CREATE INDEX idx_price_snapshots_round_ts ON price_snapshots(round_id, timestamp);
