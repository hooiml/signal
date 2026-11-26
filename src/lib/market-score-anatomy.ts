import { INDICATOR_REGISTRY, getIndicatorDisplayName } from './indicator-registry';
import { tierForMarketScore } from './market-sensitivity';
import type { MarketSignal, SignalTier } from './types/signal-v2';

export type IndicatorCadenceInfo = {
    readonly shortLabel: string;
    readonly scheduleHint: string;
};

const INDICATOR_CADENCE: Readonly<Record<string, IndicatorCadenceInfo>> = {
    vix: { shortLabel: 'Live · daily', scheduleHint: 'Updates during trading sessions' },
    put_call: { shortLabel: 'Daily · EOD', scheduleHint: 'Publishes after US market close' },
    social: { shortLabel: 'Daily · rolling', scheduleHint: 'Aggregates recent social posts' },
    klci_trend: { shortLabel: 'Daily · EOD', scheduleHint: 'Updates after Bursa close' },
    my_breadth: { shortLabel: 'Daily · EOD', scheduleHint: 'Updates after Bursa close' },
    news: { shortLabel: 'Daily · rolling', scheduleHint: 'Aggregates recent market feeds' },
    aaii: { shortLabel: 'Weekly · Thu', scheduleHint: 'AAII survey publishes Thursdays' },
    naaim: { shortLabel: 'Weekly · Thu', scheduleHint: 'NAAIM survey publishes Thursdays' },
    bofa: { shortLabel: 'Monthly', scheduleHint: 'Updated monthly when published' },
};

export function indicatorCadenceInfo(key: string): IndicatorCadenceInfo | null {
    const known = INDICATOR_CADENCE[key];
    if (known) return known;
    const def = INDICATOR_REGISTRY[key];
    if (!def) return null;
    if (def.frequency === 'live') return { shortLabel: 'Live', scheduleHint: 'Updates during trading sessions' };
    if (def.frequency === 'daily') return { shortLabel: 'Daily', scheduleHint: 'Updates each trading day' };
    if (def.frequency === 'weekly') return { shortLabel: 'Weekly', scheduleHint: 'Updates on a weekly cycle' };
    return { shortLabel: 'Periodic', scheduleHint: 'Updated when new reports publish' };
}

export type ScoreAnatomyItem = {
    readonly key: string;
    readonly name: string;
    readonly score: number;
    readonly weight: number;
    readonly impact: number;
    readonly included: boolean;
};

export type ScoreAnatomyResult = {
    readonly officialScore: number;
    readonly officialTier: SignalTier;
    readonly exploringScore: number | null;
    readonly exploringTier: SignalTier | null;
    readonly delta: number | null;
    readonly activeWeight: number;
    readonly neutralPoints: number;
    readonly excludedNames: readonly string[];
    readonly items: readonly ScoreAnatomyItem[];
};

const clampScore = (value: number): number =>
    Math.max(0, Math.min(100, Number.isFinite(value) ? value : 50));

/**
 * Pure local what-if breakdown of a MarketSignal's scored indicators.
 * Excluding an input proportionally redistributes active observed weight across
 * the remaining included inputs while preserving any missing-source neutral reserve.
 * Never mutates the signal or persists preferences.
 */
export function computeScoreAnatomy(
    signal: MarketSignal,
    excludedKeys: ReadonlySet<string>,
): ScoreAnatomyResult {
    const items: ScoreAnatomyItem[] = Object.entries(signal.components)
        .filter(([, item]) => item && item.enabled !== false && Number.isFinite(item.weight) && item.weight > 0)
        .map(([key, item]) => {
            const score = clampScore(item.score);
            const weight = item.weight;
            return {
                key,
                name: item.display_name || getIndicatorDisplayName(key),
                score,
                weight,
                impact: (score - 50) * weight,
                included: !excludedKeys.has(key),
            };
        })
        .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact) || b.weight - a.weight || a.key.localeCompare(b.key));

    const activeWeight = items.reduce((sum, item) => sum + item.weight, 0);
    const neutralBaseline = signal.metadata.coverage_adjustment?.neutral_baseline ?? 50;
    const neutralPoints = signal.metadata.coverage_adjustment?.neutral_points
        ?? Math.max(0, 1 - activeWeight) * neutralBaseline;

    const includedItems = items.filter(item => item.included);
    const includedWeight = includedItems.reduce((sum, item) => sum + item.weight, 0);
    const excludedNames = items.filter(item => !item.included).map(item => item.name);

    const officialScore = signal.composite_score;
    if (excludedNames.length === 0) {
        return {
            officialScore,
            officialTier: signal.tier,
            exploringScore: officialScore,
            exploringTier: signal.tier,
            delta: 0,
            activeWeight,
            neutralPoints,
            excludedNames,
            items,
        };
    }

    if (includedWeight <= 0 || activeWeight <= 0) {
        return {
            officialScore,
            officialTier: signal.tier,
            exploringScore: null,
            exploringTier: null,
            delta: null,
            activeWeight,
            neutralPoints,
            excludedNames,
            items,
        };
    }

    const scale = activeWeight / includedWeight;
    const exploringRaw = includedItems.reduce((sum, item) => sum + item.score * item.weight * scale, neutralPoints);
    const exploringScore = Math.max(0, Math.min(100, Math.round(exploringRaw)));
    const exploringTier = tierForMarketScore(exploringScore, signal.mode);

    return {
        officialScore,
        officialTier: signal.tier,
        exploringScore,
        exploringTier,
        delta: exploringScore - Math.round(officialScore),
        activeWeight,
        neutralPoints,
        excludedNames,
        items,
    };
}
