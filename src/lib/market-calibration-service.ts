import { sql } from '@/lib/db';
import { unstable_cache } from 'next/cache';
import { calculateMarketCalibration } from './market-calibration';
import { reconstructUsMarketScores } from './market-score-reconstruction';
import { fetchYahooResearchChart } from './research/yahoo-research';

const getCachedMarketCalibration = unstable_cache(async (
    market: 'US' | 'MY', mode: 'standard' | 'contrarian', enableSocial: boolean,
) => {
    const rows = await sql`
        SELECT snapshot_date::text AS date, composite_score AS score, tier
        FROM signal_snapshots
        WHERE market_type = ${market} AND mode = ${mode} AND enable_social = ${enableSocial}
            AND snapshot_date >= CURRENT_DATE - INTERVAL '5 years'
        ORDER BY snapshot_date DESC
        LIMIT 1000
    `;
    const observedSnapshots = rows.flatMap((raw) => {
        if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return [];
        const row = Object.fromEntries(Object.entries(raw));
        const tier = row.tier;
        if (typeof row.date !== 'string' || typeof row.score !== 'number'
            || (tier !== 'strong-buy' && tier !== 'buy' && tier !== 'neutral' && tier !== 'sell' && tier !== 'strong-sell')) return [];
        return [{ date: row.date, score: row.score, tier, origin: 'observed' as const }];
    });
    const legacyRows = market === 'US' ? await sql`
        SELECT signal_date::text AS date, vix_value::float AS vix, social_sentiment_score::float AS social
        FROM market_signals
        WHERE market_type = 'US'
            AND signal_date >= CURRENT_DATE - INTERVAL '5 years'
            AND vix_value IS NOT NULL
            AND social_sentiment_score IS NOT NULL
        ORDER BY signal_date ASC
    ` : [];
    const reconstructedSnapshots = market === 'US' ? reconstructUsMarketScores({
        rows: legacyRows.flatMap((raw) => {
            if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return [];
            const row = Object.fromEntries(Object.entries(raw));
            return typeof row.date === 'string' && typeof row.vix === 'number' && typeof row.social === 'number'
                ? [{ date: row.date, vix: row.vix, social: row.social }]
                : [];
        }),
        mode,
        enableSocial,
    }) : [];
    const observedDates = new Set(observedSnapshots.map((snapshot) => snapshot.date));
    const snapshots = [
        ...reconstructedSnapshots.filter((snapshot) => !observedDates.has(snapshot.date)),
        ...observedSnapshots,
    ].sort((left, right) => left.date.localeCompare(right.date));
    const benchmark = market === 'US'
        ? { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', lookup: 'VOO' }
        : { symbol: 'FBM KLCI', name: 'FTSE Bursa Malaysia KLCI', lookup: 'KLCI' };
    const chart = await fetchYahooResearchChart(benchmark.lookup, market, '5y');
    return calculateMarketCalibration({
        snapshots: snapshots.toReversed(),
        prices: chart.points.map((point) => ({ date: point.time, close: point.close })),
        mode,
        benchmarkSymbol: benchmark.symbol,
        benchmarkName: benchmark.name,
        reconstructionNote: market === 'US'
            ? 'Earlier scores are reconstructed with the current model from stored VIX and social sentiment. Missing put/call and weekly institutional inputs contribute the model’s neutral baseline; observed snapshots take precedence on overlapping dates.'
            : null,
    });
}, ['market-calibration-v3'], { revalidate: 3600 });

export const getMarketCalibration = (input: {
    readonly market: 'US' | 'MY';
    readonly mode: 'standard' | 'contrarian';
    readonly enableSocial: boolean;
}) => getCachedMarketCalibration(input.market, input.mode, input.enableSocial);
