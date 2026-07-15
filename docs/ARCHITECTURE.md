# Architecture

Signal is a Next.js App Router application for market signal dashboards. The app combines live market data, social/news sentiment, institutional indicators, and persisted snapshots into a decision-support UI.

## User-Facing Routes

- `/`: primary Story First market briefing, implemented by `MarketDashboardV6`.
- `/research`: primary research workspace, implemented by `ResearchDashboardV6`.
- `/main-v6` and `/research-v6`: retained versioned aliases for direct comparison and existing links.
- `/backup/main` and `/backup/research`: previous market and research experiences retained as rollback references.

## Runtime Shape

- Framework: Next.js 16 with React 19.
- Language: TypeScript with `strict` enabled.
- Styling: Tailwind CSS 4 through PostCSS.
- Database: Neon serverless Postgres through `@neondatabase/serverless`.
- Deployment target: Vercel, described by `vercel.json`.

## Main Boundaries

- `src/app`: routes, layouts, and API entry points.
- `src/app/api`: HTTP boundaries for signal reads, refreshes, admin setup, and diagnostics.
- `src/components`: dashboard UI components.
- `src/hooks`: browser-side state and dashboard configuration.
- `src/lib`: market-data clients, database access, orchestration, and scoring logic.
- `src/lib/types`: shared TypeScript contracts for signal payloads.
- `docs`: repository knowledge that agents should use as the system of record, with `docs/HARNESS.md` defining how those docs and checks evolve.
- `scripts/harness`: mechanical checks that keep the repo legible to agents.

## Signal Flow

1. `src/components/v2/SignalDashboard.tsx` reads dashboard config from `useSignalConfig`.
2. The dashboard calls `/api/signals/v2` with `market`, `mode`, and `enableSocial`.
3. `src/app/api/signals/v2/route.ts` validates request parameters and calls `getSmartSignal`.
4. `src/lib/signal.ts` orchestrates market-data, social/news, institutional, and snapshot work.
5. `src/lib/sentiment-calculator-v2.ts` normalizes active indicators into a `MarketSignal`.
6. UI components render score, tier, confidence, source coverage, articles, and component details.
7. Vercel cron calls `/api/signals/refresh` daily to pre-warm the current V2 signal snapshots used by the dashboard.

## Data Sources

- Yahoo Finance helpers provide VIX, indices, stocks, quotes, and Malaysia currency-volatility proxy data.
- Cboe daily market statistics provide the US put/call options-positioning input.
- NAAIM provides weekly active-manager exposure for US positioning context.
- FRED pages provide the non-scored Buffett Indicator valuation backdrop, 10Y–3M yield spread, and Chicago Fed NFCI context.
- Yahoo Finance provides the one-year S&P 500 equal-weight (^SP500EW) versus cap-weight (^GSPC) breadth comparison.
- Bank Negara Malaysia's FMIP benchmark-yields page provides native MGS 3Y/10Y, OPR, MYOR, and short-term bill context when the market is MY.
- RSS feeds and Reddit helpers provide contextual news and retail sentiment inputs.
- StockTwits is used for US social sentiment.
- Institutional data is loaded through `institutional-service`.
- Snapshot history is persisted through `src/lib/db.ts` when the signal route runs.
- User-authored watchlist, thesis, checklist, notes, accepted evidence provenance, and a bounded 25-entry review history are persisted through `/api/research/watchlist`; provider/sample market data remains separate from these records. The server appends immutable review snapshots so clients can update the current draft without rewriting history.
- `/api/research/symbol/[symbol]` combines cached Yahoo Finance chart data with locally calculated technicals and, for US tickers, SEC EDGAR company facts. US valuation metrics are derived from live price, shares, and the latest annual filing rather than copied from an opaque provider. US research snapshots also include a one-year VOO passive-baseline comparison using adjusted closes when available; benchmark failure degrades independently and does not change the composite signal. Malaysia research marks the US benchmark as not applicable.
- SEC Company Facts payloads are fetched without raw Next.js data caching because large issuers can exceed the framework's per-entry cache limit. The service parses that payload immediately and caches only the compact normalized fundamentals for six hours.
- `/api/research/assist/[symbol]` turns the same validated Yahoo and SEC snapshot into a source-linked journal review queue. When `KIMI_API_KEY` is configured, Kimi may synthesize drafts from those supplied facts only; invalid, unsupported, or unavailable AI output falls back to deterministic evidence findings. Findings never update a saved record until the user explicitly accepts and saves them; accepted findings retain a frozen copy of their source labels, links, values, and reporting periods in the current record and each subsequent review snapshot.
- `/api/research/discovery` runs the bounded ranking contract in `docs/trend-discovery.md` over a curated liquid US universe. It returns up to ten leaders, up to ten expandable contenders, and early trends; enriches them with SEC quality and valuation guardrails; checks a bounded Nasdaq earnings window; attaches separately sourced Nasdaq institutional-ownership evidence; and persists hourly leader and contender ranks for score deltas while keeping forward cohort measurement limited to the top ten. Ownership disclosures do not affect rank and are not presented as proof of price causation. The result is a research shortlist, not a trading recommendation.
- `/api/research/alerts` evaluates the bounded monitoring contract in `docs/research-alerts.md` for the current research watchlist. It uses lightweight Yahoo snapshots and degrades individual ticker failures without blocking the remaining alerts.
- A scheduled refresh path precomputes the default V2 market/mode combinations once per day so the dashboard is less dependent on first-visitor refreshes.

## Architecture Rules

- API routes must validate external parameters before calling services.
- Data parsing and normalization belong near the boundary where the data enters the app.
- Scoring rules belong in calculator/service modules, not in UI components.
- UI components should render typed signal payloads and avoid duplicating scoring logic.
- External clients should stay in `src/lib` and expose typed helper functions.
- Generated docs under `docs/generated` should be updated by scripts, not hand-edited for long-lived facts.
