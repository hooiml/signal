# Architecture

Signal is a Next.js App Router application for market signal dashboards. The app combines live market data, social/news sentiment, institutional indicators, and persisted snapshots into a decision-support UI.

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
- `docs`: repository knowledge that agents should use as the system of record.
- `scripts/harness`: mechanical checks that keep the repo legible to agents.

## Signal Flow

1. `src/components/v2/SignalDashboard.tsx` reads dashboard config from `useSignalConfig`.
2. The dashboard calls `/api/signals/v2` with `market`, `mode`, and `enableSocial`.
3. `src/app/api/signals/v2/route.ts` validates request parameters and calls `getSmartSignal`.
4. `src/lib/signal.ts` orchestrates market-data, social/news, institutional, and snapshot work.
5. `src/lib/sentiment-calculator-v2.ts` normalizes active indicators into a `MarketSignal`.
6. UI components render score, tier, confidence, source coverage, articles, and component details.

## Data Sources

- Yahoo Finance helpers provide VIX, indices, stocks, quotes, and Malaysia currency-volatility proxy data.
- RSS feeds and Reddit helpers provide contextual news and retail sentiment inputs.
- StockTwits is used for US social sentiment.
- Institutional data is loaded through `institutional-service`.
- Snapshot history is persisted through `src/lib/db.ts` when the signal route runs.

## Architecture Rules

- API routes must validate external parameters before calling services.
- Data parsing and normalization belong near the boundary where the data enters the app.
- Scoring rules belong in calculator/service modules, not in UI components.
- UI components should render typed signal payloads and avoid duplicating scoring logic.
- External clients should stay in `src/lib` and expose typed helper functions.
- Generated docs under `docs/generated` should be updated by scripts, not hand-edited for long-lived facts.

