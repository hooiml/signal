# Signal Learn v0.3 — Investment Analysis

## Scope

v0.3 builds on the verified valuation and business-foundation tracks by adding a separate **Investment analysis** track. It teaches users to combine evidence into a falsifiable investment view rather than producing a stock rating.

Modules:

1. Valuation frameworks
2. Multiple expansion and compression
3. Business quality
4. Management and capital allocation
5. Interest rates and Treasury yields
6. Inflation and the economic cycle
7. Narrative and sentiment evidence
8. Catalysts
9. Investment thesis
10. Bull / Base / Bear scenarios
11. Portfolio construction
12. Investment risk
13. Behavioral finance
14. Decision journal

## Learning surface

`InvestmentTrackV3` covers the full module set. The multiple-change lab separates changes in EPS from changes in the valuation multiple so learners can see how improving business earnings can coexist with a weak price outcome when the multiple compresses.

Macro, narrative, quality, capital allocation, portfolio, and behavioral modules are evidence-first concept exercises. They do not introduce a live macro provider or deterministic market labels.

## Apply Today

`InvestmentApplyV3` reuses the existing validated Research snapshot for current facts. The workspace deliberately separates:

- reported/current facts;
- user-classified evidence;
- user-authored scenario assumptions;
- user-authored thesis and confidence.

The Evidence Board has four categories: Supports, Against, Context, and Unknown.

The Scenario Builder uses three explicit Bear/Base/Bull cases. Each case contains a learner-supplied EPS assumption, valuation-multiple assumption, probability, and note. Implied values are labeled as conditional assumptions rather than targets. Probabilities must sum to 100%; Signal never silently normalizes them.

The Thesis Builder requires:

- business;
- quality;
- growth;
- valuation;
- expectations;
- risks;
- contrary evidence;
- invalidation;
- confidence.

Catalysts are optional because a durable investment thesis does not require a near-term event.

A thesis cannot be committed while required fields are missing or scenario probabilities do not sum to 100%.

## Practice journal

Committed v0.3 decisions are stored only in a browser-local learning journal. They do not mutate the primary Research watchlist or review records.

The original decision entry is immutable. Later reflections are appended as separate update records so the learner cannot rewrite the original thesis after seeing later evidence.

## Historical investment replay

`InvestmentReplayV3` reuses the existing filing-aligned Business Replay API rather than creating a parallel historical-data provider.

Before reveal, the learner sees only the point-in-time filing checkpoint and learner-authored scenario assumptions. Historical analyst estimates are not fabricated.

The next filing remains server-side until the user commits:

- an interpretation;
- confidence;
- supporting evidence;
- contrary evidence;
- an invalidation condition.

After reveal, the user is asked to compare changes in business evidence and valuation with the assumptions recorded before the outcome was known.

## Data boundaries

- Current facts come from the existing Research snapshot and retain its provider/freshness/reporting-period limitations.
- Historical replay uses the existing SEC/Yahoo filing-aligned US contract.
- Malaysia point-in-time replay remains unavailable until an approved source exists.
- Historical analyst estimate/revision data remains unavailable.
- Scenario outputs are explicitly user assumptions.
- No live Treasury-yield or inflation value is invented inside Learn v0.3; those concepts remain educational until an approved reusable current-data contract is integrated.
- No automatic Buy/Sell rating is created.

## Verification

Required release gate:

```powershell
npm run typecheck
npm run lint
npm run harness
npm run build
npm run qa:learn
npm run qa:learn-v02
npm run qa:learn-v03
```

`qa:learn-v03` runs Chromium at 1280px, 768px, and 375px and verifies:

- multiple expansion/compression math;
- current-company identity and source provenance;
- incomplete-thesis blocking;
- explicit scenario probability totals;
- no silent probability normalization;
- required contrary evidence and invalidation;
- immutable learning-journal creation plus appended reflection;
- server-side historical future locking and reveal after commitment;
- responsive overflow and browser-error boundaries.

v0.3 is not considered complete until the native repository harness, all earlier Learn regressions, the clean production build, and the v0.3 browser suite pass from a clean checkout.
