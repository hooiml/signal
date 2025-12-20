-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE: market_signals
-- Purpose: Store daily AI-generated market aura summaries
-- ============================================
CREATE TABLE IF NOT EXISTS market_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Market identification
    market_type VARCHAR(10) NOT NULL CHECK (market_type IN ('US', 'MY')),
    
    -- Signal data
    aura_level VARCHAR(20) NOT NULL CHECK (aura_level IN (
        'EXTREME_FEAR', 'FEAR', 'NEUTRAL', 'GREED', 'EXTREME_GREED'
    )),
    aura_score INTEGER NOT NULL CHECK (aura_score BETWEEN 0 AND 100),
    
    -- AI-generated content
    summary TEXT NOT NULL,           -- Main narrative (2-3 paragraphs)
    key_drivers JSONB NOT NULL,      -- Array of key market movers
    outlook TEXT,                    -- Forward-looking 1-sentence statement
    
    -- Raw metrics snapshot
    vix_value DECIMAL(10,2),         -- VIX index value (US only)
    market_index_value DECIMAL(12,2),-- SPY/KLCI value
    social_sentiment_score DECIMAL(5,2), -- -1 to 1 scale
    
    -- Metadata
    data_sources JSONB NOT NULL,     -- Sources used for this signal
    model_version VARCHAR(50) NOT NULL,
    
    -- Timestamps
    signal_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure one signal per market per day
    CONSTRAINT unique_daily_signal UNIQUE (market_type, signal_date)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_signals_market_date ON market_signals(market_type, signal_date DESC);

-- ============================================
-- TABLE: watchlist
-- Purpose: Store user watchlist tickers (US + MY)
-- ============================================
CREATE TABLE IF NOT EXISTS watchlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Ticker info
    ticker VARCHAR(20) NOT NULL,
    market_type VARCHAR(10) NOT NULL CHECK (market_type IN ('US', 'MY')),
    company_name VARCHAR(255),
    sector VARCHAR(100),
    
    -- User tracking (for future multi-user support)
    user_id VARCHAR(255) DEFAULT 'default',
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Prevent duplicate tickers per user
    CONSTRAINT unique_user_ticker UNIQUE (user_id, ticker, market_type)
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id, market_type) WHERE is_active = true;

-- ============================================
-- TABLE: data_fetch_log
-- Purpose: Track data fetch history and errors
-- ============================================
CREATE TABLE IF NOT EXISTS data_fetch_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fetch_type VARCHAR(50) NOT NULL, -- 'vix', 'reddit', 'news'
    status VARCHAR(20) NOT NULL,     -- 'success', 'partial', 'failed'
    records_fetched INTEGER DEFAULT 0,
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
