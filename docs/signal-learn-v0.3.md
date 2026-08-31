# Signal Learn v0.3

Signal Learn v0.3 turns the earlier valuation and business foundations into an evidence-based investment-analysis workflow.

## Product loop

`Understand -> Value -> Add evidence -> Build scenarios -> Commit thesis -> Journal -> Replay -> Update -> Apply current`

The release includes:

- fourteen modules from alternative valuation through behavioral finance and decision journals;
- a Valuation Lens for six ratios, applicability, limitations, and an interactive earnings/multiple return bridge;
- Macro Context that separates facts, changes, possible interpretations, and uncertainty;
- a unified Research workspace with eleven sections, linked evidence, the full thesis framework, and a deterministic reasoning challenger;
- Bear, Base, and Bull ranges with visible assumption provenance, explicit probabilities, and opt-in weighted value;
- a portfolio exercise that distinguishes ticker count from sector and shared-factor exposure;
- an append-only browser-local decision journal with an immutable original commitment;
- two curated point-in-time investment replays with financial, valuation, estimate, macro, rate, event, and narrative evidence;
- an eleven-field current-market exercise with omission and evidence-balance challenges but no answer key or recommendation.

## Calculation boundaries

`src/lib/learn/v0-3.ts` owns deterministic valuation, multiple-bridge, scenario, probability, portfolio-exposure, commitment, journal, and progress contracts. Invalid or non-positive ratio denominators remain unavailable. Scenario probabilities are never normalized; weighted midpoint is available only when the learner explicitly enables it and probabilities total 100%.

All macro and company values shown in the built-in labs and replay cases are labeled illustrative educational fixtures. Current analysis is learner-authored and does not imply that Signal fetched or verified a live issuer value.

## Replay boundary

`GET /api/learn/investment-replay/[caseId]` returns one known-as-of checkpoint without future data. The next checkpoint remains in `src/lib/learn/v0-3-replay.ts`, which is server-only.

The learner must POST a bounded thesis, scenario, supporting evidence, contrary evidence, invalidation, and confidence. Only a valid replay ID and commitment reveal the immediate next checkpoint. Retrospective narratives are absent from the locked view.

## Journal and compatibility

The original thesis, confidence, horizon, evidence references, and scenario references are frozen at commitment. Later changes append a reason, current thesis, confidence, and new evidence references. Validated browser-local persistence uses `signal-learn-v0.3-decision-journal`; progress uses `signal-learn-v0.3-progress`.

v0.1 and v0.2 remain selectable and retain their own storage contracts. v0.3 does not read or overwrite them, mutate Research records, call a brokerage, rank stocks, optimize a portfolio, or expose trading indicators.

## Verification

- `scripts/harness/learn-v0.3-regression.ts` verifies calculations, probability handling, concentration, journal immutability, replay validation, persistence parsing, and progress isolation.
- `npm run qa:learn-v0.3` verifies the complete responsive browser workflow with deterministic replay fixtures.
- `npm run qa:learn-v0.2` and `npm run qa:learn` verify that the prior releases remain usable after v0.3 becomes the default.
