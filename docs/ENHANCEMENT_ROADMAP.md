# Signal Enhancement Roadmap

## Purpose

The working order for enhancements after the V8 UI/UX plan, so they can be delivered one at a time.
Each item is small enough for one branch and one pull request.

Full specifications for E3–E7 live in [`NEXT_PRODUCT_ROADMAP.md`](NEXT_PRODUCT_ROADMAP.md) (Tasks 0
and 5–8); this file only fixes their order and adds the near-term items. Product rules from that
roadmap ("Product Direction To Preserve") apply to every item here.

## Baseline — 2026-10-22

- All V8 UI/UX batches and V8-16 are verified ([`V8_UI_UX_ENHANCEMENT_PLAN.md`](V8_UI_UX_ENHANCEMENT_PLAN.md)).
- PRs up to #29 (price chart hover read-out, 52-week context and review markers) are merged.
- The duplicate review-marker fix landed directly on `main` as `0779864`.

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

**Not covered:** saved-review markers (owner access is not configured locally, so no saved record
loads) and dark theme (V8 has no dark styles).

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

**Not covered:** 375px browser check (the Browser pane was hidden, so the page could not hydrate);
the overdue-review badge in the browser (owner access is not configured locally, so no saved records
load); an alerts badge (alerts are fetched only inside the Alerts workspace, and E2 adds no fetches).

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
