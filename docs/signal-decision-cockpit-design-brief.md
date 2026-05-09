# Signal Decision Cockpit Design Brief

## Goal

Redesign the current market signal dashboard into a decision cockpit. The first screen must answer, in order:

1. What is the signal now?
2. Can I trust it?
3. What changed?
4. What evidence supports or challenges it?
5. What recent context matters?

This is a decision-support UI, not a market news portal and not financial advice. The design should make the current stance, confidence, data quality, and evidence easy to scan before the user reads supporting detail.

## Design Principles

- Lead with the decision. The dominant element is a hero decision panel, not a set of equal dashboard cards.
- Show trust before depth. Confidence, coverage, freshness, and warnings must be visible near the main signal.
- Explain movement. Previous score, delta, and the key reason for change should sit immediately after the current signal.
- Merge related evidence. Indicator breakdown and agreement belong in one evidence matrix so users compare weight, score, direction, freshness, and conflicts in one place.
- Separate evidence from context. Articles and feeds are latest developments, not weighted score components.
- Preserve scoring semantics. The UI must not imply confidence is forecast probability; confidence means indicator agreement.
- Keep controls compact. Market, mode, and social/source toggles should be available without competing with the decision.
- Design mobile first. The mobile layout is a linear briefing, not a compressed desktop grid.

## Target Information Hierarchy

1. Compact control bar
   - Market: US / MY
   - Mode: Momentum / Contrarian
   - Social/source toggle
   - Refresh or last updated affordance if available

2. Hero decision panel
   - Signal tier as the largest text element: Strong Buy / Buy / Neutral / Sell / Strong Sell
   - Composite score: 0-100
   - Previous score and delta
   - Confidence level and agreement percentage
   - Data quality: freshness, coverage, warning count
   - Timestamp / snapshot date
   - One-line driver: the clearest reason this signal exists now

3. What changed
   - Short summary of the latest movement
   - Previous score, current score, delta, previous snapshot date
   - Top positive and negative driver changes where data supports it
   - Source toggle impact when social/news inclusion materially changes the score

4. Evidence matrix
   - One row per active indicator
   - Columns: source, raw value, normalized score, mode-aware signal, weight/contribution, freshness, supports/challenges current signal
   - Agreement summary above or beside the matrix
   - Conflicts called out inline, not as a disconnected warning card

5. Analyst note
   - One concise paragraph
   - Must state the read, strongest evidence, disagreement/caveat, and how confidence should be interpreted

6. Latest developments
   - Short list of recent articles/feed items
   - Each item tagged as Supports, Opposes, or Context
   - Keep source and time visible
   - Do not present feed cards as separately weighted components

7. Supporting context
   - Index trend / breadth
   - Historical context
   - AAII cadence note when AAII contributes
   - Engine/version/footer details

## Modules To Keep, Merge, Or Remove

### Keep

- `DashboardHeader` behavior, but redesign it as a compact control bar instead of a large title block.
- `SignalGauge` data role, but do not let a decorative gauge dominate over the decision text if space is tight.
- `SignalQualityPanel` data, especially freshness, coverage, warnings, score drivers, trend context, and AAII cadence.
- `IndicatorList` data, including raw value, normalized score, weight, mode-aware signal, and source freshness.
- `IndicatorAgreement` logic, especially majority signal, agreement count, and conflict state.
- `AnalysisCard` role as a short analyst note.
- `ArticleList` role as latest context, with clearer support/opposition tagging.

### Merge

- Merge summary cards, `SignalGauge`, score delta, confidence, and quality badges into the hero decision panel.
- Merge `IndicatorList` and `IndicatorAgreement` into one evidence matrix.
- Merge limited coverage and signal conflict warnings into the hero trust band and evidence matrix, instead of separate full-width alert cards.
- Merge source toggle impact into the control bar tooltip and the What Changed module.

### Remove Or De-Emphasize

- Remove the current four equal summary cards as top-level layout anchors.
- Remove oversized dashboard title treatment once the cockpit is loaded.
- De-emphasize decorative hover motion and large empty card padding.
- Avoid repeated explanations of Momentum vs Contrarian in multiple modules; one compact helper is enough.
- Avoid presenting every component as a standalone card when a matrix would compare them faster.

## Desktop Flow

Desktop should use a briefing layout with one dominant first row.

1. Top compact control bar across the page.
2. Hero decision panel spans the main width. It can use a two-zone layout:
   - Left: tier, score, delta, confidence, quality badges.
   - Right: compact gauge or score trend, timestamp, one-line driver.
3. What Changed sits directly below the hero as a full-width strip or two-column module.
4. Evidence matrix occupies the main content width. Agreement summary and conflict callout remain attached to this matrix.
5. Analyst note sits near the evidence matrix, preferably above latest developments.
6. Latest developments and supporting context sit below evidence, with latest developments first.

Desktop can use two columns only after the hero and change summary are complete. Do not split the first decision moment across disconnected columns.

## Mobile Flow

Mobile should be a single linear briefing:

1. Sticky or top compact controls.
2. Hero decision panel.
3. Trust band: confidence, coverage, freshness, timestamp.
4. What changed.
5. Evidence matrix collapsed into stacked rows.
6. Analyst note.
7. Latest developments.
8. Supporting context.

Mobile rows must prioritize labels and values over chart decoration. The user should understand the signal without horizontal scrolling.

## Interaction Guidance

- Market and mode changes should refetch the signal and preserve clear loading states.
- Social/source toggle should explain current score impact before or immediately after toggle.
- Tooltips should clarify terms only when needed: confidence, mode, source inclusion, and freshness.
- Evidence rows may expand for raw-source details, but collapsed rows must still show signal, weight, score, and freshness.
- Latest developments should open source links in a new tab and retain source/time/tag visibility.
- Error states should preserve the control bar and show the last known signal only if the UI clearly labels it as stale or unavailable.

## Visual Guidance

- Use a restrained cockpit style: dense, calm, and scan-friendly.
- The hero panel should have the strongest contrast and typographic hierarchy.
- Use color primarily for signal tier, support/opposition tags, confidence, and warnings.
- Keep cards at small radii and avoid nested card stacks.
- Use consistent semantic colors:
  - Buy/support: green
  - Sell/oppose: red
  - Neutral/context: slate or blue
  - Warnings/data quality issues: amber
- Do not rely on color alone; pair color with labels.
- Avoid oversized decorative backgrounds, heavy gradients, and motion that distracts from the decision.

## Success Criteria

- The first viewport clearly states current tier, score, confidence, coverage/freshness, timestamp, and one-line driver.
- A user can answer "can I trust this?" without scrolling past the hero.
- Score delta and What Changed appear before evidence details.
- Indicator breakdown and agreement are visible in one combined evidence module.
- Conflicting indicators are obvious and tied to the row or summary that caused the conflict.
- Latest developments are tagged Supports, Opposes, or Context and are clearly separate from weighted evidence.
- Mobile reads as a linear briefing with no overlapping controls, clipped labels, or horizontal scroll.
- The UI preserves documented semantics from `docs/signal-scoring.md`, especially confidence as agreement rather than forecast probability.
- Existing config behavior remains intact: market, mode, and social/source toggles still change the signal request.

## Implementation-Aware Handoff Notes

- Primary screen owner: `src/components/v2/SignalDashboard.tsx`.
- Current component candidates:
  - Convert `DashboardHeader` into a compact control bar.
  - Replace top summary cards with a new hero decision panel.
  - Refactor or replace `SignalQualityPanel` so its trust and driver data feeds the hero, What Changed, and supporting context.
  - Combine `IndicatorList` and `IndicatorAgreement` into a unified evidence matrix.
  - Keep `AnalysisCard` concise and position it after evidence.
  - Update `ArticleList` to support Supports / Opposes / Context tags. If the API only provides bullish / bearish / neutral sentiment, map those labels conservatively until richer tagging exists.
- Do not move scoring logic into UI components. UI should render typed `MarketSignal` data from `src/lib/types/signal-v2.ts`.
- If new fields are needed for driver deltas or development tags, add them to the API/type contract deliberately and update docs.
- Verification should follow `docs/TESTING.md`: lint, typecheck, harness, and browser checks for desktop/mobile layout and toggle behavior.
