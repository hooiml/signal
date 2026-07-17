import { sql } from '@/lib/db';
import { unstable_cache } from 'next/cache';
import { calculateMarketCalibration } from './market-calibration';
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
    const snapshots = rows.flatMap((raw) => {
        if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return [];
        const row = Object.fromEntries(Object.entries(raw));
        const tier = row.tier;
        if (typeof row.date !== 'string' || typeof row.score !== 'number'
            || (tier !== 'strong-buy' && tier !== 'buy' && tier !== 'neutral' && tier !== 'sell' && tier !== 'strong-sell')) return [];
        return [{ date: row.date, score: row.score, tier }];
    });
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
    });
}, ['market-calibration-v1'], { revalidate: 3600 });

export const getMarketCalibration = (input: {
    readonly market: 'US' | 'MY';
    readonly mode: 'standard' | 'contrarian';
    readonly enableSocial: boolean;
}) => getCachedMarketCalibration(input.market, input.mode, input.enableSocial);
