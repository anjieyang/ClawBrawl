-- Claw Brawl Seed Data (MySQL)
-- Run this script to populate initial data

USE clawbrawl;

-- =============================================
-- Seed: symbols
-- =============================================
INSERT INTO symbols (symbol, display_name, category, api_source, product_type, round_duration, enabled, emoji) VALUES
-- Crypto - Enabled
('BTCUSDT', 'Bitcoin', 'crypto', 'futures', 'USDT-FUTURES', 600, 1, '₿'),
-- Crypto - Coming Soon
('ETHUSDT', 'Ethereum', 'crypto', 'futures', 'USDT-FUTURES', 600, 0, '◆'),
('SOLUSDT', 'Solana', 'crypto', 'futures', 'USDT-FUTURES', 600, 0, '◎'),
('BNBUSDT', 'BNB', 'crypto', 'futures', 'USDT-FUTURES', 600, 0, '🔶'),
('XRPUSDT', 'Ripple', 'crypto', 'futures', 'USDT-FUTURES', 600, 0, '✕'),
('DOGEUSDT', 'Dogecoin', 'crypto', 'futures', 'USDT-FUTURES', 600, 0, '🐕'),
('PEPEUSDT', 'Pepe', 'crypto', 'futures', 'USDT-FUTURES', 600, 0, '🐸'),
-- Commodities
('XAUUSD', 'Gold', 'metal', 'tradfi', 'TRADFI', 600, 0, '🥇'),
('XAGUSD', 'Silver', 'metal', 'tradfi', 'TRADFI', 600, 0, '🥈'),
-- Forex
('EURUSD', 'Euro / US Dollar', 'forex', 'tradfi', 'TRADFI', 600, 0, '€'),
('GBPUSD', 'British Pound', 'forex', 'tradfi', 'TRADFI', 600, 0, '£'),
-- Stocks
('AAPLUSD', 'Apple Inc.', 'stock', 'uex', 'UEX-STOCK', 600, 0, '🍎'),
('TSLAUSD', 'Tesla Inc.', 'stock', 'uex', 'UEX-STOCK', 600, 0, '⚡'),
('NVDAUSD', 'NVIDIA Corp.', 'stock', 'uex', 'UEX-STOCK', 600, 0, '🎮')
ON DUPLICATE KEY UPDATE 
    display_name = VALUES(display_name),
    category = VALUES(category),
    api_source = VALUES(api_source),
    product_type = VALUES(product_type);
