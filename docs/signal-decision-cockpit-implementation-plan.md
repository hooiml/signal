# Signal Decision Cockpit Implementation Plan

## Goal

Implement the approved decision-cockpit redesign for the main Signal dashboard without changing scoring semantics.

Source design documents:

- `docs/signal-decision-cockpit-design-brief.md`
- `docs/signal-decision-cockpit-screen-spec.md`

The implementation should reshape the current `v2` UI into the new cockpit flow while preserving:

- market / mode / source behavior
- `MarketSignal` as the UI contract
- confidence semantics as indicator agreement
- article feed as context rather than weighted evidence

## Implementation Strategy

Use a staged refactor, not a full rewrite.

Principles:

- keep the API and scoring logic stable unless a specific UI requirement cannot be met
- reuse existing data and component logic where possible
- replace layout first, then merge modules, then tighten mobile and state handling
- verify desktop and mobile behavior after each major stage

## Target Deliverable

The dashboard should render in this order:

1. compact control bar
2. hero decision panel
3. trust and what-changed band
4. evidence matrix
5. analyst note
6. latest developments
7. supporting context

## Scope

### In Scope

- `src/components/v2/SignalDashboard.tsx` layout rewrite
- refactor `DashboardHeader` into a compact control bar
- replace current summary-card row with a hero decision panel
- split current quality data across hero, trust band, what-changed, and supporting context
- merge indicator cards and agreement module into an evidence matrix
- reposition and simplify the analyst note
- retag article feed into `Supports`, `Opposes`, `Context`
- move lower-priority context into a final supporting-context section
- align loading, empty, stale, and error states to the new cockpit structure
- responsive desktop/mobile layout updates

### Out Of Scope

- scoring formula changes
- API route redesign
- new backend persistence behavior
- adding a new test framework
- broad brand redesign outside the main dashboard route

## Current Component Mapping

### Keep And Refactor

- `src/components/v2/DashboardHeader.tsx`
  - convert to compact top control bar
- `src/components/v2/SignalGauge.tsx`
  - keep only if it remains visually secondary and adds threshold/previous-score context
- `src/components/v2/SignalQualityPanel.tsx`
  - mine existing trust/context data, then split or replace
- `src/components/v2/AnalysisCard.tsx`
  - reduce to one concise analyst-note surface
- `src/components/v2/ArticleList.tsx`
  - keep list behavior, change tagging and presentation semantics
- `src/components/v2/StockIndicator.tsx`
  - move into supporting-context role unless later proven to be weighted evidence

### Merge Or Replace

- top summary cards in `src/components/v2/SignalDashboard.tsx`
  - replace with `HeroDecisionPanel`
- `src/components/v2/IndicatorList.tsx`
  - replace with or refactor into `EvidenceMatrix`
- `src/components/v2/IndicatorAgreement.tsx`
  - merge into evidence-matrix header summary
- `src/components/v2/StrategyPresets.tsx`
  - remove from the main flow or demote behind a compact control affordance

## Recommended File Plan

Use this file shape unless implementation reveals a better small-diff alternative.

### Existing files to edit

- `src/components/v2/SignalDashboard.tsx`
- `src/components/v2/DashboardHeader.tsx`
- `src/components/v2/SignalGauge.tsx`
- `src/components/v2/SignalQualityPanel.tsx`
- `src/components/v2/AnalysisCard.tsx`
- `src/components/v2/ArticleList.tsx`
- `src/components/v2/IndicatorList.tsx`
- `src/components/v2/IndicatorAgreement.tsx`
- `src/app/globals.css`
- `src/lib/types/signal-v2.ts` only if a real UI blocker requires typed additions

### Likely new files

- `src/components/v2/HeroDecisionPanel.tsx`
- `src/components/v2/TrustChangeBand.tsx`
- `src/components/v2/WhatChangedPanel.tsx` if split out from trust
- `src/components/v2/EvidenceMatrix.tsx`
- `src/components/v2/SupportingContext.tsx`

Do not create extra abstraction layers unless they reduce complexity in `SignalDashboard.tsx`.

## Phase Plan

## Phase 1: Layout Shell

### Objective

Replace the current top-level page composition with the cockpit order while reusing as much existing data and text as possible.

### Tasks

- rewrite `SignalDashboard.tsx` layout tree
- remove the four equal summary cards
- remove full-width alert banners from the primary flow
- place sections in final order:
  - control bar
  - hero
  - trust/change
  - evidence
  - analyst note
  - latest developments
  - supporting context
- keep current fetch/loading/error state wired through the new shell

### Verification

- page still loads
- toggles still fetch new signals
- no runtime errors
- first viewport hierarchy matches the spec on desktop and mobile

## Phase 2: Control Bar And Hero

### Objective

Make the first decision moment correct and compact.

### Tasks

- refactor `DashboardHeader.tsx` into compact controls only
- create `HeroDecisionPanel.tsx`
- map hero content from:
  - `signal.tier`
  - `signal.composite_score`
  - `signal.confidence`
  - `metadata.signal_quality`
  - `metadata.score_delta`
  - top `metadata.score_drivers`
- move primary caveat handling into the hero with the required priority:
  1. stale data
  2. limited coverage
  3. capped/reduced confidence
  4. source-disabled note
- keep any gauge visually subordinate; replace it with a score rail if needed

### Verification

- hero shows tier, score, delta, confidence, quality, timestamp, driver
- confidence is described as agreement, not probability
- only one primary caveat shows at a time
- no duplicated title block remains

## Phase 3: Trust And What Changed

### Objective

Separate trust explanation from movement explanation.

### Tasks

- create `TrustChangeBand.tsx` or separate trust/what-changed components
- move quality explanation out of the old full-width quality panel
- render:
  - trust module
    - confidence meaning
    - freshness detail
    - coverage detail
    - caveat explanation
  - what-changed module
    - previous/current score
    - delta
    - previous snapshot date
    - current snapshot date
    - driver shifts when available
    - regime note when available
    - source-toggle impact when available
- implement fallback rules for missing previous snapshot or missing driver-delta attribution

### Verification

- hero and trust/change modules do not repeat the same explanatory sentence
- missing previous snapshot renders a valid fallback
- source-toggle impact only shows when data exists

## Phase 4: Evidence Matrix

### Objective

Replace card-grid evidence with a single auditable comparison surface.

### Tasks

- create `EvidenceMatrix.tsx`
- merge `IndicatorList` and `IndicatorAgreement` logic
- implement evidence summary header:
  - majority signal
  - agreement percentage
  - challenging indicator count
  - primary disagreement area
- implement collapsed desktop row contract:
  - indicator name
  - mode-aware signal
  - support state
  - normalized score
  - weight or contribution
  - freshness
- implement collapsed mobile row contract:
  - indicator name
  - mode-aware signal
  - support state
  - normalized score
  - weight
  - freshness
- implement row expansion payload:
  1. raw value and interpretation hint
  2. contribution detail
  3. mode note
  4. source breakdown
  5. stale/caveat detail
- implement support-state tagging based on mode-aware indicator signal versus current composite tier

### Verification

- no separate agreement card remains
- rows are interpretable without expansion
- mobile rows are readable without horizontal scrolling
- disabled indicators only surface when useful for explaining redistributed weights

## Phase 5: Analyst Note, Latest Developments, Supporting Context

### Objective

Finish the lower-priority sections without diluting the decision flow.

### Tasks

- simplify `AnalysisCard.tsx` to one paragraph only
- move fact-grid-style detail out of the analyst note
- refactor `ArticleList.tsx` into `LatestDevelopments`
- retag article items:
  - `Supports`
  - `Opposes`
  - `Context`
- default to `Context` when direction cannot be inferred safely
- build `SupportingContext.tsx` from:
  - index trend
  - trend context
  - AAII cadence
  - feed-role note
  - engine/footer details
  - optional stock/index movers as context only

### Verification

- article feed does not look like weighted evidence
- analyst note remains concise
- supporting context stays visually subordinate

## Phase 6: Loading, Empty, Error, And Responsive Polish

### Objective

Match the state behavior in the approved spec and remove regressions.

### Tasks

- replace spinner-only first load with cockpit skeletons
- preserve previous layout on refetch with `Updating...` timestamp treatment
- add empty-state handling for:
  - no signal data
  - no previous snapshot
  - no recent developments
  - no active indicators
- add stale-state labeling for recoverable fetch errors
- ensure desktop/mobile spacing, density, and section order match the spec

### Verification

- no text overlap or clipped controls on mobile
- desktop first viewport answers signal/trust/change clearly
- stale data is never presented as current

## Data And Contract Review

### Existing typed fields likely sufficient

- `signal.tier`
- `signal.composite_score`
- `signal.confidence`
- `metadata.signal_quality`
- `metadata.score_delta`
- `metadata.score_drivers`
- `metadata.counterfactuals.source_toggle`
- `metadata.articles`
- `metadata.index_trend`
- `metadata.trend_context`
- `metadata.interpretation_context`

### Possible contract gaps

Only extend `src/lib/types/signal-v2.ts` and the API if one of these becomes a real blocker:

- explicit article-direction mapping for `Supports/Opposes/Context`
- explicit driver-delta data for true positive/negative movement attribution
- richer stale/quality priority metadata from the server

Do not add fields preemptively.

## Risk Points

### Highest risk

- overpacking the hero with too much repeated trust content
- evidence matrix becoming too dense on mobile
- article retagging producing misleading semantics when direction is ambiguous
- preserving current behavior while moving many sections at once

### Mitigations

- use the ownership rules in `docs/signal-decision-cockpit-screen-spec.md`
- ship layout phases in the recommended order instead of parallel ad hoc edits
- default ambiguous feed items to `Context`
- keep logic in data/services, not in UI

## Verification Checklist

Use `docs/TESTING.md` as the baseline.

### Required commands

```powershell
npm run lint
npm run typecheck
npm run harness
```

### Build check

```powershell
npm run build
```

### Browser checks

Run `npm run dev`, then verify:

- dashboard loads without runtime console errors
- market toggle changes the request and re-renders the cockpit
- mode toggle changes interpretation without breaking layout
- social toggle updates trust/change and evidence handling
- desktop layout matches cockpit order
- mobile layout has no horizontal scroll or overlapping text
- stale/loading/error states render in the new structure

### API smoke checks

```powershell
Invoke-RestMethod "http://localhost:3000/api/signals/v2?market=US&mode=standard&enableSocial=true"
Invoke-RestMethod "http://localhost:3000/api/signals/v2?market=MY&mode=contrarian&enableSocial=false"
```

## Recommended Execution Order

Implement in this sequence:

1. `SignalDashboard.tsx` shell rewrite
2. `DashboardHeader.tsx` compact control bar
3. new `HeroDecisionPanel`
4. trust/change module
5. evidence matrix
6. analyst note simplification
7. latest developments retagging
8. supporting context extraction
9. loading/empty/error polish
10. final responsive pass

Do not start with styling alone. Get the information architecture and ownership boundaries correct first.

## Definition Of Done

The cockpit implementation is complete when:

1. the page renders in the approved cockpit order
2. the first viewport answers signal, trust, and change clearly
3. evidence and agreement exist in one connected module
4. context feed is clearly separated from weighted evidence
5. mobile is a linear briefing with no layout breakage
6. verification commands pass
7. browser checks confirm toggle behavior and state handling

## Immediate Next Step

Use this plan to start implementation work. Begin with the layout shell and hero modules before touching lower-priority context sections.
