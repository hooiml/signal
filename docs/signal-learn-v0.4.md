# Signal Learn v0.4 — Short-Term Trading

## Scope

v0.4 adds a fourth **Short-term trading** learning track on top of the verified valuation, business, and investment-analysis tracks. Trading is taught as structured decision-making under uncertainty and risk—not as indicator following or signal generation.

Modules:

1. Price structure
2. Support and resistance
3. Moving averages
4. Momentum
5. Volume and participation
6. VWAP and anchored VWAP
7. Volatility and ATR
8. Liquidity and execution
9. Trade construction
10. Risk / reward
11. Position sizing
12. Expectancy
13. Trade management
14. Backtesting fundamentals
15. Trading statistics
16. Overfitting and robustness

## Learning principles

- Read price structure before transformed indicators.
- Moving averages, RSI, MACD, ATR, VWAP and related values summarize historical data; they do not independently predict the future.
- `RSI > 70` is never presented as an automatic Sell rule.
- Support and resistance are contextual reaction zones rather than exact walls.
- Volatility describes expected magnitude, not direction.
- No Trade is a valid decision.
- Invalidation determines risk distance; position size adapts to that distance.
- Win rate alone is not edge.
- Backtests must avoid look-ahead, leakage, unsupported cost assumptions, and overfitting.

## Interactive learning labs

### Position sizing

`calculatePositionSizeV04` uses:

`account risk budget → entry-to-invalidation risk/share → position size`

The v0.4 calculator is deliberately limited to long-practice examples. A stop at or above entry fails validation rather than being guessed as a short trade.

The calculator can include an explicit per-share slippage allowance.

### R multiples

`calculateRMultipleV04` expresses a long-practice outcome relative to the original entry-to-stop risk.

### Expectancy

`calculateExpectancyV04` combines:

- win-rate probability;
- average winner in R;
- average loser in R.

The default educational example shows why a 40% win rate with 2R average winners and 1R average losers has positive `+0.2R` expectancy.

`calculateProfitFactorV04` provides the corresponding gross-win/gross-loss ratio proxy.

## Apply Today

`TradingApplyV4` reuses the existing validated Research snapshot. It exposes current technical evidence through four lenses:

- Structure — close, SMA50, SMA200, EMA20, EMA50;
- Momentum — RSI14 and MACD components;
- Participation — daily volume, average volume, anchored VWAP, ADX;
- Volatility — ATR, ATR percentage, Supertrend reference/direction.

Every current exercise states that technical indicators summarize historical price/volume and are not independent predictions.

The practice decision supports either:

### Complete long-practice plan

- context;
- setup;
- trigger;
- entry;
- invalidation stop;
- target;
- expected horizon;
- confidence;
- account value;
- allowed risk;
- optional slippage allowance.

or:

### No Trade

- explicit reason;
- confidence.

An incomplete trade plan is rejected. No Trade is accepted as a complete learning decision when its reason is provided.

No practice decision places an order or mutates a brokerage/Research record.

## Daily Historical Trading Replay

`GET /api/learn/trading-replay/[symbol]?market=US` creates one deterministic no-look-ahead daily-price checkpoint from the existing Research chart.

Requirements:

- US only in v0.4;
- at least 80 validated daily bars;
- deterministic cutoff with at least five later bars reserved for reveal;
- initial response contains only the latest 40 bars ending at the cutoff;
- the response does not include the current quote, the full future chart, or later bars;
- technical values at the cutoff come from the existing chronological technical-series calculation, which uses that bar and prior bars only.

`POST /api/learn/trading-replay/[symbol]` requires either a complete long-practice plan or an explicit No Trade decision. It reconstructs the canonical cutoff server-side from symbol/date and returns at most the next five daily bars only after commitment.

The replay deliberately does **not** claim to reconstruct:

- intraday bid/ask spread;
- queue position;
- order-book depth;
- exact execution fills;
- intraday news timing.

The post-reveal copy instructs the learner to review rule adherence, invalidation and risk rather than grade the decision solely from P&L.

## Data integrity

- Current technical evidence reuses the existing Research snapshot and provider/freshness metadata.
- Historical replay uses the existing Yahoo daily OHLCV path and the repo's chronological technical-series calculations.
- Technical replay sends no future bars before commitment.
- Daily chart evidence is never presented as an intraday execution simulator.
- Missing indicator values remain unavailable.
- No trading indicator produces an automatic Buy/Sell signal.
- No backtest output is presented as a future guarantee.

## Deliberately deferred

v0.4 does not add:

- real-money order placement;
- automated trading;
- copy trading;
- Level II/order-book analytics;
- advanced order flow;
- market profile;
- options/Greeks;
- broker connectivity;
- AI trade alerts.

These require separate product, data, licensing, execution, and safety decisions.

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
npm run qa:learn-v04
```

`qa:learn-v04` runs Chromium at 1280px, 768px, and 375px and verifies:

- `10,000 / 1% / $100 entry / $95 stop = 20 shares`;
- invalid long stop rejection;
- `40% / 2R / 1R = +0.2R` expectancy;
- current RSI, ATR and anchored-VWAP evidence;
- explicit indicator-prediction limitation;
- incomplete trade-plan blocking;
- No Trade acceptance;
- no future replay bar before commitment;
- explicit No Trade replay payload;
- later bar reveal only after commitment;
- no document overflow;
- no blocking browser errors.

The final v0.4 branch is not ready for `main` until the native repository harness, all prior Learn regressions, clean production build, v0.4 browser suite, and exact Vercel preview are green.
