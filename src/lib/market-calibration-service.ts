import { sql } from '@/lib/db';
import { unstable_cache } from 'next/cache';
import { calculateMarketCalibration, MARKET_SCORE_MODEL_VERSION } from './market-calibration';
import { reconstructUsMarketScores } from './market-score-reconstruction';
import { fetchYahooResearchChart } from './research/yahoo-research';

const getCachedMarketCalibration = unstable_cache(async (
    market: 'US' | 'MY', mode: 'standard' | 'contrarian', enableSocial: boolean,
) => {
    const rows = await sql`
        SELECT snapshot_date::text AS date, composite_score AS score, tier,
            COALESCE(origin, 'observed') AS origin, coverage_note, metadata_snapshot
        FROM signal_snapshots
        WHERE market_type = ${market} AND mode = ${mode} AND enable_social = ${enableSocial}
            AND snapshot_date >= CURRENT_DATE - INTERVAL '10 years'
        ORDER BY snapshot_date DESC
        LIMIT 1000
    `;
    const storedSnapshots = rows.flatMap((raw) => {
        if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return [];
        const row = Object.fromEntries(Object.entries(raw));
        const tier = row.tier;
        if (typeof row.date !== 'string' || typeof row.score !== 'number'
            || (tier !== 'strong-buy' && tier !== 'buy' && tier !== 'neutral' && tier !== 'sell' && tier !== 'strong-sell')) return [];
        const origin = row.origin === 'reconstructed' ? 'reconstructed' as const : 'observed' as const;
        const metadata = typeof row.metadata_snapshot === 'object' && row.metadata_snapshot !== null && !Array.isArray(row.metadata_snapshot)
            ? Object.fromEntries(Object.entries(row.metadata_snapshot))
            : {};
        return [{
            date: row.date,
            score: row.score,
            tier,
            origin,
            modelVersion: typeof metadata.scoring_model_version === 'string'
                ? metadata.scoring_model_version
                : origin === 'reconstructed' ? MARKET_SCORE_MODEL_VERSION : null,
            coverageNote: typeof row.coverage_note === 'string' ? row.coverage_note : null,
            validationEligible: metadata.validation_eligible !== false,
        }];
    });
    const legacyRows = market === 'US' ? await sql`
        SELECT signal_date::text AS date, vix_value::float AS vix, social_sentiment_score::float AS social
        FROM market_signals
        WHERE market_type = 'US'
            AND signal_date >= CURRENT_DATE - INTERVAL '10 years'
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
    }).map((snapshot) => ({
        ...snapshot,
        modelVersion: MARKET_SCORE_MODEL_VERSION,
        coverageNote: 'Reconstructed from stored VIX and social sentiment; unavailable inputs use the neutral baseline.',
    })) : [];
    const storedDates = new Set(storedSnapshots.map((snapshot) => snapshot.date));
    const snapshots = [
        ...reconstructedSnapshots.filter((snapshot) => !storedDates.has(snapshot.date)),
        ...storedSnapshots,
    ].sort((left, right) => left.date.localeCompare(right.date));
    const benchmark = market === 'US'
        ? { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', lookup: 'VOO' }
        : { symbol: 'FBM KLCI', name: 'FTSE Bursa Malaysia KLCI', lookup: 'KLCI' };
    const chart = await fetchYahooResearchChart(benchmark.lookup, market, '10y');
    return calculateMarketCalibration({
        snapshots: snapshots.toReversed(),
        prices: chart.points.map((point) => ({ date: point.time, close: point.close })),
        mode,
        benchmarkSymbol: benchmark.symbol,
        benchmarkName: benchmark.name,
        modelVersion: MARKET_SCORE_MODEL_VERSION,
        reconstructionNote: market === 'US'
            ? 'Weekly long-range points use historical VIX with unavailable inputs held neutral and are timeline-only. Later reconstructed scores use stored VIX and social sentiment. Observed snapshots take precedence on overlapping dates.'
            : null,
    });
}, ['market-calibration-v7'], { revalidate: 3600 });

export const getMarketCalibration = (input: {
    readonly market: 'US' | 'MY';
    readonly mode: 'standard' | 'contrarian';
    readonly enableSocial: boolean;
}) => getCachedMarketCalibration(input.market, input.mode, input.enableSocial);
