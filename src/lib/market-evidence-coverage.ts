import { getIndicatorBaseWeights, INDICATOR_REGISTRY } from './indicator-registry';
import type { IndicatorData, MarketSignal } from './types/signal-v2';

export function hasRetrievalTimestamp(indicator: IndicatorData | undefined): boolean {
    // signal.ts creates social/news timestamps at retrieval. Older responses omit the basis.
    return indicator?.metadata?.timestamp_basis === 'retrieved'
        || (indicator?.metadata?.timestamp_basis === undefined && (indicator?.name === 'social' || indicator?.name === 'news'));
}

/** Values are weight percentages, not input counts. Unknown observation dates are never marked fresh. */
export interface MarketEvidenceCoverage {
    configuredCount: number;
    scoredCount: number;
    unavailableKeys: string[];
    staleKeys: string[];
    unknownDateKeys: string[];
    observedPct: number | null;
    fallbackPct: number | null;
    freshPct: number | null;
    stalePct: number | null;
    verifiedPartition: boolean;
}

const close = (a: number, b: number) => Math.abs(a - b) < 0.005;
function freshness(date: string, snapshot: string | null | undefined, basis: 'observed' | 'retrieved' | undefined, days: number | undefined): 'fresh' | 'stale' | 'unknown' {
    if (basis === 'retrieved' || !snapshot || days === undefined) return 'unknown';
    const observed = Date.parse(date.slice(0, 10) + 'T00:00:00Z');
    const compared = Date.parse(snapshot.slice(0, 10) + 'T00:00:00Z');
    if (!Number.isFinite(observed) || !Number.isFinite(compared) || observed > compared) return 'unknown';
    return (compared - observed) / 86400000 > days ? 'stale' : 'fresh';
}

export function marketEvidenceCoverage(signal: MarketSignal, snapshotDate: string | null | undefined): MarketEvidenceCoverage {
    const highVolatility = signal.metadata.market === 'US' && signal.components.vix?.enabled === true && signal.components.vix.value > 30;
    const weights = getIndicatorBaseWeights(signal.metadata.market, { highVolatilityOverride: highVolatility });
    const keys = Object.keys(weights).filter(key => weights[key] > 0);
    const total = keys.reduce((sum, key) => sum + weights[key], 0);
    const scored = keys.filter(key => signal.components[key]?.enabled === true);
    const unavailableKeys = keys.filter(key => !scored.includes(key));
    const source = signal.metadata.coverage_adjustment;
    const sourceValid = !!source && source.active_weight >= 0 && source.missing_weight >= 0 && close(source.active_weight + source.missing_weight, 1);
    const configuredValid = sourceValid && total > 0
        && close(scored.reduce((sum, key) => sum + signal.components[key].weight, 0), source!.active_weight)
        && close(scored.reduce((sum, key) => sum + weights[key] / total, 0), source!.active_weight)
        && scored.every(key => close(signal.components[key].weight, weights[key] / total));
    let freshWeight = 0;
    let staleWeight = 0;
    const staleKeys: string[] = [];
    const unknownDateKeys: string[] = [];
    for (const key of scored) {
        const item = signal.components[key];
        const state = freshness(item.last_updated, snapshotDate, hasRetrievalTimestamp(item) ? 'retrieved' : item.metadata?.timestamp_basis, INDICATOR_REGISTRY[key]?.staleAfterDays);
        if (state === 'fresh') freshWeight += item.weight;
        else if (state === 'stale') { staleWeight += item.weight; staleKeys.push(key); }
        else unknownDateKeys.push(key);
    }
    const verifiedPartition = configuredValid && unknownDateKeys.length === 0
        && close(freshWeight + staleWeight, source!.active_weight)
        && close(freshWeight + staleWeight + source!.missing_weight, 1);
    return {
        configuredCount: keys.length, scoredCount: scored.length, unavailableKeys, staleKeys, unknownDateKeys,
        observedPct: sourceValid ? source!.active_weight * 100 : null,
        fallbackPct: sourceValid ? source!.missing_weight * 100 : null,
        freshPct: verifiedPartition ? freshWeight * 100 : null,
        stalePct: verifiedPartition ? staleWeight * 100 : null,
        verifiedPartition,
    };
}
