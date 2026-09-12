# Signal V8 UI/UX Enhancement Plan

Status: implementation in progress; Batches 1–3 verified, remaining batches pending.
Recorded: 2026-09-12.
Scope: connected `/main-v8` and `/research-v8` experiences.

This consolidates the original enhancement proposal and the decisions accepted in the planning conversation. It supersedes alternative treatments in that proposal. There are **17 stable enhancement IDs: 16 UI items across seven batches, and one deferred currency task**. Research chart-state retention belongs to V8-12, not an eighteenth item.

## Goal and boundaries

Refine V8 without another dashboard, portal, navigation concept, or redesign. Preserve the airy light-blue canvas, navy typography, restrained green accents, score-first Market hierarchy, indicator mini-charts, investigation tabs, contextual inspector, and selected-security Research workspace.

Preserve source evidence, uncertainty, freshness, coverage, observed/reconstructed distinctions, benchmark gaps, insufficient-sample handling, exact historical tables, and replay isolation. Never substitute current evidence for missing historical evidence or fabricate continuity across gaps. Preserve saved Research data separately from provider facts, the existing editing destination, readiness framework, tools directory, and explicit unavailable values.

No scoring-methodology changes, automatic FX conversion, new dependencies without demonstrated necessity, new scenario API, database-backed scenarios, or browser-storage persistence. Currency storage/API/editor work is deferred under V8-16. Existing currency warnings remain visible.

This document authorizes no commit, push, deployment, or implementation by itself. Execute a requested batch in its own focused task; preserve unrelated working-tree changes. Suggested execution setting from the planning discussion: Astra / High.

## Delivery batches and tracking

Work in the order below. Within each batch, inspect prerequisites, implement related changes, verify the affected behaviour, and record evidence before advancing. Tests belong to their batch, not a final deferred QA phase.

| Batch | Items | Purpose | Status |
| --- | --- | --- | --- |
| 1. Correctness and accessibility | V8-01, V8-07, V8-08, V8-11 | Semantic colours, outcome-date label, contrast, indicator units | Complete; see execution evidence |
| 2. Research continuity | V8-02, V8-06 | URL selection, Back/Forward, edit-return refresh | Complete; see execution evidence |
| 3. Loading resilience | V8-04 | Request ownership, timeout budgets, retry, partial history | Complete; see execution evidence |
| 4. Investigation continuity | V8-03, V8-12 | Inspector behaviour, retained state, scenario baseline | Not started |
| 5. Historical evidence | V8-09, V8-10, V8-15 | Provenance, preview/replay separation, consistent history | Not started |
| 6. Research hierarchy | V8-05, V8-17 | Compact security selector and actionable readiness | Not started |
| 7. Presentation polish | V8-13, V8-14 | Warning copy, readable metadata, touch targets | Not started |
| Deferred, separate task | V8-16 | Persist explicit valuation currency through editor/API | Deferred |

Evidence correctness is a priority: V8-11 ships in Batch 1; provenance and historical scope form a dedicated correctness batch, ahead of hierarchy and polish. Batch numbers represent delivery dependencies, not severity rankings.

### Batch prerequisites and exit evidence

| Batch | Required preflight | Evidence required to close the batch |
| --- | --- | --- |
| 1 | Confirm returned tier semantics, formatter ownership, date validation and backend horizon rules | Signed deltas/tier cases; date ordering and invalid-date cases; rendered contrast; card/inspector agreement |
| 2 | Trace URL parsing, existing editor destination, saved-record refresh and selection ownership | Choose security, reload/share, Back/Forward, edit/save/return, failed refresh, unknown ticker |
| 3 | Define request identities and state ownership using V8-12; record endpoint budgets below | Slow/failed/partial/aborted requests; stale responses including catch/finally; same-identity retention; bounded retry |
| 4 | Reuse Batch 3 identities; establish complete scenario baseline inputs and responsive inspector ownership | Reset matrix, newer-reading scenario flow, focus/scroll restoration and breakpoint transitions |
| 5 | Trace plotted provenance, archive availability and grouped history | Mouse/keyboard/touch preview versus replay; unavailable snapshot; gaps and return-context restoration |
| 6 | Reuse Batch 2 selection/refresh contract; verify actual assessment destination | 3, 10 and 30+ saved securities; search/filter stability; actionable readiness destination |
| 7 | Inventory remaining copy/size issues after behavioural changes | Preserved disclosures, mobile/desktop readability, touch/focus, zoom and overflow checks |

## Evidence status and implementation preflight

Evidence labels describe the reported problem, not completion: **source-confirmed**, **isolated-test-confirmed**, **browser-reproduced**, or **proposed improvement**. Planning source spot-checks found positional delta styling in `src/components/v8/market-v8.module.css` and last-array-item date selection in `src/components/v8/MarketV8ConnectedHistory.tsx`. Other claims below remain proposed improvements pending targeted verification. No full V8 browser audit was performed during consolidation.

Revalidate checkout, branch, dirty state, route owners, nearby patterns, tests and shared consumers before each batch. Current source is authoritative; initial owner paths are navigation hints, not permission to change every consumer. Follow [architecture](ARCHITECTURE.md), [scoring semantics](signal-scoring.md), [quality rules](QUALITY.md), and [testing requirements](TESTING.md).

If preflight exposes an incompatible backend contract or requires broader changes, report the specific conflict and re-scope that item. Do not silently expand the implementation or reopen settled layout choices without evidence.

## Enhancement specifications

### V8-01 — Semantic score and tier colours

Batch: 1. Evidence: source-confirmed positional delta styling; full tier/mode behaviour needs verification.

- Use readable neutral navy for positive, negative and zero deltas, with explicit signs and points. Colour does not encode delta direction.
- Style tier badges using the service's mode-specific returned interpretation; retain tier text and visible mode. Do not reverse Standard colours to manufacture Contrarian interpretation.
- Replace positional semantic styling with explicit state classes/tokens. Retain descriptive interpretation and non-colour cues.
- Acceptance: positive/negative/zero, all supported tiers, Standard and Contrarian are understandable; no delta becomes green solely because of its position. This supersedes the original requirement for distinct delta colours.

### V8-02 — Research URL selection

Batch: 2. Evidence: proposed improvement; verify current caller chain.

- URL owns ticker and supported main tab. Push history for explicit security changes; replace for tab changes. Preserve unrelated query parameters.
- Selecting MSFT updates the URL; reload and shared links restore that security and supported tab. Back/Forward updates the displayed selection.
- Unknown tickers produce an explicit message rather than silently selecting another company. Search/filter changes do not change selection.
- Acceptance: initial deep link, selection, reload, share, Back/Forward, unknown ticker and unrelated parameters. Pair with V8-06 in one acceptance journey; refresh creates no history entry.

### V8-03 — Contextual indicator inspector

Batch: 4. Evidence: proposed improvement; browser reproduction required.

- Desktop is non-modal, viewport-sticky with the actual header offset and bounded internal scrolling. Opening updates the panel without page jumps or automatically moving focus to Close.
- Keep focus on the originating control, announce a concise detail update, and provide a keyboard-accessible route into the inspector. Closing from inside restores focus to the trigger or a logical fallback.
- Mobile uses a modal with appropriate initial focus, contained keyboard focus, visible dismissal, Escape and focus restoration.
- Acceptance: open near page top and bottom; inspect while scrolling; keyboard entry/close; mobile dismissal; resize across both breakpoints while open. No hidden focused element, leftover inert state, scroll lock or focus trap on desktop.

### V8-04 — Loading, timeout and retry resilience

Batch: 3. Evidence: proposed improvement; timing and endpoint behaviour need measurement.

- Market identity includes market, mode, source settings and current/replay context; replay includes its selected snapshot. Research identity includes security and applicable request options.
- Only the active request generation may update data, errors or loading state, including obsolete catch/finally handlers. Cancel or ignore superseded work.
- Retain usable data only for the same identity, with original retrieval timestamp and refreshing state. Never display a different ticker's provider values during selection changes. Failed refresh retains prior same-identity data with failure/retry feedback.
- Current score loading is independent of archive loading. Publish successful archive segments incrementally, retaining gaps and distinguishing pending, loaded, failed and genuinely unavailable records. Mark partial history incomplete and preserve a still-valid selected point.
- Permit at most one automatic retry for eligible transient read failures. Cancellation, invalid payloads and market/security mismatches are not automatically retried. Provide deliberate manual retry.
- A background refresh must respect the scenario baseline contract in V8-12; it cannot silently change an edited simulation.

Before this batch is complete, fill the following record for **each actual endpoint/operation**, including current score, replay, archive reads and Research reads in scope. Values must be supported by measured requests or service limits, not browser-test timeouts.

| Endpoint/operation | Identity | Attempt timeout | Max automatic attempts (at most 2) | Retryable conditions/delay | Total operation budget | Measurement/service-limit evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `/api/signals/v2` | market/mode/source/current | 15s | 2 | Network/timeout or HTTP 408/502/503/504; 250ms delay | 30s including delay | Local 200 read: 2321ms; earlier first read 4812ms |
| `/api/signals/replay` index and snapshot | configuration; snapshot adds date | 10s | 2 | Same transient policy | 20s per read | Local index 200: 122ms; snapshot reads passed integration scenarios |
| `/api/research/watchlist` | saved list | 10s | 2 | Same transient policy | 20s | Local 200: 130ms; retains previous 20s operation bound |
| `/api/research/symbol/:symbol` | security/market | 20s | 2 | Same transient policy | 30s | Local cached 200: 93ms; retains previous 30s operation bound |
| Overall archive operation | Configuration identity | Policies above; four reads at a time, up to 12 dates | At most 2 per read | Same transient policy | 60s including index, queue and reads | Three bounded waves; abort ends outstanding work and retains partial evidence |

Measurements are local development/cache samples, not production latency percentiles. Limits provide conservative headroom and explicit recovery; no service SLA is inferred. HTTP 429 is not automatically retried. JSON/identity validation and cancellation never trigger automatic retry.

State whether each deadline applies per attempt or to the whole operation. Attempts and retry delays must fit within the total budget.

Acceptance: normal/slow/timeout responses, partial success, failed archive record, successful record with no applicable evidence, failed provider refresh, cancellation, ticker/configuration switch during refresh, out-of-order completion and manual retry. Numeric policy and evidence are completion gates, not deferred notes.

### V8-05 — Selected-security Research hierarchy

Batch: 6. Evidence: proposed improvement; validate current layout.

- Use a compact selected-security header with identity, research status and next action, plus a searchable, expandable saved-securities section.
- A labelled control such as “Saved securities · 8” reveals the list and market filter. Preserve discovery without a new dashboard or virtualization feature.
- Expanding, searching and filtering never change the selected security; only explicit selection does.
- Acceptance: 3, 10 and 30+ securities; selected research remains readily reachable; filtered-out selection stays selected; keyboard and mobile selector remain usable.

### V8-06 — Edit and return continuity

Batch: 2. Evidence: proposed improvement; verify existing editor and refresh behaviour.

- Keep V8 read-only and use the existing Research editor. On returning/focus, perform throttled saved-record revalidation while preserving ticker, tab and practical scroll context.
- Focus is a revalidation trigger, not proof of a save. Render actual server data; failed refresh retains prior records and exposes recovery.
- Revalidation cannot select a different security, reset the tab or push history. Avoid duplicate overlapping refreshes and obsolete responses.
- Acceptance: edit MSFT, save, return and discover the update without Reload; return without saving; failed refresh; selection change during refresh. Exercise with V8-02.

### V8-07 — History outcome-window date

Batch: 1. Evidence: source-confirmed use of `observations.at(-1)`; backend semantics and actual displayed failure need verification.

- Derive the relevant latest date explicitly from valid applicable dates, independent of array order.
- Preflight must establish whether the label describes target horizon date or actual benchmark observation date, complete dataset or filtered cohort, and existing calendar/trading-day and non-trading-day handling. Label that meaning accurately.
- Disclose the count of dates excluded from label calculation; show unavailable only when no valid applicable date remains.
- Label exclusions do not authorize changes to statistics, sample counts, return calculations or backend eligibility. Preserve their contract.
- Trace upstream validation first: a component filter cannot recover a rejected response. Any necessary validation adjustment must be narrow and must not weaken the general payload boundary.
- Acceptance: ascending, descending, shuffled, single, empty, missing, impossible and mixed valid/invalid dates; all-invalid and insufficient-data cases; declared filtering scope. Same applicable data yields the same label regardless of ordering, with unchanged statistical methodology.

### V8-08 — Small-text contrast

Batch: 1. Evidence: proposed improvement; actual rendered combinations need measurement.

- Separate decorative accent green from accessible text green and soft backgrounds; adjust muted text tokens as needed. A darker existing green is a candidate, not proof of compliance.
- Measure text on its actual backgrounds, including tabs, badges, metadata, controls and interaction states. Meet applicable normal-text contrast requirements; preserve visible focus and non-colour cues.
- Acceptance: recorded rendered colour pairs and contrast results; normal text at least 4.5:1 where required. Recheck shared consumers if tokens are shared.

### V8-09 — Main-chart provenance

Batch: 5. Evidence: proposed improvement; verify existing history provenance model.

- Reuse authoritative observed/reconstructed provenance. Distinguish it with a restrained legend and line treatment that does not rely on colour alone or bridge missing evidence.
- Selected-point readout includes date, score and origin before replay. Do not infer origin from whether archive retrieval succeeded.
- Acceptance: observed, reconstructed, mixed and missing-history cases; pointer, keyboard and touch readouts agree with underlying records.

### V8-10 — Separate chart preview and replay

Batch: 5. Evidence: proposed improvement; verify input behaviour in browser.

- Hover may show a temporary readout without navigation. Click, tap or keyboard point selection selects a preview with date, score, provenance and snapshot availability.
- Only “Open historical snapshot” enters replay, using the selected point rather than the currently hovered point. Point selection never implicitly enters replay.
- Explain unavailable snapshots beside the action; a plotted point does not guarantee replay evidence. Never substitute current evidence.
- “Return to current conditions” restores the previous current-market investigation context using V8-12.
- Acceptance: equivalent mouse/keyboard/touch flow; hover differs from committed selection; unavailable snapshot; replay loading/failure/retry; return restores context.

### V8-11 — Indicator units and summary consistency

Batch: 1. Evidence: proposed improvement; verify formatter and data owners.

- Reuse the detailed unit-aware formatter in cards. Keep raw input separate from normalized score, for example raw 17.68 versus normalized 74/100; show percentage units where appropriate.
- Acceptance: card and inspector agree on raw value, units, date, normalized score and status, including unavailable/stale values. No scoring or unit conversion is invented in presentation.

### V8-12 — Investigation state and scenario baseline

Batch: 4; ownership contract also guides Batch 3. Evidence: proposed improvement; verify mounted state owners.

URL owns shareable navigation; fetched records/freshness belong to the data layer; page-level UI state owns temporary choices. Lift state only as needed to survive panel unmounting, rather than keeping every tab mounted. No durable storage.

| State | Investigation tab switch | Security/Market configuration change | Enter/leave replay | Reload |
| --- | --- | --- | --- | --- |
| Research ticker/main tab | Preserve | Change ticker; retain supported tab | Not applicable | Restore URL |
| Research chart range | Preserve | Retain range preference | Not applicable | Default |
| Research selected chart date | Preserve | Clear; select new security's latest point | Not applicable | Latest point |
| Market History subview/filters, including horizon and zone | Preserve | Reset on market/mode/source change | Restore prior current-view state | Defaults |
| Scenario assumptions | Preserve | Clear with reset notice | Suspend; restore original baseline | Clear |
| Market selected point/indicator | Preserve if applicable | Clear | Separate replay selection; restore current selection | Clear |

Once the user edits a scenario, retain the full baseline needed to reproduce it in memory: inputs, weights, reserve accounting and reference score. New data must not replace that baseline. Show “Newer reading available” and “Reset to latest reading”; reset clears assumptions and adopts the latest reading for the same configuration. Configuration changes clear the scenario as above. Do not add saved versions or a scenario API.

Acceptance: every matrix transition; tab unmount/remount; same-configuration refresh during an edited scenario; reset to latest; configuration change; replay round trip; reload clears temporary state. Reproducing a pinned simulation yields the same result despite background refresh.

### V8-13 — Warning hierarchy and plain-language copy

Batch: 7. Evidence: proposed improvement; inventory current repeated copy.

- Show a concise actionable quality summary, with expanded source-quality and technical evidence. Replace implementation terminology in primary UI with user-facing wording.
- Preserve distinctions among stale, missing, disabled, unavailable, neutral reserve, observed and reconstructed evidence. Preserve material warnings near the values they qualify.
- Acceptance: first sentence explains the issue; all prior meaningful evidence remains reachable; repetition is reduced without masking degraded coverage or changing financial meaning.

### V8-14 — Metadata and touch targets

Batch: 7. Evidence: proposed improvement; measure actual sizes and layout.

- Aim for essential metadata around 12–14px and common interactive targets around 44px where practical. These are design targets; verify applicable accessibility requirements separately.
- Prefer wrapping/disclosure over shrinking essential text. Keep timestamps, labels, tabs and segmented controls readable with visible focus.
- Acceptance: 320, 375, 390, 768, 1024 and 1440px, plus 200% zoom; no clipped labels or page-level horizontal overflow, usable tabs and touch controls. Follow the Visual QA Contract in TESTING.md.

### V8-15 — Consistent indicator history scope

Batch: 5. Evidence: proposed improvement; verify grouped history passed to each consumer.

- Preferred contract: pass all grouped segments to the inspector and retain gaps, matching card scope. Do not connect separated segments.
- If preflight establishes a constraint preventing that contract, explicitly re-scope before implementation; the alternative is a clearly labelled “Latest continuous history segment,” never an implication that all history is absent.
- Acceptance: earlier-only data, recent gaps, multiple segments and empty history; card and inspector accurately describe their scope, with no invented continuity.

### V8-16 — Explicit valuation currency (deferred)

Batch: none; separately scoped data-contract task. Evidence: proposed improvement; persisted monetary fields require inspection.

- Cover actual existing monetary assumptions through the existing editor/API/storage model. Do not add an illustrative `fairValue` field without checking the actual model.
- New monetary assumptions record explicit currency. Legacy currency stays unknown until explicitly supplied; no inferred migration or automatic relabelling.
- Exclude FX conversion. Preserve the current unknown-currency disclosure throughout all seven UI batches.
- Separate acceptance: editor/API round trip and legacy compatibility, validation, affected consumers and appropriate migration/rollback proof. This task is not a condition for completing the 16 UI items.

### V8-17 — Actionable Policy Guardrail readiness

Batch: 6. Evidence: proposed improvement; verify actual assessment route/capability.

- Distinguish actions available here from assessment required in the existing Research workspace. Provide a security-specific “Continue assessment” destination where supported.
- Do not imply V8 can resolve a requirement it cannot assess, or report missing assessment as a passed guardrail.
- Acceptance: every next research gap has a clear, valid action/destination; verify the destination actually supports the stated assessment and preserves security context. Do not invent a new assessment feature to satisfy the label.

## Verification and handoff

### Execution evidence — Batch 1 (2026-09-12)

- Implemented explicit returned-tier classes, neutral signed deltas, darker shared text tokens, common card/inspector raw formatting, and order-independent outcome target labels.
- `market-calibration.ts:208` selects the first benchmark date on/after the calendar-day target. The label explicitly describes the full horizon dataset target, not the actual benchmark session or filtered sample. Existing parser validation and return statistics remain unchanged; malformed dates rejected upstream stay rejected. Defensive label tests also cover impossible/missing dates that reach the helper.
- Passed: `npm run lint`, `npm run typecheck`, `npm run harness`, `npm run build`, scoped `git diff --check`, and `node scripts/v8-enhancement-qa.mjs`.
- Browser evidence: `.tmp/v8-enhancement/batch1-1789189768937/report.json` and screenshots at 1280/768/375; real local Chromium with captured service responses and deterministic tier/mode/delta variants. All five tiers in both modes, raw-value agreement, tier/accent contrast, date edge cases and document overflow passed; no console errors or unexpected failed requests. Mobile screenshot inspected. These are local checks, not deployment proof.
- Local target: `http://127.0.0.1:3000`; task-owned dev server left running for following batches. Existing unrelated V6/V7 work and untracked V8 exploration files preserved.
- GitNexus incremental refresh failed on an inconsistent FTS index; current source and targeted searches supplied ownership evidence instead. No index repair or unrelated configuration changes performed.

### Execution evidence — Batch 2 (2026-09-12)

- Batch 1 pushed and independently confirmed at `fee3438` on `origin/main`.
- Research now owns ticker/tab in the URL (push security, replace tab), preserves other parameters, handles Back/Forward and unknown selections, and throttles focus/visibility revalidation to five seconds. Revalidation retains saved records on failure and does not change navigation or selection.
- Passed full lint after correcting declaration ordering via targeted lint, typecheck, harness, production build and `node scripts/v8-continuity-qa.mjs`. Browser checks at 1280/768/375 covered URL/reload/history, tab continuity, unrelated parameters, simulated editor-save server response on return, failed refresh retention, unknown ticker and overflow. No live research writes were performed; actual persisted editor saving was not changed by this batch.
- Evidence: `.tmp/v8-enhancement/batch2-1789190106207/` plus the final rerun reported by the script. Local server remains `http://127.0.0.1:3000`; deployment is unverified.

### Execution evidence — Batch 3 (2026-09-12)

- Batch 2 pushed and remotely confirmed at `2845cc9`. Added shared bounded read recovery, incremental archive status/retention, explicit retries, same-security provider retention and a pinned in-memory scenario baseline during refresh. Cross-tab ownership follows in Batch 4.
- Passed lint, typecheck, harness, production build, scoped diff check and `node scripts/v8-loading-qa.mjs`. Evidence: `.tmp/v8-enhancement/batch3-1789190580819/report.json`.
- Direct helper tests cover retry limit, HTTP non-retry conditions, malformed JSON, operation deadline and cancellation. Chromium at 1280 covers held responses, mode/ticker switches, successful retry, invalid payload, one failed/one pending/one loaded archive record, incremental completion, provider refresh and failure retention. Provider requests used captured valid responses; no user records were mutated. Standard viewport coverage from preceding batches is retained; this batch changes async behaviour, not layout.
- Replay API returns no top-level configuration identity in a snapshot. Existing server query filters own market/mode/source matching; the UI validates the index identity, request ownership and snapshot date without inventing an API field.


Select the risk lane from actual scope under AGENTS.md and [TESTING.md](TESTING.md); batch grouping does not lower risk. Shared routes, responsive, async and state changes require the applicable standard checks and affected browser proof. Escalate for contract or other higher-risk changes. Use deterministic edge-case tests for behavioural logic and direct browser/request evidence for interaction claims; static checks alone do not prove them.

Use required lint, typecheck, harness and build checks as applicable under those owning policies. Do not assume older V6/V7 QA scripts cover V8 routes without checking their targets. Use one verified workspace server/session, report the tested URL, role/data conditions and whether it remains running. Consolidate responsive/visual checks according to the repo Visual QA Contract.

At each batch handoff record:

- Completed IDs and remaining acceptance gaps.
- Changed files and any shared consumers affected.
- Tests/commands, browser scenarios and evidence locations; distinguish simulated from live provider proof.
- Pre-existing failures, blockers, implementation prerequisites resolved and any scoped decisions.
- Delivery state separately: local, committed, pushed or deployed; never infer one from another.

Mark a batch complete only when its required checks pass and its acceptance criteria are proven or a specific blocking gap is reported without claiming completion. The seven UI batches complete the UI scope; V8-16 remains explicitly deferred.
