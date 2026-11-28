# Signal V9 Enhancement & Refinement Reference (`/v9`)

## Purpose

This document is the canonical, value-ranked reference for enhancements, workflow closures, and refinements targeting Signal's default **V9 Flagship Workspace (`/v9`)** across all workspace surfaces:

1. **Market Pulse** (`?view=market`)
2. **Portfolio** (`?view=portfolio`)
3. **Discover** (`?view=discover`)
4. **Stock Research & Watchlist** (`?view=research` / `?view=research&tab=watchlist`)
5. **Learn & Glossary** (`?view=learn`)
6. **Workspace Shell, Navigation & Platform** (`V9Workspace.tsx`, `⌘K`, `Settings`, PWA, Performance)

- **Original planning baseline** `d6cd648` (PR #95, 2026-11-27). Delivery status verified against `main` at `0d41d1c` on 2026-11-28.
- **V9 Entry Point & Shell:** [`src/app/v9/page.tsx`](../src/app/v9/page.tsx) and [`src/components/v9/V9Workspace.tsx`](../src/components/v9/V9Workspace.tsx).
- **Related Roadmaps:**
  - [`ENHANCEMENT_ROADMAP.md`](ENHANCEMENT_ROADMAP.md) — classic V8 `E1`–`E28` history and platform-wide `E3`–`E7` gates.
  - [`NEXT_PRODUCT_ROADMAP.md`](NEXT_PRODUCT_ROADMAP.md) — product invariants ("Product Direction To Preserve") and Tasks 0–8.
  - [`docs/design-concepts/README.md`](design-concepts/README.md) — `v9.0` and `v9.0.1` flagship HTML specs and rollout history.

Every enhancement in this document must preserve the nine product rules in [`NEXT_PRODUCT_ROADMAP.md`](NEXT_PRODUCT_ROADMAP.md#product-direction-to-preserve): descriptive decision support (never trade execution or advice), explicit missing/stale evidence, zero silent mutations, strict privacy boundaries (no holdings/authored text in analytics), explicit browser-local vs. owner-persisted labels, strict currency separation (no combined USD + MYR totals without approved FX evidence), and explicit provider timestamps/provenance.

---

## V9 inventory before roadmap PR-1 (`d6cd648`)

| V9 Sidebar Module | Primary Files | Delivered Capabilities (up to PR #95) |
| :--- | :--- | :--- |
| **Market Pulse** (`?view=market`) | `V9MarketView.tsx`, `V9MarketSummaryRail.tsx`, `V9FearGreedCard.tsx`, `V9MarketInternals.tsx`, `V9MarketCompareStrip.tsx`, `V9MarketToday.tsx` | Luminous semi-circle score arc, 3-column Latest Market Brief, `V9FearGreedCard` under the score with 1Y modal chart and adaptive headlines rail (PR #95), `V9MarketCompareStrip` (US vs. MY & Momentum vs. Contrarian side-by-side, PR #94), Score Anatomy interactive input switches, VIX stress test, 3-check Cross-Market Internals grid (`/api/signals/internals`), and Intraday capture timeline (`What changed today?`). |
| **Portfolio** (`?view=portfolio`) | `V9PortfolioDiscoverViews.tsx`, `V9FactorExposureView.tsx`, `ResearchHoldingsV8.tsx` | Three tabs: `Holdings` (cost-only `ResearchHoldingsV8`), `Factor exposure` (10-factor user-declared matrix with materiality filter and cell detail bar, PR #94), and `Manage portfolio` (`PortfolioRiskCockpit` for owners with batch `/api/research/quotes`; CSV holdings import, transaction import, reconciliation, and covered attribution for guests). |
| **Discover** (`?view=discover`) | `V9PortfolioDiscoverViews.tsx`, `ResearchDiscoverV8.tsx`, `ResearchTrendingV8.tsx`, `ResearchEarlyTrendsV8.tsx`, `ResearchPickerV8.tsx`, `ResearchCalendarV8.tsx`, `ResearchAlertsV8.tsx` | Five embedded tabs: `Trending` (top 10 US Leaders + expandable 10 Contenders), `Early trends` (Emerging & Confirmed stages), `Stock Picker` (configurable rules + browser-local paper baskets measured against VOO), `Calendar` (30D/90D 6-week UTC grid for earnings, reviews & macro releases with `calendarTarget` deep links), and `Alerts` (on-demand `/api/research/alerts` scan + structured trigger coverage). |
| **Stock Research & Watchlist** (`?view=research`) | `V9ResearchView.tsx`, `V9ResearchDetails.tsx`, `ResearchValuationReasoningV9.tsx`, `V9WatchlistView.tsx`, `ResearchPeersV8.tsx`, `ResearchFilingsV8.tsx`, `V9GuestResearchRecovery.tsx` | Interactive SVG `PriceChart` (`1M`/`3M`/`1Y`/`5Y`) with hover scrub, click/drag/keyboard `Measure` span, saved review diamond pins, and up to 2 rebased **Peer Overlays** (PR #94); `Then vs now` due-review banner; 5-item `Research readiness` summary; 4 key metric tiles; 5-year `Annual Financials` (Revenue vs. FCF bars); `Target Entry Guardrail` slider; guest note conflict recovery; inline owner tabs (`Review`, `Cited evidence`, `Monitoring rules`); `Valuation reasoning` scenario range plot; `Peers` table; `Filings` SEC discovery; and full `Watchlist` with `Due this week` queue. |
| **Learn & Glossary** (`?view=learn`) | `LearnDashboardV1.tsx`, `LearnShellV8.tsx`, `LearnMarketMetricLesson.tsx`, `MetricGlossary.tsx` | Embedded `LearnDashboardV1` supporting tracks v0.1 (Valuation), v0.2 (Business), v0.3 (Investment), v0.4 (Trading), and Market positioning lessons (`put-call`, `naaim`) via `?concept=` deep links. |
| **Workspace Shell & Controls** | `V9Workspace.tsx`, `v9-navigation.ts`, `V8CommandPalette.tsx`, `V8Settings.tsx` | Collapsible desktop sidebar, mobile bottom nav, sidebar quick watchlist (first 6 saved stocks), `⌘K` Quick Jump (7 static routes + ticker jump), Light/Dark toggle, unified Settings modal, Today return banner (`returnTo=today`). |

---

## Delivery status and follow-ups before PR-5

Roadmap PR-1 ([#98](https://github.com/hooiml/signal/pull/98)), PR-2 ([#99](https://github.com/hooiml/signal/pull/99)), PR-3 ([#100](https://github.com/hooiml/signal/pull/100)) and PR-4 ([#101](https://github.com/hooiml/signal/pull/101)) merged into `main`. PR-5 through PR-10 are planned. Complete the following three follow-ups in order.

| Follow-up | Scope | Acceptance |
| --- | --- | --- |
| **PR-1a · Portfolio quote currency** | Require a confirmed match between the quote and holding currencies before valuing a holding. Apply the check in `useV9QuoteBatch` for Holdings and Factor exposure, and in Manage portfolio wherever V6 consumers build prices from `items`, including `PortfolioHoldingsImportV6`. | Exercise matching, missing and mismatched currencies in all three views, including owner and guest Manage portfolio. Only a matching quote contributes to market value, P/L, weights and factor exposure. Other holdings remain visible as unpriced. |
| **PR-3/4a · Cross-market identity** | Use a dedicated PR for `(market, symbol)` across `calendar-input.ts` and `ResearchCalendarV8`, and through `alert-request.ts`, the alert service and `research-alert.ts` response types. Carry that identity through `useV9AlertsScan`, `ResearchAlertsV8`, `V9AttentionPopover` and `V9WatchlistView`. | Save the same symbol in US and MY with distinct rules. Assert the actual Calendar request and returned events include both listings. Trigger only one rule and verify its market in the Alerts response, filtered Watchlist row and monitoring link. Reject duplicate copies of the same listing. |
| **PR-3/4b · Guest search and Discover badges** | Open a guest note match on the stock’s Overview, where the guest can read and edit it. Keep owner thesis matches linked to Review. Label the available Discover changes `1W rank` and `1D score`. | Select a search hit in each workspace. Show `New` only when a usable previous scan of the same ranked list omitted the stock. Test prior membership, a genuine new entrant, first scan and unavailable history. Omit the badge when the baseline is missing. |

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
| **PR-9** | **P2 · Medium** | `V9-E19` | **V9 `Learn & Glossary` Fixes, Token Alignment & Glossary Index** — Fix hidden `Market positioning` track in embedded `<select>`, verify embedded V9 palette routes, align embedded tokens with V9, and add a dedicated searchable Glossary index tab. | `LearnDashboardV1.tsx`, `learn-v8.module.css` | Small–Medium | Standard |
| **PR-10** | **P3 · Medium / Hygiene** | `V9-E22` + `V9-E7` | **V9 Platform Speed, `V9HomeView` Resolution, Offline & Accessibility** — Defer non-active US/MY `/api/signals/v2` fetches on Research/Portfolio/Discover/Learn (`Q2`), scope `V9FearGreedCard` cleanly on MY, decide offline reading lifetime (`Q3`), run 200% zoom + screen-reader chart audit (`Q1`), and mount or retire `V9HomeView.tsx`. | `V9Workspace.tsx`, `V9HomeView.tsx`, `V9FearGreedCard.tsx` | Small–Medium | Standard |

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
| **8** | **V9-E10** | `PR-4` | **Discover (`Trending` & `Early`)** | Sector/risk/hide-saved filters, inline `"Saved"` badge, period-labeled rank and score deltas, and Quick-Peek candidate drawer | **P1 · High** | Medium | Standard |
| **9** | **V9-E15** | `PR-5` | **Market Pulse** | Cadence-aware indicator freshness clock (`M5`) + verified observation dating for fresh 24h news/social aggregates | **P1 · High (Trust)** | Small–Medium | Standard |
| **10** | **V9-E18** | `PR-5` / `PR-8` | **Market Pulse** | Forward-Validation Lab (`E4` frozen `v2.2.0` discovery spec in `PR-5` → `E5` V9 prospective cohort panel in `PR-8`) | **P1 · High (Trust)** | Medium | LIGHT → Standard |
| **11** | **V9-E11** | `PR-4` | **Discover (`Picker`)** | Batch `POST /api/research/quotes` for Picker basket refreshes, saved local Picker policies, and 1-click Watchlist handoff | **P1 · High** | Small–Medium | Standard |
| **12** | **V9-E12** | `PR-4` | **Discover (`Calendar` & `Alerts`)** | Fix Discover header subtitle (add Early trends & Alerts), add Calendar event-kind filters/trading-day rhythm/Dividend overlay, and fix per-ticker trigger links in `ResearchAlertsV8` | **P1 · High** | Small–Medium | Standard |
| **13** | **V9-E9** | `PR-6` | **Portfolio** | Port `Dividend & Cash-Flow Plan`, `FX Currency Decomposition`, and `Policy Concentration Guardrails` into V9 Portfolio (`E6` Corporate Actions demand-gated) | **P1 · High** | Medium–Large | Standard |
| **14** | **V9-E13** | `PR-7` | **Stock Research (`Filings` & `Peers`)** | Direct `"Cite this filing"` action from SEC rows, sector-aware chart peer suggestions synced with `Peers` tab, and Side-by-Side Stock Compare (`W2`) | **P2 · Medium–High** | Medium | Standard |
| **15** | **V9-E14** | `PR-7` | **Stock Research (`Outcomes` & `Changes`)** | Port `Decision Outcomes Lab`, `Evidence Quality Map`, `Thesis Changes` scanner, and Markdown/PDF `Decision Packet` export into V9 Research | **P2 · Medium–High** | Medium–Large | Standard |
| **16** | **V9-E19** | `PR-9` | **Learn & Glossary** | Dedicated searchable Glossary index tab, fix hidden `Market positioning` track option in embedded `<select>`, align embedded V9 tokens and verify palette routes | **P2 · Medium–High** | Small–Medium | Standard |
| **17** | **V9-E20** | `PR-2` | **Research & Market Polish** | Shared `MetricGlossary` popovers (`G3`) on V9 Overview metric tiles (`P/E`, `FCF Yield`, `Operating Margin`) and `V9MarketInternals` labels | **P2 · Medium** | Small | UI-LIGHT |
| **18** | **V9-E16** | `PR-8` | **Market Pulse** | Similar-score historical distribution strip ("Similar Days as Dots", `M4`) below 7D/30D medians | **P2 · Medium** | Medium | Standard |
| **19** | **V9-E17** | `PR-8` | **Market Pulse** | Score history turning-point driver callouts + one-click historical snapshot scrub rewind (`M2`) | **P2 · Medium** | Medium | Standard |
| **20** | **V9-E21** | `PR-7` | **Settings & Continuity** | Encrypted AES-GCM cross-device Backup/Restore in `V8Settings` + explicit guest-to-owner capability hint on locked owner tabs | **P2 · Medium** | Small–Medium | Standard |
| **21** | **V9-E22** | `PR-10` | **Platform & Performance** | Lazy/route-scoped US & MY signal loading (`Q2`), MY Fear & Greed scoping, offline reading lifetime and timestamps (`Q3`), and 200% zoom + chart screen-reader audit (`Q1`) | **P3 · Medium** | Small–Medium | Standard |
| **22** | **V9-E7** | `PR-10` | **Workspace Shell / Home** | Mount `V9HomeView` as an explicit Morning Briefing view (`?view=home`) or extract `SignalSlot` and retire unmounted 690-line code | **P3 · Medium / Hygiene** | Small–Medium | Standard |

---

## Detailed Module Specifications

### 1. Portfolio Module (`?view=portfolio`)

#### V9-E1 [PR-1] · Shared Live Batch Quote Hydration (`Holdings`, `Factor Exposure`, `Manage Portfolio`, `Watchlist`)

PR-1 merged shared, abortable batch quotes for Holdings, Factor exposure, Manage portfolio and Watchlist. The request includes at most 50 saved listing identities. Unmatched imported symbols, quantities, accounts and cost basis stay local. Holdings reports priced coverage per currency and Watchlist supports 52-week-high proximity and daily-move sorting. PR-1a closes the currency check across all valuation paths.

#### V9-E8 [PR-1 part 1 / PR-6 part 2] · Deduplicate `Holdings` Summary Cards + Add `What-if & Scenarios` Sandbox Tab

PR-1 merged the single summary per currency. Owners can already open the [What-if sandbox](portfolio-what-if-sandbox.md) through `PortfolioRiskCockpitV6` in Manage portfolio.

For PR-6, expose `?view=portfolio&tab=what-if` to owners and guests using their browser’s accepted holdings. Reuse `PortfolioWhatIfSandboxV6` and give owners one sandbox entry without mounting a second copy in Manage portfolio. Keep the 20-leg simulation session-only and stress illustrations deterministic. Test owner and guest access, deep-link reload and reset. Holdings without an eligible saved-stock quote stay unpriced and count toward missing coverage. Keep unmatched imported symbols out of quote requests.

#### V9-E9 [PR-6] · Portfolio Income (`Dividends`), FX Attribution (`Currency`), Policy Guardrails & Corporate Actions (`E6`)

- **Portfolio scope** Three existing workflows need V9 entry points. Corporate-action resolution remains demand-gated.
  - **Dividend & Cash-Flow Plan** ([`docs/dividend-cashflow-calendar.md`](dividend-cashflow-calendar.md), `/api/research/dividends/[symbol]`)
  - **FX / Currency Return Decomposition** (`Currency` workspace — separates stock price return from USD/MYR FX impact for Malaysian investors holding US stocks)
  - **Policy Concentration Limits** (`Policy` workspace — single-name %, sector %, evidence coverage, and review-age advisory guardrails)
  - **Corporate-Action Resolution Assistant (`E6`)** (demand-gated additive split/reverse-split/symbol-change overlays for transaction reconciliation)
- **Enhancement:** Expose `Dividends & Cash Flow`, `FX Impact`, and `Policy Checks` inside V9 Portfolio (as sub-views under `Manage portfolio` or compact collapsible panels) so portfolio users never have to leave `/v9`. Keep `E6` gated on real reconciliation usage per [`NEXT_PRODUCT_ROADMAP.md`](NEXT_PRODUCT_ROADMAP.md#task-7--corporate-action-resolution-assistant).

---

### 2. Discover Module (`?view=discover`)

#### V9-E10 [PR-4] · Discover `Trending` & `Early trends`: Filters, Watchlist Status, Rank Deltas & Quick-Peek Drawer

PR-4 merged sector, low-risk and hide-saved filters, Saved badges, and the Quick-Peek drawer for Trending and Early trends. The drawer shows price, 3M/6M trend, quality and catalyst details, with actions to open research or save the stock. PR-3/4b corrects the badge periods and the evidence required to label a stock new.

#### V9-E11 [PR-4] · Discover `Stock Picker`: Batch Quotes, Saved Policies & Watchlist Handoff

PR-4 merged bounded `POST /api/research/quotes` basket refreshes, named browser-local Picker presets labeled “Saved on this device,” and per-row research and Watchlist actions.

#### V9-E12 [PR-4] · Discover `Calendar` & `Alerts` Polish

PR-4 merged the five-tab Discover subtitle, Calendar event filters, weekend/session cues, optional local dividend dates and per-trigger monitoring links. PR-3/4a covers same-symbol listings across US and MY in both Calendar and Alerts.

---

### 3. Stock Research & Watchlist Module (`?view=research`)

#### V9-E2 [PR-2] · Upcoming Earnings Ticket in V9 Research Quote Header (`R3`)

PR-2 merged the unconfirmed next-30-day US earnings ticket in the quote header. It opens the selected date in V9 Discover Calendar. MY listings show the coverage notice.

#### V9-E3 [PR-2] · Connect V9's `Target Entry Guardrail` to the Owner's Saved `Position Plan` (`R5`)

PR-2 merged same-currency planned entry, invalidation, average cost and current-price markers. Dragging previews distances, and “Reset to saved plan” restores the entry. Keep `targetBuyZone` as authored free text below the slider. Numeric pins cover only structured prices.

#### V9-E4 [PR-2] · Multi-Mode `Annual Financials` Card on V9 Overview (`Quality`, `Cushion` & `Dilution`)

PR-2 merged the `Revenue & FCF`, `Margins %` and `Cushion & Shares` modes in the Overview Annual Financials card.

#### V9-E13 [PR-7] · `Filings` Direct Citation, Synced `Peers` Overlay & Side-by-Side Stock Compare (`W2`)

- **Current V9 gap:**
  - In [`ResearchFilingsV8.tsx`](../src/components/v8/ResearchFilingsV8.tsx#L53-L56), each official SEC filing row links out to SEC EDGAR, but has no `"Cite this filing →"` button pre-filling accession number, form, filing date, and URL in the `Cited evidence` tab.
  - In [`V9ResearchView.tsx`](../src/components/v9/V9ResearchView.tsx#L825-L836), chart peer overlay suggestions fall back to a hardcoded list (`MSFT`, `NVDA`, `AAPL`, `VOO`) instead of preferring same-sector saved stocks, and the `Peers` tab (`ResearchPeersV8`) cannot pin a peer onto the Overview chart.
  - Users cannot view two stocks side-by-side across margins, balance-sheet cushion, and valuation multiples (`W2`).
- **Enhancement:**
  1. For an owner’s saved stock, “Cite this filing” opens `tab=evidence` with the selected SEC accession, form, filing date, title and source URL prefilled for explicit save. For an unsaved owner stock, offer Save stock first and preserve the filing selection. For a guest, keep the SEC link available and offer owner unlock with a return to the selected stock and filing.
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

Extend the frequency and stale thresholds in [the indicator registry](../src/lib/indicator-registry.ts) with verified release schedules for evidence rows and inspectors. Preserve item publication, retrieval and evaluation times separately.

Derive a news/social observation date only from the eligible articles or posts that contributed to that score within its 24-hour window. The raw `newest_published_at` spans all returned articles and `evaluated_at` records the evaluation clock. Neither alone verifies the aggregate. Test fresh, stale, future-dated, undated, mixed and empty inputs. Show unknown observation time whenever the scored evidence cannot support a date.

#### V9-E16 [PR-8] · Similar-Score Historical Distribution Strip ("Similar Days as Dots", `M4`)

- **Current V9 gap:** `MarketV8Outcomes` displays 7D and 30D median returns and hit rates, hiding outcome spread and downside tail frequency.
- Render one dot per eligible observation in the active score zone for each 7D/30D horizon. `selectSimilarScoreOutcomes` supplies all horizon observations alongside the selected cohort. Filter by the cohort zone and verify the plotted count equals `cohort.sample_count` before drawing. Retain sample thresholds, observed/reconstructed labels, the all-score median tick, accessible date/return details and overlap/non-prediction disclosures.

#### V9-E17 [PR-8] · Score History Turning-Point Callouts & Historical Snapshot Scrub Rewind (`M2`)

- **Current V9 gap:** V9's smooth score history chart lets users hover historical points, and `Detailed view` opens replay separately, but the chart itself doesn't explain *why* major inflections happened or rewind the page's evidence rows inline.
- **Enhancement:**
  1. Annotate the 1–2 largest daily inflections on `1M`/`3M` only when archived inputs for the compared dates and configuration support a driver delta.
  2. Reuse `/api/signals/replay` for observed points in As recorded. Bind the preview to the selected date, market, mode and source settings. Show the archived breakdown when present. For score-only dates show “Historical indicator records unavailable” and withhold live evidence. Provide a persistent date banner and “Return to latest” action.

#### V9-E18 [PR-5 part 1: `E4` / PR-8 part 2: `E5`] · Forward-Validation Lab (`E4` Discovery Spec → `E5` V9 Calibration Panel)

- **Current V9 gap:** Historical calibration includes backfilled/gap-repaired rows and marks out-of-sample status unavailable ([`docs/signal-scoring.md`](signal-scoring.md#L121)).
- **Enhancement:**
  1. **PR-5 (E4)** Preserve the earlier six-input US scorer approval as a historical record. Write a separate, versioned contract for [v2.2.0](signal-scoring.md), including its volatility ramp, enabled inputs, eligible markets/modes/source settings, cadence, 7D/30D horizons, benchmarks (VOO/KLCI as applicable), missing data, corrections, sample thresholds and drift rules. Record source and benchmark feasibility. The earlier approval covers its original scorer only.
  2. **PR-8 (E5)** Require explicit sign-off on the v2.2.0 contract and commit it in-repo before enrolling observations. Register the approved configuration before its first observation. Keep prospective records distinct from backfills and historical calibration, and show immature or missing benchmark outcomes as unresolved. A model change starts a separate cohort. The historical dots and rewind can proceed independently. See [the forward-validation criteria](NEXT_PRODUCT_ROADMAP.md#task-6--forward-validation-lab).

---

### 5. Learn & Glossary Module (`?view=learn`)

#### V9-E19 [PR-9] · V9 `Learn & Glossary` Integration Fixes & Dedicated Glossary Index

- Expose Market positioning in the embedded Track selector on ordinary entry and verify existing concept deep links. The `/main-v8` and `/research-v8` commands in `LearnDashboardV1` belong to standalone `LearnShellV8`. Test embedded navigation through the V9 command palette and check standalone Learn separately.
- Add a searchable Glossary tab with a term inventory covering market indicators, Market Internals, valuation ratios and Research/Portfolio terms. Share the existing popover IDs with the index, including `operating-margin`, `revenue-growth`, `internal-credit`, `internal-breadth`, `internal-safe-haven`, `internal-klci-trend`, `internal-myr-fx` and `internal-global-credit`. Preserve existing lesson IDs such as `pe` and `fcf-yield`. Verify each “Learn more” link selects the exact term, including Operating Margin, Revenue Growth and Market Internals, and that links back open the relevant V9 screen.
- Scope surface, border and accent token changes to embedded Learn. Check both themes and preserve the standalone presentation.

#### V9-E20 [PR-2] · Shared `MetricGlossary` Popovers (`G3`) Across V9 Research Overview & Internals

PR-2 merged shared glossary popovers on the Overview tiles and Market Internals. PR-9 owns exact-term destinations for Operating Margin, Revenue Growth and `V9MarketInternals` through the stable glossary IDs in V9-E19.

---

### 6. Workspace Shell, Cross-Module Continuity & Platform (`V9Workspace.tsx`)

#### V9-E5 [PR-3] · Universal Local Research Search in V9 `⌘K` Command Palette

PR-3 merged V9 destinations, browser-local recent tickers and bounded local search across loaded company names, research notes, accepted evidence, filings and monitoring rules. PR-3/4b corrects the destination for guest note matches.

#### V9-E6 [PR-3] · Topbar Alerts & Due-Review Popover + Sidebar Attention Badges

PR-3 merged the topbar attention popover, sidebar due-review dots and Watchlist `Triggered rules` filter with on-demand scans. PR-3/4a carries each listing’s market through alert evaluation, filtering and navigation.

#### V9-E7 [PR-10] · Resolve `V9HomeView` (`Morning Briefing` Hub vs. `Market Pulse` Default)

- **Current V9 gap:** [`src/components/v9/V9HomeView.tsx`](../src/components/v9/V9HomeView.tsx) (690 lines) implements a timezone-aware (`home-schedule.ts`) Morning Briefing combining US + MY pulse cards, Today's Focus queue, Watchlist Pulse, and Portfolio summary — but [`V9Workspace.tsx`](../src/components/v9/V9Workspace.tsx#L55) aliases `?view=home` to `market`, leaving it unmounted.
- **Open decision** Choose whether to mount `V9HomeView` as an optional Morning Briefing or retire it and extract `SignalSlot`. Record the behavior of `?view=home`, Back and mobile navigation for the chosen option before setting request expectations.

#### V9-E21 [PR-7] · Encrypted Backup/Sync in `V8Settings` & Owner Capability Preview

- **Current V9 gap:** Copy/paste AES-GCM encrypted cross-device backup (`Backup` workspace) is only in V7 `/research`; `V8Settings` only offers guest JSON export/clear. Also, guests viewing `V9ResearchView` do not see what `Review`, `Cited evidence`, and `Monitoring rules` unlock in owner mode.
- Add encrypted Backup & Restore in Settings for unlocked owners and explain the owner-only tools to guests. Reuse `EncryptedResearchBackupV6`, including local preview, add-only default and explicit confirmation for replacement. Wire `onRestored` to refresh V9 records. Verify wrong-passphrase handling and that restored or replaced records appear in the open workspace.

#### V9-E22 [PR-10] · Platform Speed (`Q2`), Offline Cached Reading (`Q3`) & Accessibility Audit (`Q1`)

- **Q2 · Performance.** Add direct V9 Market and stock Research entries to [the performance baseline](../scripts/performance-baseline.mjs) and measure time to the first useful reading. Assert zero shell score requests on initial Research, Portfolio, Discover and Learn entry. Load the selected market on Market Pulse and request the comparison market or mode when opened. Cover retry, switching and the chosen Home behavior. On MY, clearly label CNN Fear & Greed as US context.
- **Q3 · Open offline decision.** Decide whether the last public market reading must survive reload. The existing fallback shows last-online time. A mounted reading can show its observation time while disconnected. If persistence across reload is selected, amend [the PWA cache contract](pwa-offline-web-push.md) first to define allowed public fields, configuration, source/time, expiry, cache miss and reconnect behavior. Preserve the exclusion of private research and portfolio data.
- **Q1 · Accessibility.** At 200% zoom from a 1280px viewport, traverse sidebar and mobile navigation, command search, attention popover, research tabs, Quick Peek and glossary by keyboard. Verify visible focus, return focus on close and access to every control. With a screen reader, check the Market score/history and Fear & Greed charts, Research price/peer overlays and Annual Financials, and the portfolio factor matrix. Verify that values, dates and missing-data states are available as text or table data. Record and retest failures.

---

## How to Execute

Start with PR-1a, then PR-3/4a and PR-3/4b as listed in [Delivery status and follow-ups before PR-5](#delivery-status-and-follow-ups-before-pr-5). Continue with PR-5 through PR-10 under [the repository verification rules](../AGENTS.md). Use the PR-6a/6b or PR-7a/7b split when needed and check the E4 approval gate before prospective enrollment.
