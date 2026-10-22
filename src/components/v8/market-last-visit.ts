import type { MarketSignal } from '@/lib/types/signal-v2';

// Browser-local memory of the Market reading per market and mode, used for "Since your last visit".
export const MARKET_VISITS_STORAGE_KEY = 'signal-v8-market-visits-v1';

export type MarketVisit = { snapshotDate: string; score: number; impacts: Record<string, number> };
type VisitEntry = { last: MarketVisit; baseline?: MarketVisit };
export type MarketVisitStore = Record<string, VisitEntry>;

/** Points an input adds to or takes from the composite relative to the neutral 50. */
export const inputImpact = (score: number, weight: number) => (score - 50) * weight;

export function visitFromSignal(signal: MarketSignal, snapshotDate: string): MarketVisit {
    const impacts: Record<string, number> = {};
    for (const [key, item] of Object.entries(signal.components)) {
        if (item.enabled !== false && item.weight > 0 && Number.isFinite(item.score)) impacts[key] = inputImpact(item.score, item.weight);
    }
    return { snapshotDate, score: signal.composite_score, impacts };
}

const isVisit = (value: unknown): value is MarketVisit => {
    if (!value || typeof value !== 'object') return false;
    const visit = value as Record<string, unknown>;
    return typeof visit.snapshotDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(visit.snapshotDate)
        && typeof visit.score === 'number' && Number.isFinite(visit.score)
        && !!visit.impacts && typeof visit.impacts === 'object'
        && Object.values(visit.impacts as Record<string, unknown>).every(impact => typeof impact === 'number' && Number.isFinite(impact));
};

/** Malformed or partial storage is dropped entry by entry, never trusted. */
export function parseMarketVisits(raw: string | null): MarketVisitStore {
    if (!raw) return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        const store: MarketVisitStore = {};
        for (const [key, entry] of Object.entries(parsed as Record<string, unknown>)) {
            if (!entry || typeof entry !== 'object' || !isVisit((entry as VisitEntry).last)) continue;
            const { last, baseline } = entry as VisitEntry;
            store[key] = isVisit(baseline) ? { last, baseline } : { last };
        }
        return store;
    } catch { return {}; }
}

/** A new snapshot moves the previous one to the baseline; reloading the same snapshot keeps it. */
export function recordMarketVisit(store: MarketVisitStore, key: string, current: MarketVisit): { store: MarketVisitStore; baseline: MarketVisit | null } {
    const entry = store[key];
    if (!entry) return { store: { ...store, [key]: { last: current } }, baseline: null };
    if (entry.last.snapshotDate.slice(0, 10) === current.snapshotDate.slice(0, 10)) {
        return { store: { ...store, [key]: { last: current, baseline: entry.baseline } }, baseline: entry.baseline ?? null };
    }
    return { store: { ...store, [key]: { last: current, baseline: entry.last } }, baseline: entry.last };
}

export type VisitChange = { key: string; delta: number };

/** Inputs whose impact moved by at least half a point, largest first. */
export function visitChanges(baseline: MarketVisit, current: MarketVisit, limit = 2): VisitChange[] {
    const keys = new Set([...Object.keys(baseline.impacts), ...Object.keys(current.impacts)]);
    return [...keys]
        .filter(key => key in baseline.impacts && key in current.impacts)
        .map(key => ({ key, delta: current.impacts[key] - baseline.impacts[key] }))
        .filter(change => Math.abs(change.delta) >= 0.5)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, limit);
}
