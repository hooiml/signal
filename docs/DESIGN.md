# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-07-17
- Primary product surfaces: Market Briefing and Investment Research.
- Evidence reviewed: `docs/PROJECT_OBJECTIVE_AND_FLOWS.md`, `docs/signal-decision-cockpit-design-brief.md`, `docs/TESTING.md`, `docs/QUALITY.md`, and the V6 components under `src/components/v6`.

## Brand
- Personality: Calm, analytical, plain-spoken, and evidence-led.
- Trust signals: Visible source readings, calculation inputs, agreement, freshness, coverage, timestamps, conflicts, and limitations.
- Avoid: Trading hype, unexplained scores, decorative finance-dashboard density, and confidence language that implies forecast probability.

## Product goals
- Goals: Turn scattered market and security evidence into traceable decisions; make disagreement and data quality easy to see.
- Non-goals: Predict returns, provide financial advice, or merge the market score into security-level decisions.
- Success signals: A user can identify the current posture, strongest evidence, conflicts, freshness, and next review condition without reverse-engineering the interface.

## Personas and jobs
- Primary personas: Self-directed investors, including users who do not know indicator or scoring terminology.
- User jobs: Assess the market environment, understand why the score exists, inspect uncertainty, and carry context into independent security research.
- Key contexts of use: Quick daily scan, deeper evidence review, mobile monitoring, and periodic research review.

## Information architecture
- Primary navigation: Market Briefing and Investment Research.
- Core routes/screens: `/` and `/main-v6` for Market Briefing; `/research` and `/research-v6` for Investment Research.
- Content hierarchy: Decision posture -> trust and score summary -> ranked evidence -> change/history -> scenarios/context -> methodology.

## Design principles
- Lead with the decision, then immediately show how trustworthy and current it is.
- Pair model outputs with the underlying reading and a plain-language interpretation.
- Treat supporting and conflicting indicators as parallel ranked evidence, not chronological steps.
- Keep advanced methodology available without making it a prerequisite for understanding the story.
- Tradeoff: Prefer a little more explanatory copy over unexplained compact metrics, while keeping the first viewport scannable.

## Visual language
- Color: Use semantic color for posture, support, conflict, freshness, and warnings; never rely on color alone.
- Typography: Strong plain-language headlines, compact uppercase metadata, and readable explanatory body copy.
- Spacing/layout rhythm: Bounded panels, consistent internal spacing, and linear mobile flow.
- Shape/radius/elevation: Restrained rounded borders with explicit surface tiers: primary decision panels carry the strongest elevation, secondary evidence panels are flatter, utility/reference panels are quiet, and action panels use restrained semantic emphasis. Avoid ornamental elevation.
- Motion: Minimal and functional, respecting reduced-motion preferences.
- Imagery/iconography: Use icons only when they clarify status or interaction.

## Components
- Existing components to reuse: V6 theme helpers, raw-value formatters, freshness helpers, ranked-driver helpers, evidence tables, and disclosure patterns.
- New/changed components: Market-story evidence cards may expose actual readings, role, score contribution formula, and update date.
- Research hierarchy: The selected security workspace is primary; daily attention and thesis workflow panels are secondary; portfolio summaries, comparisons, fundamentals, history, and workspace navigation use utility surfaces; submit/save controls carry action emphasis. Keep the read-only journal collapsed by default with a useful summary, and stabilize detail-tab height with an internally scrolling viewport from tablet upward while preserving natural document flow on mobile.
- Variants and states: Support, conflict, caution, neutral, stale, missing, loading, and refresh-error states.
- Token/component ownership: Reuse `getThemeV6` and its primary, secondary, utility, and action panel tiers; do not create a parallel token layer.

## Accessibility
- Target standard: WCAG 2.1 AA where practicable.
- Keyboard/focus behavior: Interactive disclosures and controls remain keyboard reachable with visible focus.
- Contrast/readability: Maintain readable body size and semantic contrast in light and dark themes.
- Screen-reader semantics: Use headings, descriptions, lists, tables, and definition lists according to content meaning.
- Reduced motion and sensory considerations: Do not encode support or conflict through color or motion alone.

## Responsive behavior
- Supported breakpoints/devices: Desktop, tablet, and narrow mobile, verified at 1280px, 768px, and 375px.
- Layout adaptations: Multi-column evidence becomes a linear briefing; formulas and timestamps wrap without document overflow.
- Touch/hover differences: Explanatory content required for comprehension must not be hover-only.

## Interaction states
- Loading: Preserve the current briefing with a visible refresh state.
- Empty: State when evidence, history, context, or comparison is unavailable.
- Error: Explain that the prior briefing remains visible when refresh fails.
- Success: Show the refreshed snapshot and its timestamp.
- Disabled: Excluded sources must be distinguishable from active neutral readings.
- Offline/slow network, if applicable: Avoid replacing valid prior evidence with an empty shell.

## Content voice
- Tone: Concise, calm, specific, and non-promotional.
- Terminology: Say `indicator agreement`, not prediction confidence; distinguish `actual reading`, `normalized score`, `configured weight`, and `weighted points`.
- Microcopy rules: Explain unfamiliar calculations inline, name why an indicator supports or conflicts, and show dates for weekly sources.

## Implementation constraints
- Framework/styling system: Next.js, React, TypeScript, and existing Tailwind utilities.
- Design-token constraints: Use existing V6 theme classes and shared cockpit helpers.
- Performance constraints: No new client fetches or dependencies for presentational explanation.
- Compatibility constraints: Preserve the typed market-signal contract and mode-aware scoring semantics.
- Test/screenshot expectations: Follow `docs/TESTING.md`; run Market V6 QA at 1280px, 768px, and 375px for hierarchy or responsive changes.

## Open questions
- [ ] Validate unfamiliar-indicator copy with new users and shorten any explanation that does not improve comprehension.
- [ ] Decide whether advanced per-indicator normalization formulas should remain inline or move to one shared methodology disclosure after usability testing.
