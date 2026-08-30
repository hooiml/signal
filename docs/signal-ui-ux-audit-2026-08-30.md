# Signal UI/UX Audit Tracker — 2026-08-30

Status: **Active**  
Production baseline: `main` @ `98cc46a70a5f141db08cff548600e3eb105bf45a`  
Audit scope: **Market, Research, Today — desktop + mobile**

## Purpose

This document records the UI/UX findings from the post-Phase-11 production audit and serves as the working backlog for the next enhancement cycle.

Signal is functionally healthy and the major Research capabilities are now present. The current product risk is no longer missing functionality; it is **hierarchy, composition, responsiveness, accessibility, and integration complexity**.

The next release should therefore focus on **consolidation and refinement rather than adding another large feature module**.

---

## Audit evidence

The production audit was run in real Chromium against the final production build across:

- Market — desktop
- Market — mobile
- Research — desktop
- Research — mobile
- Today — desktop
- Today — mobile

Observed runtime state:

- No browser console errors.
- No uncaught page errors.
- No persistent API 4xx/5xx failures.
- No page-level horizontal overflow.
- Research had one transient aborted `/api/research/inbox` request during component replacement; the subsequent request completed successfully.

Production screenshots and raw audit artifacts were captured separately during the audit session.

---

# Priority summary

| ID | Priority | Area | Finding | Status |
| --- | --- | --- | --- | --- |
| UX-001 | P0 | Research | Decision Memory is not rendering reliably in production | ✅ Completed |
| UX-002 | P0 | Research | Core selected-security research is buried below review tools | ✅ Completed |
| UX-003 | P0 | Architecture | Four portal-based review docks create brittle mount/order behavior | ✅ Completed |
| UX-004 | P1 | Research IA | Too many navigation layers; Today is nested too deeply | ⬜ Todo |
| UX-005 | P1 | Mobile | Review forms still behave like desktop forms | ⬜ Todo |
| UX-006 | P1 | Accessibility | DOM order, heading order, and visual order diverge | ⬜ Todo |
| UX-007 | P1 | Copy | Developer/internal architecture language is visible to users | ⬜ Todo |
| UX-008 | P1 | Today | Secondary status cards are too repetitive and vertically expensive | ⬜ Todo |
| UX-009 | P2 | Market | Market needs metadata, touch-target, and copy polish | ⬜ Todo |

---

# UX-001 — Fix Decision Memory production rendering

**Priority:** P0  
**Area:** Research / Correctness  
**Status:** ✅ Completed

## Observed evidence

Decision Memory did not appear in the production Research experience on either desktop or mobile during the live audit.

The current source mounts `ResearchMemoryDockV7` together with the Expectation, Valuation, and Decision Calibration docks. The Memory dock looks for the `since-last-visit` anchor once and exits if that anchor does not yet exist.

The later docks use a `MutationObserver` to wait until the anchor is available.

This makes Decision Memory sensitive to client-render timing and mount order.

## Smallest safe correction

Do not stop at adding a `MutationObserver`. That would fix the immediate race but preserve the fragile architecture.

Move Decision Memory into the normal Research component tree together with the other review tools.

Desired structure:

```text
ResearchDashboard
  ├─ Since last visit
  ├─ Review tools
  │    ├─ Decision memory
  │    ├─ Expectation vs Reality
  │    ├─ Valuation
  │    └─ Decision review
  └─ Selected-security workspace
```

## Acceptance criteria

- [x] `research-memory-dock` is present for a saved security on desktop.
- [x] `research-memory-dock` is present for a saved security on mobile.
- [x] Unsaved securities show an explicit unavailable state rather than nothing.
- [x] Switching ticker updates the same Decision Memory instance.
- [x] Navigating between Research workspaces does not create duplicate memory slots.
- [x] Exactly one Decision Memory surface exists in the DOM.
- [x] Browser QA covers delayed client mounting.

## Completion evidence

- Source commit: [`4a0f3e1`](https://github.com/hooiml/signal/commit/4a0f3e1ffcd7d7596cb2b4c1e402623d53cd4f48) (`fix(research): integrate decision memory rendering`).
- Final verified head: [`5c094a0`](https://github.com/hooiml/signal/commit/5c094a0ebb41d65b84996c0f09519199adde5b9b).
- GitHub Actions: [Research Memory Gate run #47](https://github.com/hooiml/signal/actions/runs/33309087019) passed source checks, typecheck, lint, Research regression, production build, Phase 8–11 browser regressions, and Phase 12 QA.
- Browser evidence: `1440×1000` and `390×844` passed delayed loading, saved and unsaved states, ticker switching, workspace navigation and Back restoration, single-instance assertions, visible keyboard focus, persistence requests, page overflow, and blocking console/page/request checks.
- Screenshots: [Phase 12 browser evidence artifact](https://github.com/hooiml/signal/actions/runs/33309087019/artifacts/9731444577).

---

# UX-002 — Restore selected security as the primary Research content

**Priority:** P0  
**Area:** Research composition  
**Status:** ✅ Completed

## Observed evidence

On desktop, the current Research page presents multiple utilities and complete review forms before the actual selected-security workspace.

Current effective flow resembles:

```text
Selected security heading
Navigation
Views & density
Since last visit
Expectation vs Reality
Valuation
Decision Review
Research Overview / Daily Attention
Position Plan
Selected security research
```

The actual company research starts too far down the page.

This is less severe on mobile because the selected security appears earlier visually, but the overall page is still very long.

## Product problem

The hierarchy is inverted: supporting review tools are more visually prominent than the security the user is researching.

## Desired composition

Desktop:

```text
Research

MSFT · Microsoft
$price · daily move
Decision: WAIT FOR PRICE
Readiness: 8 / 9
Next action: Review valuation assumptions

Overview | Fundamentals | Valuation | Events | Evidence

Review tools
  Changes
  Expectations
  Valuation assumptions
  Decision review
  Replay
```

## Acceptance criteria

- [x] Selected-security summary starts within the first 600px at 1440×1000.
- [x] No full review form is expanded by default.
- [x] Selected-security research appears before secondary review forms in DOM order.
- [x] Review tools remain easily reachable without becoming the dominant first screen.
- [x] Mobile keeps ticker context visible while the user moves into deeper tools.

## Completion evidence

- Source commit: [`b96b20f`](https://github.com/hooiml/signal/commit/b96b20fcf6a40ced39e967bc172d7090f8a4b3c7) (`fix(research): prioritize selected security content`).
- GitHub Actions: [Research Memory Gate run #53](https://github.com/hooiml/signal/actions/runs/33310848983) passed source checks, typecheck, lint, Research regression, production build, Phase 8–11 browser regressions, and Phase 12 QA.
- Browser evidence: `1440×1000` and `390×844` passed the desktop `≤600px` selected-summary threshold, selected-security-before-review-tools DOM order, no default expanded full form, mobile ticker context, page overflow, and blocking console/page/request checks.
- Screenshots: [Phase 12 browser evidence artifact](https://github.com/hooiml/signal/actions/runs/33310848983/artifacts/9731964468).

---

# UX-003 — Replace the four independent portal docks

**Priority:** P0  
**Area:** Frontend architecture / UX reliability  
**Status:** ✅ Completed

## Current architecture

`ResearchIntegratedPageV7` mounts:

```text
ResearchDashboardV7
ResearchMemoryDockV7
ResearchExpectationDockV8
ResearchValuationDockV9
ResearchDecisionCalibrationDockV10
```

Each review dock then searches the document for an anchor and inserts itself into the Dashboard DOM using a portal.

## Problems

- Mount-order races.
- Source order can differ from visual order.
- Review tools independently parse ticker state.
- Review tools independently load overlapping Research state.
- Visual hierarchy becomes harder to control.
- Every new feature increases portal-chain complexity.
- Accessibility tooling follows DOM/source order rather than intended visual order.

## Target architecture

Introduce one integrated owner:

```tsx
<ResearchReviewTools
  ticker={selectedTicker}
  record={selectedRecord}
  snapshot={selectedSnapshot}
  activeTool={activeTool}
  onToolChange={setActiveTool}
/>
```

Possible tool IDs:

```text
memory
expectations
valuation
decision-review
replay
```

Only the selected tool should be expanded or mounted when appropriate.

## Acceptance criteria

- [x] No Research review feature uses `document.querySelector` to find its mount location.
- [x] No review feature creates arbitrary DOM hosts with `createElement`.
- [x] Selected ticker is passed through shared state/props/context.
- [x] Selected Research record is not independently fetched by every review module.
- [x] Current snapshot can be shared where contracts permit.
- [x] Source order equals visual order.
- [x] Existing deep links remain valid.

## Completion evidence

- Source commit: [`32c6a6a`](https://github.com/hooiml/signal/commit/32c6a6aad3f6d037cd7911970439db27f722f65d) (`refactor(research): consolidate review tools`).
- Final verified head: [`9d05956`](https://github.com/hooiml/signal/commit/9d05956b490def7fda70c2c70bc9633ea3493690).
- GitHub Actions: [Research Memory Gate run #51](https://github.com/hooiml/signal/actions/runs/33310388963) passed source checks, typecheck, lint, Research regression, production build, Phase 8–11 browser regressions, and Phase 12 QA.
- Browser evidence: `1440×1000` and `390×844` passed single-shell and single-active-tool assertions, deterministic source/control order, inactive-tool API suppression, shared watchlist/snapshot reuse, ticker changes, visible keyboard focus, page overflow, and blocking console/page/request checks.
- Screenshots: [Phase 12 browser evidence artifact](https://github.com/hooiml/signal/actions/runs/33310388963/artifacts/9731837152).

---

# UX-004 — Make Today a first-class Research destination

**Priority:** P1  
**Area:** Information architecture  
**Status:** ⬜ Todo

## Observed problem

Research currently exposes a broad top-level taxonomy and then additional nested destinations inside Activity/Today-related workflows.

On mobile this can become multiple stacked navigation decisions before the user reaches the daily workflow.

## Proposed top-level IA

```text
Watchlist | Today | Analyze | Portfolio | Review | More
```

Suggested grouping:

### Watchlist

- Saved securities
- Selected-security research

### Today

- Daily attention
- Queue
- Alerts
- Calendar/events
- Changes

### Analyze

- Discovery
- Compare
- Peers
- Filings
- Evidence

### Portfolio

- Position planning
- Portfolio risk
- Currency

### Review

- Decision Memory
- Expectation history
- Valuation assumptions
- Decision calibration
- Replay
- Outcomes

### More

- Sources
- Policy
- Backup
- Export
- Usage

## Acceptance criteria

- [ ] Today is reachable in one action from every Research screen.
- [ ] Mobile does not require selecting both Activity and Today.
- [ ] Top-level navigation has no more than six visible destinations.
- [ ] Secondary workspaces remain discoverable through More and command search.
- [ ] Selected ticker survives navigation where relevant.
- [ ] Browser back/forward restores workspace state.

---

# UX-005 — Redesign review forms for mobile

**Priority:** P1  
**Area:** Mobile  
**Status:** ⬜ Todo

## Observed problem

Some workflows are technically contained on mobile but still use desktop-first layouts.

The clearest example is Expectation vs Reality, where the metrics editor relies on a horizontally scrollable table wider than the viewport.

Horizontal containment prevents page overflow, but it is not an ideal core interaction.

## Proposed mobile pattern

Desktop may keep:

```text
Metric | Expected | Actual | Outcome
```

Mobile should switch to cards:

```text
Revenue
Expected    [ input ]
Actual      [ input ]
Outcome     Pending

EPS
Expected    [ input ]
Actual      [ input ]
Outcome     Pending
```

## Additional mobile corrections

- Increase important controls to ~44px minimum height.
- Avoid important 10–11px actionable labels.
- Keep forms single-column unless the relationship is genuinely clearer side-by-side.
- Keep tool headers sticky/compact where long scrolling is unavoidable.

## Acceptance criteria

- [ ] No core Research workflow requires horizontal scrolling at 390px.
- [ ] Core controls meet a 44px minimum touch target where practical.
- [ ] No actionable label is rendered at 10px.
- [ ] 360px, 390px, and 430px browser tests show no clipping.
- [ ] Focus indicators remain visible on all inputs and buttons.

---

# UX-006 — Align DOM order, visual order, and heading hierarchy

**Priority:** P1  
**Area:** Accessibility  
**Status:** ⬜ Todo

## Observed problem

Some review surfaces are inserted through portals while CSS determines a different visual ordering.

This means visual order can differ from:

- Screen-reader navigation.
- Keyboard navigation.
- Heading navigation.
- Browser find order.
- Accessibility inspection tools.

There are also screens where more than one page-level heading is exposed.

## Required rules

```text
One page = one H1
Primary section = H2
Subsection = H3
Visual order = DOM order
```

## Acceptance criteria

- [ ] Exactly one visible/semantic `h1` exists per screen state.
- [ ] Today does not expose duplicate `h1` headings.
- [ ] Research utilities appear in the same DOM order users see them.
- [ ] Heading levels are not chosen only for font size.
- [ ] Keyboard tab order follows visual progression.

---

# UX-007 — Remove developer-facing architecture copy

**Priority:** P1  
**Area:** Product copy  
**Status:** ⬜ Todo

## Examples observed

User-facing pages currently include wording similar to:

- “Workspace-specific controls remain with the data they change.”
- “This workspace retains its existing identifier, deep link, data owner, and mutation boundary.”
- “Today reuses validated workflow state.”
- “Live Research V7 · Existing review, evidence, persistence, queue, portfolio, backup, notification, and URL-state contracts.”

These describe implementation architecture rather than helping the investor make a decision.

## Replacement direction

Prefer product-facing copy.

Example Today header:

```text
Today
3 items need attention across your research.
```

Example safety copy:

```text
Signal never changes your saved research automatically.
```

Example Research footer:

```text
Data sources · Methodology · Limitations
```

## Acceptance criteria

- [ ] Production UI contains no unnecessary “Live V7” copy.
- [ ] Production UI avoids “mutation boundary”.
- [ ] Production UI avoids “data owner”.
- [ ] Production UI avoids architecture “contract” language unless inside technical documentation.
- [ ] Copy explains user benefit, uncertainty, provenance, or next action.

---

# UX-008 — Tighten Today secondary status information

**Priority:** P1  
**Area:** Today  
**Status:** ⬜ Todo

## What should be preserved

- Top priority actions.
- Clear ownership of each action.
- No automatic mutation.
- Immediate vs upcoming distinction.
- Checkpoint concept.
- Source-health and policy warnings alongside ticker issues.

## Current weakness

The lower set of status cards creates repetitive vertical space, especially on mobile.

Examples:

```text
Overdue reviews
Near-term events
Triggered alerts
Incomplete Queue
Degraded sources
```

## Proposed compact pattern

```text
Research health

Reviews       8 overdue     Open
Events        0 upcoming
Alerts        2 active      Open
Queue         0 incomplete
Sources       1 degraded    Open
```

Keep top-priority work as cards; make secondary health/status information compact.

## Acceptance criteria

- [ ] Top three attention actions remain visually prominent.
- [ ] Secondary status consumes materially less vertical space on mobile.
- [ ] Each status row can link directly to its owning workspace.
- [ ] Zero states are quiet rather than equal-weight cards.

---

# UX-009 — Market polish pass

**Priority:** P2  
**Area:** Market  
**Status:** ⬜ Todo

## What should be preserved

Market is currently the strongest major Signal surface.

Keep:

- “Conditions are mixed” hierarchy.
- Composite score.
- Signal alignment.
- Score-history exploration.
- Strongest support/conflict framing.
- Data freshness and provenance.
- Market → Research handoff.
- Advanced evidence collapsed by default.
- Clear separation between evidence and forecast.

## Remaining polish

### Remove duplicate availability state

Do not show “Conditions available” multiple times in the same initial viewport.

### Compress mobile metadata

Prefer:

```text
30 Aug · Retrieved 10:04 UTC · All 3 inputs available
```

instead of multiple availability/date/retrieval lines.

### Increase mobile touch targets

Review:

- US / MY region controls.
- Momentum / Contrarian controls.
- Refresh control.

### Remove internal footer language

Do not expose “Live Market V7” or architecture-contract wording to end users.

### Copy correction

Change grammatically incorrect copy such as:

```text
VIX Index do not confirm...
```

to:

```text
The VIX Index does not confirm the majority reading...
```

## Acceptance criteria

- [ ] Availability state appears once in the primary Market header area.
- [ ] Mobile freshness metadata fits within one compact line/group.
- [ ] Main mobile controls meet touch-target requirements.
- [ ] No internal V7 architecture footer is shown.
- [ ] Market screenshots remain visually focused after polish.

---

# Proposed Phase 12 — Research consolidation & accessibility

Do not treat Phase 12 as another large product feature.

The goal is to make the existing system clearer, faster to understand, more reliable, and easier to use.

## Phase 12A — Correctness

- [ ] Fix Decision Memory rendering.
- [ ] Remove one-shot anchor race.
- [ ] Add deterministic integration/browser regression tests.
- [ ] Share selected Research state where appropriate.

## Phase 12B — Composition

- [ ] Put selected security first on desktop.
- [ ] Consolidate review tools into one shell.
- [ ] Only one review tool expanded at a time.
- [ ] Lazy-load inactive review tools where practical.
- [ ] Promote Today to first-class navigation.
- [ ] Move Views & density into secondary controls when unused.

## Phase 12C — Mobile & accessibility

- [ ] Replace mobile metrics table with cards.
- [ ] Ensure one `h1` per screen.
- [ ] Match DOM and visual order.
- [ ] Improve touch targets.
- [ ] Increase undersized actionable typography.
- [ ] Preserve ticker context during long mobile workflows.

## Phase 12D — Copy polish

- [ ] Remove implementation terminology from user-facing UI.
- [ ] Remove V7/contract footers.
- [ ] Simplify Market metadata.
- [ ] Tighten Today status language.
- [ ] Fix grammar and consistency issues.

---

# Recommended implementation order

```text
1. UX-001 Decision Memory correctness
        ↓
2. UX-003 Review-tool architecture consolidation
        ↓
3. UX-002 Selected-security hierarchy
        ↓
4. UX-004 Today navigation simplification
        ↓
5. UX-005 + UX-006 Mobile/accessibility pass
        ↓
6. UX-007 + UX-008 Copy/Today density polish
        ↓
7. UX-009 Market polish
```

Rationale: fixing the mount architecture first avoids polishing layouts that would later be structurally rewritten.

---

# Definition of done for Phase 12

Phase 12 should not be considered complete until all of the following pass:

### Functional

- [ ] Existing Research save/edit flows still work.
- [ ] Decision Memory works across ticker changes and navigation.
- [ ] Expectation vs Reality still persists correctly.
- [ ] Valuation assumptions still persist correctly.
- [ ] Decision Review/Calibration still persists correctly.
- [ ] Daily attention still ranks and routes correctly.

### Desktop UX

- [ ] Selected security is visible in the first viewport.
- [ ] Review tools no longer dominate the page.
- [ ] No duplicate review surfaces.
- [ ] No new horizontal overflow.

### Mobile UX

- [ ] No core workflow requires horizontal scrolling.
- [ ] Touch targets are acceptable.
- [ ] Selected ticker context is maintained.
- [ ] Long forms use progressive disclosure.

### Accessibility

- [ ] One `h1` per screen.
- [ ] DOM order matches visual order.
- [ ] Keyboard navigation follows expected sequence.
- [ ] Visible focus states remain intact.

### Runtime

- [ ] TypeScript passes.
- [ ] Lint passes.
- [ ] Research regression suite passes.
- [ ] Production build passes.
- [ ] Desktop Playwright passes.
- [ ] Mobile Playwright passes.
- [ ] No browser console errors.
- [ ] No uncaught page errors.
- [ ] Vercel preview is READY before merge.
- [ ] Production `/research` is verified after merge.

---

# Current product assessment

| Surface | Assessment | Direction |
| --- | --- | --- |
| Market | Strong and focused | Polish only |
| Today | Useful attention workflow | Simplify IA and secondary density |
| Research desktop | Powerful but over-composed | Major consolidation |
| Research mobile | Better hierarchy but excessively long | One-tool-at-a-time UX |
| Accessibility | Good foundation | Heading/order/touch-target pass |
| Review architecture | Feature-rich but brittle | Replace portal chain |

---

# Guiding principle

Signal should not become a collection of increasingly large cards and forms.

The next UX iteration should make the product feel like one connected decision workflow:

```text
What needs my attention?
        ↓
What changed?
        ↓
What do I believe?
        ↓
What is the market pricing?
        ↓
What would change my decision?
        ↓
What should I review next?
```

Every UI change in this backlog should be evaluated against that flow.
