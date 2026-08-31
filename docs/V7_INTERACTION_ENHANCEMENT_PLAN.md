# Signal V7 Interaction Enhancement Plan

## Status

- Status: Proposed for product-owner approval.
- Delivery state: Documentation only. No implementation is authorized by this document.
- Target routes: `/` (Market Conditions) and `/research` (Investment Research).
- Evidence boundary: The recommendations combine current repository contracts with an external
  source-level interaction audit. Deployed V7 parity remains unverified and must be checked before
  implementation.
- Existing unrelated work in `docs/NEXT_PRODUCT_ROADMAP.md` and
  `docs/PRODUCT_IMPROVEMENT_AUDIT_2026-08-01.md` must be preserved.

## Objective

Make V7 feel meaningfully interactive by connecting each conclusion to inspectable evidence, an
obvious next action, and visible result or recovery feedback. Preserve Signal's calm,
decision-first and evidence-transparent character.

The intended interaction sequence is:

`Read conclusion -> inspect evidence -> take action -> see result or recovery`

### Non-goals

- Decorative animation, animated score counting, gamification, or more dashboard chrome.
- Changes to scoring, market interpretation, research decisions, APIs, provider behavior,
  persistence schemas, authored research, analytics, notifications, or security boundaries.
- Automated trading, recommendations, or automatic research-record mutation.
- Removing V6 rollback routes or changing deployment configuration.
- Reorganizing Start or hiding Research workspaces without separate product evidence and approval.

## Existing Architecture And Users

Signal is a Next.js App Router application with two connected decision-support workspaces:

- Market Conditions provides a top-down market assessment.
- Investment Research provides a bottom-up security assessment.

The primary user is a self-directed investor following US and Malaysian markets who needs a compact
but transparent workflow. The promoted V7 routes reuse shared Market and Research controllers and
existing V6 domain surfaces. Presentation may change, but Market context must never overwrite a
security thesis, checklist, valuation, trigger, or decision.

The primary product flow remains `Market -> Research`. `/start` remains an optional guided daily
journey unless separately promoted through product evidence and approval.

## Product Decisions

These are recommended decisions and remain pending product-owner approval:

1. Keep `Market -> Research` as the primary journey; keep Start optional.
2. Show essential decision information by default; collapse advanced evidence and remember its
   disclosure state.
3. On mobile Research, show the selected security, decision, reason, next gap, and primary action
   before ticker browsing. Keep an explicit compact ticker selector immediately available.
4. Never silently replace a selected ticker when filters exclude it. Retain the selected security
   and show `Hidden by current filters` with `Show selected` and `Clear filters` recovery actions.

## Enhancement Scope

### Phase 1: Recommended First Delivery

#### Market first viewport

- Place the existing Research/watchlist handoff beside the first-reading summary.
- Turn strongest support, strongest conflict, and freshness concern into semantic inspection links
  that reveal and focus their owning evidence.
- Keep posture, strongest support, strongest conflict, freshness, date, and primary caveat visible.
- Group calibration detail, outcomes, secondary context, glossary, and methodology under a clearly
  labelled `Advanced evidence` disclosure.
- Preserve browser Back behavior and the user's previous position after inspecting evidence.

#### Market action feedback

- Keep prior valid content visible while Market configuration refreshes.
- Name the action that caused the update, such as `Updating for Contrarian interpretation`.
- After completion, identify the active configuration and summarize what changed without animating
  numbers.
- On failure, state that previous conditions remain visible and keep Retry available.

#### Research contextual action and continuity

- Place exactly one context-sensitive next action beside the selected decision, reusing the
  existing readiness/next-gap rules.
- Persist live watchlist query, market, decision, and density state in the URL.
- Use history replacement for filter typing/adjustment and history push for explicit ticker or
  workspace selections.
- Retain a selected security when filters hide it; show a visible and polite live-region message.
- Add active-filter details and `Clear filters` to the no-results state.
- Keep saved research visible when quote refresh partially fails and report the partial failure in
  the watchlist owner.

#### Shared interaction contract

- Provide consistent default, hover, pressed, selected/current, focus, disabled, and pending states
  for actionable controls.
- Make the command palette a complete modal: contain Tab and Shift+Tab, make background content
  inert, lock background scrolling, close on Escape, and restore trigger focus.
- Respect reduced motion for CSS keyframes and programmatic scrolling.
- Use geometry-matched loading skeletons while retaining route identity and stable controls.
- Keep functional motion restrained and avoid layout-moving feedback.

### Phase 2: Separate Approval Required

- Promote a compact interactive Market score-history explorer with range selection, persistent
  readout, pointer/touch exploration, and keyboard point navigation.
- Add a complete Research chart explorer with OHLCV/indicator readout, pointer and keyboard parity,
  and an optional chronological data table.
- Replace the mobile watchlist carousel with an explicit previous/next ticker selector and picker.
- Simplify mobile Chart controls while preserving range, comparison, setup, indicator, and VWAP
  state.
- Refine V7-shaped route skeletons if Phase 1 cannot safely cover them without widening scope.

### Deferred

- Promoting Start into primary navigation.
- Moving additional Research destinations behind `More` beyond the existing V7 contract.
- Treating five-participant usability targets as automated release gates.
- Pixel-for-pixel claims against production until the deployed revision is identified and tested.

## Acceptance Checklist

### Objective And Non-goals

- [ ] Market and Research expose a clear conclusion-to-evidence-to-action path.
  **Verify:** Runtime-observed Chromium flows at desktop, tablet, and mobile widths.
- [ ] No scoring, research-decision, API, persistence, provider, analytics, or notification contract
  changes.
  **Verify:** Source review, final diff, typecheck, and existing regression harnesses.
- [ ] No decorative or perpetual animation is introduced.
  **Verify:** Source review plus normal/reduced-motion browser inspection.

### Primary And Exception Flows

- [ ] Market posture, trust context, inspection links, and Research handoff are available before
  advanced evidence.
  **Verify:** Browser geometry and interaction assertions at `1280x900`, `768x1024`, and `375x812`.
- [ ] Evidence inspection reveals the correct owner, moves focus to its heading, and browser Back
  restores the prior context.
  **Verify:** Deterministic browser scenario.
- [ ] Market configuration changes expose cause, pending, success, failure, retry, and retained-data
  states.
  **Verify:** Intercepted success, delay, stale-response, and failure scenarios.
- [ ] Research exposes one next action derived from the existing readiness owner without automatic
  mutation.
  **Verify:** Fixture tests for incomplete thesis, valuation gap, overdue review, and complete state.
- [ ] Filtering cannot silently replace the selected security.
  **Verify:** Filter-out-selected browser scenario and accessibility-tree assertion.
- [ ] Explicit ticker selections participate in Back/Forward history; filter typing does not add one
  history entry per keystroke.
  **Verify:** Browser history, reload, and deep-link restoration scenario.

### Architecture And Data Contracts

- [ ] Existing Market and Research controllers, readiness rules, URL merge helpers, and domain
  surfaces are reused.
  **Verify:** Source review and change-impact inspection.
- [ ] Market handoff context remains evidence-only and cannot alter saved Research state.
  **Verify:** Targeted handoff regression plus saved-record before/after comparison.
- [ ] Unknown URL parameters and current workspace/ticker/tab context remain preserved.
  **Verify:** Deep-link round-trip tests with unrelated query parameters.
- [ ] No new dependency or schema migration is introduced.
  **Verify:** Package/lockfile and migration diff inspection.

### Validation, Loading, Empty And Error States

- [ ] Query, market, decision, density, ticker, and workspace URL values are parsed through existing
  validation boundaries.
  **Verify:** Valid, missing, malformed, and unknown-parameter tests.
- [ ] Route loading retains identity and uses skeletons matching the final content geometry.
  **Verify:** Delayed-request browser capture and layout-shift observation.
- [ ] Zero Research results show active filters and provide one-step filter recovery.
  **Verify:** Deterministic zero-result and clear-filter scenario.
- [ ] Partial quote failure preserves saved research and reports only the failed owner.
  **Verify:** Rejected quote-batch request with the workspace remaining usable.
- [ ] Market refresh failure preserves the previous valid briefing and offers Retry.
  **Verify:** Intercepted refresh failure and retry success.

### Security, Privacy And Permissions

- [ ] No authored thesis, notes, evidence, holdings, transactions, accounts, credentials, or private
  payloads are added to URLs, analytics, logs, or new requests.
  **Verify:** Source review and browser request inspection.
- [ ] No interaction silently saves, mutates, deletes, or replaces Research data.
  **Verify:** Mutation-call interception and saved-record before/after comparison.
- [ ] The command palette background is inert and inaccessible while the modal is open.
  **Verify:** Keyboard loop, accessibility tree, scroll-lock, Escape, and focus-return checks.

### Devices, Browsers And Platforms

- [ ] Chromium passes at `1280px`, `768px`, and `375px` in light and dark themes.
  **Verify:** Repository Visual QA Contract and fresh screenshots.
- [ ] No document-level horizontal overflow, overlap, clipping, or hidden active state occurs.
  **Verify:** Geometry assertions and screenshot inspection at every supported width.
- [ ] Pointer, keyboard, and touch-equivalent paths exist for changed Phase 1 controls.
  **Verify:** One consolidated interaction pass per input method.
- [ ] Reduced-motion mode removes pulse/automatic smooth scrolling without hiding progress.
  **Verify:** Emulated `prefers-reduced-motion` browser scenario.
- [ ] Safari, Firefox, and native mobile-browser parity are not claimed unless separately tested.
  **Verify:** Final report lists these as unverified or provides explicit runtime evidence.

### Compatibility And Migration

- [ ] `/`, `/research`, `/main-v7`, and `/research-v7` retain their current meanings and state
  restoration.
  **Verify:** Route and deep-link smoke checks.
- [ ] `/main-v6` and `/research-v6` remain unchanged rollback references.
  **Verify:** Final diff plus route smoke checks.
- [ ] Existing local-storage and saved-view values continue to load; URL-backed filters do not erase
  saved-view behavior.
  **Verify:** Pre-existing storage fixture, saved-view apply, reload, and malformed-state recovery.
- [ ] No data migration or deployment action is required for Phase 1.
  **Verify:** Source and deployment-config diff inspection.

### Delivery Evidence

- [ ] Documentation is source-verified against current project contracts.
  **Verify:** `npm run harness` and documentation diff inspection.
- [ ] Implementation passes lint, typecheck, harness, targeted Market/Header/Research checks, and the
  production build.
  **Verify:** Command receipts labelled test-passed or build-passed.
- [ ] Affected UI behavior is runtime-verified through one consolidated Chromium pass.
  **Verify:** Scenario ledger with widths, themes, states, screenshots, console, and request evidence.
- [ ] Deployment is never inferred from local source, tests, or build output.
  **Verify:** Final report labels deployment unverified unless a separate deployed-runtime check
  identifies and exercises the released revision.

## Single-model Implementation Handoff

Use one Codex agent with:

- Model: `GPT-5.6 Sol` (`gpt-5.6-sol`).
- Reasoning: `xhigh`.
- Orchestration: single agent; do not use Ultra automatic delegation.

Rationale: this is a shared, responsive, interaction-heavy frontend change that requires careful
repository inspection, compatibility preservation, implementation, and consolidated browser
verification. Official OpenAI model guidance describes Sol as the flagship capability tier and
recommends `high` or `xhigh` when deeper reasoning produces a quality gain. `xhigh` is proportionate
for the approved Phase 1 scope; reserve `max` for a later escalation if phases are combined or
verification reveals unusually complex cross-route regressions. Ultra is unnecessary while the
approved delivery remains one tightly connected scope owned by one agent.

The implementation agent must revalidate the branch, dirty state, current source, and runtime before
editing. It must implement only the approved phase, preserve unrelated work, avoid unapproved
dependencies/refactors/commits/pushes/deployments, and stop with an evidence-labelled pass/fail
checklist.

## Approval Gate

Implementation may begin only after the product owner confirms:

- the four product decisions;
- the approved phase and included enhancement items;
- that implementation is authorized; and
- that commit, push, and deployment remain unauthorized unless separately requested.
