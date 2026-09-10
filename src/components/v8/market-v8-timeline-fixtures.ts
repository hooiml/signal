export type TimelineMarket = 'US' | 'MY';
export type TimelineMode = 'standard' | 'contrarian';
export type TimelineObservationKind = 'observed' | 'reconstructed' | 'limited';
export type TimelineRange = '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'All';

export const timelineSnapshotDate = '2026-09-04';
export const timelineModelVersion = 'market-v8-timeline-2026.09';
export const timelineFixtureDescription = 'Illustrative timeline fixture, independent from the current overview and outcome dataset.';

export type MarketV8TimelineRecord = {
    date: string;
    score: number;
    benchmark: number | null;
    scoreKind: TimelineObservationKind;
    benchmarkKind: TimelineObservationKind;
    timelineOnly: boolean;
    coveragePct: number;
    modelVersion: string;
    note: string;
};

export type MarketV8TimelineFixture = {
    market: TimelineMarket;
    mode: TimelineMode;
    benchmarkLabel: string;
    records: MarketV8TimelineRecord[];
    supportedRanges: TimelineRange[];
};

const dates = [
    '2024-09-06', '2024-10-11', '2024-11-29', '2025-01-15', '2025-02-21',
    '2025-04-04', '2025-05-19', '2025-06-27', '2025-08-08', '2025-09-18',
    '2025-10-31', '2025-12-12', '2026-01-23', '2026-03-06', '2026-04-17',
    '2026-05-29', '2026-07-10', '2026-08-14', '2026-08-28', timelineSnapshotDate,
] as const;

// These are intentionally separate from market-v8-fixtures and any outcome examples.
const usScores = [44, 49, 53, 47, 56, 61, 58, 64, 67, 62, 70, 74, 68, 72, 65, 59, 63, 71, 76, 73];
const myScores = [57, 54, 61, 59, 52, 64, 60, 66, 62, 69, 65, 71, 67, 63, 58, 55, 61, 68, 64, 66];
const usBenchmarks = [5115, 5190, 5255, 5180, 5350, 5485, 5420, 5575, 5650, 5565, 5760, 5890, 5795, 5980, 5885, 5750, 5825, 5965, 6075, 6015];
const myBenchmarks = [1650, 1682, 1710, 1692, 1726, 1762, 1744, 1790, 1818, 1801, 1845, 1880, 1862, 1898, 1876, 1842, 1864, 1905, 1930, 1918];
const coverage = [54, 58, 61, 63, 67, 70, 72, 74, 76, 78, 81, 80, 83, 85, 79, 74, 77, 82, 86, 88];
const kinds: TimelineObservationKind[] = [
    'limited', 'limited', 'reconstructed', 'reconstructed', 'reconstructed',
    'observed', 'observed', 'observed', 'observed', 'observed', 'observed', 'observed',
    'observed', 'observed', 'limited', 'limited', 'observed', 'observed', 'observed', 'observed',
];

export function getMarketV8TimelineFixture(
    market: TimelineMarket,
    mode: TimelineMode,
    partial: boolean,
): MarketV8TimelineFixture {
    const scores = market === 'US' ? usScores : myScores;
    const benchmarkLevels = market === 'US' ? usBenchmarks : myBenchmarks;
    const benchmarkLabel = market === 'US' ? 'S&P 500 proxy' : 'FBM KLCI proxy';
    const gapDates = new Set(['2026-04-17', '2026-05-29']);

    const records = dates.map((date, index) => {
        const timelineOnly = index < 5;
        const scoreKind = kinds[index];
        const benchmarkMissing = partial && gapDates.has(date);
        return {
            date,
            score: scores[index],
            benchmark: benchmarkMissing ? null : benchmarkLevels[index],
            scoreKind,
            benchmarkKind: benchmarkMissing ? 'limited' : timelineOnly ? 'reconstructed' : 'observed',
            timelineOnly,
            coveragePct: coverage[index],
            modelVersion: timelineModelVersion,
            note: benchmarkMissing
                ? 'Benchmark record is missing in the partial fixture; the score remains available.'
                : timelineOnly
                    ? 'Older timeline-only observation retained for chronological context.'
                    : scoreKind === 'reconstructed'
                        ? 'Reconstructed-origin synthetic example; no source reconstruction was performed.'
                        : scoreKind === 'limited'
                            ? 'Partial source coverage limits this dated reading.'
                            : 'Observed-origin synthetic example; no provider observation was captured.',
        } satisfies MarketV8TimelineRecord;
    });

    return {
        market,
        mode,
        benchmarkLabel,
        records,
        // The fixture intentionally spans about two years; longer windows have no supported history.
        supportedRanges: ['1M', '3M', '6M', '1Y', 'All'],
    };
}
