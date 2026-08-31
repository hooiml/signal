# Signal Learn v0.1

Signal Learn v0.1 is the first evidence-based learning vertical slice inside Signal.

## Product loop

`Learn concepts -> Compare -> Apply today -> Historical Replay -> Debrief -> Reflect`

The release covers:

- evidence vs interpretation vs expectation vs thesis;
- EPS;
- P/E;
- Forward P/E as an explicitly illustrative concept until Signal has an approved estimate provider;
- earnings growth;
- results vs expectations;
- a current-company evidence workspace;
- a two-company evidence comparison that never selects a winner;
- an Evidence Board and falsifiable thesis prompt;
- two curated point-in-time Historical Replay entry points;
- browser-local Understand, Interpret, and Apply mastery.

## Data contracts

### Current evidence

The current exercise reuses `/api/research/symbol/[symbol]` and therefore inherits the Research snapshot freshness, source, warning, and validation behavior.

The current P/E is described exactly according to the existing Research data contract: current price combined with the latest available annual valuation inputs. It is not labeled as TTM when the source does not provide a TTM basis.

Forward P/E and analyst revisions remain unavailable in live exercises until an approved data source is added. Illustrative teaching examples are visibly labeled as illustrative.

### Historical Replay

Historical Replay reuses the filing-aligned historical valuation service but adds a server-side reveal boundary at `/api/learn/replay/[symbol]`.

For US companies, the GET response returns only the newest eligible annual observation that still has a later safe annual observation. It does **not** return the later observation.

The learner must submit a complete commitment containing:

- current view;
- confidence;
- supporting evidence;
- contrary evidence;
- invalidation condition.

Only then can POST return the next eligible annual observation.

Replay observations require:

- a public filing date;
- the first safe closing price after the filing;
- positive annual net income;
- split-aligned diluted weighted-average shares;
- a calculable filing-aligned P/E.

Malaysia Historical Replay fails closed because the current repository has no approved point-in-time Malaysia fundamentals source.

## Anti-hindsight rules

- No later annual observation is sent to the client before commitment.
- No later filing, price, or metric is embedded in the initial replay payload.
- The original commitment becomes read-only after reveal in the client flow.
- Debrief language separates subsequent outcome from reasoning quality.
- A later positive return is never treated as proof that the earlier thesis was correct.

## UI behavior

Signal Learn uses the V7 shell and its existing light/dark theme tokens.

The page exposes four clear workspaces:

1. **Learn concepts** — one concept at a time with interactive examples.
2. **Compare** — two current evidence sets with freshness, source, and structural-comparability warnings.
3. **Apply today** — current unresolved evidence, Evidence Board, and thesis framing.
4. **Historical replay** — point-in-time evidence, commitment, reveal, debrief, and reflection.

Module completion, current-exercise completion, and at most one bounded reflection for each curated replay case are stored locally in the browser. Malformed and legacy progress is parsed into the version-1 contract. No learning-progress server schema is introduced in v0.1.

Learn is available from the V7 command palette on Market and Research. On the Learn surface it is also shown as the selected navigation destination. A wider primary-navigation rollout can be considered after the v0.1 workflow is validated.

## Verification

`npm run qa:learn` runs deterministic Playwright coverage at 1280, 768, and 375 pixel widths with mocked market/replay APIs. It checks:

- route rendering;
- visible Learn navigation;
- horizontal overflow;
- P/E calculation behavior;
- non-positive EPS handling;
- current-data provenance and unavailable Forward P/E disclosure;
- two-company comparison without an automatic winner;
- future-data locking before replay commitment;
- commitment payload before reveal;
- immutable original commitment display;
- post-commit reveal;
- two curated replay debriefs, reflection, and mastery persistence;
- light/dark theme switching;
- browser console/page errors;
- screenshot capture for visual review.

Standard repository validation still applies: lint, typecheck, harness, build, and browser QA.
