# Signal Learn v0.4

Signal Learn v0.4 adds a short-term trading education path without adding trade alerts, automatic signals, or execution.

## Product loop

`Context -> Setup -> Trigger -> Entry -> Invalidation -> Position size -> Management -> Review`

The release includes:

- sixteen modules covering price behavior, technical transforms, execution, trade construction, risk, expectancy, management, backtesting, statistics, and robustness;
- a responsive candlestick and volume lab with adjustable SMA/EMA, contextual VWAP, RSI, ATR, and structure classification before annotation;
- explicit support/resistance zones, spread, slippage, liquidity, and chart-price versus executable-price limitations;
- complete trade construction with a valid `No Trade` decision;
- long and short educational sizing from account risk, entry, invalidation, and slippage;
- an expectancy comparison that separates win rate from payoff distribution;
- candle-by-candle point-in-time Trading Replay with append-only management actions and process-based debrief;
- a cost-aware next-bar Strategy Lab with sample, win rate, average R, profit factor, drawdown, warnings, and parameter sensitivity;
- a validated browser-local Trade Journal with immutable pre-trade reasoning, appended events, and post-trade review;
- delayed, illustrative current practice where `Observe only` is valid.

## Data and calculation boundaries

`src/lib/learn/v0-4.ts` owns point-in-time SMA, EMA, RSI, VWAP, ATR, risk, expectancy, journal, backtest, and progress contracts. Built-in chart and strategy candles are illustrative educational data. Indicators transform only supplied candles and do not output a trade direction.

Position size is the floor of allowed account risk divided by stop distance plus estimated slippage. Invalid long and short stop directions fail explicitly. Backtests form a signal from data through time T and enter only at the next bar open; fees and slippage reduce results.

## Replay and look-ahead boundary

`GET /api/learn/trading-replay/[caseId]` returns only the initial known-as-of candles and execution assumptions. Future candles remain in `src/lib/learn/v0-4-replay.ts`, which is server-only.

`POST` requires the replay ID, current candle identity, and a complete trade or `No Trade` commitment. It returns only the immediate next candle. Domain regression also injects a candle whose `knownAsOf` precedes its close and proves that the backtest fails closed.

## Journal and compatibility

The Trade Journal stores an immutable original plan. Hold, partial exit, stop adjustment, exit, and thesis-cancel events append; the UI does not rewrite the original from later outcomes. Browser-local validation uses `signal-learn-v0.4-trade-journal`; mastery uses `signal-learn-v0.4-progress`.

v0.1-v0.3 retain their own storage contracts and remain selectable. v0.4 does not place orders, connect to a broker, generate real-time alerts, optimize until profitable, add advanced order flow, or present historical results as future guarantees.

## Verification

- `scripts/harness/learn-v0.4-regression.ts` verifies indicators, timestamp integrity, sizing, expectancy, valid `No Trade`, journal immutability, cost effects, future-data rejection, and progress isolation.
- `npm run qa:learn-v0.4` verifies the responsive end-to-end workflow with deterministic replay fixtures.
- `npm run qa:learn-v0.3`, `npm run qa:learn-v0.2`, and `npm run qa:learn` verify prior release compatibility under the v0.4 default.
