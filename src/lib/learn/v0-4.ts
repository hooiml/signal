export const learnModuleIdsV04 = [
    'price-structure', 'support-resistance', 'moving-averages', 'momentum', 'volume', 'vwap', 'volatility', 'execution',
    'trade-construction', 'risk-reward', 'position-sizing', 'expectancy', 'trade-management', 'backtesting', 'trading-statistics', 'robustness',
] as const;
export type LearnModuleIdV04 = (typeof learnModuleIdsV04)[number];

export type LearnModuleV04 = { readonly id: LearnModuleIdV04; readonly eyebrow: string; readonly title: string; readonly principle: string; readonly concepts: readonly string[]; readonly misconception: string };
export const learnModulesV04: readonly LearnModuleV04[] = [
    { id: 'price-structure', eyebrow: '3.1', title: 'Price structure', principle: 'Classify trend, range, breakout, and failure from price behavior before adding indicators.', concepts: ['Higher highs / lows', 'Lower highs / lows', 'Range', 'Breakout / breakdown', 'Failed break'], misconception: 'A labeled pattern guarantees the next move.' },
    { id: 'support-resistance', eyebrow: '3.2', title: 'Support and resistance', principle: 'Reaction areas are zones with context and invalidation, not magical exact prices.', concepts: ['Prior highs / lows', 'Range boundaries', 'Reaction zones', 'Retests', 'Failed breaks'], misconception: 'Support at exactly $100 must hold.' },
    { id: 'moving-averages', eyebrow: '3.3', title: 'Moving averages', principle: 'SMA and EMA summarize past prices; lookback changes lag and sensitivity.', concepts: ['SMA', 'EMA', 'Lookback', 'Lag', 'Crossovers'], misconception: 'A crossover independently knows the future.' },
    { id: 'momentum', eyebrow: '3.4', title: 'Momentum', principle: 'RSI, MACD, and rate of change describe a calculation state within context.', concepts: ['RSI', 'MACD', 'Rate of change', 'Divergence', 'Persistence'], misconception: 'Overbought is an automatic short signal.' },
    { id: 'volume', eyebrow: '3.5', title: 'Volume and participation', principle: 'Ask whether participation supports the observed move without applying a universal confirmation rule.', concepts: ['Volume', 'Relative volume', 'Expansion', 'Contraction', 'Price / volume relationship'], misconception: 'High volume confirms every breakout.' },
    { id: 'vwap', eyebrow: '3.6', title: 'VWAP and anchored VWAP', principle: 'VWAP is a price-volume reference whose meaning depends on timeframe and anchor choice.', concepts: ['VWAP', 'Intraday reference', 'Anchored VWAP', 'Anchor selection', 'Limitations'], misconception: 'Above VWAP means buy.' },
    { id: 'volatility', eyebrow: '3.7', title: 'Volatility and ATR', principle: 'The same dollar stop represents different noise and risk across volatility regimes.', concepts: ['Daily range', 'ATR', 'Historical volatility', 'Expansion', 'Contraction'], misconception: 'A fixed $1 stop has the same meaning everywhere.' },
    { id: 'execution', eyebrow: '3.8', title: 'Liquidity and execution', principle: 'Displayed chart price can differ from an executable price because of spread, slippage, and impact.', concepts: ['Bid / ask', 'Spread', 'Market / limit / stop', 'Liquidity', 'Slippage'], misconception: 'Every historical close was freely executable at that exact price.' },
    { id: 'trade-construction', eyebrow: '3.9', title: 'Trade construction', principle: 'A complete plan defines context, setup, trigger, entry, invalidation, target, and horizon.', concepts: ['Context', 'Setup', 'Trigger', 'Entry', 'Invalidation / target / horizon'], misconception: 'Indicator says buy is a complete setup.' },
    { id: 'risk-reward', eyebrow: '3.10', title: 'Risk and reward', principle: 'R expresses outcomes relative to the amount deliberately risked.', concepts: ['Risk amount', 'Reward', 'R multiple', 'Reward / risk', 'Asymmetry'], misconception: 'Percentage return alone describes plan quality.' },
    { id: 'position-sizing', eyebrow: '3.11', title: 'Position sizing', principle: 'Allowed account risk divided by invalidation distance determines size.', concepts: ['Account value', 'Risk limit', 'Entry / stop', 'Slippage', 'Notional exposure'], misconception: 'Pick share count first, then decide the stop.' },
    { id: 'expectancy', eyebrow: '3.12', title: 'Expectancy', principle: 'Win rate must be combined with average winner and average loser.', concepts: ['Win rate', 'Average winner', 'Average loser', 'Expectancy', 'Profit factor'], misconception: 'The highest win rate always has the best edge.' },
    { id: 'trade-management', eyebrow: '3.13', title: 'Trade management', principle: 'Separate planned and evidence-based changes from emotional rule violations.', concepts: ['Partial exits', 'Trailing stops', 'Break-even', 'Time stops', 'Stop widening'], misconception: 'Any management change is justified if the trade later wins.' },
    { id: 'backtesting', eyebrow: '3.14', title: 'Backtesting fundamentals', principle: 'Rules at time T may use only information known through T, with executable next-bar fills and costs.', concepts: ['Hypothesis', 'In / out of sample', 'Costs', 'Look-ahead', 'Survivorship / leakage'], misconception: 'A profitable historical curve proves future profitability.' },
    { id: 'trading-statistics', eyebrow: '3.15', title: 'Trading statistics', principle: 'Evaluate the distribution, drawdown, and assumptions rather than total return alone.', concepts: ['Win rate', 'Average R', 'Profit factor', 'Max drawdown', 'R distribution'], misconception: 'Total return alone establishes a robust strategy.' },
    { id: 'robustness', eyebrow: '3.16', title: 'Overfitting and robustness', principle: 'A strategy that collapses after small parameter changes is fragile evidence.', concepts: ['Parameter tuning', 'Multiple testing', 'Regime dependence', 'False discovery', 'Sensitivity'], misconception: 'The best historical parameter is automatically the best future parameter.' },
];

export type CandleV04 = { readonly openTime: string; readonly closeTime: string; readonly open: number; readonly high: number; readonly low: number; readonly close: number; readonly volume: number; readonly knownAsOf: string };
export type IndicatorPointV04 = { readonly time: string; readonly value: number | null };
const buildEducationalCandles = (count: number): readonly CandleV04[] => {
    const candles: CandleV04[] = []; let previousClose = 100;
    for (let index = 0; index < count; index += 1) { const date = new Date(Date.UTC(2024, 0, 2 + index)); const open = previousClose; const regime = index < count / 3 ? 0.16 : index < count * 2 / 3 ? -0.05 : 0.12; const close = Math.max(20, open + regime + Math.sin(index / 3) * 1.25 + Math.cos(index / 7) * 0.55); const high = Math.max(open, close) + 0.7 + Math.abs(Math.sin(index)) * 0.35; const low = Math.min(open, close) - 0.65 - Math.abs(Math.cos(index)) * 0.3; const openTime = new Date(date.getTime() + 14.5 * 60 * 60 * 1000).toISOString(); const closeTime = new Date(date.getTime() + 21 * 60 * 60 * 1000).toISOString(); candles.push({ openTime, closeTime, open, high, low, close, volume: Math.round(800000 + (1 + Math.sin(index / 4)) * 350000 + index * 1200), knownAsOf: closeTime }); previousClose = close; }
    return candles;
};
export const tradingLabCandlesV04 = buildEducationalCandles(48);
export const strategyLabCandlesV04 = buildEducationalCandles(220);
const validPeriod = (period: number) => Number.isInteger(period) && period >= 2 && period <= 200;
const closesThrough = (candles: readonly CandleV04[], index: number) => candles.slice(0, index + 1).map((candle) => candle.close);

export const calculateSmaV04 = (candles: readonly CandleV04[], period: number): readonly IndicatorPointV04[] => candles.map((candle, index) => {
    if (!validPeriod(period) || index + 1 < period) return { time: candle.closeTime, value: null };
    const values = closesThrough(candles, index).slice(-period);
    return { time: candle.closeTime, value: values.reduce((sum, value) => sum + value, 0) / period };
});

export const calculateEmaV04 = (candles: readonly CandleV04[], period: number): readonly IndicatorPointV04[] => {
    if (!validPeriod(period)) return candles.map((candle) => ({ time: candle.closeTime, value: null }));
    const multiplier = 2 / (period + 1); let ema: number | null = null;
    return candles.map((candle, index) => {
        if (index + 1 < period) return { time: candle.closeTime, value: null };
        if (ema === null) ema = candles.slice(0, period).reduce((sum, item) => sum + item.close, 0) / period;
        else ema = (candle.close - ema) * multiplier + ema;
        return { time: candle.closeTime, value: ema };
    });
};

export const calculateRsiV04 = (candles: readonly CandleV04[], period: number): readonly IndicatorPointV04[] => candles.map((candle, index) => {
    if (!validPeriod(period) || index < period) return { time: candle.closeTime, value: null };
    let gains = 0; let losses = 0;
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) { const change = candles[cursor].close - candles[cursor - 1].close; if (change >= 0) gains += change; else losses -= change; }
    if (losses === 0) return { time: candle.closeTime, value: 100 };
    const relativeStrength = (gains / period) / (losses / period);
    return { time: candle.closeTime, value: 100 - (100 / (1 + relativeStrength)) };
});

export const calculateVwapV04 = (candles: readonly CandleV04[], anchorIndex = 0): readonly IndicatorPointV04[] => {
    let priceVolume = 0; let volume = 0;
    return candles.map((candle, index) => { if (index < anchorIndex) return { time: candle.closeTime, value: null }; const typical = (candle.high + candle.low + candle.close) / 3; priceVolume += typical * candle.volume; volume += candle.volume; return { time: candle.closeTime, value: volume > 0 ? priceVolume / volume : null }; });
};

export const calculateAtrV04 = (candles: readonly CandleV04[], period: number): readonly IndicatorPointV04[] => candles.map((candle, index) => {
    if (!validPeriod(period) || index + 1 < period) return { time: candle.closeTime, value: null };
    const start = index - period + 1; let total = 0;
    for (let cursor = start; cursor <= index; cursor += 1) { const previousClose = cursor > 0 ? candles[cursor - 1].close : candles[cursor].open; total += Math.max(candles[cursor].high - candles[cursor].low, Math.abs(candles[cursor].high - previousClose), Math.abs(candles[cursor].low - previousClose)); }
    return { time: candle.closeTime, value: total / period };
});

export type RiskInputsV04 = { readonly direction: 'long' | 'short'; readonly accountValue: number; readonly riskPercent: number; readonly entry: number; readonly stop: number; readonly slippage: number };
export type RiskOutputV04 = { readonly allowedRisk: number; readonly riskPerShare: number; readonly positionSize: number; readonly notional: number; readonly estimatedLoss: number; readonly oneRTarget: number; readonly twoRTarget: number };
export type RiskResultV04 = { readonly output: RiskOutputV04 | null; readonly error: string | null };
export const calculateRiskV04 = (inputs: RiskInputsV04): RiskResultV04 => {
    if (![inputs.accountValue, inputs.riskPercent, inputs.entry, inputs.stop, inputs.slippage].every(Number.isFinite) || inputs.accountValue <= 0 || inputs.riskPercent <= 0 || inputs.riskPercent > 100 || inputs.entry <= 0 || inputs.stop <= 0 || inputs.slippage < 0) return { output: null, error: 'Use positive account, risk, entry, and stop values with non-negative slippage.' };
    if (inputs.direction === 'long' && inputs.stop >= inputs.entry) return { output: null, error: 'A long invalidation must be below entry.' };
    if (inputs.direction === 'short' && inputs.stop <= inputs.entry) return { output: null, error: 'A short invalidation must be above entry.' };
    const allowedRisk = inputs.accountValue * (inputs.riskPercent / 100); const distance = Math.abs(inputs.entry - inputs.stop); const riskPerShare = distance + inputs.slippage; const positionSize = Math.floor(allowedRisk / riskPerShare);
    if (positionSize < 1) return { output: null, error: 'Allowed risk is smaller than the risk of one share.' };
    const direction = inputs.direction === 'long' ? 1 : -1;
    return { output: { allowedRisk, riskPerShare, positionSize, notional: positionSize * inputs.entry, estimatedLoss: positionSize * riskPerShare, oneRTarget: inputs.entry + direction * distance, twoRTarget: inputs.entry + direction * distance * 2 }, error: null };
};

export type ExpectancyInputsV04 = { readonly winRatePercent: number; readonly averageWinnerR: number; readonly averageLoserR: number };
export const calculateExpectancyV04 = ({ winRatePercent, averageWinnerR, averageLoserR }: ExpectancyInputsV04): { expectancyR: number; profitFactor: number | null } | null => {
    if (![winRatePercent, averageWinnerR, averageLoserR].every(Number.isFinite) || winRatePercent < 0 || winRatePercent > 100 || averageWinnerR < 0 || averageLoserR <= 0) return null;
    const winRate = winRatePercent / 100; const lossRate = 1 - winRate; const lossContribution = lossRate * averageLoserR;
    return { expectancyR: winRate * averageWinnerR - lossContribution, profitFactor: lossContribution > 0 ? (winRate * averageWinnerR) / lossContribution : null };
};

export type TradeConstructionV04 = { readonly decision: 'trade' | 'no-trade'; readonly context: string; readonly setup: string; readonly trigger: string; readonly entry: number; readonly invalidation: number; readonly target: number; readonly horizon: string; readonly positionSize: number; readonly accountRisk: number; readonly confidence: number; readonly reasonNoTrade: string };
const boundedText = (value: unknown, max = 1200): value is string => typeof value === 'string' && value.trim().length >= 3 && value.length <= max;
export const isTradeConstructionV04 = (value: unknown): value is TradeConstructionV04 => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false; const item = value as Record<string, unknown>;
    if (!['trade', 'no-trade'].includes(String(item.decision)) || !boundedText(item.context) || !boundedText(item.setup) || !boundedText(item.horizon) || typeof item.confidence !== 'number' || item.confidence < 0 || item.confidence > 100) return false;
    if (item.decision === 'no-trade') return boundedText(item.reasonNoTrade);
    return boundedText(item.trigger) && [item.entry, item.invalidation, item.target, item.positionSize, item.accountRisk].every((number) => typeof number === 'number' && Number.isFinite(number) && number > 0);
};

export type TradeEventTypeV04 = 'hold' | 'partial-exit' | 'adjust-stop' | 'exit' | 'cancel-thesis';
export type TradeEventV04 = { readonly id: string; readonly createdAt: string; readonly type: TradeEventTypeV04; readonly reason: string; readonly value: number | null };
export type TradeJournalV04 = { readonly id: string; readonly createdAt: string; readonly original: TradeConstructionV04; readonly events: readonly TradeEventV04[]; readonly debrief: { readonly realizedR: number | null; readonly adherence: string; readonly wentWell: string; readonly failed: string } | null };
export const appendTradeEventV04 = (journal: TradeJournalV04, event: TradeEventV04): TradeJournalV04 => ({ ...journal, events: [...journal.events, event] });

export const parseTradeJournalV04 = (value: unknown): TradeJournalV04 | null => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null; const item = value as Record<string, unknown>;
    if (!boundedText(item.id, 120) || !boundedText(item.createdAt, 80) || !isTradeConstructionV04(item.original) || !Array.isArray(item.events) || item.events.length > 100) return null;
    const events = item.events.filter((event): event is TradeEventV04 => { if (typeof event !== 'object' || event === null || Array.isArray(event)) return false; const candidate = event as Record<string, unknown>; return boundedText(candidate.id, 120) && boundedText(candidate.createdAt, 80) && ['hold', 'partial-exit', 'adjust-stop', 'exit', 'cancel-thesis'].includes(String(candidate.type)) && boundedText(candidate.reason) && (candidate.value === null || (typeof candidate.value === 'number' && Number.isFinite(candidate.value))); });
    if (events.length !== item.events.length) return null;
    const debrief = item.debrief === null ? null : (() => { if (typeof item.debrief !== 'object' || Array.isArray(item.debrief)) return null; const candidate = item.debrief as Record<string, unknown>; return (candidate.realizedR === null || (typeof candidate.realizedR === 'number' && Number.isFinite(candidate.realizedR))) && boundedText(candidate.adherence) && boundedText(candidate.wentWell) && boundedText(candidate.failed) ? candidate as TradeJournalV04['debrief'] : null; })();
    if (item.debrief !== null && debrief === null) return null;
    return { id: item.id, createdAt: item.createdAt, original: item.original, events, debrief };
};

export type BacktestInputsV04 = { readonly fastLookback: number; readonly slowLookback: number; readonly holdingBars: number; readonly costBps: number; readonly slippageBps: number };
export type BacktestResultV04 = { readonly sampleCount: number; readonly winRate: number; readonly averageR: number; readonly expectancyR: number; readonly profitFactor: number | null; readonly maxDrawdownR: number; readonly warnings: readonly string[]; readonly trades: readonly number[] };
export const runBacktestV04 = (candles: readonly CandleV04[], inputs: BacktestInputsV04): BacktestResultV04 | null => {
    if (!validPeriod(inputs.fastLookback) || !validPeriod(inputs.slowLookback) || inputs.fastLookback >= inputs.slowLookback || !Number.isInteger(inputs.holdingBars) || inputs.holdingBars < 1 || inputs.holdingBars > 50 || inputs.costBps < 0 || inputs.slippageBps < 0) return null;
    if (candles.some((candle) => !Number.isFinite(candle.open) || !Number.isFinite(candle.close) || new Date(candle.knownAsOf).getTime() < new Date(candle.closeTime).getTime())) return null;
    const fast = calculateSmaV04(candles, inputs.fastLookback); const slow = calculateSmaV04(candles, inputs.slowLookback); const trades: number[] = [];
    for (let signalIndex = inputs.slowLookback; signalIndex + 1 + inputs.holdingBars < candles.length; signalIndex += 1) {
        const previousFast = fast[signalIndex - 1].value; const previousSlow = slow[signalIndex - 1].value; const currentFast = fast[signalIndex].value; const currentSlow = slow[signalIndex].value;
        if (previousFast === null || previousSlow === null || currentFast === null || currentSlow === null || !(previousFast <= previousSlow && currentFast > currentSlow)) continue;
        const entryIndex = signalIndex + 1; const exitIndex = entryIndex + inputs.holdingBars; const entry = candles[entryIndex].open; const exit = candles[exitIndex].open; const gross = (exit - entry) / entry; const costs = (inputs.costBps + inputs.slippageBps) / 10000; trades.push((gross - costs) / 0.01);
    }
    const wins = trades.filter((trade) => trade > 0); const losses = trades.filter((trade) => trade <= 0); const averageR = trades.length ? trades.reduce((sum, trade) => sum + trade, 0) / trades.length : 0; const profit = wins.reduce((sum, trade) => sum + trade, 0); const loss = Math.abs(losses.reduce((sum, trade) => sum + trade, 0)); let equity = 0; let peak = 0; let maxDrawdownR = 0;
    for (const trade of trades) { equity += trade; peak = Math.max(peak, equity); maxDrawdownR = Math.max(maxDrawdownR, peak - equity); }
    const warnings = [trades.length < 30 ? 'Insufficient sample: fewer than 30 trades.' : null, inputs.costBps === 0 && inputs.slippageBps === 0 ? 'Missing transaction-cost assumptions.' : null, 'Single-fixture result may be concentrated in one regime.', 'Historical results are not future guarantees.'].filter((warning): warning is string => warning !== null);
    return { sampleCount: trades.length, winRate: trades.length ? wins.length / trades.length * 100 : 0, averageR, expectancyR: averageR, profitFactor: loss > 0 ? profit / loss : null, maxDrawdownR, warnings, trades };
};

export type LearnProgressV04 = { readonly version: 4; readonly completedModules: readonly LearnModuleIdV04[]; readonly completedWorkspaces: readonly string[] };
export const emptyLearnProgressV04 = (): LearnProgressV04 => ({ version: 4, completedModules: [], completedWorkspaces: [] });
export const parseLearnProgressV04 = (value: unknown): LearnProgressV04 => { if (typeof value !== 'object' || value === null || Array.isArray(value)) return emptyLearnProgressV04(); const item = value as Record<string, unknown>; if (item.version !== 4) return emptyLearnProgressV04(); const completedModules = Array.isArray(item.completedModules) ? [...new Set(item.completedModules.filter((id): id is LearnModuleIdV04 => typeof id === 'string' && learnModuleIdsV04.includes(id as LearnModuleIdV04)))] : []; const completedWorkspaces = Array.isArray(item.completedWorkspaces) ? [...new Set(item.completedWorkspaces.filter((id): id is string => typeof id === 'string' && id.length <= 40))].slice(0, 12) : []; return { version: 4, completedModules, completedWorkspaces }; };
