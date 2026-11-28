import type { QualityDiscoveryResult } from '../types/research-discovery';

export type DiscoveryDeltaBadge = {
    readonly label: string;
    readonly tone: 'up' | 'down' | 'new';
    readonly title: string;
};

export type DiscoveryFilterState = {
    readonly sector: string;
    readonly lowRiskOnly: boolean;
    readonly hideSaved: boolean;
};

export const defaultDiscoveryFilterState: DiscoveryFilterState = {
    sector: 'all',
    lowRiskOnly: false,
    hideSaved: false,
};

/**
 * Formats the hourly persisted rank or score delta for Discover cards without inventing missing changes.
 */
export function formatDiscoveryRankDelta(row: QualityDiscoveryResult): DiscoveryDeltaBadge | null {
    if (typeof row.rankChange1Week === 'number' && Number.isFinite(row.rankChange1Week) && row.rankChange1Week !== 0) {
        return {
            label: row.rankChange1Week > 0 ? `▲ +${row.rankChange1Week}` : `▼ ${row.rankChange1Week}`,
            tone: row.rankChange1Week > 0 ? 'up' : 'down',
            title: '1-week rank change',
        };
    }
    if (row.rankChange1Week === null && row.scoreChange1Day === null && row.scoreChange1Week === null) {
        return {
            label: 'New',
            tone: 'new',
            title: 'New in discovery scan',
        };
    }
    if (typeof row.scoreChange1Day === 'number' && Number.isFinite(row.scoreChange1Day) && row.scoreChange1Day !== 0) {
        return {
            label: row.scoreChange1Day > 0 ? `▲ +${row.scoreChange1Day} pts` : `▼ ${row.scoreChange1Day} pts`,
            tone: row.scoreChange1Day > 0 ? 'up' : 'down',
            title: '1-day score change',
        };
    }
    return null;
}

/**
 * Returns sorted unique non-empty sector names present in discovery results.
 */
export function extractDiscoverySectors(rows: readonly QualityDiscoveryResult[]): readonly string[] {
    const sectors = new Set<string>();
    for (const row of rows) {
        const trimmed = row.sector.trim();
        if (trimmed) sectors.add(trimmed);
    }
    return [...sectors].sort((left, right) => left.localeCompare(right));
}

/**
 * Applies Discover V9 filter chips (sector, low-risk only, hide saved) without mutating source rows.
 */
export function filterDiscoveryRows<T extends QualityDiscoveryResult>(
    rows: readonly T[],
    filters: DiscoveryFilterState,
    savedSymbols: ReadonlySet<string>,
): readonly T[] {
    return rows.filter(row => {
        if (filters.sector !== 'all' && row.sector.trim() !== filters.sector) return false;
        if (filters.lowRiskOnly && row.risk !== 'low') return false;
        if (filters.hideSaved && savedSymbols.has(row.symbol.trim().toUpperCase())) return false;
        return true;
    });
}
