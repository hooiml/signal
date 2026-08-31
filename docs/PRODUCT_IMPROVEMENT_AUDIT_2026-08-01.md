# Signal Product Improvement Audit

Date: 2026-08-01
Reviewed commit: `b9954f92caba31036325b7763d3f4d72e33cc29d` (`main`, equal to `origin/main`)
Audit mode: read-only source review, production build, desktop/mobile browser review, representative workspace sweep, performance baseline, and repository harness
Purpose: record the highest-value UI/UX, performance, and content improvements without treating every recommendation as a defect

## Decision

No, all six items do **not** need to be fixed as if they were bugs.

| Order | Item | Classification | Delivery recommendation |
| ---: | --- | --- | --- |
| 1 | Repair the Today/Alerts request contract | Confirmed functional defect | Must fix first |
| 2 | Prevent the PWA prompt from covering mobile actions | Confirmed UI/accessibility defect | Must fix second |
| 3 | Improve Market and Research initial performance | Measured performance improvement | Should improve before expanding usage |
| 4 | Shorten Start and preserve selected-candidate context | UX/content improvement | Should improve after the defects |
| 5 | Add progressive disclosure inside Portfolio | Information-architecture improvement | Improve incrementally; no urgent rewrite |
| 6 | Prefer pinned workspaces and attention badges over another workspace | Product-direction guardrail | Optional and evidence-gated; not a repair |

Items 1 and 2 are the only confirmed defects in this audit. Items 3 through 5 are worthwhile improvements with different cost and blast radius. Item 6 is guidance for future product work and should not be implemented automatically.

## Evidence Summary

- The production build passed.
- The repository harness passed, including the Research regression suite.
- Audited routes had no document-level horizontal overflow at desktop or 375px mobile widths.
- The isolated guided demo made no application API request.
- Market performance baseline: 257,538 JavaScript bytes, 18 requests, and 4,750ms median LCP.
- Research performance baseline: 338,868 JavaScript bytes, 22 requests, and 3,190ms median LCP.
- The Market and Research performance runs had stable transfer sizes and request counts with no same-origin request failures.
- The local performance evidence is stored in `.tmp/signal-performance/2026-07-31T17-28-04-366Z/report.json`.
- The existing unrelated edit in `docs/NEXT_PRODUCT_ROADMAP.md` was preserved and was not used as authorization to change roadmap status.

## 1. Repair the Today/Alerts Request Contract

**Classification:** Confirmed functional defect
**Priority:** P0 — first implementation slice
**Scope risk:** Narrow

### Confirmed problem

`SinceLastVisitBriefingV6` sends only `symbol`, `market`, and `targetBuyZone` to `POST /api/research/alerts`. The route also requires a valid `lastReviewedAt` and parses accepted evidence and monitoring rules. The request therefore returns HTTP 400 with `Invalid ticker alert input.`

The Today action home eventually renders through independent degradation, but it reports triggered alerts as unavailable and records a console error. The dedicated Alerts workspace already builds the complete request shape correctly.

### Owning paths

- `src/components/v6/SinceLastVisitBriefingV6.tsx`
- `src/components/v6/ResearchAlertsV6.tsx`
- `src/app/api/research/alerts/route.ts`
- Relevant Research request-shape tests

### Recommended fix

Reuse one shared alert-request builder for Today, Since Last Visit, and the dedicated Alerts workspace. Do not weaken route validation to accommodate an incomplete client payload.

### Acceptance criteria

- Today and Since Last Visit send the same validated fields as the Alerts workspace.
- `POST /api/research/alerts` returns 200 for the current valid watchlist.
- Triggered-alert counts render when evidence is available.
- Genuine provider failures still degrade independently.
- No Alerts-related console error occurs in the Today flow.
- Focused Research regression tests, `npm run typecheck`, `npm run harness`, and one desktop/mobile Today browser flow pass.

---

## 2. Prevent the PWA Prompt From Covering Mobile Actions

**Classification:** Confirmed UI/accessibility defect
**Priority:** P0 — second implementation slice
**Scope risk:** Moderate because the lifecycle UI is global

### Confirmed problem

At 375x812, the fixed `Install Signal` prompt overlaps primary content. On Research it covers part of the `Review next gap` action. It also covers the first decision surface on Start and Market.

The shared mobile header also exposes controls below the repository's intended 40px target size: the command button measured 26x36 and the theme switch measured 52x28. The install button measured 95x36.

### Owning paths

- `src/components/pwa/PwaLifecycle.tsx`
- `src/components/v6/AppNavV6.tsx`
- `src/components/ThemeModeSwitchV2.tsx`
- `docs/TESTING.md` browser and PWA verification contracts

### Recommended fix

Make the install invitation non-blocking and dismissible. Prefer an inline or reserved-layout placement on narrow screens; if it remains fixed, reserve safe bottom space and prove it cannot cover an interactive element. Keep offline and waiting-update notices more prominent than the optional install invitation.

Increase shared header and lifecycle controls to at least the repository's 40px target without introducing header overflow.

### Acceptance criteria

- No lifecycle notice overlaps content or controls at 375x812, 768x900, or 1280x900.
- Install, command, theme, retry, and update controls meet the target size.
- The notice has an explicit dismissal or deferral path where applicable.
- Offline and update states remain truthful and keyboard operable.
- `npm run qa:header`, `npm run test:pwa`, `npm run qa:pwa`, and a focused mobile overlap assertion pass.

---

## 3. Improve Market and Research Initial Performance

**Classification:** Measured performance improvement
**Priority:** P1
**Scope risk:** Standard; implement as small independent slices

### Confirmed problem

Under the repository's repeatable 3G-like network and 4x CPU profile, Market's median LCP was 4.75 seconds and Research's was 3.19 seconds. Research transferred about 339KB of JavaScript on initial load; Market transferred about 258KB.

Market fetches the watchlist for an Exposure Map located far below the first viewport. Research mounts work inside collapsed overview content and made two initial `/api/research/inbox` requests in both baseline runs.

### Recommended sequence

1. Dedupe the initial Research inbox request without changing its state semantics.
2. Mount collapsed Research Overview content only when opened, while preserving its summary.
3. Lazy-load first-run setup when forced or genuinely applicable.
4. Split inactive Research detail tabs at existing ownership boundaries.
5. Defer Market's below-fold simulator, calibration, and Exposure Map until expanded or near the viewport; do not hide the primary score evidence.

### Acceptance criteria

- Use the same production build, throttle profile, run count, viewport, and cache conditions for before/after comparisons.
- No initial owner request is duplicated without a documented reason.
- Deferred modules retain accessible loading, empty, error, and success states.
- Market and Research median LCP move toward or below 2,500ms under the same harness.
- JavaScript and request counts do not regress by more than the harness's 10% stability allowance.
- `npm run build` and `npm run qa:performance -- --base-url <owned-production-server>` pass.

---

## 4. Shorten Start and Preserve Candidate Context

**Classification:** UX/content improvement
**Priority:** P1
**Scope risk:** Standard because the selected candidate must cross a route boundary truthfully

### Confirmed problem

The mobile Start page was about 3,405px tall. The first evidence began around 650px and the final candidate action appeared around 3,000px. General market headlines consume a large middle section even though they are explicitly not company-specific evidence.

The CTA can say `Open Discovery for PANW`, but its URL opens the generic Discovery workspace and does not preserve PANW as selected context.

### Recommended fix

- Compact the introductory stepper on mobile.
- Place the selected-candidate action immediately after candidate selection.
- Keep general market headlines as optional collapsed context rather than a required step before the action.
- Add a validated, non-mutating route handoff that highlights or focuses the selected candidate in Discovery.
- Standardize UTC versus local timestamp labels across the Start sequence.

### Acceptance criteria

- A mobile user reaches current evidence and the primary action materially earlier.
- CTA wording matches the exact destination behavior.
- Candidate context survives the route handoff without adding, saving, or mutating Research.
- Headlines remain available but are not presented as candidate evidence.
- `npm run qa:start` passes at 1280px, 768px, and 375px with exact route-state assertions.

---

## 5. Add Progressive Disclosure Inside Portfolio

**Classification:** Information-architecture improvement
**Priority:** P2
**Scope risk:** Standard to broad if attempted as one rewrite

### Confirmed problem

The Portfolio workspace combines holdings import, transaction import, reconciliation, covered attribution, factor exposure, researched-ticker editing, what-if simulation, and allocation planning. The audited desktop state contained eleven major headings and was about 2,978px tall.

The capabilities are useful, but presenting every workflow in one continuous surface increases scan cost and loads work the user may not need.

### Recommended fix

Introduce stable internal Portfolio navigation or progressive disclosure around the existing owners. Suggested groups are `Snapshot`, `Transactions`, `Reconcile`, `Attribution`, `Factors`, and `What-if`. Preserve current browser-local storage, privacy, and non-brokerage boundaries.

Do not rewrite the portfolio domain model as part of this UX change. Move one existing owner at a time and retain direct, restorable route state.

### Acceptance criteria

- The default Portfolio view leads with current state and the highest-value next action.
- Each existing workflow remains directly reachable and restorable.
- Hidden sections do not perform unnecessary work until opened where safe.
- Holdings, transaction, cash, and authored data remain browser-local and excluded from analytics and requests.
- All affected `qa:portfolio-*` scenarios and the standard verification set pass.

---

## 6. Prefer Pinned Workspaces and Attention Badges Over Another Workspace

**Classification:** Product-direction guardrail
**Priority:** Optional and evidence-gated
**Scope risk:** Minor to Standard depending on shared navigation changes

### Rationale

Research already exposes 22 workspaces across seven groups. Adding another destination would increase navigation cost. If active-use evidence shows repeated workspace searching, the next additive navigation feature should reuse existing loaded state to provide:

- up to three manually pinned workspaces;
- stable user-controlled ordering;
- restrained counts for incomplete Queue tasks, triggered or failed alerts, and overdue reviews;
- explicit unavailable states when the owning data was not checked.

### Non-goals

- No automatic reordering based on analytics.
- No new provider request or polling solely for a badge.
- No alarming badge for informational or unavailable states.
- No implementation before real usage supports the navigation problem.

### Acceptance criteria if authorized later

- Pins are validated, browser-local, reversible, and capped.
- Counts come only from already loaded owner state.
- Text and accessible names accompany color.
- The seven canonical groups and stable workspace URLs remain intact.
- Mobile and desktop navigation remain unclipped with no document overflow.

## Second-Pass Backlog

The six primary items above remain the highest-value product backlog. A broader follow-up review found no additional P0 defect, but it did identify the following accessibility, resilience, content, and quality improvements. These items should not all be treated as mandatory feature work.

### 7. Complete the Shared Accessibility Foundation

**Classification:** Confirmed accessibility gaps plus a broader audit requirement
**Priority:** P1; fold into item 2 where the same shared shell is already changing
**Scope risk:** Standard because the shell, modal behavior, motion, and multiple routes are involved

#### Confirmed gaps

- The root layout has no skip-to-content link or stable content target.
- The command palette declares an `aria-modal` dialog and restores focus when it closes, but it does not contain keyboard focus while open or make the background inert.
- Some skeletons use `motion-safe`, while other pulse animations, smooth scrolling, and transitions have no consistent reduced-motion fallback.
- The V6 interface intentionally uses dense 10–12px supporting text. This is not automatically a defect, but it warrants a route-wide contrast, zoom, legibility, and touch-target audit rather than assuming the shared-header measurements cover every control.

#### Recommended fix

Add a shared skip link and route-owned main-content target. Complete the command-palette focus contract, add a global reduced-motion policy, and run one consolidated accessibility pass over Start, Market, Research, and Portfolio. Reuse the existing visual system; do not redesign the product solely to satisfy the audit.

#### Acceptance criteria

- Keyboard users can skip repeated navigation and reach the primary route content.
- Tab and Shift+Tab remain inside the open command palette; Escape closes it and restores focus to the trigger.
- Reduced-motion preference disables non-essential pulse, smooth-scroll, transform, and transition effects without removing status feedback.
- Text remains readable at 200% zoom, focus indicators remain visible, and interactive controls meet the repository's target-size contract at 375px, 768px, and 1280px.
- An automated or deterministic Playwright accessibility smoke lane covers the shared shell and representative route content.

### 8. Add Route-Level Error Recovery and a Helpful 404

**Classification:** Confirmed resilience and UX gap
**Priority:** P1 after the two existing defects
**Scope risk:** Minor to Standard depending on whether unsaved-edit awareness is shared

#### Confirmed gap

The App Router has no route `error.tsx`, root `global-error.tsx`, or custom `not-found.tsx`. Individual components often degrade provider failures well, but an unexpected render or route failure has no composed Signal recovery surface.

#### Recommended fix

Add a minimal branded error boundary with retry and safe navigation, plus a helpful 404 linking to Start, Market, and Research. Keep error copy direct and avoid exposing stack traces, provider payloads, or private browser-local content. A recovery action must not silently discard an active research or planning draft.

#### Acceptance criteria

- A forced route failure renders a stable recovery surface with retry and safe navigation.
- Unknown routes render the custom 404 and provide a keyboard-operable way back.
- Production responses do not reveal stack traces, secrets, request payloads, or authored content.
- Recovery behavior is verified in light and dark themes and at mobile and desktop widths.

### 9. Standardize Browser-Storage Failure Handling

**Classification:** Confirmed resilience inconsistency
**Priority:** P1 because Queue and preferences are core local workflows
**Scope risk:** Standard if repaired through one existing boundary at a time

#### Confirmed gap

Portfolio holdings, transactions, dividend planning, and first-run setup convert browser-storage failures into explicit unavailable states. Other paths still write directly to `localStorage`, including Queue state and inbox preferences, so a denied or quota-exhausted write can escape as an exception instead of showing a recoverable `not saved` state.

#### Recommended fix

Normalize storage results around the existing validated client boundaries. Preserve in-memory session behavior where it is truthful, show exactly what was not saved, and never report a successful Queue, preference, or layout update unless persistence succeeded.

#### Acceptance criteria

- Every browser-local owner distinguishes `ready`, `empty`, `invalid`, and `unavailable` where applicable.
- Denied reads, denied writes, and quota failures do not crash the route.
- The UI distinguishes session-only changes from changes that will survive reload.
- Storage failure never triggers a network fallback or leaks local-only data into analytics.
- Representative Queue, inbox, layout, alerts, first-run, and Portfolio failure scenarios pass.

### 10. Standardize Time, Currency, and User-Facing Terminology

**Classification:** Content and trust improvement
**Priority:** P2
**Scope risk:** Minor if delivered as small formatter and copy slices

#### Confirmed gap

The product mixes explicitly labelled UTC dates, browser-local `toLocaleString()` timestamps, and date-only market observations. The shared Research price formatter prefixes US values with `$` but renders Malaysia values without `RM` or `MYR`. Several accurate disclosures also use implementation-oriented wording such as `bounded scan`, `owner`, `boundary`, or `projection` where shorter user language would preserve the same limitation.

#### Recommended fix

Adopt one display convention: label market observation dates as UTC or exchange dates, label operational timestamps as local time, and keep reporting periods date-only. Show currency or market context wherever a value can be ambiguous. Shorten primary copy to action, evidence, and limitation; place technical details in progressive disclosure.

#### Acceptance criteria

- Every ambiguous price shows a currency or an adjacent unambiguous market/currency label.
- UTC, exchange-date, and browser-local timestamps are visibly distinguishable.
- Copy edits do not weaken source, privacy, non-prediction, non-brokerage, or unavailable-data disclosures.
- Start, Market, Research, Portfolio, Backup, and Sources use the same terminology conventions.

### 11. Align the Root Loading Experience With V6

**Classification:** Visual and perceived-performance polish
**Priority:** P2; coordinate with item 3
**Scope risk:** Minor

#### Confirmed gap

`src/app/loading.tsx` still uses the older bright card-grid treatment and unrestricted pulse animation. It does not match the current V6 dark/light theme or the more truthful route-owned loading states, so a route transition can briefly look like a different product.

#### Recommended fix

Replace it with a small theme-compatible shell that mirrors the current header and first meaningful content shape. Include concise status text for assistive technology, respect reduced motion, and avoid rendering a large synthetic dashboard that shifts substantially when real content arrives.

#### Acceptance criteria

- Root loading matches both V6 themes and does not flash an obsolete layout.
- Skeleton geometry approximates the first meaningful route content and reduces avoidable layout shift.
- Reduced motion and screen-reader status behavior match item 7.
- Loading remains useful on Start, Market, and Research without duplicating their owner-specific states.

### 12. Decide How Legacy and Comparison Routes Ship

**Classification:** Conditional route and content hygiene
**Priority:** Optional; required only if the deployment is exposed beyond the current operator
**Scope risk:** Minor

#### Current state

Versioned aliases and backup routes are intentionally retained for comparison, existing links, and rollback reference. That is a valid development choice, but publicly addressable older experiences can confuse users, search crawlers, screenshots, support instructions, and analytics if their status is not explicit.

#### Recommended options

Choose one explicit policy per route: canonical redirect, `noindex` comparison surface, authenticated/operator-only access, or documented public compatibility alias. Do not delete rollback references until their replacement and recovery value have been reviewed.

#### Acceptance criteria if authorized

- Canonical user journeys resolve to `/start`, `/`, and `/research`.
- Every retained legacy route has an explicit audience and indexing policy.
- Old routes cannot be mistaken for the current supported experience.
- Redirects or access controls preserve any genuinely required existing links.

### 13. Add Accessibility and Performance Regression Budgets

**Classification:** Engineering quality improvement
**Priority:** P2; performance budgets belong with item 3
**Scope risk:** Minor to Standard depending on CI integration

#### Rationale

The repository has extensive deterministic QA and a repeatable performance baseline, but accessibility remains primarily contract-driven and the performance figures are not yet an enforced regression budget. A small automated gate would protect the product while the P0 and P1 improvements are implemented.

#### Recommended fix

Use the existing Playwright stack for a shared-shell accessibility smoke test and route-specific keyboard assertions. Extend the existing performance harness with reviewed LCP, JavaScript, and request-count budgets under its fixed throttle and cache conditions. Keep budgets stable and evidence-based; do not introduce a new dependency solely for a one-off score.

#### Acceptance criteria

- The shared shell, command palette, and representative Start, Market, Research, and Portfolio content have deterministic keyboard and accessibility checks.
- Performance comparison uses the same production build, viewport, throttle, run count, cache state, and stability allowance.
- CI or the release harness fails on a confirmed regression and saves a reviewable report.
- Flaky provider timing does not masquerade as an accessibility or bundle-size failure.

## Delivery Order

Implement and verify one numbered slice before starting the next:

1. Today/Alerts request contract.
2. Mobile PWA overlap and shared target sizes.
3. Initial performance, beginning with duplicate/deferred work.
4. Start flow and exact candidate handoff.
5. Portfolio progressive disclosure.
6. Pinned workspaces only after the evidence gate authorizes it.

Place the second-pass work without renumbering the original product items:

1. Fold item 7's shared-shell accessibility work into original item 2.
2. Deliver route recovery (item 8) and storage resilience (item 9) as separate focused slices after original item 2.
3. Add the performance-budget portion of item 13 while implementing original item 3.
4. Address data labels and terminology (item 10) and root loading polish (item 11) after the higher-value performance and workflow improvements.
5. Keep legacy-route policy (item 12), pinned workspaces, and broader automation conditional on deployment or usage evidence.

A general future instruction to `proceed` should authorize only item 1. Commit, push, deployment, roadmap status changes, and later numbered items remain separate actions unless explicitly authorized.

## Remaining Unknowns

- Live provider timing and content can change; revalidate runtime payloads before implementation.
- The exact LCP element and chunk ownership should be captured during performance implementation rather than inferred only from transfer totals.
- Portfolio grouping needs a focused interaction design before code moves.
- Pinned-workspace value remains a hypothesis until real use demonstrates repeated navigation friction.
