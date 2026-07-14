import type { MarketSignal, SignalTier } from './types/signal-v2';

export type MarketAlertCondition =
    | 'score-above'
    | 'score-below'
    | 'agreement-below'
    | 'tier-change'
    | 'freshness-risk'
    | 'daily-move';

export type MarketAlertRule = {
    readonly id: string;
    readonly market: MarketSignal['metadata']['market'];
    readonly mode: MarketSignal['mode'];
    readonly enableSocial: boolean;
    readonly condition: MarketAlertCondition;
    readonly threshold: number | null;
    readonly baselineTier: SignalTier | null;
    readonly createdAt: string;
};

export type MarketAlertEvaluation = {
    readonly triggered: boolean;
    readonly label: string;
    readonly detail: string;
};

const CONDITIONS: readonly MarketAlertCondition[] = [
    'score-above',
    'score-below',
    'agreement-below',
    'tier-change',
    'freshness-risk',
    'daily-move',
];

const TIERS: readonly SignalTier[] = ['strong-buy', 'buy', 'neutral', 'sell', 'strong-sell'];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const isCondition = (value: unknown): value is MarketAlertCondition => typeof value === 'string' && CONDITIONS.includes(value as MarketAlertCondition);

const isTier = (value: unknown): value is SignalTier => typeof value === 'string' && TIERS.includes(value as SignalTier);

const hasValidThreshold = (condition: MarketAlertCondition, threshold: unknown): threshold is number | null => {
    if (!conditionNeedsThreshold(condition)) return threshold === null;
    if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0 || threshold > 100) return false;
    return condition !== 'daily-move' || threshold > 0;
};

const hasValidBaseline = (condition: MarketAlertCondition, baselineTier: unknown): baselineTier is SignalTier | null => {
    if (condition === 'tier-change') return isTier(baselineTier);
    return baselineTier === null;
};

export const parseMarketAlertRules = (value: unknown): readonly MarketAlertRule[] => {
    if (!Array.isArray(value)) return [];

    return value.flatMap((item): readonly MarketAlertRule[] => {
        if (!isRecord(item) || typeof item.id !== 'string' || (item.market !== 'US' && item.market !== 'MY')
            || (item.mode !== 'standard' && item.mode !== 'contrarian') || typeof item.enableSocial !== 'boolean'
            || !isCondition(item.condition) || typeof item.createdAt !== 'string') return [];
        if (!hasValidThreshold(item.condition, item.threshold)) return [];
        if (!hasValidBaseline(item.condition, item.baselineTier)) return [];

        return [{
            id: item.id,
            market: item.market,
            mode: item.mode,
            enableSocial: item.enableSocial,
            condition: item.condition,
            threshold: item.threshold,
            baselineTier: item.baselineTier,
            createdAt: item.createdAt,
        }];
    });
};

export const conditionNeedsThreshold = (condition: MarketAlertCondition) => condition !== 'tier-change' && condition !== 'freshness-risk';

export const getMarketAlertRulesForBriefing = (
    rules: readonly MarketAlertRule[],
    signal: MarketSignal,
    enableSocial: boolean,
) => rules.filter((rule) => rule.market === signal.metadata.market && rule.mode === signal.mode && rule.enableSocial === enableSocial);

export const getDefaultMarketAlertThreshold = (condition: MarketAlertCondition, signal: MarketSignal) => {
    if (condition === 'score-above') return Math.min(100, Math.ceil(signal.composite_score + 5));
    if (condition === 'score-below') return Math.max(0, Math.floor(signal.composite_score - 5));
    if (condition === 'agreement-below') return Math.max(0, Math.floor(signal.confidence.agreement_pct - 10));
    return 5;
};

export const evaluateMarketAlert = (rule: MarketAlertRule, signal: MarketSignal): MarketAlertEvaluation => {
    const threshold = rule.threshold ?? 0;
    const roundedScore = Math.round(signal.composite_score);
    const roundedAgreement = Math.round(signal.confidence.agreement_pct);

    if (rule.condition === 'score-above') return {
        triggered: signal.composite_score >= threshold,
        label: `Score reaches ${threshold} or higher`,
        detail: `Current score: ${roundedScore}`,
    };
    if (rule.condition === 'score-below') return {
        triggered: signal.composite_score <= threshold,
        label: `Score reaches ${threshold} or lower`,
        detail: `Current score: ${roundedScore}`,
    };
    if (rule.condition === 'agreement-below') return {
        triggered: signal.confidence.agreement_pct < threshold,
        label: `Evidence agreement falls below ${threshold}%`,
        detail: `Current agreement: ${roundedAgreement}%`,
    };
    if (rule.condition === 'tier-change') return {
        triggered: rule.baselineTier !== null && signal.tier !== rule.baselineTier,
        label: 'Market tier changes',
        detail: rule.baselineTier ? `Started at ${formatTier(rule.baselineTier)}; now ${formatTier(signal.tier)}` : `Current tier: ${formatTier(signal.tier)}`,
    };
    if (rule.condition === 'freshness-risk') {
        const freshness = signal.metadata.signal_quality?.freshness ?? 'stale';
        return {
            triggered: freshness !== 'fresh',
            label: 'Data freshness needs attention',
            detail: `Current freshness: ${capitalize(freshness)}`,
        };
    }

    const delta = signal.metadata.score_delta?.delta;
    return {
        triggered: typeof delta === 'number' && Math.abs(delta) >= threshold,
        label: `Daily score move reaches ${threshold} points`,
        detail: typeof delta === 'number' ? `Current move: ${delta > 0 ? '+' : ''}${delta.toFixed(1)} points` : 'No prior comparison is available',
    };
};

const formatTier = (tier: SignalTier) => tier.split('-').map(capitalize).join(' ');

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
