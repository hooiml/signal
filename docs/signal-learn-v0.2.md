# Signal Learn v0.2 — Business Foundations

## Scope

v0.2 extends the verified v0.1 valuation path with a separate **Understand the business** track. It teaches the business drivers behind earnings and valuation rather than adding another stock score.

Modules:

1. Revenue
2. Income statement
3. Margins and operating leverage
4. Balance sheet
5. Cash flow and free cash flow
6. Debt and financial resilience
7. ROIC and capital efficiency
8. Dilution and buybacks
9. Connecting the statements

## Learning surfaces

### Concept track

`BusinessTrackV2` includes an interactive financial-driver lab. Learners can change revenue, gross margin, operating expenses, interest expense, tax, diluted shares, operating cash flow, CapEx, debt, cash, and invested capital, then inspect how those inputs change operating income, net income, EPS, FCF, net debt, interest coverage, and a simplified learning ROIC.

The ROIC exercise is explicitly labeled as simplified after-tax operating income divided by invested capital. It is a teaching model, not a provider-reported ROIC value.

### Apply Today

`BusinessApplyV2` reuses the validated Research snapshot boundary. It shows current reported business evidence across five lenses:

- growth;
- profitability;
- cash generation;
- balance sheet;
- per-share economics.

The annual history table uses the bounded `fundamentals.history` already normalized by Research. Missing values remain unavailable and source/fetched/reporting-period provenance is visible.

### Business Replay

`GET /api/learn/business-replay/[symbol]?market=US` selects a filing-aligned historical checkpoint from the existing historical valuation service. The initial response contains only the selected observation.

`POST /api/learn/business-replay/[symbol]` requires the learner to commit:

- interpretation;
- confidence;
- supporting evidence;
- contrary evidence;
- invalidation condition.

Only after that commitment does the server return the next filing checkpoint. The client does not receive the later annual revenue, net income, FCF, or P/E before commitment.

## Data boundaries

- US point-in-time replay reuses the existing SEC/Yahoo filing-aligned historical valuation contract.
- Malaysia business replay remains unavailable because the repository has no approved point-in-time Malaysia fundamentals source.
- Analyst estimate/revision history remains unavailable and is not fabricated.
- Current business evidence reuses the existing Research snapshot and its provenance/gap behavior.
- No v0.2 surface creates a Buy/Sell rating or silently mutates a Research record.

## Verification

Required release gate:

```powershell
npm run typecheck
npm run lint
npm run harness
npm run build
npm run qa:learn
npm run qa:learn-v02
```

`qa:learn` preserves the complete v0.1 regression contract. `qa:learn-v02` runs Chromium at 1280px, 768px, and 375px and verifies the business driver calculation, current annual history/provenance, server-side future-data lock/reveal behavior, commitment payload, horizontal overflow, and browser-error boundary.

v0.2 is not considered complete until all of these checks pass from a clean branch checkout.
