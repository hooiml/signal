# Signal Enhancement Roadmap

## Purpose

The working order for enhancements after the V8 UI/UX plan, so they can be delivered one at a time.
Each item is small enough for one branch and one pull request.

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
| E9 | Market "what moved" bundle | In progress | Standard | None; added after E8 at the owner's request |
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
V8.1 workflow retains the browser reports and screenshots through explicit artifact allowlists.

### E9 — Market "what moved" bundle

**Scope:** "Since your last visit" (browser-local, per market and mode, compared with the last
different snapshot), impact chips on observed inputs (`(score − 50) × weight` points), and a
coverage ring that splits score weight by input and freshness, with a legend that opens each input.

**Evidence — 2026-10-22:** Live US Momentum in Chrome: chips +9.5 / +0.9 / +0.4 pts plus 50 give
60.8 for a score of 61; first visit shows no note; a seeded 19 Oct visit shows "57 → 61 (+4) ·
VIX Index +3.4 pts · Put/call ratio −1.2 pts" and survives reload; ring legend opens AAII detail;
dark and light, 1100px and 375px without overflow. `market-last-visit-regression.mjs` covers impact
maths, malformed storage, baseline rotation and change ranking (in the harness).

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
