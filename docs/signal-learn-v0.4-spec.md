# Signal Learn v0.4 — Short-Term Trading Specification

**Status:** Product + implementation specification
**Release:** v0.4
**Depends on:** v0.1–v0.3 shared reasoning foundations
**Theme:** Price behavior, execution, risk, expectancy and strategy validation

---

# 1. Release Objective

v0.4 adds a short-term trading learning path without turning Signal into an indicator-following or signal-selling product.

The core trading model is:

**Context → Setup → Trigger → Entry → Invalidation → Position Size → Management → Review**

The learner should understand that technical tools transform or summarize market data; they do not become deterministic future predictors simply because they produce a number.

Trading success should be evaluated through:

- process;
- risk control;
- expectancy;
- repeatability;
- robustness.

Not individual trade outcomes.

---

# 2. Learning Outcomes

A user completing v0.4 should be able to:

- identify trend and range structure;
- interpret support/resistance as areas rather than magical prices;
- understand moving averages as lagging transforms;
- interpret RSI/MACD without deterministic rules;
- use volume and VWAP as context;
- understand ATR and volatility;
- distinguish market/limit/stop orders;
- account for spread and slippage;
- define a complete trade setup;
- define invalidation before entry;
- size a position from allowed risk;
- use R multiples;
- understand expectancy;
- distinguish win rate from edge;
- review trade management;
- understand basic backtesting;
- recognize look-ahead bias;
- recognize survivorship bias;
- recognize overfitting;
- maintain an immutable trade journal.

---

# 3. Module Map

## Module 3.1 — Price Structure

### Concepts

- Trend
- Higher high
- Higher low
- Lower high
- Lower low
- Range
- Consolidation
- Breakout
- Breakdown
- Failed breakout/breakdown

### Required interaction

Give unlabeled historical price segments and ask users to classify structure before revealing annotations.

### Rule

Teach price behavior before indicators.

---

## Module 3.2 — Support & Resistance

### Concepts

- Previous highs/lows
- Range boundaries
- Reaction zones
- Failed breakouts
- Retests

### Required misconception

Explicitly reject:

> Support at exactly $100 must hold.

Teach zones, context and invalidation.

---

## Module 3.3 — Moving Averages

### Concepts

- SMA
- EMA
- Lookback
- Lag
- Trend context
- Crossovers

### Required exercise

Change lookback length and show how the same price history produces different moving averages.

### Core lesson

Moving averages summarize historical prices. They do not independently know future prices.

---

## Module 3.4 — Momentum

### Concepts

- RSI
- MACD
- Rate of Change
- Divergence
- Momentum persistence

### Required counterexample

Show a strong trend where RSI remains “overbought” while price continues higher.

Teach:

> Overbought describes a calculation state, not an automatic short signal.

---

## Module 3.5 — Volume & Participation

### Concepts

- Volume
- Relative volume
- Price/volume relationship
- Volume expansion
- Volume contraction

### Required question

> Does participation support the observed price move?

Avoid universal rules such as “high volume confirms every breakout.”

---

## Module 3.6 — VWAP & Anchored VWAP

### Concepts

- VWAP
- Intraday reference
- Anchored VWAP
- Anchor selection
- Limitations

### Required rule

Do not teach:

> Above VWAP = buy.

Teach VWAP as a context/reference level.

---

## Module 3.7 — Volatility & ATR

### Concepts

- Daily range
- ATR
- Historical volatility
- Volatility expansion
- Volatility contraction

### Required integration

Show why a fixed $1 stop means very different things in low- and high-volatility instruments.

Connect directly to sizing.

---

## Module 3.8 — Liquidity & Execution

### Concepts

- Bid
- Ask
- Spread
- Market order
- Limit order
- Stop order
- Order book basics
- Liquidity
- Slippage
- Market impact

### Required exercise

Compare execution in:

- liquid large-cap stock;
- thinly traded instrument.

Show that chart price and executable price can differ.

---

## Module 3.9 — Trade Construction

Every practice trade must define:

### Context
What is the broader market/asset state?

### Setup
What repeatable condition exists?

### Trigger
What confirms action?

### Entry
Where is the trade initiated?

### Invalidation
What observable condition proves the idea wrong?

### Target
Where might profit be realized?

### Time horizon
What trade duration is expected?

No practice trade should be accepted with only “indicator says buy.”

---

## Module 3.10 — Risk/Reward

### Concepts

- Risk amount
- Reward
- R multiple
- Reward/risk ratio
- asymmetric payoff

### Required exercise

Convert outcomes into R rather than only percentage return.

---

## Module 3.11 — Position Sizing

### Core sequence

**Account risk → invalidation distance → position size**

### Inputs

- account size;
- max risk % or amount;
- entry;
- stop;
- optional estimated slippage.

### Outputs

- risk/share;
- position size;
- total notional;
- estimated loss at invalidation.

### Guardrail

If the stop is changed, position-size risk must recompute immediately.

---

## Module 3.12 — Expectancy

### Concepts

- Win rate
- Average winner
- Average loser
- Expectancy
- Profit factor

### Required exercise

Compare:

Strategy A:
- high win rate;
- poor payoff.

Strategy B:
- lower win rate;
- larger winners.

Ask which has better expectancy using the full distribution.

---

## Module 3.13 — Trade Management

### Concepts

- Partial exits
- Scaling
- Trailing stops
- Break-even moves
- Time stops
- Stop widening
- Rule adherence

### Required reflection

Ask whether a management change was:

- planned;
- evidence-based;
- emotional;
- inconsistent with original invalidation.

---

## Module 3.14 — Backtesting Fundamentals

### Concepts

- Hypothesis
- Rule definition
- Sample size
- In-sample
- Out-of-sample
- Walk-forward intuition
- Transaction costs
- Slippage
- Look-ahead bias
- Survivorship bias
- Data leakage

### Required rule

A backtest cannot access information unavailable at each historical timestamp.

---

## Module 3.15 — Trading Statistics

### Concepts

- Win rate
- Average winner
- Average loser
- Expectancy
- Profit factor
- Maximum drawdown
- Distribution of R
- Sharpe ratio introduction only if appropriate

### Required emphasis

Do not judge a strategy from total return alone.

---

## Module 3.16 — Overfitting & Robustness

### Concepts

- Parameter tuning
- Indicator stacking
- Regime dependence
- Multiple testing
- False discovery
- Robustness
- Sensitivity

### Required exercise

Show a strategy optimized to historical data that degrades after small parameter changes.

Teach why fragility matters.

---

# 4. Trading Replay

Trading Replay is the flagship v0.4 exercise mode.

## Replay state

Example:

**Company XYZ — historical date — 10:30 AM**

Visible:

- candles up to 10:30;
- volume;
- user-enabled learned indicators;
- market context known then.

Hidden:

- every candle after 10:30;
- future news;
- future earnings;
- future indicator values.

---

## Required interaction

Before advancing, user records:

- context;
- setup;
- trigger;
- entry;
- stop/invalidation;
- target;
- position size;
- account risk;
- confidence;
- reason not to trade.

The “No Trade” decision must be treated as a valid outcome.

---

## Replay progression

Advance by:

- next candle;
- selected time interval;
- next meaningful event.

At each stage allow:

- Hold
- Exit
- Partial exit
- Adjust stop
- Cancel thesis

All changes must be journaled.

---

# 5. Trade Debrief

Score/process dimensions may include:

- setup adherence;
- invalidation quality;
- risk sizing;
- execution awareness;
- management consistency;
- evidence quality;
- emotional-rule violations;
- expectancy compatibility.

Do not score primarily on P&L.

Examples:

A well-structured -1R loss can receive a stronger process score than a lucky +3R trade that violated risk rules.

---

# 6. Strategy Lab

### Purpose

Teach strategy definition and validation.

### User defines

- market/universe;
- setup;
- entry rule;
- exit rule;
- stop;
- target;
- position sizing;
- timeframe;
- filters.

### Output

At minimum:

- sample count;
- win rate;
- average R;
- expectancy;
- profit factor;
- maximum drawdown;
- transaction-cost assumptions.

### Required warnings

- insufficient sample;
- look-ahead contamination;
- excessive parameter count;
- missing cost assumptions;
- regime concentration.

The tool should be educational before it is optimization-oriented.

---

# 7. Risk Calculator

### Inputs

- account value;
- max risk;
- entry;
- invalidation;
- slippage assumption.

### Outputs

- position size;
- notional exposure;
- risk/share;
- total risk;
- R targets.

### Acceptance criteria

- works with long and short examples if short learning is enabled;
- invalid stop direction errors are explicit;
- zero/negative values fail safely;
- risk recalculates on every relevant change.

---

# 8. Trade Journal

## Pre-trade

- Context
- Setup
- Trigger
- Entry
- Invalidation
- Target
- Position size
- Expected R
- Confidence

## During trade

Append-only events:

- stop changed;
- partial exit;
- target changed;
- thesis invalidated;
- manual exit.

## Post-trade

- realized R;
- rule adherence;
- what went well;
- what failed;
- whether original thesis was valid;
- whether management followed plan.

Original pre-trade reasoning remains immutable.

---

# 9. Data Requirements

## CandleSnapshot
- symbol
- timeframe
- openTime
- closeTime
- open
- high
- low
- close
- volume
- knownAsOf
- sourceId

## IndicatorSnapshot
Prefer calculating indicators from point-in-time candles when feasible.

- symbol
- indicator
- parameters
- timestamp
- value
- source/methodologyVersion

## ExecutionAssumption
- spread
- slippageModel
- feeModel
- marketType
- effectiveAt

## TradeReplaySession
- userId
- symbol
- replayTime
- setup
- entry
- stop
- target
- positionSize
- risk
- confidence
- committedAt

## TradeEvent
- sessionId
- timestamp
- eventType
- previousState
- newState
- reason

## BacktestDefinition
- universe
- timeframe
- rules
- costs
- parameters
- createdAt

## BacktestResult
- definitionVersion
- sampleCount
- winRate
- avgWinnerR
- avgLoserR
- expectancy
- profitFactor
- maxDrawdown
- period
- warnings

---

# 10. Look-Ahead Protection

All trading computations must enforce timestamp integrity.

At time T:

- candles after T unavailable;
- indicators calculated only from data available through T;
- event/news data filtered by known-as-of;
- corporate actions handled without leaking future adjustments where relevant;
- backtest logic may not access future bars.

Automated tests should intentionally inject future data and assert it is inaccessible.

---

# 11. AI Role

AI may:

- explain a technical concept;
- challenge a setup;
- point out missing invalidation;
- flag inconsistent risk sizing;
- compare planned vs actual management;
- explain expectancy;
- identify possible overfitting;
- ask why a learner ignored contrary evidence.

AI must not:

- issue ungrounded real-time trade alerts;
- imply technical indicators guarantee outcomes;
- silently optimize strategy parameters until a profitable backtest appears;
- hide losing scenarios;
- fabricate market data;
- present backtests as future guarantees.

---

# 12. Current-Market Practice

If live/current practice is included:

- clearly distinguish delayed vs real-time data;
- show market-data timestamp;
- do not imply execution is simulated at a price unavailable to the learner;
- permit “observe only” exercises;
- do not require taking a bullish/bearish position.

The objective is reasoning practice, not encouraging trade frequency.

---

# 13. Mobile Requirements

Trading charts can easily become unusable on mobile.

Minimum requirements:

- chart remains readable;
- bottom sheet or tabbed evidence controls;
- position-sizing input accessible without obscuring chart;
- replay controls thumb-reachable;
- state preserved when switching panels;
- no hover-only interactions;
- annotations can be inspected by touch.

Do not copy the desktop layout unchanged.

---

# 14. Acceptance Criteria

v0.4 is complete when:

1. Price structure, support/resistance, moving averages, momentum, volume, VWAP and volatility modules are usable.
2. Execution/liquidity concepts include spread/slippage.
3. Trade Construction requires context, setup, trigger and invalidation.
4. Position sizing is derived from allowed risk and stop distance.
5. Expectancy is taught independently from win rate.
6. Trading Replay enforces point-in-time data.
7. “No Trade” is a valid replay decision.
8. Trade Journal preserves pre-trade reasoning.
9. Backtesting includes transaction costs and look-ahead safeguards.
10. Overfitting/robustness is explicitly taught.
11. Process scoring is not equivalent to P&L.
12. No technical indicator is presented as a deterministic signal.

---

# 15. Deferred Beyond v0.4

Do not require for v0.4:

- advanced order flow;
- Level II depth analytics;
- market profile;
- advanced volume profile;
- options/Greeks;
- futures-specific mechanics;
- automated brokerage execution;
- copy trading;
- real-money trade automation;
- AI auto-trader.

These may be considered only after the education system is validated.

---

# 16. Recommended Implementation Sequence

### Slice 1
Price structure + support/resistance + Trading Replay chart foundation.

### Slice 2
Moving averages + RSI/MACD + indicator limitations.

### Slice 3
Volume + VWAP + volatility.

### Slice 4
Execution + Trade Construction + Risk Calculator.

### Slice 5
Position sizing + R multiples + expectancy.

### Slice 6
Trade management + immutable Trade Journal.

### Slice 7
Backtesting + statistics + look-ahead protection.

### Slice 8
Overfitting + robustness + current-market practice.

v0.4 should remain an educational trading system, not evolve into a signal-selling product by accident.
