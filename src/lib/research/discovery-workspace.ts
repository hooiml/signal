import { defaultDiscoveryFilters, type DiscoveryFilters } from './discovery-filters';
import type { DiscoveryContender, QualityDiscoveryResult } from '../types/research-discovery';

export const DISCOVERY_VISIT_STORAGE_KEY = 'signal-discovery-visit-v1';
export const DISCOVERY_SAVED_VIEWS_STORAGE_KEY = 'signal-discovery-saved-views-v1';

export type DiscoveryVisitCandidate = {
    readonly symbol: string;
    readonly rank: number;
    readonly score: number;
    readonly risk: QualityDiscoveryResult['risk'];
    readonly valuation: QualityDiscoveryResult['valuation']['guardrail'];
    readonly catalystDate: string | null;
};

export type DiscoveryVisitSnapshot = {
    readonly version: 1;
    readonly capturedAt: string;
    readonly candidates: readonly DiscoveryVisitCandidate[];
};

export type DiscoveryVisitChange = {
    readonly symbol: string;
    readonly kind: 'new' | 'rank' | 'risk' | 'valuation' | 'catalyst';
    readonly detail: string;
    readonly importance: number;
};

export type SavedDiscoveryView = {
    readonly id: string;
    readonly name: string;
    readonly filters: DiscoveryFilters;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
    typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null;

export const buildDiscoveryVisitSnapshot = (
    leaders: readonly QualityDiscoveryResult[],
    contenders: readonly DiscoveryContender[],
    capturedAt: string,
): DiscoveryVisitSnapshot => ({
    version: 1,
    capturedAt,
    candidates: [...leaders, ...contenders].map((candidate, index) => ({
        symbol: candidate.symbol,
        rank: index + 1,
        score: candidate.discoveryScore,
        risk: candidate.risk,
        valuation: candidate.valuation.guardrail,
        catalystDate: candidate.catalyst?.date ?? null,
    })),
});

export const parseDiscoveryVisitSnapshot = (value: unknown): DiscoveryVisitSnapshot | null => {
    const snapshot = asRecord(value);
    if (!snapshot || snapshot.version !== 1 || typeof snapshot.capturedAt !== 'string' || !Array.isArray(snapshot.candidates)) return null;
    const candidates = snapshot.candidates.flatMap((item) => {
        const candidate = asRecord(item);
        if (!candidate || typeof candidate.symbol !== 'string' || typeof candidate.rank !== 'number' || typeof candidate.score !== 'number'
            || (candidate.risk !== 'low' && candidate.risk !== 'moderate' && candidate.risk !== 'high')
            || (candidate.valuation !== 'attractive' && candidate.valuation !== 'fair' && candidate.valuation !== 'expensive' && candidate.valuation !== 'extreme' && candidate.valuation !== 'unavailable')
            || (candidate.catalystDate !== null && typeof candidate.catalystDate !== 'string')) return [];
        return [{
            symbol: candidate.symbol,
            rank: candidate.rank,
            score: candidate.score,
            risk: candidate.risk as DiscoveryVisitCandidate['risk'],
            valuation: candidate.valuation as DiscoveryVisitCandidate['valuation'],
            catalystDate: candidate.catalystDate,
        }];
    });
    return candidates.length === snapshot.candidates.length ? { version: 1, capturedAt: snapshot.capturedAt, candidates } : null;
};

export const compareDiscoveryVisits = (
    previous: DiscoveryVisitSnapshot | null,
    current: DiscoveryVisitSnapshot,
): readonly DiscoveryVisitChange[] => {
    if (!previous) return [];
    const priorBySymbol = new Map(previous.candidates.map((candidate) => [candidate.symbol, candidate]));
    const changes = current.candidates.flatMap((candidate) => {
        const prior = priorBySymbol.get(candidate.symbol);
        if (!prior) return [{ symbol: candidate.symbol, kind: 'new' as const, detail: `Entered the ranked list at #${candidate.rank}.`, importance: 100 - candidate.rank }];
        const items: DiscoveryVisitChange[] = [];
        const rankDelta = prior.rank - candidate.rank;
        if (Math.abs(rankDelta) >= 3) items.push({ symbol: candidate.symbol, kind: 'rank', detail: `Moved ${rankDelta > 0 ? 'up' : 'down'} ${Math.abs(rankDelta)} places to #${candidate.rank}.`, importance: 70 + Math.abs(rankDelta) });
        if (prior.risk !== candidate.risk) items.push({ symbol: candidate.symbol, kind: 'risk', detail: `Risk changed from ${prior.risk} to ${candidate.risk}.`, importance: 90 });
        if (prior.valuation !== candidate.valuation) items.push({ symbol: candidate.symbol, kind: 'valuation', detail: `Valuation changed from ${prior.valuation} to ${candidate.valuation}.`, importance: 60 });
        if (prior.catalystDate !== candidate.catalystDate) items.push({ symbol: candidate.symbol, kind: 'catalyst', detail: candidate.catalystDate ? `Earnings catalyst added for ${candidate.catalystDate}.` : 'Previously listed earnings catalyst is no longer present.', importance: 80 });
        return items;
    });
    return changes.sort((left, right) => right.importance - left.importance || left.symbol.localeCompare(right.symbol)).slice(0, 8);
};

const parseFilters = (value: unknown): DiscoveryFilters | null => {
    const filters = asRecord(value);
    if (!filters || typeof filters.sector !== 'string'
        || (filters.risk !== 'all' && filters.risk !== 'low' && filters.risk !== 'moderate' && filters.risk !== 'high')
        || (filters.stage !== 'all' && filters.stage !== 'emerging' && filters.stage !== 'confirmed' && filters.stage !== 'extended' && filters.stage !== 'not ready')
        || (filters.valuation !== 'all' && filters.valuation !== 'attractive' && filters.valuation !== 'fair' && filters.valuation !== 'expensive' && filters.valuation !== 'extreme' && filters.valuation !== 'unavailable')) return null;
    return { sector: filters.sector, risk: filters.risk, stage: filters.stage, valuation: filters.valuation };
};

export const parseSavedDiscoveryViews = (value: unknown): readonly SavedDiscoveryView[] => {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 5).flatMap((item) => {
        const view = asRecord(item);
        const filters = view ? parseFilters(view.filters) : null;
        if (!view || typeof view.id !== 'string' || typeof view.name !== 'string' || !view.name.trim() || view.name.length > 40 || !filters) return [];
        return [{ id: view.id, name: view.name.trim(), filters }];
    });
};

export const upsertSavedDiscoveryView = (
    current: readonly SavedDiscoveryView[],
    name: string,
    filters: DiscoveryFilters,
): readonly SavedDiscoveryView[] => {
    const cleanName = name.trim().slice(0, 40);
    if (!cleanName) return current;
    const id = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'view';
    return [...current.filter((view) => view.id !== id), { id, name: cleanName, filters: { ...filters } }].slice(-5);
};

export const removeSavedDiscoveryView = (current: readonly SavedDiscoveryView[], id: string): readonly SavedDiscoveryView[] =>
    current.filter((view) => view.id !== id);

export const emptySavedDiscoveryView = (): SavedDiscoveryView => ({ id: 'all', name: 'All candidates', filters: defaultDiscoveryFilters });
