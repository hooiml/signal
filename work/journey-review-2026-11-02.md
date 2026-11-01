# E25 and core journey review

Reviewed 2026-11-02 (Asia/Kuala_Lumpur). No production code changed.

## Scope and baseline

Local branch `codex/forward-validation-discovery`, HEAD `d0f49d4`.
Existing E4/E5 documentation and `.claude/` changes were preserved.
GitNexus index matches this source commit. Remote main was independently checked at
`0ecba40e3e5eef6a9a96ccc34dcfe772ab1b2a4d`, four commits ahead. GitHub comparison
shows Market brief changes and supporting files; the Research production files reviewed
here are unchanged. This is local fixture proof, not production/provider verification.

## E25: complete; summary status corrected

[PR #60](https://github.com/hooiml/signal/pull/60) is merged as
`b4caf33416e2d92d3965d96747ee98760d19dfd7`, present in local history.
[Main run 40625576966](https://github.com/hooiml/signal/actions/runs/40625576966)
reports both `validate` and `Visual comparisons` successful. The roadmap's remaining
Linux re-enrollment blocker was stale. Updated only its E25 summary and added a dated
reconciliation receipt. Historical receipts remain unchanged. Production runtime was
not live-verified.

## Main journey findings

No blocking functional defect was reproduced in the tested journey.

| Stage | Result |
| --- | --- |
| Find a stock | Name/ticker lookup, US/MY identity, late responses and market selection passed the unsaved Research suite. |
| Read evidence | Missing/partial data, source dates, errors/retry and responsive layouts passed. Provider truth is outside fixture coverage. |
| Save a stock | Explicit save and retry passed; bookmarking does not fabricate a decision or personal review. |
| Save a review | Editor preserves drafts on denied access, requires explicit retry, and creates one authored history entry after a successful fixture save. Plan currency validation passed. |
| Return to review | Due-review handoffs preserve symbol/market and separate-tab drafts; Watchlist scheduling/filtering and review links passed. Source also revalidates saved records on focus/visibility. |

### Recommended small polish before new features

1. **First-review action wording.** `ResearchV8Connected.tsx:512` shows
   `No personal review recorded.` beside `Open saved review (new tab)` for a newly
   bookmarked owner stock. Use a first-review action label for this state and retain
   the existing wording for an authored review. Reuse the same editor and explicit-save
   behavior. This is a source-confirmed wording mismatch, not a broken save operation.
2. **Evaluate Discover return continuity with users.** Selecting a candidate collapses
   Discover and removes its deep-link parameters (`ResearchDiscoverV8.tsx:54` and
   `ResearchV8Connected.tsx:355`). Reopening Discover works by design; an explicit return
   action may help repeated comparison. This is a usability hypothesis, not a required
   defect fix, and does not justify a redesign without observed friction.

The cross-route review editor is intentional and protects existing drafts. Do not replace
it or add an inline plan editor solely because the handoff exists. Guest bookmarks/notes
are intentionally separate from owner plans and scheduled reviews. Neither guest limits
nor the US-only discovery universe were classified as defects.

## Verification

Owned fixture server: `http://127.0.0.1:3000`. No live database writes or provider
verification; browser API data and mutations were synthetic fixtures.

- Production build and post-build `tsc --noEmit`: passed.
- Full `npm run harness`: passed after E25 documentation correction.
- `research-unsaved-qa.mjs`: passed at 1440, 1280, 768, 390 and 375px, including guest recovery.
- `research-provenance-qa.mjs`: passed 54 states at 1280/768/375px.
- `research-due-review-qa.mjs`: passed 21 scenarios.
- `watchlist-review-qa.mjs`: passed 19 scenarios.
- Fresh screenshots inspected for the Research evidence layout and editor-related surfaces.
- `git diff --check`: passed.

Logs: `.tmp/journey-review-build.log`, `.tmp/journey-typecheck.log`,
`.tmp/journey-review-harness.log`, `.tmp/journey-unsaved.log`,
`.tmp/journey-provenance.log`, `.tmp/journey-due-review.log`, `.tmp/journey-watchlist.log`.
Detailed JSON/screenshots are in `.tmp/current-assessment/browser`,
`.tmp/research-provenance/browser`, `.tmp/research-due-review`, and
`.tmp/watchlist-review/after`.

No commit, push, deployment or E5 activation. Further work should first reconcile the
four remote commits with the preserved local E4/E5 documents. No additional feature
is required to close E25; prioritize the small first-review wording improvement and
observe real-user completion before choosing E6 or R5.
