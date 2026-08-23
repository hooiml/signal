import type { ResearchChartPoint } from '@/lib/types/research-snapshot';

export const tradingModuleIdsV04 = [
    'price-structure',
    'support-resistance',
    'moving-averages',
    'momentum',
    'volume',
    'vwap',
    'volatility',
    'execution',
    'trade-construction',
    'risk-reward',
    'position-sizing',
    'expectancy',
    'trade-management',
    'backtesting',
    'statistics',
    'overfitting',
] as const;

export type TradingModuleIdV04 = typeof tradingModuleIdsV04[number];

export const tradingModulesV04: readonly {
    readonly id: TradingModuleIdV04;
    readonly eyebrow: string;
    readonly title: string;
    readonly objective: string;
}[] = [
    { id: 'price-structure', eyebrow: '3.1', title: 'Price structure', objective: 'Read trend, range, consolidation, breakout, breakdown, and failure before adding indicators.' },
    { id: 'support-resistance', eyebrow: '3.2', title: 'Support & resistance', objective: 'Treat prior reaction areas as contextual zones rather than magical exact prices.' },
    { id: 'moving-averages', eyebrow: '3.3', title: 'Moving averages', objective: 'Use SMA and EMA as lagging summaries of price history, not independent forecasts.' },
    { id: 'momentum', eyebrow: '3.4', title: 'Momentum', objective: 'Interpret RSI, MACD, rate of change, and persistence without deterministic overbought/oversold rules.' },
    { id: 'volume', eyebrow: '3.5', title: 'Volume & participation', objective: 'Ask how much participation accompanies a move while respecting volume limitations.' },
    { id: 'vwap', eyebrow: '3.6', title: 'VWAP & anchored VWAP', objective: 'Use volume-weighted reference prices as context rather than Buy/Sell boundaries.' },
    { id: 'volatility', eyebrow: '3.7', title: 'Volatility & ATR', objective: 'Connect expected movement to invalidation distance and position sizing.' },
    { id: 'execution', eyebrow: '3.8', title: 'Liquidity & execution', objective: 'Understand bid/ask, spread, order types, slippage, and why chart price is not guaranteed execution price.' },
    { id: 'trade-construction', eyebrow: '3.9', title: 'Trade construction', objective: 'Define context, setup, trigger, entry, invalidation, target, and horizon before evaluating an outcome.' },
    { id: 'risk-reward', eyebrow: '3.10', title: 'Risk / reward', objective: 'Measure outcomes in risk units and understand asymmetric payoff rather than focusing only on percent return.' },
    { id: 'position-sizing', eyebrow: '3.11', title: 'Position sizing', objective: 'Derive size from allowed account risk and invalidation distance, not conviction.' },
    { id: 'expectancy', eyebrow: '3.12', title: 'Expectancy', objective: 'Combine win rate, average winner, and average loser to understand strategy economics.' },
    { id: 'trade-management', eyebrow: '3.13', title: 'Trade management', objective: 'Separate planned management from emotional changes to stops, targets, and exits.' },
    { id: 'backtesting', eyebrow: '3.14', title: 'Backtesting fundamentals', objective: 'Define rules, sample boundaries, costs, and out-of-sample checks while avoiding look-ahead and leakage.' },
    { id: 'statistics', eyebrow: '3.15', title: 'Trading statistics', objective: 'Evaluate distributions, expectancy, profit factor, and drawdown rather than total return alone.' },
    { id: 'overfitting', eyebrow: '3.16', title: 'Overfitting & robustness', objective: 'Recognize fragile parameter tuning, regime dependence, and false discovery.' },
];

export type PositionSizeResultV04 = {
    readonly valid: boolean;
    readonly error: string | null;
    readonly riskBudget: number | null;
    readonly riskPerShare: number | null;
    readonly shares: number | null;
    readonly notional: number | null;
    readonly estimatedLoss: number | null;
};

export const calculatePositionSizeV04 = (
    accountValue: number,
    riskPercent: number,
    entry: number,
    stop: number,
    slippagePerShare = 0,
): PositionSizeResultV04 => {
    if (![accountValue, riskPercent, entry, stop, slippagePerShare].every(Number.isFinite)) {
        return { valid: false, error: 'All inputs must be finite numbers.', riskBudget: null, riskPerShare: null, shares: null, notional: null, estimatedLoss: null };
    }
    if (accountValue <= 0 || riskPercent <= 0 || riskPercent > 100 || entry <= 0 || stop <= 0 || slippagePerShare < 0) {
        return { valid: false, error: 'Account value, risk, entry, and stop must be positive; slippage cannot be negative.', riskBudget: null, riskPerShare: null, shares: null, notional: null, estimatedLoss: null };
    }
    if (stop >= entry) {
        return { valid: false, error: 'This v0.4 long-practice calculator requires the invalidation stop below entry.', riskBudget: null, riskPerShare: null, shares: null, notional: null, estimatedLoss: null };
    }
    const riskBudget = accountValue * (riskPercent / 100);
    const riskPerShare = (entry - stop) + slippagePerShare;
    if (riskPerShare <= 0) {
        return { valid: false, error: 'Risk per share must be positive.', riskBudget: null, riskPerShare: null, shares: null, notional: null, estimatedLoss: null };
    }
    const shares = Math.floor(riskBudget / riskPerShare);
    if (shares < 1) {
        return { valid: false, error: 'The risk budget is too small for one share at this invalidation distance.', riskBudget, riskPerShare, shares: 0, notional: 0, estimatedLoss: 0 };
    }
    return {
        valid: true,
        error: null,
        riskBudget,
        riskPerShare,
        shares,
        notional: shares * entry,
        estimatedLoss: shares * riskPerShare,
    };
};

export const calculateRMultipleV04 = (entry: number, stop: number, exit: number): number | null => {
    if (![entry, stop, exit].every(Number.isFinite) || entry <= 0 || stop <= 0 || stop >= entry) return null;
    const risk = entry - stop;
    return (exit - entry) / risk;
};

export const calculateExpectancyV04 = (
    winRatePercent: number,
    averageWinnerR: number,
    averageLoserR: number,
): number | null => {
    if (![winRatePercent, averageWinnerR, averageLoserR].every(Number.isFinite)
        || winRatePercent < 0 || winRatePercent > 100 || averageWinnerR < 0 || averageLoserR < 0) return null;
    const winProbability = winRatePercent / 100;
    return (winProbability * averageWinnerR) - ((1 - winProbability) * averageLoserR);
};

export const calculateProfitFactorV04 = (
    winRatePercent: number,
    averageWinnerR: number,
    averageLoserR: number,
): number | null => {
    if (![winRatePercent, averageWinnerR, averageLoserR].every(Number.isFinite)
        || winRatePercent < 0 || winRatePercent > 100 || averageWinnerR < 0 || averageLoserR <= 0) return null;
    const winProbability = winRatePercent / 100;
    const grossWin = winProbability * averageWinnerR;
    const grossLoss = (1 - winProbability) * averageLoserR;
    return grossLoss === 0 ? null : grossWin / grossLoss;
};

export type TradePlanV04 = {
    readonly noTrade: false;
    readonly context: string;
    readonly setup: string;
    readonly trigger: string;
    readonly entry: number;
    readonly stop: number;
    readonly target: number;
    readonly horizon: string;
    readonly confidence: number;
};

export type NoTradePlanV04 = {
    readonly noTrade: true;
    readonly reason: string;
    readonly confidence: number;
};

export type TradingDecisionV04 = TradePlanV04 | NoTradePlanV04;

const boundedText = (value: unknown, maxLength = 700) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;

export const isTradingDecisionV04 = (value: unknown): value is TradingDecisionV04 => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const record = value as Record<string, unknown>;
    if (record.noTrade === true) {
        return boundedText(record.reason)
            && typeof record.confidence === 'number'
            && Number.isInteger(record.confidence)
            && record.confidence >= 0
            && record.confidence <= 100;
    }
    if (record.noTrade !== false) return false;
    return boundedText(record.context)
        && boundedText(record.setup)
        && boundedText(record.trigger)
        && boundedText(record.horizon, 120)
        && typeof record.entry === 'number' && Number.isFinite(record.entry) && record.entry > 0
        && typeof record.stop === 'number' && Number.isFinite(record.stop) && record.stop > 0 && record.stop < record.entry
        && typeof record.target === 'number' && Number.isFinite(record.target) && record.target > record.entry
        && typeof record.confidence === 'number' && Number.isInteger(record.confidence) && record.confidence >= 0 && record.confidence <= 100;
};

export type TradingReplayPointV04 = Pick<ResearchChartPoint,
    'time' | 'open' | 'high' | 'low' | 'close' | 'volume' | 'ma50' | 'ma200' | 'ema20' | 'ema50' |
    'averageVolume20' | 'rsi14' | 'macd' | 'macdSignal' | 'macdHistogram' | 'atr14' | 'atrPercent14' |
    'anchoredVwap' | 'adx14' | 'plusDi14' | 'minusDi14' | 'supertrend' | 'supertrendDirection'>;

export type TradingReplayIntroV04 = {
    readonly symbol: string;
    readonly market: 'US';
    readonly replayId: string;
    readonly cutoffDate: string;
    readonly points: readonly TradingReplayPointV04[];
    readonly current: TradingReplayPointV04;
    readonly sources: readonly string[];
    readonly fetchedAt: string;
    readonly limitations: readonly string[];
};

export type TradingReplayRevealV04 = TradingReplayIntroV04 & {
    readonly nextPoints: readonly TradingReplayPointV04[];
    readonly decision: TradingDecisionV04;
};

export const selectTradingReplayCutoffV04 = (points: readonly ResearchChartPoint[]): number | null => {
    if (points.length < 80) return null;
    const minimum = 60;
    const latestWithReveal = points.length - 6;
    const candidate = Math.floor(points.length * 0.75);
    const cutoff = Math.max(minimum, Math.min(latestWithReveal, candidate));
    return cutoff >= 0 && cutoff < points.length - 1 ? cutoff : null;
};

export const toTradingReplayPointV04 = (point: ResearchChartPoint): TradingReplayPointV04 => ({
    time: point.time,
    open: point.open,
    high: point.high,
    low: point.low,
    close: point.close,
    volume: point.volume,
    ma50: point.ma50,
    ma200: point.ma200,
    ema20: point.ema20,
    ema50: point.ema50,
    averageVolume20: point.averageVolume20,
    rsi14: point.rsi14,
    macd: point.macd,
    macdSignal: point.macdSignal,
    macdHistogram: point.macdHistogram,
    atr14: point.atr14,
    atrPercent14: point.atrPercent14,
    anchoredVwap: point.anchoredVwap,
    adx14: point.adx14,
    plusDi14: point.plusDi14,
    minusDi14: point.minusDi14,
    supertrend: point.supertrend,
    supertrendDirection: point.supertrendDirection,
});
