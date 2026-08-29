export type ResearchMemoryDecision = 'dca' | 'watch' | 'wait' | 'avoid';
export type ResearchMemoryEvidenceDirection = 'supports' | 'conflicts' | 'neutral';
export type ResearchMemoryFreshness = 'fresh' | 'aging' | 'stale' | 'unknown';
export type ResearchMemoryEvidenceDomain = 'fundamentals' | 'valuation' | 'macro' | 'sentiment' | 'technical' | 'event' | 'other';

export type ResearchMemoryEvidenceItem = {
    readonly id: string;
    readonly ticker: string;
    readonly domain: ResearchMemoryEvidenceDomain;
    readonly label: string;
    readonly detail: string;
    readonly direction: ResearchMemoryEvidenceDirection;
    readonly strength: number;
    readonly observedAt: string;
    readonly sourceDate?: string;
    readonly freshness: ResearchMemoryFreshness;
    readonly thesisDimension?: string;
    readonly source?: string;
};

export type ResearchMemorySnapshot = {
    readonly id: string;
    readonly ticker: string;
    readonly observedAt: string;
    readonly price?: number;
    readonly forwardPe?: number;
    readonly forwardEps?: number;
    readonly revenueGrowthPct?: number;
    readonly earningsGrowthPct?: number;
    readonly evidence: readonly ResearchMemoryEvidenceItem[];
    readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
};

export type ResearchMemoryThesisVersion = {
    readonly id: string;
    readonly ticker: string;
    readonly version: number;
    readonly createdAt: string;
    readonly thesis: string;
    readonly invalidation: readonly string[];
    readonly decision: ResearchMemoryDecision;
    readonly evidenceIds: readonly string[];
    readonly reason?: string;
};

export type ResearchMemoryDecisionTrigger = {
    readonly id: string;
    readonly ticker: string;
    readonly type: 'price_below' | 'price_above' | 'forward_pe_below' | 'forward_pe_above' | 'forward_eps_change_pct' | 'manual';
    readonly threshold?: number;
    readonly description: string;
    readonly createdAt: string;
};

export type ResearchMemoryDecisionRecord = {
    readonly id: string;
    readonly ticker: string;
    readonly decidedAt: string;
    readonly decision: ResearchMemoryDecision;
    readonly thesisVersionId?: string;
    readonly reason: string;
    readonly triggers: readonly ResearchMemoryDecisionTrigger[];
};

export type ResearchMemoryState = {
    readonly ticker: string;
    readonly snapshots: readonly ResearchMemorySnapshot[];
    readonly evidence: readonly ResearchMemoryEvidenceItem[];
    readonly thesisVersions: readonly ResearchMemoryThesisVersion[];
    readonly decisions: readonly ResearchMemoryDecisionRecord[];
};

const tickerPattern = /^[A-Z0-9.-]{1,20}$/;

export const normalizeResearchMemoryTicker = (ticker: string) => {
    const normalized = ticker.trim().toUpperCase();
    if (!tickerPattern.test(normalized)) throw new Error('Invalid research-memory ticker');
    return normalized;
};

const ensureIsoDate = (value: string, label: string) => {
    if (!value || Number.isNaN(Date.parse(value))) throw new Error(`Invalid ${label}`);
    return new Date(value).toISOString();
};

const boundedStrength = (value: number) => {
    if (!Number.isFinite(value)) throw new Error('Evidence strength must be finite');
    return Math.max(0, Math.min(1, value));
};

export const createResearchMemoryState = (ticker: string): ResearchMemoryState => ({
    ticker: normalizeResearchMemoryTicker(ticker),
    snapshots: [],
    evidence: [],
    thesisVersions: [],
    decisions: [],
});

export const createResearchMemoryEvidence = (input: Omit<ResearchMemoryEvidenceItem, 'ticker' | 'observedAt' | 'strength'> & {
    readonly ticker: string;
    readonly observedAt: string;
    readonly strength: number;
}): ResearchMemoryEvidenceItem => ({
    ...input,
    ticker: normalizeResearchMemoryTicker(input.ticker),
    observedAt: ensureIsoDate(input.observedAt, 'evidence observedAt'),
    sourceDate: input.sourceDate ? ensureIsoDate(input.sourceDate, 'evidence sourceDate') : undefined,
    strength: boundedStrength(input.strength),
});

export const addResearchMemoryEvidence = (state: ResearchMemoryState, item: ResearchMemoryEvidenceItem): ResearchMemoryState => {
    if (state.ticker !== item.ticker) throw new Error('Evidence ticker does not match research-memory state');
    const withoutDuplicate = state.evidence.filter((entry) => entry.id !== item.id);
    return { ...state, evidence: [...withoutDuplicate, item] };
};

export const appendResearchMemorySnapshot = (state: ResearchMemoryState, snapshot: ResearchMemorySnapshot): ResearchMemoryState => {
    if (state.ticker !== normalizeResearchMemoryTicker(snapshot.ticker)) throw new Error('Snapshot ticker does not match research-memory state');
    const normalized: ResearchMemorySnapshot = {
        ...snapshot,
        ticker: state.ticker,
        observedAt: ensureIsoDate(snapshot.observedAt, 'snapshot observedAt'),
        evidence: snapshot.evidence.map((item) => createResearchMemoryEvidence(item)),
    };
    const withoutDuplicate = state.snapshots.filter((entry) => entry.id !== normalized.id);
    return {
        ...state,
        snapshots: [...withoutDuplicate, normalized].sort((a, b) => a.observedAt.localeCompare(b.observedAt)),
        evidence: normalized.evidence.reduce(addResearchMemoryEvidence, state).evidence,
    };
};

export const appendResearchMemoryThesisVersion = (
    state: ResearchMemoryState,
    input: Omit<ResearchMemoryThesisVersion, 'ticker' | 'version' | 'createdAt'> & { readonly createdAt: string },
): ResearchMemoryState => {
    const createdAt = ensureIsoDate(input.createdAt, 'thesis createdAt');
    const nextVersion = Math.max(0, ...state.thesisVersions.map((entry) => entry.version)) + 1;
    const thesis: ResearchMemoryThesisVersion = {
        ...input,
        ticker: state.ticker,
        version: nextVersion,
        createdAt,
    };
    return { ...state, thesisVersions: [...state.thesisVersions, thesis] };
};

export const recordResearchMemoryDecision = (
    state: ResearchMemoryState,
    input: Omit<ResearchMemoryDecisionRecord, 'ticker' | 'decidedAt'> & { readonly decidedAt: string },
): ResearchMemoryState => {
    const decision: ResearchMemoryDecisionRecord = {
        ...input,
        ticker: state.ticker,
        decidedAt: ensureIsoDate(input.decidedAt, 'decision decidedAt'),
        triggers: input.triggers.map((trigger) => ({
            ...trigger,
            ticker: state.ticker,
            createdAt: ensureIsoDate(trigger.createdAt, 'trigger createdAt'),
        })),
    };
    return { ...state, decisions: [...state.decisions, decision] };
};

export const getLatestResearchMemorySnapshot = (state: ResearchMemoryState) => state.snapshots.at(-1) ?? null;
export const getLatestResearchMemoryThesis = (state: ResearchMemoryState) => state.thesisVersions.at(-1) ?? null;
export const getLatestResearchMemoryDecision = (state: ResearchMemoryState) => state.decisions.at(-1) ?? null;
