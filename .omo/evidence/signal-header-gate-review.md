# Signal Header Final Gate Review

## recommendation

REVISE

## blockers

1. **violatedCriterion:** `SC-MOBILE-PRIMARY-NAV` — The shared header must remain fully usable and visually intact at 375px, including keyboard/focus accessibility for every primary navigation item.
   **observation:** On both fresh mobile captures, `Analytics` is visibly clipped to `Analy`. Independent runtime geometry reproduced the cause: the nav viewport ends at x=279 while the Analytics link ends at x=304.1; focusing the link left `scrollLeft=0`, so 25.1px remained outside the visible nav viewport.
   **evidencePointer:** `.tmp/signal-header-qa-v2/fresh-main-mobile.png`; `.tmp/signal-header-qa-v2/fresh-research-mobile.png`; `src/components/v6/AppNavV6.tsx:43-64`; independent Playwright matrix run in the final-gate session.

2. **violatedCriterion:** `SC-FRESH-VISUAL-EVIDENCE` — The six fresh screenshots used for visual approval must be settled, internally consistent captures of the current build.
   **observation:** `fresh-main-tablet.png` is globally washed out and does not match the other five dark-theme captures or the independently reproduced current tablet render. Its sampled mean RGB is materially brighter than the live render; the live route remained dark, HTTP 200, and issue-free. This is an evidence/capture defect, not proof of a product-theme failure, but it prevents a strict six-capture PASS.
   **evidencePointer:** `.tmp/signal-header-qa-v2/fresh-main-tablet.png`; `.tmp/signal-header-qa-v2/main-tablet.png`; `.tmp/signal-header-qa-v2/fresh-report.json`; independent in-memory Playwright screenshot statistics from `http://127.0.0.1:3002/` at 768x1024.

## originalIntent

Make the main-page header use the same expanded/centered alignment as Research, and replace the header Light/Dark segmented text control with a reference-like sliding toggle shared by `/` and `/research`.

## desiredOutcome

- One real shared header implementation owns wordmark, primary nav, theme toggle, route controls, token mapping, and bottom hairline.
- `/` and `/research` align to the same 1280px shell and remain usable at 1280px, 768px, and 375px.
- The 52x28 control behaves as an accessible sliding toggle with visible focus, keyboard activation, destination label, and state-dependent thumb position.
- Active navigation, document overflow containment, and route-owned controls remain correct.
- All six fresh screenshots are settled and trustworthy.

## userOutcomeReview

The implementation is substantially real and reusable, not a raster fake or one-route mock. `AppNavV6` owns the shared shell and token variables; both dashboards render through it; `ThemeModeSwitchV2` owns the header toggle variant; and `ThemeProviderV6` owns shared state and persistence. Desktop and tablet geometry, active nav, bottom hairline, contained command-row overflow, toggle semantics, and actual state changes reproduce correctly. Approval is withheld because the mobile primary nav is visibly clipped on both routes and one required fresh capture is not a settled representation of the current tablet render.

## verdictSummary

- **VERDICT:** REVISE
- **CONFIDENCE:** HIGH
- **SUMMARY:** Core ownership, alignment, tokens, toggle semantics, and route behavior are sound. Fix the 375px primary-nav clipping and replace the washed-out Market tablet capture with a settled dark-theme screenshot before requesting PASS.

## whatIsGood

- `AppNavV6` is the single shared owner for `/` and `/research`, with route-owned children below the common top row.
- Header CSS variables centralize border, success fill, on-success, text, and radius values; the toggle consumes those variables.
- `/` and `/research` both resolve through the V6 dashboards and shared theme provider.
- At 1280px, both routes reproduce inner bounds x=24..1256 and width 1232.
- The Market command row is one non-wrapping, horizontally contained scroller at 768px and 375px; document width remains equal to viewport width.
- The toggle is a native 52x28 button. `aria-pressed` and destination label change, the thumb moves 24px, Space and Enter both activate it, focus remains on the control, and the focus outline computes to 2px solid.
- Active navigation is correct: Market on `/`, Research on `/research`.
- The transparent shared header renders a single bottom border; the authored 0.5px hairline computes to one device-aligned CSS pixel in Chromium.
- The reference-like anatomy is present: bordered pill track, one circular thumb, mode glyph, and horizontal sliding state.

## findings

- **[product] HIGH — mobile nav clipping:** Both 375px screenshots show `Analy`; runtime geometry proves Analytics extends 25.1px beyond the nav viewport and focus did not bring it fully into view. Fix the mobile spacing/layout or guarantee focus-driven reveal.
- **[evidence] HIGH — unsettled Market tablet capture:** The fresh 768px Market screenshot is visibly washed out, while the current live render is normal dark and issue-free. Re-capture after all theme/color transitions settle.
- **[evidence] NOTE — lone `ERR_ABORTED`:** The abort is a cleanup/route-teardown artifact, not a product HTTP failure. It reproduced only for the final Research mobile inbox POST while the route itself returned 200 and rendered populated inbox content; `consoleIssues`, `pageErrors`, and HTTP response issues remained empty.
- **[product] NOTE — internal command scroller:** Market controls intentionally exceed the 768px/375px viewport and remain reachable through their local horizontal scroller. This does not create document-level overflow.
- **[maintenance] NOTE — module size:** `ResearchDashboardV6.tsx` is 297 pure LOC, above the programming-skill ceiling, but it is broader pre-existing/concurrent research behavior and does not cause the header criterion failures.

## blocking

- Make all three primary-nav labels fully visible or reliably focus-revealed at 375px on both routes.
- Replace `fresh-main-tablet.png` with a settled current-build capture matching the dark state recorded by its toggle semantics.

## directRemoveAiSlopsPass

- No new test files were introduced for this change, so there are no deletion-only, removal-assertion, tautological, implementation-mirroring, or excessive-test blockers.
- No pasted screenshot/background-image fake, speculative parser/normalizer, dependency, dead wrapper, debug logging, broad catch, or type escape hatch was found in the scoped header implementation.
- The shared header and toggle variant correspond directly to the two-route reuse requirement; they are not needless abstractions.
- `MarketCommandBarV6` is 167 pure LOC. Its local helpers support repeated SVG/meta structures and do not create criterion-breaking indirection.

## directProgrammingPass

- Native button/link semantics, focus styles, keyboard activation, route wiring, state ownership, and responsive overflow were traced and reproduced.
- No `any`, `as any`, `as unknown`, non-null assertion, `@ts-ignore`, or `@ts-expect-error` appears in the scoped header change.
- The mobile clipping is a functional/accessibility presentation defect despite correct DOM labels and link semantics.

## codeReviewReportCoverage

No dedicated current code-review report was found. `.omo/evidence/signal-header-ui-gate-review.md` is an older gate artifact that includes programming/slop sections but refers to the prior segmented-toggle intent and older screenshot directory, so it is not accepted as current proof. This report performs the required programming and overfit/slop passes directly.

## checkedArtifactPaths

- `src/components/ThemeModeSwitchV2.tsx`
- `src/components/v6/AppNavV6.tsx`
- `src/components/v6/MarketCommandBarV6.tsx`
- `src/components/v6/ResearchHeaderV6.tsx`
- `src/components/v6/MarketDashboardV6.tsx`
- `src/components/v6/ResearchDashboardV6.tsx`
- `src/components/v6/ThemeProviderV6.tsx`
- `src/components/v6/DESIGN.md`
- `src/app/page.tsx`
- `src/app/research/page.tsx`
- `docs/TESTING.md`
- `docs/QUALITY.md`
- `.tmp/signal-header-qa-v2/fresh-report.json`
- all six `.tmp/signal-header-qa-v2/fresh-*.png` captures
- `C:/Users/USER/AppData/Local/Temp/codex-clipboard-eecc1398-b855-4c59-98a3-bba5b6627e3f.png`
- `.omo/evidence/signal-header-ui-gate-review.md`
- `.omo/notepad.md` (missing)

## exactEvidenceGaps

- ULW plan is missing; direct CLI returned `ULW_LOOP_PLAN_MISSING`, so the fallback report location is used.
- No dedicated current code-review report exists.
- `.omo/notepad.md` is missing.
- No persisted motion-frame sequence exists for the toggle; runtime geometry and keyboard state transitions prove the slide, but the submitted six screenshots show only the dark resting state.
- One of the six required fresh captures is unsettled/inconsistent and must be replaced.

