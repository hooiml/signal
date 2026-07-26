import type { PortfolioSummary } from './portfolio-analytics';

export const portfolioScenarioLibraryLimit = 8;

export type SavedPortfolioScenarioKind = 'market' | 'sector' | 'currency';

export type SavedPortfolioScenario = {
    readonly id: string;
    readonly name: string;
    readonly kind: SavedPortfolioScenarioKind;
    readonly shockPercent: number;
    readonly target: string | null;
    readonly savedAt: string;
};

export type SavedPortfolioScenarioResult = {
    readonly portfolioImpactPercent: number | null;
    readonly coveredAllocationPercent: number;
};

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

const parseScenario = (value: unknown): SavedPortfolioScenario | null => {
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Partial<SavedPortfolioScenario>;
    if (
        typeof candidate.id !== 'string'
        || typeof candidate.name !== 'string'
        || !['market', 'sector', 'currency'].includes(candidate.kind ?? '')
        || !isFiniteNumber(candidate.shockPercent)
        || typeof candidate.savedAt !== 'string'
    ) return null;
    const name = candidate.name.trim().slice(0, 60);
    const shockPercent = Math.max(-100, Math.min(100, candidate.shockPercent));
    const target = candidate.kind === 'market'
        ? null
        : typeof candidate.target === 'string' && candidate.target.trim()
            ? candidate.target.trim().slice(0, 60)
            : null;
    if (!name || (candidate.kind !== 'market' && !target)) return null;
    return {
        id: candidate.id.slice(0, 80),
        name,
        kind: candidate.kind as SavedPortfolioScenarioKind,
        shockPercent,
        target,
        savedAt: candidate.savedAt,
    };
};

export const parseSavedPortfolioScenarios = (value: unknown): readonly SavedPortfolioScenario[] => {
    if (!Array.isArray(value)) return [];
    const byId = new Map<string, SavedPortfolioScenario>();
    for (const entry of value) {
        const parsed = parseScenario(entry);
        if (parsed) byId.set(parsed.id, parsed);
    }
    return [...byId.values()]
        .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
        .slice(0, portfolioScenarioLibraryLimit);
};

export const upsertSavedPortfolioScenario = (
    scenarios: readonly SavedPortfolioScenario[],
    scenario: SavedPortfolioScenario,
): readonly SavedPortfolioScenario[] =>
    parseSavedPortfolioScenarios([scenario, ...scenarios.filter((entry) => entry.id !== scenario.id)]);

export const removeSavedPortfolioScenario = (
    scenarios: readonly SavedPortfolioScenario[],
    id: string,
): readonly SavedPortfolioScenario[] => scenarios.filter((scenario) => scenario.id !== id);

export const applySavedPortfolioScenario = (
    summary: PortfolioSummary,
    scenario: SavedPortfolioScenario,
): SavedPortfolioScenarioResult => {
    const affected = scenario.kind === 'market'
        ? summary.holdings
        : summary.holdings.filter((holding) =>
            scenario.kind === 'sector'
                ? holding.sector === scenario.target
                : holding.currency === scenario.target);
    const coveredAllocationPercent = affected.reduce((total, holding) => total + holding.allocationPercent, 0);
    return {
        portfolioImpactPercent: coveredAllocationPercent === 0
            ? null
            : Number(((coveredAllocationPercent * scenario.shockPercent) / 100).toFixed(2)),
        coveredAllocationPercent: Number(coveredAllocationPercent.toFixed(2)),
    };
};
