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

For a large SEC filer such as MSFT, call the symbol route twice and confirm both responses retain SEC fundamentals without a `Failed to set Next.js data cache` terminal error. Raw Company Facts responses must remain uncached; the normalized fundamentals cache owns the six-hour reuse window.

Trend discovery smoke checks should verify `/api/research/discovery` returns no more than ten leaders, ten contenders, and eight early trends; excludes high-risk and fundamentally unsupported results; preserves unconfirmed SEC coverage; reports scan, history, and institutional-ownership coverage; returns nullable cohort performance, catalysts, and ownership evidence; and renders score, sector, valuation, upcoming-earnings evidence, dated top-buyer details, the ownership causation caveat, contender reasons, and the collapsed/expanded states at desktop and mobile widths. Sector, risk, trend-stage, and valuation filters should combine with AND semantics, preserve original ranks, update the visible count, filter Contenders, and restore the full scan when reset.

Research alert smoke checks should POST valid US and Malaysia ticker inputs, reject an invalid symbol with `400`, and render risk/opportunity/watch conditions at desktop and mobile widths.

Research inbox smoke checks should POST valid watchlist inputs with per-ticker monitoring rules, reject malformed review dates and out-of-range thresholds, render deterministic risk/opportunity, upcoming US earnings, stale reviews, and a distance-to-trigger label for every item. Preserve provider warnings without blocking Research; switch between All, Action needed, Upcoming, and Snoozed without another request; and open the selected ticker from every visible item at desktop and mobile widths. Mark one item seen, snooze another, reload to prove both browser-local states persist, wake the snoozed item, and verify a changed condition becomes unread with a prior-to-current comparison while the first check establishes a quiet baseline. From Manage, save an optional quick note with Reviewed today and verify it appends a server-owned snapshot, advances the review date, and removes the stale item. Change and restore monitoring thresholds with `mode: settings`, then verify the values persist without changing review history or `lastReviewedAt`. After two saved reviews, verify Saved thesis names the materially changed fields; before that, it must state that no prior comparison exists.

Market alert smoke checks should add a threshold condition, persist it across a reload, show whether it is monitoring or currently triggered, manually refresh the briefing and update the last-checked time, remove the condition, and keep rules separated by market, interpretation mode, and social-source setting. Rapid configuration changes must not allow an older response to replace the latest selection. These alerts are browser-local and are evaluated when the briefing refreshes; they do not imply background push delivery.

Research comparison smoke checks should select one, two, and three watchlist securities; disable a fourth selection; render live metrics and explicit unavailable states; open a compared ticker back in Research; and keep the table inside its own scroller without document-level overflow at desktop and mobile widths. The research journal should expose the persisted bear case plus buy and sell triggers.

Assisted research smoke checks should generate findings for a US symbol, show whether synthesis is AI-assisted or evidence-based, retain source links and reporting periods, accept one finding into its intended journal field without overwriting existing text, dismiss another finding, refresh the queue, and save the accepted draft. After reload, the accepted-evidence section must retain the finding and source links, while Review history must show a new timestamped snapshot and identify fields changed from the preceding review. Removing evidence before save must remove its provenance without silently deleting the journal text. With `KIMI_API_KEY` unavailable, the evidence-based fallback must remain usable. Malformed or source-less findings, unsafe source URLs, oversized evidence collections, and client-supplied review-history rewrites must be rejected or ignored at the boundary.

## Current Test Gap

There is no dedicated unit test runner configured yet. Until one is added, lint, typecheck, build, harness checks, API smoke tests, and browser checks are the available verification surfaces.

## Harness And Eval Evidence

Follow `docs/HARNESS.md` for harness design. Future Codex or agent evals should keep raw traces and run artifacts under `.tmp/`, use deterministic checks first, and promote curated fixtures only when they are stable enough to review.
