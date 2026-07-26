import type {
    DiscoveryPerformance,
    DiscoveryRisk,
    QualityDiscoveryResult,
} from '../types/research-discovery';
import {
    applyDiscoveryUniversePolicy,
    defaultDiscoveryUniversePolicy,
    parseDiscoveryUniversePolicy,
    type DiscoveryUniversePolicy,
} from './discovery-policy';

export const pickerHorizons = ['1D', '1W', '1M'] as const;
export const pickerRiskProfiles = ['conservative', 'balanced'] as const;
export const pickerMinimumScores = [60, 70, 80] as const;
export const pickerPickCounts = [3, 5, 10] as const;
export const pickerMaximumPerSector = [1, 2, 3, 10] as const;
export const pickerRunLimit = 20;

export type PickerHorizon = typeof pickerHorizons[number];
export type PickerRiskProfile = typeof pickerRiskProfiles[number];

export type PickerConfig = {
    readonly horizon: PickerHorizon;
    readonly riskProfile: PickerRiskProfile;
    readonly minimumScore: typeof pickerMinimumScores[number];
    readonly pickCount: typeof pickerPickCounts[number];
    readonly maximumPerSector: typeof pickerMaximumPerSector[number];
    readonly excludeSavedSymbols: boolean;
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
    readonly policyScore: number;
    readonly policyAdjustment: number;
    readonly policyReasons: readonly string[];
};

export type PickerRunObservation = {
    readonly observedAt: string;
    readonly price: number;
};

export type PickerRunPick = {
    readonly symbol: string;
    readonly name: string;
    readonly price: number;
    readonly discoveryScore: number;
    readonly risk: DiscoveryRisk;
    readonly category: QualityDiscoveryResult['category'];
    readonly sector: string;
    readonly policyAdjustment: number;
    readonly outcome: PickerRunObservation | null;
};

export type PickerStrategySnapshot = {
    readonly id: string;
    readonly name: string;
    readonly policy: DiscoveryUniversePolicy;
};

export type PickerRun = {
    readonly id: string;
    readonly createdAt: string;
    readonly discoveryGeneratedAt: string;
    readonly config: PickerConfig;
    readonly strategy: PickerStrategySnapshot | null;
    readonly benchmark: {
        readonly symbol: 'VOO';
        readonly entryPrice: number | null;
        readonly outcome: PickerRunObservation | null;
    };
    readonly picks: readonly PickerRunPick[];
};

export type PickerRunSummary = {
    readonly state: 'collecting' | 'due' | 'partial' | 'resolved';
    readonly dueAt: string;
    readonly trackedCount: number;
    readonly averageReturnPercent: number | null;
    readonly positiveRatePercent: number | null;
    readonly benchmarkReturnPercent: number | null;
    readonly relativeReturnPercent: number | null;
};

export type PickerSelectionOptions = {
    readonly policy?: DiscoveryUniversePolicy;
    readonly savedSymbols?: readonly string[];
};

const oneOf = <T extends string | number>(value: unknown, values: readonly T[]): value is T =>
    values.some((candidate) => candidate === value);

export const parsePickerConfig = (value: unknown): PickerConfig | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const candidate = Object.fromEntries(Object.entries(value));
    const maximumPerSector = candidate.maximumPerSector === undefined ? 10 : candidate.maximumPerSector;
    const excludeSavedSymbols = candidate.excludeSavedSymbols === undefined ? false : candidate.excludeSavedSymbols;
    if (!oneOf(candidate.horizon, pickerHorizons)
        || !oneOf(candidate.riskProfile, pickerRiskProfiles)
        || !oneOf(candidate.minimumScore, pickerMinimumScores)
        || !oneOf(candidate.pickCount, pickerPickCounts)
        || !oneOf(maximumPerSector, pickerMaximumPerSector)
        || typeof excludeSavedSymbols !== 'boolean') return null;
    return {
        horizon: candidate.horizon,
        riskProfile: candidate.riskProfile,
        minimumScore: candidate.minimumScore,
        pickCount: candidate.pickCount,
        maximumPerSector,
        excludeSavedSymbols,
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
    options: PickerSelectionOptions = {},
): readonly PickerCandidate[] => {
    const bySymbol = new Map<string, QualityDiscoveryResult>();
    for (const candidate of [...data.candidates, ...data.contenders]) {
        if (!bySymbol.has(candidate.symbol)) bySymbol.set(candidate.symbol, candidate);
    }
    const savedSymbols = new Set(options.savedSymbols ?? []);
    const ranked = applyDiscoveryUniversePolicy(
        [...bySymbol.values()],
        options.policy ?? defaultDiscoveryUniversePolicy,
    ).rows
        .filter(({ candidate }) => candidateAllowed(candidate, config))
        .filter(({ candidate }) => !config.excludeSavedSymbols || !savedSymbols.has(candidate.symbol))
        .sort((left, right) => right.policyScore - left.policyScore
            || left.candidate.riskScore - right.candidate.riskScore
            || left.candidate.symbol.localeCompare(right.candidate.symbol));
    const sectorCounts = new Map<string, number>();
    const selected: PickerCandidate[] = [];
    for (const row of ranked) {
        const sectorCount = sectorCounts.get(row.candidate.sector) ?? 0;
        if (sectorCount >= config.maximumPerSector) continue;
        selected.push({
            ...row.candidate,
            outlook: outlookFor(row.candidate),
            policyScore: row.policyScore,
            policyAdjustment: row.adjustment,
            policyReasons: row.reasons,
        });
        sectorCounts.set(row.candidate.sector, sectorCount + 1);
        if (selected.length === config.pickCount) break;
    }
    return selected;
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
    options: {
        readonly strategy?: PickerStrategySnapshot | null;
        readonly benchmarkEntryPrice?: number | null;
    } = {},
): PickerRun => ({
    id: `picker:${createdAt}`,
    createdAt,
    discoveryGeneratedAt,
    config,
    strategy: options.strategy ?? null,
    benchmark: {
        symbol: 'VOO',
        entryPrice: finitePositive(options.benchmarkEntryPrice) ? options.benchmarkEntryPrice : null,
        outcome: null,
    },
    picks: picks.map((pick) => ({
        symbol: pick.symbol,
        name: pick.name,
        price: pick.price,
        discoveryScore: pick.discoveryScore,
        risk: pick.risk,
        category: pick.category,
        sector: pick.sector,
        policyAdjustment: pick.policyAdjustment,
        outcome: null,
    })),
});

const finitePositive = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0;

const finiteNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

const parseObservation = (value: unknown): PickerRunObservation | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const candidate = Object.fromEntries(Object.entries(value));
    if (typeof candidate.observedAt !== 'string'
        || Number.isNaN(Date.parse(candidate.observedAt))
        || !finitePositive(candidate.price)) return null;
    return {
        observedAt: new Date(candidate.observedAt).toISOString(),
        price: candidate.price,
    };
};

const parseStrategy = (value: unknown): PickerStrategySnapshot | null => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'object' || Array.isArray(value)) return null;
    const candidate = Object.fromEntries(Object.entries(value));
    const policy = parseDiscoveryUniversePolicy(candidate.policy);
    if (typeof candidate.id !== 'string'
        || !/^[a-z0-9-]{1,48}$/.test(candidate.id)
        || typeof candidate.name !== 'string'
        || !candidate.name.trim()
        || candidate.name.length > 40
        || !policy) return null;
    return { id: candidate.id, name: candidate.name.trim(), policy };
};

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
        const outcome = pick.outcome === null || pick.outcome === undefined ? null : parseObservation(pick.outcome);
        if (!symbol
            || typeof pick.name !== 'string'
            || !finitePositive(pick.price)
            || !finiteNumber(pick.discoveryScore)
            || pick.discoveryScore < 0
            || pick.discoveryScore > 100
            || !oneOf(pick.risk, ['low', 'moderate', 'high'] as const)
            || !oneOf(pick.category, [
                'quality compounder', 'cyclical acceleration', 'turnaround',
                'momentum only', 'fundamentally unsupported', 'unconfirmed',
            ] as const)
            || (pick.outcome !== null && pick.outcome !== undefined && !outcome)) return [];
        return [{
            symbol,
            name: pick.name.trim().slice(0, 120),
            price: pick.price,
            discoveryScore: pick.discoveryScore,
            risk: pick.risk,
            category: pick.category,
            sector: typeof pick.sector === 'string' && pick.sector.trim() ? pick.sector.trim().slice(0, 80) : 'Unknown',
            policyAdjustment: finiteNumber(pick.policyAdjustment) ? pick.policyAdjustment : 0,
            outcome,
        }];
    });
    if (picks.length === 0 || picks.length > 10) return null;
    const benchmarkRecord = candidate.benchmark && typeof candidate.benchmark === 'object' && !Array.isArray(candidate.benchmark)
        ? Object.fromEntries(Object.entries(candidate.benchmark))
        : null;
    const benchmarkOutcome = benchmarkRecord?.outcome === null || benchmarkRecord?.outcome === undefined
        ? null
        : parseObservation(benchmarkRecord.outcome);
    if (benchmarkRecord?.outcome !== null && benchmarkRecord?.outcome !== undefined && !benchmarkOutcome) return null;
    const parsedStrategy = parseStrategy(candidate.strategy);
    if (candidate.strategy !== null && candidate.strategy !== undefined && !parsedStrategy) return null;
    return {
        id: candidate.id.slice(0, 100),
        createdAt: new Date(candidate.createdAt).toISOString(),
        discoveryGeneratedAt: new Date(candidate.discoveryGeneratedAt).toISOString(),
        config,
        strategy: parsedStrategy,
        benchmark: {
            symbol: 'VOO',
            entryPrice: finitePositive(benchmarkRecord?.entryPrice) ? benchmarkRecord.entryPrice : null,
            outcome: benchmarkOutcome,
        },
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

const horizonDays: Readonly<Record<PickerHorizon, number>> = { '1D': 1, '1W': 7, '1M': 30 };

export const pickerRunDueAt = (run: PickerRun): string =>
    new Date(Date.parse(run.createdAt) + horizonDays[run.config.horizon] * 86_400_000).toISOString();

export const resolvePickerRuns = (
    current: readonly PickerRun[],
    observedPrices: ReadonlyMap<string, number>,
    observedAt: string,
): readonly PickerRun[] => {
    const observationTime = Date.parse(observedAt);
    if (!Number.isFinite(observationTime)) return current;
    return current.map((run) => {
        if (observationTime < Date.parse(pickerRunDueAt(run))) return run;
        const picks = run.picks.map((pick) => {
            if (pick.outcome) return pick;
            const price = observedPrices.get(pick.symbol);
            return finitePositive(price) ? { ...pick, outcome: { observedAt: new Date(observedAt).toISOString(), price } } : pick;
        });
        const benchmarkPrice = observedPrices.get(run.benchmark.symbol);
        const benchmark = run.benchmark.outcome || !finitePositive(run.benchmark.entryPrice) || !finitePositive(benchmarkPrice)
            ? run.benchmark
            : { ...run.benchmark, outcome: { observedAt: new Date(observedAt).toISOString(), price: benchmarkPrice } };
        return { ...run, picks, benchmark };
    });
};

const average = (values: readonly number[]): number | null =>
    values.length === 0 ? null : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));

export const pickerRunSummary = (
    run: PickerRun,
    livePrices: ReadonlyMap<string, number>,
    now: string,
): PickerRunSummary => {
    const dueAt = pickerRunDueAt(run);
    const due = Date.parse(now) >= Date.parse(dueAt);
    const returns = run.picks.flatMap((pick) => {
        const observedPrice = due ? pick.outcome?.price ?? null : livePrices.get(pick.symbol) ?? null;
        const move = pickerObservedMovePercent(pick.price, observedPrice);
        return move === null ? [] : [move];
    });
    const benchmarkObserved = due ? run.benchmark.outcome?.price ?? null : livePrices.get(run.benchmark.symbol) ?? null;
    const benchmarkReturnPercent = run.benchmark.entryPrice === null
        ? null
        : pickerObservedMovePercent(run.benchmark.entryPrice, benchmarkObserved);
    const averageReturnPercent = average(returns);
    const state = !due
        ? 'collecting'
        : returns.length === 0
            ? 'due'
            : returns.length < run.picks.length
                ? 'partial'
                : 'resolved';
    return {
        state,
        dueAt,
        trackedCount: returns.length,
        averageReturnPercent,
        positiveRatePercent: returns.length === 0
            ? null
            : Math.round((returns.filter((value) => value > 0).length / returns.length) * 100),
        benchmarkReturnPercent,
        relativeReturnPercent: averageReturnPercent === null || benchmarkReturnPercent === null
            ? null
            : Number((averageReturnPercent - benchmarkReturnPercent).toFixed(2)),
    };
};
