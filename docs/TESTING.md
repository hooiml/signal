# Testing And Verification

Run the smallest verification set that proves the change, then expand when shared behavior or API contracts changed.

## Standard Verification

```powershell
npm run lint
npm run typecheck
npm run harness
```

For docs-only or harness-metadata changes, `npm run harness` is the minimum proof. Run the full standard set when TypeScript, routes, shared contracts, or runtime behavior changed.

## Build Verification

Run this before completing framework, route, dependency, or deployment-related changes:

```powershell
npm run build
```

## Browser Verification

For UI changes:

```powershell
npm run dev
```

Then open `http://localhost:3000` and check:

- dashboard loads without runtime console errors
- market toggle still changes the signal request
- mode toggle still changes interpretation
- social toggle still affects the signal request
- desktop and mobile layouts do not overlap text or controls

## API Smoke Checks

Use these when touching API routes or signal services:

```powershell
Invoke-RestMethod "http://localhost:3000/api/signals/v2?market=US&mode=standard&enableSocial=true"
Invoke-RestMethod "http://localhost:3000/api/signals/v2?market=MY&mode=contrarian&enableSocial=false"
```

Invalid request parameters should return a structured error instead of falling into service code.

## Current Test Gap

There is no dedicated unit test runner configured yet. Until one is added, lint, typecheck, build, harness checks, API smoke tests, and browser checks are the available verification surfaces.

## Harness And Eval Evidence

Follow `docs/HARNESS.md` for harness design. Future Codex or agent evals should keep raw traces and run artifacts under `.tmp/`, use deterministic checks first, and promote curated fixtures only when they are stable enough to review.
