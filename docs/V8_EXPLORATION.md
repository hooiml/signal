# Signal V8 exploration

## Release cleanup - 10 September 2026

The approved cleanup retires the separate `/main-v8-gemini` and `/research-v8-gemini` experiment, its private components, capture script and 26 related local screenshots. Eight unreferenced legacy components were removed: `MarketTabs`, `RedditFeed`, and V2 `IndicatorAgreement`, `IndicatorList`, `SignalGauge`, `SignalQualityPanel`, `StockIndicator` and `StrategyPresets`. The obsolete root `debug_output.json` and `validation_summary.json` reports were also removed. Current source-reference checks found no active consumers of these components.

Active V6/V7/V8 routes, earlier rollback routes, shared helpers, scoring, APIs and persisted data are retained. Existing V6/V7 work remains outside this release's staged scope. Retained local QA captures under `output/` are ignored; generated repo-map enumeration excludes local capture folders and generated Next type declarations so checkout verification is reproducible. Older design briefs are labelled as historical where they name retired owners.

Release verification used an isolated export of the staged index with its own locked dependency installation and production server at `http://127.0.0.1:3108`. Full lint, typecheck, harness (Research and Learn regressions) and production build passed. Chromium passed 47 version-navigation checks, 52 connected Market checks, 89 connected Research checks, 82 demo checks and nine shared-header scenarios at 1280/768/375 pixels. Fresh screenshots were inspected; Research writes were blocked and the saved-watchlist hash was unchanged. Direct Market runtime proof matched score 60 and all 488 timeline observations returned in that run. Values and provider availability remain time-sensitive.

Two focus assertions now wait for their existing animation-frame focus changes, and the historical missing-evidence test selects a score-only date from response metadata rather than assuming the oldest date lacks evidence. Legacy V7 QA opens `/main-v7`; Queue's default-Market handoff expects `/main-v8`. No production behavior was changed to satisfy these test corrections. The repo-map check accepts Git's LF and Windows CRLF line endings. Independent staged review approved the release with no remaining code findings. Evidence is retained locally under `.tmp/cleanup-main-20260910/`; physical devices, non-Chromium browsers and hosted deployment were not verified.

## Default homepage and version navigation - 10 September 2026

The user promoted V8 to the default homepage: `/` redirects to `/main-v8`. The previous homepage was already the same `MarketDashboardV7` used by `/main-v7`, so that route preserves it under its existing V7 name. No separate V7.1 copy is needed. `/research` remains the full existing V7 workspace, including all editing and monitoring handoffs from connected V8.

The temporary redirect is configured before page rendering in `next.config.ts`; the root page also retains a redirect fallback. This avoids a reproduced Next development timing error from the streamed page redirect. The shared loading header now wraps its placeholders on narrow screens to prevent overflow while switching routes.

A small shared version bar appears on Market/Research V6, V7, V8 and the existing `/research` workspace. Links identify the current version, mark V8 as default and V7 as the previous homepage design, and retain Market versus Research when switching. Standard links work with keyboard, browser Back and new tabs. Switching versions opens the target's default view without transferring temporary filters, selected observations or unsaved drafts. Other routes, including Learn and earlier archived designs, are untouched. This explicitly supersedes the exploration's earlier no-default-route-change boundary; APIs, scoring, dependencies and saved data remain unchanged.

Owners: `next.config.ts`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/loading.tsx`, and `src/components/navigation/VersionSwitcher.tsx` with scoped CSS. Verification: 45 Chromium checks passed at 1280/768/375 (`.tmp/version-navigation/qa-1789046879655/report.json`), covering HTTP 307 homepage redirect, all six version routes, retained `/research`, active version, keyboard focus/Enter, browser Back, link geometry and overflow. Fresh screenshots were inspected. No captured console/page errors or failed requests remained; the saved-watchlist hash was unchanged and all 101 protected dirty/untracked files retained their hashes. Full lint, typecheck, harness and production build passed, with focused lint repeated after the loading/config fixes. Server remains at `http://127.0.0.1:3000`; no commit, push or deployment.

## Research connection to existing records - 10 September 2026

`/research-v8` now reads the existing saved watchlist through `GET /api/research/watchlist`. It does not merge fictional cases or legacy seed prices into saved records. The local watchlist contains AAPL, MSFT, VOO (Vanguard S&P 500 ETF), MAYBANK, NVDA, NET, CSPX.L and VWRA.L. Archived securities remain excluded. `/research-v8?demo=1` retains the original labelled illustrative exploration.

Selecting a security reads `GET /api/research/symbol/{symbol}?market={market}` through the existing snapshot parser. The response must match the selected symbol and market; aborted or late responses cannot replace another security. Loading and provider failures leave saved research available. A failed watchlist refresh retains the last loaded records with a warning; an initial invalid response and an empty saved list never fall back to examples. Reload saved research refreshes records after edits in the existing workspace.

The five V8 panels display saved thesis/checklist, accepted evidence and document citations, notes and review history, available provider fundamentals and annual periods, valuation ratios, position-plan assumptions and applicable benchmark data. Overview plots actual daily closes with calendar-based range selection, keyboard date inspection and an exact-value table. Retrieval includes time and UTC; it is not presented as the exchange quote timestamp. Financial currency is shown only when supplied for the matching reporting period, and saved entry-price units are explicitly unconfirmed. Malaysia does not inherit a US benchmark comparison.

The existing readiness calculation identifies the next saved-research gap. User-marked checklist items and saved decisions are labelled as user assessment. Browser-local policy is explicitly unassessed in V8. Editing, advanced valuation, full technical charts, monitoring evaluation and other tools link to their existing owner with the selected `ticker`; no notes or research content enter URLs. V8 issues no research writes and changes no APIs, scoring, persistence or dependencies. A compact mobile picker preserves access to all active saved securities.

Owners: `ResearchV8Connected.tsx`, `ResearchV8ConnectedPanels.tsx`, `research-v8-connected-data.ts`, `research-v8-connected.module.css`, and `/research-v8/page.tsx`. Market receives only two connection-description copy corrections. Existing demo QA now visits Research with `?demo=1`. Run `node scripts/v8-research-connected-qa.mjs` against the verified existing port 3000 server for connected browser proof; reports and screenshots live under `.tmp/research-v8-connected/`. QA reads saved data in memory and stores only its hash and security identifiers in the report.

Local provider limitation observed: Apple prices and daily history are returned by Yahoo Finance, while SEC fundamentals are unavailable until the existing SEC operator/contact configuration is provided. This connection does not configure external providers or fill missing evidence.

Verification: 89 connected Chromium checks passed (`.tmp/research-v8-connected/qa-1789041807081/report.json`), plus 10 focused checks for final control alignment, mobile previous/next selection, populated financial history/valuation, accepted AI evidence provenance and saved review history (`.tmp/research-v8-connected/final/report.json`). The existing illustrative suite passed all 82 checks (`.tmp/v8-qa/browser-1789041927603`). Fresh 1280/768/375 screenshots were inspected; keyboard controls, overflow, empty/malformed/partial/error/retry states, stale-response isolation, UTC timestamps and selected-ticker links passed. Live AAPL/MSFT/VOO/MAYBANK prices matched their API responses and all returned Apple chart points were plotted. Browser checks sent no API mutations and the saved-watchlist payload hash stayed unchanged. Lint, typecheck, harness and production build passed; an independent review's three findings were fixed and re-reviewed. SHA checks confirmed all 93 protected dirty/untracked files remained unchanged. No commit, push or deployment; the verified existing server remains on port 3000.

## Market coverage and disagreement clarification - 8 September 2026

Connected Market now separates amber **Data needs attention** from blue **Indicator disagreement**. Stale observations disclose their report date and continued inclusion; configured inputs without current observations are named together. Available backend coverage accounting explains neutral-reserve weight/points without presenting it as observed neutral sentiment. Existing unclassified quality warnings remain visible.

V8 translates the legacy `majority ... read` wording into `overall ... reading`: the existing calculator compares indicator tiers with the weighted composite tier, not a majority vote. This is a presentation correction only; the API payload, calculator, weights and persisted data are untouched. The matching inspector-rail wording is corrected too.

Missing indicator tiles keep the current value unavailable and label surviving mini-charts **Historical readings only**, with the last archived snapshot date. That date is not a source publication date. Missing-input inspectors retain archived context while withholding current raw values, normalized scores and driver fallbacks. Social and Malaysia News distinguish **Disabled by you** from enabled-but-unavailable data. The coverage action opens and focuses the Evidence panel.

Source diagnosis: a fresh local response returned score 64 with VIX 15.3, put/call 0.76 and AAII 36.3 dated 8 July 2026. The service included 65% weight and 17.50 neutral-reserve points. Runtime logs reported unconfigured Reddit OAuth and disabled StockTwits access. The NAAIM page returned HTTP 200, but neither existing parser pattern matched a reading. These observations explain data availability limits; this UI change does not configure credentials, rewrite provider parsers, refresh stored institutional records or replace missing financial evidence.

Owners: `MarketV8Connected.tsx`, `MarketV8ConnectedPanels.tsx`, `MarketV8Coverage.tsx`, `market-v8-coverage.module.css`. Styles are scoped to connected Market; shared Market/Research styles and V6/V7 remain untouched. The existing `scripts/v8-connected-qa.mjs` adds deterministic stale/missing/disabled cases, separated warning assertions, an archived-only NAAIM inspector, coverage-link keyboard focus, unchanged score and desktop/tablet/mobile evidence to its existing live-response checks.

Verification receipt: all 52 connected Chromium checks passed at 1280/768/375 with no captured runtime errors (`.tmp/v8-connected/qa-1788831880452/report.json`). The unmocked local response matched rendered score 64 and all 484 historical timeline points. Fresh warning-group and missing-indicator screenshots were inspected, including mobile keyboard focus. The controlled NAAIM QA case uses synthetic archive values only within browser interception; the app never substitutes them into live data. The regression now explicitly selects All before testing the earliest historical cutoff, avoiding a date-sensitive assumption about the default 3M range.

Lint, typecheck, harness/research regressions and production build passed. Existing harness large-file notices remain warnings. All 91 protected pre-existing files match starting hashes; no scoring, API, saved-data, shared-style or V6/V7 edits were made. Source inspection and GitNexus upstream impact bound the change to connected `/main-v8`; its Git-diff report still includes unrelated tracked changes and omits untracked V8 files. The task started a server on the verified free port 3000 and leaves it running at `http://127.0.0.1:3000/main-v8`. Provider restoration, real institutional refresh, Safari/Firefox and full screen-reader reading remain outside this UI verification. No commit, push or deployment.

## Research workflow refinement - 8 September 2026

The subsequent user-authorized review inspected V6/V7 Research source and fresh desktop/mobile browser views. It found useful company-detail tabs, region filters, nine investment-checklist questions, review scheduling/history and a broad workspace directory. The default `/research` currently uses the V7 integrated page. This update applies those workflow lessons to `/research-v8`; it does not replace the live Research route or connect fictional cases to saved records.

The opening sequence is company selection → research position and coverage → next unresolved question → progressive investigation. Overview leads with a brief thesis and evidence balance. Financials contains the existing two-observation comparison, amount/index controls, provenance and additional unavailable fundamentals. Thesis separates the bull case, bear case, invalidation and entry/exit gaps. Valuation remains unassessed. Review preserves an evidence-gap question alongside session notes and a draft date/reason checkpoint.

| Prior capability | V8 treatment |
| --- | --- |
| Search and market filtering | Region filter, visible result count, explicit selected-case-outside-results state; compact mobile company picker with previous/next controls |
| Investment checklist | Nine canonical questions in a collapsed coverage disclosure; each opens its relevant investigation section. All remain unverified, distinct from live readiness scoring. |
| Fundamentals and charts | Existing synthetic annual comparison moves into Financials. Missing margins, balance sheet, dilution and cash-flow inputs remain unavailable. Real-security chart access opens the existing app. |
| Journal and next review | Evidence-gap context enters the note editor without overwriting an active draft. Draft date/reason survive tab switches; no alert or calendar entry is created. |
| Broader research workflows | Canonical workspace groups expose existing Discovery, comparison, evidence, monitoring, portfolio, review and system tools through labelled new-tab links. The destination's selected real security applies; fictional companies and session drafts are not transferred. |

Saved research, assisted findings, actual price/technical charts, valuation models, events and historical decisions remain features of the existing app. This pass makes their access discoverable, not simulated. All existing synthetic figures and company/session reset rules are preserved. Notes, review drafts and acknowledgement reset on reload, route/company changes or entering Empty; changing tabs or Populated/Missing state preserves them.

Owners: `ResearchV8.tsx`, `ResearchV8Workflow.tsx`, `research-v8.module.css`. Market CSS is reused without edits. The existing browser suite `scripts/v8-exploration-qa.mjs` covers the new navigation, nine checks, grouped destination contracts, filter boundaries, mobile selection, gap context, draft continuity and reset, in addition to the existing Market-demo and Research interactions. Standard lint/typecheck/harness/build and fresh 1280/768/375 browser evidence are the completion gates. V6/V7 inspection captures are in `.tmp/v8-research-workflow/`.

Verification receipt: the final consolidated Chromium suite passed all 82 checks with no console, page or request failures (`.tmp/v8-qa/browser-1788830687427/report.json`). No financial API calls, mutations or authored-draft requests occurred on the prototype paths. Fresh Overview, Financials, Review, missing-data and tool-directory screenshots were inspected; 1280/768/375 geometry and keyboard tests passed. Lint, typecheck, harness/research regressions and production build passed. The harness's large-file notices are existing warnings. A bounded independent review found no actionable issues.

All 90 protected pre-existing files match their starting hashes. GitNexus impact confirms the Research V8 route boundary; Git-diff detection still reports the unrelated tracked V6/V7 work and excludes these untracked V8 files. The verified existing server remains running at `http://127.0.0.1:3000`; this task did not start or stop it. Destination URL contracts were checked, but every existing live workspace was not functionally retested. Safari/Firefox, physical touch devices, full screen-reader reading and live Research integration remain untested. No commit, push or deployment.

## Research visual alignment - 8 September 2026

`/research-v8` now shares Market V8's Segoe UI typography, navy/pale-blue/green palette, header, control language, investigation tabs and evidence rail. It imports the existing Market CSS without modifying it; Research-specific layout is isolated in `research-v8.module.css`. `ResearchV8.tsx` replaces the earlier notebook shell with compact company selection, an evidence-first company overview, financial comparison, and a clear next research action.

The flow answers: which company am I investigating, what supports or challenges the thesis, what remains missing, and what evidence should I inspect next? Evidence, Thesis, Valuation and Notes are separate keyboard-accessible tabs. Rail links open the relevant tab/filter. Notes retain the existing session-only lifecycle; switching tabs does not discard a draft, while reload, route/company changes and Empty reset it. No financial API or storage writes were added.

The comparison uses only the existing synthetic FY2024/FY2025 revenue and free-cash-flow observations. Metric selection and Amounts/Indexed controls work; labels, source limitations, the original values and calculation explanations remain available. No price history, company score or valuation is invented. Missing and unstarted cases keep unavailable values and direct the user toward a first source. Fictional observations, example interpretations and user-authored notes remain separately labelled. Live Research integration is outside this design update.

Verification uses the existing `node scripts/v8-exploration-qa.mjs`, extended for Research chart values/scales, keyboard tabs, toolbar geometry and Market typography. Standard lint/typecheck/harness/build and fresh 1280/768/375 Chromium screenshots are required. Other routes, data contracts, fixtures and Market styles remain untouched.

Verification receipt: all 67 consolidated Market-demo/Research browser checks passed with no captured console/page/request failures (`.tmp/v8-qa/browser-1788829265450/report.json`). Fresh Research populated desktop/tablet/mobile and missing-data screenshots were inspected. Chart values/scales, evidence disclosure and filters, tabs, note validation/cancel/reset, search/no-results, empty recovery, toolbar alignment and document overflow passed. Lint, typecheck, harness and production build passed; harness reports only its existing large-file warnings. The scoped review found no actionable issues. All 90 protected pre-existing files match their starting hashes.

GitNexus rebuilt successfully and reports `/research-v8` as the sole direct consumer of `ResearchV8`. Its final Git-diff detection reports the pre-existing tracked V6/V7 work, not these untracked V8 edits; it is not evidence of a new cross-route change. Server started with `npm run dev -- --port 3000` in this repository and remains running at `http://127.0.0.1:3000`. Safari/Firefox, physical touch devices and assistive-technology reading were not tested. No commit, push or deployment.

## Current status: connected Market - 6 September 2026

`/main-v8` now defaults to the existing Signal service. `/main-v8?demo=1` explicitly opens the preserved synthetic prototype. `/research-v8` remains illustrative and unchanged. Sections below this connection record describe earlier prototype stages.

### Data and interaction contract

- Current composite score, tier, agreement, input values, normalized scores, applied weights, driver changes, warnings and context come from `/api/signals/v2?market=…&mode=…&enableSocial=…`. The backend owns all scoring. V8 does not recompute or replace a current reading.
- The source control means Social for US and News for Malaysia, matching the existing API flag. Every current/history/replay request is scoped to the same market, mode and source configuration. Switching configuration clears the previous view; late responses are aborted and cannot overwrite the new selection. Reload retains a prior response only for the same configuration and labels loading or failure.
- Overview history uses `metadata.score_history`; calibration uses the full `metadata.historical_validation.timeline`. All available points are plotted, without smoothing, invented observations or downsampling. Observed records take precedence over reconstructed duplicate dates. Benchmark rebasing uses the first visible valid benchmark value after each range change.
- Calibration outcomes, zone statistics and cases use the matching backend horizon observations. Origin filtering happens before classification/ranking. Timeline-only points never enter the horizon baselines; benchmark provenance is not inferred from score provenance. Model version, coverage notes and insufficient evidence remain visible.
- Indicator mini-charts use the latest 12 archive-index snapshot dates from `/api/signals/replay`. Up to four existing detail requests run concurrently. Every plotted value is the raw reading stored in that snapshot; missing snapshots or components break the series. These are explicitly labelled bounded archived readings, not continuous provider histories. Inspector charts show the latest contiguous available segment.
- Selecting an overview date loads that exact archived record. A missing full record leaves a score-only view, with no current indicators, context, articles or outcomes substituted. Present readings and historical evidence never share an unlabeled mixed view.
- Missing current components are displayed as unavailable. A response containing only past history does not produce a present-day score. Invalid financial records produce an error rather than guessed values. Provider freshness is shown independently from backend inclusion; notably, the current service may include an old AAII value, which V8 flags without changing the score.
- Actual source articles, safe source links, valuation numerator/denominator, benchmark moves, rates, breadth and their distinct report dates replace the synthetic context. No fictional development is shown on the connected path. The scenario simulator remains a clearly hypothetical local calculation using the existing sensitivity helper.

### Owning files and verification

Connection owners: `MarketV8Connected.tsx`, `MarketV8ConnectedData.ts`, `MarketV8ConnectedPanels.tsx`, `MarketV8ConnectedHistory.tsx`. The existing V8 entry selects connected/demo mode; the chart and timeline accept sourced data while preserving demo behavior. Only the `/main-v8` page reads its demo query. Shared scoring, API, database, dependencies, default application routes and V6/V7 are untouched.

Run `node scripts/v8-connected-qa.mjs` against the verified existing server. It captures current service responses for deterministic UI checks, exercises failure/partial/invalid/empty and configuration-race states, verifies desktop/tablet/mobile geometry and keyboard behavior, then removes interception for a direct runtime score/timeline comparison. The captured response includes only ordinary market data. It starts no services and stores evidence under `.tmp/v8-connected/`. The earlier `node scripts/v8-exploration-qa.mjs` now explicitly targets `?demo=1` and retains Research regression checks.

The connected screen uses existing GET contracts; the existing Signal service retains its own normal caching and snapshot-recording behavior. No new persistence or mutation endpoint is introduced. Service values and data quality are not independently provider-verified. Non-Chromium browsers, full assistive-technology testing and live provider reliability remain outside this verification.

Verification receipt: lint, typecheck, harness and production build passed. The final missing-weight guard also passed targeted lint, typecheck and the browser missing-data scenario. Connected Chromium QA passed 46 checks at 1280, 768 and 375 pixels with no captured runtime errors (`.tmp/v8-connected/qa-1788688505131/report.json`). Its unmocked local-service check matched score 64 and all 484 paired timeline points. Fresh current, indicator, context and timeline screenshots were inspected for responsive layout and readable dense history. Demo/Research regression passed 64 checks (`.tmp/v8-qa/browser-1788681447715/report.json`). An earlier connected run was interrupted by host network suspension; the final run passed. The existing server remains running at `http://127.0.0.1:3000`.

GitNexus change detection sees only tracked pre-existing work and cannot establish impact for these untracked V8 files. Source imports, preserved-file hashes, type/build checks and route-level browser proof establish the integration boundary instead.

## Earlier prototype history

Two isolated, unpromoted routes: `/main-v8` and `/research-v8`. Market now implements the user-selected Integrated Flow direction. Research retains its existing V8 exploration pending feedback on Market. No default route or V6/V7 behavior is changed.

## Discovery and design rationale

Discovery used product requirements, domain types, scoring functions, the indicator registry, replay contracts and existing sensitivity helpers. V6/V7 design documents, screenshots, styles and presentation components were excluded as inspiration. Root layout and the V8 route were inspected only for integration. The user-supplied Integrated Flow images informed this revision's visual direction and information hierarchy.

Market answers these questions in order:

1. What conditions are present, and how much evidence supports the reading?
2. How has the score changed over time?
3. Which individual indicators explain or challenge it?
4. What changed, what is missing, and what should I investigate next?
5. What hypothetical normalized-input change would alter the reading?

The visual identity uses navy sans-serif typography, pale blue atmosphere, restrained green accents and compact analysis. A primary chart and visible indicator mini-charts lead into five investigation tabs: What changed, Evidence, Context, History and Scenarios. A desktop inspector keeps detail beside the overview. Tablet uses a modal and mobile uses a full-screen detail view. Source explanations and model accounting remain available through disclosures. Unknown series show an explicit gap instead of a generated replacement chart.

Market conditions remain separate from company decisions. Research navigation opens the existing company experience; no portfolio impact, exposure mapping or company recommendation is inferred.

## Implementation boundary

Market owns `src/components/v8/MarketV8.tsx`, `MarketV8Chart.tsx`, `MarketV8Panels.tsx`, `MarketV8Restored.tsx`, `market-v8-restored-fixtures.ts`, `market-v8-fixtures.ts` and `market-v8.module.css`. The existing `/main-v8` route imports the entry component. Shared V8 Research components, styles, fixtures and both route files remain unchanged in this revision.

No dependency, scoring, registry, API, persistence, default-route, authentication or notification changes. Nothing is committed, pushed or deployed.

## Fixture and interaction contract

- All Market values and histories are deterministic synthetic examples at a fixed 4 September 2026 snapshot. Source names describe the intended input type; they do not establish provider retrieval or verification.
- Existing `calculateCompositeScoreV2` supplies fixed weights, neutral reserve, rounding and agreement. Existing `simulateMarketScore` supplies normalized-input sensitivity. Neither helper is modified.
- Current registry weights take precedence over older prose: Malaysian news has 65%, currency volatility 25%, AAII 10%; Social is US-only. Missing, disabled and stale weights retain neutral reserve; they are not observed evidence and are not redistributed.
- Populated US: 70 versus 68 on 3 September; 95% observed weight. Partial US: 53, 55% observed weight. AAII dated 20 August exceeds its 14-day freshness limit on 4 September and is excluded, but remains visible as stale evidence. Prior-day eligibility is assessed independently; lost observed contributions plus the change in neutral reserve reconcile to the displayed score change.
- Momentum/Contrarian changes interpretation, not the numeric score. Social toggling changes eligible fixture inputs. US/Malaysia switch changes the applicable model and context.
- Raw values, normalized scores, weighted contributions and contribution changes are separately labelled. Daily history contains the stated prior-day raw reading. Weekly mini-charts retain dated observations. Other chart points are illustrative sampled histories, not reconstructed production calculations.
- Main chart supports date selection by click or arrow keys plus Enter. 28 August has complete synthetic input records. Other historical selections are score-only; current readings are not substituted. Return to current restores the prior investigation tab and selection. All means all available three-month fixture history.
- Indicator tiles, contribution rows and evidence entries open the same inspector. Mobile detail uses native modal semantics, keyboard containment, Escape, return focus and scroll locking. Tabs support arrow-key focus and explicit activation.
- Scenarios combine normalized-input assumptions with fixed weights. Raw observations and volatility regime stay fixed. Reset restores assumptions; the actual score remains unchanged.
- Context now supplies explicitly synthetic US index/breadth/rates/financial-conditions/valuation readings and Malaysian KLCI/rates/currency readings, with dates, reasoning and limitations. Partial mode has a missing benchmark and a distinct older breadth/rates fixture. No real provider report, sourced event or triggered alert is asserted. The existing session-only source-review flag and Research link remain.
- Empty state has no score, history or interpretation. Limitations remain visible in a footer disclosure. Recheck fixture reports that no live request occurred.

Research remains the earlier V8 prototype: fictional companies, financial evidence comparisons, search, filters, missing/empty cases, thesis gaps and session-only notes. Its interaction and note-isolation checks run as regression coverage; its design has not been revised here.

## Verification

Run `node scripts/v8-exploration-qa.mjs` against an existing verified server. `SIGNAL_QA_URL` overrides the default `http://127.0.0.1:3000`. The script starts no server.

The consolidated Chromium matrix covers both routes at 1280x900, 768x900 and 375x900. It checks chart selection, complete and score-only historical evidence, range controls, mode/source/market switching, partial/empty states, scenario reset, stale exclusion and score reconciliation, modal bounds/focus/return, tab keyboard access, overflow, Research note retention/reset, console/network errors and absence of financial API/mutation/private-note requests. Reports and fresh screenshots are stored under `.tmp/v8-qa/`.

Required repository checks: `npm run lint`, `npm run typecheck`, `npm run harness`, `npm run build`, plus whitespace and preservation checks. Harness includes Research and Learn regression suites and reports pre-existing large-file warnings.

GitNexus refresh failed on an inconsistent FTS index. Current source imports and browser request assertions establish the isolated route boundary; no successful graph refresh or complete graph impact result is claimed. Existing tracked dirty work and unrelated untracked Research/Gemini files are checked against pre-edit SHA-256 baselines.

## Illustrative or untested

No live provider validation, actual historical reconstruction, real articles, real native-market context data or benchmark returns, persistent research, alerts or multi-device sync. No loading/retry simulation. No full assistive-technology audit or non-Chromium device test. The inherited root theme/PWA shell remains unchanged; isolated browser QA blocks service workers and dismisses the inherited registration notice. Development-tool chrome may appear in captures. User acceptance of the new Market direction remains open; Research's next design revision follows that feedback.

### Earlier Integrated Flow results - 6 September 2026

- Lint, typecheck, harness and production build pass. Both V8 routes appear in the build output.
- Latest consolidated browser report: `.tmp/v8-qa/browser-1788674696303/report.json`, 37 checks passed, no console/network errors or financial API/mutation requests.
- Fresh desktop/tablet/mobile and indicator/history/partial/empty/scenario screenshots were inspected. Qualitative visual verdict: 91/100, pass; recorded privately at `.omx/state/market-v8/ralph-progress.json`. This is not user acceptance or a pixel-similarity score.
- SHA-256 verification preserved all 18 pre-existing tracked dirty files and 13 unrelated untracked files in the baseline. Seven task files passed the explicit trailing-whitespace check.
- GitNexus change detection saw only existing tracked changes, so its result does not cover the new V8 files. Source imports confirm the Market entry is consumed only by `/main-v8`.
- Tested origin is `http://127.0.0.1:3000`; the owned development server is left running.
- Final reviewer follow-up confirmed the three original findings closed. Its residual stale-weekly-history mismatch was fixed by seeding the actual prior value in the replacement history. Targeted lint/typecheck and `.tmp/v8-integrated/final-boundary-report.json` pass: matching weekly prior, mobile stale detail, Malaysia partial warning and desktop populated smoke. The final stale mobile screenshot was inspected.

## Restored Market depth - 6 September 2026

The restoration adds three scoped capabilities without changing the established overview:

- **History / Historical calibration:** 7/30 calendar-day outcomes; score-zone selection; observed-origin-only filter; matching all-zone baseline; median, positive-return frequency and range; sample counts and record provenance; individual negative outcomes. Statistics are derived from 32 explicit synthetic records (8 per zone), not asserted as Signal performance. Each zone is preliminary; partial fixtures have only 3 samples per zone and withhold summary estimates. No record type is presented as a real observation. The study is separate from the main illustrative score-history series. Negative-case filtering changes only the case list. Current study outcomes are withheld in historical mode and for the US Social-off configuration.
- **Market confirmation / Context:** a compact summary under the mini-charts opens populated dated context disclosures. US and Malaysia use distinct relevant data. Context never changes scoring. The partial state uses its own older observations rather than relabelling current values.
- **Evidence / Source accounting:** every configured input is accounted for, including unset manual BofA SSI. The view distinguishes eligible contribution from neutral reserve and exposes cadence, freshness windows, weight concentration, limitations and unchecked provider status. No source document is fabricated or linked as evidence for a synthetic reading.

Entry actions move focus to the investigation panel. Responsive controls maintain 40-pixel button height, and long detail remains behind existing tabs and disclosures. The existing Market score, mini-charts, scenarios, Research prototype and all older routes remain unchanged in behavior.

Verification: lint, typecheck, harness and production build pass. The expanded Chromium matrix passed 49 checks at 1280, 768 and 375 pixels with no console/network errors, financial API calls or mutations. It validates metric changes, provenance filters, losing cases, insufficient samples, historical and Social-off exclusions, source accounting, populated context, keyboard entry and overflow, plus existing Market/Research regression flows. Evidence: `.tmp/v8-qa/browser-1788677437158/report.json`. Independent review's partial-context date finding was corrected and closure verified.

Deferred after the earlier restoration: sourced news/events, broader historical snapshot comparison, carrying Market context into Research, alert configuration, watchlist exposure and historical-percentile context. These are not claimed restored by this pass.

The context-only Breadth/MGS tile now displays the same current or older synthetic spread as Context; it retains an unavailable-history label because no context time series is supplied. Targeted follow-up verified US/Malaysia partial dates and readings, and keyboard horizon activation (.tmp/v8-restore/focused-report.json). All 77 unrelated files in the pre-edit baseline retain their SHA-256 hashes. The dev server remains running at http://127.0.0.1:3000.


## Complete Market restoration - 6 September 2026

The approved follow-up preserves the overview and indicator mini-charts, and places depth behind the existing investigation tabs. New isolated modules are `MarketV8Timeline.tsx`, `market-v8-timeline-fixtures.ts`, `market-v8-timeline.module.css` and `MarketV8Explanations.tsx`.

| Restored content | Location and behavior | Verification |
| --- | --- | --- |
| Score trend and last zone change | Under overview chart; uses only available dates up to the selected cutoff | Current and historical score selection |
| Raw-to-score reasoning and horizons | Indicator inspector disclosure; separates cadence, known formula, assigned fixture score and source blend | VIX formula/37.75 check; mobile inspector keyboard containment |
| Full disagreement and summary limits | Evidence; complete conflict list, eligible weight, concentration, reserve and glossary | Conflict count and source accounting |
| US/MY source composition | Inspector source-blend detail, including US social 50/50 and MY news 80/20 | Source inspection against current calculators |
| What would change the view | Scenarios, before normalized-input simulator; market/mode-specific qualitative checks and model boundaries | US override / MY exclusion, reset and unchanged current score |
| Dated developments | What changed; fictional publications with expandable local records and separate illustrative interpretation | Local record disclosure; missing source record in partial fixture |
| Detailed macro context | Context; US valuation numerator/denominator and dates, Treasury/NFCI dates; MY OPR/MYOR/bill observations and independent dates | Consistent 180% example, current and partial MY fields |
| Synchronized timeline | History → Timeline, default; score and rebased benchmark with shared pointer/keyboard cursor | Every supported range rebases first valid observation to 100; missing benchmark gaps |
| Timeline provenance | Readout and scrollable dated table; observed-origin/reconstructed-origin/limited/timeline-only labels, coverage and fixture version | Keyboard, table and partial-gap inspection |
| All-zone comparison | History → Score zones; 7/30-day median, positive frequency, counts, observed-origin counts and baseline | All four zones plus unconditional baseline, origin filter |
| Mismatches and aligned cases | History → Cases; all zones, mode-aware 30-day classification; neutral absolute moves >=5% | Category changes by mode; positive and negative neutral sharp cases |
| Study identity and validation limits | History → Method; model-rule reference 2.0.0, fixture identity, configuration, observation window, origins and unavailable out-of-sample validation | Method disclosure and gating checks |

The timeline is a separate sparse two-year synthetic dataset with 20 dated points. It is not a continuation of the overview series or the source of the 32 assigned outcome records. Mode changes its interpretation, never its numeric score or benchmark returns. `3Y` and `5Y` stay disabled with an explanation. Partial mode removes two benchmark observations and breaks the line; no replacement prices are inferred. All record-origin labels describe fixture types, not actual captured or reconstructed observations.

The MY volatility fixture is deliberately not comparable with the US VIX formula: its display units are not the production transformed gauge. The inspector discloses this instead of pretending the assigned normalized value was calculated from that raw fixture. Scenario horizons and historical outcome windows remain separate concepts.

Still deferred: live source/news retrieval and source verification, actual historical reconstruction, historical percentiles, additional full archived snapshots, Market-to-Research context handoff, alert configuration and watchlist exposure. Representative developments are now restored as a UI capability; real news evidence is not. No additional APIs, dependencies, persistence or older-route changes are introduced.


Final verification for this follow-up: full lint, typecheck, harness and production build passed. The final Chromium report at `.tmp/v8-qa/browser-1788679418714/report.json` passed 64 checks at 1280, 768 and 375 pixels, with no browser/network errors, financial API calls or mutations. Fresh timeline, inspector, scenarios, context, cases and score-zone screenshots were inspected. The timeline now measures its SVG width so axis labels and pointer coordinates remain readable and aligned on mobile. Independent review approved the implementation and final sizing adjustment. All 77 unrelated baseline files retain their hashes; all 11 changed/new task files pass whitespace checks. The existing server remains running at `http://127.0.0.1:3000`. No commit, push or deployment occurred. Real data, non-Chromium browsers and full assistive-technology testing remain unverified.
