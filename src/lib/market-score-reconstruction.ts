import { calculateCompositeScoreV2 } from './sentiment-calculator-v2';
import { calculateSentimentScore } from './sentiment-calculator';
import type { CalibrationSnapshot } from './market-calibration';
import type { IndicatorData } from './types/signal-v2';

export type LegacyMarketSignalInput = {
    readonly date: string;
    readonly vix: number;
    readonly social: number;
};

const indicator = (input: {
    readonly name: 'vix' | 'social';
    readonly displayName: string;
    readonly value: number;
    readonly score: number;
    readonly date: string;
}): IndicatorData => ({
    name: input.name,
    display_name: input.displayName,
    value: input.value,
    score: input.score,
    weight: 0,
    signal: 'neutral',
    enabled: true,
    last_updated: input.date,
});

export const reconstructUsMarketScores = (input: {
    readonly rows: readonly LegacyMarketSignalInput[];
    readonly mode: 'standard' | 'contrarian';
    readonly enableSocial: boolean;
}): CalibrationSnapshot[] => {
    const sorted = [...input.rows]
        .filter((row) => Number.isFinite(row.vix) && row.vix > 0 && Number.isFinite(row.social))
        .sort((left, right) => left.date.localeCompare(right.date));

    return sorted.map((row, index) => {
        const previous = sorted[index - 1];
        const vixChangePct = previous && previous.vix > 0
            ? ((row.vix - previous.vix) / previous.vix) * 100
            : undefined;
        const normalized = calculateSentimentScore({
            vix: row.vix,
            social: row.social,
            vixChangePct,
        }, { vixBaseWeight: 0.60, socialBaseWeight: 0.40 });
        const indicators = [indicator({
            name: 'vix',
            displayName: 'VIX Index',
            value: row.vix,
            score: normalized.components.vixScore,
            date: row.date,
        })];

        if (input.enableSocial) {
            indicators.push(indicator({
                name: 'social',
                displayName: 'Social Sentiment',
                value: row.social,
                score: normalized.components.socialScore,
                date: row.date,
            }));
        }

        const signal = calculateCompositeScoreV2(indicators, { market: 'US', mode: input.mode });
        return {
            date: row.date,
            score: signal.composite_score,
            tier: signal.tier,
            origin: 'reconstructed',
        };
    });
};
