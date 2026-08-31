# Signal Learn v0.2

Signal Learn v0.2 extends the valuation foundations into the business economics that produce earnings and cash flow.

## Product loop

`Understand -> Manipulate -> Compare -> Replay -> Commit -> Reveal -> Debrief -> Apply Live -> Reflect`

The release includes:

- nine modules covering revenue, statements, margins, cash flow, debt, ROIC, dilution, and integration;
- a Financials Lab with Income Statement, Balance Sheet, Cash Flow, Driver Tree, Historical Trend, and Compare views;
- a manipulable income-statement waterfall;
- row-level definitions and related-driver explanations;
- derived ratios with formulas, inputs, period context, and methodology version;
- three curated historical-pattern replay cases, with two reflections required for Interpret mastery;
- current-company analysis over the existing validated Research snapshot;
- independent browser-local Understand, Interpret, and Apply mastery.

## Data boundaries

Financials Lab datasets and business replay cases are curated educational scenarios. They are labeled as illustrative and are not claims about public issuers.

Current-company Apply uses `/api/research/symbol/[symbol]`. It exposes only values supported by that contract. Interest coverage, ROIC, and Forward P/E remain unavailable when the approved inputs do not exist.

Derived metrics use `learn-financials-v0.2`. The UI exposes their formulas and inputs. Missing inputs produce `Unavailable`; they are not normalized or inferred.

## Replay boundary

`GET /api/learn/business-replay/[caseId]` returns one financial snapshot and its known-as-of date. The next snapshot is held in a server-only module.

The learner must POST:

- business direction;
- bounded confidence;
- primary driver;
- contrary evidence;
- valuation implication.

Only a valid commitment reveals the immediate next report. The original reasoning remains visible and the debrief evaluates reasoning quality rather than treating the later price as proof.

## Compatibility

v0.1 remains selectable on `/learn` and continues to use `signal-learn-v0.1-progress`. v0.2 uses `signal-learn-v0.2-progress` with a version-2 parser. Neither contract reads or overwrites the other.

v0.2 adds no server-side learner profile, analytics payload, public issuer normalization, investment score, DCF, trading indicator, portfolio optimization, or v0.3/v0.4 content.

## Verification

- `scripts/harness/learn-v0.2-regression.ts` verifies calculations, dilution, missing-input behavior, commitment validation, and progress isolation.
- `npm run qa:learn-v0.2` verifies the full responsive browser loop with deterministic API fixtures.
- Existing `npm run qa:learn` verifies that the v0.1 workflow remains functional after the release selector is introduced.
