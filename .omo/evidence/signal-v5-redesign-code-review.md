# Signal V5 Redesign Code Review

## Verdict

FAIL

codeQualityStatus: BLOCK
recommendation: REQUEST_CHANGES

## Scope Reviewed

- `src/components/v5/v5-shared.tsx`
- `src/components/v5/MarketDashboardV5.tsx`
- `src/components/v5/ResearchDashboardV5.tsx`
- `src/components/v5/TickerDetail.tsx`
- `src/components/v5/Sparkline.tsx`
- `src/components/v5/EvidenceTable.tsx`
- `src/components/v5/DESIGN.md`
- `src/app/main-v5/page.tsx`
- `src/app/research-v5/page.tsx`

Unrelated dirty V1-V4/user files were not reviewed as standalone changes. `src/components/research/ResearchDashboardV2.tsx` was consulted only because V5 imports runtime data/types from it.

## Skill-Perspective Check

- `remove-ai-slops` was loaded from `C:/Users/USER/.codex/plugins/cache/sisyphuslabs/omo/4.16.2/skills/remove-ai-slops/SKILL.md`.
- `programming` was loaded from `C:/Users/USER/.codex/plugins/cache/sisyphuslabs/omo/4.16.2/skills/programming/SKILL.md`, plus the TypeScript reference README.
- The TypeScript no-excuse checker script was located, but not executed because `bun` is not installed in this environment.
- The diff violates both perspectives:
  - `remove-ai-slops`: oversized new production modules, obvious narration comments, and UI/data coupling that should be simplified before approval.
  - `programming`: oversized files, mutable interface/type shapes in new TSX, boundary parsing that is shallow rather than schema-backed, and behavior logic that is not locked by tests.

## CRITICAL

None found.

## HIGH

1. Research V5 shows incorrect investment actions for current data.
   - `src/components/v5/ResearchDashboardV5.tsx:55` to `src/components/v5/ResearchDashboardV5.tsx:62`
   - `src/components/v5/TickerDetail.tsx:97` to `src/components/v5/TickerDetail.tsx:104`
   - `computeActionLabelV5` returns `DCA` for any owned, high-thesis, core-quality item whose `valuationState` is not `expensive`; it does not require `inBuyZone` or `checklist.valuationReasonable`. With the current MSFT record, V5 renders `DCA` while the detail panel simultaneously says `Outside Buy Zone` and "Hold the position." That is contradictory in the first-look decision surface and a regression from the prior readiness rule that waits when valuation is not reasonable.

2. Strategy filters do not filter the action labels shown to users.
   - `src/components/v5/ResearchDashboardV5.tsx:13`
   - `src/components/v5/ResearchDashboardV5.tsx:15` to `src/components/v5/ResearchDashboardV5.tsx:32`
   - `src/components/v5/ResearchDashboardV5.tsx:200` to `src/components/v5/ResearchDashboardV5.tsx:211`
   - `src/components/v5/ResearchDashboardV5.tsx:229`
   - The UI says "Show actions" and every card displays `computeActionLabelV5`, but filtering uses legacy `item.status` / `positionState`. Live probe on `research-v5`: `watch` showed `VOO...Ready` and `MAYBANK...Wait`, `waiting` showed `NVDA...Avoid`, and `avoid` showed only `NET...Avoid`, excluding the visible `NVDA` Avoid action. This breaks the core research workflow.

3. New V5 modules exceed the required maintainability ceiling.
   - `src/components/v5/MarketDashboardV5.tsx:19` to `src/components/v5/MarketDashboardV5.tsx:577`
   - `src/components/v5/TickerDetail.tsx:57` to `src/components/v5/TickerDetail.tsx:450`
   - Pure LOC measured locally: `MarketDashboardV5.tsx` 530, `TickerDetail.tsx` 418. The required programming/remove-ai-slops perspective treats >250 pure LOC as an architectural defect. These files combine fetching, state machines, derivation logic, view rendering, tabs, and dense content sections, making behavior bugs like the action/filter mismatch harder to catch.

4. V5 research is coupled to V2 internals.
   - `src/components/v5/ResearchDashboardV5.tsx:5`
   - Importing `watchlist` at runtime from `../research/ResearchDashboardV2` makes V5 depend on a V2 component module rather than a shared data/domain module. It pulls V2 implementation concerns into the V5 route and makes dirty V2 changes affect the V5 redesign, which is exactly the boundary the review scope is trying to keep clean.

## MEDIUM

1. Keyboard and screen-reader tab semantics are incomplete.
   - `src/components/v5/MarketDashboardV5.tsx:287` to `src/components/v5/MarketDashboardV5.tsx:295`
   - `src/components/v5/TickerDetail.tsx:140` to `src/components/v5/TickerDetail.tsx:148`
   - `src/components/v5/EvidenceTable.tsx:127` to `src/components/v5/EvidenceTable.tsx:131`
   - Market tabs use `role="tab"` without `aria-controls`, `id`, `tabpanel`, roving focus, or arrow-key behavior. Ticker tabs are plain buttons with no selected state announced. Several controls remove outlines with `focus:outline-none` and do not add a replacement focus-visible style, reducing keyboard usability.

2. Main V5 route has no page-level heading.
   - `src/components/v5/MarketDashboardV5.tsx:324` to `src/components/v5/MarketDashboardV5.tsx:326`
   - Browser metrics showed no `h1` on `/main-v5`. The primary market headline is a paragraph, so assistive-tech users do not get a clear page landmark/heading equivalent.

3. There is no regression coverage for the new decision and filter behavior.
   - `src/components/v5/ResearchDashboardV5.tsx:37` to `src/components/v5/ResearchDashboardV5.tsx:81`
   - The repo currently has no dedicated unit test runner, but the new exported `computeActionLabelV5` and filter behavior are pure enough to cover once a runner exists. The lack of behavioral coverage allowed contradictory `DCA`/hold and action-filter mismatches through lint/typecheck.

## LOW

1. Several Tailwind classes are invalid or undefined polish hooks.
   - `src/components/v5/v5-shared.tsx:142`
   - `src/components/v5/v5-shared.tsx:150`
   - `src/components/v5/MarketDashboardV5.tsx:274`
   - `src/components/v5/MarketDashboardV5.tsx:477`
   - `src/components/v5/MarketDashboardV5.tsx:525`
   - `src/components/v5/EvidenceTable.tsx:144`
   - `src/components/v5/EvidenceTable.tsx:153`
   - `src/components/v5/EvidenceTable.tsx:188`
   - Examples: `bg-zinc-150`, `border-zinc-350`, `text-zinc-650`, `-ml-1.75`, and `h-5.5` are not standard Tailwind scale classes in this project. `animate-fadeIn` is used repeatedly but no matching animation exists in `src/app/globals.css`.

2. `DESIGN.md` promises reduced-motion behavior that the implementation does not provide.
   - `src/components/v5/DESIGN.md:70` to `src/components/v5/DESIGN.md:75`
   - The components include transitions and animation class hooks, but there is no visible reduced-motion implementation in the V5 code or global CSS.

## Verification Performed

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run harness`: passed, with existing large-file warnings including `src/components/v5/MarketDashboardV5.tsx`.
- Inspected prior browser QA artifacts under `.omo/evidence/signal-v5-browser-qa` and viewed mobile screenshots for `/main-v5` and `/research-v5`.
- Ran a live Playwright probe against the already-running local server:
  - `/research-v5` action filters reproduced the mismatch: `watch` showed Ready/Wait, `waiting` showed Avoid, `avoid` excluded one visible Avoid item.
  - `/main-v5` tab buttons were clickable in the probe; I did not carry forward the prior targeted artifact's tab-click timeout as a finding.

## Blockers

- Fix the action-label rules so displayed decisions match buy-zone/valuation state and next-action copy.
- Make the research filters operate on the same action labels the UI displays, or relabel the filters so they accurately describe legacy status filtering.
- Split oversized V5 components by responsibility before approval.
- Remove the runtime dependency on the V2 dashboard module for V5 research data/types.

