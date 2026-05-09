# Signal Decision Cockpit Screen Spec

## Purpose

This document turns the high-level brief in `docs/signal-decision-cockpit-design-brief.md` into a concrete product design spec for the next Signal dashboard design pass.

This is the target screen design for the main Signal dashboard. It does not change scoring rules. It changes how the existing signal, confidence, quality, and evidence are presented so the product behaves like a decision cockpit instead of a generic analytics dashboard.

## Product Promise

The screen must behave like a market briefing:

1. State the current stance immediately.
2. Explain whether the stance is trustworthy.
3. Show what changed from the previous snapshot.
4. Show which evidence supports or challenges the stance.
5. Show the most relevant recent context without confusing it with weighted signal evidence.

## Core UX Model

The cockpit has one dominant path:

1. Decision
2. Trust
3. Change
4. Evidence
5. Context

Every section must support that path. If a module repeats information already visible in a higher-priority section, remove it or collapse it.

## Screen Architecture

### Desktop Layout

Use a seven-part screen in this exact order:

1. Control bar
2. Hero decision panel
3. Trust and change band
4. Evidence matrix
5. Analyst note
6. Latest developments
7. Supporting context

Desktop should feel like a compact briefing board. The first viewport should include items 1 through 3 in full and the top of item 4.

Canonical desktop composition rule:

- `Latest Developments` is the last primary content module.
- `Supporting Context` is section 7 and sits directly below Latest Developments as a compact footer band spanning the content width.
- Supporting Context is not a side panel beside the hero or evidence matrix.

### Mobile Layout

Use a linear briefing order:

1. Compact controls
2. Hero decision panel
3. Trust band
4. What changed
5. Evidence rows
6. Analyst note
7. Latest developments
8. Supporting context

Mobile must not preserve desktop column logic. It should read like a guided note from top to bottom.

## Section Specifications

### 1. Control Bar

### Role

Provide configuration without competing with the signal.

### Content

- Market switcher: `US`, `MY`
- Mode switcher: `Momentum`, `Contrarian`
- Source toggle: `Social on/off`
- Last updated time
- Refresh status if available

### Behavior

- Controls stay visible at the top.
- On mobile, controls may collapse into a compact filter row or slide-down tray.
- Changing market, mode, or source must preserve a clear loading state.
- Source toggle needs a short inline impact hint when data exists:
  - Example: `Without social: 74 (-6)`

### Design Rules

- Keep this visually quiet.
- Use low-height controls with clear active states.
- Do not place product marketing or a large dashboard title here once the app is loaded.

### 2. Hero Decision Panel

### Role

This is the decision moment. It owns the page.

### Required Content

- Primary signal tier
  - Example: `Strong Buy`, `Neutral`, `Sell`
- Composite score
  - Large numeric presentation
  - Keep `0-100` visible
- Previous score and delta
  - Example: `Prev 68`, `+12`
- Confidence
  - Label plus agreement percentage
  - Example: `High confidence`, `72% agreement`
- Data quality summary
  - Freshness
  - Coverage
  - Warning count if any
- Timestamp
  - Last successful snapshot time
- One-line driver summary
  - Example: `Shift driven by stronger breadth and improving earnings revisions.`

### Optional Content

- Compact radial or arc gauge only if it adds information beyond the score.
- If used, the gauge must show threshold zones and previous score position.
- If it becomes decorative, replace it with a delta or mini-trend module.
- Keep any gauge or rail visibly secondary to tier and score.

### Copy Rules

- The tier is the main statement.
- The explanatory line under it must explain why the current stance exists.
- Avoid long prose here.
- Avoid introducing terms not defined elsewhere.

### Design Rules

- This panel has the strongest typographic hierarchy and contrast on the page.
- Score must be secondary to the tier, not the other way around.
- Confidence and data quality should be visible without opening anything.
- Alerts about limited coverage or stale data belong inside this panel as part of the trust story, not as detached banners.
- Only one primary caveat appears in the hero at a time.

### 3. Trust And Change Band

### Role

Answer two questions immediately after the hero:

1. Can I trust this read?
2. What changed since the previous snapshot?

### Structure

Use two adjacent modules on desktop and stacked modules on mobile:

1. Trust module
2. What changed module

### Trust Module Content

- Confidence definition
  - Confidence means indicator agreement, not forecast accuracy
- Coverage status
- Freshness status
- Important caveat if present
  - Example: `Confidence capped due to limited source coverage`

### What Changed Module Content

- Previous score and current score
- Delta
- Previous snapshot date
- Current snapshot date
- Top positive driver shift
- Top negative driver shift
- Regime change note if available
- Source-toggle impact if materially relevant

### Fallback Rules

- If no previous snapshot exists, show `No previous snapshot available yet`.
- If previous score exists but no reliable driver-delta attribution exists, show the current top positive and negative drivers without implying they changed from the prior snapshot.
- If regime change cannot be determined, omit the regime-change row rather than inferring it.
- If source-toggle comparison is unavailable, omit that row rather than showing a placeholder claim.
- If only the score delta exists, the section still renders with score movement first and evidence-change detail second.

### Design Rules

- The trust module should feel stable and explanatory.
- The change module should feel dynamic and comparative.
- Use plain language, not analyst jargon.

### Content Ownership Matrix

Use these ownership boundaries to avoid duplication:

- `Hero`
  - tier
  - score
  - delta summary only
  - confidence label only
  - compact quality summary only
  - timestamp
  - one-line driver
- `Trust`
  - confidence meaning
  - freshness detail
  - coverage detail
  - caveat explanation
- `What changed`
  - previous snapshot details
  - driver shifts
  - regime note
  - source-toggle impact

Do not repeat the same explanatory sentence in more than one of these areas.

### Primary Caveat Priority

When multiple trust issues exist, surface only one primary caveat in the hero using this order:

1. Stale data
2. Limited coverage
3. Confidence capped or reduced
4. Source disabled or source-toggle note

Secondary caveats can appear in the Trust module or row-level evidence notes.

### 4. Evidence Matrix

### Role

Show the evidence that built the signal in one unified comparison surface.

### Replace

This section replaces the current separation between:

- indicator cards
- agreement overview
- disconnected conflict summary

### Required Row Fields

- Indicator name
- Raw value
- Normalized score
- Mode-aware signal
- Weight or contribution
- Freshness
- Support state
- Disabled state when useful for explaining redistributed weights

### Default Sort Order

Use this default row order:

1. Active indicators sorted by absolute contribution descending
2. Challenging indicators before supporting indicators when contribution is equal
3. Disabled indicators last

### Collapsed Row Contract

Desktop collapsed row must always show:

- indicator name
- mode-aware signal
- support state
- normalized score
- weight or contribution
- freshness

Mobile collapsed row must always show:

- indicator name
- mode-aware signal
- support state
- normalized score
- weight
- freshness

Raw value may appear on mobile only if it fits without creating a visually noisy row.

### Support State Labels

- `Supports signal`
- `Challenges signal`
- `Neutral / mixed`

### Support State Logic

Use this rule for support-state tagging:

- Compare each active indicator's mode-aware `signal` against the current composite `tier`.
- If the indicator signal points in the same directional bucket as the composite tier, label it `Supports signal`.
- If the indicator signal points in the opposing directional bucket, label it `Challenges signal`.
- If the indicator signal is `neutral`, or the composite tier is `neutral`, label it `Neutral / mixed` unless a clearer opposing relationship is explicitly available.
- Disabled indicators are not tagged as support or challenge; show them as `Disabled` only when needed to explain redistributed weights.
- Stale indicators keep their support-state label but also surface a stale caveat at the row level.

### Agreement Summary

Place a compact evidence summary above the matrix:

- Majority signal
- Agreement percentage
- Count of challenging indicators
- Primary disagreement area if any

### Row Expansion

Rows may expand for:

- mode note
- raw-source detail
- reason for challenge
- source breakdown
- stale or caveat note

Collapsed rows still must show enough to compare indicators quickly.

Expansion payload priority:

1. Raw value and interpretation hint
2. Contribution detail
3. Mode note
4. Source breakdown
5. Stale or caveat detail

### Design Rules

- Use a matrix or structured list, not equal card tiles.
- Optimize for comparison speed.
- Conflicts should be visible in the same visual system as supporting evidence.
- Freshness must be visible at the row level.
- Avoid over-encoding meaning with color alone.
- The row must be interpretable without expansion.

### 5. Analyst Note

### Role

Summarize the read after the user has seen the evidence structure.

### Content Formula

The note should contain four parts in one concise paragraph:

1. Current read
2. Strongest supporting evidence
3. Main disagreement or limitation
4. How to interpret confidence

### Example Shape

`Momentum remains constructive, led by breadth and improving revisions. Social sentiment still challenges the read, so confidence reflects broad agreement rather than forecast certainty.`

### Design Rules

- Keep it short.
- One paragraph only.
- No decorative quote styling.
- Position it after the evidence matrix, not above the hero.
- Do not use financial-advice phrasing such as `you should buy` or `you should sell`.

### 6. Latest Developments

### Role

Provide recent context without pretending every article is a weighted model input.

### Required Card Fields

- Headline
- Source
- Time
- Context tag

### Context Tags

- `Supports`
- `Opposes`
- `Context`

### Behavior

- Open external links in a new tab.
- Preserve source and time in both collapsed and expanded states.
- Keep the list short in the main view.
- Allow a `View all context` action if needed later.
- If article direction cannot be mapped safely, default to `Context`.

### Design Rules

- This section should feel tied to the signal thesis.
- Avoid a generic news-feed look.
- The tag system should visually distinguish evidence-aligned context from general background information.

### 7. Supporting Context

### Role

Hold lower-priority but still useful signal interpretation context.

### Content

- Index breadth / trend
- Historical note or trend context
- AAII cadence note when relevant
- Stock or index movers only if presented as context rather than weighted evidence
- Engine/version details

### Design Rules

- Keep it compact.
- This section should never outrank the hero, trust band, or evidence matrix.

## Content Rules

### Terminology Rules

- `Confidence` means agreement between active indicators.
- `Data quality` means freshness, coverage, and noise/readiness signals.
- `Context` means supporting narrative or market developments, not weighted inputs.
- `Mode` changes interpretation, not raw score generation.

### Copy Rules

- Avoid vague finance language like `outlook remains constructive` unless tied to specific evidence.
- Prefer direct constructions:
  - `Breadth improved`
  - `Coverage is limited`
  - `Social sentiment challenges the signal`
- Keep helpers and tooltips short and literal.

### Redundancy Rules

- Do not repeat the same statement in hero, trust band, and analyst note.
- If a concept cannot justify its own section, fold it into a higher-priority area.

### Preset Rules

- `Strategy presets` are not part of the primary decision flow.
- If presets remain in the product, move them behind a compact control-bar affordance such as `Presets`.
- Do not keep presets as a full-width module between hero and evidence.

## Visual System Guidance

### Tone

- Premium
- Dense
- Calm
- Serious
- Scan-friendly

### Color Semantics

- Green: support / bullish / positive shift
- Red: challenge / bearish / negative shift
- Slate or blue: neutral / informational / context
- Amber: warning / limited quality / stale or capped state

### Typography

- High-contrast display style for tier and score
- Compact operational text for labels and tables
- Reduce dependency on micro uppercase labels

### Surfaces

- Prefer broad structured panels over many equal cards
- Keep radii controlled
- Avoid deep nested card stacks
- Avoid decorative glow as the main premium signal

### Motion

- Use motion only for:
  - loading
  - score transitions
  - row expansion
  - minor control feedback
- Avoid ornamental motion on hover-heavy desktop cards

## State Design

### Loading State

- Preserve the control bar
- Show hero skeleton first
- Show trust/change placeholders second
- Show evidence matrix skeleton rows after that
- Do not swap the entire screen for a spinner
- During refetch, keep the previous layout visible and mark the timestamp area as `Updating...`

### Empty State

Use only when signal data cannot be rendered meaningfully.

Required content:

- plain-language issue summary
- retained controls
- retry action if supported
- stale-state note if last good signal exists

Specific empty cases:

- `No previous snapshot yet`
- `No recent developments`
- `No active indicators`

### Error State

- Keep layout structure intact
- If a previous good snapshot exists, label it clearly as stale
- Put error messaging near the hero/trust area, not at the footer

## Accessibility Rules

- Never rely on color alone for support/challenge state
- Keep all tags text-labeled
- Preserve readable contrast in dark surfaces
- Avoid tiny metadata text on mobile
- Ensure tables degrade into readable stacked rows on small screens

## Mapping To Current V2 Components

### Keep And Refactor

- `src/components/v2/DashboardHeader.tsx`
  - Refactor into compact control bar
- `src/components/v2/SignalGauge.tsx`
  - Keep only if it adds threshold and previous-score context
- `src/components/v2/SignalQualityPanel.tsx`
  - Split its content across hero trust data, trust band, and supporting context
- `src/components/v2/AnalysisCard.tsx`
  - Simplify and move after evidence
- `src/components/v2/ArticleList.tsx`
  - Retag content as Supports/Opposes/Context
- `src/components/v2/StockIndicator.tsx`
  - Move into supporting context unless scoring semantics change

### Replace Or Merge

- Top summary card row in `src/components/v2/SignalDashboard.tsx`
  - Replace with hero decision panel
- `src/components/v2/IndicatorList.tsx`
  - Merge into unified evidence matrix
- `src/components/v2/IndicatorAgreement.tsx`
  - Merge into evidence summary inside the matrix section
- `src/components/v2/StrategyPresets.tsx`
  - Remove from the main flow or move behind a compact preset control

### Preserve Data Semantics

- Keep `MarketSignal` as the source of truth
- Do not move scoring logic into UI components
- Preserve `confidence` semantics from `docs/signal-scoring.md`
- Preserve score delta, source toggle, and quality warnings as typed data concepts

## Data Field Mapping

| Cockpit element | Existing data |
|---|---|
| Tier | `signal.tier` |
| Composite score | `signal.composite_score` |
| Mode | `signal.mode` or current config |
| Market | `metadata.market` or current config |
| Confidence level | `signal.confidence.level` |
| Agreement percent | `signal.confidence.agreement_pct` |
| Majority signal | `signal.confidence.majority_signal` |
| Conflicts | `signal.confidence.conflicting_indicators` |
| Coverage | `metadata.signal_quality.source_coverage` |
| Freshness | `metadata.signal_quality.freshness` |
| Warnings | `metadata.signal_quality.warnings` |
| Previous score | `metadata.score_delta.previous_score` |
| Delta | `metadata.score_delta.delta` |
| Snapshot date | `metadata.score_delta.snapshot_date` |
| Source impact | `metadata.counterfactuals.source_toggle` |
| Evidence rows | `signal.components` |
| Contributions and drivers | `metadata.score_drivers` |
| Articles | `metadata.articles` |
| Index context | `metadata.index_trend` |
| Historical context | `metadata.trend_context` |
| AAII note | `metadata.interpretation_context.aaii_note` |
| Feed-role note | `metadata.interpretation_context.article_feed_role` |

## Acceptance Criteria For Design Completion

The design phase is complete when all of the following are true:

1. A designer can describe the full desktop layout without inventing missing sections.
2. A designer can describe the full mobile layout without reusing desktop columns.
3. The first viewport clearly answers:
   - what is the signal
   - can I trust it
   - what changed
4. Indicator evidence and agreement are represented in one connected system.
5. Context items are clearly tagged and visually separated from weighted evidence.
6. Confidence is never presented as forecast probability.
7. The design can be mapped directly onto the current `v2` component/data structure with clear refactor targets.

## Immediate Next Step

Use this spec and `docs/signal-decision-cockpit-design-brief.md` together as the design source of truth before any implementation planning or screen build starts.
