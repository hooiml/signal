# Signal Next Product Roadmap

## Purpose

This document preserves the next product ideas as an ordered, testable roadmap so they can be
implemented one at a time without losing the overall direction.

It is a focused successor to:

- [`FEATURES_AND_ENHANCEMENTS.md`](FEATURES_AND_ENHANCEMENTS.md), which remains the canonical
  product boundary and records the current observation, security, provider, and demand gates;
- [`feature-opportunity-backlog.md`](feature-opportunity-backlog.md), which records the broader
  opportunity history and delivered capability sequence; and
- [`PROJECT_OBJECTIVE_AND_FLOWS.md`](PROJECT_OBJECTIVE_AND_FLOWS.md), which remains the source of
  truth for Signal's product objective and user flows.

This roadmap does not authorize implementation, commit, push, merge, deployment, provider
activation, dependency upgrades, or destructive operations by itself.

## Baseline

- Task 3 originated from pushed `origin/main` baseline
  `2ee2da51111ea836eb85f298529f6d18aafdba5c` on 2026-07-30 and was ported onto
  `38738906e037b584a271010d6d7e358eda531904` on 2026-08-01.
- Signal already has substantial Market, Research, Portfolio, evidence, alerting, continuity,
  outcome, and workflow functionality.
- Research currently exposes 22 workspaces across seven navigation sections.
- The next product problem is primarily activation, discoverability, workflow completion, and
  trust—not a shortage of analytical modules.

## Product Direction To Preserve

Every item in this roadmap must preserve these rules:

1. Signal is transparent investment decision support, not trade execution or personalized advice.
2. Missing, stale, unsupported, or provider-degraded evidence remains visibly unavailable.
3. Scores, alerts, models, and AI output never silently change a thesis, checklist, decision,
   position plan, or portfolio record.
4. Authored research, holdings, transactions, accounts, credentials, and private evidence do not
   enter analytics.
5. Browser-local, session-only, and server-persisted state remain visibly distinct.
6. Currencies are not combined without explicit, approved FX evidence.
7. Provider identity, timestamps, units, coverage, corrections, and failures remain explicit.
8. Mutations require an intentional user action, validation, conflict protection, and recoverable
   feedback.
9. New dependencies, providers, persistence, authentication, background delivery, or network
   behavior require a fresh architecture, privacy, and security review.

## Sequential Execution Contract

Use this contract whenever a future task implements an item from this roadmap:

1. Name the exact item, for example: `Proceed with Task 2`.
2. Recheck the repository, branch, HEAD, dirty/staged state, current roadmap status, and volatile
   provider or runtime facts before editing.
3. Work on only that task's next eligible minimum valuable slice.
4. Do not start an adjacent task merely because the current task finishes early.
5. Preserve unrelated work and existing URLs, storage contracts, APIs, calculations, and privacy
   boundaries.
6. Select the QA lane from the actual behavioral risk and follow [`TESTING.md`](TESTING.md).
7. Update this roadmap with the resulting status, evidence, known gaps, and changed scope.
8. Stop after the task is verified. Commit, push, merge, deployment, provider activation, and
   destructive actions remain separately authorized.

Only one item may have status `In progress` at a time.

### Status Vocabulary

- `Observing`: collecting the evidence required to choose or unlock a build.
- `Proposed`: the main idea is preserved, but implementation is not yet authorized.
- `Ready`: dependencies and validation gates are satisfied.
- `In progress`: the exact bounded slice is being implemented.
- `Verified`: the bounded slice is implemented and its required checks pass.
- `Blocked`: an external dependency prevents meaningful progress.
- `Deferred`: intentionally not prioritized.

## Sequence Overview

| Order | Initiative | Status | Primary outcome | Gate or dependency |
| ---: | --- | --- | --- | --- |
| 0 | Observe Today and Usage | Observing | Validate the daily workflow before changing navigation defaults | 30 active-use days or two review cycles |
| 1 | Today 2.0 action home | Verified implementation; promotion gated | Make the next useful action obvious | Task 0 promotion gate |
| 2 | Universal local research search | Verified | Find existing research and workflow state quickly | Reuses the current command palette and validated local owner state |
| 3 | First-run setup and guided demo | Verified | Help a new user reach a first useful review | Audience expansion explicitly authorized for this bounded setup slice |
| 4 | Research readiness strip | Verified | Show what is complete, stale, blocked, or due for one ticker | Reuses existing Evidence, Policy, trigger, and review state |
| 5 | Pinned workspaces and attention badges | Proposed | Reduce navigation friction without unstable automatic reordering | Use existing loaded counts; avoid new fetches |
| 6 | Forward-validation lab | Proposed, discovery required | Build genuine prospective trust evidence for scoring | Freeze a model/version and evaluation policy first |
| 7 | Corporate-action resolution assistant | Proposed, demand-gated | Resolve common portfolio continuity gaps transparently | Portfolio funnel must show sustained reconciliation use |
| 8 | Malaysia primary-source parity | Blocked, provider-gated | Improve Malaysia evidence without proxy US semantics | Approved official source or licensed provider contract |

## Audience-Dependent Sequence

The default sequence assumes Signal remains primarily a personal tool for the current operator.
Under that assumption, improve the daily workflow and search before building onboarding.

If Signal is intentionally being prepared for additional users, move **Task 3** ahead of Tasks 1
and 2. Do not silently make this choice during implementation; record the audience decision in the
task receipt and this roadmap.

## Now

### Task 0 — Observe Today And Usage

**Status:** Observing

**Goal**

Collect enough real workflow evidence to decide whether Today should become the default Research
workspace and which navigation friction is worth solving.

**Existing promotion gate**

Observe approximately 30 active-use days or two review cycles, and require:

- at least five Today actions opened;
- at least 40% of those actions reaching the owning detailed workspace;
- at least 25% leading to a saved review or completed Queue task; and
- no repeated navigation confusion during manual use.

**Evidence source**

- Browser-local Usage workspace metrics.
- Portfolio-to-Queue funnel metrics.
- Short manual notes for navigation confusion that bounded analytics cannot capture.

**Current baseline — 2026-07-30**

- The visible 30-day Usage view contained no pre-existing local workflow history. This check
  created only Usage and Today workspace-view events; exclude all of those observation events from
  Task 0 evidence.
- Today has zero recorded action opens, destination reaches, or correlated completions. The
  Portfolio holdings and reconciliation funnels are also zero at every stage.
- The prior Usage summary correlated opens to completions but did not separately measure whether a
  Today action reached its owning destination. Task 0 now reuses the existing browser-local
  workflow correlation to expose that reach count and percentage without recording tickers or
  authored content.
- The approximately 30-active-day or two-review-cycle window and the manual navigation-confusion
  notes still require real use. No historical events are invented or backfilled.

**Exit**

- Mark `Verified` when the observation window and all promotion thresholds pass.
- Keep `Observing` and refine the workflow hypothesis if the sample is too small.
- Do not change the default Research workspace as part of this task.

---

### Task 1 — Today 2.0 Action Home

**Status:** Verified (implementation); default-workspace promotion gated by Task 0

**Problem**

Today already produces a deterministic top-three action list, upcoming events, attention counts,
source warnings, and a checkpoint. It is not yet the default daily starting point, and users may
still need to reconstruct their next action across Activity workspaces.

**Minimum valuable slice**

- Reuse the existing Today priority builder; do not introduce a second ranking score.
- Add a local-only `Continue where you left off` action when a valid prior workflow destination
  exists.
- Keep the top three priorities as the dominant content.
- Summarize overdue reviews, near-term events, triggered alerts, incomplete Queue tasks, and
  degraded sources without duplicating their owning workspaces.
- Give every summary one clear action that opens the exact owning workspace or ticker.
- Preserve independently degraded loading, partial, empty, and error states.
- Record only existing bounded workflow analytics events.

**Explicit non-goals**

- No AI-generated priority ordering.
- No buy/sell recommendations.
- No automatic review completion, checklist change, alert acknowledgement, or checkpoint save.
- No second copy of Queue, Calendar, Alerts, or Sources data management.

**Acceptance criteria**

- The same validated inputs produce the same priorities.
- Every action deep-links to the owning state and preserves return context.
- Private or authored content does not enter analytics, URLs, logs, or new network payloads.
- Mobile and desktop show one obvious primary action without document overflow.
- Today becomes the default Research workspace only after Task 0 is `Verified`.
- Loading, partial, empty, failure, and success states pass the applicable browser checks.

**Success signal**

- At least 40% of opened Today actions reach their owning detail.
- At least 25% result in a saved review or completed Queue task.
- Manual use shows fewer repeated workspace searches.

**Implementation evidence — 2026-07-30**

- Today reuses the existing deterministic priority builder and keeps its strict top-three result
  above the compact overdue-review, near-term-event, Alerts, Queue, and Sources projections.
- `Continue where you left off` accepts only a version-1, browser-local, allowlisted destination
  with a validated optional ticker, fixed tab/review state, timestamp, and 90-day maximum age.
  It stores no authored content and creates no new request or analytics payload.
- Fixed `returnTo=today` context reaches the existing Market or Research owner and returns without
  acknowledging, completing, saving, or otherwise mutating research, alerts, Queue, or checkpoints.
- Provider checks resolve independently with bounded loading, partial, empty, unavailable, and
  saved-research error states. Existing privacy-safe workflow analytics remain the only emitted
  events.
- Targeted regression, lint, typecheck, full repository harness, production build, and consolidated
  deterministic browser checks passed at 1280 px, 768 px, and 375 px.
- Direct `/research` still restores Watchlist. Task 0 remains `Observing`; Today must not become the
  default until the real 30-active-day or two-review-cycle gate and its reach, completion, and
  navigation-confusion thresholds pass.

---

### Task 2 — Universal Local Research Search

**Status:** Verified

**Problem**

The command palette currently searches routes, tickers, workspaces, Market configuration, and
saved layouts. It cannot find an existing thesis field, evidence label, filing citation, or Queue
task.

**Minimum valuable slice**

- Extend the existing Ctrl/Cmd+K palette instead of adding another search surface.
- Search only validated state already available in the browser:
  - ticker and company;
  - bounded thesis field labels and authored research text;
  - accepted-evidence labels and source titles;
  - primary-document citation titles and filing identifiers;
  - Queue task labels and fixed source/template metadata.
- Group results by `Ticker`, `Research`, `Evidence`, `Filings`, and `Queue`.
- Show a short local snippet and the owning destination.
- Keep indexing and matching in the browser with no analytics content capture and no search API.
- Use existing platform and repository utilities; add no fuzzy-search dependency.

**Explicit non-goals**

- No web-wide document search.
- No semantic embeddings or server-side indexing.
- No searching credentials, accounts, holdings, transaction values, or encrypted backup content.
- No mutation from a search result.

**Acceptance criteria**

- Search results are bounded, deterministic, keyboard accessible, and grouped by owner.
- Selecting a result opens the exact ticker/workspace/tab without losing unrelated URL state.
- Search queries and matched authored content never leave the browser.
- Malformed persisted records are ignored or recovered through existing parsers.
- Empty, large-result, keyboard, mobile, and storage-unavailable states are verified.

**Success signal**

- Users reach an existing detailed record without navigating through multiple workspace groups.
- Command-palette usage leads to more completed reviews without increasing abandoned opens.

**Implementation evidence — 2026-07-30**

- The existing shared command palette now builds a deterministic browser-only index after saved
  research passes the normal record parser and Queue state passes its existing local-storage
  parser. It searches only ticker/company identity, seven bounded authored thesis fields,
  accepted-evidence titles and source labels, bounded primary-document titles/identifiers, and
  fixed Queue template/source metadata.
- Indexing is capped at 100 records, 25 accepted findings and 25 citations per record, and 100
  Queue tasks. Queries require two characters, are capped at 80 characters, and return at most
  eight results per owner group with an explicit truncation message.
- Ticker, Research, and Evidence results open the exact ticker Overview; Filings results open the
  selected ticker in Filings; Queue results restore and focus the exact validated task. Existing
  URL parameters outside those owned destinations remain intact.
- Search input, authored snippets, evidence values, filing excerpts/URLs, Queue dedupe keys, and
  matched content create no search request or analytics event. Selecting a result does not save,
  acknowledge, complete, or otherwise mutate Research or Queue state.
- Loading and independently degraded saved-record or Queue-storage states retain the valid owner
  results that remain available. Empty and large-result states are explicit.
- Focused regression, lint, typecheck, full harness, production build, and consolidated browser
  checks passed at 1280 px, 768 px, and 375 px with keyboard navigation, focus restoration,
  exact destinations, privacy/non-mutation assertions, and no document overflow.

---

### Task 3 — First-Run Setup And Guided Demo

**Status:** Verified

**Problem**

Signal's depth can overwhelm a new user before they reach a useful first review. The current
product has no dedicated first-run setup or isolated demonstration flow.

**Audience gate**

Confirm whether Signal is being prepared for users beyond the current operator. If yes, move this
task ahead of Tasks 1 and 2. If not, keep it in the default order.

**Minimum valuable slice**

- A dismissible and resumable setup checklist:
  1. choose the markets to follow;
  2. add watchlist names or import a holdings snapshot;
  3. complete one explicit research review;
  4. schedule the next review;
  5. optionally create one monitoring rule.
- Provide an isolated read-only demo path for exploring Market, Research, and Portfolio.
- Clearly label demo content everywhere and keep it outside real persistence, sync, backup, Queue,
  analytics content, and provider mutation paths.
- Let users skip setup and return later.
- Track only bounded local completion-step enums.

**Explicit non-goals**

- No fake live data presented as current.
- No auto-filled thesis, decision, checklist, allocation, or alert.
- No account creation requirement.
- No hidden mutation of real records when leaving demo mode.

**Acceptance criteria**

- Demo and real data cannot collide by identifier or storage key.
- Leaving or clearing demo mode removes only demo state.
- Setup is keyboard accessible and usable at 1280px, 768px, and 375px.
- Refresh and resume behavior are explicit and recoverable.
- A user can reach a first saved review without learning the full workspace hierarchy.

**Success signal**

- Higher completion of the first saved review.
- Shorter time from first open to a meaningful action.
- Fewer abandoned empty-state sessions.

**Audience decision and implementation evidence — 2026-07-30**

- The delegated Task 3 implementation explicitly confirms preparation for users beyond the
  current operator. Tasks 1 and 2 were already verified, so their order and behavior remain
  unchanged; Task 0 remains `Observing`.
- First-ever empty Research state opens one resumable browser-local checklist. Existing Research,
  Portfolio, or Queue owner state is preserved and receives only a quiet command-palette
  `Setup & demo` return action instead of an automatic interruption or added page chrome.
- The version-1 setup record accepts only fixed lifecycle, market, completion-step, and optional
  monitoring enums. Watchlist/holdings, saved-review, next-review, and structured-rule completion
  are derived from their existing validated owners rather than copied into setup persistence.
- Setup actions open the existing watchlist add form, Portfolio import surface, and exact Research
  review editor. Skip, hide, restart, reload, storage-unavailable, and malformed-progress recovery
  paths do not clear or replace Research, Portfolio, Queue, Calendar, Alerts, Sources, analytics,
  backup, or sync state.
- `/demo` is a separate session-only, read-only path over fixed example Market, Research, and
  Portfolio fixtures. Every panel labels its content as demo/example/not live; it makes no provider
  or application API request and exposes no save, acknowledgement, import, rule, Queue, backup,
  sync, or analytics mutation.
- Focused regression, lint, typecheck, full harness, production build, and consolidated browser
  checks passed at 1280 px, 768 px, and 375 px for first launch, existing-user preservation,
  setup/review success, skip, reload/idempotency, malformed/partial storage recovery, exact
  destinations, privacy/non-mutation, keyboard focus, tab navigation, and document overflow.

---

### Task 4 — Research Readiness Strip

**Status:** Verified

**Problem**

Ticker readiness is distributed across the checklist, Evidence, Policy, structured triggers,
position planning, Calendar, and review history. Users can miss the most important gap while
reading a detailed record.

**Minimum valuable slice**

- Add one compact strip near the selected ticker header.
- Reuse existing validated state to show:
  - thesis and checklist completeness;
  - evidence supported/stale/conflicting/missing counts;
  - active policy breaches;
  - structured-trigger coverage;
  - next review state;
  - position-plan completeness.
- Show one `Review next gap` action selected by a fixed, disclosed precedence rule.
- Link each status to its owning editor or workspace.

**Explicit non-goals**

- No new readiness or recommendation score.
- No automatic field completion.
- No hiding unavailable or conflicting evidence inside a single positive status.
- No new provider request solely for this strip.

**Acceptance criteria**

- Every displayed state is traceable to an existing validated value.
- The precedence rule is deterministic and covered by focused tests.
- Unknown and partial coverage remain explicit.
- The strip remains compact and does not push the primary thesis below the first useful viewport.
- All actions preserve ticker and return context.

**Success signal**

- More reviews fill the highest-priority missing input.
- Fewer saved reviews retain avoidable evidence, review-date, or position-plan gaps.

**Verification receipt — 2026-08-01**

- Source commit: [`3873890`](https://github.com/hooiml/signal/commit/38738906e037b584a271010d6d7e358eda531904) (`feat(research): surface deterministic readiness gaps`), followed by the V7 interaction refinement in [`48e44b6`](https://github.com/hooiml/signal/commit/48e44b656fd17093ddf4e86cf52b4c058c780c89).
- The implementation derives seven explicit states from existing saved Research, Evidence, Valuation, browser-local Policy, structured-trigger, Calendar, and position-plan owners. It discloses fixed precedence and introduces no provider request, mutation, recommendation, or composite readiness score.
- Deterministic Research regression covers identical-input stability, owner coverage, overdue review precedence, and the no-gap fallback. The targeted readiness harness covers the single next action, collapsed details, all owner destinations, ticker preservation, first-viewport placement, responsive overflow, mutation safety, and blocking browser errors at `1280×900`, `768×900`, and `375×812`.
- The source commit records passing lint, typecheck, full harness, production build, targeted readiness QA, and Research picker QA. Phase 12 production verification on 2026-08-31 confirmed the compact strip and selected-security next action remain present after consolidation.
- The success signals above remain observational outcomes; implementation verification does not claim that user behavior has changed.

---

### Task 5 — Pinned Workspaces And Attention Badges

**Status:** Proposed

**Problem**

Seven navigation sections protect the interface from exposing all 22 workspaces at once, but
frequently used destinations and pending attention still require repeated navigation.

**Minimum valuable slice**

- Allow up to three manually pinned workspaces.
- Store pins in validated browser-local preferences.
- Show restrained, non-alarming counts only where existing loaded state can prove:
  - incomplete Queue tasks;
  - triggered or failed alerts;
  - overdue reviews or due events.
- Keep the canonical seven-section navigation and stable workspace URLs.
- Provide a clear unpin and reset path.

**Explicit non-goals**

- No automatic reordering based on analytics.
- No red badge for informational or unavailable states.
- No new background polling or provider fetch solely for badges.
- No unlimited customizable dashboard system.

**Acceptance criteria**

- Pins preserve order across reload and recover safely from malformed storage.
- Counts never imply data was checked when the owning source was unavailable.
- Text and accessible labels accompany color.
- Navigation remains stable with no clipping or document overflow at required widths.

**Success signal**

- Fewer navigation steps to frequently used workspaces.
- Increased completion from Activity attention states without badge fatigue.

## Next

### Task 6 — Forward-Validation Lab

**Status:** Proposed, discovery required

**Problem**

Historical calibration is descriptive and includes reconstructed observations. Signal does not
yet have genuinely prospective, fixed-model, out-of-sample evidence.

**Discovery gate**

Approve and freeze before collecting results:

- model version and scoring configuration;
- eligible markets, modes, and source-toggle states;
- observation cadence;
- forward horizons and benchmarks;
- missing-data and correction policy;
- sample-size thresholds;
- drift and model-change policy; and
- language that separates evaluation from prediction or advice.

**Minimum valuable slice**

- Register a model/configuration version before the first eligible observation.
- Record only observations created after that registration.
- Freeze eligible source inputs, score, tier, provenance, benchmark, and timestamps.
- Resolve future outcomes mechanically after the predefined horizon.
- Keep prospective observations separate from observed historical snapshots, reconstructions,
  backfills, and paper decisions.
- Show sample size, coverage, model version, unresolved observations, and evidence level.

**Explicit non-goals**

- No retroactive relabelling of historical data as out-of-sample.
- No tuning the frozen model against accumulating holdout results.
- No unconstrained strategy backtest, transaction simulation, or performance claim.
- No `accuracy` label without a predefined classification rule and adequate sample.

**Acceptance criteria**

- A model/configuration change starts a new cohort and never rewrites the prior cohort.
- Outcomes cannot resolve before their predefined horizon.
- Missing benchmark or future data remains unresolved, not zero.
- Prospective and historical/reconstructed evidence are visually and machine-readably distinct.
- The UI retains non-prediction, overlap, cost, and sample limitations.

**Success signal**

- Enough fixed-model observations accumulate to make the evidence level meaningful.
- Users can distinguish current-model forward evidence from historical reconstruction.

---

### Task 7 — Corporate-Action Resolution Assistant

**Status:** Proposed, demand-gated

**Problem**

Portfolio reconciliation explicitly leaves splits, reverse splits, mergers, spin-offs, symbol
changes, transfers, and reinvestments unsupported. These gaps can prevent otherwise valid local
transaction histories from reconciling.

**Demand gate**

Proceed only when the Portfolio-to-Queue funnel shows sustained holdings/reconciliation usage and
manual evidence identifies corporate actions as a repeated blocker.

**Minimum valuable first slice**

Support only:

- stock splits and reverse splits; and
- symbol changes.

For each resolution:

- require exact account, market, symbol, currency, effective date, and user-supplied evidence;
- preview before/after quantities and reconciliation effects;
- preserve the original imported transaction and holdings snapshots;
- save a versioned browser-local adjustment record;
- require explicit confirmation; and
- expose a complete local audit trail and removal preview.

**Explicit non-goals**

- No automatic provider inference or silent ledger rewrite.
- No merger, spin-off, reinvestment, transfer, lot, tax, or realized-return support in the first
  slice.
- No brokerage synchronization.
- No cross-currency value conversion.

**Acceptance criteria**

- Adjustments are additive overlays; imported source rows remain unchanged.
- Reversing an adjustment restores the preceding reconciliation result.
- Formula-like text and malformed records remain inert and visible as validation errors.
- Account, quantity, value, transaction, and evidence data remain outside analytics and research
  sync.
- Empty, preview, conflict, apply, reload, remove, and storage-unavailable states are verified.

**Success signal**

- Repeated split or symbol-change exceptions can be resolved without editing source CSV files.
- Users can explain every adjusted quantity from the audit trail.

## Later

### Task 8 — Malaysia Primary-Source Parity

**Status:** Blocked, provider-gated

**Problem**

Malaysia coverage cannot safely reuse SEC, Nasdaq, US benchmark, or US ranking semantics. Important
primary-source evidence remains unavailable without a suitable official or licensed source.

**Provider gate**

Before implementation, document approved terms for:

- automated retrieval;
- caching and storage;
- display and redistribution;
- identifiers and symbol mapping;
- corrections and revisions;
- rate limits;
- attribution; and
- production use.

**Recommended first slice**

Start with **exchange announcements** because they strengthen primary evidence without pretending
to provide full fundamental or valuation parity.

The first slice should:

- use one fixed official or approved origin;
- retain issuer/exchange identifiers, publication time, correction state, and source URL;
- keep documents and metadata bounded by documented size, type, redirect, and timeout limits;
- let the user explicitly select evidence for a review; and
- never auto-change thesis, checklist, triggers, confidence, or decision.

**Explicit non-goals**

- No unapproved scraping.
- No proxy result manufactured from US data.
- No simultaneous dividends, historical fundamentals, Discovery, and announcement expansion.
- No AI summary presented as primary-source fact.

**Acceptance criteria**

- The provider and legal/usage contract is recorded before code is written.
- Corrections and revisions remain visible rather than overwriting history silently.
- Provider failures degrade independently and preserve saved research.
- Unsupported symbols and missing fields remain unavailable.
- Attribution, timestamps, and source links are visible at every use.

**Success signal**

- Malaysia reviews contain more directly cited official evidence.
- Manual citation effort decreases without increasing unsupported or stale claims.

## Intentionally Not Prioritized

Do not add these merely to match other investment products:

- automated trade execution or brokerage integration;
- AI-generated buy/sell recommendations;
- automatic checklist, thesis, trigger, confidence, or decision changes;
- tax-lot advice, entitlement calculations, or inferred tax optimization;
- public performance leaderboards or social trading;
- total-return or realized-gain claims without complete cash-flow and lot evidence;
- cross-currency totals without explicit approved FX inputs;
- unconstrained backtesting over sparse or reconstructed history;
- another broad analytics workspace without demonstrated workflow friction; or
- account infrastructure without repeated cross-device failures and an approved threat model.

## Roadmap Update Record

Update this table only when a task changes state or scope.

| Date | Task | From | To | Evidence or reason |
| --- | ---: | --- | --- | --- |
| 2026-07-30 | 0 | Proposed | Observing | Existing Today and privacy-safe Usage funnels are available; collect approximately 30 active-use days or two review cycles. |
| 2026-07-30 | 0 | Observing | Observing | Visible local baseline has no prior Today or Portfolio-to-Queue activity. Added only the missing correlated Today destination-reach metric; the real-use window and manual notes remain outstanding. |
| 2026-07-30 | 1 | Proposed, gated | Verified implementation; promotion gated | Existing deterministic priority and owner contracts now form a responsive action home with strict local continuation, fixed return context, independent degradation, and bounded analytics. Watchlist remains the default while Task 0 observes real use. |
| 2026-07-30 | 2 | Proposed | Verified | The shared command palette now searches bounded validated local Research, Evidence, Filings, and Queue owner state with deterministic caps, exact non-mutating destinations, independent degradation, and no search network or analytics content path. |
| 2026-08-01 | 3 | Proposed, audience-gated | Verified | Audience expansion was explicitly authorized. Ported the validated, reversible owner-derived setup checklist and isolated read-only demo onto current `main` with no provider/application requests or real-state mutation. |
