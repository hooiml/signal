# Testing And Verification

Run the smallest verification set that proves the change, then expand when shared behavior or API contracts changed.

## Standard Verification

```powershell
npm run lint
npm run typecheck
npm run harness
```

`npm run harness` already runs the research regression suite. Use `npm run test:research` separately only for focused research iteration; do not add it after `npm run harness` or run both against the same task in parallel. Research compilation uses a unique `.tmp/research-tests/<run-id>/` directory so separately invoked runs cannot remove each other's artifacts.

For docs-only or harness-metadata changes, `npm run harness` is the minimum proof. Run the full standard set when TypeScript, routes, shared contracts, or runtime behavior changed.

## QA Lane Selection

Use the smallest lane that proves the change:

- `LIGHT`: docs, scripts, package scripts, harness metadata, or other tooling-only changes. Inspect the diff, run the relevant syntax/lint check, execute the targeted command, and run `npm run harness` when repo guidance or harness files change. Skip the full build and visual reviewer unless application behavior changed.
- `UI-LIGHT`: isolated non-shared UI changes. Run one browser session at a representative desktop and mobile width, including overflow, the changed interaction, and console/request checks. Use the targeted header command for shared-header assertions.
- `STANDARD`: shared components, multiple routes, responsive layout, API or async state, persistence, or visual-reference work. Run the complete affected browser matrix and the standard verification set.

After a failure, rerun the failed scenario plus one smoke check. Rerun the complete affected matrix only when shared behavior or the verification tooling itself changed. Escalate rather than weakening checks when authentication, authorization, security, payments, persistence, or external contracts are involved.

## Build Verification

Run this before completing framework, route, dependency, or deployment-related changes:

```powershell
npm run build
```

## Browser Verification

For UI changes:

```powershell
npm run dev
```

Then open `http://localhost:3000` and check:

- dashboard loads without runtime console errors
- market toggle still changes the signal request
- mode toggle still changes interpretation
- social toggle still affects the signal request
- desktop and mobile layouts do not overlap text or controls

### Reproducible Performance Baseline

For shared route, bundle, or request-hydration performance work, build the
production app, start one owned production server, and run:

```powershell
npm run qa:performance -- --base-url http://127.0.0.1:3000
```

The probe uses two cold Chromium contexts per route, disables browser and
service-worker caches, applies the same bounded 3G-like network and 4x CPU
profile, and records JavaScript transfer, request count, API request paths,
opposite-route prefetches, LCP, and same-origin request failures. Evidence is
written under `.tmp/signal-performance/<timestamp>/report.json`.

Use `--no-throttle` only for a separate fast diagnostic. Before/after claims
must use the same build, route data, viewport, cache state, run count, settle
time, and throttle profile. Two baseline runs should remain within 10% for
JavaScript transfer and request count; investigate instability before using
the measurement as an optimization gate.

### Targeted Market QA

For Market V6 hierarchy, score-evidence, responsive layout, or control wiring, use the deterministic one-session check:

```powershell
npm run qa:market
```

By default the command intercepts `/api/signals/v2` with deterministic US and Malaysia fixtures, checks the score-evidence hierarchy at 1280px, 768px, and 375px, exercises market/mode/source controls once, captures the affected score section, and writes a unique report under `.tmp/signal-market-qa/<timestamp>-<pid>/`. It reuses `SIGNAL_QA_URL`, an explicit `--base-url`, or an available local port 3000 server; otherwise it starts port 3107 and stops only that owned process in cleanup.

Use focused scenarios after a failure or for proportionate verification:

```powershell
npm run qa:market -- --scenario score-evidence --viewport 375 --no-screenshots
npm run qa:market -- --scenario controls --no-screenshots
```

Available scenarios are `all`, `score-evidence`, `controls`, and `smoke`. Pass `--full-page` only when the overall page shell is the subject; section captures are the default to avoid full-page stitching artifacts. Pass `--live` for a separate live-data smoke instead of coupling visual assertions to external Reddit, StockTwits, or provider availability.

### Targeted Header QA

For shared header or responsive navigation changes, use the deterministic one-session check instead of rebuilding an ad hoc browser probe:

```powershell
npm run qa:header
```

The command checks `/start`, `/`, and `/research` at 1280px, 768px, and 375px. It waits for the header and navigation to be visible after `domcontentloaded`, so it does not wait for unrelated upstream API requests. It measures the shared inner width, bottom hairline, navigation clipping, document overflow, command and theme control target sizes, and toggle behavior, and writes a fresh report plus header captures under `.tmp/signal-header-qa/<timestamp>/`.

Set `SIGNAL_QA_URL` or pass `--base-url` when the local server uses another port.

### Targeted Start Guide QA

For the guided daily-start route, run the deterministic responsive check against a local Signal server:

```powershell
npm run qa:start
```

The check intercepts current US market conditions and Discovery with dated fixtures, verifies the score-to-candidate-to-news-to-research sequence, confirms that a prior-day headline is excluded, exercises candidate selection, checks the shared Start navigation state, and captures the page without horizontal overflow at 1280px, 768px, and 375px. Set `SIGNAL_QA_URL` when the server uses another port.

When a failure identifies one affected surface, rerun only that scenario:

```powershell
npm run qa:header -- --route /research --viewport 375
```

Use `--no-screenshots` for a fast assertion-only pass. Same-origin console errors, page errors, failed requests, and HTTP responses remain blocking; aborted cleanup requests and external upstream failures are recorded as non-blocking evidence.

### Targeted Research Calendar QA

For the Calendar workspace, run the deterministic consolidated check against a local Signal server:

```powershell
npm run qa:research-calendar -- --base-url http://127.0.0.1:3000
```

The command covers direct `/research?workspace=calendar` restoration, 30-day and 90-day range changes, list and compact-calendar presentations, official macro cards and source links, market/ticker/event-type filtering, explicit request failure and retry, degraded earnings coverage, review-workflow and Events-tab destinations, keyboard-operable controls, document overflow, and blocking console/page/request failures at 1280px, 768px, and 375px.

Pass `--theme light` or `--theme dark` for a targeted theme-specific visual run. Use `--screenshot-dir <path>` to keep that run's captures separate from the default temporary screenshot directory.

Use a focused viewport only while iterating on a failure:

```powershell
npm run qa:research-calendar -- --base-url http://127.0.0.1:3000 --viewport 375 --no-screenshots
```

### Targeted Research Picker QA

For the trace-driven Picker journey, deterministic funnel counts, responsive stage layout, and
existing paper-basket boundary, run against a local Signal server:

```powershell
npm run qa:research-picker -- --base-url http://127.0.0.1:3000
```

The command covers setup, loading, selected candidate briefs, confirmed/partial/unconfirmed evidence,
exact saved-policy adjustments, collapsed fixed-reason rejection disclosure, methodology disclosure,
storage-unavailable paper-basket feedback, request failure and retry, no-match state, stage semantics,
selection order, disclosure mutation safety, exact Discovery request count, document overflow,
blocking console/request errors, and shortlist screenshots at
1280px, 768px, and 375px. Use `--viewport 375` only for a focused rerun after a failure.

### Targeted Research Readiness QA

For the ticker-level saved-state readiness strip and its owner navigation, run against a local
Signal server:

```powershell
npm run qa:research-readiness -- --base-url http://127.0.0.1:3000
```

The deterministic command covers the fixed next-gap precedence, collapsed seven-signal detail,
selected-ticker handoff to Evidence and Policy, Valuation/Alerts/Calendar destinations, no Research
mutation, first-viewport placement, document and strip overflow, blocking console/request errors,
and responsive captures at 1280px, 768px, and 375px.

### Targeted Research Continuity QA

For encrypted sync-vault and native-notification boundaries, run:

```powershell
npm run qa:research-continuity -- --base-url http://127.0.0.1:3000
```

The deterministic harness covers ciphertext-only push, mounted-page-only secrets, local pull/decryption, add-only import preview, stale-revision conflict handling, explicit notification permission, risk-only filtering, stable deduplication after reload, disable behavior, settings-service degradation, research mutation safety, document overflow, and blocking console/page/request failures at 1280px, 768px, and 375px.

### Targeted First-Run Setup And Guided Demo QA

For the browser-local setup lifecycle and isolated demonstration boundary, run:

```powershell
npm run qa:first-run -- --base-url http://127.0.0.1:3000
```

The consolidated deterministic check covers a first-ever empty launch, existing Research,
Portfolio, and Queue preservation, owner-backed setup completion, exact add/import/review
destinations, one saved review with a scheduled next review, optional monitoring skip, explicit
setup skip, reload/resume and idempotency, malformed setup recovery, corrupt Portfolio coexistence,
setup-only restart, analytics/request privacy, and document overflow at 1280px, 768px, and 375px.
It also exercises pointer and keyboard demo navigation across Market, Research, and Portfolio,
checks example/not-live labels on every demo panel, proves restart is session-only, and fails if
the demo makes an application API request or writes setup, Portfolio, or Queue state.

### Targeted Structured Thesis-Trigger QA

For structured rule authoring, revision safety, Alerts coverage, Queue handoff, and privacy boundaries, run:

```powershell
npm run qa:research-structured-triggers -- --base-url http://127.0.0.1:3000
```

The deterministic one-session check covers author/save/reload, settings-only payload preservation, stale-revision conflict feedback, matched/unavailable/disabled Alerts states, provider-degraded wording, deterministic per-rule Queue deduplication, browser-analytics privacy, keyboard-reachable controls, blocking console/page/request failures, and document overflow at 1280px, 768px, and 375px.

Use `--viewport 375` only for a focused rerun after a failure.

### Targeted Portfolio Import QA

For the read-only local portfolio import boundary, run:

```powershell
npm run qa:portfolio-import -- --base-url http://127.0.0.1:3000
```

The deterministic one-session check covers empty and restored snapshots, canonical template download, malformed and partial CSV previews, row-level errors, formula-like text display, add-only conflict preview, separately acknowledged exact replacement, explicit save, reload persistence, exact and unmatched research reconciliation, missing market values, actual-versus-planned separation, storage unavailability, keyboard focus, research-mutation safety, document overflow, and blocking console/page/request failures at 1280px, 768px, and 375px. The desktop flow also proves that one deduplicated Queue handoff records only fixed holdings-workflow actions through source return, review start, and completion, with no private portfolio content.

Use `--viewport 375` or `--screenshot-dir <path>` only for a focused rerun after a failure.

### Targeted Portfolio Transaction Import QA

For the browser-local transaction ledger and its privacy boundary, run:

```powershell
npm run qa:portfolio-transactions -- --base-url http://127.0.0.1:3000
```

The deterministic one-session check covers empty and restored ledgers, canonical template download, partial preview, formula-like input rejection, add-only conflict handling, separately acknowledged exact replacement, reload persistence, holdings immutability, raw-CSV and request privacy, storage unavailability, keyboard focus, document overflow, and blocking console/page/request failures at 1280px, 768px, and 375px.

Use `--viewport 375` or `--screenshot-dir <path>` only for a focused rerun after a failure.

### Targeted Portfolio Transaction Reconciliation QA

For the read-only comparison between browser-local transactions and holdings, run:

```powershell
npm run qa:portfolio-reconciliation -- --base-url http://127.0.0.1:3000
```

The deterministic one-session check covers exact quantity matches, quantity and cash differences, missing opening history, transaction-only and closed activity, account/currency separation, empty and one-sided source states, invalid and unavailable storage, same-tab refresh, holdings and transaction immutability, request privacy, document overflow, and blocking console/page/request failures at 1280px, 768px, and 375px. It also verifies that only non-matching exact Research securities expose an explicit Queue action, repeated account-level prompts deduplicate by ticker, Queue storage failures remain local and visible, the destination preserves `Portfolio reconciliation` provenance, one fixed reconciliation-workflow event is recorded without private content, and no account, quantity, difference, cost, currency, balance, transaction, or provenance data enters the task or analytics.

Use `--viewport 375` or `--screenshot-dir <path>` only for a focused rerun after a failure.

### Targeted Covered Portfolio Attribution QA

For evidence-limited, browser-local contribution reporting, run:

```powershell
npm run qa:portfolio-attribution -- --base-url http://127.0.0.1:3000
```

The deterministic check covers exact covered holdings, incomplete transaction history, unavailable prices, currency-scoped dividends/fees/taxes, unavailable realized and FX contribution, empty and invalid source states, source immutability, request privacy, document overflow, and blocking console/page/request failures at 1280px, 768px, and 375px.

### Targeted Portfolio What-If QA

For the session-only pre-trade sandbox, run:

```powershell
npm run qa:portfolio-what-if -- --base-url http://127.0.0.1:3000
```

The deterministic one-session check seeds an accepted holdings snapshot, exercises empty, incomplete, invalid, unmatched, missing-price, oversell, cash-deficit, valid, export, reset, storage-unavailable, and reload/no-resume states, and asserts the snapshot and research records are never mutated. It also checks keyboard access, document overflow, blocking console/page/request failures, and absence of authored scenario markers in network requests at 1280px, 768px, and 375px.

Use `--viewport 375` or `--screenshot-dir <path>` only for a focused rerun after a failure.

### Targeted Dividend And Cash-Flow QA

For browser-local dividend/cash planning, official provider discovery, revision safety, and privacy boundaries, run:

```powershell
npm run qa:dividend-cashflow -- --base-url http://127.0.0.1:3000
```

The consolidated deterministic check covers loading, empty holdings, exact account/currency separation, successful provider confirmation, unavailable and failed provider symbols, manual entry, edit, removal, reload, illustrative arithmetic, unsupported/unmatched holdings, stale local revision conflicts, Queue deduplication, storage unavailability, holdings/cash immutability, analytics privacy, request privacy, blocking console/page/request failures, and document overflow at 1280px, 768px, and 375px.

Use `--viewport 375` or `--screenshot-dir <path>` only for a focused rerun after a failure. Run `npm run qa:research-calendar` in the same final gate because the dividend surface extends the existing Calendar workspace and must preserve its research, macro, filtering, navigation, and responsive contracts.

### Visual QA Contract

Treat any UI request involving a screenshot, alignment, spacing, layout, visual polish, or “looks off” feedback as standard visual verification rather than a compile-only check.

For those changes, use a real Chromium browser and verify the affected surface at 1280px, 768px, and 375px widths. Inspect a fresh screenshot after the change and measure both the parent containers and the nested elements that establish the visual relationship. For aligned controls, compare the actual label and input/button/select top positions, heights, gaps, and shared baselines with a small pixel tolerance; do not verify only the outer panel rectangles.

Also verify the relevant interaction state, document-level overflow, overlap, console errors, and failed network requests. A visual change is not complete until the geometry assertions and browser checks pass. Report the result as a short scenario ledger with the tested widths and any skipped state named explicitly.

For Market V6, when the US payload includes `valuation_backdrop`, confirm the Buffett Indicator disclosure starts collapsed, opens by click and keyboard, is visibly labeled non-scored, and shows its report date and source links when expanded; Malaysia mode must not leave an empty valuation placeholder. When `market_context` is present, confirm its disclosure also starts collapsed and US shows the 10Y–3M, NFCI, and breadth cards without changing the score, while MY shows BNM-native MGS/OPR/MYOR context and no US proxy cards.

## API Smoke Checks

Use these when touching API routes or signal services:

```powershell
Invoke-RestMethod "http://localhost:3000/api/signals/v2?market=US&mode=standard&enableSocial=true"
Invoke-RestMethod "http://localhost:3000/api/signals/v2?market=MY&mode=contrarian&enableSocial=false"
```

Invalid request parameters should return a structured error instead of falling into service code.

Research journal API smoke checks should cover list, create, patch, invalid input, and delete through `/api/research/watchlist`.

Free-source research smoke checks should cover a US symbol with derived valuation and a one-year VOO Index Test, a Malaysia symbol with unavailable valuation and a not-applicable US benchmark, and an invalid market through `/api/research/symbol/[symbol]`. For the US response, verify candidate return, VOO return, relative return, and adjusted-close basis when both provider series expose it. Configure `SEC_USER_AGENT` with an app name and contact email before testing SEC EDGAR.

Research chart smoke checks should open the Chart tab at 1280px, 768px, and 375px; verify Clean shows EMA20, EMA50, SMA200, volume, RSI, and symmetric 1.5× ATR volatility-reference levels; verify Trend shows Supertrend and ADX/DMI; verify Levels shows selectable range-start/swing anchored VWAP plus the explicitly labeled daily-bar-estimated Volume Profile. The indicator guide must sit collapsed beneath the chart legend, expand by pointer and keyboard, explain every displayed indicator in plain language, and remain readable without horizontal overflow. Confirm relative strength rebases to 100 for VOO on US tickers and FBM KLCI on Malaysia tickers, range changes recalculate visible-range tools, controls remain keyboard reachable, the document has no horizontal overflow, and console/page/same-origin request failures remain blocking. ATR references are not entry-aware, directional, or trailing stops.

For a large SEC filer such as MSFT, call the symbol route twice and confirm both responses retain SEC fundamentals without a `Failed to set Next.js data cache` terminal error. Raw Company Facts responses must remain uncached; the normalized fundamentals cache owns the six-hour reuse window.

Trend discovery smoke checks should verify `/api/research/discovery` returns no more than ten leaders, ten contenders, and eight early trends; excludes high-risk and fundamentally unsupported results; preserves unconfirmed SEC coverage; reports scan, history, and institutional-ownership coverage; returns nullable cohort performance, catalysts, and ownership evidence; and renders score, sector, valuation, upcoming-earnings evidence, dated top-buyer details, the ownership causation caveat, contender reasons, and the collapsed/expanded states at desktop and mobile widths. Sector, risk, trend-stage, and valuation filters should combine with AND semantics, preserve original ranks, update the visible count, filter Contenders, and restore the full scan when reset.

Picker smoke checks should restore `workspace=picker`, retain setup until Run picker is activated, and reuse the validated Discovery response without generating another score. Exercise conservative and balanced profiles, every minimum-score, pick-count, and maximum-per-sector boundary, existing-watchlist exclusion, loading, provider error/retry, no-match, and result states. Seed a saved Discovery policy and verify the Picker preserves its disclosed rank adjustments and freezes its policy snapshot in a new basket. Start, reload, inspect, and remove a browser-local paper basket; verify its timestamp, measurement horizon, strategy, entry prices, sectors, scores, and independent quote refresh even when a selected symbol is absent from the latest Discovery response. At and after the due time, verify available candidate and VOO observations freeze once, basket and benchmark outcomes remain separate, partial coverage stays explicit, and a subsequent quote does not rewrite a resolved outcome. Confirm no Research record mutation, no candidate-specific probability or buy language, local table scrolling, and no document overflow at 1280px, 768px, and 375px.

Decision Review Lab checks should migrate legacy browser-local paper decisions to a three-month horizon and the market-appropriate VOO or FBM KLCI benchmark, while keeping US and Malaysia history keys separate. Verify 1M, 3M, 6M, and 1Y due dates; freeze the first available candidate and benchmark sessions on or after the due date; backfill a missing benchmark entry from the first session after recording; calculate maximum drawdown, maximum favorable move, benchmark-relative change, and act-or-pass decision effect; and never rewrite a resolved outcome. Cohort statistics must remain unavailable below five observations, become preliminary at five, and become established at twenty. In the browser, restore `workspace=outcomes`, record and reload a decision, exercise automatic success plus one independently degraded ticker, retain a due manual fallback, render evidence-gated action/confidence/horizon cohorts, emit no Research mutation, and avoid console/request failures or document overflow at 1280px, 768px, and 375px.

Since-last-visit and Today checks should reject malformed and cross-market signal payloads, unsafe alert symbols, invalid source-health entries, unknown checkpoint versions, duplicate record or market identities, and malformed, stale, unexpected-field, or unsupported-destination continuation records. Verify new and revised records, accepted-evidence fingerprints, overdue reviews, due Queue tasks, stronger/weaker market tiers, degraded sources affecting active workflows, and the source → risk → policy → overdue → Queue → earnings → evidence → market priority order with a strict top-three cap and identical priorities for identical inputs. In the browser, open the collapsed utility only after saved records are ready; restore `workspace=today` to verify automatic loading, the dominant top-three list, secondary local-only Continue action, compact overdue/upcoming/Alerts/Queue/Sources summaries, source/destination labels, and exact owning links with `returnTo=today`; prove success plus independently loading, partial, empty, and failed provider states; follow both Research and Market returns; save a checkpoint and reload to confirm stable zero-change comparison; emit no research, alert, Queue, or workflow mutation on load or navigation; keep authored/private content out of URLs, requests, logs, and analytics; and avoid settled console/request failures or document overflow at 1280px, 768px, and 375px. Direct `/research` without a workspace must continue to restore Watchlist until the Task 0 promotion gate passes.

Fundamental-history checks should combine concept-name transitions into distinct SEC annual periods, calculate revenue and share-count changes against the preceding comparable period, join Yahoo metric series by annual date, retain missing metrics as `null`, reject malformed periods or currencies, and cap output at five newest periods. Live API verification should prove one US ticker returns SEC USD history and one Malaysia ticker returns Yahoo MYR history without a false Bursa-source claim. In the browser, open both Fundamentals tabs, verify provider attribution, currency formatting, contained horizontal table scrolling, a partial-metric Malaysia state, and the saved-research fallback when the snapshot provider fails; confirm no settled console/request failures or document overflow at 1280px, 768px, and 375px.

Research workspace navigation checks should show exactly seven primary sections at desktop widths, expose Picker under Discovery, preserve every direct `workspace` query-string destination, and use separate section and workspace selectors on narrow screens. Exercise primary and secondary keyboard navigation, confirm the active states follow direct links, and verify no horizontal document overflow at 1280px, 768px, and 375px.

Research alert smoke checks should POST valid US and Malaysia ticker inputs, reject an invalid symbol with `400`, and render risk/opportunity/watch conditions at desktop and mobile widths.

Structured thesis-trigger checks should migrate missing legacy extensions to an empty version-1 set, recover malformed persisted extensions without losing the record, reject invalid enums/bounds/operator combinations/duplicates/more than ten rules, and cover every supported match and non-match including equality boundaries. Missing, stale, provider-degraded, disabled, and removed rules must be deterministic. Settings saves must preserve thesis text, decisions, and checklist fields; explicit reviews must freeze the rule set in immutable history. Browser checks must cover successful save/reload, `409` conflict, matched/unavailable/disabled/empty states, explicit Queue creation and per-rule deduplication, digest privacy/idempotency, keyboard use, console/request failures, and overflow at 1280px, 768px, and 375px.

Background notification checks should authenticate `/api/research/notifications/deliver`, verify unauthenticated requests fail, and run `?dryRun=true` to inspect the bounded `signal.research.digest.v1` payload without delivery. Pure regression coverage must reject plaintext or credential-bearing webhook URLs, keep the HMAC signature stable, send the digest key to the receiver, and cover successful, duplicate, and released-on-failure lifecycle paths. A configured database/webhook integration should additionally prove the 15-minute lease, persisted delivered state, and route-level duplicate response.

Persistent alert-center checks should reject malformed preference modes and UTC hours, apply overnight quiet hours correctly, filter urgent-only delivery to action items, and retain a bounded delivered/failed/duplicate history without returning webhook credentials. In the browser, restore the Alerts workspace, show server-persisted Research and device-local Market rule counts, save and reload delivery preferences, render configured and unconfigured webhook states, exercise empty delivery history, and keep active alerts usable when the settings API degrades.

Private sync checks should fail closed when `RESEARCH_SYNC_BEARER_SECRET` is absent or shorter than 32 characters, reject non-Bearer and incorrect credentials with no database access, use constant-time digest comparison, validate the existing bounded encrypted-backup envelope, and reject invalid or negative expected revisions. A configured integration must prove initial revision zero, monotonic remote revisions, parameterized ciphertext storage, `Cache-Control: no-store`, and a `409` response when the checked revision is stale. The browser must never place the access token, encryption passphrase, or research plaintext in local storage or the uploaded envelope.

Native notification checks should fail closed on malformed browser-local settings, preserve explicit permission and disable actions, keep risk-only and all-alert modes distinct, bound displayed text, and produce an order-stable digest. Browser verification must show one permission-test notification, one notification for a changed matching alert after reload, no duplicate for unchanged state, and no notification after disable. These checks must not claim service-worker or closed-tab delivery.

Research inbox smoke checks should POST valid watchlist inputs with per-ticker monitoring rules, reject malformed review dates and out-of-range thresholds, group repeated conditions under one ticker-level summary and Manage workflow, and render deterministic risk/opportunity, upcoming US earnings, stale reviews, and a distance-to-trigger label for every item. The default preview should show one ticker on mobile and two at wider widths, while Show more reveals every ticker group. Preserve provider warnings without blocking Research; switch between All, Action needed, Upcoming, and Snoozed without another request; and open the selected ticker from every visible item at desktop and mobile widths. Mark one ticker's conditions seen, snooze them, reload to prove the browser-local states persist, wake the snoozed ticker, and verify a changed condition becomes unread with a prior-to-current comparison while the first check establishes a quiet baseline. From Manage, save an optional quick note with Reviewed today and verify it appends a server-owned snapshot, advances the review date, and removes the stale item. Change and restore monitoring thresholds with `mode: settings`, then verify the values persist without changing review history or `lastReviewedAt`. After two saved reviews, verify Saved thesis names the materially changed fields; before that, it must state that no prior comparison exists.

Research calendar smoke checks should POST zero to fifty validated record summaries to `/api/research/calendar`, default to an inclusive 30-day UTC window, accept the 90-day window, and reject unknown ranges, markets, tickers, event types, malformed dates, duplicate symbols, and unsafe destinations. Verify stable event IDs, chronological ordering, provider deduplication, exact day-30/day-90 inclusion, and exclusion beyond the boundary. FOMC parsing uses the decision day, BLS preserves its official Eastern release time, OpenDOSM retains only inflation/employment/growth releases, and macro relevance includes same-market tracked symbols without claiming ticker-specific sensitivity. Provider failures must remain isolated: a Nasdaq failure retains journal and macro events, while a macro failure retains journal and earnings events with a warning. In the browser, verify list and compact calendar views, macro cards and official source links, all client-side filters, changed-date disclosure from browser-local prior state, explicit source-date/time labels, local generated time, loading/empty/error/retry states, direct URL restoration, deep links to Events and the editable review workflow, and no saved-record mutation from opening an event.

Research strategy-template checks should keep six unique templates: Core, Quality compounder, Growth, Value, Income, and Turnaround. Every template must guide all seven narrative fields with question-led prompts and expose at least three evidence priorities. Unknown identifiers fall back to Core. In the browser, switch between at least two strategy lenses, verify the prompts and evidence focus change while narrative values and checklist state remain byte-for-byte unchanged, then Cancel and confirm the editor returns to its collapsed read-only state. Confirm no research mutation request, blocking console/network error, or document overflow at 1280px, 768px, and 375px.

Market alert smoke checks should add a threshold condition, persist it across a reload, show whether it is monitoring or currently triggered, manually refresh market conditions and update the last-checked time, remove the condition, and keep rules separated by market, interpretation mode, and social-source setting. Rapid configuration changes must not allow an older response to replace the latest selection. These alerts are browser-local and are evaluated when market conditions refresh; they do not imply background push delivery.

Research comparison smoke checks should select one, two, and three watchlist securities; disable a fourth selection; render live metrics and explicit unavailable states; open a compared ticker back in Research; and keep the table inside its own scroller without document-level overflow at desktop and mobile widths. The research journal should open as read-only details exposing the persisted bear case plus buy and sell triggers; Submit review should reveal editable fields, and Cancel should discard unsaved changes.

Decision-journal smoke checks should capture the server-calculated decision plus client-observed price, available benchmark return, confidence, and next-review date in an immutable snapshot. The server must canonicalize the immediately preceding review link, prevent settings updates from changing journal fields, and reject a stale integer row revision with `409`. A later review resets its outcome assessment to unresolved when it begins. Position-plan checks should reject allocation above 100%, calculate portfolio-at-risk only from a valid lower invalidation price, aggregate owned-sector allocations, preserve legacy `{}` JSON defaults, and remain explicitly separate from transactions or brokerage balances.

Decision-outcome analytics checks should count only later reviews with a valid canonical prior-review link, keep unresolved assessments separate from resolved outcome totals, group the assessed decision and confidence rather than the later review state, and derive observed-price change only when both linked reviews contain valid positive prices. In the browser, restore `workspace=outcomes`, switch every breakdown, open a recent assessment back into Research, verify the empty state with no linked history, and keep tables locally scrollable without document overflow at 1280px, 768px, and 375px.

Portfolio cockpit checks should aggregate only positive planned allocations, report unallocated or overallocated capacity, exclude incomplete invalidation inputs from defined risk, and disclose risk-covered allocation. History calculations require at least 20 overlapping daily returns for beta and correlation, use VOO for US and FBM KLCI for Malaysia, and degrade per position without hiding partial coverage. In the browser, restore `workspace=portfolio`, change the user-defined shock, verify allocation-weighted scenario changes, open a position back into Research, exercise empty and partial-history states, and keep exposure, metric, and correlation tables locally scrollable without document overflow at 1280px, 768px, and 375px.

Saved portfolio scenario checks should reject malformed or targetless scoped entries, clamp shocks to -100% through 100%, replace duplicate identities, cap the library at eight, and report targeted allocation coverage. Browser verification should save, reload, and remove a scenario, confirm the allocation-weighted result and browser-local payload, emit no research-record mutation, and avoid document overflow at 1280px, 768px, and 375px.

Paper-decision checks should reject malformed or non-positive observed prices, normalize ticker symbols, bound rationales and retained history, preserve act versus pass, and calculate only the later market move. Browser verification should record, resolve, reload, and remove an entry, confirm the browser-local payload, avoid research-record mutations, and check 1280px, 768px, and 375px for document overflow.

Relationship-graph checks should deduplicate nodes and provider names, create edges only for a shared known sector or accepted-evidence provider, expose every explicit reason, and avoid treating shared market membership as a link. Browser verification should restore `workspace=relationships`, focus a ticker, filter sector and provider links, navigate through a connected ticker, and avoid document overflow at 1280px, 768px, and 375px.

Manual cross-device transfer checks inherit all encrypted-backup tests: no plaintext in the envelope, AES-GCM authenticated decryption, wrong-passphrase rejection, strict payload validation, record and file-size bounds, and explicit conflict policy. Also classify incoming records as new, incoming newer, local newer, or the same revision. Browser verification should generate a package, confirm the envelope exposes no research plaintext, paste and decrypt it locally, review revision counts without importing, and avoid document overflow at 1280px, 768px, and 375px.

Peer-benchmark checks should calculate medians from available peers only, preserve per-metric coverage, reverse percentile direction for lower-is-better valuation and leverage metrics, and leave subject or peer metrics unavailable rather than substituting zero. In the browser, restore `workspace=peers`, change the subject, add and remove peers up to the five-peer limit, verify same-industry/same-sector/custom reasons, retain usable peers when one snapshot fails, and keep the benchmark table locally scrollable without document overflow at 1280px, 768px, and 375px.

Source-health checks should keep healthy, degraded, unconfigured, and unchecked states distinct; never infer provider health from configuration alone; bound every live network probe; avoid sending notification or model requests; and omit secrets and raw provider payloads. In the browser, restore `workspace=health`, filter every status, rerun checks, preserve a prior report when refresh fails, render the initial error state, and verify no document overflow at 1280px, 768px, and 375px.

Historical replay checks should validate market, mode, source-toggle, and exact ISO date parameters; return no more than 180 summaries; expose full evidence only for observed rows with persisted components; and exclude reconstructed score-only rows from replay selection. Snapshot comparison must report score, agreement, tier, and changed-component differences from stored values only. In the browser, restore `workspace=replay`, change configuration, select and compare observed dates, exercise no-full-snapshot and detail-error states, and keep component tables locally scrollable without document overflow at 1280px, 768px, and 375px.

Decision-packet checks should freeze a supplied timestamp and saved research revision, preserve decision confidence, review date, checklist state, accepted evidence links, limitations, and optional persisted market context, and use a sanitized deterministic filename. In the browser, restore `workspace=packets`, generate with and without market context, verify the Markdown download filename and content, open the print-ready document, exercise the empty-record state, and confirm no document overflow at 1280px, 768px, and 375px.

Workflow-analytics checks should reject unknown names, sources, attributes, malformed workflow UUIDs, unexpected keys, and free-form event properties; prune events older than 180 days; cap retained history at 2,000 events; deduplicate event IDs; keep failed review saves out of completion totals; and calculate active days, sessions, meaningful actions, workspace adoption, pathway openings, correlated Today destination reaches, reach percentage, correlated completions, completion percentage, pathway active days and last use, and filled daily windows. Repeated destination events for one Today workflow must count once, and destination events without a matching opened workflow must not count. Browser checks should restore `workspace=usage`, prove events remain in local storage with no analytics network request, exercise the 7/30/90-day ranges, immediate disable, two-step history removal, and event generation from Today to both Research and Market destinations, Calendar, Alerts, Queue start/completion, Research review save, and the existing meaningful-action entry points. Verify local history never contains symbols, company names, thesis or note text, evidence, URLs, accounts, holdings, quantities, amounts, or provider payloads and confirm no document overflow at 1280px, 768px, and 375px.

Market-to-watchlist exposure checks should prove that only same-market names are included, owned names are prioritized without changing connection strength, active driver direction is preserved, cyclical/defensive/ETF rules are deterministic, and unknown sectors stay explicitly unmapped. Browser verification should cover saved-watchlist success, built-in fallback, empty-market, and active-driver-unavailable states; each Review link must retain the bounded market handoff and open the selected ticker's editable review. Confirm the disclosure does not imply beta, price sensitivity, holdings look-through, or a recommendation, and check local horizontal scrollers plus document overflow at 1280px, 768px, and 375px.

Thesis-change inbox checks should distinguish unseen, changed, and identical accepted evidence by source identity, value, and reporting period; reject source-less findings through the existing assistant boundary; and preserve the frozen source snapshot when staging. Browser verification should restore `workspace=changes`, cover bounded loading, partial-provider, total-error, pending-empty, dismissed, and unchanged-visible states, and prove that Stage evidence opens the intended editable review with the evidence attached while every thesis textarea remains byte-for-byte unchanged until the user edits it. Cancellation must discard the draft, and the workspace must not overflow at 1280px, 768px, or 375px.

Evidence-coverage checks should classify empty fields as missing, unsourced saved analysis as assumptions, current sourced analysis as supported, aged reporting periods as stale, and mixed positive/risk findings as conflicting. Reporting periods must take precedence over recently accepted old evidence, and empty thesis text must remain missing even when evidence is attached. Browser verification should restore `workspace=evidence`, switch tickers, display all five states and explicit freshness rules, open Research without entering edit mode, queue a deduplicated evidence review with provenance, emit no research-record mutation, and avoid document overflow at 1280px, 768px, and 375px.

Investment-policy checks should reject malformed limits, aggregate positive planned allocations by sector, detect single-name and sector breaches, enforce the configured evidence and review-age rules, and apply the optional cheap/fair valuation requirement only to Ready/DCA decisions. Browser verification should restore `workspace=policy`, edit and persist each setting, reload the policy, show compliant and breached records, queue a deduplicated policy review with provenance, preserve every saved decision, emit no research-record mutation, and avoid document overflow at 1280px, 768px, and 375px.

Currency-performance checks should reject malformed FX assumptions and adjustments, separate local security return from FX contribution, compound price and FX before dividend/fee adjustments, handle MYR and USD base directions correctly, and preserve unavailable states when cost basis or current price is missing. Browser verification should restore `workspace=currency`, change and persist base/FX assumptions plus one ticker adjustment, reload the settings, show both calculated and unavailable records, open Research without editing, emit no research-record mutation, and avoid document overflow at 1280px, 768px, and 375px.

Filing-evidence diff checks should use the second-newest immutable review as the baseline, detect added, changed, removed, and unchanged source versions, preserve reporting periods and citations, categorize only through deterministic labels, and disclose when no prior baseline exists. Browser verification should restore `workspace=filings`, switch to a record with evidence, exercise change/category/unchanged filters, open a citation, queue a deduplicated post-event review with `Filing evidence` provenance, emit no research-record mutation, and avoid document overflow at 1280px, 768px, and 375px.

Primary-document evidence checks should migrate legacy evidence arrays to an empty version-1 citation set, visibly recover malformed persisted sets, enforce the 25-citation and 2,000-character excerpt bounds, preserve literal markup as text, require credential-free HTTPS URLs, enforce record ownership, and reject mismatched fingerprints. Evidence-only saves must leave thesis, checklist, accepted provider evidence, monitoring rules, decision journal, position plan, and review history unchanged while still using optimistic revisions. Full reviews must freeze citations. Diff tests cover added, changed, removed, and unchanged captures; Queue tests use stable digest deduplication; analytics fixtures must contain no symbol, URL, title, excerpt, location, or digest.

Explicit factor-exposure checks should migrate missing sets to empty, visibly recover malformed persisted sets, reject custom factors, invalid enums/dates, duplicate factors, more than ten assumptions, notes over 500 characters, and evidence IDs not owned by the current record. Factor-only saves must leave thesis, checklist, decision journal, position plan, monitoring rules, accepted evidence, document citations, and review history byte-for-byte unchanged under optimistic revision protection; full reviews must freeze the current factor set. Portfolio calculations must use exact market+symbol reconciliation, isolate every account/currency, weight only known current values, retain missing-price/unmatched/no-assumption counts, keep value coverage separate from direction share and holding-count coverage, and avoid input mutation. Browser QA at 1280px, 768px, and 375px covers empty/add/edit/remove, evidence-link unavailable, save/reload/conflict, malformed recovery, no holdings, storage unavailable, unmatched, missing quote, undeclared, partial/populated, filters, Queue deduplication, keyboard focus, local table overflow, console/page/network failures, analytics privacy, and proof that blanks remain `Not declared` rather than inferred neutral.

Run the deterministic browser lane against an owned local server:

```powershell
npm run qa:research-factor-exposure
```

SEC discovery tests must prove configured operator contact, fixed `www.sec.gov` and `data.sec.gov` origins, redirect rejection, bounded timeouts/cache/result counts, supported-form filtering, CIK/accession/path validation, deterministic official URLs, malformed/upstream degradation, and absence of browser-supplied fetch targets. Missing `SEC_USER_AGENT` must fail closed. Browser QA at 1280px, 768px, and 375px covers loading, result, empty, and degraded SEC states; manual Malaysia capture; text-only preview; explicit save/reload/edit/confirmed-remove/conflict; immutable revision comparison; Queue deduplication; keyboard and source-link operation; document overflow; and blocking console/page/same-origin request failures.

Run the deterministic browser lane against an owned local server:

```powershell
npm run qa:research-primary-documents
```

Market score sensitivity checks should reproduce the live coverage-aware composite at unchanged inputs, preserve neutral reserve and configured weights, clamp normalized overrides to 0–100, apply Momentum and Contrarian tier thresholds, and identify simulated alignment conflicts by the same positive/neutral/negative grouping as the engine. Browser verification should exercise both ±15 presets, one direct slider boundary, reset, a tier transition, current weight-regime disclosure, no-driver state, and the privacy-safe local event. Confirm the live score remains unchanged and there is no overflow at 1280px, 768px, or 375px.

Research workflow queue checks should reject malformed tasks and source labels, migrate older tasks to manual provenance, cap local history at 100, replace by task ID, keep pending tasks ahead of completed work, deduplicate pending connected tasks by ticker/template/source while retaining the earliest due date, and preserve each fixed template's field list. Every connected source must resolve to its owning Market or Research workspace, while manual tasks must have no invented destination. Browser verification should create an overdue task, reload to prove local persistence, complete/reopen/remove tasks, and start at least Earnings update and Valuation refresh. Queue a review from Thesis Changes, Calendar, Alerts, Market Exposure, an exact Portfolio holdings match, and an exact non-matching Portfolio reconciliation row; confirm the appropriate template, source badge, due date, same-tab update, duplicate response, and source-return action. Portfolio Queue tasks must exclude account, quantity, difference, cost, currency, balance, transaction, and provenance data, while unmatched or non-actionable rows must not expose the action. The focused editor must show only the template's narrative fields while retaining checklist, thesis strength, valuation, target zone, position plan, decision journal, accepted evidence, cancel, and Save review. Confirm queue actions and source navigation never mutate Queue tasks or research records and check document overflow at 1280px, 768px, and 375px.

For the consolidated source-navigation browser check, run:

```powershell
npm run qa:research-queue -- --base-url http://127.0.0.1:3000
```

Encrypted-backup checks should prove that research plaintext is absent from the envelope, AES-GCM round-trips a fully validated record and review history, the wrong passphrase fails, duplicate symbols and malformed records are rejected, and only `add-only` or `replace-existing` conflict policies cross the restore boundary. Browser verification should restore `workspace=backup`, download a `.signal-backup`, decrypt it locally, show the timestamp/record/symbol preview, reject a wrong passphrase and files over 2 MB, keep add-only as the default, require the explicit replacement acknowledgement, and verify import counts. Add-only must leave matching records untouched; replacement must preserve imported review history and advance the server revision without deleting unrelated records. Confirm no passphrase or encrypted-file upload occurs before the explicit import, and check document overflow at 1280px, 768px, and 375px.

Command-palette, universal local-search, and saved-view checks should reject malformed workspace, ticker, tab, filter, and density values; deduplicate names case-insensitively; cap storage at eight views; and fall back to comfortable density. Local-search regression must build only from validated saved records and parsed Queue tasks; cover Ticker, Research, Evidence, Filings, and Queue groups; enforce the two-character/80-character query bounds plus eight-results-per-owner cap; exclude evidence values, source URLs, filing excerpts/digests, Queue dedupe keys, and unrelated private state; preserve inputs byte-for-byte; and resolve the exact owning destination. Browser verification should open the palette with Ctrl/Cmd+K from both Market and Research, filter commands, use Arrow keys/Enter/Escape, restore focus, and cover loading, empty, large-result, saved-record-error, and Queue-storage-unavailable states. Select representative authored Research, filing-identifier, and Queue-task results; verify the exact ticker/workspace/tab/task, preserve unrelated URL parameters, and confirm no search request, query/content analytics capture, Research mutation, or Queue mutation. Run the matrix at 1280px, 768px, and 375px with focus visibility, contained palette scrolling, snippets/destination labels, and no document overflow. Existing command and saved-view coverage still runs representative Market configuration, Research workspace, ticker, and saved-view commands; save, replace, apply, reload, and remove a named Research view and verify its workspace, query/filter, ticker, detail tab, and density state.

First-run setup checks should accept only the version-1 fixed lifecycle, US/MY, completion-step,
and optional-monitoring enums; reject duplicates, unknown fields, unsupported versions, and
malformed timestamps; preserve input owner records; derive completion only from validated saved
Research, review history, next-review dates, structured rules, and accepted Portfolio presence;
and keep reconciliation deterministic and idempotent. In the browser, confirm an empty first
launch opens setup while existing owner state does not, every setup action reaches its existing
owner, skip and restart change only setup state, corrupt setup remains recoverable without
clearing corrupt or valid owner state, direct `/research` still restores Watchlist, and `/demo`
remains fixed, clearly labelled, request-free, mutation-free, keyboard operable, and responsive.

Discovery-universe policy checks should preserve default rank and score with the default policy, apply eligibility before preferences, retain exclusion reasons, limit preferences to three unique values, cap saved policies at five, and show default rank plus exact adjustment reasons after reranking. Browser verification should create and save a sector/liquidity/risk policy, reload and explicitly apply it, exercise a policy that yields no eligible candidates, reset to default, remove the saved policy, and prove the US-only coverage disclosure. Confirm existing Discovery filters still act after policy eligibility and check document overflow at 1280px, 768px, and 375px.

Discovery workspace checks should seed a prior visit, verify new entrants plus material rank/risk/valuation/catalyst changes, save a named filtered view, reload and restore it without another provider request, remove it, and preserve no-overflow behavior at 1280px, 768px, and 375px.

Market calibration checks should cover 7-day and 30-day average and median forward returns, positive-period frequency, observed range, Momentum and Contrarian directional alignment, all four score zones, missing future outcomes, and the five-observation disclosure threshold. Each horizon baseline must use every eligible score-snapshot outcome in the same calibration dataset, retain observed/reconstructed provenance, calculate its median from underlying returns rather than zone aggregates, and retain the validated raw score-to-return observations used by the visualization. The synchronized timeline may also include tagged weekly limited-history rows, must rebase the benchmark from the first visible close after every range change, retain tier/origin/model/coverage metadata, and never relabel stored reconstructed rows as observed. Rows with `validation_eligible: false` must remain visible in the timeline while being absent from every horizon baseline, cohort, observation plot, evidence level, and mismatch case. The timeline's `1M`, `3M`, `6M`, `1Y`, `3Y`, `5Y`, and `All` controls must filter by the latest available snapshot date, report visible versus total snapshots, and remain locally scrollable on narrow screens. Mechanically selected validation cases must classify 30-day directional misses and aligned periods from the stored tier, rank them by absolute move, and disclose neutral-tier moves at or above 5%. US reconstruction checks must prove that stored VIX/social inputs use the current scorer, source-toggle and mode semantics are preserved, invalid rows are excluded, observed dates take precedence, and partial provenance remains visible. Browser assertions must place the concise current-zone outcomes before Why this score, open detailed calibration on the timeline, exercise the range controls and all five tabs, render accessible one-week and one-month score-to-return plots, retain the unconditional baseline row, disclose mismatch selection, state that out-of-sample evidence is not yet available, keep all tables inside local scrollers, reuse insufficient/preliminary/established evidence levels, keep malformed or missing horizons unavailable, and retain the overlapping-observation and non-prediction limitation. The same dedicated current-zone summary must not also render inside Historical calibration.

Assisted research smoke checks should generate findings for a US symbol, show whether synthesis is AI-assisted or evidence-based, retain source links and reporting periods, accept one finding into its intended journal field without overwriting existing text, dismiss another finding, refresh the queue, and save the accepted draft. After reload, the accepted-evidence section must retain the finding and source links, while Review history must show a new timestamped snapshot and identify fields changed from the preceding review. Removing evidence before save must remove its provenance without silently deleting the journal text. With `KIMI_API_KEY` unavailable, the evidence-based fallback must remain usable. Malformed or source-less findings, unsafe source URLs, oversized evidence collections, and client-supplied review-history rewrites must be rejected or ignored at the boundary. The Index Test should remain evidence-only and must not automatically toggle the persisted `betterThanCashOrIndex` checklist field.

Historical valuation checks must keep historical prices, period-correct filing fundamentals, and analyst estimate/revision history as three separate capabilities. Deterministic fixtures cover accession-only fact selection, fiscal-period/current-frame selection, exact duplicates, conflicting duplicates, `10-K/A` changed inputs, USD units, strict post-filing price selection, non-trading days, later stock splits, formula outputs, negative earnings, missing capex, currency mismatch, source links, partial/provider failure, unsupported Malaysia coverage, unavailable analyst revisions, client response bounds, and the eight-observation/4,000-price-row limits. The implementation must never use a same-day close, current fundamentals, cross-accession facts, or proxy analyst signals.

Browser QA at 1280px, 768px, and 375px covers delayed loading, complete success, partial coverage, total provider error with retry, empty/unsupported output, capability cards, metric controls, discrete chart semantics, accessible table, formula/source details, local table scrolling, and document overflow. It asserts the historical endpoint is a body-free `GET` containing only symbol and market, no watchlist mutation occurs, and browser-local holdings/account/cash/factor markers never enter request URLs or bodies.

Run the deterministic browser lane against an owned local server:

```powershell
npm run qa:historical-valuation
```

## Current Test Gap

There is no dedicated unit test runner configured yet. Until one is added, lint, typecheck, build, harness checks, API smoke tests, and browser checks are the available verification surfaces.

## PWA and Web Push

Run deterministic manifest, cache, auth, validation, encryption, payload, and delivery-policy checks:

```powershell
npm run test:pwa
```

The regression covers manifest/install metadata, the exact static precache allowlist, API/research/admin deny rules, obsolete cache cleanup, network-only navigation fallback, explicit update confirmation, direct-gesture permission gating, unsupported/denied/misconfigured states, bearer and same-origin mutation protection, endpoint HTTPS/provider allowlisting, body/key/count/expiration bounds, idempotent ownership, AES-GCM encryption and tamper rejection, private-field redaction, same-origin click paths, dedupe tags, retry/backoff, fifth-attempt disable, 404/410 cleanup, and no endpoint material in source logging or analytics.

Run the production-runtime browser lane:

```powershell
npm run qa:pwa
```

Use an owned localhost production server and one service-worker-enabled Chromium session. Cover install metadata, registered scope, exact Cache Storage contents, online/offline/reconnect fallback, last-online disclosure, waiting-update confirmation, direct-gesture subscription mocks without external push traffic, denied/unsupported/misconfigured/error/subscribed/unsubscribed states, the local-only notification message path, safe notification navigation, console/network/privacy assertions, and document overflow at 1280, 768, and 375 pixels. Lifecycle notices must remain in document flow without covering interactive content; install, retry, and update actions must be keyboard operable, at least 40px tall, and the optional install invitation must expose an explicit deferral action.

## Harness And Eval Evidence

Follow `docs/HARNESS.md` for harness design. Future Codex or agent evals should keep raw traces and run artifacts under `.tmp/`, use deterministic checks first, and promote curated fixtures only when they are stable enough to review.
