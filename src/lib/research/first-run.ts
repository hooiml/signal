import type { ResearchRecord } from '../types/research';

export const FIRST_RUN_SETUP_STORAGE_KEY = 'signal-first-run-setup-v1';

export const firstRunSetupStepIds = [
    'markets',
    'watchlist',
    'review',
    'schedule',
    'monitoring',
] as const;

export type FirstRunSetupStepId = typeof firstRunSetupStepIds[number];
export type FirstRunSetupStatus = 'active' | 'skipped' | 'completed';
export type FirstRunMarket = 'US' | 'MY';
export type FirstRunMonitoringChoice = 'pending' | 'skipped';

export type FirstRunSetupState = {
    readonly version: 1;
    readonly status: FirstRunSetupStatus;
    readonly markets: readonly FirstRunMarket[];
    readonly completedSteps: readonly FirstRunSetupStepId[];
    readonly monitoringChoice: FirstRunMonitoringChoice;
    readonly updatedAt: string;
};

export type FirstRunOwnerState = {
    readonly records: readonly ResearchRecord[];
    readonly hasPortfolioSnapshot: boolean;
};

const setupStatuses: readonly FirstRunSetupStatus[] = ['active', 'skipped', 'completed'];
const setupMarkets: readonly FirstRunMarket[] = ['US', 'MY'];
const monitoringChoices: readonly FirstRunMonitoringChoice[] = ['pending', 'skipped'];
const setupKeys = ['version', 'status', 'markets', 'completedSteps', 'monitoringChoice', 'updatedAt'];

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isTimestamp = (value: unknown): value is string =>
    typeof value === 'string' && !Number.isNaN(Date.parse(value));

const isUniqueEnumList = <T extends string>(
    value: unknown,
    allowed: readonly T[],
): value is readonly T[] =>
    Array.isArray(value)
    && value.length <= allowed.length
    && value.every((item): item is T => typeof item === 'string' && allowed.includes(item as T))
    && new Set(value).size === value.length;

export const parseFirstRunSetupState = (value: unknown): FirstRunSetupState => {
    if (!isObject(value) || value.version !== 1) throw new Error('First-run setup version is unsupported.');
    if (Object.keys(value).some((key) => !setupKeys.includes(key))) {
        throw new Error('First-run setup contains unexpected fields.');
    }
    if (!setupStatuses.includes(value.status as FirstRunSetupStatus)) {
        throw new Error('First-run setup status is invalid.');
    }
    if (!isUniqueEnumList(value.markets, setupMarkets)) {
        throw new Error('First-run setup markets are invalid.');
    }
    if (!isUniqueEnumList(value.completedSteps, firstRunSetupStepIds)) {
        throw new Error('First-run setup completed steps are invalid.');
    }
    if (!monitoringChoices.includes(value.monitoringChoice as FirstRunMonitoringChoice)) {
        throw new Error('First-run setup monitoring choice is invalid.');
    }
    if (!isTimestamp(value.updatedAt)) throw new Error('First-run setup update time is invalid.');

    return {
        version: 1,
        status: value.status as FirstRunSetupStatus,
        markets: value.markets,
        completedSteps: value.completedSteps,
        monitoringChoice: value.monitoringChoice as FirstRunMonitoringChoice,
        updatedAt: value.updatedAt,
    };
};

export const createFirstRunSetupState = (updatedAt: string): FirstRunSetupState =>
    parseFirstRunSetupState({
        version: 1,
        status: 'active',
        markets: [],
        completedSteps: [],
        monitoringChoice: 'pending',
        updatedAt,
    });

export const firstRunOwnerCompletedSteps = (
    state: Pick<FirstRunSetupState, 'markets'>,
    owner: FirstRunOwnerState,
): readonly FirstRunSetupStepId[] => {
    const completed: FirstRunSetupStepId[] = [];
    if (state.markets.length > 0) completed.push('markets');
    if (owner.records.length > 0 || owner.hasPortfolioSnapshot) completed.push('watchlist');
    if (owner.records.some((record) => record.reviewHistory.length > 0)) completed.push('review');
    if (owner.records.some((record) => record.decisionJournal.nextReviewAt !== null)) completed.push('schedule');
    if (owner.records.some((record) => record.monitoringRules.structuredTriggers.rules.length > 0)) completed.push('monitoring');
    return completed;
};

export const reconcileFirstRunSetupState = (
    stateInput: FirstRunSetupState,
    owner: FirstRunOwnerState,
    updatedAt: string,
): FirstRunSetupState => {
    const state = parseFirstRunSetupState(stateInput);
    const completedSteps = firstRunSetupStepIds.filter((step) =>
        state.completedSteps.includes(step)
        || firstRunOwnerCompletedSteps(state, owner).includes(step));
    const requiredComplete = ['markets', 'watchlist', 'review', 'schedule']
        .every((step) => completedSteps.includes(step as FirstRunSetupStepId));
    const monitoringComplete = completedSteps.includes('monitoring') || state.monitoringChoice === 'skipped';
    const status = state.status === 'skipped'
        ? 'skipped'
        : requiredComplete && monitoringComplete ? 'completed' : 'active';

    return parseFirstRunSetupState({
        ...state,
        status,
        completedSteps,
        updatedAt,
    });
};

export const updateFirstRunMarkets = (
    stateInput: FirstRunSetupState,
    markets: readonly FirstRunMarket[],
    updatedAt: string,
): FirstRunSetupState => {
    const state = parseFirstRunSetupState(stateInput);
    if (!isUniqueEnumList(markets, setupMarkets)) throw new Error('Choose only supported setup markets.');
    return parseFirstRunSetupState({
        ...state,
        status: 'active',
        markets: setupMarkets.filter((market) => markets.includes(market)),
        completedSteps: state.completedSteps.filter((step) => step !== 'markets'),
        updatedAt,
    });
};

export const setFirstRunMonitoringSkipped = (
    stateInput: FirstRunSetupState,
    skipped: boolean,
    updatedAt: string,
): FirstRunSetupState => parseFirstRunSetupState({
    ...parseFirstRunSetupState(stateInput),
    status: 'active',
    monitoringChoice: skipped ? 'skipped' : 'pending',
    updatedAt,
});

export const setFirstRunSetupStatus = (
    stateInput: FirstRunSetupState,
    status: FirstRunSetupStatus,
    updatedAt: string,
): FirstRunSetupState => parseFirstRunSetupState({
    ...parseFirstRunSetupState(stateInput),
    status,
    updatedAt,
});

export const hasExistingFirstRunOwnerState = (
    owner: FirstRunOwnerState,
    queueTaskCount: number,
): boolean => owner.records.length > 0 || owner.hasPortfolioSnapshot || queueTaskCount > 0;
