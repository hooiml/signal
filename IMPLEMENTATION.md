# Signal - Implementation Plan

> **Quick Reference**: See [BLUEPRINT.md](./BLUEPRINT.md) for full architecture and code samples.

## Overview

Build a market sentiment summarizer ("Market Aura") using a pre-computed pipeline to avoid live LLM costs.

## Tech Stack

| Layer | Technology | Free Tier |
|---|---|---|
| Framework | Next.js 14+ (App Router) | ✅ Vercel |
| Database | Neon Serverless Postgres | ✅ 0.5GB |
| Automation | Vercel Cron Jobs | ✅ Daily |
| AI | Kimi K2 | ✅ Free tier |
| Data | Yahoo Finance, Reddit, RSS | ✅ Public APIs |

## Architecture

```
Vercel Cron → Fetch Data → Kimi K2 → Store in Neon → UI Reads from DB
```

## Database Tables

1. **`market_signals`** - Daily aura summaries (US/MY)
2. **`watchlist`** - User tracked tickers
3. **`data_fetch_log`** - Debug/monitoring (optional)

## Phase 1 Files (Priority)

| # | File | Purpose |
|---|---|---|
| 1 | `.env.local` | API keys & DB URL |
| 2 | `src/lib/db.ts` | Neon connection |
| 3 | `src/lib/yahoo-finance.ts` | VIX fetcher |
| 4 | `src/app/api/test-db/route.ts` | Connection test |
| 5 | `src/app/api/signals/vix/route.ts` | VIX store endpoint |

## Verification

```bash
npm run build              # No TS errors
curl /api/test-db          # DB connected
curl /api/signals/vix      # VIX stored
```

## Next Phases

- **Phase 2**: Reddit OAuth + RSS parsing
- **Phase 3**: Kimi K2 integration + Cron setup
- **Phase 4**: Dashboard UI
- **Phase 5**: Bursa Malaysia support
