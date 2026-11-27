# Signal V9 Enhancement & Refinement Reference (`/v9`)

## Purpose

This document is the canonical, value-ranked reference for enhancements, workflow closures, and refinements targeting Signal's default **V9 Flagship Workspace (`/v9`)** across all workspace surfaces:

1. **Market Pulse** (`?view=market`)
2. **Portfolio** (`?view=portfolio`)
3. **Discover** (`?view=discover`)
4. **Stock Research & Watchlist** (`?view=research` / `?view=research&tab=watchlist`)
5. **Learn & Glossary** (`?view=learn`)
6. **Workspace Shell, Navigation & Platform** (`V9Workspace.tsx`, `⌘K`, `Settings`, PWA, Performance)

- **Baseline:** `origin/main` at `d6cd648` (PR #95, 2026-11-27).
- **V9 Entry Point & Shell:** [`src/app/v9/page.tsx`](../src/app/v9/page.tsx) and [`src/components/v9/V9Workspace.tsx`](../src/components/v9/V9Workspace.tsx).
- **Related Roadmaps:**
  - [`ENHANCEMENT_ROADMAP.md`](ENHANCEMENT_ROADMAP.md) — classic V8 `E1`–`E28` history and platform-wide `E3`–`E7` gates.
  - [`NEXT_PRODUCT_ROADMAP.md`](NEXT_PRODUCT_ROADMAP.md) — product invariants ("Product Direction To Preserve") and Tasks 0–8.
  - [`docs/design-concepts/README.md`](design-concepts/README.md) — `v9.0` and `v9.0.1` flagship HTML specs and rollout history.

Every enhancement in this document must preserve the nine product rules in [`NEXT_PRODUCT_ROADMAP.md`](NEXT_PRODUCT_ROADMAP.md#product-direction-to-preserve): descriptive decision support (never trade execution or advice), explicit missing/stale evidence, zero silent mutations, strict privacy boundaries (no holdings/authored text in analytics), explicit browser-local vs. owner-persisted labels, strict currency separation (no combined USD + MYR totals without approved FX evidence), and explicit provider timestamps/provenance.

---

## Current V9 Baseline Inventory (`d6cd648`)

| V9 Sidebar Module | Primary Files | Delivered Capabilities (up to PR #95) |
| :--- | :--- | :--- |
| **Market Pulse** (`?view=market`) | `V9MarketView.tsx`, `V9MarketSummaryRail.tsx`, `V9FearGreedCard.tsx`, `V9MarketInternals.tsx`, `V9MarketCompareStrip.tsx`, `V9MarketToday.tsx` | Luminous semi-circle score arc, 3-column Latest Market Brief, `V9FearGreedCard` under the score with 1Y modal chart and adaptive headlines rail (PR #95), `V9MarketCompareStrip` (US vs. MY & Momentum vs. Contrarian side-by-side, PR #94), Score Anatomy interactive input switches, VIX stress test, 3-check Cross-Market Internals grid (`/api/signals/internals`), and Intraday capture timeline (`What changed today?`). |
| **Portfolio** (`?view=portfolio`) | `V9PortfolioDiscoverViews.tsx`, `V9FactorExposureView.tsx`, `ResearchHoldingsV8.tsx` | Three tabs: `Holdings` (cost-only `ResearchHoldingsV8`), `Factor exposure` (10-factor user-declared matrix with materiality filter and cell detail bar, PR #94), and `Manage portfolio` (`PortfolioRiskCockpit` for owners with batch `/api/research/quotes`; CSV holdings import, transaction import, reconciliation, and covered attribution for guests). |
| **Discover** (`?view=discover`) | `V9PortfolioDiscoverViews.tsx`, `ResearchDiscoverV8.tsx`, `ResearchTrendingV8.tsx`, `ResearchEarlyTrendsV8.tsx`, `ResearchPickerV8.tsx`, `ResearchCalendarV8.tsx`, `ResearchAlertsV8.tsx` | Five embedded tabs: `Trending` (top 10 US Leaders + expandable 10 Contenders), `Early trends` (Emerging & Confirmed stages), `Stock Picker` (configurable rules + browser-local paper baskets measured against VOO), `Calendar` (30D/90D 6-week UTC grid for earnings, reviews & macro releases with `calendarTarget` deep links), and `Alerts` (on-demand `/api/research/alerts` scan + structured trigger coverage). |
| **Stock Research & Watchlist** (`?view=research`) | `V9ResearchView.tsx`, `V9ResearchDetails.tsx`, `ResearchValuationReasoningV9.tsx`, `V9WatchlistView.tsx`, `ResearchPeersV8.tsx`, `ResearchFilingsV8.tsx`, `V9GuestResearchRecovery.tsx` | Interactive SVG `PriceChart` (`1M`/`3M`/`1Y`/`5Y`) with hover scrub, click/drag/keyboard `Measure` span, saved review diamond pins, and up to 2 rebased **Peer Overlays** (PR #94); `Then vs now` due-review banner; 5-item `Research readiness` summary; 4 key metric tiles; 5-year `Annual Financials` (Revenue vs. FCF bars); `Target Entry Guardrail` slider; guest note conflict recovery; inline owner tabs (`Review`, `Cited evidence`, `Monitoring rules`); `Valuation reasoning` scenario range plot; `Peers` table; `Filings` SEC discovery; and full `Watchlist` with `Due this week` queue. |
| **Learn & Glossary** (`?view=learn`) | `LearnDashboardV1.tsx`, `LearnShellV8.tsx`, `LearnMarketMetricLesson.tsx`, `MetricGlossary.tsx` | Embedded `LearnDashboardV1` supporting tracks v0.1 (Valuation), v0.2 (Business), v0.3 (Investment), v0.4 (Trading), and Market positioning lessons (`put-call`, `naaim`) via `?concept=` deep links. |
| **Workspace Shell & Controls** | `V9Workspace.tsx`, `v9-navigation.ts`, `V8CommandPalette.tsx`, `V8Settings.tsx` | Collapsible desktop sidebar, mobile bottom nav, sidebar quick watchlist (first 6 saved stocks), `⌘K` Quick Jump (7 static routes + ticker jump), Light/Dark toggle, unified Settings modal, Today return banner (`returnTo=today`). |

---

## PR Bundle Grouping Rules

To ship faster without sacrificing reviewability or verification discipline under [`AGENTS.md`](../AGENTS.md):

1. **One surface / file cluster per PR:** Related items touching the same components, hooks, and Playwright QA matrix are combined into one PR (`PR-1` through `PR-10`), so lint, production build, visual baselines, and browser suites run once per cohesive bundle instead of 22 separate times.
2. **Isolate risk boundaries:** Scoring/provenance changes (`PR-5`) stay separate from Research UI (`PR-2`), Portfolio hydration (`PR-1`), and Discover (`PR-4`).
3. **Clean optional split points:** Larger bundles (`PR-6`, `PR-7`) note explicit `a`/`b` split boundaries if a diff grows too large during implementation.

---

## Section A: Ranked PR Implementation Plan (`PR-1` → `PR-10`, Highest Value First)

| PR | Value Tier | Combined Items | Bundle Title & Shared Scope | Shared Files | Effort | QA Lane |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **PR-1** | **P0 · Highest** | `V9-E1` + `V9-E8` (part 1) | **Live Portfolio, Factor Matrix & Watchlist Quote Hydration + Holdings Dedup** — Share bounded `POST /api/research/quotes` hydration across `Holdings`, `Factor exposure`, guest `Manage portfolio`, and `Watchlist` (unlocking 52W-high and daily-%-move sorts), and remove the duplicate currency-totals card on `Holdings`. | `V9Workspace.tsx`, `V9PortfolioDiscoverViews.tsx`, `ResearchHoldingsV8.tsx`, `V9FactorExposureView.tsx`, `V9WatchlistView.tsx` | Medium | Standard |
| **PR-2** | **P0 · Highest** | `V9-E2` + `V9-E3` + `V9-E4` + `V9-E20` | **V9 Stock Research Overview Decision Upgrade** — Mount the upcoming Earnings Ticket (`R3`), wire owner `Position Plan` markers onto `Target Entry Guardrail` (`R5`), add `Margins %` and `Cushion & Shares` mode pills to `Annual Financials`, and wrap Overview metric tiles & `V9MarketInternals` labels in `MetricGlossary` (`G3`). | `V9ResearchView.tsx`, `V9MarketInternals.tsx` | Medium | Standard |
| **PR-3** | **P0 · Highest** | `V9-E5` + `V9-E6` | **V9 `⌘K` Universal Local Search & Topbar Attention Loop** — Add missing V9 routes, recent tickers, and local thesis/filings/triggers indexing to `⌘K`, add the `v9.0.1` Topbar Attention Popover (due reviews + on-demand alerts), add sidebar due-review dots, and add a Watchlist `Triggered rules` filter. | `V9Workspace.tsx`, `V8CommandPalette.tsx`, `V9WatchlistView.tsx` | Medium | Standard |
| **PR-4** | **P1 · High** | `V9-E10` + `V9-E11` + `V9-E12` | **V9 Discover Complete Upgrade** — Add sector/risk/hide-saved filters, `Saved` badges, rank deltas & Quick-Peek drawer to `Trending`/`Early trends`; batch Picker basket quotes via `POST /api/research/quotes` with saved local policies; fix Discover header subtitle, add Calendar event filters/trading-day rhythm/dividend overlay, and fix per-ticker trigger links in `ResearchAlertsV8`. | `V9PortfolioDiscoverViews.tsx`, `ResearchTrendingV8.tsx`, `ResearchEarlyTrendsV8.tsx`, `ResearchPickerV8.tsx`, `ResearchCalendarV8.tsx`, `ResearchAlertsV8.tsx` | Medium–Large | Standard |
| **PR-5** | **P1 · High (Trust)** | `V9-E15` + `V9-E18` (part 1: `E4`) | **Market Pulse Freshness Clock, Observation Dating & Forward-Validation Policy** — Add cadence-aware freshness clocks (`M5`) + verified 24h observation dating for fresh news/social aggregates, and author the `E4` Forward-Validation Lab discovery spec freezing `v2.2.0` (note: `E4` can also ship standalone as a tiny LIGHT doc PR). | `indicator-registry.ts`, `market-brief.ts`, `V9MarketView.tsx`, `docs/` | Small–Medium | Standard / High (if shared coverage dates change) |
| **PR-6** | **P1 · High** | `V9-E8` (part 2) + `V9-E9` | **V9 Portfolio Sandbox, Income, FX & Policy Guardrails** — Add the `What-if & Scenarios` tab (`PR-6a`) and expose `Dividend & Cash-Flow Plan`, `FX Currency Decomposition`, and `Policy Concentration Guardrails` (`PR-6b`) inside V9 Portfolio (`E6` Corporate Actions remains demand-gated). | `V9PortfolioDiscoverViews.tsx`, `src/lib/portfolio/*` | Medium–Large (splittable into `PR-6a`/`PR-6b`) | Standard |
| **PR-7** | **P2 · Medium–High** | `V9-E13` + `V9-E14` + `V9-E21` | **V9 Research Deep-Dive & Continuity (`Filings`, `Peers`, `Compare`, `Outcomes`, `Export`, `Backup`)** — Direct `"Cite this filing"` handoff, sector-synced Peer chart overlays & Side-by-Side Compare `W2` (`PR-7a`); plus Decision Outcomes Lab, Evidence Quality Map, Thesis Changes scanner, Decision Packet Export, AES-GCM Backup in `V8Settings`, and guest owner-preview hint (`PR-7b`). | `V9ResearchView.tsx`, `ResearchFilingsV8.tsx`, `ResearchPeersV8.tsx`, `V9WatchlistView.tsx`, `V8Settings.tsx` | Medium–Large (splittable into `PR-7a`/`PR-7b`) | Standard |
| **PR-8** | **P2 · Medium** | `V9-E16` + `V9-E17` + `V9-E18` (part 2: `E5`) | **Market Pulse Visual Calibration, Snapshot Rewind & Prospective Validation** — Add Similar Days as Dots (`M4`) distribution strip, score history turning-point driver callouts + inline Snapshot Rewind (`M2`), and the `E5` Forward-Validation prospective cohort panel (gated on `E4` from `PR-5`). | `V9MarketView.tsx`, `MarketV8Outcomes` | Medium–Large | Standard |
| **PR-9** | **P2 · Medium** | `V9-E19` | **V9 `Learn & Glossary` Fixes, Token Alignment & Glossary Index** — Fix hidden `Market positioning` track in embedded `<select>`, update hardcoded `/main-v8`/`/research-v8` commands to `/v9`, align `--v7-*` tokens with V9, and add a dedicated searchable Glossary index tab. | `LearnDashboardV1.tsx`, `learn-v8.module.css` | Small–Medium | Standard |
| **PR-10** | **P3 · Medium / Hygiene** | `V9-E22` + `V9-E7` | **V9 Platform Speed, `V9HomeView` Resolution, Offline & Accessibility** — Defer non-active US/MY `/api/signals/v2` fetches on Research/Portfolio/Discover/Learn (`Q2`), scope `V9FearGreedCard` cleanly on MY, add cached-reading offline banner (`Q3`), run 200% zoom + screen-reader chart audit (`Q1`), and mount or retire `V9HomeView.tsx`. | `V9Workspace.tsx`, `V9HomeView.tsx`, `V9FearGreedCard.tsx` | Small–Medium | Standard |

---

## Section B: Strict Value-Ranked Item Table (`Rank 1` → `Rank 22`)

Every enhancement sorted strictly from highest value (`Rank 1`) to lesser value (`Rank 22`):

| Rank | ID | PR Bundle | Module | Enhancement / Refinement | Value Tier | Effort | QA Lane |
| ---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **V9-E1** | `PR-1` | **Portfolio & Watchlist** | Shared live batch quote hydration (`POST /api/research/quotes`) across Holdings, Factor Exposure, Guest Manage Portfolio, and Watchlist price sorts | **P0 · Highest** | Small–Medium | Standard |
| **2** | **V9-E2** | `PR-2` | **Stock Research** | Upcoming Earnings Ticket in V9 Research quote header (`R3`) linked to V9 `Discover → Calendar` | **P0 · Highest** | Small | UI-LIGHT / Standard |
| **3** | **V9-E3** | `PR-2` | **Stock Research** | Connect V9 `Target Entry Guardrail` slider to owner's saved `Position Plan` (`R5`) | **P0 · Highest** | Small–Medium | Standard |
| **4** | **V9-E4** | `PR-2` | **Stock Research** | Multi-mode `Annual Financials` card on V9 Overview (`Revenue & FCF` \| `Margins %` \| `Cushion & Shares`) | **P0 · Highest** | Small–Medium | Standard |
| **5** | **V9-E5** | `PR-3` | **Workspace Shell (`⌘K`)** | Universal local research search in V9 `⌘K` palette (missing V9 routes, recent tickers, saved thesis notes, cited filings, monitoring rules) | **P0 · Highest** | Medium | Standard |
| **6** | **V9-E6** | `PR-3` | **Watchlist & Topbar** | Topbar Alerts & Due-Review popover + sidebar due-review dots + Watchlist `Triggered rules` filter | **P0 · Highest** | Medium | Standard |
| **7** | **V9-E8** | `PR-1` / `PR-6` | **Portfolio** | Deduplicate `Holdings` currency-totals cards (`PR-1`) + add `What-if & Scenarios` sandbox tab (`PR-6`) | **P0 · Highest** (dedup) / **P1** (sandbox) | Small–Medium | Standard |
| **8** | **V9-E10** | `PR-4` | **Discover (`Trending` & `Early`)** | Sector/risk/hide-saved filters, inline `"Saved"` badge, hourly rank deltas, and Quick-Peek candidate drawer | **P1 · High** | Medium | Standard |
| **9** | **V9-E15** | `PR-5` | **Market Pulse** | Cadence-aware indicator freshness clock (`M5`) + verified observation dating for fresh 24h news/social aggregates | **P1 · High (Trust)** | Small–Medium | Standard |
| **10** | **V9-E18** | `PR-5` / `PR-8` | **Market Pulse** | Forward-Validation Lab (`E4` frozen `v2.2.0` discovery spec in `PR-5` → `E5` V9 prospective cohort panel in `PR-8`) | **P1 · High (Trust)** | Medium | LIGHT → Standard |
| **11** | **V9-E11** | `PR-4` | **Discover (`Picker`)** | Batch `POST /api/research/quotes` for Picker basket refreshes, saved local Picker policies, and 1-click Watchlist handoff | **P1 · High** | Small–Medium | Standard |
| **12** | **V9-E12** | `PR-4` | **Discover (`Calendar` & `Alerts`)** | Fix Discover header subtitle (add Early trends & Alerts), add Calendar event-kind filters/trading-day rhythm/Dividend overlay, and fix per-ticker trigger links in `ResearchAlertsV8` | **P1 · High** | Small–Medium | Standard |
| **13** | **V9-E9** | `PR-6` | **Portfolio** | Port `Dividend & Cash-Flow Plan`, `FX Currency Decomposition`, and `Policy Concentration Guardrails` into V9 Portfolio (`E6` Corporate Actions demand-gated) | **P1 · High** | Medium–Large | Standard |
| **14** | **V9-E13** | `PR-7` | **Stock Research (`Filings` & `Peers`)** | Direct `"Cite this filing"` action from SEC rows, sector-aware chart peer suggestions synced with `Peers` tab, and Side-by-Side Stock Compare (`W2`) | **P2 · Medium–High** | Medium | Standard |
| **15** | **V9-E14** | `PR-7` | **Stock Research (`Outcomes` & `Changes`)** | Port `Decision Outcomes Lab`, `Evidence Quality Map`, `Thesis Changes` scanner, and Markdown/PDF `Decision Packet` export into V9 Research | **P2 · Medium–High** | Medium–Large | Standard |
| **16** | **V9-E19** | `PR-9` | **Learn & Glossary** | Dedicated searchable Glossary index tab, fix hidden `Market positioning` track option in embedded `<select>`, align V9 tokens, and fix hardcoded `/main-v8` & `/research-v8` commands | **P2 · Medium–High** | Small–Medium | Standard |
| **17** | **V9-E20** | `PR-2` | **Research & Market Polish** | Shared `MetricGlossary` popovers (`G3`) on V9 Overview metric tiles (`P/E`, `FCF Yield`, `Operating Margin`) and `V9MarketInternals` labels | **P2 · Medium** | Small | UI-LIGHT |
| **18** | **V9-E16** | `PR-8` | **Market Pulse** | Similar-score historical distribution strip ("Similar Days as Dots", `M4`) below 7D/30D medians | **P2 · Medium** | Medium | Standard |
| **19** | **V9-E17** | `PR-8` | **Market Pulse** | Score history turning-point driver callouts + one-click historical snapshot scrub rewind (`M2`) | **P2 · Medium** | Medium | Standard |
| **20** | **V9-E21** | `PR-7` | **Settings & Continuity** | Encrypted AES-GCM cross-device Backup/Restore in `V8Settings` + explicit guest-to-owner capability hint on locked owner tabs | **P2 · Medium** | Small–Medium | Standard |
| **21** | **V9-E22** | `PR-10` | **Platform & Performance** | Lazy/route-scoped US & MY signal loading (`Q2`), MY Fear & Greed scoping, offline cached-reading indicator (`Q3`), and 200% zoom + chart screen-reader audit (`Q1`) | **P3 · Medium** | Small–Medium | Standard |
| **22** | **V9-E7** | `PR-10` | **Workspace Shell / Home** | Mount `V9HomeView` as an explicit Morning Briefing view (`?view=home`) or extract `SignalSlot` and retire unmounted 690-line code | **P3 · Medium / Hygiene** | Small–Medium | Standard |

---

## Detailed Module Specifications

### 1. Portfolio Module (`?view=portfolio`)

#### V9-E1 [PR-1] · Shared Live Batch Quote Hydration (`Holdings`, `Factor Exposure`, `Manage Portfolio`, `Watchlist`)
- **Current V9 gap:**
  - [`V9Workspace.tsx`](../src/components/v9/V9Workspace.tsx#L177-L185) calls `reconcilePortfolioHoldings(loaded.snapshot, records ?? [], new Map())` with an empty quote map.
  - [`ResearchHoldingsV8.tsx`](../src/components/v8/ResearchHoldingsV8.tsx#L47-L49) and [`V9FactorExposureView.tsx`](../src/components/v9/V9FactorExposureView.tsx#L57-L61) also pass `new Map()`, forcing cost-only / count-only views (`"Prices not loaded"`).
  - [`V9PortfolioDiscoverViews.tsx`](../src/components/v9/V9PortfolioDiscoverViews.tsx#L42) (`PortfolioManagement`) **already fetches `POST /api/research/quotes`** — but only for `owner`, leaving guests without live quotes on `Manage portfolio` (`PortfolioCoveredAttributionV6`, `PortfolioHoldingsImportV6`), and not sharing those quotes with `Holdings`, `Factor exposure`, or `V9WatchlistView`.
- **Enhancement:**
  - Extract a shared, bounded hook `useV9QuoteBatch(symbols, enabled)` (capped at 50 symbols, abortable, triggered only on `Portfolio` or `Watchlist`).
  - Feed the resulting `Map<string, ResearchQuote>` into `V9Workspace`, `ResearchHoldingsV8`, `V9FactorExposureView`, `PortfolioManagement` (both owner & guest), and `V9WatchlistView`.
  - Unlocks live market values, actual portfolio weights, per-currency unrealized attribution, value-weighted Factor Exposure, and Watchlist sorting by *"Closest to 52W high"* and *"Biggest daily % move"*.
- **Guardrails:** Zero background polling; never combine USD + MYR without explicit FX; never send holdings quantities, accounts, or cost basis in any request.

#### V9-E8 [PR-1 part 1 / PR-6 part 2] · Deduplicate `Holdings` Summary Cards + Add `What-if & Scenarios` Sandbox Tab
- **Current V9 gap:**
  - On `?view=portfolio` (`activeTab === 'holdings'`), [`V9PortfolioDiscoverViews.tsx`](../src/components/v9/V9PortfolioDiscoverViews.tsx#L116-L130) renders a `Currency totals` card (`Cost Basis + Cash`), and immediately below it [`ResearchHoldingsV8.tsx`](../src/components/v8/ResearchHoldingsV8.tsx#L81-L88) renders a **second** `Totals by currency` card with the exact same `Cost basis` and `Cash` numbers.
  - Meanwhile, the pure **Pre-Trade What-If Sandbox** ([`docs/portfolio-what-if-sandbox.md`](portfolio-what-if-sandbox.md)) and **Saved Stress-Scenario Library** (`src/lib/portfolio/simulation.ts`) are only accessible in V6/V7 `/research`.
- **Enhancement:**
  1. **`PR-1`:** Remove the redundant summary block on `Holdings` so each currency sleeve displays one clean summary card (upgraded with live market value and unrealized P/L via `V9-E1`).
  2. **`PR-6`:** Add a fourth tab in `V9PortfolioView`: **`What-if & Scenarios`** (`?view=portfolio&tab=what-if`) allowing up to 20 session-only buy/sell legs and deterministic macro/sector stress illustrations without mutating local holdings.

#### V9-E9 [PR-6] · Portfolio Income (`Dividends`), FX Attribution (`Currency`), Policy Guardrails & Corporate Actions (`E6`)
- **Current V9 gap:** Four existing portfolio/risk capabilities still live exclusively in V6/V7 `/research`:
  - **Dividend & Cash-Flow Plan** ([`docs/dividend-cashflow-calendar.md`](dividend-cashflow-calendar.md), `/api/research/dividends/[symbol]`)
  - **FX / Currency Return Decomposition** (`Currency` workspace — separates stock price return from USD/MYR FX impact for Malaysian investors holding US stocks)
  - **Policy Concentration Limits** (`Policy` workspace — single-name %, sector %, evidence coverage, and review-age advisory guardrails)
  - **Corporate-Action Resolution Assistant (`E6`)** (demand-gated additive split/reverse-split/symbol-change overlays for transaction reconciliation)
- **Enhancement:** Expose `Dividends & Cash Flow`, `FX Impact`, and `Policy Checks` inside V9 Portfolio (as sub-views under `Manage portfolio` or compact collapsible panels) so portfolio users never have to leave `/v9`. Keep `E6` gated on real reconciliation usage per [`NEXT_PRODUCT_ROADMAP.md`](NEXT_PRODUCT_ROADMAP.md#task-7--corporate-action-resolution-assistant).

---

### 2. Discover Module (`?view=discover`)

#### V9-E10 [PR-4] · Discover `Trending` & `Early trends`: Filters, Watchlist Status, Rank Deltas & Quick-Peek Drawer
- **Current V9 gap:**
  - [`ResearchTrendingV8.tsx`](../src/components/v8/ResearchTrendingV8.tsx) and [`ResearchEarlyTrendsV8.tsx`](../src/components/v8/ResearchEarlyTrendsV8.tsx) render flat lists with no sector filter, risk filter (`low`/`medium`), or `"Hide/Highlight saved"` toggle.
  - Even though `/api/research/discovery` already persists hourly leader/contender ranks for score deltas ([`ARCHITECTURE.md`](ARCHITECTURE.md#L173)), V9 Discover rows don't show `"New in Top 20"` or rank-movement pills.
  - Clicking any row navigates completely away from Discover into `Stock Research` — losing scroll position and scan context.
- **Enhancement:**
  1. Add compact filter chips (`All sectors` / sector picker, `Low risk only`, `Hide saved`) and show an inline **`Saved`** badge on tickers already in the user's watchlist.
  2. Surface hourly rank/score deltas (`▲ +2`, `New`) when present in the discovery payload.
  3. Add a **Quick-Peek Drawer** (from [`signal-v9.0-flagship.html`](design-concepts/signal-v9.0-flagship.html)) with a secondary `"Peek"` action on each row showing price, 3M/6M trend, quality breakdown, catalyst date, and a 1-click `"Open full research →"` or `"Save to watchlist"` button.

#### V9-E11 [PR-4] · Discover `Stock Picker`: Batch Quotes, Saved Policies & Watchlist Handoff
- **Current V9 gap:**
  - [`ResearchPickerV8.tsx`](../src/components/v8/ResearchPickerV8.tsx#L63) refreshes paper basket quotes by firing **N individual `GET /api/research/quote/[symbol]` requests** in `Promise.allSettled` instead of calling the existing single batch `POST /api/research/quotes` endpoint.
  - Picker rules (`horizon`, `riskProfile`, `minimumScore`, `pickCount`, `maximumPerSector`) reset on reload; users cannot save named transparent Discovery policies or send a shortlisted candidate directly to Watchlist/Review.
- **Enhancement:**
  1. Migrate Picker basket quote refreshes to a single batched `POST /api/research/quotes` call.
  2. Persist browser-local Picker presets (labeled `"Saved on this device"`) and add a per-row `"Open in Research"` / `"Save to Watchlist"` action.

#### V9-E12 [PR-4] · Discover `Calendar` & `Alerts` Polish
- **Current V9 gap:**
  - [`V9PortfolioDiscoverViews.tsx`](../src/components/v9/V9PortfolioDiscoverViews.tsx#L171) header subtitle reads `"US universe · Trend discovery, Stock Picker & Earnings calendar"` — omitting both **Early trends** and **Alerts** (and implying Calendar/Alerts are US-only even though Calendar includes MY macro releases & MY saved reviews and Alerts monitors MY saved stocks).
  - [`ResearchCalendarV8.tsx`](../src/components/v8/ResearchCalendarV8.tsx) has no event-kind filter pills (`All` | `Earnings` | `Reviews` | `Macro` | `Trending`), no weekend/US-MY market-holiday shading or session status pill (from `src/lib/home-schedule.ts`), and doesn't overlay the user's local **Dividend dates** (`dividend-cashflow-calendar.md`).
  - [`ResearchAlertsV8.tsx`](../src/components/v8/ResearchAlertsV8.tsx#L57-L58) links `"Manage triggers →"` strictly to `records[0]` instead of linking each trigger row to its own `trigger.symbol`'s `tab=monitoring`.
- **Enhancement:**
  1. Update the Discover header subtitle to accurately reflect all 5 tabs and US/MY scope.
  2. Add event-kind filter chips, trading-day weekend/session rhythm, and optional local dividend-date overlay to `ResearchCalendarV8`.
  3. Link every matched/active trigger row in `ResearchAlertsV8` directly to `v9Href('research', { ticker: trigger.symbol, market, tab: 'monitoring' })`.

---

### 3. Stock Research & Watchlist Module (`?view=research`)

#### V9-E2 [PR-2] · Upcoming Earnings Ticket in V9 Research Quote Header (`R3`)
- **Current V9 gap:** [`V9ResearchView.tsx`](../src/components/v9/V9ResearchView.tsx#L981-L1008) (`quoteHead`) does not mount `ResearchEarningsTicket`, even though `V9DiscoverView` already accepts `calendarTarget` deep links.
- **Enhancement:** Render the unconfirmed next-30-day US earnings badge (`"Earnings · Tue 28 Oct · after close"`) inside V9's quote header, linking straight to `v9Href('discover', { discover: 'calendar', ticker: symbol, market, calendarDate })`. Preserve MY unavailability notice and zero-mutation rules.

#### V9-E3 [PR-2] · Connect V9's `Target Entry Guardrail` to the Owner's Saved `Position Plan` (`R5`)
- **Current V9 gap:** [`V9ResearchView.tsx`](../src/components/v9/V9ResearchView.tsx#L718-L721) initializes `targetPrice` to `quote.price * 0.90`, and the guardrail card ([lines 1088–1121](../src/components/v9/V9ResearchView.tsx#L1088-L1121)) ignores `ownerRecord.positionPlan` (`plannedEntryPrice`, `targetZoneLow/High`, `invalidationPrice`).
- **Enhancement:** When a same-currency `positionPlan` exists, initialize from `plannedEntryPrice`, draw labeled pins on the slider track for Entry, Target Zone, and Invalidation/Stop, display distances to each level as the user drags, and offer `"Reset to saved plan"` while keeping drags temporary (*"Exploring · not saved"*).

#### V9-E4 [PR-2] · Multi-Mode `Annual Financials` Card on V9 Overview (`Quality`, `Cushion` & `Dilution`)
- **Current V9 gap:** [`V9ResearchView.tsx`](../src/components/v9/V9ResearchView.tsx#L1049-L1084) plots only 5-year `Revenue vs Free Cash Flow`, hiding margin compression, balance-sheet leverage, and share dilution behind the `Financials & valuation` tab.
- **Enhancement:** Add a 3-pill toggle on the V9 Overview `Annual Financials` card (`Revenue & FCF` | `Margins %` | `Cushion & Shares`) reusing `annualMarginSeries`, `annualMarginComparison`, `balanceSheetCushion`, and `annualShareSeries` from [`src/lib/research/reading-display.ts`](../src/lib/research/reading-display.ts).

#### V9-E13 [PR-7] · `Filings` Direct Citation, Synced `Peers` Overlay & Side-by-Side Stock Compare (`W2`)
- **Current V9 gap:**
  - In [`ResearchFilingsV8.tsx`](../src/components/v8/ResearchFilingsV8.tsx#L53-L56), each official SEC filing row links out to SEC EDGAR, but has no `"Cite this filing →"` button pre-filling accession number, form, filing date, and URL in the `Cited evidence` tab.
  - In [`V9ResearchView.tsx`](../src/components/v9/V9ResearchView.tsx#L825-L836), chart peer overlay suggestions fall back to a hardcoded list (`MSFT`, `NVDA`, `AAPL`, `VOO`) instead of preferring same-sector saved stocks, and the `Peers` tab (`ResearchPeersV8`) cannot pin a peer onto the Overview chart.
  - Users cannot view two stocks side-by-side across margins, balance-sheet cushion, and valuation multiples (`W2`).
- **Enhancement:**
  1. Add `"Cite filing"` handoff params from `ResearchFilingsV8` → `?view=research&tab=evidence`.
  2. Prefer same-industry/sector watchlist peers for `PriceChart` overlays and add an `"Overlay on chart"` action inside `ResearchPeersV8`.
  3. Add a currency-safe 2-stock Side-by-Side Compare view (`W2`) inside Research.

#### V9-E14 [PR-7] · Port `Decision Outcomes`, `Evidence Quality Map`, `Thesis Changes` & `Decision Packet Export` into V9 Research
- **Current V9 gap:** Four high-trust Research workflows from V7 still require leaving `/v9` for legacy `/research`:
  - **Decision Outcomes Lab** (`Outcomes` — immutable review history resolution + act-or-pass 1M/3M/6M/1Y benchmark-relative cohorts)
  - **Evidence Quality Map** (`Evidence` — 7-rule field classification: supported / stale / conflicting / assumption / missing)
  - **Thesis Changes Scanner** (`Changes` — bounded 2-at-a-time scan comparing live Yahoo/SEC facts against frozen accepted evidence)
  - **Decision Packet Export** (`Export` — timestamped Markdown / Print-to-PDF snapshot of thesis + latest Market Pulse reading)
- **Enhancement:**
  - Add an `"Export decision packet"` action on saved stocks in `V9ResearchView`.
  - Add a compact `"Watchlist Health"` or `"Insights"` sub-tab on `V9WatchlistView` hosting `Thesis Changes`, `Evidence Quality`, and `Decision Outcomes` so the full investment review lifecycle stays inside `/v9`.

---

### 4. Market Pulse Module (`?view=market`)

#### V9-E15 [PR-5] · Cadence-Aware Indicator Freshness Clock (`M5`) & News/Social Observation Dating
- **Current V9 gap:**
  - In [`src/lib/market-brief.ts`](../src/lib/market-brief.ts), live US social and MY news aggregates carry retrieval timestamps rather than verified observation dates, capping almost every live brief at **`Limited assessment`**.
  - Weekly inputs (`AAII`, `NAAIM`) display raw timestamps without explaining their release schedule (*"Published weekly on Thursdays"*).
- **Enhancement:**
  1. Add explicit expected release cadences in [`src/lib/indicator-registry.ts`](../src/lib/indicator-registry.ts) and render `"Observed [Date] · Published weekly (Thu)"` inside V9 evidence rows and inspectors.
  2. Propagate the newest eligible article/post publication timestamp (`news_evidence.latest_published_at` / `evaluated_at`) when fresh 24h items exist so complete live feeds can earn verified observation dating.

#### V9-E16 [PR-8] · Similar-Score Historical Distribution Strip ("Similar Days as Dots", `M4`)
- **Current V9 gap:** `MarketV8Outcomes` displays 7D and 30D median returns and hit rates, hiding outcome spread and downside tail frequency.
- **Enhancement:** Render a compact horizontal dot strip of each eligible historical observation in the current score zone (colored by sign with an all-score median reference tick and hover/tap date readout), keeping all overlapping-history and non-prediction disclaimers intact.

#### V9-E17 [PR-8] · Score History Turning-Point Callouts & Historical Snapshot Scrub Rewind (`M2`)
- **Current V9 gap:** V9's smooth score history chart lets users hover historical points, and `Detailed view` opens replay separately, but the chart itself doesn't explain *why* major inflections happened or rewind the page's evidence rows inline.
- **Enhancement:**
  1. Annotate the 1–2 largest daily inflections on `1M`/`3M` views with their primary driver delta (e.g., `"VIX +4.2 pts"`).
  2. Clicking an observed historical point previews that snapshot's exact breakdown under a persistent banner: **`"Viewing historical snapshot: 12 Sep 2026 · Return to latest"`** (reusing `/api/signals/replay`).

#### V9-E18 [PR-5 part 1: `E4` / PR-8 part 2: `E5`] · Forward-Validation Lab (`E4` Discovery Spec → `E5` V9 Calibration Panel)
- **Current V9 gap:** Historical calibration includes backfilled/gap-repaired rows and marks out-of-sample status unavailable ([`docs/signal-scoring.md`](signal-scoring.md#L121)).
- **Enhancement:**
  1. **`PR-5` (`E4`):** Author the discovery spec freezing `v2.2.0` model version, eligible configurations, 7D/30D horizons, VOO/KLCI benchmarks, and drift rules before collecting prospective cohorts.
  2. **`PR-8` (`E5`):** Deliver the prospective out-of-sample cohort table strictly separated from historical/backfilled rows in V9 Market Pulse.

---

### 5. Learn & Glossary Module (`?view=learn`)

#### V9-E19 [PR-9] · V9 `Learn & Glossary` Integration Fixes & Dedicated Glossary Index
- **Current V9 gap (verified in [`LearnDashboardV1.tsx`](../src/components/learn/LearnDashboardV1.tsx)):**
  1. **Hidden Track Bug:** When `embedded` in `/v9?view=learn` ([line 109](../src/components/learn/LearnDashboardV1.tsx#L109)), `{release === 'market' && <option value="market">Market positioning metrics</option>}` hides the Market Positioning track from the Track dropdown unless the user arrived from a `Put/Call` or `NAAIM` deep link.
  2. **Legacy Route Commands:** [Lines 81–82](../src/components/learn/LearnDashboardV1.tsx#L81-L82) still hardcode `/main-v8` and `/research-v8` instead of `/v9`.
  3. **Missing Glossary Index:** The V9 sidebar footer names the link **`"Learn & Glossary"`** ([`V9Workspace.tsx`](../src/components/v9/V9Workspace.tsx#L344)), yet `/v9?view=learn` has no searchable Glossary view listing all Signal indicators, valuation ratios, and portfolio metrics in one place.
  4. **Token Mismatch:** `LearnDashboardV1` uses `--v7-surface` / `--v7-border` classes inside the V9 Midnight Graphite / Calm Monochrome shell.
- **Enhancement:**
  1. Always expose `Market positioning metrics` in the embedded Track selector and route internal Learn commands to `/v9` when `v9` context is present.
  2. Add a **`Glossary`** tab/view inside `/v9?view=learn` indexing every Signal Market indicator, Cross-Market Internal, Valuation ratio, and Research/Portfolio term with direct links back to live V9 screens.
  3. Align embedded Learn surface/border/accent tokens with V9's CSS variables.

#### V9-E20 [PR-2] · Shared `MetricGlossary` Popovers (`G3`) Across V9 Research Overview & Internals
- **Current V9 gap:** [`V9ResearchView.tsx`](../src/components/v9/V9ResearchView.tsx#L1025-L1046) renders `P/E Ratio`, `FCF Yield`, `Operating Margin`, and `Revenue Growth` as plain `<small>` text instead of wrapping them in `MetricGlossary` (`src/components/v8/MetricGlossary.tsx`), and [`V9MarketInternals.tsx`](../src/components/v9/V9MarketInternals.tsx) has no inline glossary popovers for credit spreads or equal-weight breadth.
- **Enhancement:** Wrap V9 Research Overview metric labels and V9 Market Internals headers in `MetricGlossary` with `"Learn more →"` deep links into `/v9?view=learn&concept=...`.

---

### 6. Workspace Shell, Cross-Module Continuity & Platform (`V9Workspace.tsx`)

#### V9-E5 [PR-3] · Universal Local Research Search in V9 `⌘K` Command Palette
- **Current V9 gap:** [`V8CommandPalette.tsx`](../src/components/v8/V8CommandPalette.tsx) only lists 7 static destinations (missing `Portfolio`, `Factor exposure`, `Discover · Early trends`, `Discover · Alerts`) and a basic ticker jump. It does not search saved company names, thesis notes, cited filings, or monitoring rules.
- **Enhancement:**
  - Add missing V9 static routes (`Portfolio`, `Factor exposure`, `Discover · Early trends`, `Discover · Alerts`) and browser-local recent tickers.
  - Pass loaded `records` into `V8CommandPalette` to build a bounded, 100% browser-local index over company names, thesis fields, accepted evidence, primary-document citations, and monitoring rules — jumping straight to `/v9?view=research&ticker=...&tab=review|evidence|monitoring`.

#### V9-E6 [PR-3] · Topbar Alerts & Due-Review Popover + Sidebar Attention Badges
- **Current V9 gap:**
  - [`signal-v9.0.1-flagship.html`](design-concepts/signal-v9.0.1-flagship.html) specifies a **top-bar Alerts popover**, which is not yet built in [`V9Workspace.tsx`](../src/components/v9/V9Workspace.tsx#L366-L381).
  - The sidebar Watchlist (`sideWatch`) shows no overdue-review dot or triggered-alert indicator, and `V9WatchlistView` has no quick `"Check triggered rules"` filter without switching to `Discover → Alerts`.
- **Enhancement:**
  - Add a compact, restrained **Attention Popover** in the V9 topbar (beside Theme & Settings) summarizing already-loaded overdue/due-this-week reviews and on-demand `/api/research/alerts` matches (never firing unsolicited background polls).
  - Show a subtle due-review dot on matching rows in the sidebar quick watchlist and add a `Triggered rules` filter inside `V9WatchlistView`.

#### V9-E7 [PR-10] · Resolve `V9HomeView` (`Morning Briefing` Hub vs. `Market Pulse` Default)
- **Current V9 gap:** [`src/components/v9/V9HomeView.tsx`](../src/components/v9/V9HomeView.tsx) (690 lines) implements a timezone-aware (`home-schedule.ts`) Morning Briefing combining US + MY pulse cards, Today's Focus queue, Watchlist Pulse, and Portfolio summary — but [`V9Workspace.tsx`](../src/components/v9/V9Workspace.tsx#L55) aliases `?view=home` to `market`, leaving it unmounted.
- **Enhancement:** Decide explicitly whether to mount `V9HomeView` as an optional `Morning Briefing` view/pill or extract `SignalSlot` to `v9-navigation.ts` and retire the dead code.

#### V9-E21 [PR-7] · Encrypted Backup/Sync in `V8Settings` & Owner Capability Preview
- **Current V9 gap:** Copy/paste AES-GCM encrypted cross-device backup (`Backup` workspace) is only in V7 `/research`; `V8Settings` only offers guest JSON export/clear. Also, guests viewing `V9ResearchView` do not see what `Review`, `Cited evidence`, and `Monitoring rules` unlock in owner mode.
- **Enhancement:** Add an **Encrypted Backup & Restore** section inside `V8Settings` for unlocked owners and a subtle non-intrusive capability note for guests.

#### V9-E22 [PR-10] · Platform Speed (`Q2`), Offline Cached Reading (`Q3`) & Accessibility Audit (`Q1`)
- **Current V9 gap:**
  - [`V9Workspace.tsx`](../src/components/v9/V9Workspace.tsx#L104-L122) eagerly fetches **both US and MY `/api/signals/v2`** on every `/v9` mount, even when the user opens `/v9?view=research&ticker=AAPL` or `/v9?view=learn` — and [`V9FearGreedCard.tsx`](../src/components/v9/V9FearGreedCard.tsx) fetches US CNN Fear & Greed even on `Malaysia · Bursa`.
  - No explicit cached-reading offline banner (`Q3`) or formal 200%-zoom + screen-reader SVG chart table audit across all V9 screens (`Q1`).
- **Enhancement:**
  - Defer non-active market signal fetches until `Market Pulse` or `Compare` is opened (keeps initial Research/Portfolio/Learn loads fast).
  - Scope `V9FearGreedCard` clearly on MY or make it collapsible context on MY.
  - Run a focused `Q1` accessibility pass (200% zoom at 1280px, keyboard focus order across sidebar/tabs/popovers, chart text alternatives) and add an explicit cached-timestamp offline banner (`Q3`).

---

## How to Execute

Start from `PR-1` and work one PR bundle at a time per [`AGENTS.md`](../AGENTS.md):

- **`Proceed with PR-1`** — Live Portfolio, Factor Matrix & Watchlist Hydration + Holdings Dedup (`V9-E1` + `V9-E8` part 1)
- **`Proceed with PR-2`** — V9 Stock Research Overview Decision Upgrade (`V9-E2` + `V9-E3` + `V9-E4` + `V9-E20`)
- **`Proceed with PR-3`** — V9 `⌘K` Universal Local Search & Topbar Attention Loop (`V9-E5` + `V9-E6`)
- Continue sequentially through `PR-4`–`PR-10` (splitting `PR-6a`/`PR-6b` or `PR-7a`/`PR-7b` if needed to keep PR diffs tight).
