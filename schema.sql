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

CREATE TABLE IF NOT EXISTS research_records (
    user_id VARCHAR(255) NOT NULL DEFAULT 'default',
    symbol VARCHAR(20) NOT NULL,
    market_type VARCHAR(10) NOT NULL CHECK (market_type IN ('US', 'MY')),
    company_name VARCHAR(120) NOT NULL,
    position_state VARCHAR(20) NOT NULL DEFAULT 'not-owned',
    in_buy_zone BOOLEAN NOT NULL DEFAULT false,
    research_status VARCHAR(20) NOT NULL DEFAULT 'watch',
    target_buy_zone VARCHAR(120) NOT NULL DEFAULT '',
    valuation_state VARCHAR(20) NOT NULL DEFAULT 'unknown',
    thesis_strength VARCHAR(20) NOT NULL DEFAULT 'medium',
    why_interested TEXT NOT NULL DEFAULT '',
    bull_case TEXT NOT NULL DEFAULT '',
    bear_case TEXT NOT NULL DEFAULT '',
    buy_trigger TEXT NOT NULL DEFAULT '',
    sell_trigger TEXT NOT NULL DEFAULT '',
    thesis_break TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_reviewed_at DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, symbol, market_type)
);

CREATE TABLE IF NOT EXISTS research_archived_symbols (
    user_id VARCHAR(255) NOT NULL DEFAULT 'default',
    symbol VARCHAR(20) NOT NULL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, symbol)
);

CREATE TABLE IF NOT EXISTS discovery_snapshots (
    snapshot_hour TIMESTAMPTZ PRIMARY KEY,
    generated_at TIMESTAMPTZ NOT NULL,
    candidates JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discovery_snapshots_generated
    ON discovery_snapshots(generated_at DESC);

-- ============================================
-- TABLE: institutional_data
-- Purpose: Store slower-moving survey/manual indicators such as AAII
-- ============================================
CREATE TABLE IF NOT EXISTS institutional_data (
    id SERIAL PRIMARY KEY,
    indicator_name VARCHAR(50) NOT NULL,
    value DECIMAL(10, 4) NOT NULL,
    report_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_institutional_indicator_date UNIQUE (indicator_name, report_date)
);

CREATE INDEX IF NOT EXISTS idx_institutional_indicator_date
    ON institutional_data(indicator_name, report_date DESC);

-- ============================================
-- TABLE: signal_snapshots
-- Purpose: Store daily full signal vectors for deltas, sparklines, and future backtesting
-- ============================================
CREATE TABLE IF NOT EXISTS signal_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    market_type VARCHAR(10) NOT NULL CHECK (market_type IN ('US', 'MY')),
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('standard', 'contrarian')),
    enable_social BOOLEAN NOT NULL DEFAULT true,
    snapshot_date DATE NOT NULL,
    composite_score INTEGER NOT NULL CHECK (composite_score BETWEEN 0 AND 100),
    tier VARCHAR(20) NOT NULL,
    confidence_level VARCHAR(20) NOT NULL,
    agreement_pct INTEGER NOT NULL,
    majority_signal VARCHAR(20) NOT NULL,
    components JSONB NOT NULL,
    score_drivers JSONB NOT NULL,
    index_trend JSONB NOT NULL,
    signal_quality JSONB NOT NULL,
    interpretation_context JSONB NOT NULL,
    metadata_snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_signal_snapshot UNIQUE (market_type, mode, enable_social, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_signal_snapshots_lookup
    ON signal_snapshots(market_type, mode, enable_social, snapshot_date DESC);

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
