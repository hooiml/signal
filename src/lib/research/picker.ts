import type {
    DiscoveryPerformance,
    DiscoveryRisk,
    QualityDiscoveryResult,
} from '../types/research-discovery';

export const pickerHorizons = ['1D', '1W', '1M'] as const;
export const pickerRiskProfiles = ['conservative', 'balanced'] as const;
export const pickerMinimumScores = [60, 70, 80] as const;
export const pickerPickCounts = [3, 5, 10] as const;
export const pickerRunLimit = 20;

export type PickerHorizon = typeof pickerHorizons[number];
export type PickerRiskProfile = typeof pickerRiskProfiles[number];

export type PickerConfig = {
    readonly horizon: PickerHorizon;
    readonly riskProfile: PickerRiskProfile;
    readonly minimumScore: typeof pickerMinimumScores[number];
    readonly pickCount: typeof pickerPickCounts[number];
};

export type PickerEvidenceState = 'collecting' | 'limited' | 'observational';

export type PickerCohortEvidence = {
    readonly state: PickerEvidenceState;
    readonly averageReturnPercent: number | null;
    readonly positiveRatePercent: number | null;
    readonly trackedCount: number;
};

export type PickerCandidate = QualityDiscoveryResult & {
    readonly outlook: 'Strong current setup' | 'Favorable current setup' | 'Watch setup';
};

export type PickerRunPick = {
    readonly symbol: string;
    readonly name: string;
    readonly price: number;
    readonly discoveryScore: number;
    readonly risk: DiscoveryRisk;
    readonly category: QualityDiscoveryResult['category'];
};

export type PickerRun = {
    readonly id: string;
    readonly createdAt: string;
    readonly discoveryGeneratedAt: string;
    readonly config: PickerConfig;
    readonly picks: readonly PickerRunPick[];
};

const oneOf = <T extends string | number>(value: unknown, values: readonly T[]): value is T =>
    values.some((candidate) => candidate === value);

export const parsePickerConfig = (value: unknown): PickerConfig | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const candidate = Object.fromEntries(Object.entries(value));
    if (!oneOf(candidate.horizon, pickerHorizons)
        || !oneOf(candidate.riskProfile, pickerRiskProfiles)
        || !oneOf(candidate.minimumScore, pickerMinimumScores)
        || !oneOf(candidate.pickCount, pickerPickCounts)) return null;
    return {
        horizon: candidate.horizon,
        riskProfile: candidate.riskProfile,
        minimumScore: candidate.minimumScore,
        pickCount: candidate.pickCount,
    };
};

const candidateAllowed = (candidate: QualityDiscoveryResult, config: PickerConfig) =>
    candidate.discoveryScore >= config.minimumScore
    && candidate.risk !== 'high'
    && (config.riskProfile === 'balanced'
        || (candidate.risk === 'low' && candidate.valuation.guardrail !== 'extreme'));

const outlookFor = (candidate: QualityDiscoveryResult): PickerCandidate['outlook'] => {
    if (candidate.discoveryScore >= 80 && candidate.risk === 'low') return 'Strong current setup';
    if (candidate.discoveryScore >= 70) return 'Favorable current setup';
    return 'Watch setup';
};

export const selectPickerCandidates = (
    data: {
        readonly candidates: readonly QualityDiscoveryResult[];
        readonly contenders: readonly QualityDiscoveryResult[];
    },
    config: PickerConfig,
): readonly PickerCandidate[] => {
    const bySymbol = new Map<string, QualityDiscoveryResult>();
    for (const candidate of [...data.candidates, ...data.contenders]) {
        if (!bySymbol.has(candidate.symbol)) bySymbol.set(candidate.symbol, candidate);
    }
    return [...bySymbol.values()]
        .filter((candidate) => candidateAllowed(candidate, config))
        .sort((left, right) => right.discoveryScore - left.discoveryScore
            || left.riskScore - right.riskScore
            || left.symbol.localeCompare(right.symbol))
        .slice(0, config.pickCount)
        .map((candidate) => ({ ...candidate, outlook: outlookFor(candidate) }));
};

export const pickerCohortEvidence = (
    performance: readonly DiscoveryPerformance[],
    horizon: PickerHorizon,
): PickerCohortEvidence => {
    const period = performance.find((candidate) => candidate.period === horizon);
    const trackedCount = period?.trackedCount ?? 0;
    return {
        state: trackedCount === 0 ? 'collecting' : trackedCount < 5 ? 'limited' : 'observational',
        averageReturnPercent: period?.averageReturnPercent ?? null,
        positiveRatePercent: period && trackedCount > 0
            ? Math.round((period.winnerCount / trackedCount) * 100)
            : null,
        trackedCount,
    };
};

export const createPickerRun = (
    createdAt: string,
    discoveryGeneratedAt: string,
    config: PickerConfig,
    picks: readonly PickerCandidate[],
): PickerRun => ({
    id: `picker:${createdAt}`,
    createdAt,
    discoveryGeneratedAt,
    config,
    picks: picks.map((pick) => ({
        symbol: pick.symbol,
        name: pick.name,
        price: pick.price,
        discoveryScore: pick.discoveryScore,
        risk: pick.risk,
        category: pick.category,
    })),
});

const finitePositive = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0;

const parsePickerRun = (value: unknown): PickerRun | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const candidate = Object.fromEntries(Object.entries(value));
    const config = parsePickerConfig(candidate.config);
    if (typeof candidate.id !== 'string'
        || typeof candidate.createdAt !== 'string'
        || Number.isNaN(Date.parse(candidate.createdAt))
        || typeof candidate.discoveryGeneratedAt !== 'string'
        || Number.isNaN(Date.parse(candidate.discoveryGeneratedAt))
        || !config
        || !Array.isArray(candidate.picks)) return null;
    const picks = candidate.picks.flatMap((entry): PickerRunPick[] => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
        const pick = Object.fromEntries(Object.entries(entry));
        const symbol = typeof pick.symbol === 'string' ? pick.symbol.trim().toUpperCase().slice(0, 12) : '';
        if (!symbol
            || typeof pick.name !== 'string'
            || !finitePositive(pick.price)
            || typeof pick.discoveryScore !== 'number'
            || !Number.isFinite(pick.discoveryScore)
            || pick.discoveryScore < 0
            || pick.discoveryScore > 100
            || !oneOf(pick.risk, ['low', 'moderate', 'high'] as const)
            || !oneOf(pick.category, [
                'quality compounder', 'cyclical acceleration', 'turnaround',
                'momentum only', 'fundamentally unsupported', 'unconfirmed',
            ] as const)) return [];
        return [{
            symbol,
            name: pick.name.trim().slice(0, 120),
            price: pick.price,
            discoveryScore: pick.discoveryScore,
            risk: pick.risk,
            category: pick.category,
        }];
    });
    if (picks.length === 0 || picks.length > 10) return null;
    return {
        id: candidate.id.slice(0, 100),
        createdAt: new Date(candidate.createdAt).toISOString(),
        discoveryGeneratedAt: new Date(candidate.discoveryGeneratedAt).toISOString(),
        config,
        picks,
    };
};

export const parsePickerRuns = (value: unknown): readonly PickerRun[] => {
    if (!Array.isArray(value)) return [];
    const byId = new Map<string, PickerRun>();
    for (const entry of value) {
        const parsed = parsePickerRun(entry);
        if (parsed) byId.set(parsed.id, parsed);
    }
    return [...byId.values()]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, pickerRunLimit);
};

export const addPickerRun = (
    current: readonly PickerRun[],
    run: PickerRun,
): readonly PickerRun[] => parsePickerRuns([run, ...current]);

export const removePickerRun = (
    current: readonly PickerRun[],
    id: string,
): readonly PickerRun[] => current.filter((run) => run.id !== id);

export const pickerObservedMovePercent = (entryPrice: number, currentPrice: number | null): number | null =>
    currentPrice === null || !finitePositive(entryPrice) || !finitePositive(currentPrice)
        ? null
        : Number((((currentPrice - entryPrice) / entryPrice) * 100).toFixed(2));
