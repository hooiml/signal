export type TechnicalSnapshot = {
    readonly ma50: number | null;
    readonly ma200: number | null;
    readonly rsi14: number | null;
    readonly macd: number | null;
    readonly low52Week: number | null;
    readonly high52Week: number | null;
    readonly averageVolume20: number | null;
    readonly support: number | null;
    readonly resistance: number | null;
};

const round = (value: number, decimals = 2) => Number(value.toFixed(decimals));

const averageLast = (values: readonly number[], period: number): number | null => {
    if (values.length < period) return null;
    return values.slice(-period).reduce((sum, value) => sum + value, 0) / period;
};

const ema = (values: readonly number[], period: number): number | null => {
    if (values.length < period) return null;
    const multiplier = 2 / (period + 1);
    let current = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
    for (const value of values.slice(period)) current = (value - current) * multiplier + current;
    return current;
};

const calculateRsi = (closes: readonly number[]): number | null => {
    const period = 14;
    if (closes.length <= period) return null;
    const changes = closes.slice(1).map((value, index) => value - closes[index]);
    const recent = changes.slice(-period);
    const gains = recent.reduce((sum, value) => sum + Math.max(value, 0), 0) / period;
    const losses = recent.reduce((sum, value) => sum + Math.max(-value, 0), 0) / period;
    if (losses === 0) return gains === 0 ? 50 : 100;
    return 100 - (100 / (1 + gains / losses));
};

export const calculateTechnicals = (closes: readonly number[], volumes: readonly number[]): TechnicalSnapshot => {
    const yearlyCloses = closes.slice(-252);
    const range = closes.slice(-20);
    const macdFast = ema(closes, 12);
    const macdSlow = ema(closes, 26);
    return {
        ma50: averageLast(closes, 50) === null ? null : round(averageLast(closes, 50) ?? 0),
        ma200: averageLast(closes, 200) === null ? null : round(averageLast(closes, 200) ?? 0),
        rsi14: calculateRsi(closes) === null ? null : round(calculateRsi(closes) ?? 0, 1),
        macd: macdFast === null || macdSlow === null ? null : round(macdFast - macdSlow),
        low52Week: yearlyCloses.length === 0 ? null : Math.min(...yearlyCloses),
        high52Week: yearlyCloses.length === 0 ? null : Math.max(...yearlyCloses),
        averageVolume20: averageLast(volumes, 20) === null ? null : Math.round(averageLast(volumes, 20) ?? 0),
        support: range.length === 0 ? null : Math.min(...range),
        resistance: range.length === 0 ? null : Math.max(...range),
    };
};
