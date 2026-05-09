# Quality Rules

These rules capture repo taste as mechanical, repeatable guidance for future agent runs.

## Agent Legibility

- Keep `AGENTS.md` short and use it as a table of contents.
- Put durable project knowledge in `docs`.
- Put generated facts in `docs/generated`.
- Keep docs linked to actual files, scripts, and commands.
- Prefer explicit names over clever or compressed abstractions.

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

