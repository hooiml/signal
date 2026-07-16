export type OhlcvPoint = {
    readonly high: number;
    readonly low: number;
    readonly close: number;
    readonly volume: number | null;
};

export type TechnicalSeriesPoint = {
    readonly ma50: number | null;
    readonly ma200: number | null;
    readonly averageVolume20: number | null;
    readonly rsi14: number | null;
    readonly macd: number | null;
    readonly macdSignal: number | null;
    readonly macdHistogram: number | null;
    readonly atrPercent14: number | null;
};

const round = (value: number, decimals = 2) => Number(value.toFixed(decimals));

const simpleMovingAverageSeries = (values: readonly (number | null)[], period: number) => values.map((_, index) => {
    if (index + 1 < period) return null;
    const window = values.slice(index + 1 - period, index + 1);
    if (window.some((value) => value === null)) return null;
    return window.reduce<number>((sum, value) => sum + (value ?? 0), 0) / period;
});

const exponentialMovingAverageSeries = (values: readonly (number | null)[], period: number) => {
    const result: Array<number | null> = Array(values.length).fill(null);
    const multiplier = 2 / (period + 1);
    let seed: number[] = [];
    let current: number | null = null;
    values.forEach((value, index) => {
        if (value === null) return;
        if (current === null) {
            seed = [...seed, value];
            if (seed.length === period) {
                current = seed.reduce((sum, item) => sum + item, 0) / period;
                result[index] = current;
            }
            return;
        }
        current = (value - current) * multiplier + current;
        result[index] = current;
    });
    return result;
};

const rsiSeries = (closes: readonly number[], period = 14) => {
    const result: Array<number | null> = Array(closes.length).fill(null);
    if (closes.length <= period) return result;
    let averageGain = 0;
    let averageLoss = 0;
    for (let index = 1; index <= period; index += 1) {
        const change = closes[index] - closes[index - 1];
        averageGain += Math.max(change, 0);
        averageLoss += Math.max(-change, 0);
    }
    averageGain /= period;
    averageLoss /= period;
    const value = () => averageLoss === 0 ? averageGain === 0 ? 50 : 100 : 100 - (100 / (1 + averageGain / averageLoss));
    result[period] = value();
    for (let index = period + 1; index < closes.length; index += 1) {
        const change = closes[index] - closes[index - 1];
        averageGain = ((averageGain * (period - 1)) + Math.max(change, 0)) / period;
        averageLoss = ((averageLoss * (period - 1)) + Math.max(-change, 0)) / period;
        result[index] = value();
    }
    return result;
};

const atrPercentSeries = (points: readonly OhlcvPoint[], period = 14) => {
    const result: Array<number | null> = Array(points.length).fill(null);
    if (points.length < period) return result;
    const trueRanges = points.map((point, index) => index === 0
        ? point.high - point.low
        : Math.max(point.high - point.low, Math.abs(point.high - points[index - 1].close), Math.abs(point.low - points[index - 1].close)));
    let atr = trueRanges.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
    result[period - 1] = points[period - 1].close === 0 ? null : (atr / points[period - 1].close) * 100;
    for (let index = period; index < points.length; index += 1) {
        atr = ((atr * (period - 1)) + trueRanges[index]) / period;
        result[index] = points[index].close === 0 ? null : (atr / points[index].close) * 100;
    }
    return result;
};

export const calculateTechnicalSeries = (points: readonly OhlcvPoint[]): readonly TechnicalSeriesPoint[] => {
    const closes = points.map((point) => point.close);
    const volumes = points.map((point) => point.volume);
    const ma50 = simpleMovingAverageSeries(closes, 50);
    const ma200 = simpleMovingAverageSeries(closes, 200);
    const averageVolume20 = simpleMovingAverageSeries(volumes, 20);
    const rsi14 = rsiSeries(closes);
    const fast = exponentialMovingAverageSeries(closes, 12);
    const slow = exponentialMovingAverageSeries(closes, 26);
    const macd = closes.map((_, index) => fast[index] === null || slow[index] === null ? null : (fast[index] ?? 0) - (slow[index] ?? 0));
    const macdSignal = exponentialMovingAverageSeries(macd, 9);
    const atrPercent14 = atrPercentSeries(points);
    return points.map((_, index) => ({
        ma50: ma50[index] === null ? null : round(ma50[index] ?? 0),
        ma200: ma200[index] === null ? null : round(ma200[index] ?? 0),
        averageVolume20: averageVolume20[index] === null ? null : Math.round(averageVolume20[index] ?? 0),
        rsi14: rsi14[index] === null ? null : round(rsi14[index] ?? 0, 1),
        macd: macd[index] === null ? null : round(macd[index] ?? 0),
        macdSignal: macdSignal[index] === null ? null : round(macdSignal[index] ?? 0),
        macdHistogram: macd[index] === null || macdSignal[index] === null ? null : round((macd[index] ?? 0) - (macdSignal[index] ?? 0)),
        atrPercent14: atrPercent14[index] === null ? null : round(atrPercent14[index] ?? 0, 2),
    }));
};
