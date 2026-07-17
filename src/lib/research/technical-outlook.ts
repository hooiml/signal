import type { ResearchChartPoint, ResearchSnapshot } from '../types/research-snapshot';

export type TechnicalTone = 'positive' | 'neutral' | 'negative' | 'unavailable';

export type TechnicalOutlook = {
    readonly overall: { readonly label: 'Constructive' | 'Mixed' | 'Weak' | 'Unavailable'; readonly tone: TechnicalTone };
    readonly trend: { readonly label: string; readonly detail: string; readonly tone: TechnicalTone };
    readonly momentum: { readonly label: string; readonly detail: string; readonly tone: TechnicalTone };
    readonly volume: { readonly label: string; readonly detail: string; readonly tone: TechnicalTone };
};

type Technicals = ResearchSnapshot['technicals'];

const trendContext = (price: number | null, technicals: Technicals, latest: ResearchChartPoint | undefined): TechnicalOutlook['trend'] => {
    const mediumTrend = latest?.ema50 ?? technicals.ma50;
    const longTermTrend = latest?.sma200 ?? technicals.ma200;
    if (price === null || mediumTrend === null || longTermTrend === null) {
        return { label: 'Unavailable', detail: 'Not enough price history for both moving averages.', tone: 'unavailable' };
    }
    if (price > mediumTrend && mediumTrend > longTermTrend) {
        return { label: 'Positive structure', detail: 'Price is above EMA50, and EMA50 is above SMA200.', tone: 'positive' };
    }
    if (price < mediumTrend && mediumTrend < longTermTrend) {
        return { label: 'Negative structure', detail: 'Price is below EMA50, and EMA50 is below SMA200.', tone: 'negative' };
    }
    return { label: 'Mixed structure', detail: 'Price and moving averages are not aligned in one direction.', tone: 'neutral' };
};

const momentumContext = (technicals: Technicals): TechnicalOutlook['momentum'] => {
    if (technicals.rsi14 === null || technicals.macd === null) {
        return { label: 'Unavailable', detail: 'RSI or MACD history is incomplete.', tone: 'unavailable' };
    }
    if (technicals.rsi14 >= 70) {
        return { label: 'Extended', detail: `RSI ${technicals.rsi14.toFixed(1)} is overbought; MACD is ${technicals.macd >= 0 ? 'above' : 'below'} zero.`, tone: 'neutral' };
    }
    if (technicals.rsi14 <= 30) {
        return { label: 'Oversold', detail: `RSI ${technicals.rsi14.toFixed(1)} is oversold; this is not a reversal signal by itself.`, tone: 'neutral' };
    }
    if (technicals.rsi14 >= 50 && technicals.macd > 0) {
        return { label: 'Positive momentum', detail: `RSI is ${technicals.rsi14.toFixed(1)} and MACD is above zero.`, tone: 'positive' };
    }
    if (technicals.rsi14 < 50 && technicals.macd < 0) {
        return { label: 'Negative momentum', detail: `RSI is ${technicals.rsi14.toFixed(1)} and MACD is below zero.`, tone: 'negative' };
    }
    return { label: 'Mixed momentum', detail: 'RSI and MACD do not point in the same direction.', tone: 'neutral' };
};

const volumeContext = (
    latest: ResearchChartPoint | undefined,
    averageVolume20: number | null,
    dailyChangePercent: number | null,
): TechnicalOutlook['volume'] => {
    if (latest?.volume === null || latest?.volume === undefined || averageVolume20 === null || averageVolume20 <= 0) {
        return { label: 'Unavailable', detail: 'Recent or average volume is unavailable.', tone: 'unavailable' };
    }
    const ratio = latest.volume / averageVolume20;
    if (ratio >= 1.2 && dailyChangePercent !== null && dailyChangePercent > 0) {
        return { label: 'Strength confirmed', detail: `Latest volume is ${ratio.toFixed(1)}x the 20-day average on an up day.`, tone: 'positive' };
    }
    if (ratio >= 1.2 && dailyChangePercent !== null && dailyChangePercent < 0) {
        return { label: 'Selling pressure', detail: `Latest volume is ${ratio.toFixed(1)}x the 20-day average on a down day.`, tone: 'negative' };
    }
    return { label: 'Normal participation', detail: `Latest volume is ${ratio.toFixed(1)}x the 20-day average.`, tone: 'neutral' };
};

export const buildTechnicalOutlook = (snapshot: ResearchSnapshot): TechnicalOutlook => {
    const trend = trendContext(snapshot.quote.price, snapshot.technicals, snapshot.chart.points.at(-1));
    const momentum = momentumContext(snapshot.technicals);
    const volume = volumeContext(snapshot.chart.points.at(-1), snapshot.technicals.averageVolume20, snapshot.quote.dailyChangePercent);
    const directional = [trend.tone, momentum.tone, volume.tone];
    const positive = directional.filter((tone) => tone === 'positive').length;
    const negative = directional.filter((tone) => tone === 'negative').length;
    const overall = directional.every((tone) => tone === 'unavailable')
        ? { label: 'Unavailable' as const, tone: 'unavailable' as const }
        : positive >= 2 && negative === 0
            ? { label: 'Constructive' as const, tone: 'positive' as const }
            : negative >= 2 && positive === 0
                ? { label: 'Weak' as const, tone: 'negative' as const }
                : { label: 'Mixed' as const, tone: 'neutral' as const };
    return { overall, trend, momentum, volume };
};
