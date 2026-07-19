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

The command checks `/` and `/research` at 1280px, 768px, and 375px. It waits for the header and navigation to be visible after `domcontentloaded`, so it does not wait for unrelated upstream API requests. It measures the shared inner width, bottom hairline, navigation clipping, document overflow, and toggle behavior, and writes a fresh report plus header captures under `.tmp/signal-header-qa/<timestamp>/`.

Set `SIGNAL_QA_URL` or pass `--base-url` when the local server uses another port.

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

The command covers direct `/research?workspace=calendar` restoration, 30-day and 90-day range changes, list and compact-calendar presentations, market and event-type empty states, explicit request failure and retry, degraded earnings coverage, review-workflow and Events-tab destinations, keyboard-operable controls, document overflow, and blocking console/page/request failures at 1280px, 768px, and 375px.

Pass `--theme light` or `--theme dark` for a targeted theme-specific visual run. Use `--screenshot-dir <path>` to keep that run's captures separate from the default temporary screenshot directory.

Use a focused viewport only while iterating on a failure:

```powershell
npm run qa:research-calendar -- --base-url http://127.0.0.1:3000 --viewport 375 --no-screenshots
```

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

Research alert smoke checks should POST valid US and Malaysia ticker inputs, reject an invalid symbol with `400`, and render risk/opportunity/watch conditions at desktop and mobile widths.

Background notification checks should authenticate `/api/research/notifications/deliver`, verify unauthenticated requests fail, and run `?dryRun=true` to inspect the bounded `signal.research.digest.v1` payload without delivery. Pure regression coverage must reject plaintext or credential-bearing webhook URLs, keep the HMAC signature stable, send the digest key to the receiver, and cover successful, duplicate, and released-on-failure lifecycle paths. A configured database/webhook integration should additionally prove the 15-minute lease, persisted delivered state, and route-level duplicate response.

Research inbox smoke checks should POST valid watchlist inputs with per-ticker monitoring rules, reject malformed review dates and out-of-range thresholds, group repeated conditions under one ticker-level summary and Manage workflow, and render deterministic risk/opportunity, upcoming US earnings, stale reviews, and a distance-to-trigger label for every item. The default preview should show one ticker on mobile and two at wider widths, while Show more reveals every ticker group. Preserve provider warnings without blocking Research; switch between All, Action needed, Upcoming, and Snoozed without another request; and open the selected ticker from every visible item at desktop and mobile widths. Mark one ticker's conditions seen, snooze them, reload to prove the browser-local states persist, wake the snoozed ticker, and verify a changed condition becomes unread with a prior-to-current comparison while the first check establishes a quiet baseline. From Manage, save an optional quick note with Reviewed today and verify it appends a server-owned snapshot, advances the review date, and removes the stale item. Change and restore monitoring thresholds with `mode: settings`, then verify the values persist without changing review history or `lastReviewedAt`. After two saved reviews, verify Saved thesis names the materially changed fields; before that, it must state that no prior comparison exists.

Research calendar smoke checks should POST one to fifty validated record summaries to `/api/research/calendar`, default to an inclusive 30-day UTC window, accept the 90-day window, and reject unknown ranges, markets, tickers, event types, malformed dates, duplicate symbols, and unsafe destinations. Verify stable event IDs, chronological ordering, provider deduplication, exact day-30/day-90 inclusion, and exclusion beyond the boundary. A Nasdaq failure must retain scheduled and stale-review events with one warning. In the browser, verify list and compact calendar views, all client-side filters, changed-date disclosure from browser-local prior state, explicit UTC source dates, local generated time, loading/empty/error/retry states, direct URL restoration, deep links to Events and the editable review workflow, and no saved-record mutation from opening an event.

Market alert smoke checks should add a threshold condition, persist it across a reload, show whether it is monitoring or currently triggered, manually refresh market conditions and update the last-checked time, remove the condition, and keep rules separated by market, interpretation mode, and social-source setting. Rapid configuration changes must not allow an older response to replace the latest selection. These alerts are browser-local and are evaluated when market conditions refresh; they do not imply background push delivery.

Research comparison smoke checks should select one, two, and three watchlist securities; disable a fourth selection; render live metrics and explicit unavailable states; open a compared ticker back in Research; and keep the table inside its own scroller without document-level overflow at desktop and mobile widths. The research journal should open as read-only details exposing the persisted bear case plus buy and sell triggers; Submit review should reveal editable fields, and Cancel should discard unsaved changes.

Decision-journal smoke checks should capture the server-calculated decision plus client-observed price, available benchmark return, confidence, and next-review date in an immutable snapshot. The server must canonicalize the immediately preceding review link, prevent settings updates from changing journal fields, and reject a stale integer row revision with `409`. A later review resets its outcome assessment to unresolved when it begins. Position-plan checks should reject allocation above 100%, calculate portfolio-at-risk only from a valid lower invalidation price, aggregate owned-sector allocations, preserve legacy `{}` JSON defaults, and remain explicitly separate from transactions or brokerage balances.

Discovery workspace checks should seed a prior visit, verify new entrants plus material rank/risk/valuation/catalyst changes, save a named filtered view, reload and restore it without another provider request, remove it, and preserve no-overflow behavior at 1280px, 768px, and 375px.

Market calibration checks should cover 7-day and 30-day average and median forward returns, positive-period frequency, observed range, Momentum and Contrarian directional alignment, all four score zones, missing future outcomes, and the five-observation disclosure threshold. Each horizon baseline must use every eligible score-snapshot outcome in the same calibration dataset, retain observed/reconstructed provenance, calculate its median from underlying returns rather than zone aggregates, and retain the validated raw score-to-return observations used by the visualization. The synchronized timeline may also include tagged weekly limited-history rows, must rebase the benchmark from the first visible close after every range change, retain tier/origin/model/coverage metadata, and never relabel stored reconstructed rows as observed. Rows with `validation_eligible: false` must remain visible in the timeline while being absent from every horizon baseline, cohort, observation plot, evidence level, and mismatch case. The timeline's `1M`, `3M`, `6M`, `1Y`, `3Y`, `5Y`, and `All` controls must filter by the latest available snapshot date, report visible versus total snapshots, and remain locally scrollable on narrow screens. Mechanically selected validation cases must classify 30-day directional misses and aligned periods from the stored tier, rank them by absolute move, and disclose neutral-tier moves at or above 5%. US reconstruction checks must prove that stored VIX/social inputs use the current scorer, source-toggle and mode semantics are preserved, invalid rows are excluded, observed dates take precedence, and partial provenance remains visible. Browser assertions must place the concise current-zone outcomes before Why this score, open detailed calibration on the timeline, exercise the range controls and all five tabs, render accessible one-week and one-month score-to-return plots, retain the unconditional baseline row, disclose mismatch selection, state that out-of-sample evidence is not yet available, keep all tables inside local scrollers, reuse insufficient/preliminary/established evidence levels, keep malformed or missing horizons unavailable, and retain the overlapping-observation and non-prediction limitation. The same dedicated current-zone summary must not also render inside Historical calibration.

Assisted research smoke checks should generate findings for a US symbol, show whether synthesis is AI-assisted or evidence-based, retain source links and reporting periods, accept one finding into its intended journal field without overwriting existing text, dismiss another finding, refresh the queue, and save the accepted draft. After reload, the accepted-evidence section must retain the finding and source links, while Review history must show a new timestamped snapshot and identify fields changed from the preceding review. Removing evidence before save must remove its provenance without silently deleting the journal text. With `KIMI_API_KEY` unavailable, the evidence-based fallback must remain usable. Malformed or source-less findings, unsafe source URLs, oversized evidence collections, and client-supplied review-history rewrites must be rejected or ignored at the boundary. The Index Test should remain evidence-only and must not automatically toggle the persisted `betterThanCashOrIndex` checklist field.

## Current Test Gap

There is no dedicated unit test runner configured yet. Until one is added, lint, typecheck, build, harness checks, API smoke tests, and browser checks are the available verification surfaces.

## Harness And Eval Evidence

Follow `docs/HARNESS.md` for harness design. Future Codex or agent evals should keep raw traces and run artifacts under `.tmp/`, use deterministic checks first, and promote curated fixtures only when they are stable enough to review.
