# Signal - Implementation Task Tracker

## Phase 1: Foundation Setup ✅
- [x] Initialize Next.js 14+ with App Router
- [x] Configure environment variables (`.env.local`)
- [x] Set up Neon database connection (`src/lib/db.ts`)
- [x] Create Yahoo Finance fetcher (`src/lib/yahoo-finance.ts`)
- [x] Build test DB endpoint (`src/app/api/test-db/route.ts`)
- [x] Build VIX fetch endpoint (`src/app/api/signals/vix/route.ts`)
- [x] Run database migrations (create tables in Neon)

## Phase 2: Social Intelligence ✅
- [x] Create Reddit fetcher (`src/lib/reddit.ts`) - Public API (Hot + RSS Fallback)
- [x] Create RSS feed parser (`src/lib/rss-feeds.ts`)
- [x] Create StockTwits fetcher (`src/lib/stocktwits.ts`)
- [x] Build social aggregation endpoint (`/api/signals/aggregate`)
- [x] Implement noise filtering (Relaxed for MY, Triple-Origin for Vercel)

## Phase 3: AI Integration ✅
- [x] Configure Gemini API client (`src/lib/gemini.ts`)
- [x] Create prompt templates for aura generation
- [x] Build full aggregation endpoint (`/api/signals/full`)
- [x] Implement quantitative sentiment calculator (`src/lib/sentiment-calculator.ts`)
- [ ] Configure Vercel cron schedule (`vercel.json`)

## Phase 4: Dashboard UI ✅
- [x] Design signal dashboard layout
- [x] Build aura display component (score gauge)
- [x] Display AI-generated market narrative
- [x] Show key market drivers
- [x] Display live news/Reddit feeds
- [x] Show score component breakdown
- [ ] Add historical signal charts
- [ ] Create watchlist management UI

## Phase 5: Malaysia Market ✅
- [x] Add KLCI data fetching
- [x] Configure MY-specific RSS feeds (The Star, Edgemarkets)
- [x] Extend aura generation for MY market
- [x] Implement local fear proxy (USD/MYR 20d Rolling Vol)
- [x] Optimize social weight (20% Reddit / 80% News)

## Phase 6: Advanced Indicators (V2 Backlog)
- [ ] **VIX/VXV Term Structure** - Add CBOE VXV feed to detect contango/backwardation
- [ ] **52-Week VIX Percentile** - Regime-adaptive thresholds
- [ ] **Put/Call Ratio** - Options sentiment confirmation
- [ ] **Market Breadth** - % stocks above 50/200 DMA
- [ ] **Fund Flows** - ETF inflows/outflows (requires API subscription)

## Notes
- VIX/VXV improves accuracy ~5% but adds complexity. Implement after 3 months of data collection.
- Current formula: Logistic VIX normalization + adaptive weighting + velocity adjustment

