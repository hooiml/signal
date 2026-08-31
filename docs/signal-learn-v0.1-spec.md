# Signal Learn v0.1 — Valuation Foundations Specification

**Status:** Product + implementation specification
**Release:** v0.1
**Theme:** Earnings, valuation, expectations, evidence-based reasoning
**Primary objective:** Prove the Signal Learn product loop before expanding scope.

---

## 1. Release Objective

v0.1 must prove that Signal Learn can teach a user to reason about a real company rather than memorize finance definitions.

The release should teach the relationship between:

**EPS → P/E → Forward P/E → Earnings Growth → Market Expectations**

The user should finish v0.1 able to explain what these metrics mean, identify when they are misleading, compare them in context, analyze a historical case without future knowledge, and apply the same reasoning to a current company.

v0.1 is intentionally narrow. It should not attempt to become a complete investing course.

---

## 2. Product Principles

1. **Evidence before conclusion.**
2. **Context before labels.**
3. **Reasoning quality is not the same as outcome quality.**
4. **Historical exercises must not leak future information.**
5. **Current-market exercises must not pretend the future is known.**
6. **Every important number must expose provenance.**
7. **AI explains and challenges; it does not make the investment decision.**
8. **No metric is taught as a deterministic buy/sell rule.**

---

## 3. Learning Outcomes

A user who completes v0.1 should be able to:

- distinguish fact, interpretation, expectation, thesis and uncertainty;
- explain EPS and diluted EPS at a practical level;
- explain trailing P/E;
- explain forward P/E;
- explain why P/E can rise or fall;
- understand how earnings growth interacts with valuation;
- explain why a low P/E is not automatically cheap;
- explain why a high P/E is not automatically expensive;
- distinguish good results from positive surprises;
- recognize estimate risk;
- compare a company against its own history and relevant peers;
- record evidence for and against an investment view;
- state what would invalidate their thesis;
- assign confidence without treating confidence as certainty.

---

# 4. Module Map

## Module 0.1 — Evidence & Uncertainty

### Purpose

Establish the reasoning model used throughout Signal Learn.

### Concepts

- Fact
- Interpretation
- Expectation
- Thesis
- Uncertainty
- Probability
- Hindsight bias
- Outcome bias
- Confirmation bias
- Past-performance limitations

### Required exercise

Present two decisions:

**Decision A**
- evidence-based analysis;
- explicit risks;
- reasonable confidence;
- poor subsequent return.

**Decision B**
- weak reasoning;
- unsupported conviction;
- good subsequent return.

Ask the learner which decision process was stronger and why.

### Completion test

The learner must demonstrate that outcome and decision quality are not equivalent.

---

## Module 0.2 — Earnings Per Share

### Concepts

- Net income
- Shares outstanding
- Basic EPS
- Diluted EPS
- TTM EPS
- Quarterly EPS
- EPS growth
- Share dilution
- Buybacks
- One-off items

### Required interactions

Allow the user to manipulate:

- net income;
- share count.

Show the resulting change in EPS.

### Required examples

1. Net income rises and share count is unchanged.
2. Net income rises while share count rises sharply.
3. Net income is flat while buybacks reduce share count.
4. Reported EPS is distorted by a one-off item.

### Key conclusion

Company-level earnings growth and shareholder-level per-share growth are related but not identical.

---

## Module 0.3 — P/E Ratio

### Concepts

- Price
- EPS
- Trailing P/E
- Historical P/E
- Peer P/E
- Market-relative valuation
- Cyclical earnings
- Temporarily depressed earnings
- Temporarily elevated earnings

### Required interaction

Interactive P/E sandbox:

- change price while EPS stays fixed;
- change EPS while price stays fixed;
- change both;
- show resulting P/E.

### Required comparison

For a real company, show:

- current or point-in-time P/E;
- company historical distribution or range;
- selected relevant peers;
- broader market reference where appropriate;
- earnings-growth context.

### Required misconception checks

Explicitly invalidate:

- `P/E < 15 = cheap`
- `P/E > 30 = expensive`
- `Lower P/E = better company`
- `Higher P/E = better growth`

### Completion test

Given two companies with different P/E and earnings growth, the user should identify that P/E alone is insufficient to determine relative attractiveness.

---

## Module 0.4 — Forward P/E

### Concepts

- Trailing EPS
- Forecast EPS
- Consensus estimates
- Forward EPS
- Forward P/E
- Estimate revision risk
- Fiscal-period alignment

### Required interaction

Show:

- trailing P/E;
- forward P/E;
- expected EPS growth.

Ask why the two P/E values differ.

Then allow the learner to reduce expected EPS and observe the implied forward P/E change.

### Key conclusion

Forward P/E depends on estimates. It is therefore partly a valuation metric and partly an expectation-dependent metric.

---

## Module 0.5 — Earnings Growth

### Concepts

- YoY EPS growth
- QoQ EPS growth
- CAGR
- Growth acceleration
- Growth deceleration
- Base effects

### Required exercise

Compare:

**Company A**
- P/E: lower;
- EPS growth: low.

**Company B**
- P/E: higher;
- EPS growth: materially higher.

Do not ask which stock is a better investment from these values alone. Ask what additional evidence is required.

---

## Module 0.6 — Market Expectations

### Concepts

- Consensus revenue
- Consensus EPS
- Guidance
- Earnings surprise
- Estimate revisions
- Expectations embedded in valuation

### Required exercise

Example structure:

**Expected**
- Revenue growth: +25%
- EPS growth: +30%

**Actual**
- Revenue growth: +21%
- EPS growth: +24%

Ask:

> Were the results strong?
> Were the results better than expectations?
> Why can both answers differ?

### Key conclusion

Markets often respond to changes in expectations, not simply whether reported numbers are objectively good or bad.

---

# 5. Core User Journey

The v0.1 reference journey should be:

1. Learn dashboard
2. Concept introduction
3. Interactive explanation
4. Real-company comparison
5. Historical Replay
6. Replay commitment
7. Reveal + debrief
8. Current-market exercise
9. Evidence Board
10. Thesis Builder
11. Reflection
12. Mastery update

The first fully polished vertical slice should use **P/E** as the reference concept.

---

# 6. Screen Specifications

## Screen 1 — Learn Home

### Purpose

Orient the user without presenting an intimidating course catalog.

### Required content

- Continue Learning
- Current mastery
- Recommended next concept
- Foundations track
- Historical Replay entry
- Apply Today entry

### v0.1 visible path

`Evidence → EPS → P/E → Forward P/E → Growth → Expectations`

### Acceptance criteria

- User can identify the next recommended lesson within one primary action.
- Locked concepts explain their prerequisite.
- Progress is preserved across sessions.

---

## Screen 2 — Concept Overview

### Required sections

- What it measures
- Why investors use it
- Formula or derivation
- Economic intuition
- What changes it
- When it can mislead
- What to compare it with
- Connected concepts
- Data source/provenance entry

### Acceptance criteria

- No concept is described only by a formula.
- A limitation section is mandatory.
- At least one connected concept is shown.

---

## Screen 3 — Interactive Concept Lab

### P/E reference implementation

Inputs:

- Share price
- EPS

Outputs:

- P/E
- plain-language interpretation.

### Optional guided scenarios

- Price +20%, EPS unchanged
- EPS +20%, price unchanged
- Both rise at the same rate
- Earnings collapse

### Acceptance criteria

- Output updates immediately after input changes.
- The interpretation changes alongside the number.
- Invalid numeric states are handled deterministically.
- Division by zero and negative EPS do not produce misleading P/E labels.

---

## Screen 4 — Compare Real Companies

### Required fields

For each company:

- price timestamp;
- trailing EPS;
- trailing P/E;
- forward P/E if available;
- expected EPS growth;
- selected peer context;
- historical valuation context.

### Required interaction

The user selects which evidence they think matters and explains why.

### Acceptance criteria

- Comparison never produces an automatic winner.
- Data timestamps are visible or inspectable.
- Companies with incompatible business economics should warn against naive peer comparison.

---

## Screen 5 — Historical Replay

### Required header

- Company
- Replay date
- Data known as of
- Replay status: future locked

### Required tabs or sections

- Company
- Financials
- Valuation
- Expectations
- Market context
- Events / narrative
- Evidence Board

### Anti-hindsight rules

At replay date T:

- no price after T;
- no filings released after T;
- no analyst estimates created after T;
- no later guidance;
- no later news summaries that reveal future outcomes;
- no revised historical dataset that would not have been knowable then when point-in-time data is required.

### Acceptance criteria

A test fixture with deliberately future-dated data must never render before the replay advances past the corresponding `knownAsOf` time.

---

## Screen 6 — Replay Commitment

Before revealing future information, require:

- View: Attractive / Neutral / Unattractive or equivalent neutral language
- Confidence: 0–100
- At least one supporting evidence item
- At least one risk / contradictory item
- What would change my mind?

### Acceptance criteria

- User cannot reveal the future without committing.
- Original commitment becomes immutable after reveal.
- Subsequent reflections are stored separately.

---

## Screen 7 — Reveal & Debrief

### Reveal controls

Advance by a defined interval, such as:

- next earnings;
- next quarter;
- selected checkpoint.

### Show changes in

- price;
- EPS;
- estimates;
- P/E;
- forward P/E;
- relevant market conditions.

### Debrief

Do not score based solely on return.

Evaluate:

- metric interpretation;
- evidence breadth;
- context;
- counterargument quality;
- invalidation quality;
- confidence calibration.

### Acceptance criteria

- A positive-return outcome cannot automatically mark a thesis correct.
- A negative-return outcome cannot automatically mark a thesis incorrect.
- Debrief distinguishes reasoning from outcome.

---

## Screen 8 — Apply Today

### Purpose

Transfer historical learning into an unresolved real-world situation.

### Required data

- current/near-current price;
- trailing EPS;
- trailing P/E;
- forward EPS;
- forward P/E;
- expected earnings growth;
- recent estimate direction;
- historical valuation context;
- selected peer context.

### Required behavior

No future outcome exists. Signal should help the user frame the evidence, not predict the result.

### Acceptance criteria

- Current data displays freshness timestamp.
- Stale data is labeled.
- Missing estimates are surfaced as missing rather than fabricated.

---

## Screen 9 — Evidence Board

### Categories

- Supports
- Against
- Context
- Unknown

### Evidence item fields

- statement;
- evidence type;
- source;
- data timestamp;
- user note;
- linked concept;
- optional confidence.

### AI behavior

AI may challenge classification.

Example:

> You placed declining EPS estimates under Context. Do you consider this evidence against your valuation thesis?

AI must not silently move evidence without user action.

---

## Screen 10 — Thesis Builder

### Required fields

- Current view
- Main thesis
- Supporting evidence
- Contradictory evidence
- Main uncertainty
- Invalidation condition
- Confidence %

### Acceptance criteria

- Thesis cannot contain only supporting evidence.
- At least one uncertainty or invalidation condition is required.
- The UI does not label the output as an investment recommendation.

---

## Screen 11 — Reflection

### Required comparison

**What I believed then**
vs.
**What I know now**

### Prompts

- Which part of the reasoning held up?
- Which assumption failed?
- Did confidence match evidence quality?
- What would I check sooner next time?
- Which concept should I revisit?

---

# 7. Historical Case Requirements

v0.1 should launch with at least two contrasting cases.

## Case A — Premium valuation where growth delivered

Purpose:
Show why a high multiple can sometimes be supported by subsequent business performance.

## Case B — Premium valuation where expectations disappointed

Purpose:
Show the risk of paying for expected growth that does not materialize.

## Optional Case C — Low P/E value trap

Purpose:
Show why cheap-looking valuation can reflect deteriorating fundamentals.

### Selection rules

Cases must be selected based on:

- point-in-time data availability;
- clear learning objective;
- sufficient earnings/estimate history;
- no reliance on hindsight-only narratives;
- contrasting outcomes.

Do not select only famous winners.

---

# 8. Data Requirements

## Required data entities

### Company
- id
- symbol
- name
- exchange
- sector
- industry

### MetricSnapshot
- companyId
- metric
- value
- effectiveAt
- knownAsOf
- sourceId
- methodologyVersion

### EstimateSnapshot
- companyId
- fiscalPeriod
- metric
- estimate
- capturedAt
- sourceId

### PriceSnapshot
- companyId
- price
- timestamp
- sourceId

### HistoricalCase
- id
- companyId
- replayStart
- allowedCheckpoints
- learningObjective
- editorialNotesVersion

### EvidenceItem
- id
- sessionId
- category
- text
- sourceRef
- createdAt

### Thesis
- sessionId
- view
- summary
- invalidation
- confidence
- committedAt

### Reflection
- sessionId
- originalThesisRef
- text
- createdAt

### MasteryRecord
- userId
- conceptId
- understandScore
- interpretScore
- applyScore
- updatedAt

---

# 9. Time Semantics

Every historical financial field must distinguish:

- **effective period/date** — what period the data describes;
- **known-as-of timestamp** — when a learner at that time could have known it.

Replay filtering must use `knownAsOf`, not only financial period.

This is a non-negotiable anti-look-ahead requirement.

---

# 10. Data Provenance

Every important metric must support source inspection.

At minimum show:

- provider/source;
- price timestamp;
- financial period;
- estimate snapshot timestamp where applicable;
- formula/methodology;
- freshness/staleness status.

Never present generated or inferred values as reported facts.

---

# 11. AI Role

AI may:

- explain concepts;
- generate a counterargument from supplied evidence;
- ask Socratic questions;
- identify missing evidence categories;
- help the user articulate assumptions;
- explain why two metrics may conflict;
- summarize a replay debrief.

AI must not:

- issue deterministic buy/sell instructions;
- claim future price outcomes are known;
- invent missing financial data;
- hide uncertainty;
- grade decisions purely by subsequent return;
- turn a numeric indicator into an unsupported signal.

---

# 12. Loading, Error and Empty States

## Loading

- Concept shell renders before data.
- Current-market data uses skeletons.
- Replay indicates which snapshot is loading.

## Missing data

Show:

> Data unavailable for this period.

Do not substitute fabricated values.

## Stale data

Show the timestamp and stale state.

## Source failure

Keep the learning content usable where possible and explicitly mark unavailable market evidence.

## Replay integrity failure

If point-in-time filtering cannot be guaranteed, block the replay rather than silently showing future data.

---

# 13. Analytics / Product Validation

Track:

- lesson started/completed;
- interaction completion;
- replay commitment rate;
- evidence items created;
- support-vs-against balance;
- thesis completion;
- confidence before/after;
- current-market exercise completion;
- concept revisit rate.

Do not optimize primarily for quiz score.

Potential validation questions:

- Can the user explain P/E without repeating the formula?
- Does the user stop labeling high P/E as automatically expensive?
- Does the user inspect expectations more often after completing the module?
- Does the user provide evidence against their own thesis?

---

# 14. Accessibility and Interaction Requirements

- Full keyboard navigation.
- Visible focus states.
- No learning interaction dependent on hover alone.
- Charts expose text equivalents/tooltips.
- Confidence controls are keyboard accessible.
- Reduced-motion preference respected.
- Mobile interaction must preserve replay state and evidence selections.

---

# 15. v0.1 Non-Goals

Do not include:

- DCF;
- full financial-statement education;
- portfolio optimization;
- RSI/MACD;
- trading signals;
- options;
- order flow;
- AI stock ratings;
- social leaderboards;
- copy trading;
- automatic portfolio execution.

---

# 16. Engineering Acceptance Gate

v0.1 is implementation-complete only when:

1. EPS, P/E, Forward P/E, Growth and Expectations modules are usable.
2. At least two historical cases pass point-in-time integrity tests.
3. A user can complete the full Learn → Replay → Apply → Thesis → Reflect loop.
4. Every displayed financial number supports provenance.
5. Current data shows freshness.
6. Missing data is never fabricated.
7. Original replay thesis is immutable after reveal.
8. Outcome is separated from reasoning in the debrief.
9. Evidence Board supports for/against/context/unknown.
10. The release contains no automatic buy/sell rating.

---

# 17. Recommended Implementation Sequence

### Slice 1
- Learn route/navigation
- Concept schema
- EPS lesson
- P/E lesson
- Concept Lab

### Slice 2
- Real-company comparison
- Provenance inspector
- Current-data adapter

### Slice 3
- HistoricalCase schema
- Replay filtering
- Replay UI
- Commitment flow

### Slice 4
- Evidence Board
- Thesis Builder
- Reflection
- Mastery

### Slice 5
- Forward P/E
- Earnings Growth
- Expectations
- second replay case
- current-market exercise

Do not begin v0.2 until this release loop is coherent and testable.
