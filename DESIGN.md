# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-10-21
- Primary product surfaces: Guided Start, Market Conditions, and Research workspaces.
- Evidence reviewed: `src/components/v6/DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `src/components/v6/StartGuideV6.tsx`, `src/components/v6/MarketDashboardV6.tsx`, `src/components/v6/ResearchDashboardV6.tsx`, and existing V6 workspace components.

## Brand
- Personality: Calm, evidence-led, compact, and explicit about uncertainty.
- Trust signals: Dated sources, visible coverage gaps, deterministic calculations, and plain-language limitations.
- Avoid: Trading-terminal density, decorative financial imagery, urgency, and unsupported recommendation language.

## Product goals
- Goals: Shorten the path from current evidence to a reviewable research action, give new users one clear daily entry point, and preserve a learning trail.
- Non-goals: Brokerage execution, guaranteed forecasts, personalized financial advice, and opaque AI picks.
- Success signals: Users can understand why a result appeared, inspect its evidence, and revisit the recorded outcome.

## Personas and jobs
- Primary personas: Self-directed investors who want structured research without manually assembling every input.
- User jobs: Scan opportunities, understand scores, save research, compare alternatives, and review later outcomes.
- Key contexts of use: Desktop investigation and mobile review.

## Information architecture
- Primary navigation: Start, Market, and Research. Within Research, use `Watchlist | Discovery | Activity | Analyze | Portfolio | Review | More`; Picker is a secondary Discovery workspace.
- Core routes/screens: `/start` for the guided current-evidence journey, `/` for market conditions, and `/research` for ticker-level workspaces.
- Content hierarchy: Current state, evidence and limitations, action or saved observation, then historical learning.

## Design principles
- Evidence before action: Show the inputs and coverage behind every score.
- Progressive disclosure: Keep the first decision surface concise while retaining inspectable detail.
- Preserve boundaries: Separate market posture, ticker ranking, user decisions, and observed outcomes.
- Tradeoffs: Prefer honest limited evidence over a more exciting but unsupported forecast.

## Visual language
- Color: V8 surfaces use semantic tokens defined on `.app` in `src/components/v8/market-v8.module.css`, one colour per job: slate neutrals (`--canvas`, `--surface*`, `--line*`, `--ink`, `--muted`, `--subtle`), teal `--brand` for buttons, active tabs, selection and focus, blue `--link` for links, `--up` green for positive data only, `--down` rose for negative data or explicit risk, `--caution` amber for stale or fallback evidence, and slate `--chart-line` for neutral series. Do not add raw hex values to V8 styles or inline SVG; add or reuse a token. V6/V7 keep their existing theme tokens. V8 has a dark set of the same tokens (neutral slate surfaces, brighter teal, green/rose/amber for data) applied when `<html data-v8-theme="dark">`; the root layout sets that attribute before first paint from the stored choice (`signal-v8-theme-v1`: light or dark) or, by default, the system setting, and the header theme control (Auto / Light / Dark) changes it. Text on brand fills uses `--on-brand`; shadows and overlays use `--shadow`.
- Typography: V8 uses the bundled Source Sans 3 (`--font-sans`) with tabular figures for all numbers; Roboto Mono is available as `--font-mono`. Font sizes come from the V8 scale `--text-xs` 12, `--text-sm` 13 (default secondary text), `--text-base` 14, `--text-md` 16, `--text-lg` 20, `--text-xl` 24, `--text-2xl` 32 and `--text-display` 48; SVG user-unit chart labels are the only exception.
- Spacing/layout rhythm: Compact 8px-radius panels, 12–16px internal spacing, and a 1280px shell.
- Shape/radius/elevation: Reuse V6 panel and row surfaces.
- Motion: Existing restrained theme and disclosure transitions only.
- Imagery/iconography: Text-first; no new decorative imagery for financial claims.

## Components
- Existing components to reuse: Grouped Research workspace navigation, V6 theme tokens, Discovery response validation, and Research navigation actions.
- New/changed components: `StartGuideV6` for the score-to-candidate-to-current-news journey, plus the Research Picker workspace under Discovery.
- Variants and states: Setup, loading, results, no matches, error, and saved basket.
- Token/component ownership: V6 theme tokens remain owned by `src/components/v6/research-v6.ts`; V8 colour, font and type-scale tokens are owned by the `.app` rule in `src/components/v8/market-v8.module.css`.
- Market indicator identity: `--indicator-*` tokens distinguish inputs in the coverage ring, legend and leading-evidence markers. These colours identify the input, not its direction or freshness; names and freshness labels remain explicit, and neutral fallback stays grey.

## Accessibility
- Target standard: Keyboard-operable controls with semantic headings, labels, tables, and status feedback.
- Keyboard/focus behavior: Every control keeps a visible focus state and at least a 40px target.
- Contrast/readability: Reuse tested light and dark theme tokens; status never relies on color alone.
- Screen-reader semantics: Loading and saved feedback use live status text.
- Reduced motion and sensory considerations: No required animation or color-only interpretation.

## Responsive behavior
- Supported breakpoints/devices: 1280px, 768px, and 375px verification widths.
- Layout adaptations: Configuration and result grids stack; dense tables own local horizontal scrolling.
- Touch/hover differences: Primary actions remain visible and do not depend on hover.

## Interaction states
- Loading: Identify which current market or Discovery data is being loaded without presenting stale examples as live results.
- Empty: Explain which score or risk constraint removed every candidate.
- Error: Retain configuration and provide an explicit retry action.
- Success: Show scan time, coverage, selected candidates, and evidence limitations.
- Disabled: Prevent paper-basket creation without eligible candidates.
- Offline/slow network: Surface provider failure without replacing it with sample results.

## Content voice
- Tone: Direct, calm, and specific.
- Terminology: Use candidate, score, current setup, observational history, and paper basket.
- Microcopy rules: Do not label a score as a probability or use `Buy` until validated out-of-sample evidence exists.

## Implementation constraints
- Framework/styling system: Next.js, React, TypeScript, and existing Tailwind utility patterns.
- Design-token constraints: Reuse V6 theme classes on V6 surfaces and the V8 CSS custom properties on V8 surfaces; add no separate design-system package.
- Performance constraints: The Start route reuses the existing signal and bounded Discovery endpoints; it must not introduce another score, provider, or duplicate request after the initial guided load.
- Compatibility constraints: Browser-local paper baskets must not mutate persisted Research records.
- Test/screenshot expectations: Standard lane checks plus 1280px, 768px, and 375px browser verification.

## Open questions
- [ ] Point-in-time historical fundamentals are required before the Picker can claim an out-of-sample score-to-return probability.
- [ ] Malaysia requires a separate eligible universe and point-in-time fundamental source before Picker support.
