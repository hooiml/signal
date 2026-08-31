# Signal Learn v0.2 — Understanding the Business Specification

**Status:** Product + implementation specification
**Release:** v0.2
**Depends on:** Signal Learn v0.1
**Theme:** Financial statements, profitability, cash generation, capital efficiency and balance-sheet quality

---

# 1. Release Objective

v0.2 expands Signal Learn from valuation interpretation into understanding the business being valued.

The core question becomes:

> **What economic engine is producing the earnings and cash flow behind the valuation?**

The learner should stop treating EPS and P/E as isolated terminal numbers and begin tracing them back to revenue, margins, cash flow, capital requirements, debt and per-share economics.

v0.2 must reuse the v0.1 learning loop:

**Understand → Manipulate → Compare → Replay → Commit → Reveal → Debrief → Apply Live → Reflect**

---

# 2. Learning Outcomes

A user completing v0.2 should be able to:

- read a simplified income statement;
- read a simplified balance sheet;
- read a simplified cash-flow statement;
- understand how the statements relate;
- distinguish revenue growth from earnings growth;
- distinguish accounting earnings from cash generation;
- explain gross, operating and net margin;
- identify margin expansion/compression;
- understand CapEx and free cash flow;
- interpret debt relative to business cash generation;
- understand basic interest-coverage risk;
- explain ROIC at a practical level;
- understand dilution and buybacks;
- connect business fundamentals back to valuation.

---

# 3. Module Map

## Module 1.1 — Revenue

### Concepts

- Revenue
- Revenue growth
- YoY
- QoQ
- CAGR
- Organic growth
- Acquisition-driven growth
- Segment growth
- Geographic growth
- Growth acceleration/deceleration

### Required exercise

Give two companies both reporting +20% revenue growth:

- Company A: mostly organic;
- Company B: mostly acquired.

Ask what additional evidence is required before treating growth quality as equivalent.

---

## Module 1.2 — Income Statement

### Concepts

- Revenue
- Cost of revenue
- Gross profit
- Operating expenses
- Operating income
- Interest expense
- Taxes
- Net income
- EPS

### Required interaction

Income-statement waterfall:

Revenue
→ Gross Profit
→ Operating Income
→ Net Income
→ EPS

Allow the learner to change:

- gross margin;
- operating expenses;
- interest expense;
- share count.

Show downstream impact.

---

## Module 1.3 — Margins & Operating Leverage

### Concepts

- Gross margin
- Operating margin
- Net margin
- Margin expansion
- Margin compression
- Fixed vs variable cost intuition
- Operating leverage

### Required exercise

Revenue grows +15% while EPS grows +30%.

The user identifies whether margin expansion, lower interest, tax changes or share-count changes may explain the divergence.

---

## Module 1.4 — Balance Sheet

### Concepts

- Cash
- Receivables
- Inventory
- Assets
- Debt
- Current liabilities
- Long-term liabilities
- Equity
- Working capital

### Product emphasis

Do not turn the module into accounting certification.

Focus on questions useful to an investor:

- Does the business have financial flexibility?
- Does it depend on debt?
- Is working capital absorbing cash?
- Are liabilities increasing faster than the business?

---

## Module 1.5 — Cash Flow & Free Cash Flow

### Concepts

- Operating cash flow
- Investing cash flow
- Financing cash flow
- CapEx
- Free cash flow
- FCF margin
- Cash conversion

### Required case

Net income rises while FCF falls.

User investigates:

- working-capital change;
- CapEx;
- non-cash earnings;
- timing effects.

### Core lesson

Profit and cash generation should not be treated as interchangeable.

---

## Module 1.6 — Debt & Financial Resilience

### Concepts

- Total debt
- Net debt
- Debt/equity
- Net debt/EBITDA
- Interest expense
- Interest coverage
- Debt maturity
- Refinancing risk

### Required comparison

Compare:

- stable cash-generating company with debt;
- cyclical company with similar headline debt ratio.

Ask why identical ratios can imply different risk.

---

## Module 1.7 — ROIC & Capital Efficiency

### Concepts

- ROE
- ROA
- ROIC
- Invested capital
- Reinvestment
- Capital intensity

### Practical framing

> How much incremental capital does the company need in order to generate additional profit?

### Required comparison

Show two companies with similar earnings growth but materially different capital requirements.

---

## Module 1.8 — Dilution, SBC & Buybacks

### Concepts

- Basic shares
- Diluted shares
- Stock-based compensation
- Share issuance
- Buybacks
- Net share count change
- Per-share economics

### Required exercise

Company earnings grow +20% while diluted share count rises +15%.

Ask the learner to evaluate shareholder-level growth.

### Core lesson

Corporate growth does not automatically translate into equal per-share growth.

---

## Module 1.9 — Connecting the Statements

### Purpose

Integrate v0.2 into one analytical model.

### Required exercise

Provide a simplified company snapshot.

Ask the learner to trace:

Revenue growth
→ margin
→ operating income
→ net income
→ EPS
→ operating cash flow
→ CapEx
→ FCF
→ share count

Then connect the result back to P/E and Forward P/E from v0.1.

---

# 4. New User Experiences

## Financials Lab

A guided workspace that lets users trace business economics.

### Required views

- Income Statement
- Balance Sheet
- Cash Flow
- Driver Tree
- Historical Trend
- Compare

### Behavior

Selecting a line item should explain:

- what it means;
- why it matters;
- what can move it;
- related metrics.

---

## Driver Tree

Example:

Revenue
→ Gross Margin
→ Operating Margin
→ Net Income
→ EPS
→ P/E

Parallel branch:

Revenue
→ Operating Cash Flow
→ CapEx
→ FCF
→ Price/FCF or FCF Yield

### Acceptance criteria

The user can navigate from a valuation metric back to its underlying business drivers.

---

## Historical Financial Replay

Extend v0.1 Replay with:

- historical income statement;
- historical balance sheet;
- historical cash flow;
- point-in-time financial reports;
- business-driver changes.

Future filings remain locked until their known-as-of timestamps.

---

# 5. Required Historical Case Types

At least three business-pattern cases should exist over time.

## Case A — Margin expansion

Revenue growth is moderate but earnings accelerate because profitability improves.

## Case B — Cash-flow deterioration

Reported earnings remain strong while FCF weakens.

## Case C — Balance-sheet stress

Headline valuation appears cheap while debt/refinancing risk rises.

## Optional Case D — Dilution

Business growth looks strong, but per-share growth is materially weaker.

Do not require all four before initial v0.2 release if content/data quality is insufficient; prioritize quality.

---

# 6. Current-Market Business Analysis

For a selected current company, expose:

### Growth
- revenue growth;
- EPS growth;
- FCF growth.

### Profitability
- gross margin;
- operating margin;
- net margin;
- FCF margin.

### Financial strength
- cash;
- debt;
- net debt;
- interest coverage where meaningful.

### Capital efficiency
- ROIC or best available proxy;
- share-count trend.

### Valuation linkage
- P/E;
- forward P/E;
- selected cash-flow multiple.

The user should be prompted:

> Which business driver most affects your current valuation interpretation?

---

# 7. Data Model Additions

## FinancialStatementSnapshot

- companyId
- fiscalPeriod
- periodType
- reportedAt
- knownAsOf
- currency
- sourceId
- methodologyVersion

## FinancialLineItem

- statementSnapshotId
- lineItemType
- reportedValue
- normalizedValue
- unit
- sourceRef

## SegmentSnapshot

- companyId
- fiscalPeriod
- segment
- revenue
- operatingIncome if available
- knownAsOf

## CapitalStructureSnapshot

- companyId
- timestamp
- cash
- debt
- sharesBasic
- sharesDiluted
- sourceId

## RatioSnapshot

- companyId
- metric
- value
- effectiveAt
- knownAsOf
- calculationInputs
- sourceId

---

# 8. Calculation Rules

Where Signal calculates a ratio rather than receiving it directly:

- show formula;
- store input values;
- store timestamps;
- store methodology version;
- expose whether values are reported, normalized or derived.

A calculated number must never visually appear identical to a reported number without source/methodology inspection.

---

# 9. AI Responsibilities

AI may:

- explain statement relationships;
- ask why EPS and FCF diverged;
- identify evidence the learner has ignored;
- help trace a metric to underlying drivers;
- challenge simplistic debt conclusions;
- compare user reasoning against available facts.

AI must not:

- invent missing financial line items;
- normalize accounting data invisibly;
- claim accounting quality conclusions without evidence;
- convert a financial ratio into a buy/sell signal.

---

# 10. Screen / Interaction Requirements

## Financial statement tables

- desktop and mobile readable;
- expandable line items;
- clear units;
- annual/quarterly toggle where supported;
- point-in-time replay mode;
- row-level explanations;
- source inspection.

## Historical trend

Users can inspect a metric across periods without accidentally displaying future data during Replay.

## Compare

Normalize currencies/periods only when methodology is explicit.

Warn when comparisons are structurally weak.

---

# 11. Mastery

### Understand

Can define and locate the financial concept.

### Interpret

Can explain why it changed.

### Apply

Can connect the change to valuation and thesis implications.

Example:

> Operating margin fell from 25% to 20%.

Level 1:
Know what operating margin means.

Level 2:
Identify cost or operating-spend drivers.

Level 3:
Explain how sustained margin deterioration may affect expected EPS and valuation.

---

# 12. Acceptance Criteria

v0.2 is complete when:

1. Revenue, income statement, margins, balance sheet, cash flow, debt, ROIC and dilution modules are usable.
2. At least two v0.2 business-focused historical cases exist.
3. Replay enforces filing/report known-as-of dates.
4. The learner can trace P/E back to underlying EPS/business drivers.
5. The learner can distinguish net income from FCF.
6. Share dilution effects are represented correctly.
7. Derived ratios expose formula and inputs.
8. Missing accounting data is labeled rather than inferred.
9. Current-company analysis connects financials to valuation.
10. AI remains an explainer/challenger rather than investment recommender.

---

# 13. Non-Goals

Do not add yet:

- full DCF;
- detailed accounting-standard education;
- tax-accounting specialization;
- portfolio optimization;
- trading indicators;
- options;
- automated stock scoring.

---

# 14. Recommended Implementation Sequence

### Slice 1
Revenue + income-statement model + Financials Lab.

### Slice 2
Margins + driver tree + historical trend.

### Slice 3
Cash flow + FCF + earnings-vs-cash replay.

### Slice 4
Balance sheet + debt + financial resilience.

### Slice 5
ROIC + dilution + integrated business analysis.

### Slice 6
Current-market analysis + mastery + content polish.

Do not implement v0.3 until the user can connect business economics back to v0.1 valuation concepts.
