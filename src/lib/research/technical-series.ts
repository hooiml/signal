export type OhlcvPoint = {
    readonly high: number;
    readonly low: number;
    readonly close: number;
    readonly volume: number | null;
};

export type TechnicalSeriesOptions = {
    /** The first bar included in the anchored VWAP. Defaults to the range start (0). */
    readonly anchoredVwapAnchor?: number | 'range-start';
    /** Alias for callers that already use `anchorIndex` terminology. */
    readonly anchorIndex?: number | 'range-start';
    readonly supertrendPeriod?: number;
    readonly supertrendMultiplier?: number;
};

export type TechnicalSeriesPoint = {
    /** `ma50` and `ma200` remain as SMA aliases for existing consumers. */
    readonly ma50: number | null;
    readonly ma200: number | null;
    readonly ema20: number | null;
    readonly ema50: number | null;
    readonly sma200: number | null;
    readonly averageVolume20: number | null;
    readonly rsi14: number | null;
    readonly macd: number | null;
    readonly macdSignal: number | null;
    readonly macdHistogram: number | null;
    readonly atr14: number | null;
    readonly atrPercent14: number | null;
    readonly anchoredVwap: number | null;
    readonly adx14: number | null;
    readonly plusDi14: number | null;
    readonly minusDi14: number | null;
    readonly supertrend: number | null;
    readonly supertrendDirection: 1 | -1 | null;
};

const round = (value: number, decimals = 2) => Number(value.toFixed(decimals));
const periodValue = (period: number, fallback: number) => Number.isInteger(period) && period > 0 ? period : fallback;

export const simpleMovingAverageSeries = (values: readonly (number | null)[], period: number) => {
    const safePeriod = periodValue(period, 1);
    return values.map((_, index) => {
        if (index + 1 < safePeriod) return null;
        const window = values.slice(index + 1 - safePeriod, index + 1);
        if (window.some((value) => value === null)) return null;
        return window.reduce<number>((sum, value) => sum + (value ?? 0), 0) / safePeriod;
    });
};

export const exponentialMovingAverageSeries = (values: readonly (number | null)[], period: number) => {
    const safePeriod = periodValue(period, 1);
    const result: Array<number | null> = Array(values.length).fill(null);
    const multiplier = 2 / (safePeriod + 1);
    let seed: number[] = [];
    let current: number | null = null;
    values.forEach((value, index) => {
        if (value === null) {
            seed = [];
            current = null;
            return;
        }
        if (current === null) {
            seed = [...seed, value];
            if (seed.length === safePeriod) {
                current = seed.reduce((sum, item) => sum + item, 0) / safePeriod;
                result[index] = current;
            }
            return;
        }
        current = (value - current) * multiplier + current;
        result[index] = current;
    });
    return result;
};

export const trueRangeSeries = (points: readonly OhlcvPoint[]) => points.map((point, index) => index === 0
    ? Math.max(0, point.high - point.low)
    : Math.max(0, point.high - point.low, Math.abs(point.high - points[index - 1].close), Math.abs(point.low - points[index - 1].close)));

/** Wilder ATR, seeded with the mean of the first `period` true ranges. */
export const atrSeries = (points: readonly OhlcvPoint[], period = 14) => {
    const safePeriod = periodValue(period, 14);
    const result: Array<number | null> = Array(points.length).fill(null);
    if (points.length < safePeriod) return result;
    const trueRanges = trueRangeSeries(points);
    let atr = trueRanges.slice(0, safePeriod).reduce((sum, value) => sum + value, 0) / safePeriod;
    result[safePeriod - 1] = atr;
    for (let index = safePeriod; index < points.length; index += 1) {
        atr = ((atr * (safePeriod - 1)) + trueRanges[index]) / safePeriod;
        result[index] = atr;
    }
    return result;
};

export const atrPercentSeries = (points: readonly OhlcvPoint[], period = 14) => {
    const atr = atrSeries(points, period);
    return atr.map((value, index) => value === null || points[index].close === 0
        ? null
        : (value / Math.abs(points[index].close)) * 100);
};

const rsiSeries = (closes: readonly number[], period = 14) => {
    const safePeriod = periodValue(period, 14);
    const result: Array<number | null> = Array(closes.length).fill(null);
    if (closes.length <= safePeriod) return result;
    let averageGain = 0;
    let averageLoss = 0;
    for (let index = 1; index <= safePeriod; index += 1) {
        const change = closes[index] - closes[index - 1];
        averageGain += Math.max(change, 0);
        averageLoss += Math.max(-change, 0);
    }
    averageGain /= safePeriod;
    averageLoss /= safePeriod;
    const value = () => averageLoss === 0 ? averageGain === 0 ? 50 : 100 : 100 - (100 / (1 + averageGain / averageLoss));
    result[safePeriod] = value();
    for (let index = safePeriod + 1; index < closes.length; index += 1) {
        const change = closes[index] - closes[index - 1];
        averageGain = ((averageGain * (safePeriod - 1)) + Math.max(change, 0)) / safePeriod;
        averageLoss = ((averageLoss * (safePeriod - 1)) + Math.max(-change, 0)) / safePeriod;
        result[index] = value();
    }
    return result;
};

export const anchoredVwapSeries = (
    points: readonly OhlcvPoint[],
    anchor: number | 'range-start' = 'range-start',
) => {
    const result: Array<number | null> = Array(points.length).fill(null);
    if (points.length === 0) return result;
    const requested = anchor === 'range-start' ? 0 : anchor;
    const anchorIndex = Number.isInteger(requested) ? Math.min(points.length - 1, Math.max(0, requested)) : 0;
    let priceVolume = 0;
    let volume = 0;
    for (let index = anchorIndex; index < points.length; index += 1) {
        const point = points[index];
        if (point.volume !== null && Number.isFinite(point.volume) && point.volume > 0) {
            const typicalPrice = (point.high + point.low + point.close) / 3;
            priceVolume += typicalPrice * point.volume;
            volume += point.volume;
        }
        result[index] = volume > 0 ? priceVolume / volume : null;
    }
    return result;
};

export type DirectionalMovementSeries = {
    readonly adx: readonly (number | null)[];
    readonly plusDi: readonly (number | null)[];
    readonly minusDi: readonly (number | null)[];
};

/** Wilder directional movement and ADX. The first ADX is available after two full windows. */
export const directionalMovementSeries = (points: readonly OhlcvPoint[], period = 14): DirectionalMovementSeries => {
    const safePeriod = periodValue(period, 14);
    const adx: Array<number | null> = Array(points.length).fill(null);
    const plusDi: Array<number | null> = Array(points.length).fill(null);
    const minusDi: Array<number | null> = Array(points.length).fill(null);
    if (points.length < safePeriod) return { adx, plusDi, minusDi };
    const trueRanges = trueRangeSeries(points);
    const plusMoves = points.map((point, index) => {
        if (index === 0) return 0;
        const up = point.high - points[index - 1].high;
        const down = points[index - 1].low - point.low;
        return up > down && up > 0 ? up : 0;
    });
    const minusMoves = points.map((point, index) => {
        if (index === 0) return 0;
        const up = point.high - points[index - 1].high;
        const down = points[index - 1].low - point.low;
        return down > up && down > 0 ? down : 0;
    });
    let smoothedTr = trueRanges.slice(0, safePeriod).reduce((sum, value) => sum + value, 0);
    let smoothedPlus = plusMoves.slice(0, safePeriod).reduce((sum, value) => sum + value, 0);
    let smoothedMinus = minusMoves.slice(0, safePeriod).reduce((sum, value) => sum + value, 0);
    const dx: Array<number | null> = Array(points.length).fill(null);
    const assign = (index: number) => {
        if (smoothedTr <= 0) {
            plusDi[index] = 0;
            minusDi[index] = 0;
            dx[index] = 0;
            return;
        }
        const plus = (smoothedPlus / smoothedTr) * 100;
        const minus = (smoothedMinus / smoothedTr) * 100;
        plusDi[index] = plus;
        minusDi[index] = minus;
        dx[index] = plus + minus === 0 ? 0 : (Math.abs(plus - minus) / (plus + minus)) * 100;
    };
    assign(safePeriod - 1);
    for (let index = safePeriod; index < points.length; index += 1) {
        smoothedTr = smoothedTr - (smoothedTr / safePeriod) + trueRanges[index];
        smoothedPlus = smoothedPlus - (smoothedPlus / safePeriod) + plusMoves[index];
        smoothedMinus = smoothedMinus - (smoothedMinus / safePeriod) + minusMoves[index];
        assign(index);
    }
    const firstAdx = (safePeriod - 1) + (safePeriod - 1);
    if (points.length > firstAdx) {
        const initialDx = dx.slice(safePeriod - 1, firstAdx + 1).map((value) => value ?? 0);
        let current = initialDx.reduce((sum, value) => sum + value, 0) / safePeriod;
        adx[firstAdx] = current;
        for (let index = firstAdx + 1; index < points.length; index += 1) {
            current = ((current * (safePeriod - 1)) + (dx[index] ?? 0)) / safePeriod;
            adx[index] = current;
        }
    }
    return { adx, plusDi, minusDi };
};

export type SupertrendPoint = {
    readonly value: number | null;
    readonly direction: 1 | -1 | null;
};

/** Supertrend using Wilder ATR and explicit period/multiplier parameters. */
export const supertrendSeries = (points: readonly OhlcvPoint[], period = 10, multiplier = 3): readonly SupertrendPoint[] => {
    const safePeriod = periodValue(period, 10);
    const safeMultiplier = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 3;
    const atr = atrSeries(points, safePeriod);
    const result: SupertrendPoint[] = points.map(() => ({ value: null, direction: null }));
    let finalUpper: number | null = null;
    let finalLower: number | null = null;
    let direction: 1 | -1 = 1;
    for (let index = safePeriod - 1; index < points.length; index += 1) {
        const currentAtr = atr[index];
        if (currentAtr === null) continue;
        const midpoint = (points[index].high + points[index].low) / 2;
        const basicUpper = midpoint + safeMultiplier * currentAtr;
        const basicLower = midpoint - safeMultiplier * currentAtr;
        if (index === safePeriod - 1 || finalUpper === null || finalLower === null) {
            finalUpper = basicUpper;
            finalLower = basicLower;
        } else {
            finalUpper = basicUpper < finalUpper || points[index - 1].close > finalUpper ? basicUpper : finalUpper;
            finalLower = basicLower > finalLower || points[index - 1].close < finalLower ? basicLower : finalLower;
        }
        if (direction === -1 && points[index].close > finalUpper) direction = 1;
        else if (direction === 1 && points[index].close < finalLower) direction = -1;
        result[index] = { value: direction === 1 ? finalLower : finalUpper, direction };
    }
    return result;
};

export const calculateTechnicalSeries = (
    points: readonly OhlcvPoint[],
    options: TechnicalSeriesOptions = {},
): readonly TechnicalSeriesPoint[] => {
    const closes = points.map((point) => point.close);
    const volumes = points.map((point) => point.volume);
    const sma50 = simpleMovingAverageSeries(closes, 50);
    const sma200 = simpleMovingAverageSeries(closes, 200);
    const ema20 = exponentialMovingAverageSeries(closes, 20);
    const ema50 = exponentialMovingAverageSeries(closes, 50);
    const averageVolume20 = simpleMovingAverageSeries(volumes, 20);
    const rsi14 = rsiSeries(closes);
    const fast = exponentialMovingAverageSeries(closes, 12);
    const slow = exponentialMovingAverageSeries(closes, 26);
    const macd = closes.map((_, index) => fast[index] === null || slow[index] === null ? null : (fast[index] ?? 0) - (slow[index] ?? 0));
    const macdSignal = exponentialMovingAverageSeries(macd, 9);
    const atr14 = atrSeries(points, 14);
    const atrPercent14 = atrPercentSeries(points, 14);
    const anchoredVwap = anchoredVwapSeries(points, options.anchoredVwapAnchor ?? options.anchorIndex ?? 'range-start');
    const directional = directionalMovementSeries(points, 14);
    const supertrend = supertrendSeries(points, options.supertrendPeriod ?? 10, options.supertrendMultiplier ?? 3);
    return points.map((_, index) => ({
        ma50: sma50[index] === null ? null : round(sma50[index] ?? 0),
        ma200: sma200[index] === null ? null : round(sma200[index] ?? 0),
        ema20: ema20[index] === null ? null : round(ema20[index] ?? 0),
        ema50: ema50[index] === null ? null : round(ema50[index] ?? 0),
        sma200: sma200[index] === null ? null : round(sma200[index] ?? 0),
        averageVolume20: averageVolume20[index] === null ? null : Math.round(averageVolume20[index] ?? 0),
        rsi14: rsi14[index] === null ? null : round(rsi14[index] ?? 0, 1),
        macd: macd[index] === null ? null : round(macd[index] ?? 0),
        macdSignal: macdSignal[index] === null ? null : round(macdSignal[index] ?? 0),
        macdHistogram: macd[index] === null || macdSignal[index] === null ? null : round((macd[index] ?? 0) - (macdSignal[index] ?? 0)),
        atr14: atr14[index] === null ? null : round(atr14[index] ?? 0),
        atrPercent14: atrPercent14[index] === null ? null : round(atrPercent14[index] ?? 0, 2),
        anchoredVwap: anchoredVwap[index] === null ? null : round(anchoredVwap[index] ?? 0),
        adx14: directional.adx[index] === null ? null : round(directional.adx[index] ?? 0, 2),
        plusDi14: directional.plusDi[index] === null ? null : round(directional.plusDi[index] ?? 0, 2),
        minusDi14: directional.minusDi[index] === null ? null : round(directional.minusDi[index] ?? 0, 2),
        supertrend: supertrend[index].value === null ? null : round(supertrend[index].value ?? 0),
        supertrendDirection: supertrend[index].direction,
    }));
};
