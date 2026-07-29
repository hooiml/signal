export const researchLayoutWorkspaces = [
    'research', 'today', 'discovery', 'picker', 'compare', 'calendar', 'alerts', 'changes', 'filings', 'evidence', 'policy', 'queue',
    'portfolio', 'currency', 'relationships', 'peers', 'outcomes', 'replay', 'health', 'packets', 'backup', 'usage',
] as const;

export const researchLayoutDensities = ['comfortable', 'compact'] as const;
const researchLayoutMarkets = ['ALL', 'US', 'MY'] as const;
const researchLayoutActions = ['ALL', 'Ready', 'DCA', 'Wait for price', 'Watch', 'Avoid'] as const;
const researchLayoutTabs = ['overview', 'fundamentals', 'valuation', 'events', 'chart', 'technical'] as const;

export type ResearchLayoutWorkspace = typeof researchLayoutWorkspaces[number];
export type ResearchLayoutDensity = typeof researchLayoutDensities[number];

export type SavedResearchLayout = {
    readonly id: string;
    readonly name: string;
    readonly savedAt: string;
    readonly workspace: ResearchLayoutWorkspace;
    readonly query: string;
    readonly market: typeof researchLayoutMarkets[number];
    readonly action: typeof researchLayoutActions[number];
    readonly ticker: string | null;
    readonly tab: typeof researchLayoutTabs[number];
    readonly density: ResearchLayoutDensity;
};

export const researchSavedLayoutsStorageKey = 'signal-research-saved-layouts-v1';
export const researchDensityStorageKey = 'signal-research-density-v1';
export const researchSavedLayoutLimit = 8;

const oneOf = <T extends string>(value: unknown, options: readonly T[]): value is T =>
    typeof value === 'string' && options.some((option) => option === value);

const parseSavedLayout = (value: unknown): SavedResearchLayout | null => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const item = Object.fromEntries(Object.entries(value));
    if (typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id)) return null;
    if (typeof item.name !== 'string' || item.name.trim().length < 1 || item.name.trim().length > 40) return null;
    if (typeof item.savedAt !== 'string' || Number.isNaN(Date.parse(item.savedAt))) return null;
    if (!oneOf(item.workspace, researchLayoutWorkspaces) || !oneOf(item.market, researchLayoutMarkets)
        || !oneOf(item.action, researchLayoutActions) || !oneOf(item.tab, researchLayoutTabs)
        || !oneOf(item.density, researchLayoutDensities)) return null;
    if (typeof item.query !== 'string' || item.query.length > 80) return null;
    if (item.ticker !== null && (typeof item.ticker !== 'string' || !/^[A-Z0-9.-]{1,20}$/.test(item.ticker))) return null;
    return {
        id: item.id,
        name: item.name.trim(),
        savedAt: new Date(item.savedAt).toISOString(),
        workspace: item.workspace,
        query: item.query,
        market: item.market,
        action: item.action,
        ticker: item.ticker,
        tab: item.tab,
        density: item.density,
    };
};

export const parseSavedResearchLayouts = (value: unknown): readonly SavedResearchLayout[] => {
    if (!Array.isArray(value)) return [];
    const layouts: SavedResearchLayout[] = [];
    for (const item of value) {
        const parsed = parseSavedLayout(item);
        if (parsed && !layouts.some((layout) => layout.id === parsed.id || layout.name.toLowerCase() === parsed.name.toLowerCase())) layouts.push(parsed);
        if (layouts.length === researchSavedLayoutLimit) break;
    }
    return layouts;
};

export const upsertSavedResearchLayout = (
    current: readonly SavedResearchLayout[],
    candidate: SavedResearchLayout,
): readonly SavedResearchLayout[] => {
    const parsed = parseSavedLayout(candidate);
    if (!parsed) return current;
    return [
        parsed,
        ...current.filter((layout) => layout.id !== parsed.id && layout.name.toLowerCase() !== parsed.name.toLowerCase()),
    ].slice(0, researchSavedLayoutLimit);
};

export const removeSavedResearchLayout = (
    current: readonly SavedResearchLayout[],
    id: string,
): readonly SavedResearchLayout[] => current.filter((layout) => layout.id !== id);

export const parseResearchLayoutDensity = (value: unknown): ResearchLayoutDensity =>
    oneOf(value, researchLayoutDensities) ? value : 'comfortable';
