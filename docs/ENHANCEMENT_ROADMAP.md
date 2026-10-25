# Signal Enhancement Roadmap

## Purpose

The working order for enhancements after the V8 UI/UX plan, so they can be delivered one at a time.
Each item is small enough for one branch and one pull request.

Unscheduled interaction ideas for Market and Research are collected in
[`V8_INTERACTION_IDEAS.md`](V8_INTERACTION_IDEAS.md); one becomes an `E` item only when chosen.

Full specifications for E3–E7 live in [`NEXT_PRODUCT_ROADMAP.md`](NEXT_PRODUCT_ROADMAP.md) (Tasks 0
and 5–8); this file only fixes their order and adds the near-term items. Product rules from that
roadmap ("Product Direction To Preserve") apply to every item here.

## Baseline — 2026-10-22

- All V8 UI/UX batches and V8-16 are verified ([`V8_UI_UX_ENHANCEMENT_PLAN.md`](V8_UI_UX_ENHANCEMENT_PLAN.md)).
- PRs up to #30 (including price-chart context/review markers and V8 dark mode) are merged.
- The duplicate review-marker fix landed directly on `main` as `0779864`.
- Follow-up CI diagnostics are in [PR #31](https://github.com/hooiml/signal/pull/31);
  evidence/review provenance, provider isolation and the acceptance fixes below are in
  [PR #33](https://github.com/hooiml/signal/pull/33). Their verification does not mean they
  have been merged or deployed.

## How We Move

1. Start with the first item whose status is `Ready`, e.g. `Proceed with E1`.
2. Only one item is `In progress` at a time.
3. Branch from current `main`, follow [`TESTING.md`](TESTING.md) for the item's lane, then open a PR.
4. After merge, update the item's status and evidence below, then pick the next one.

Status vocabulary matches `NEXT_PRODUCT_ROADMAP.md`: `Observing`, `Proposed`, `Ready`,
`In progress`, `Verified`, `Blocked`, `Deferred`.

## Sequence

| Order | Item | Status | Lane | Gate |
| ---: | --- | --- | --- | --- |
| E1 | Price chart visual QA | Verified | UI-LIGHT | None |
| E2 | Pinned workspaces and attention badges | Verified | Standard | None; uses already-loaded counts only |
| E8 | V8 dark mode | Verified | Standard | None; added after E2 at the owner's request |
| E9 | Market "what moved" bundle | Verified | Standard | None; added after E8 at the owner's request |
| E10 | V8 Research decision context (multi-year trend bars, plan vs price ruler, historical filing multiples) | Verified | Standard | None; added after E9 at the owner's request |
| E11 | V8 Research unit profitability margins, balance-sheet cushion and share dilution trajectory | Verified | Standard | None; added after E10 at the owner's request |
| E12 | V8 app-screen review fixes (Calendar window and marks, Market polish) | Verified | Standard | None; added after a taste review at the owner's request |
| E13 | Research stock page: tighter price chart and header | Verified | Standard | None; second taste review item at the owner's request |
| E14 | Research price-chart measurement (R1) | Verified | Standard | Uses already-loaded daily closes; temporary exploration only |
| E15 | Phone stock-page tab navigation (L3) | Verified | Standard | Existing tabs and URLs; no data or persistence change |
| E3 | Today promotion review | Observing | LIGHT | Task 0 window: ~30 active-use days or two review cycles |
| E4 | Forward-validation lab — discovery | Proposed | LIGHT (design doc) | Freeze model version and evaluation policy before any code |
| E5 | Forward-validation lab — first slice | Proposed | Standard | E4 approved |
| E6 | Corporate-action resolution assistant | Proposed, demand-gated | Standard | Sustained reconciliation use with corporate actions as a repeated blocker |
| E7 | Malaysia primary-source parity | Blocked, provider-gated | Standard | Approved official or licensed announcement source |

## Items

### E1 — Price chart visual QA

**Why:** PR #29 added a hover read-out, 52-week high/low lines and saved-review markers to the
Research price chart, verified by lint, typecheck, harness and build only.

**Scope:** Follow the Visual QA Contract in `TESTING.md` at 375px and desktop widths for the
Research V8 price chart: hover read-out edges, band labels, marker overlap, empty and loading
states, light and dark themes. Fix only issues found in that chart.

**Done when:** Screenshots at both widths show no clipping, overlap or overflow, and any fix passes
the standard verification set.

**Evidence — 2026-10-22:** AAPL at 1280px, 768px and 375px on 3M and 1Y. Found the 52-week labels
drawn inside the plot, where the close line always touches them; moved them outside the plot edges
and let the date row drop below a 52-week low label as label size scales on narrower charts. After
the fix: no text-to-text or text-to-line overlap, no text outside the chart, no document overflow,
hover read-out centred 7px above its point. Lint, typecheck, harness and build pass.

**Initial verification gap:** Saved-review markers were not checked because the local owner
boundary was unconfigured, and V8 dark styles had not yet landed. Follow-up checks use isolated
saved-record fixtures so the missing local owner configuration cannot hide these states.

**Follow-up acceptance — 2026-10-22:** Saved reviews now load in both themes at 1280px, 768px
and 375px. The mobile check found a review diamond overlapping the 52-week high label. Review
diamonds now have their own annotation row; the plot and labels move together without changing
prices or review dates. All six cases show the two expected review dates once, contained markers,
and no marker/text overlap. Fresh screenshots were inspected after the production rebuild.

### E2 — Pinned workspaces and attention badges

**Spec:** `NEXT_PRODUCT_ROADMAP.md` Task 5.

**Scope:** Up to three manually pinned workspaces in validated browser-local preferences; restrained
counts for incomplete Queue tasks, triggered or failed alerts and overdue reviews, only where loaded
state proves them. Keep the seven-section navigation and workspace URLs.

**Done when:** Pins survive reload and malformed storage, counts never claim unchecked sources,
labels accompany colour, and navigation has no clipping at required widths.

**Evidence — 2026-10-22:** Pins live in `signal-research-pinned-workspaces-v1`
([`workspace-pins.ts`](../src/lib/research/workspace-pins.ts)); a fourth pin is refused, not evicted.
Badges: Queue (incomplete tasks, browser-local queue) and Calendar (overdue reviews, saved records);
a source that has not loaded or failed shows no badge. Counts show on workspace tabs, pinned
shortcuts and the narrow-screen workspace select, with screen-reader labels. Browser at 1280px and
768px: two open and one completed task badge as 2, three pins persist across reload, the fourth is
disabled, pinned shortcuts navigate with `aria-current`, malformed storage recovers to no pins, no
clipping or document overflow. The pin row stays empty until storage is read, so it never shows a
false "None yet" before hydration. Research regression tests cover parsing, order, limit, unpin and
no-badge states. Lint, typecheck, harness and build pass.

**Follow-up acceptance — 2026-10-22:** The fixture browser matrix now covers pins and Calendar at
1280px, 768px and 375px in both cockpit themes. Holding the saved-record response proves there is
no overdue badge before records load; releasing one explicitly scheduled overdue review produces
exactly one badge and the matching Calendar event. Malformed storage, reload persistence, pin
navigation, the three-pin limit, clearing and control containment pass at every width.

**Remaining scope:** This matrix does not add alerts-badge coverage or alert fetches outside the
Alerts workspace. These checks use isolated saved records, not production owner data.

### E8 — V8 dark mode

**Why:** V8 Market and Research render light only (`color-scheme: light`), while the rest of the app
has a dark theme. The colour tokens from PR #23 make a dark set mostly a token swap.

**Scope:** A dark value for every V8 token; follow the system setting by default, with a
System / Light / Dark choice stored per browser. Neutral slate surfaces; teal only for actions,
selection and focus; green and rose stay reserved for data direction. Shadows, overlays and the V8
install prompt follow the theme. V6/V7 themes are unchanged.

**Done when:** Market and Research pass the Visual QA Contract in both themes at 1280px, 768px and
375px; body text and badges meet WCAG AA contrast in both themes; the choice survives reload and
malformed storage; no flash of the wrong theme for the default (system) setting.

**Evidence — 2026-10-22:** Dark values for every V8 token plus `--on-brand` and `--shadow`, in
[`market-v8.module.css`](../src/components/v8/market-v8.module.css); a boot script in the root layout
sets `data-v8-theme` before first paint from `signal-v8-theme-v1` or the system setting, and the
header control offers Auto / Light / Dark. Text pairs meet WCAG AA in both themes (lowest 4.8:1 light,
5.8:1 dark). In Chrome with a dark system setting: Market and Research follow it with nothing
stored; Light survives reload; malformed storage falls back to Auto; 1280px, 768px and 375px show
no overflow and a one-row header. Browser suites (light): `v81-ui-qa`, `v81-presentation-qa`,
`market-clarity-qa`, `research-unsaved-qa`, `research-reading-qa`, `v8-display-qa`,
`v8-exploration-qa` (toolbar select lookup scoped to `main`), `research-owner-panels-qa` and
`pwa-qa` pass. Lint, typecheck, harness and build pass.

**Initial verification gap:** Saved-review markers in dark were not loaded, and the listed browser
suites ran in the light theme only. Follow-up saved-state/theme acceptance closes these gaps
separately from the original implementation evidence.

**Follow-up acceptance — 2026-10-22:** `v8-theme-saved-state-qa.mjs` passes 25 scenarios and
132 named checks with no blocking browser errors. Fresh Market light/dark captures and saved
Research light/dark captures were inspected at 1280px, 768px and 375px. The measured body,
action and semantic-badge token pairs all exceed 4.5:1; the lowest measured pair is 4.84:1.
This is targeted token/visual acceptance, not a complete accessibility audit.

The actual server-rendered boot script is checked with hydration scripts withheld. Explicit,
Auto, malformed and denied-storage states resolve correctly. Failed reads, writes or removal
keep the selector and applied theme aligned for the page session; normal persistence, OS changes
and cross-tab updates pass. Root theme initialization and PWA reconnect state remain usable
when all localStorage access is denied. Saved Review tabs and themes survive ordinary reload.
Saved-state data is supplied by isolated fixtures, not production owner access.

The same acceptance pass closes two narrow-layout defects: structured-trigger controls remain
inside their container through focus/save/reload/conflict, and the existing readiness action is
fully visible at 375×812 (bottom 804px, previously 1,147px). Views and briefing remain mounted
behind a keyboard-accessible mobile disclosure. Lint, typecheck, harness, production build and
PWA regressions pass; the final chart-only change was rebuilt and browser-verified. The expanded
`Signal validation` workflow retains the browser reports and screenshots through explicit artifact allowlists.

### E9 — Market "what moved" bundle

**Scope:** "Since your last visit" (browser-local, per market and mode, compared with the last
different snapshot), impact chips on observed inputs (`(score − 50) × weight` points), and a
coverage ring that splits score weight by input and freshness, with a legend that opens each input.

**Evidence — 2026-10-22:** Live US Momentum in Chrome: chips +9.5 / +0.9 / +0.4 pts plus 50 give
60.8 for a score of 61; first visit shows no note; a seeded 19 Oct visit shows "57 → 61 (+4) ·
VIX Index +3.4 pts · Put/call ratio −1.2 pts" and survives reload; ring legend opens AAII detail;
dark and light, 1100px and 375px without overflow. `market-last-visit-regression.mjs` covers impact
maths, malformed storage, baseline rotation and change ranking (in the harness).

### E10 — V8 Research decision context

**Why:** V8 Research showed only a 2-year text YoY change in `Financials` and current snapshot ratios in `Valuation`, leaving multi-year trajectory, saved plan distance from live price, and filing-aligned historical valuation buried or available only in legacy V6/V7.

**Scope:**
1. Multi-year comparable annual trend bars (`annualHistorySeries`) inside each `ResearchFinancialSummary` card (`Annual revenue`, `Annual net income`, `Free cash flow`) when at least two consecutive comparable annual periods share currency and source.
2. Same-currency Position Plan vs. Returned Price visual ruler and signed percentage distance (`PositionPlanComparison` / `positionPlanPriceContext`) in V8 `Valuation` when Advanced tools are enabled and the saved plan currency matches the quote currency.
3. Lazy-loaded filing-aligned historical valuation disclosure (`HistoricalValuationV8`) in V8 `Valuation` using `GET /api/research/valuation-history/[symbol]?market=US|MY` with current-vs-filing low/median/high summary, selectable P/E, Price/sales and FCF yield bars, accessible table, and explicit Malaysia/SEC 10-K capability disclosures.

**Evidence — 2026-10-23:** `display-clarity-regression.mjs` covers `annualHistorySeries` and `positionPlanPriceContext` contracts and immutability; lint, typecheck, harness, production build and browser visual verification at 1280px, 768px and 375px pass without overflow or console/request errors.

### E11 — V8 Research unit profitability margins, balance-sheet cushion and share dilution trajectory

**Why:** Revenue, Net Income and Free Cash Flow trends alone can mask compressing operating margins, rising debt relative to cash, or ongoing share dilution; those inputs were already fetched in `fundamentals.history` and `metricProvenance` but buried as single-year snapshots inside a collapsed disclosure.

**Scope:**
1. **Unit Profitability (`ResearchQualityAndCushion`):** Multi-year Gross Margin % and Operating Margin % trajectory bars (`annualMarginSeries`) with percentage-point (`pp`) YoY expansion/compression callouts (`annualMarginComparison`).
2. **Balance-Sheet Cushion (`balanceSheetCushion`):** Same-currency Cash vs. Debt visual proportion bars with Net Cash / Net Debt posture badge and exact component reporting dates (`researchMetricPeriodLabel`).
3. **Share Count & Dilution / Buyback Trajectory (`annualShareSeries`):** Multi-year share count bar strip with cumulative net share reduction or expansion percentage across comparable annual periods, keeping `Annual diluted average shares` (Yahoo Finance) and `Shares outstanding` (SEC EDGAR) explicitly labeled.

**Evidence — 2026-10-23:** `display-clarity-regression.mjs` covers `annualMarginComparison`, `annualMarginSeries`, `balanceSheetCushion`, `annualShareSeries` and `compactShareCount`; `v8-display-qa.mjs` and `research-reading-qa.mjs` pass across 1440px, 768px, 390px and 320px without overflow or console/request errors.

### E12 — V8 app-screen review fixes

**Why:** An app-screen design review of Market, Discover and the new Calendar found the Calendar
spent four of five rows on past days while three of its "8 dates in the next 30 days" sat behind
the next-month arrow, and used five hues for five event kinds. Market had monospace outcome
figures, score and evidence columns ending about 100px apart, and a 46px loading title.

**Scope:**
1. Calendar starts at the current week and pages in six-week blocks: a 30-day window always fits
   one page (no arrows); a 90-day window has Earlier/Later weeks. The header names the visible
   range. One data hue (`--link`) marks watchlist earnings; trending earnings are an outline,
   reviews a dashed outline, macro releases a hatch, and only overdue reviews take `--down`. The
   legend lists only kinds on screen, each swatch drawn as its mark.
2. Market: outcome figures in tabular text figures (no monospace), a missing positive-period rate
   prints `—` instead of `—%`, the evidence and context cards stretch so both columns end on one
   line, the V8 title is 24–32px, and loading skeleton cards keep their own height.
3. Opening a stock from the Research home's Discover tab no longer reopens the reading view's
   Discover from the spent deep link.

**Left as is:** the coverage ring keeps one identity hue per indicator; that identity is shared
with Leading evidence and the coverage list and is asserted by `research-unsaved-qa`. The slate
dark ground stays as decided in E8.

**Evidence — 2026-10-25:** Browser at 1440px and 390px (dark) and 1280px (light): the 30-day
grid shows Oct 25 – Nov 24 with all eight dates, the 90-day grid pages Oct 25 – Dec 5 onward, no
document overflow; Market score/evidence and context columns end on the same line. Typecheck,
lint, harness and production build pass; `v8-modules-qa` (74 checks, updated for week paging and
the embedded Discover) and `research-unsaved-qa` (1440–375px) pass against the production build.

### E13 — Research stock page: tighter price chart and header

**Why:** On the stock page the price chart left about 90px of empty space above its plot, a
full-width "Inspect a trading date" slider repeated what clicking the chart does, and the guest
workspace sentence took its own row between the company name and the price.

**Scope:** Chart top padding cut from 45/48 to 24/26 SVG units (desktop/phone); the review-marker
row still opens only when markers exist. The date slider stays as the chart's keyboard control but
is no longer drawn; the chart frame shows its focus ring. On a stock page the workspace sentence
shares the Change stock / Discover row (unchanged on the Research home). The 52-week note reads
"Price at N% of range".

**Left as is in E13:** the phone tab bar with "Filings" cut at the edge (subsequently addressed
by E15 without restoring the fade removed in `b7cf762`), and the full-width "Insufficient evidence"
financial card.

**Evidence — 2026-10-25:** AAPL page height 1,684 → 1,545px at 1440 and 2,119 → 2,006px at 390,
no overflow; Home/End on the focused chart move the readout and the frame shows an outline.

### E14 — Research price-chart measurement (R1)

**Why:** Measuring between two dates answers a daily reading question using existing chart data.
It has no provider, request, persistence or saved-record dependency. R3 would add a Calendar
request; M1 needs separate scoring-formula verification; M5 needs agreed publication cadences.

**Scope:** The V8 Overview price chart supports mouse/pen drag, a visible Measure button for
two-tap selection, and Shift + arrows on the existing keyboard date control. The shaded span
shows chronological dates, currency, amount and percentage change, and the inclusive count of
returned observations. Sparse data is never described as a complete session count. The original
full-range change and exact-values table remain available.

**Guardrails:** Measurements say "Exploring · not saved" and "Price change only; not total
return". Escape, a tap outside the chart section or Clear measurement exits. Changing range,
security, provider snapshot or reloading resets it. One-point/empty histories cannot measure;
a zero starting close has an amount but no percentage. No new fetches or storage writes.

**Verification:** Standard lane: lint, typecheck, harness, production build for browser QA,
and the consolidated `scripts/research-reading-qa.mjs` matrix with drag, touch, keyboard,
reset, currency and boundary states plus light/dark screenshots at 1280/768/375px.

**Evidence — 2026-10-25:** Lint, typecheck, harness, production build and the browser matrix
pass locally at `http://127.0.0.1:3000`. The 1280/768/375/320px run captures 22 visual states
and four interaction summaries in `.tmp/research-reading/after/report.json`. Light/dark span
and readout screenshots pass containment, overlap and overflow checks. Measurement causes no
API calls; no unexpected console/request errors remain. Expected service-worker blocking and
the deliberate 503 fixture are recorded separately. Independent review found a secondary-pointer
cleanup bug; a browser regression reproduced it before the pointer-ID guards and passes after
the fix. This is fixture-based local verification; live-provider availability, hardware touch
assistive technology and deployment are not established.

**Changed files:** `src/components/v8/ResearchV8ConnectedPanels.tsx`,
`src/components/v8/research-v8-connected.module.css`, `src/lib/research/reading-display.ts`,
`scripts/harness/research-reading-regression.mjs`, `scripts/research-reading-qa.mjs`,
`docs/TESTING.md`, `docs/V8_INTERACTION_IDEAS.md`, and this roadmap.

### E15 — Phone stock-page tab navigation (L3)

**Why:** Peers and Filings can sit beyond the phone's visible tab strip with no clear scroll
control. L3 is a bounded navigation improvement over existing data. L4's price-based Watchlist
sorting needs a separate data scope because the current home list only loads saved records.

**Scope:** At 600px and narrower, an overflowing stock-page tab strip has left/right scroll buttons with
44px targets and disabled end states. Native swipe scrolling remains available. Scrolling does
not select a tab or request data. The selected tab stays visible after keyboard selection,
deep links, Back/Forward and resizing, without automatically scrolling the page vertically.
The six public tabs and eight saved-stock Advanced tabs keep their labels, URLs and ARIA links.
No edge fade, new provider, dependency, saved preference or record mutation is added.

**Verification (2026-10-25):** Standard lane passed lint, typecheck, harness and a production build.
`scripts/research-tabs-qa.mjs` passed 808 assertions across 16 scenarios: 1280/768/375/320px,
light/dark, and six public/eight saved-stock tabs. All eight phone scenarios used real Chromium
touch gestures. Arrow end states, keyboard wrapping, Filings reload/history, selected-tab resize
visibility, ARIA links, 44px targets and overflow passed; scrolling did not select tabs or fetch
data, and navigation sent no mutations. No unexpected console or request failures occurred.
Sixteen baseline and 32 updated viewport screenshots plus geometry are under
`.tmp/research-tabs/`; visual comparison passed without restoring a fade. One independent source
review found no functional issue; the documented 600px boundary matches the existing breakpoint.
GitNexus's local index refresh failed, so impact review used current source and callers instead.
This is local fixture-based UI verification, not live-provider or deployment proof.

### E3 — Today promotion review

**Spec:** `NEXT_PRODUCT_ROADMAP.md` Task 0.

**Scope:** Read the Usage workspace funnel once the window has passed and decide whether Today
becomes the default Research workspace. Record the numbers; change no default inside this item.

**Done when:** The promotion thresholds are recorded as met or not met, with the decision.

### E4 — Forward-validation lab: discovery

**Spec:** `NEXT_PRODUCT_ROADMAP.md` Task 6, "Discovery gate".

**Scope:** A short design doc that freezes model/configuration version, eligible markets and modes,
cadence, horizons and benchmarks, missing-data policy, sample thresholds, drift policy and
non-prediction language.

**Done when:** The design doc is approved; no observations are collected before that.

### E5 — Forward-validation lab: first slice

**Spec:** `NEXT_PRODUCT_ROADMAP.md` Task 6, "Minimum valuable slice".

**Done when:** Task 6 acceptance criteria pass.

### E6 — Corporate-action resolution assistant

**Spec:** `NEXT_PRODUCT_ROADMAP.md` Task 7. First slice is splits, reverse splits and symbol
changes only, as additive, reversible overlays.

### E7 — Malaysia primary-source parity

**Spec:** `NEXT_PRODUCT_ROADMAP.md` Task 8. Starts with exchange announcements once a provider
contract is recorded.

## Update Record

| Date | Item | From | To | Evidence |
| --- | --- | --- | --- | --- |
| 2026-10-22 | — | — | — | Roadmap created after PR #29 and `0779864`. |
| 2026-10-22 | E1 | Ready | Verified | 52-week label placement fixed; see E1 evidence. |
| 2026-10-22 | E2 | Ready | Verified | Pins and Queue/Calendar badges; 375px not browser-checked. |
| 2026-10-22 | E8 | — | In progress | Added after E2 at the owner's request. |
| 2026-10-22 | E1 | Verified | Verified | Saved light/dark matrix closes the marker gap; mobile annotation overlap fixed in PR #33. |
| 2026-10-22 | E2 | Verified | Verified | Pins and loaded-only overdue Calendar badges pass all three widths in both cockpit themes. |
| 2026-10-22 | E8 | In progress | Verified | PR #30 merged; follow-up storage recovery and 25-scenario acceptance pass in PR #33. |
| 2026-10-22 | E9 | — | In progress | Added after E8 at the owner's request. |
| 2026-10-23 | E9 | In progress | Verified | PR #34 merged; Market "what moved" bundle verified in harness and browser. |
| 2026-10-23 | E10 | — | Verified | V8 Research decision context (multi-year trend bars, plan vs price ruler, historical filing multiples) implemented and verified. |
| 2026-10-23 | E11 | — | Verified | V8 Research unit profitability margins, balance-sheet cushion and share dilution trajectory implemented and verified. |
| 2026-10-25 | E12 | — | Verified | Calendar week window and per-kind marks, Market outcome figures, column alignment and title size; Discover reopen fix. |
| 2026-10-25 | E13 | — | Verified | Stock page chart top padding, keyboard-only date control, workspace line in the tool row. |
| 2026-10-25 | E14 | — | Verified | R1 temporary chart measurement; drag/tap/keyboard, pointer isolation, reset and arithmetic regressions; local Standard checks pass. |
