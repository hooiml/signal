# Signal - Market Sentiment Summarizer Technical Blueprint

A "no-cost" architecture for aggregating US Market (Primary) and Bursa Malaysia (Secondary) sentiment using Vercel, Neon, and AI-powered summarization.

---

## 1. System Design

### Architecture Overview

```mermaid
flowchart TB
    subgraph Vercel["Vercel Platform"]
        Cron["⏰ Vercel Cron Job<br/>(Daily/4-hourly)"]
        API["Next.js API Route<br/>/api/aggregate"]
        UI["Next.js App Router<br/>Pre-rendered UI"]
    end

    subgraph DataSources["Data Sources"]
        VIX["Yahoo Finance API<br/>(VIX, SPY, KLCI)"]
        FX["Yahoo Finance API<br/>(USD/MYR Historical Vol)"]
        Reddit["Reddit API<br/>(r/wallstreetbets, r/stocks, r/bursabets)"]
        RSS["RSS News Feeds<br/>(Reuters, The Star, Edgemarkets)"]
    end

    subgraph AI["AI Processing"]
        Kimi["Kimi K2<br/>Reasoning & Summarization"]
    end

    subgraph DB["Neon Serverless Postgres"]
        Signals[("market_signals<br/>Daily Aura Summaries")]
        Watchlist[("watchlist<br/>US + MY Tickers")]
    end

    Cron -->|"Triggers"| API
    API -->|"1. Fetch Market Data"| VIX
    API -->|"2. Fetch Social Sentiment"| Reddit
    API -->|"3. Fetch News Headlines"| RSS
    API -->|"4. Send Combined Context"| Kimi
    Kimi -->|"5. Return Aura Summary"| API
    API -->|"6. Store Result"| Signals
    UI -->|"Read Latest Summary"| Signals
    UI -->|"Read User Watchlist"| Watchlist

    style Cron fill:#f9f,stroke:#333,stroke-width:2px
    style Kimi fill:#4ecdc4,stroke:#333,stroke-width:2px
    style Signals fill:#45b7d1,stroke:#333,stroke-width:2px
```

### Flow Sequence

1. **Trigger**: Vercel Cron executes at configured interval (daily or every 4 hours)
2. **Data Collection**: API route fetches VIX/market data, Reddit posts, and news headlines in parallel
3. **AI Summarization**: Combined data sent to Kimi K2 for "aura" generation
4. **Persistence**: Result stored in Neon with timestamp
5. **User Access**: UI reads pre-computed summary instantly from DB

---

## 2. Lean Database Schema

### Schema Definition

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE: market_signals
-- Purpose: Store daily AI-generated market aura summaries
-- ============================================
CREATE TABLE market_signals (
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
    
    -- Raw metrics snapshot
    vix_value DECIMAL(10,2),         -- VIX value (US) OR Scaled Currency Vol (MY)
    market_index_value DECIMAL(12,2),-- SPY/KLCI value
    social_sentiment_score DECIMAL(5,2), -- -1 to 1 scale
    
    -- Metadata
    data_sources JSONB NOT NULL,     -- Sources used for this signal
    model_version VARCHAR(50) NOT NULL,
    
    -- Timestamps
    signal_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure one signal per market per day
    CONSTRAINT unique_daily_signal UNIQUE (market_type, signal_date)
);

-- Index for fast lookups
CREATE INDEX idx_signals_market_date ON market_signals(market_type, signal_date DESC);

-- ============================================
-- TABLE: watchlist
-- Purpose: Store user watchlist tickers (US + MY)
-- ============================================
CREATE TABLE watchlist (
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
CREATE INDEX idx_watchlist_user ON watchlist(user_id, market_type) WHERE is_active = true;

-- ============================================
-- TABLE: data_fetch_log (Optional - for debugging)
-- Purpose: Track data fetch history and errors
-- ============================================
CREATE TABLE data_fetch_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fetch_type VARCHAR(50) NOT NULL, -- 'vix', 'reddit', 'news'
    status VARCHAR(20) NOT NULL,     -- 'success', 'partial', 'failed'
    records_fetched INTEGER DEFAULT 0,
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Key Drivers JSONB Structure

```json
{
  "key_drivers": [
    {
      "factor": "VIX Spike",
      "impact": "negative",
      "description": "VIX surged 15% indicating increased fear"
    },
    {
      "factor": "Tech Earnings",
      "impact": "positive", 
      "description": "FAANG beats expectations driving optimism"
    }
  ]
}
```

---

## 3. Social Intelligence Logic

### Strategy: "Broad Sweep, Smart Caching"

To capture US Market sentiment without hitting rate limits:

### Reddit API Approach

| Subreddit | Posts/Day | Signal Type |
|---|---|---|
| r/wallstreetbets | 25 hot | Retail sentiment, memes |
| r/stocks | 15 hot | Rational discussion |
| r/investing | 10 hot | Long-term sentiment |
| r/malaysia | 10 hot | MY market chatter |

**Query Parameters:**
- `sort=hot` (most engaging current content)
- `limit=25` (per subreddit, max allowed without auth)
- `time=day` (last 24 hours relevance)

**Rate Limit Mitigation:**
- Use OAuth2 app authentication (100 req/min vs 10)
- Single batch fetch per cron run
- Cache raw responses in Neon for 24 hours
- Extract: title + selftext + score + num_comments

### News RSS Feed Strategy

**US Markets:**
- Reuters Business: `feeds.reuters.com/reuters/business`
- MarketWatch: `feeds.marketwatch.com/marketwatch`
- CNBC: `cnbc.com/id/10001147/device/rss`

**Malaysia Markets:**
- The Edge Markets: `theedgemarkets.com/rss`
- NST Business: `nst.com.my/rss/business`

**Processing & Decay (Phase 2 Upgrade):**
- **Age Decay**: Headlines have a 4-hour half-life. Stale news impact is exponentially reduced.
- **Confidence Layer**: Scores are dampened if headline volume is low (Threshold: 5 items).
- Deduplicate by similarity threshold.

---

## 4. Market Calculation Engine

### Regime-Aware Weighting (5-Tier)
The system dynamically adjusts component weights based on the "Fear Gauge" (VIX or FX Vol):

1. **Grind** (VIX < 15): Social-heavy (60%), VIX 40%.
2. **Normal** (VIX 15-25): Standard balanced weights.
3. **Stress** (VIX 25-35): Fear-heavy (75% VIX bias).
4. **Panic** (VIX 35-50): Social noise ignored (90% VIX bias).
5. **Black Swan** (VIX > 50): Extreme VIX bias (95%).

### Malaysia Fear Proxy (USD/MYR Vol)
Since Malaysia lacks a liquid VIX equivalent, we calculate the **20-day Rolling Volatility of USD/MYR**. 
- Scaled via `StdDev * 4000` to align with US VIX ranges (e.g., 0.005 $\approx$ 20 VIX).
- Reflects capital flight and macro instability as the primary Malaysian fear metric.

---

## 4. Phase 1 Roadmap - First 5 Files

| Order | File Path | Purpose |
|:---:|---|---|
| 1 | `.env.local` | Environment configuration |
| 2 | `src/lib/db.ts` | Neon database connection pool |
| 3 | `src/lib/yahoo-finance.ts` | VIX and market data fetcher |
| 4 | `src/app/api/test-db/route.ts` | Database connection test endpoint |
| 5 | `src/app/api/signals/vix/route.ts` | VIX fetch and store endpoint |

---

### File 1: `.env.local`

```bash
# Neon Serverless Postgres
DATABASE_URL="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/signal?sslmode=require"

# Kimi K2 API (Moonshot AI)
KIMI_API_KEY="sk-xxx"
KIMI_BASE_URL="https://api.moonshot.cn/v1"

# Reddit API (OAuth2 App)
REDDIT_CLIENT_ID="xxx"
REDDIT_CLIENT_SECRET="xxx"
REDDIT_USER_AGENT="Signal:v1.0.0 (by /u/youruser)"
```

---

### File 2: `src/lib/db.ts`

```typescript
import { neon, neonConfig } from '@neondatabase/serverless';

// Enable connection caching for serverless
neonConfig.fetchConnectionCache = true;

const sql = neon(process.env.DATABASE_URL!);

export { sql };

// Type-safe query helper
export const query = async <T>(
  queryText: string,
  params: unknown[] = []
): Promise<T[]> => {
  const result = await sql(queryText, params);
  return result as T[];
};
```

---

### File 3: `src/lib/yahoo-finance.ts`

```typescript
interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: Date;
}

const YAHOO_BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

export const fetchVIX = async (): Promise<MarketData> => {
  const response = await fetch(`${YAHOO_BASE_URL}/^VIX?interval=1d&range=1d`, {
    headers: { 'User-Agent': 'Signal/1.0' },
    next: { revalidate: 0 }
  });
  
  if (!response.ok) {
    throw new Error(`Yahoo Finance API error: ${response.status}`);
  }
  
  const data = await response.json();
  const quote = data.chart.result[0].meta;
  
  return {
    symbol: '^VIX',
    price: quote.regularMarketPrice,
    change: quote.regularMarketPrice - quote.previousClose,
    changePercent: ((quote.regularMarketPrice - quote.previousClose) / quote.previousClose) * 100,
    timestamp: new Date()
  };
};

export const fetchMarketIndex = async (symbol: string): Promise<MarketData> => {
  const response = await fetch(`${YAHOO_BASE_URL}/${symbol}?interval=1d&range=1d`, {
    headers: { 'User-Agent': 'Signal/1.0' },
    next: { revalidate: 0 }
  });
  
  if (!response.ok) {
    throw new Error(`Yahoo Finance API error: ${response.status}`);
  }
  
  const data = await response.json();
  const quote = data.chart.result[0].meta;
  
  return {
    symbol,
    price: quote.regularMarketPrice,
    change: quote.regularMarketPrice - quote.previousClose,
    changePercent: ((quote.regularMarketPrice - quote.previousClose) / quote.previousClose) * 100,
    timestamp: new Date()
  };
};
```

---

### File 4: `src/app/api/test-db/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'edge';

export const GET = async (): Promise<NextResponse> => {
  try {
    const result = await sql`SELECT NOW() as current_time, version() as pg_version`;
    
    return NextResponse.json({
      success: true,
      message: 'Neon connection successful',
      data: result[0]
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};
```

---

### File 5: `src/app/api/signals/vix/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fetchVIX } from '@/lib/yahoo-finance';

export const runtime = 'edge';

export const GET = async (): Promise<NextResponse> => {
  try {
    const vixData = await fetchVIX();
    
    // Store in database
    await sql`
      INSERT INTO market_signals (
        market_type,
        aura_level,
        aura_score,
        summary,
        key_drivers,
        vix_value,
        data_sources,
        model_version,
        signal_date
      ) VALUES (
        'US',
        ${vixData.price > 30 ? 'FEAR' : vixData.price < 15 ? 'GREED' : 'NEUTRAL'},
        ${Math.round(100 - (vixData.price * 2))},
        ${`VIX at ${vixData.price.toFixed(2)} - Market is ${vixData.price > 30 ? 'fearful' : 'stable'}`},
        ${JSON.stringify([{ factor: 'VIX', impact: vixData.change > 0 ? 'negative' : 'positive', description: `VIX ${vixData.changePercent > 0 ? 'up' : 'down'} ${Math.abs(vixData.changePercent).toFixed(2)}%` }])},
        ${vixData.price},
        ${JSON.stringify(['yahoo-finance'])},
        'v0.1-vix-only',
        CURRENT_DATE
      )
      ON CONFLICT (market_type, signal_date)
      DO UPDATE SET
        vix_value = EXCLUDED.vix_value,
        updated_at = NOW()
    `;
    
    return NextResponse.json({
      success: true,
      data: vixData
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};
```

---

## 5. Verification Plan

| Step | Command | Expected Result |
|---:|---|---|
| 1 | `npm run build` | Build succeeds with no TypeScript errors |
| 2 | `curl localhost:3000/api/test-db` | Returns `{"success": true, ...}` |
| 3 | `curl localhost:3000/api/signals/vix` | Returns VIX data and stores in DB |

---

## Next Steps After Phase 1

- Phase 2: Add Reddit OAuth + fetcher
- Phase 3: Integrate Kimi K2 for AI summarization  
- Phase 4: Build the Signal Dashboard UI
- Phase 5: Add Bursa Malaysia (KLCI) support
