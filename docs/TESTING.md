# Testing And Verification

Run the smallest verification set that proves the change, then expand when shared behavior or API contracts changed.

## Standard Verification

```powershell
npm run lint
npm run typecheck
npm run harness
npm run test:research
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

Research journal API smoke checks should cover list, create, patch, invalid input, and delete through `/api/research/watchlist`.

Free-source research smoke checks should cover a US symbol with derived valuation, a Malaysia symbol with unavailable valuation, and an invalid market through `/api/research/symbol/[symbol]`. Configure `SEC_USER_AGENT` with an app name and contact email before testing SEC EDGAR.

Trend discovery smoke checks should verify `/api/research/discovery` returns no more than ten leaders, ten contenders, and eight early trends; excludes high-risk and fundamentally unsupported results; preserves unconfirmed SEC coverage; reports scan and history coverage; returns nullable cohort performance and catalysts; and renders score, sector, valuation, upcoming-earnings evidence, contender reasons, and the collapsed/expanded contender state at desktop and mobile widths. Sector, risk, trend-stage, and valuation filters should combine with AND semantics, preserve original ranks, update the visible count, filter Contenders, and restore the full scan when reset.

Research alert smoke checks should POST valid US and Malaysia ticker inputs, reject an invalid symbol with `400`, and render risk/opportunity/watch conditions at desktop and mobile widths.

Research comparison smoke checks should select one, two, and three watchlist securities; disable a fourth selection; render live metrics and explicit unavailable states; open a compared ticker back in Research; and keep the table inside its own scroller without document-level overflow at desktop and mobile widths. The research journal should expose the persisted bear case plus buy and sell triggers.

## Current Test Gap

There is no dedicated unit test runner configured yet. Until one is added, lint, typecheck, build, harness checks, API smoke tests, and browser checks are the available verification surfaces.

## Harness And Eval Evidence

Follow `docs/HARNESS.md` for harness design. Future Codex or agent evals should keep raw traces and run artifacts under `.tmp/`, use deterministic checks first, and promote curated fixtures only when they are stable enough to review.
