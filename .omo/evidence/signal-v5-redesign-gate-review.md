# Signal V5 Redesign Gate Review

## recommendation

REJECT

## originalIntent

Verify the completed Signal V5 redesign against the user's request for a substantially more visually appealing, easy-to-understand UI, scoped to `src/components/v5`, `src/app/main-v5`, and `src/app/research-v5`.

## desiredOutcome

The shipped V5 routes should provide a visually stronger, decision-first market/research UI with responsive desktop/mobile behavior, no new dependencies, V1-V4 untouched, and enough evidence to support release confidence.

## userOutcomeReview

The browser screenshots show the requested ink-and-lime console identity, dark market signal field, data visualization, research command bar, vertical desktop watchlist, and action-focused dossier. From a visual/user outcome perspective, the V5 direction is materially more distinctive and understandable than a plain dashboard.

The current working tree still cannot be approved because the artifact is not isolated to V5 and violates required maintainability/slop criteria.

## blockers

1. V1-V4 untouched constraint is not satisfied.
   - `git status --short` shows `M src/components/research/ResearchDashboardV2.tsx`.
   - The diff exports V2 types/data and adds V5-only fields (`order`, `positionState`, `inBuyZone`) to V2 watchlist records.
   - `src/components/v5/ResearchDashboardV5.tsx:5` imports `watchlist` and `ResearchWatchlistItem` from `../research/ResearchDashboardV2`, coupling V5 to V2 internals instead of keeping V5 isolated.
   - `git ls-files --others --exclude-standard` also shows untracked V4 artifacts: `src/app/main-v4/page.tsx`, `src/app/research-v4/page.tsx`, `src/components/v4/*`, and `docs/signal-v4-decisions.md`.

2. Required programming/remove-ai-slops criteria are not met for new production code.
   - Pure LOC measurement:
     - `src/components/v5/MarketDashboardV5.tsx`: 530 pure LOC.
     - `src/components/v5/TickerDetail.tsx`: 418 pure LOC.
   - The required programming criteria treat files over 250 pure LOC as an architectural defect requiring responsibility-based split, not a style preference.
   - Direct slop pass also found obvious explanatory comments in production code, for example `MarketDashboardV5.tsx:27`, `MarketDashboardV5.tsx:30`, `MarketDashboardV5.tsx:96`, `MarketDashboardV5.tsx:115`, `MarketDashboardV5.tsx:129`, `MarketDashboardV5.tsx:163`, and `TickerDetail.tsx:75`, indicating cleanup was not completed.

3. Evidence package is incomplete for final approval.
   - Available `.omo/evidence` contains browser QA screenshots/runtime JSON only.
   - No explicit code review report was found showing programming + remove-ai-slops coverage.
   - No manual QA matrix/notepad handoff artifact was found beyond `.omo/evidence/signal-v5-browser-qa/summary.json`.
   - No regression/unit test artifact covers the new `computeActionLabelV5`, filtering, selection, or V2 data-shape export behavior.

## checkedArtifactPaths

- `src/app/main-v5/page.tsx`
- `src/app/research-v5/page.tsx`
- `src/components/v5/MarketDashboardV5.tsx`
- `src/components/v5/ResearchDashboardV5.tsx`
- `src/components/v5/TickerDetail.tsx`
- `src/components/v5/EvidenceTable.tsx`
- `src/components/v5/Sparkline.tsx`
- `src/components/v5/v5-shared.tsx`
- `src/components/v5/DESIGN.md`
- `src/components/research/ResearchDashboardV2.tsx`
- `.omo/evidence/signal-v5-browser-qa/summary.json`
- `.omo/evidence/signal-v5-browser-qa/main-v5-desktop-initial.png`
- `.omo/evidence/signal-v5-browser-qa/main-v5-mobile-initial.png`
- `.omo/evidence/signal-v5-browser-qa/research-v5-desktop-initial.png`
- `.omo/evidence/signal-v5-browser-qa/research-v5-mobile-initial.png`
- `package.json`
- `docs/TESTING.md`
- `C:/Users/USER/.codex/plugins/cache/sisyphuslabs/omo/4.16.2/skills/remove-ai-slops/SKILL.md`
- `C:/Users/USER/.codex/plugins/cache/sisyphuslabs/omo/4.16.2/skills/programming/SKILL.md`

## verification

- `npm run lint`: pass.
- `npm run typecheck`: pass.
- `npm run build`: pass; `/main-v5` and `/research-v5` generated.
- Browser QA summary: desktop/mobile `horizontalOverflowPx` is 0 for `main-v5` and `research-v5`.
- Browser QA summary: no page errors; research route has one `net::ERR_ABORTED` `_rsc` request during interaction/navigation, treated as non-blocking because screenshots/rendered states are intact.
- `package.json` and lockfiles are unchanged in `git status`, so no new dependency change was detected.

## exactEvidenceGaps

- Missing explicit final code review report with supported programming/remove-ai-slops coverage.
- Missing manual QA matrix artifact beyond browser screenshot/runtime summaries.
- Missing regression test evidence for new decision/filtering behavior and V2 data-shape export changes.
- Cannot certify V1-V4 untouched while V2 is modified and V4 files are present as untracked artifacts in the current working tree.
