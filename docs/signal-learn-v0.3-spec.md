# Signal Learn v0.3 — Investment Analysis Specification

**Status:** Product + implementation specification
**Release:** v0.3
**Depends on:** v0.1 and v0.2
**Theme:** Complete evidence-based investment analysis

---

# 1. Release Objective

v0.3 turns Signal Learn from a collection of financial concepts into a structured investment-research system.

The learner should combine:

**Business → Growth → Quality → Valuation → Expectations → Macro → Risks → Scenarios → Thesis**

The goal is not to produce a stock rating.

The goal is to enable a learner to form a defensible view, expose assumptions, identify contrary evidence and update that view when facts change.

---

# 2. Learning Outcomes

A user completing v0.3 should be able to:

- select an appropriate valuation metric for a business;
- understand multiple expansion and compression;
- distinguish business quality from investment attractiveness;
- reason about capital allocation;
- understand how rates and Treasury yields can influence valuation;
- interpret inflation and economic-cycle data without deterministic rules;
- distinguish narrative from underlying evidence;
- understand catalysts as potential expectation-changing events;
- construct bull/base/bear scenarios;
- build a structured investment thesis;
- record invalidation conditions;
- evaluate portfolio-level concentration and correlation;
- maintain an immutable decision journal;
- update a thesis as evidence changes.

---

# 3. Module Map

## Module 2.1 — Alternative Valuation Metrics

### Concepts

- Price/Sales
- EV/Sales
- EV/EBITDA
- Price/FCF
- FCF Yield
- Price/Book

### Required teaching principle

Do not present these as a ranking table of “best ratios.”

Teach:

- denominator economics;
- capital-structure effects;
- industry suitability;
- accounting limitations;
- growth and margin context.

### Required exercise

Choose the most informative starting metric for several different business types and explain why.

---

## Module 2.2 — Multiple Expansion & Compression

### Concepts

Approximate stock-return drivers:

- earnings change;
- multiple change;
- dividends where relevant.

### Required exercise

Case:

EPS: `$5 → $7`
P/E: `30× → 20×`

Ask the learner to reason about why strong earnings growth may coexist with weak price performance.

### Core lesson

A company's fundamentals and the price investors are willing to pay for those fundamentals are separate variables.

---

## Module 2.3 — Business Quality

### Concepts

- Switching costs
- Network effects
- Scale
- Cost advantage
- Brand
- Distribution
- Recurring revenue
- Customer concentration
- Supplier concentration
- Capital intensity

### Required rule

Never map “moat” directly to “buy.”

Always reconnect:

> What valuation already reflects this quality?

---

## Module 2.4 — Management & Capital Allocation

### Concepts

- Reinvestment
- Buybacks
- Dividends
- Debt repayment
- Acquisitions
- Divestitures
- Share issuance
- Incentives

### Required exercise

Evaluate a buyback under:

- low valuation;
- high valuation;
- high debt;
- weak reinvestment opportunity.

---

## Module 2.5 — Interest Rates & Treasury Yields

### Concepts

- Central-bank policy rate
- Risk-free rate
- Treasury yield
- 2Y/10Y/30Y
- Yield curve
- Discount-rate intuition
- Required return
- Real yield introduction

### Required relationship

Higher required return can reduce the valuation multiple investors are willing to pay, especially for cash flows expected far into the future.

Avoid deterministic claims that rising yields must make all equities fall.

---

## Module 2.6 — Inflation & Economic Cycle

### Concepts

- CPI
- Core inflation
- PCE
- GDP
- Employment
- Unemployment
- PMI
- Consumer spending
- Expansion
- Slowdown
- Recession

### Required exercise

Give a macro release that is objectively strong but changes rate expectations negatively for equities.

Ask the learner to explain the second-order effect.

---

## Module 2.7 — Market Narrative & Sentiment Evidence

### Concepts

- Narrative
- News flow
- Analyst revisions
- Price momentum
- Sector relative performance
- Short interest where available
- Volatility context

### Product rule

Do not reduce these into a black-box “sentiment score” by default.

Show component evidence.

---

## Module 2.8 — Catalysts

### Concepts

- Earnings
- Product launches
- Regulatory decisions
- Investor days
- M&A
- Macro releases
- Guidance updates

### Core distinction

A catalyst is an event that may change expectations.

It is not a complete investment thesis.

---

## Module 2.9 — Investment Thesis

### Required framework

#### Business
What does the company do?

#### Quality
Why might its economics persist?

#### Growth
What growth is expected?

#### Valuation
What are investors paying?

#### Expectations
What appears priced in?

#### Risks
What can break the thesis?

#### Catalysts
What could materially change expectations?

#### Contrary evidence
What evidence argues against the thesis?

#### Invalidation
What would make the user change their view?

#### Confidence
How strong is the evidence?

---

## Module 2.10 — Bull / Base / Bear Scenarios

### Each scenario should contain

- revenue assumptions;
- margin assumptions;
- EPS or FCF assumptions;
- valuation assumption;
- implied valuation range;
- probability/confidence;
- key trigger;
- key risk.

### Required behavior

Probabilities should not be auto-normalized invisibly.

If user probabilities do not sum to 100%, explain and allow correction.

### No deterministic target

Display ranges and assumptions rather than presenting one “correct” price.

---

## Module 2.11 — Portfolio Construction

### Concepts

- Diversification
- Concentration
- Correlation
- Position sizing
- Sector exposure
- Geographic exposure
- Rebalancing
- Cash allocation

### Required exercise

Show a portfolio with many tickers but heavy exposure to one economic factor.

Teach:

> Number of holdings is not the same as diversification.

---

## Module 2.12 — Investment Risk

### Concepts

- Volatility
- Drawdown
- Permanent capital loss
- Liquidity risk
- Thesis risk
- Concentration risk
- Correlation risk
- Leverage risk

### Core lesson

Risk cannot be summarized by volatility alone.

---

## Module 2.13 — Behavioral Finance

### Concepts

- FOMO
- Confirmation bias
- Loss aversion
- Anchoring
- Recency bias
- Overconfidence
- Sunk-cost thinking
- Disposition effect

### Required replay behavior

The debrief may identify potential bias in the user's reasoning, but must show the evidence for that interpretation rather than diagnose behavior from outcome alone.

---

## Module 2.14 — Decision Journal

### Before decision

- Thesis
- Evidence for
- Evidence against
- Risks
- Invalidation
- Expected horizon
- Confidence
- Scenario weights

### Later

Show:

**Original thesis**
**Evidence changes**
**Current thesis**

Original entries are immutable.

Updates are appended.

---

# 4. Research Workspace

v0.3 should introduce or formalize a unified research workspace.

## Required sections

- Overview
- Business
- Financials
- Valuation
- Expectations
- Macro
- Narrative / Events
- Evidence Board
- Scenarios
- Thesis
- Journal

### Product behavior

The workspace should help users move between evidence and interpretation without losing their selected company, time range or thesis state.

---

# 5. Valuation Lens

### Required capabilities

For a selected company:

- show applicable valuation metrics;
- explain why each may or may not be useful;
- historical range;
- peer context;
- expected growth;
- margin profile;
- balance-sheet context;
- multiple expansion/compression history.

### Required interaction

User selects their preferred valuation evidence and explains why.

Signal may challenge if the chosen metric is structurally weak for the business.

---

# 6. Macro Context Panel

### Required data types

Where available:

- policy rate;
- 2Y Treasury;
- 10Y Treasury;
- inflation measures;
- recent macro releases;
- market-implied expectations if licensed/available.

### Required behavior

Do not output:

> Macro bullish / bearish

as a single unsupported label.

Instead show:

- current fact;
- change;
- possible interpretation;
- uncertainty.

---

# 7. Scenario Builder

### UI requirements

Three default scenarios:

- Bear
- Base
- Bull

Allow custom scenario names later.

### Inputs

- revenue growth;
- margin;
- EPS/FCF;
- selected multiple;
- probability;
- notes.

### Output

- implied valuation range;
- weighted expected value only if user explicitly enables it;
- sensitivity to major assumptions.

### Important

The system must label scenario outputs as assumption-dependent estimates, not facts.

---

# 8. Thesis + Evidence Integration

Evidence added anywhere in Research should be linkable to:

- Supports
- Against
- Context
- Unknown

The Thesis Builder should reference those items instead of duplicating them.

Changing or deleting source evidence should not silently rewrite an already committed historical thesis.

---

# 9. Journal State Model

Recommended append-only model:

## DecisionJournalEntry
- id
- companyId
- createdAt
- effectiveAt
- thesisVersion
- confidence
- horizon
- scenarioRefs
- evidenceRefs
- invalidation
- status

## ThesisUpdate
- journalEntryId
- createdAt
- changedFields
- reason
- newEvidenceRefs

Do not overwrite the original commitment.

---

# 10. Historical Replay Expansion

v0.3 Replay should allow historical reconstruction of:

- company financials;
- valuation;
- consensus estimates;
- analyst revisions;
- relevant macro data;
- contemporaneous events/news;
- rates/yields;
- user thesis.

### Anti-hindsight rule

Narrative summaries must be generated only from sources available at the replay date.

A later article describing “what investors feared in 2022” must not be treated as point-in-time evidence for a 2022 replay unless clearly labeled as retrospective and excluded from the learner's pre-commitment view.

---

# 11. Current-Market Exercise

The learner chooses a current company and completes:

1. Business summary
2. Financial health
3. Valuation
4. Expectations
5. Macro context
6. Evidence for
7. Evidence against
8. Scenarios
9. Thesis
10. Invalidation
11. Confidence

Signal may identify omissions, but must not provide a hidden answer key.

---

# 12. Data Additions

## MacroSnapshot
- metric
- value
- effectiveAt
- releasedAt
- knownAsOf
- sourceId

## MarketEvent
- id
- companyId optional
- eventType
- occurredAt
- knownAsOf
- sourceId
- summary
- retrospectiveFlag

## AnalystRevisionSnapshot
- companyId
- fiscalPeriod
- metric
- oldEstimate
- newEstimate
- capturedAt
- sourceId

## ValuationFramework
- companyId or industry
- metric
- applicability
- rationale
- methodologyVersion

## Scenario
- thesisId
- name
- assumptions
- impliedValueRange
- probability
- createdAt

## PortfolioExposure
- portfolioId
- exposureType
- exposureKey
- weight
- calculatedAt

---

# 13. AI Role

AI may:

- challenge a thesis;
- surface contradictory evidence already present;
- explain macro relationships;
- help compare valuation frameworks;
- generate questions the learner should investigate;
- summarize changes since the last journal entry;
- explain scenario sensitivity;
- identify unsupported leaps from fact to conclusion.

AI must not:

- generate opaque “Signal Score” recommendations;
- fabricate analyst expectations;
- state forecasts as facts;
- mutate user thesis/history silently;
- present one scenario as certain;
- optimize a portfolio without explaining assumptions and constraints.

---

# 14. Product Validation

Measure:

- evidence diversity;
- number of contrary evidence items;
- thesis completion;
- scenario completion;
- invalidation usage;
- journal update behavior;
- concept revisits from Research;
- macro-context usage;
- whether users change confidence when evidence changes.

Avoid optimizing around whether users pick stocks that subsequently outperform.

---

# 15. Acceptance Criteria

v0.3 is complete when:

1. Alternative valuation metrics are taught with applicability context.
2. Multiple expansion/compression is interactive and usable.
3. Rates/yields and basic macro context are integrated.
4. Market narrative is decomposed into observable evidence.
5. The full Thesis framework is operational.
6. Bull/Base/Bear scenarios work with assumption provenance.
7. Portfolio concentration/correlation concepts are usable.
8. Decision Journal preserves original views immutably.
9. Historical Replay remains point-in-time safe with macro/events.
10. Current-market analysis can be completed without any automatic buy/sell rating.
11. AI can challenge reasoning without becoming the decision-maker.

---

# 16. Non-Goals

Do not include yet:

- execution/trading tools;
- RSI/MACD/VWAP;
- options;
- automated portfolio execution;
- personalized regulated financial advice;
- black-box stock rankings;
- full institutional risk models.

---

# 17. Recommended Implementation Sequence

### Slice 1
Alternative valuation + multiple expansion/compression.

### Slice 2
Rates, Treasury yields, inflation and Macro Context.

### Slice 3
Business quality + capital allocation + narrative/catalysts.

### Slice 4
Research Workspace + Thesis Builder integration.

### Slice 5
Scenario Builder.

### Slice 6
Portfolio risk + behavioral finance + Decision Journal.

### Slice 7
Historical Replay expansion + current-market end-to-end exercise.

Only begin v0.4 after investment and trading flows can be kept conceptually distinct.
