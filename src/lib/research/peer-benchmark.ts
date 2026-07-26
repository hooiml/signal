import type { ResearchSnapshot } from '../types/research-snapshot';

export type PeerBenchmarkMetricKey =
    | 'revenueGrowth'
    | 'grossMargin'
    | 'operatingMargin'
    | 'debtToCash'
    | 'priceEarnings'
    | 'priceSales'
    | 'freeCashFlowYield';

export type PeerBenchmarkMetric = {
    readonly key: PeerBenchmarkMetricKey;
    readonly label: string;
    readonly subjectValue: number | null;
    readonly peerMedian: number | null;
    readonly percentile: number | null;
    readonly peerCoverage: number;
    readonly higherIsBetter: boolean;
    readonly suffix: string;
};

export type PeerBenchmarkResult = {
    readonly symbol: string;
    readonly metrics: readonly PeerBenchmarkMetric[];
    readonly peerCount: number;
};

type Definition = {
    readonly key: PeerBenchmarkMetricKey;
    readonly label: string;
    readonly higherIsBetter: boolean;
    readonly suffix: string;
    readonly read: (snapshot: ResearchSnapshot) => number | null;
};

const definitions: readonly Definition[] = [
    { key: 'revenueGrowth', label: 'Revenue growth', higherIsBetter: true, suffix: '%', read: (snapshot) => snapshot.fundamentals.revenueGrowthPercent },
    { key: 'grossMargin', label: 'Gross margin', higherIsBetter: true, suffix: '%', read: (snapshot) => snapshot.fundamentals.grossMarginPercent },
    { key: 'operatingMargin', label: 'Operating margin', higherIsBetter: true, suffix: '%', read: (snapshot) => snapshot.fundamentals.operatingMarginPercent },
    {
        key: 'debtToCash',
        label: 'Debt / cash',
        higherIsBetter: false,
        suffix: 'x',
        read: (snapshot) => snapshot.fundamentals.debt === null || snapshot.fundamentals.cash === null || snapshot.fundamentals.cash <= 0
            ? null
            : snapshot.fundamentals.debt / snapshot.fundamentals.cash,
    },
    { key: 'priceEarnings', label: 'Price / earnings', higherIsBetter: false, suffix: 'x', read: (snapshot) => snapshot.valuation.priceEarnings },
    { key: 'priceSales', label: 'Price / sales', higherIsBetter: false, suffix: 'x', read: (snapshot) => snapshot.valuation.priceSales },
    { key: 'freeCashFlowYield', label: 'Free cash flow yield', higherIsBetter: true, suffix: '%', read: (snapshot) => snapshot.valuation.freeCashFlowYieldPercent },
];

const median = (values: readonly number[]): number | null => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    const value = sorted.length % 2 === 0
        ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
        : sorted[middle];
    return value === undefined ? null : Number(value.toFixed(2));
};

const percentile = (
    subject: number | null,
    peers: readonly number[],
    higherIsBetter: boolean,
): number | null => {
    if (subject === null || peers.length === 0) return null;
    const favorable = peers.filter((value) => higherIsBetter ? subject >= value : subject <= value).length;
    return Math.round((favorable / peers.length) * 100);
};

export const buildPeerBenchmark = (
    subject: ResearchSnapshot,
    peers: readonly ResearchSnapshot[],
): PeerBenchmarkResult => ({
    symbol: subject.symbol,
    peerCount: peers.length,
    metrics: definitions.map((definition) => {
        const subjectValue = definition.read(subject);
        const peerValues = peers.flatMap((peer) => {
            const value = definition.read(peer);
            return value === null || !Number.isFinite(value) ? [] : [value];
        });
        return {
            key: definition.key,
            label: definition.label,
            subjectValue: subjectValue === null ? null : Number(subjectValue.toFixed(2)),
            peerMedian: median(peerValues),
            percentile: percentile(subjectValue, peerValues, definition.higherIsBetter),
            peerCoverage: peerValues.length,
            higherIsBetter: definition.higherIsBetter,
            suffix: definition.suffix,
        };
    }),
});
