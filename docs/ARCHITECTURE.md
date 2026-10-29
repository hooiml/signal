# Architecture

Signal is a Next.js App Router application for market signal dashboards. The app combines live market data, social/news sentiment, institutional indicators, and persisted snapshots into a decision-support UI.

## User-Facing Routes

- `/start`: guided daily journey from the latest US market score through current Discovery candidates and same-day market context into Research.
- `/`: redirects to `/main-v8` with its query intact, including Today's return context.
- `/main-v8` and `/research-v8`: connected V8 Market and Research; `?demo=1` opens their explicitly illustrative prototypes. Reading view / Advanced tools navigation preserves URL context. Market's retained tools live at `/market/tools`.
- `/research`: ordinary entry (including ticker, market and unknown safe parameters) redirects to `/research-v8`. Explicit task links retain the V7 advanced workspace, implemented by `ResearchDashboardV7` over the shared Research controller and existing workspace owners. The exact task-key and fragment contract is in [LEGACY_ROUTE_RETIREMENT.md](LEGACY_ROUTE_RETIREMENT.md).
- `/research-v8?market=US&ticker=AAPL&tab=chart`: public Chart & technicals tab for guests and owners, independent of saved records. It lazy-loads the existing `ResearchChartV6` renderer and validated five-year `/api/research/chart/[symbol]` data; optional benchmark reads use VOO/US or KLCI/MY. The resolved V8 theme applies to canvas and controls. Guest storage and owner records remain separate; reading charts never saves either. The existing Overview price-history chart remains available.
- `/learn`: evidence-based financial education using the shared V7 shell. The current v0.4 path teaches price structure, technical transforms, execution, risk sizing, expectancy, point-in-time trading replay, append-only trade review, and cost-aware strategy validation without producing trade signals. The v0.3 investment, v0.2 business, and v0.1 valuation paths remain selectable with separate progress contracts.
- `/demo`: isolated session-only guided example of Market, Research, and Portfolio. It uses fixed
  local fixtures, labels every surface as example/not live, and has no application API or
  persistence path.
- The twelve existing V2/V4/V5/V6/V7 and backup aliases are HTTP 307 redirects. Basic reading reaches V8; advanced Research reaches `/research`. There were no V3 aliases. `src/proxy.ts` owns the shared boundary and retains duplicate query values.
- `/market/tools`: retained `MarketDashboardV7` and `MarketBriefingV6` jobs, including saved Market alerts and queued exposure reviews that V8 does not yet replace. Existing legacy Market evidence anchors reach and open these tools.
- The Phase 1 static Market and Research prototypes remain preserved in `src/components/v7/V7Prototype.tsx`; they are no longer mounted by the live V7 aliases.
- Shared V6/V7 components remain where canonical tools and other routes still consume them; alias retirement is separate from advanced-feature migration.

## Runtime Shape

The connected Research Watchlist derives its review view from loaded records through
`src/lib/research/watchlist-review.ts`. It reuses R2's `dueReviewReasons`: scheduled
reviews include today, while authored-review age deadlines become stale the next UTC
day. The queue includes overdue records and explicit schedules through the current UTC
Sunday, oldest date first; an independent stale deadline takes precedence over a later
schedule. Unknown/invalid dates remain unscheduled. Sorting and filtering never write
records, complete reviews, or fetch quotes. Midnight and tab visibility refresh the day.

Search and market controls reuse the connected stock switcher's state; sort and queue
choices live only in the mounted home. Default saved order is retained, with symbol and
review-due alternatives and symbol/market tie breaking. Owner actions use the existing
exact-market editable Research handoff in a new tab. Guests have no schedules or review
actions. Price sorts remain explicitly unavailable: `ResearchRecord` has neither current
quotes/daily percentage changes nor 52-week highs. Stock-detail snapshots have those
fields, but the Watchlist does not load them; no quote fan-out or new data contract is added.

L2/T2/T3 keep connected V8 missing-data presentation local to existing responses.
Market exposure uses an inline Research action; empty historical outcomes retain both
horizon headings and the supplied sample threshold. Research omits the annual summary
tiles only when all three amounts and reported revenue growth are absent; partial and
zero values remain visible. Availability disclosures retain per-input reasons and source
notices, and unknown causes stay unknown. Empty filing-aligned valuation keeps capability
details and warnings in an expandable disclosure.

`researchPanelCoverage` in `src/lib/research/reading-display.ts` records the existing
US-only SEC filing discovery, SEC filing-aligned valuation and Nasdaq earnings capabilities.
The same gates serve filing discovery and earnings; connected MY Research presents their
limits once above the tabs. This does not classify current MY financials, chart history or
prices as unsupported. The Filings tab retains the Bursa announcements action. Historical
valuation still reads its response capability statuses before describing missing filing
facts. There are no new reads, provider calls, storage formats or scoring changes.

R3 places `ResearchEarningsTicket` in connected Research's quote band. Its public
Calendar POST supplies only the selected symbol/market and null review fields, whether
saved or unsaved. The existing 30-day UTC Calendar window and Nasdaq source are reused;
MY earnings coverage remains unavailable. An earnings-only request skips macro reads,
and the chronological Nasdaq scan ends once every requested symbol has a result, with
an eight-second upstream deadline. Failed coverage stays distinct from no returned date.
Optional `earningsTiming` preserves structured provider timing; old responses have no
inferred timing. No issuer-confirmation field exists, so every ticket is unconfirmed
and has no countdown. The Calendar link opens a new tab to preserve open note drafts,
using validated ticker, market and `calendarDate` with `discover=calendar`. That Calendar
view reads the single public identity without requiring a saved stock or trend scan.
Dates remain UTC calendar dates; before-open/after-close are provider labels, not
converted clock times. Neither ticket nor handoff saves or changes research.

Connected V8 Market and Research mount a separate first-visit orientation. The guarded
`src/lib/v8-first-visit.ts` store keeps only version, fixed stage and concurrency revision
in `signal-v8-first-visit-v1`. Web Locks and compare-and-set prevent stale completion after
skip/restart; same-tab and native storage events reread current bytes. Invalid data is
retained until explicit Settings restart, and failed persistence is shown separately from
the existing stock Save result. The tour issues no provider request, analytics, unlock or
research write. It observes current resolved readings and successful explicit stock saves;
already-saved stocks require acknowledgement. Settings preserves open Research drafts.
Demo routes and `/start` remain separate. See [`V8_FIRST_VISIT_DESIGN.md`](V8_FIRST_VISIT_DESIGN.md).

Connected V8 Market, Research and Learn share `V8Settings`, a modal that leaves the current
page mounted. `src/lib/signal-config.ts` owns validated reads and explicit writes of the existing
`signal-dashboard-config` contract, reused by the legacy config hook. V8 Market hydrates defaults
before mounting its provider-request view; an explicit valid URL market wins over the saved
market. Page controls stay temporary. Theme retains its independent key, API and boot script.
Guest export/clear use the existing guest store; successful clear emits a same-tab event and
native storage events refresh other tabs. The clear lock snapshots affected bytes, restores
partial removals on error where storage permits, and preserves the existing identity checks on
queued writes. No private data or secrets enter settings. See [`V8_SETTINGS_DESIGN.md`](V8_SETTINGS_DESIGN.md).

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
3. `src/app/api/signals/v2/route.ts` validates request parameters and calls `getSmartSignal` through a 45-second, instance-local exact-configuration cache. Concurrent identical requests share one in-flight load; explicit validated `refresh=true` requests bypass a completed entry. Engine errors and readings without confirmed snapshot persistence are never cached, so a later request can retry storage immediately.
4. `src/lib/signal.ts` orchestrates market-data, social/news, institutional, and snapshot work.
5. `src/lib/sentiment-calculator-v2.ts` normalizes active indicators into a `MarketSignal`.
6. UI components render score, tier, confidence, source coverage, articles, and component details.
7. Vercel cron calls `/api/signals/refresh` daily to pre-warm the current V2 signal snapshots used by the dashboard. A target succeeds only when its snapshot write is confirmed. The response retains every target's result and returns HTTP 503 if any target fails; HTTP 200 means all required snapshots were persisted.

Current readings expose `metadata.snapshot_persistence` independently of provider availability:
`persisted` includes the daily snapshot date, while `unavailable` carries a null date and makes
no successful-save claim. A usable public reading still returns HTTP 200 when persistence
cannot be confirmed. History, score changes and calibration remain independently qualified;
failure to assemble optional history after a confirmed write does not undo that confirmation.

## Data Sources

Malaysia Research also requests annual and quarterly `OrdinarySharesNumber` in the
existing Yahoo fundamentals time-series call. Its raw value is an integer share
count even though Yahoo labels these entries with the statement currency (`MYR`).
The adapter checks exact symbol, series, period, calendar date and value. Valuation
keeps `shareCount`, `shareDate` and `shareSource` separate from annual diluted
averages and the quote timestamp. Known later splits withhold the dated count;
unverified subsequent issuance and buybacks stay disclosed. A non-MYR quote cannot
be combined with MYR financials. No historical snapshots are rewritten.

Company logos remain unconfigured. The current Yahoo payloads have no validated
logo field. Logo.dev is a possible optional integration, but its documented ticker
API requires a publishable key; its free commercial tier requires attribution.
Before enabling it, verify actual US and `.KL` ticker coverage and preserve a ticker
fallback for missing images. Do not guess a company domain from its name or treat
a numeric Malaysia ticker as a US symbol. See
[ticker API](https://www.logo.dev/products/stock-ticker-logos) and
[pricing](https://www.logo.dev/pricing) (checked 22 October 2026).

- Yahoo Finance helpers provide VIX, indices, stocks, quotes, and Malaysia currency-volatility proxy data.
- Malaysian core reads isolate the optional US VIX fetch from the local USD/MYR volatility proxy. The optional VIX request has a three-second cancellation limit; a usable FX proxy can complete without VIX, while missing FX can use the explicitly labelled valid VIX fallback. If neither is usable, orchestration fails before signal snapshot persistence. Missing VIX stays null in raw data and optional context instead of becoming a synthetic reading. US VIX requests retain their existing required-source behavior.
- Cboe daily market statistics provide the US put/call options-positioning input.
- NAAIM provides weekly active-manager exposure for US positioning context.
- FRED pages provide the non-scored Buffett Indicator valuation backdrop, 10Y–3M yield spread, and Chicago Fed NFCI context.
- Yahoo Finance provides the one-year S&P 500 equal-weight (^SP500EW) versus cap-weight (^GSPC) breadth comparison.
- Bank Negara Malaysia's FMIP benchmark-yields page provides native MGS 3Y/10Y, OPR, MYOR, and short-term bill context when the market is MY.
- Live RSS feeds provide contextual news. Reddit retail sentiment is available only through configured application OAuth (`REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, and a truthful `REDDIT_USER_AGENT`); missing credentials leave that source explicitly unavailable without an anonymous fallback.
- StockTwits is disabled by default while its public API is under provider review. Operators with confirmed access can opt in with `STOCKTWITS_ENABLED=true`; access challenges trigger a bounded cooldown and the social score continues with available sources.
- Institutional data is loaded through `institutional-service`.
- Snapshot history is persisted through `src/lib/db.ts` when the signal route runs.
- User-authored watchlist, thesis, checklist, notes, accepted evidence provenance, decision-journal context, a narrow position plan (with an optional explicit price currency that is never inferred or converted), and a bounded 25-entry review history are persisted through `/api/research/watchlist`; provider/sample market data remains separate from these records. The server appends immutable review snapshots so clients can update the current draft without rewriting history.
- Backup export and decision-packet creation remain unavailable until `/api/research/watchlist` has successfully loaded, and both operate on persisted records rather than seeded client examples.
- `/api/research/symbol/[symbol]` combines cached Yahoo Finance daily OHLCV data with locally calculated technicals and bounded annual fundamentals. US snapshots normalize up to five SEC Company Facts periods; Malaysia snapshots normalize up to five Yahoo Finance annual periods because Bursa historical data products require separate licensing or subscription. Both retain per-metric gaps and provider provenance, and Malaysia explicitly asks users to confirm decision-critical values against issuer Bursa announcements. The research chart defaults to EMA20, EMA50, and SMA200; it also calculates RSI, MACD, ATR, ADX/DMI, Supertrend, and range-start anchored VWAP. Visible-range swing-anchor VWAP, daily-bar-estimated Volume Profile, and comparative-strength rebasing are presentation calculations over that validated chart data. US chart comparison uses VOO and Malaysia chart comparison uses the FBM KLCI Yahoo alias; these comparisons are evidence-only. Valuation metrics are derived from current Yahoo price plus the latest available annual inputs rather than copied from an opaque multiple, and missing inputs remain unavailable. US research snapshots also include a one-year VOO passive-baseline comparison using adjusted closes when available; benchmark failure degrades independently and does not change the composite signal. Malaysia research marks the US passive benchmark as not applicable.
- `/api/learn/replay/[symbol]` reuses the filing-aligned historical valuation boundary for US companies. `GET` returns one eligible annual observation while keeping the next observation server-side; `POST` reveals only the immediate next eligible observation after validating a bounded view, confidence, supporting evidence, contrary evidence, and invalidation commitment. Malaysia fails closed until an approved point-in-time fundamentals source exists. Learn progress, evidence-board drafts, thesis exercises, and reflections remain browser-local in v0.1 and do not enter Research persistence or analytics.
- `/api/learn/business-replay/[caseId]` serves curated v0.2 historical-pattern exercises. `GET` returns one known-as-of financial snapshot without the next report; `POST` validates a bounded business-driver commitment before returning the immediate next snapshot. Exercise values remain explicitly illustrative rather than public-issuer facts. v0.2 mastery uses a separate browser-local version-2 key and never migrates or overwrites v0.1 progress.
- `/api/learn/investment-replay/[caseId]` serves curated v0.3 investment-analysis cases. `GET` exposes only the financial, valuation, estimate, rate, macro, event, and narrative evidence known at the checkpoint. `POST` requires a bounded thesis, scenario, supporting evidence, contrary evidence, invalidation, and confidence before the server-only next checkpoint is revealed. v0.3 mastery and the append-only decision journal use validated, version-specific browser-local contracts and do not mutate Research records.
- `/api/learn/trading-replay/[caseId]` serves curated v0.4 candle cases. `GET` returns candles only through the replay checkpoint plus explicit spread, slippage, and fee assumptions. `POST` validates a complete trade or `No Trade` commitment and the current candle identity, then returns only the immediate next candle. Indicator calculations consume visible candles only; future candles remain in a server-only fixture. v0.4 has no brokerage, alert, order-routing, or live-execution path.
- SEC Company Facts payloads are fetched without raw Next.js data caching because large issuers can exceed the framework's per-entry cache limit. The service parses that payload immediately and caches only the compact normalized current values plus five annual periods for six hours. Yahoo annual time-series responses use the same bounded five-period output and a six-hour fetch cache.
- `GET /api/research/valuation-history/[symbol]` is a separate six-hour-cached, public-market-data boundary for at most eight US annual filing observations. It reuses the SEC Company Facts and Yahoo chart adapters but requires one accession, fiscal range, filed date, USD unit set, strictly post-filing close, and reconciled split basis per observation. It exposes P/E, price-to-sales, and FCF yield only when their exact inputs are safe. Malaysia and analyst estimate/revision history remain explicit unavailable capabilities. It receives no holdings or authored research and never mutates research state. See `docs/historical-valuation.md`.
- `/api/research/assist/[symbol]` turns the same validated Yahoo and SEC snapshot into a source-linked journal review queue. Starting a watchlist review automatically prepares this queue; users can accept individual findings and add or edit their own analysis before saving. When `KIMI_API_KEY` is configured, Kimi may synthesize drafts from those supplied facts only; invalid, unsupported, or unavailable AI output falls back to deterministic evidence findings. Findings never update a saved record until the user explicitly accepts and saves them; accepted findings retain a frozen copy of their source labels, links, values, and reporting periods in the current record and each subsequent review snapshot.
- `/api/research/discovery` runs the bounded ranking contract in `docs/trend-discovery.md` over a curated liquid US universe. It returns up to ten leaders, up to ten expandable contenders, and early trends; enriches them with SEC quality and valuation guardrails; checks a bounded Nasdaq earnings window; attaches separately sourced Nasdaq institutional-ownership evidence; and persists hourly leader and contender ranks for score deltas while keeping forward cohort measurement limited to the top ten. Ownership disclosures do not affect rank and are not presented as proof of price causation. The result is a research shortlist, not a trading recommendation.
- The Research `Picker` workspace runs that same bounded Discovery scan only after explicit user action. It can reuse a saved transparent Discovery policy, apply risk, score, existing-watchlist, sector-cap, and pick-count constraints, and store up to twenty browser-local paper baskets. The selected horizon is a measurement deadline rather than a ranking input. Saved basket symbols refresh through the existing quote boundary independently of later Discovery membership; the first available observation on or after the deadline is frozen alongside an optional VOO observation. Picker does not mutate research records, place orders, or convert observational results into a candidate-specific forecast.
- `/api/research/alerts` evaluates the bounded monitoring contract in `docs/research-alerts.md` for the current research watchlist. It reuses validated research snapshots so technical and period-provenanced current valuation/fundamental rules share one evidence contract, and it degrades individual ticker or provider failures without blocking the remaining alerts.
- Version-1 structured thesis triggers extend the existing `monitoring_rules` JSON contract without a new column. Up to ten fixed-enum numeric rules are parsed and evaluated by the pure domain contract in `docs/structured-thesis-triggers.md`; malformed persisted extensions recover to an empty flagged set, settings saves retain optimistic revision safety, and later explicit reviews freeze the current rules in immutable history. Matches join Alerts and the privacy-bounded digest, while Queue creation remains an explicit browser-local action with stable per-rule deduplication.
- Version-1 primary-document evidence extends the existing `accepted_evidence` JSONB value inside the current version-3 evidence bundle without a new column. Version-2 bundles remain readable and migrate with an empty factor-assumption set. Up to 25 bounded exact excerpts retain fixed source metadata, an HTTPS citation, capture method, and deterministic content fingerprint; `mode: evidence` applies only that evidence set under the existing optimistic revision. Full reviews freeze citations in immutable history. The Filings workspace compares captured versions without interpreting prose, and `GET /api/research/filings/[symbol]` discovers bounded metadata from fixed official SEC origins only. It constructs official filing links, requires a configured operator contact, never proxies documents, and degrades independently. Malaysia remains explicit manual HTTPS capture with Bursa/issuer verification guidance. See `docs/primary-document-evidence.md`.
- `/api/research/calendar` validates a bounded 30-day or 90-day POST request and combines saved next-review dates, derived stale-review deadlines, and Nasdaq earnings dates into one chronological event contract. A separate `macroEvents` collection aggregates Federal Reserve meetings, U.S. BLS CPI and employment releases, OpenDOSM inflation/employment/growth releases, and a transparently maintained annual BNM MPC schedule. Provider failures are isolated, macro relevance is limited to same-market tracked symbols, and an empty watchlist still receives market-wide dates. Calendar filters and source links do not mutate saved research, while ticker-event destinations deep-link to the relevant review workflow or Events tab.
- `/api/research/notifications/deliver` is the authenticated scheduled delivery boundary for the same research attention state. It batches the full watchlist into a bounded signed webhook digest, uses a recoverable 15-minute delivery lease plus a receiver-visible idempotency key, and becomes a safe no-op when webhook configuration is absent.
- `/api/research/notifications/settings` persists the default user's enabled state, daily versus urgent-only mode, and optional UTC quiet hours without exposing webhook credentials. It also returns a bounded delivery-event history containing delivery IDs, item counts, status, and sanitized failure details. The scheduled delivery route applies these preferences before sending and records delivered, failed, and deduplicated outcomes.
- Signal is an installable PWA with a deliberately bounded offline shell. The versioned service-worker cache contains only the offline fallback, manifest, and repo-owned icons; navigations remain network-only and no API, research, auth, sync, analytics, or browser-local planning data enters Cache Storage. See `docs/pwa-offline-web-push.md`.
- Opt-in Web Push extends the authenticated scheduled research digest path under the existing private-sync bearer. Subscription capabilities are allowlisted, bounded, AES-256-GCM encrypted at rest, and owned by the single default user. Push payloads contain generic counts plus a same-origin Alerts path only, while delivery preserves per-subscription dedupe, leases, retry/backoff, and disable-on-404/410 behavior.
- Saved research is behind a single-owner access boundary (`src/lib/owner-access.ts`). Watchlist reads/writes, backup restore, notification settings, research memory, expectations, calibration, valuation plans and the inbox's saved-attention enrichment check an HttpOnly, SameSite=Lax `signal_owner` cookie in every handler before processing a body or touching storage/providers. A missing/invalid cookie returns `401`; an absent or invalid `OWNER_ACCESS_SECRET` returns typed `503 OWNER_ACCESS_UNCONFIGURED` (fail closed). `/unlock` posts the secret to `/api/owner/session`, which compares SHA-256 digests in constant time and issues a 30-day HMAC-SHA256-signed issue time; rotating the secret revokes every cookie. The secret is never stored in the browser. This is not multi-user identity; storage still uses the single `default` user. Bearer-protected sync, push and scheduled-delivery routes keep their own secrets. Client states distinguish an unlockable browser from an unconfigured deployment; unlock preserves a safe same-origin pathname, query and fragment. Private-panel Save failures preserve mounted drafts and offer explicitly labelled new-tab unlock, followed by another explicit Save. Memory's browser-local fallback is labelled and cannot automatically POST until a server read succeeds.
- `/api/research/sync` is an opt-in single-user ciphertext vault protected by the server-only `RESEARCH_SYNC_BEARER_SECRET`. The browser reuses the bounded AES-GCM backup envelope, the route structurally validates ciphertext without receiving its passphrase, and an expected remote revision prevents silent overwrite after a stale check. The access token and encryption passphrase remain mounted-page state only. This is not multi-user identity, account recovery, or automatic conflict merging.
- The Research `Outcomes` workspace calculates decision-learning summaries from the immutable review history already returned by `/api/research/watchlist`. It groups only explicitly resolved prior-review assessments by saved decision, confidence, and market; unresolved links remain visible, and observed-price changes are labeled as incomplete context rather than benchmarked returns.
- The Research `Portfolio` workspace aggregates saved position plans into allocation, concentration, defined-risk, and scenario views. It requests existing five-year chart endpoints for at most the twelve largest plans, calculates beta against VOO or FBM KLCI plus pairwise return correlations only with sufficient overlap, and keeps missing histories or invalid position-plan inputs out of covered totals.
- The same Portfolio workspace can restore and explicitly import a separate version-1 browser-local holdings snapshot described in `docs/portfolio-holdings-import.md`. The client parses a bounded canonical CSV, rejects ambiguous aliases and duplicate identities, previews add/skip/replace effects, and requires confirmation before local persistence. Exact market+symbol reconciliation may reuse an already hydrated research quote; unmatched holdings remain visible, mixed currencies are never combined without an explicit FX input, and missing market values stay unavailable. An exact match can explicitly enqueue one deduplicated browser-local thesis-challenge review without copying account, quantity, cost, currency, balance, or provenance data into the Queue. Workflow analytics may record only the fixed Portfolio-holdings Queue action and its later source-return, review-start, and completion steps. Holdings, cash, tickers, accounts, quantities, values, and provenance remain excluded from analytics, research records, encrypted research backup/sync, server APIs, and brokerage/order behavior.
- The Portfolio transaction importer stores a separate version-1 browser-local ledger described in `docs/portfolio-transaction-import.md`. Its canonical CSV uses the exact account label plus broker transaction ID as identity, validates type-specific security and quantity requirements, previews every accepted and rejected row, defaults to add-only, and requires a second acknowledgement before replacing exact matches. It does not retain raw CSV text, overwrite holdings, infer signs, calculate returns or tax lots, convert currencies, call a transaction API, or emit transaction content to analytics.
- The read-only transaction reconciliation surface described in `docs/portfolio-transaction-reconciliation.md` derives quantities from explicit buys and sells and derives cash from documented type directions, then compares those values with the independently stored holdings snapshot by exact account, security, and currency. It mutates neither source, keeps currencies separate, labels unexplained values as possible missing opening history, and treats corporate actions, transfers, reinvestment, gross/net ambiguity, FX, performance, and tax treatment as unsupported rather than inferred. A non-matching security row with an exact canonical or declared provider-symbol Research match can explicitly enqueue one deduplicated browser-local thesis-challenge review under the canonical ticker without copying account, quantity, difference, cost, currency, balance, transaction, or provenance data into the Queue. Workflow analytics may record only the fixed Portfolio-reconciliation Queue action and its later source-return, review-start, and completion steps.
- Covered attribution described in `docs/portfolio-covered-attribution.md` uses only exact reconciled holdings, their accepted snapshot average costs, and exact current watchlist prices to show currency-scoped unrealized price contribution. Explicit dividends, fees, and taxes remain separate. Uncovered holdings stay in coverage denominators, while realized contribution, FX, tax results, return percentages, and total-performance claims remain unavailable.
- Version-1 explicit factor assumptions extend the existing `accepted_evidence` JSONB bundle to version 3 without a new column or endpoint. A fixed ten-factor taxonomy records user-declared rise direction, materiality, evidence date, optional bounded note, and optional same-record evidence/citation link; `mode: factors` replaces only that set under the existing optimistic revision, while full reviews freeze it in immutable history. The Portfolio matrix joins assumptions to local holdings by exact market+symbol, separates every account and currency, weights only known current values, and reports value/count coverage plus unmatched, unpriced, and undeclared holdings. No sector, prose, AI, market score, or price behavior creates an assumption. See `docs/portfolio-factor-exposure.md`.
- The Calendar workspace restores a separate version-1 browser-local dividend and cash-flow plan described in `docs/dividend-cashflow-calendar.md`. Exact account and currency filters never aggregate or convert currencies. The server-side Nasdaq discovery boundary accepts only a validated exact matched US ticker and returns declared metadata with source and fetched-at evidence; confirmation, edits, quantities, illustrative arithmetic, notes, cash plans, revisions, and removals remain local. Queue handoff uses a stable per-event key, while the local since-last-visit event count receives only a date/type/symbol projection. Planning records never change actual holdings, cash, transactions, research, analytics, backup, sync, or signed delivery.
- The Portfolio pre-trade sandbox applies at most twenty explicit session-only legs to a copied holdings snapshot through the pure version-1 contract in `docs/portfolio-what-if-sandbox.md`. It rejects ambiguous or oversold baskets atomically, keeps cash and values isolated by account/currency, reuses exact research, position-risk, and policy contracts only where evidence is available, and never persists a draft or sends scenario content to an API or analytics event.
- The Portfolio saved-scenario library stores at most eight validated market, sector, or currency stresses in browser-local storage. Applying a scenario is deterministic and allocation-weighted; it never updates a research record and it labels results as illustrations rather than forecasts.
- The Outcomes Decision Review Lab stores at most 100 browser-local act-or-pass observations with a 1M, 3M, 6M, or 1Y measurement horizon. Once a horizon is due, it uses the validated five-year chart boundary to freeze the first available candidate and VOO or FBM KLCI session, maximum drawdown, maximum favorable move, benchmark-relative change, and the act-or-pass decision effect. Legacy records migrate to a three-month horizon, missing benchmark entries are backfilled from the first available session after recording, and frozen outcomes are never rewritten. Action, confidence, and horizon cohorts withhold statistics below five observations, label 5–19 as preliminary, and require 20 for established evidence. This browser-local review evidence remains separate from persisted research, holdings, orders, fees, dividends, and brokerage returns.
- The collapsed `Since last visit` utility waits for the canonical saved watchlist, then lazily composes existing market-signal, calendar, alert, investment-policy, inbox, and source-health boundaries into one briefing. A versioned browser-local checkpoint stores bounded record fingerprints and US/Malaysia posture snapshots only after explicit `Start tracking` or `Mark caught up`; it does not write research records. Independent provider failures remain visible as partial-briefing warnings while successful sections and the deterministic top-three action ranking remain usable.
- The Research `Today` workspace auto-loads that same non-mutating briefing contract and adds due browser-local Queue tasks. It exposes at most three deterministic immediate actions with their source and owning destination while retaining Queue, Alerts, Calendar, Changes, Filings, and Sources as directly addressable workspaces. Compact overdue-review, near-term-event, triggered-alert, incomplete-Queue, and degraded-source summaries are projections only; their owning workspaces remain authoritative.
- Today return context uses only the fixed `returnTo=today` query value. A version-1 browser-local continuation stores an allowlisted Market or Research destination, optional validated ticker, fixed detail tab, review-mode flag, and timestamp for at most 90 days; it stores no authored content and creates no network or analytics payload. Opening or returning from Today never acknowledges, completes, saves, or otherwise mutates the owning state. Watchlist remains the default `/research` workspace until the Task 0 real-use promotion gate passes.
- The research journal offers session-only Core, Quality compounder, Growth, Value, Income, and Turnaround templates. A selected template changes question-led narrative guidance and evidence priorities only; it never auto-fills claims, toggles checklist items, changes the calculated decision, or persists a strategy classification. Workflow templates may still narrow the visible narrative fields while the selected strategy lens guides those fields.
- The Research `Map` workspace builds a deterministic in-memory relationship graph from saved ticker records, current watchlist sectors, and accepted-evidence provider names. Edges exist only for a shared known sector or shared provider; market membership and text similarity do not create inferred links.
- The Backup workspace supports manual cross-device transfer by rendering the existing versioned AES-GCM envelope as copyable ciphertext and accepting the same ciphertext by paste. PBKDF2-SHA-256 key derivation, passphrase boundaries, payload validation, and explicit add-only or replace-matching import remain shared with file backup. A revision comparison is shown before import; the manual package path itself requires no sync server, account, or passphrase recovery.
- The Alerts workspace can request browser-native notification permission explicitly and store an enabled/risk-only preference in that browser. A stable digest suppresses unchanged active alerts, notification text is bounded, and disabled, denied, malformed, or unsupported states fail closed. These notifications require Signal to remain open; the signed webhook remains the background-delivery path.
- The Research `Peers` workspace loads the existing validated current symbol snapshots for one subject and up to five editable watchlist peers. Suggestions prefer matching industry and then sector; median and percentile calculations retain per-metric coverage. Historical filing observations live only in the selected ticker's Valuation tab and are not used as peer-distribution inputs.
- `/api/source-health` runs bounded, non-destructive probes for storage and selected external providers, then combines those results with configuration-only and normal-flow-only source states. The Research `Sources` workspace keeps healthy, degraded, unconfigured, and unchecked states distinct and lists cadence, coverage, and affected features without exposing secrets.
- `/api/signals/replay` reads the persisted `signal_snapshots` contract for one market, interpretation mode, and source-toggle state. The `Replay` workspace selects and compares full observed snapshots while keeping reconstructed score-only rows out of evidence replay; it never infers a ticker decision from a market posture.
- The `Export` research workspace freezes the selected saved research revision into a timestamped Markdown decision packet. It may include the latest full observed market replay snapshot, records missing context explicitly, and creates a print-ready browser document for Save as PDF without a server-side PDF dependency.
- The `Usage` research workspace summarizes a bounded 180-day workflow-event log stored only in the current browser. The event contract accepts fixed workflow names and enum attributes plus an optional short-lived UUID workflow correlation ID, rejects unexpected fields, excludes symbols and authored research content, deduplicates development double-fires, caps history at 2,000 events, and supports local disable and clear controls without any analytics API or third-party destination. Pathways report openings, correlated completions, completion percentage, active days, and last use. The Today pathway additionally separates action opens from correlated destination reaches so the roadmap's open-to-detail gate can be measured without recording the destination ticker or authored content.
- The Market `Exposure map` joins the current signal's active scored drivers with the saved same-market watchlist. A pure rule layer maps driver families and explicit sector classifications to higher, moderate, lower, or unmapped connections; ownership and review age affect display priority only. The map does not estimate beta, holdings look-through, revenue geography, price sensitivity, or a security decision.
- V8 Market (`MarketV8Exposure`) reads the saved securities of the active workspace (guest device storage, or the owner watchlist after an owner-session check), classifies up to 20 same-market symbols by exact match through `/api/research/search`, and maps Yahoo sector names to the rule names with `normalizeExposureSector`. `MarketV8Outcomes` summarises `selectSimilarScoreOutcomes` for 7 and 30 days and links to the full History calibration.
- The Research `Changes` workspace runs a bounded, two-at-a-time scan over at most eight saved records using the existing assisted-research endpoint. It compares current source IDs, values, and reporting periods with frozen accepted evidence, keeps new, changed, and unchanged states distinct, and stores only a bounded local dismissal list. Staging a finding attaches its sourced evidence to an editable review without changing thesis text.
- The Research `Evidence` workspace derives a field-level quality map from saved thesis text and accepted evidence. Seven fixed rules classify each field as supported, stale, conflicting, assumption, or missing; reporting periods take precedence over acceptance time for freshness. Coverage can create a source-labelled Queue task, but it never changes thesis text, checklist state, or the saved decision.
- The Research `Policy` workspace evaluates saved plans and decisions against browser-local limits for single-name allocation, sector allocation, evidence coverage, review age, and optional Ready/DCA valuation state. Missing allocations are excluded from concentration totals, every breach remains advisory, and a breach may create a provenance-labelled Queue review without mutating research.
- The Research `Currency` workspace combines saved average cost or planned entry, hydrated current quotes, user-supplied entry/current USD/MYR assumptions, and browser-local dividend/fee adjustments. Price and FX contributions remain separate, missing inputs stay unavailable, and any comparison with a saved benchmark is labelled as potentially period-misaligned context.
- The Research `Filings` workspace compares structured accepted-evidence sources with the prior immutable review snapshot. It retains added, changed, removed, and unchanged states, groups navigation categories through disclosed label matching, and preserves provider citations. It explicitly does not claim to diff raw filing prose, guidance language, or management intent that the current provider contract does not expose.
- The Market `Score sensitivity simulator` recalculates active normalized indicator scores against the current configured weights and neutral missing-source reserve. It shows the simulated tier, weighted-point changes, current weight regime, and engine-equivalent alignment conflicts while keeping the live signal immutable. It deliberately does not change raw inputs or trigger a new VIX regime.
- The Research `Queue` workspace is the shared execution layer for manual reviews plus Thesis Changes, Calendar events, Alerts, Market Exposure prompts, and Portfolio review prompts. It stores at most 100 browser-local ticker/template/source/due-date tasks, keeps one pending connected task per ticker, template, and source, and synchronizes same-tab or cross-tab changes without a server write. Connected tasks expose a deterministic return action to their owning Market or Research workspace; manual tasks have no invented source destination. Source navigation does not alter the task or research record. Five fixed templates select a smaller narrative-field set in the existing review editor, while the full checklist, valuation and target-zone controls, position plan, decision journal, accepted evidence, optimistic revision check, and explicit save remain unchanged.
- The Research `Backup` workspace serializes only persisted research records, validates them against the normal record boundary, and encrypts/decrypts entirely in the browser with PBKDF2-SHA-256 plus AES-256-GCM. Imports are limited to 100 records and 2 MB, require a decrypted preview, default to add-only, and require a second explicit acknowledgement before replacing matches. `/api/research/backup` accepts plaintext only after that local approval, revalidates every record, never deletes unrelated records, preserves review history, and advances the stored revision on replacement.
- `AppNavV6` owns the shared Ctrl/Cmd+K command palette. Its fixed route/theme commands are extended by Market configuration actions or Research workspace/ticker/saved-view actions, and the palette contains no mutation command for saved research. On Research, `local-search.ts` builds a bounded in-memory index only from records already accepted by `parseResearchRecord` plus Queue tasks already accepted by `parseResearchWorkflowTasks`. It searches fixed ticker/company, authored thesis, accepted-evidence label/source, primary-document title/identifier, and Queue template/source fields; evidence values, filing excerpts/URLs, Queue dedupe keys, holdings, transactions, accounts, credentials, backup content, and unrelated state are excluded. Matching has deterministic per-owner caps, emits no request or analytics content, and routes to the exact Research Overview, Filings ticker, or Queue task without mutation. Saved-record and Queue-storage failures degrade independently. Research saved views are capped at eight in browser storage and capture workspace, watchlist query/filters, ticker, detail tab, and comfortable/compact density; applying a view uses the existing URL-state boundary and never edits a research record.
- First-run setup stores only the validated version-1 `signal-first-run-setup-v1` lifecycle,
  selected-market, fixed completion-step, and optional-monitoring enums. It derives watchlist or
  holdings, saved-review, scheduled-review, and structured-rule completion from the existing
  Research and Portfolio owners. A first-ever empty owner state opens setup automatically;
  existing Research, Portfolio, or Queue state is not changed or auto-replaced. Setup actions route
  to the existing watchlist add, Portfolio import, and Research review surfaces. Skip, restart, and
  malformed-progress recovery touch only the setup key. The `/demo` route is a separate mounted
  session with no setup, Research, Portfolio, Queue, analytics, backup, sync, or provider write.
- `StartGuideV6` independently requests the existing US signal and Discovery boundaries. It filters the signal article feed to the browser's current calendar date, excludes undated and older headlines, keeps those headlines labeled as market context, and links into existing Research workspaces without mutating research or portfolio state.
- Discovery supports up to five browser-local custom universe policies over the existing curated US provider scan. Sector, dollar-volume, risk, and extreme-valuation rules determine eligibility; up to three bounded preferences adjust a separate policy score. The default discovery score and rank remain visible and unchanged, every adjustment is explained, exclusions retain reasons, and unsupported Malaysia coverage is not implied.
- A scheduled refresh path precomputes the default V2 market/mode combinations once per day so the dashboard is less dependent on first-visitor refreshes.

## Architecture Rules

V8 Research home's Holdings tab reads the existing validated browser-local holdings snapshot.
It uses the shared reconciliation and summary helpers with no current quotes: cost and cash
stay separated by currency; current prices, market values and weights remain unavailable.
Exact saved market/symbol matches open V8 Research. The import/update link opens the existing
Portfolio workspace. Rendering and navigation never write or transmit holdings data.
When holdings and cash have different source labels or import times, the cash rows retain
their own attribution even for a single cash account. The overall snapshot update time does
not replace the original import time of a retained cash balance.

- Full Research initializes from persisted active records only. Demo watchlist values are
  never a fallback for loading, empty or failed saved-record reads. Deep-linked ticker
  selection is resolved only after that read succeeds.
- New Research review journals retain their observed quote currency. Decision calibration
  freezes original and later price currencies separately; legacy missing currencies remain
  explicit, and cross-currency or unknown-currency returns are withheld rather than inferred.
- V2 score requests omit unused Aura retrieval. Provider/institutional reads and independent
  snapshot/history reads overlap; snapshot persistence remains awaited. The full orchestration
  retains Aura by default for existing callers. Saved-record and archive-marker reads overlap.

- API routes must validate external parameters before calling services.
- Data parsing and normalization belong near the boundary where the data enters the app.
- Scoring rules belong in calculator/service modules, not in UI components.
- UI components should render typed signal payloads and avoid duplicating scoring logic.
- External clients should stay in `src/lib` and expose typed helper functions.
- Generated docs under `docs/generated` should be updated by scripts, not hand-edited for long-lived facts.

### Guided everyday Research

Research editing keeps one in-memory draft across three steps: Thesis, Evidence,
and Decision. The first step shows core narrative prompts; extra narrative,
strategy guidance, assistance, and position planning use native disclosures.
Step navigation and disclosure toggles never persist a record. Save review uses
the existing mutation and history path, and Cancel discards the draft. Workflow
handoffs keep their focused fields and expand the additional narrative section.
The optional assistant mounts only on first expansion and stays mounted while
switching steps. Review tools likewise mount on first opening and retain their
current panel when the outer disclosure closes.

The reading view consolidates readiness details, collapses fundamentals and
review history, and removes the duplicate checklist/decision card. V8 keeps one
primary next action and a single collapsed collection of all research checks;
provider coverage remains visible in one expandable notice. Version navigation
and every existing workspace destination remain unchanged.

## Reading-first Market and Research

The connected V8 pages default to a basic reading with an explicit Detailed view toggle (`aria-pressed`, one fixed label). The separate Reading view / Advanced tools links switch routes.
Research keeps Overview, Financials and Valuation available without authoring anything.
Advanced reveals Thesis, Review, saved decisions, optional research checks, and all existing
workspaces. The URL preserves Research depth (`advanced=1`); existing Thesis/Review deep links
open Advanced automatically. Switching back selects Overview if an advanced-only tab was active.
The legacy workspace identifies itself as advanced and links back to the same security's basic view.
Its decision tracking (confidence, review scheduling and outcomes) is an optional disclosure that
retains existing values. No user data is migrated or automatically completed.

`src/lib/research/current-assessment.ts` describes three reported annual inputs: revenue growth,
net income and free cash flow. A named source and valid, non-future reporting period are required.
Signs are described individually; there is no weighted investment score, inferred fair value,
trade decision, sector suitability claim or use of authored checklist/thesis fields. Fewer than
three usable inputs is partial coverage; no usable financial inputs means insufficient data.
Zero revenue growth is stable, not growth. Financial periods older than 548 days (approximately
18 months), and responses older than two days or with invalid/future retrieval dates, receive an
explicit limited assessment. These are display freshness conventions, not predictive thresholds.
Sources, reporting dates, provider errors and limitations remain accessible in basic view.
The function is read-only and never writes research records or marks them reviewed.

Market retains its existing score calculation, data configuration and chart. Advanced reveals
Momentum/Contrarian and source controls, historical calibration/replay and scenarios. Returning
to basic leaves the current model/source configuration visible and unchanged, exits replay, and
hides advanced-only tabs; local scenario state is retained. Raw observations and source explanations
remain accessible, with normalization/weight details disclosed separately. Version switching is unchanged.

### Unsaved Research reading (October 2026)

The current assessment exposes available, partial, outdated, insufficient and unsupported
evidence states beside its conclusion, with source/reporting/retrieval dates and visible
limitations. Refresh compares only the previous successful response for the same mounted
market/security: identical returned financial inputs/source/period are labelled no new
financial evidence for the summary. Changed inputs, source/period, coverage and provider
notices are distinguished. Quote changes alone do not imply new financial evidence.
Failed or pending refreshes suppress the comparison; selection changes reset it. This
comparison is session-only and does not write research, generate decisions or change
assessment eligibility, freshness conventions or calculated values.

Market presents the largest-weight included supporting/conflicting observations beside
the existing score, with source status and access to the existing inspector. An unchanged
score is explicitly separate from unchanged inputs. Score semantics, configuration and
historical replay remain unchanged; the current summary is hidden during historical replay.

V8 accepts `ticker` and `market=US|MY` independently of the watchlist. The keyed
`market:symbol` reading starts provider work without waiting for saved records; aborted or
mismatched responses cannot populate a different selection. Missing watchlist access does
not remove provider evidence. A saved security's market is used for older links without a
market parameter; otherwise the existing MY aliases/numeric codes are recognized.

Saving is an explicit watchlist POST with `saveOnly: true`. It creates an empty bookmark,
with thesis strength `unknown`, decision `Not recorded`, confidence `unrecorded`, no notes,
no scheduled review and no review history. Legacy creation behavior is unchanged. The
existing non-null `last_reviewed_at` storage column still receives the creation date;
`src/lib/research/review-lifecycle.ts` treats a record with decision `Not recorded` and no review
history as unreviewed in the default lifecycle: readiness, decision packets and V8 never present the creation
date as a review, and the age-based `reviewAgeDays` countdown (since-last-visit, inbox, calendar,
alerts and scheduled delivery) starts only after a genuine review. An explicit `nextReviewAt`
schedule still applies to bookmarks. These bookmarks are excluded from outcome attribution until an actual
review exists. Legacy V6/V7 headers, journals and controls use the same personal-review
predicate, while calculated checklist status remains separate from the saved decision.
Structured research-age triggers and investment-policy checks use the same nullable
authored-review age. A bookmark has no age observation; its trigger is unavailable,
and its policy assessment requires a first review rather than claiming compliance
or inventing a stale-age violation.
Readiness, Policy and Market exposure display `Not reviewed` until an authored review
exists. A review-history entry counts even when its decision remains `Not recorded`;
legacy authored decisions remain supported. Settings and evidence-only saves do not
advance the review clock. The storage column and encrypted backup format are unchanged.
Decision Memory also requires an explicit saved decision for its decision-dependent
imports; `Not recorded` cannot become a dated `watch` decision. Evidence remains
available, and the primary journal retains reviews without recorded decisions.

Quote `observedAt` comes from Yahoo's `regularMarketTime` when the price comes from the
same quote; a fallback close retains its corresponding chart timestamp. Snapshot `fetchedAt` remains
retrieval time. Missing observation time stays unavailable. No source freshness thresholds
or scoring eligibility changed. Company assessment now requires the provider's `EQUITY`
instrument type. Funds, indices, unknown types and names matching bank/bancorp/financial/
insurance/assurance/REIT/investment-trust exclusions receive an explicit assessment limit.
This is a conservative name-based exclusion, not a comprehensive sector classifier:
unrecognized specialized companies remain a limitation. Facts and financial tables remain
available even when the assessment is withheld. Existing three-input, source, period and
age rules still apply. No sector/fund analytical models were added.

### Research security lookup

`ResearchSecurityLookup` owns transient query/result state and cancellation. `/api/research/search`
validates inputs; `security-search.ts` validates fixed-origin Yahoo responses and supported listing
identity. `security-classification.ts` independently resolves exact-ticker sector/industry metadata
for the snapshot, with a bounded-age cache. Current assessment eligibility consumes that metadata
and fails closed on missing/unsupported classification. Selection and search never mutate saved
Research. See WORKFLOWS.md for privacy, caching and stage-timing contracts.

## Review-driven corrections (October 2026)

- Public V8 Research checks the existing owner-session status, then uses either the protected owner watchlist or browser-local guest research. Visitors need no account or access code. Guest bookmarks and notes use the validated, bounded `signal.guest-research.v1` localStorage document; a random ID is created on first save and is never sent as authentication or used in SQL. Only security identity and notes are persisted. Owner and guest records are never merged or imported automatically. Separate browser profiles and origins have separate guest data; a shared browser profile shares its guest notes. Export and confirmed Clear affect only guest storage. Note saves compare the draft's original note with the latest stored value and reject detected conflicts. All guest mutations acquire an exclusive Web Lock before reading and writing storage, serializing changes across tabs; browsers without Web Locks can read but receive an explicit error on saving. Failed storage reloads mark the last loaded records unavailable and disable mutation without discarding a draft. Duplicate saved tickers across markets require an explicit market choice.
- Guest mode supports current provider readings, security bookmarks and personal notes. The full review journal, monitoring, backups and legacy editing tools remain owner-only. Owner cookies and route guards are unchanged. A failed owner-status check falls back to guest reading rather than exposing owner data. Storage failures remain visible and never report successful persistence. The owner workspace can be locked from V8 to return to guest mode.
- Market source metadata separately reports configured source availability and returned article publication coverage. Input weights, source eligibility and sentiment arithmetic are unchanged. Publication dates describe returned news items, not a newly observed indicator reading; missing dates remain unknown. Research presents annual amounts beside comparable annual changes and explains missing valuation inputs without changing assessment eligibility or valuation rules.

- V8 theme selection retains a session choice if browser storage fails, while successful persistence and relevant cross-tab changes continue to synchronize. The boot script resolves the OS theme independently of storage availability. The legacy root theme provider and PWA online-state initialization also tolerate denied storage; optional timestamp persistence cannot prevent in-memory reconnect state. The theme controls keep their separate attributes and preferences.
- The nested structured-trigger editor uses a container breakpoint rather than the viewport to decide when six columns fit. On narrow legacy Research screens, the selected ticker and quote share a row, while the mounted views/briefing utilities sit behind one keyboard-accessible disclosure. Pins, workspace navigation and the next action retain direct access.
- Saved-review chart diamonds occupy a separate annotation row above the price plot and 52-week labels. The plot and date labels translate together, preserving the price scale and review-date positions; charts without review markers keep their original layout.
- SEC Company Facts summary metrics (revenue, growth, margins, net income, FCF) are taken from the latest annual revenue period's row of the aligned `history`. A metric missing from that period is unavailable rather than borrowed from an older year, so `reportingPeriod` describes every flow input. Debt, cash and shares remain the latest reported point-in-time balances.
- V8 Chart & technicals is available directly for the selected public security, whether saved or unsaved. The legacy owner Research workspace still requires a saved selection: an explicitly linked unsaved ticker resolves to no selection, names the ticker, and links back to its V8 reading instead of substituting another saved company.
- Market snapshots archive each component's `timestamp_basis` and `retrieved_at` beside `last_updated`. The VIX/FX-proxy input uses Yahoo's `regularMarketTime` (or the last returned FX close) as its observation time when supplied, keeping retrieval time in `metadata.retrieved_at`; snapshot time remains `snapshot_date`.
- `metadata.change_reconciliation` (`reconcileScoreChange` in `src/lib/signal-change.ts`) accounts for the whole composite delta between snapshots: per-input deltas split into score and weight effects, inputs that became available or unavailable, new versus same observations, the neutral-fallback delta for missing weight, model-version change, and an explicit rounding/clamp residual. Component, neutral and residual rows sum to the reported delta. Earlier snapshots without per-component score and weight report the accounting as unavailable with `change_reconciliation_note`.
- Optional `fundamentals.metricProvenance` retains exact debt/cash/share report dates and currency separately from the annual summary. Debt made from two differently dated facts reports both dates. Older snapshots retain unknown dates. The SEC normalized-cache version advances to populate the additive metadata; the annual-period selection and valuation arithmetic are unchanged. Yahoo annual diluted-average shares retain their annual date, while quote outstanding shares do not acquire an invented balance date.
- Market reconciliation and replay preserve explicit `observed`/`retrieved`/unknown basis, retrieval time and raw unit. A newer-observation claim requires a strictly later verified observation; same-time revisions, older observations and refetches remain distinct. Legacy metadata does not become observed by inference. Raw history includes only compatible named/unit series, and null values remain unavailable. Offsetting score and weight effects remain a changed row even with zero net contribution.
- Market's leading named evidence sits near the verdict, with chart-before-evidence DOM and visual order at every width. The archive panel owns local loading, empty, partial and failed/retry states. Change accounting uses separately labelled raw readings, model scores, weights and contribution points. Scenario/replay tier copy and colors share the descriptive display contract. Legacy Research's return link preserves the security market and maps financial/valuation tabs back to their V8 reading.
- V8 Research `Financials` and `Valuation` add three read-only decision-context enhancements without changing scoring, assessment eligibility or non-advice rules:
- V8 Research adds `Peers` and `Filings` tabs after the existing reading tabs. `ResearchPeersV8` loads up to five same-market peer snapshots (`benchmark=defer`), defaults to the first saved same-market securities until the set is edited, and renders `buildPeerBenchmark` medians and ranks beside per-peer values and `buildComparisonMetrics` price and trend rows. `ResearchFilingsV8` lists recent SEC EDGAR filings from `/api/research/filings/[symbol]` for US securities and shows the owner record's saved document citations read-only; capturing excerpts stays in the Research workspace.
  1. `ResearchFinancialSummary` renders a chronological multi-year trend strip (`annualHistorySeries` in `src/lib/research/financial-display.ts`) inside each metric's detail description whenever at least two consecutive comparable annual periods share the latest period's source and currency.
  2. In `Valuation` under Advanced tools, `PositionPlanComparison` (`src/components/v8/ResearchV8ValuationContext.tsx`) renders a visual price ruler and signed percentage distance from the latest returned quote to saved `plannedEntryPrice`, `averageCost` and `invalidationPrice` (plus 52-week low/high when valid) only when both the saved plan and quote carry the exact same 3-letter currency code.
  3. `HistoricalValuationV8` (`src/components/v8/ResearchV8ValuationContext.tsx`) exposes an on-demand `<details>` disclosure in V8 `Valuation` that lazy-loads `GET /api/research/valuation-history/[symbol]?market=US|MY`, validates the payload with `parseHistoricalValuationResponse`, compares the current snapshot's P/E, Price/sales and FCF yield against filing-aligned SEC 10-K low/median/high observations, and surfaces explicit capability and Malaysia boundary disclosures.
