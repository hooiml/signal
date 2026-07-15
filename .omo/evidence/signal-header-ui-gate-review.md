# Signal Header UI Gate Review

## recommendation

APPROVE

## blockers

None.

## originalIntent

Apply the supplied Signal header design to the current main market page and research page without changing the user-facing purpose of either route.

## desiredOutcome

- `/` and `/research` use one shared transparent Signal app shell with a bottom hairline, compact `SIGNAL` wordmark, Market/Research/Analytics navigation, and a Light/Dark segmented toggle.
- The main market page adds one non-wrapping command row containing market pills, mode pills, dividers, a data-source icon/toggle/helper, snapshot information, and live status/refresh.
- The header remains usable at 1280px, 768px, and 375px without document-level horizontal overflow.
- `/research?workspace=discovery` presents Analytics as the active primary navigation item and opens Discovery.

## successCriteria

| ID | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| SC-1 | The current main and research routes render the shared header. | PASS | `src/app/page.tsx` renders `MarketDashboardV6`; `src/app/research/page.tsx` renders `ResearchDashboardV6`; both dashboards route through `AppNavV6`. The production build lists `/` and `/research`. |
| SC-2 | App shell is transparent, single-row, hairline-bordered, and shows `SIGNAL`. | PASS | `src/components/v6/AppNavV6.tsx:30-67`; direct Playwright computed transparent background at all nine route/width combinations, found one `SIGNAL` link, and found zero document overflow. The source applies `border-b-[0.5px]`; screenshots show the intended hairline. |
| SC-3 | Market/Research/Analytics navigation and Light/Dark segmented toggle are present and route-aware. | PASS | `src/components/v6/AppNavV6.tsx:23-64`; direct Playwright found all three labels and one theme toggle at every width, with Market active on `/`, Research on `/research`, and Analytics on discovery. Theme interaction changed the accessible mode label. |
| SC-4 | Main market header has one non-wrapping control row with all requested controls. | PASS | `src/components/v6/MarketCommandBarV6.tsx:69-133`; direct Playwright verified `display:flex`, `flex-wrap:nowrap`, market/mode pills, dividers, three icons including source/clock/refresh, source checkbox plus helper description, snapshot slot, status, and refresh control at 1280/768/375. Market, mode, and source interactions changed state. |
| SC-5 | Responsive layouts remain usable at 1280px, 768px, and 375px. | PASS | Six screenshots under `.tmp/signal-header-qa/` were visually inspected. Direct Playwright covered `/`, `/research`, and discovery at all three widths: HTTP 200, no console warnings/errors or page errors, and overflow delta `0`. |
| SC-6 | Discovery deep link opens the Analytics workspace. | PASS | `src/components/v6/ResearchDashboardV6.tsx:39-60,263-289`; direct Playwright found active `Analytics` and `#research-workspace-discovery` at all three widths. |

## userOutcomeReview

The shipped artifact satisfies the requested user-visible outcome. The current routes render the shared shell, the market controls retain their expected stateful behavior, the discovery deep link activates Analytics, and the supplied screenshots are consistent with the inspected implementation and reproduced runtime geometry. No material defect was found that violates a stated criterion.

## checkedArtifacts

### Production and design files

- `src/components/v6/AppNavV6.tsx`
- `src/components/v6/MarketCommandBarV6.tsx`
- `src/components/v6/MarketDashboardV6.tsx`
- `src/components/v6/ResearchHeaderV6.tsx`
- `src/components/v6/ResearchDashboardV6.tsx`
- `src/components/ThemeModeSwitchV2.tsx`
- `src/components/v6/DESIGN.md`
- `src/app/page.tsx`
- `src/app/research/page.tsx`
- `docs/TESTING.md`
- `docs/QUALITY.md`

### Visual evidence

- `.tmp/signal-header-qa/main-desktop.png`
- `.tmp/signal-header-qa/main-tablet.png`
- `.tmp/signal-header-qa/main-mobile.png`
- `.tmp/signal-header-qa/research-desktop.png`
- `.tmp/signal-header-qa/research-tablet.png`
- `.tmp/signal-header-qa/research-mobile.png`

### Reproduced verification

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run harness`: PASS; large-file warnings only
- `npm run test:research`: PASS
- `npm run build`: PASS
- `git diff --check -- <seven scoped files>`: PASS
- Direct Playwright matrix on an owned temporary production server: PASS for `/`, `/research`, and `/research?workspace=discovery` at 1280/768/375; HTTP 200, correct active nav, transparent header, zero document overflow, no console/page errors.
- Direct interactions: PASS for theme toggle, MY market pill, Contrarian mode pill, and data-source toggle.
- Owned temporary runtime was stopped; port 3002 was verified clean.

## removeAiSlopsDirectPass

- Scope was restricted to the seven user-named files; unrelated dirty-worktree changes were not attributed to this task.
- No tests were added for this header change, so there are no deletion-only, requested-removal, tautological, implementation-mirroring, or excessive-test blockers in scope.
- No `any`, `as any`, `as unknown`, `@ts-ignore`, `@ts-expect-error`, debug logging, empty catch, TODO, FIXME, or HACK patterns were found in the six TypeScript/TSX files.
- No dead wrapper, speculative production parser/normalizer, or unnecessary dependency was introduced for the header outcome.
- The shared `AppNavV6` and header variant of `ThemeModeSwitchV2` have multiple concrete consumers and directly implement the requested shared shell, so they are not needless abstractions.
- `MarketCommandBarV6` is 167 pure LOC and keeps the requested market controls in one component. Its nested source-impact formatting is a maintainability observation, not a stated-criterion failure.

## programmingDirectPass

- Typecheck, lint, build, route wiring, state interactions, and responsive runtime behavior were reproduced.
- No TypeScript escape hatches or new unsafe boundary behavior were found in the scoped header implementation.
- `ResearchDashboardV6.tsx` measures 297 pure LOC and exceeds the programming skill's 250-LOC ceiling. This is recorded as maintenance burden, but it is not a blocker under this gate because the stated success criteria concern the header outcome, and the oversized file contains broader pre-existing/concurrent research behavior beyond the header change.
- `MarketCommandBarV6` uses a large React props contract and a long render function. This is a non-blocking maintenance note; splitting it is not required to satisfy the supplied design.

## codeReviewReportCoverage

No current code-review report exists for this Signal header change. The only review reports found under `.omo/evidence` belong to the older Signal V5 redesign. Therefore no report could be confirmed to contain the required `remove-ai-slops` and `programming` perspectives. This gate review performed both passes directly over the scoped diff, production code, tests/harness inventory, and runtime behavior; under the fallback rule, the missing report does not block completion.

## exactEvidenceGaps

- ULW plan: missing. Direct `omo` Node CLI invocation returned `ULW_LOOP_PLAN_MISSING` for `.omo/ulw-loop/019f6517-cbc5-7b21-ab8b-2bb7fdbe2083/goals.json`; fallback report location is used.
- Current code-review report: missing after scanning `.omo` and `.tmp`.
- Manual-QA matrix/JSON for this header change: missing; only six PNG screenshots exist under `.tmp/signal-header-qa/`.
- Notepad: `.omo/notepad.md` is missing.
- Dedicated committed header regression test: none found. The direct Playwright matrix and interaction checks supply behavioral evidence, but they are not persisted as a reusable test artifact.

None of these gaps is tied to a user-stated success criterion, so each remains a NOTE rather than a blocker.

## notes

- The worktree contains many unrelated modified/untracked files. This review did not infer that those changes belong to the header task and did not use them as blockers.
- The direct runtime initially displayed the snapshot placeholder while the briefing request was in flight; the supplied completed screenshots show the loaded date, and the source/runtime both preserve the snapshot slot.

