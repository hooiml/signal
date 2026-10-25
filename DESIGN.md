# Design

The design contract for Signal's default (V8) interface. Older surfaces keep their own contracts:
V6 in `src/components/v6/DESIGN.md`, V7 in `docs/DESIGN_V7.md`.

## Source of truth

- Status: Active
- Last refreshed: 2026-10-25
- Default surfaces: **Market** (`/main-v8`) and **Research** (`/research-v8`).
- Evidence reviewed: `src/components/v8/` (components and CSS modules), `src/app/page.tsx`,
  `src/app/research/page.tsx`, `src/app/layout.tsx`, `docs/TESTING.md`, `docs/V8_UI_UX_ENHANCEMENT_PLAN.md`
  and `docs/NEXT_PRODUCT_ROADMAP.md` ("Product Direction To Preserve").

## Brand

- **Personality:** calm, evidence-led, compact, and explicit about uncertainty.
- **Trust signals:** dated sources, visible coverage gaps, deterministic calculations, plain-language limits.
- **Avoid:** trading-terminal density, decorative financial imagery, urgency, and recommendation language
  the evidence does not support.

## Product goals

- **Goals:** shorten the path from current evidence to a reviewable research action, and keep a learning
  trail the user can revisit.
- **Non-goals:** brokerage execution, guaranteed forecasts, personalized financial advice, opaque AI picks.
- **Success signals:** a user can say why a result appeared, inspect its evidence in one or two clicks,
  and revisit the recorded outcome later.

## Personas and jobs

- **Who:** self-directed investors who want structured research without assembling every input by hand.
- **Jobs:** read market conditions, find candidates, research one security, save research, review outcomes.
- **Contexts:** desktop investigation and mobile review.

## Information architecture

| Route | What it is |
| --- | --- |
| `/` | Redirects to `/main-v8`. |
| `/main-v8` | Market conditions. Basic view by default; **Advanced tools** adds tabs and replay. |
| `/research-v8` | Company research. `/research?ticker=…` (ticker only) redirects here. |
| `/research` (other params) | The V7 integrated workspace (built on the V6 dashboard) that saved-research edit links open. |
| `/start` | V6 guided start. Not linked from the V8 header. |
| `/learn` | Existing courses in the V8 shell; `?concept=rsi`, `put-call`, `naaim`, `pe` or `fcf-yield` opens its matching lab. |

- **Primary navigation (V8 header):** Market · Research, plus Settings.
  Learn uses the same header with a current Learn link; its navigation wraps below the wordmark and
  Settings on phones. Existing courses and the command palette remain available.
- **Settings (G4/E20):** one native modal in connected Market, Research and Learn, keeping the
  underlying editors mounted. Appearance has the existing immediate Light / Auto / Dark radios.
  Market defaults save explicitly for the next opening/reload; a valid URL market takes priority.
  Guest data actions use saved-only export with draft warnings, and confirmed clear of guest
  securities, notes and recovery backups only. Owner access opens the existing unlock page in a
  new tab with the full return context. Workspace retains Advanced tools and owner lock.
  Use the existing V8 tokens, a 560px maximum width, 44px targets, visible focus, native modal
  inertness and bounded vertical scrolling at narrow widths. Storage errors remain visible.
  The architecture and privacy boundaries are in [`V8_SETTINGS_DESIGN.md`](docs/V8_SETTINGS_DESIGN.md).
- **Metric glossary:** RSI, P/E, FCF yield, put/call and NAAIM share short definitions in
  `src/lib/learn/metric-links.ts`. Dotted labels open the same small native popover on tap or
  keyboard focus. Existing Market metric buttons open the definition first; **View indicator**
  retains their evidence-inspector action. Escape, Close, outside click and leaving by keyboard
  dismiss it. The top layer avoids clipping in tables and panels; position stays within the
  viewport. **Learn more** opens the existing lesson in a new tab, preserving the reading and
  unsaved work. Controls are at least 44px tall and have visible focus. Learn navigation itself
  stays in the same tab. Examples are educational, never copied current readings.
- The glossary covers connected and demo Market labels, Research price context, valuation and
  filing history, peers and the reused chart's RSI controls/readout/guide. Native select options
  keep plain text with a definition control beside the selected supported metric. Accounting
  disclosure summaries retain their toggle; their definition control appears inside the opened
  disclosure. Narrative prose, chart image descriptions and Learn lesson content are not automatic
  glossary triggers. Other metrics, including free cash flow itself, are outside this vocabulary.
- **Market, basic view:** score summary and coverage ring → score history beside the indicator evidence
  list → wider-market strip → historical outcomes → exposure map → links into Research → methodology
  (collapsed) → tabs **What changed · Context**.
- **Market, Advanced view:** adds the **Evidence**, **History** and **Scenarios** tabs and historical
  snapshot replay.
- **Research home** (no ticker): stock search, then **Watchlist** (saved stocks as cards),
  **Discover** (Trending · Early trends · Stock Picker · Calendar · Alerts) and **Holdings**
  (read-only device snapshot; cost/cash totals by currency, missing prices explicit). The Holdings
  table scrolls horizontally inside a named keyboard-focusable region. Import and advanced
  portfolio tools remain in the linked Portfolio workspace. The header shows
  **Workspace** (Advanced tools and owner workflow actions); guest export/clear and unlock live in Settings.
- **Reading a stock:** the header adds a **Watchlist · N** switcher; **Change stock** and **Discover**
  sit above the quote band (price, daily change and the primary **Save stock** button, with the price
  context strip beside it), then tabs **Overview · Chart & technicals · Financials · Valuation ·
  Peers · Filings**. **Thesis** and **Review** appear only in Advanced view for a saved stock.
- **Calendar:** a week grid that starts this week and covers the chosen 30- or 90-day window (90
  days pages in six-week blocks), with an agenda for the selected day. One data hue marks watchlist
  earnings; trending earnings are an outline, reviews a dashed outline, macro a hatch, and only an
  overdue review takes the risk colour. The legend lists only kinds on screen; phones show the
  same marks as small dots.
- **Wording:** user-facing labels say "stock" and "Watchlist"; data-scope notes may still say
  "security" where ETFs or funds are included.
- **Content order on every page:** current state → evidence and limits → action or saved record →
  historical learning.

## Design principles

- **Evidence before action:** every score shows the inputs and coverage behind it.
- **Progressive disclosure:** the first screen answers "what is the reading and how sure is it?";
  everything else is one click away. Concretely:
  - Show each fact in one place. Other places link or scroll to it instead of repeating it.
  - Definitions, formulas, sample sizes and method notes go behind a labelled `<details>`, not inline.
  - When nothing is available, render one line that says so, not a grid of "Unavailable" cards.
  - When several values fail for the same reason, state the reason once; each row names only what
    it needs ("Needs market capitalization and annual net income.").
  - Audit-level detail (full accounting, raw archives, model weights) belongs in a collapsed section
    or the Advanced view.
  - Routine states stay quiet; exceptions (stale, undated, fallback) are what gets surfaced.
- **Preserve boundaries:** keep market posture, ticker ranking, user decisions and observed outcomes
  visibly separate.
- **Tradeoff:** honest limited evidence beats a more exciting but unsupported forecast.

## Visual language

### Colour

V8 tokens are defined on `.app` and the token-only `.tokens` scope in
`src/components/v8/market-v8.module.css`, one colour per job:

| Job | Tokens |
| --- | --- |
| Neutrals | `--canvas`, `--surface`, `--surface-subtle`, `--surface-muted`, `--line`, `--line-strong`, `--ink`, `--muted`, `--subtle` |
| Brand (buttons, active tabs, selection) | `--brand`, `--brand-hover`, `--brand-soft`, text on brand fills `--on-brand` |
| Links | `--link`, `--link-hover` |
| Focus ring | `--focus` |
| Positive data only | `--up`, `--up-soft`, `--up-line`, `--up-mark` |
| Negative data or explicit risk | `--down`, `--down-soft`, `--down-line`, `--down-mark` |
| Stale or fallback evidence | `--caution`, `--caution-soft`, `--caution-line`, `--caution-mark` |
| Neutral chart series | `--chart-line` |
| Shadows and overlays | `--shadow` (mixed with `color-mix`) |
| Market input identity | `--indicator-vix`, `-social`, `-put-call`, `-news`, `-aaii`, `-naaim`, `-bofa` |

- Never add raw hex values to V8 CSS or inline SVG; add or reuse a token.
- Indicator colours identify an input, not its direction or freshness. Names and freshness labels
  stay explicit, and neutral fallback stays grey.
- **Dark theme:** the same tokens are redefined under `html[data-v8-theme=dark]`. The boot script in
  `src/components/v8/v8-theme.ts` sets the attribute before first paint from the stored choice
  (`signal-v8-theme-v1`: `light` or `dark`) or, by default, the system setting. The header toggle is
  a radio group (Light / Auto / Dark) with icons; phones show the icons only.

### Typography

- Source Sans 3 (`--font-sans`) with tabular figures for all numbers; Roboto Mono (`--font-mono`) for
  large figures and tickers. Both are bundled; no Google Fonts requests.
- Size scale: `--text-xs` 12 · `--text-sm` 13 (default secondary text) · `--text-base` 14 · `--text-md` 16 ·
  `--text-lg` 20 · `--text-xl` 24 · `--text-2xl` 32 · `--text-display` 48. SVG user-unit chart labels are
  the only exception.
- Small context labels above headings use `.eyebrow`: `--text-sm`, weight 600, `--muted`, sentence case
  and normal letter spacing. No uppercase or tracked labels, and no brand colour on labels; table
  headers follow the same rule.
- The optional "Install Signal" offer docks in the page flow above the V8 footer
  (`#signal-install-slot`); it never floats over content. Offline and update notices keep their top bar.

### Layout, shape and motion

- **Page:** `.canvas` up to 1520px wide, 20px × 32px padding (16px sides on phones).
- **Cards:** 12px corner radius for top-level cards, 8–10px for inner panels and rows, 6px for buttons
  and inputs, pill shapes only for tags and chips. 1px `--line` borders and no shadow on resting cards;
  shadows are only for what floats (menus, dialogs, tooltips). One level of card: blocks inside a card
  or tab panel are separated by a rule or spacing, never nested in a card of their own.
- **Tables and ranked lists:** sentence-case grey headers, plain rank numbers, figures right-aligned in
  tabular figures. Colour marks only what needs attention (a fall, moderate or high risk); signs and
  words carry the rest.
- **Charts:** round y-ticks with one step of room above and below the data, faint gridlines, four to
  six evenly spaced dates; the range's finding sits beside the chart title.
- **Spacing:** 12–20px inside cards, 20–22px between cards.
- **Motion:** short colour and disclosure transitions only. Everything respects
  `prefers-reduced-motion` (already handled on `.app`).
- **Imagery:** text-first; no decorative imagery attached to financial claims.

## Components

Shared V8 building blocks, reused before adding new ones:

- **Primitives (`market-v8.module.css`):** `.panel`, `.tabs`, `.segment`, `.secondaryButton`,
  `.textButton`, `.eyebrow`, `.tag`, `.disclosure`, `.muted`, `.visuallyHidden`, `.skip`.
- **Market:** score summary (`MarketV81Hero`), coverage ring (`MarketCoverageRing`), indicator evidence
  list (`MarketIndicatorEvidence`), score chart (`MarketV8Chart`), wider-market strip
  (`MarketV8ContextSummary`), historical outcomes (`MarketV8Outcomes`), exposure map
  (`MarketV8Exposure`), investigation tabs (`MarketV8ConnectedPanels`).
- **Research:** security lookup, Discover (`ResearchDiscoverV8` with Trending, Early trends, Picker,
  Calendar, Alerts), price context strip, financial status card (`ResearchCurrentAssessment`), tab
  panels (`ResearchV8ConnectedPanels`), technicals chart, Peers, Filings.
- **States every component handles:** loading, empty, partial, error with retry, and stale.
- **Ownership:** V8 tokens live in `market-v8.module.css`; each feature keeps its own CSS
  module next to its component. Add no separate design-system package.
- **Exception:** `ResearchExpectationRealityV8` lives in `src/components/v8/` but renders inside the V6
  dashboard of the editing workspace (via `ResearchReviewToolsV12`), so it follows that workspace's
  Tailwind styling, not V8 tokens.

## Accessibility

- Keyboard-operable controls with semantic headings, labels, tables and live status text.
- Every control keeps the visible `--focus` ring and a target of at least **44px** tall.
- Tabs use roving focus with Arrow, Home and End keys.
- Status never relies on colour alone; reuse the tested light and dark tokens for contrast.
- Popovers and expanders use native `<details>`/`<summary>` unless a richer pattern is required.

## Responsive behaviour

- Verify at the widths in `docs/TESTING.md`: 1440, 1280, 768, 390 and 375px.
- Two-column grids stack below 900px; card content stacks below 600px.
- Dense tables scroll horizontally inside their own container; the page itself never scrolls sideways.
- Primary actions stay visible and never depend on hover.

## Interaction states

- **Loading:** name what is loading; never show sample values as live data.
- **Empty:** one line explaining why, and where to go next.
- **Partial or stale:** show what exists, label what is missing or old, and say what fallback applies.
- **Error:** keep the previous response and its dates visible, and offer an explicit retry.
- **Success:** show retrieval time, coverage and limits next to the result.
- **Offline or slow:** surface the provider failure; never substitute demo results.

## Content voice

- **Tone:** direct, calm and specific. Short sentences; one idea per sentence.
- **Terms:** reading, score, coverage, evidence, candidate, saved research, paper basket.
- **Rules:** never call a score a probability; never write "Buy" or "Sell" as advice; say "unavailable"
  rather than inventing a value; label reconstructed history as reconstructed.

## Implementation constraints

- Next.js App Router, React and TypeScript. V8 styles use CSS modules with the tokens above.
  Existing Learn exercises retain their Tailwind layout with locally scoped V7-to-V8 token aliases
  in `learn-v8.module.css`; the shared V8 page reset is not applied to those lessons. Other legacy
  V6/V7 surfaces retain their own styling.
- Add no dependencies, providers or persisted state without the review in `NEXT_PRODUCT_ROADMAP.md`.
- Browser-local data (guest workspace, paper baskets, last visit) must stay visibly separate from
  server-saved research and must never modify it.
- UI changes follow the lane rules and Visual QA Contract in `docs/TESTING.md`.

## Open questions

- [ ] Point-in-time historical fundamentals are required before the Picker can claim an out-of-sample
      score-to-return probability.
- [ ] Malaysia needs its own eligible universe and point-in-time fundamental source before Picker support.
