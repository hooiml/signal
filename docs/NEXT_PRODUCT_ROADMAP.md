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

- Reviewed against `main` at `e0b4fcd` on 2026-07-30.
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
| 1 | Today 2.0 action home | Proposed, gated | Make the next useful action obvious | Task 0 promotion gate |
| 2 | Universal local research search | Proposed | Find existing research and workflow state quickly | Reuse the current command palette and local data |
| 3 | First-run setup and guided demo | Proposed, audience-gated | Help a new user reach a first useful review | Confirm intended audience beyond the current operator |
| 4 | Research readiness strip | Proposed | Show what is complete, stale, blocked, or due for one ticker | Reuse existing Evidence, Policy, trigger, and review state |
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

**Status:** Proposed, gated by Task 0

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

---

### Task 2 — Universal Local Research Search

**Status:** Proposed

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

---

### Task 3 — First-Run Setup And Guided Demo

**Status:** Proposed, audience-gated

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

---

### Task 4 — Research Readiness Strip

**Status:** Proposed

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
