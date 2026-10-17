# Quality Rules

These rules capture repo taste as mechanical, repeatable guidance for future agent runs.

## Agent Legibility

- Keep `AGENTS.md` short and use it as a table of contents.
- Put durable project knowledge in `docs`.
- Put generated facts in `docs/generated`.
- Keep docs linked to actual files, scripts, and commands.
- Prefer explicit names over clever or compressed abstractions.
- Follow `docs/HARNESS.md` when adding or changing repo knowledge checks.

## Code Boundaries

- Validate request inputs in API route handlers before service calls.
- Keep market scoring and confidence calculations in `src/lib`.
- Keep dashboard components focused on presentation and typed payload rendering.
- Prefer shared helpers in `src/lib` when multiple routes or services need the same behavior.
- Avoid new dependencies unless they remove meaningful complexity and are documented in the change.

## Data Quality

- Treat external data as unreliable until validated, normalized, or guarded.
- Preserve source freshness and coverage metadata when changing signal outputs.
- Do not hide degraded or limited source coverage from the UI.
- Keep confidence wording clear that it means indicator agreement, not forecast accuracy.
- Historical financial calculations must retain fiscal period, filing availability, price date, units, source links, formulas, split convention, and per-input gaps. Never pair a historical price with current fundamentals or use a filing fact before it became public.

## Cleanup Policy

- Prefer deletion over new layers when removing stale code.
- Split cleanup into small, reviewable changes.
- Add or update docs when a cleanup changes an established pattern.
- Promote repeated review feedback into docs or harness checks.

## Harness Checks

Run:

```powershell
npm run harness
```

The harness currently checks:

- `AGENTS.md` links point to existing files
- required docs exist
- generated repo map is current
- large source files are visible as warnings

Harness checks should start deterministic and small. Keep early quality signals warning-first unless the failure is stable, actionable, and safe to block on.

## V8 Display Clarity


`node scripts/harness/display-clarity-regression.mjs` is included in the harness.
It checks display-only tier labels in both modes, single-source/unknown agreement,
compact monetary amounts, retained signs/unknown currencies, and annual comparisons.
Comparisons require a unique matching current period, matching current summary values,
matching source/currency, and adjacent annual endpoints 350–380 days apart. Missing,
ambiguous, incompatible and non-finite inputs are withheld. A zero/negative prior amount
permits an amount change but never a percentage. No scoring or assessment eligibility
rules change. Summary financial cards keep exact amounts and provider-reported growth
inside an explicit disclosure; quote and ratio formatting remain unchanged.

Run `node scripts/v8-display-qa.mjs` against an owned local production server
(`SIGNAL_QA_URL`, default localhost:3000). It blocks service workers and intercepts every
API with fixtures, rejects mutations, and captures Market, populated/missing Research,
Financials and saved-research navigation at 1440/768/390/320px. `--before` captures the
same baseline states without expecting the new copy and navigation. Output is in
`.tmp/display-clarity/before` or `after`. These are controlled local checks, not production
provider validation or usability-test results. Also run the existing `v81-ui-qa.mjs`,
`v81-presentation-qa.mjs` and `research-unsaved-qa.mjs` matrices.

The Research header now has separate Saved securities (selection) and Saved research
(current-security content) entry points. Saved research opens direct Thesis/Review
reading, editing links, the existing Advanced tools switch, and all existing workspace
links. Legacy advanced/tab URLs still restore. No notes are created by opening these
controls; unsaved reading remains available.
