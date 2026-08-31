import {
    appendTradeEventV04, calculateAtrV04, calculateEmaV04, calculateExpectancyV04, calculateRiskV04, calculateRsiV04, calculateSmaV04, calculateVwapV04,
    isTradeConstructionV04, learnModulesV04, parseLearnProgressV04, parseTradeJournalV04, runBacktestV04, strategyLabCandlesV04, tradingLabCandlesV04, type TradeJournalV04,
} from '../../src/lib/learn/v0-4';

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
assert(learnModulesV04.length === 16, 'v0.4 must expose all sixteen trading modules');

const sma = calculateSmaV04(tradingLabCandlesV04, 5); const ema = calculateEmaV04(tradingLabCandlesV04, 5); const rsi = calculateRsiV04(tradingLabCandlesV04, 14); const vwap = calculateVwapV04(tradingLabCandlesV04, 5); const atr = calculateAtrV04(tradingLabCandlesV04, 14);
assert(sma.slice(0, 4).every((point) => point.value === null) && sma[4].value !== null, 'SMA must wait for its complete lookback');
assert(ema.slice(0, 4).every((point) => point.value === null) && ema[4].value !== null, 'EMA must seed only after its complete lookback');
assert(rsi[13].value === null && rsi[14].value !== null && rsi[14].value! >= 0 && rsi[14].value! <= 100, 'RSI must be bounded and point-in-time');
assert(vwap.slice(0, 5).every((point) => point.value === null) && vwap[5].value !== null, 'anchored VWAP must exclude candles before the selected anchor');
assert(atr[13].value !== null && atr[13].value! > 0, 'ATR must use bounded true ranges');
const earlierSma = calculateSmaV04(tradingLabCandlesV04.slice(0, 20), 5); assert(earlierSma[19].value === sma[19].value, 'future candles must not rewrite an earlier indicator value');

const risk = calculateRiskV04({ direction: 'long', accountValue: 25000, riskPercent: 1, entry: 100, stop: 97.5, slippage: 0.1 });
assert(risk.output?.positionSize === 96 && risk.output.estimatedLoss === 249.60000000000002, 'position size must derive from allowed risk and stop distance including slippage');
const widerStop = calculateRiskV04({ direction: 'long', accountValue: 25000, riskPercent: 1, entry: 100, stop: 95, slippage: 0.1 }); assert(widerStop.output !== null && widerStop.output.positionSize < risk.output!.positionSize, 'a wider stop must immediately reduce position size');
assert(calculateRiskV04({ direction: 'long', accountValue: 25000, riskPercent: 1, entry: 100, stop: 101, slippage: 0 }).error === 'A long invalidation must be below entry.', 'invalid long stop direction must fail explicitly');
assert(calculateRiskV04({ direction: 'short', accountValue: 25000, riskPercent: 1, entry: 100, stop: 98, slippage: 0 }).error === 'A short invalidation must be above entry.', 'invalid short stop direction must fail explicitly');

const highWin = calculateExpectancyV04({ winRatePercent: 75, averageWinnerR: 0.4, averageLoserR: 1.5 })!; const lowerWin = calculateExpectancyV04({ winRatePercent: 42, averageWinnerR: 2.4, averageLoserR: 0.9 })!;
assert(highWin.expectancyR < 0 && lowerWin.expectancyR > 0, 'expectancy must distinguish payoff distribution from win rate');

const noTrade = { decision: 'no-trade' as const, context: 'Range boundary.', setup: 'No confirmed trigger.', trigger: '', entry: 0, invalidation: 0, target: 0, horizon: 'Intraday', positionSize: 0, accountRisk: 0, confidence: 40, reasonNoTrade: 'Spread is too wide and trigger is absent.' };
assert(isTradeConstructionV04(noTrade), 'No Trade must be a valid complete decision');
assert(!isTradeConstructionV04({ ...noTrade, decision: 'trade', reasonNoTrade: '' }), 'a trade must require trigger, entry, invalidation, target, size, and risk');

const journal: TradeJournalV04 = { id: 'journal-1', createdAt: '2026-01-01T00:00:00.000Z', original: noTrade, events: [], debrief: null }; const updated = appendTradeEventV04(journal, { id: 'event-1', createdAt: '2026-01-01T01:00:00.000Z', type: 'hold', reason: 'Conditions remain incomplete.', value: null });
assert(updated.original === journal.original && journal.events.length === 0 && updated.events.length === 1, 'trade events must append without mutating the original plan');
assert(parseTradeJournalV04(updated)?.events.length === 1, 'validated trade journal must round-trip');
assert(parseTradeJournalV04({ ...updated, events: [{ ...updated.events[0], type: 'rewrite-original' }] }) === null, 'unknown journal event types must fail closed');

const withCosts = runBacktestV04(strategyLabCandlesV04, { fastLookback: 5, slowLookback: 14, holdingBars: 5, costBps: 4, slippageBps: 6 }); const withoutCosts = runBacktestV04(strategyLabCandlesV04, { fastLookback: 5, slowLookback: 14, holdingBars: 5, costBps: 0, slippageBps: 0 });
if (withCosts === null || withoutCosts === null) throw new Error('strategy lab must produce a bounded historical sample');
assert(withCosts.sampleCount > 0, 'strategy lab must produce a bounded historical sample');
assert(withCosts.averageR < withoutCosts.averageR, 'transaction costs and slippage must reduce every otherwise-identical result');
const contaminated = strategyLabCandlesV04.map((candle, index) => index === 20 ? { ...candle, knownAsOf: new Date(new Date(candle.closeTime).getTime() - 1000).toISOString() } : candle); assert(runBacktestV04(contaminated, { fastLookback: 5, slowLookback: 14, holdingBars: 5, costBps: 4, slippageBps: 6 }) === null, 'backtest must reject candles not known at their close timestamp');

const progress = parseLearnProgressV04({ version: 4, completedModules: ['price-structure', 'unknown', 'price-structure'], completedWorkspaces: ['risk', 'risk'] }); assert(progress.completedModules.length === 1 && progress.completedWorkspaces.length === 1, 'v0.4 progress must deduplicate and reject unknown entries'); assert(parseLearnProgressV04({ version: 3, completedModules: ['price-structure'] }).completedModules.length === 0, 'v0.3 progress must not be interpreted as v0.4 progress');
console.log('Signal Learn v0.4 regression tests passed.');
