import type { ResearchRecord, ResearchReviewSnapshot } from '@/lib/types/research';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import {
    appendResearchMemorySnapshot,
    appendResearchMemoryThesisVersion,
    createResearchMemoryEvidence,
    createResearchMemoryState,
    recordResearchMemoryDecision,
    type ResearchMemoryDecision,
    type ResearchMemorySnapshot,
    type ResearchMemoryState,
} from './research-memory.ts';

export const RESEARCH_MEMORY_HISTORY_KEY = 'signal-research-memory-history-v1';
const maxSnapshotsPerTicker = 24;

const toDecision = (decision: ResearchRecord['decisionJournal']['decision']): ResearchMemoryDecision => {
    switch (decision) {
        case 'DCA': return 'dca';
        case 'Wait for price': return 'wait';
        case 'Avoid': return 'avoid';
        case 'Ready':
        case 'Watch':
        default: return 'watch';
    }
};

const evidenceDirection = (tone: 'positive' | 'risk' | 'neutral') => tone === 'positive'
    ? 'supports' as const
    : tone === 'risk' ? 'conflicts' as const : 'neutral' as const;

const evidenceFromRecord = (record: ResearchRecord) => record.acceptedEvidence.map((entry) => createResearchMemoryEvidence({
    id: entry.id,
    ticker: record.symbol,
    domain: entry.target === 'notes' ? 'other' : entry.target === 'buyTrigger' || entry.target === 'sellTrigger' ? 'valuation' : 'fundamentals',
    label: entry.title,
    detail: entry.summary,
    direction: evidenceDirection(entry.tone),
    strength: entry.sources.length > 1 ? 0.8 : 0.6,
    observedAt: entry.acceptedAt,
    sourceDate: entry.acceptedAt,
    freshness: 'unknown',
    thesisDimension: entry.target,
    source: entry.sources.map((source) => source.source).filter(Boolean).join(' + ') || undefined,
}));

const appendReviewThesis = (state: ResearchMemoryState, review: ResearchReviewSnapshot, index: number) => appendResearchMemoryThesisVersion(state, {
    id: `review-${review.id}`,
    createdAt: review.reviewedAt,
    thesis: review.bullCase || review.whyInterested || 'No explicit thesis saved for this review.',
    invalidation: review.thesisBreak ? [review.thesisBreak] : [],
    decision: toDecision(review.decisionJournal.decision),
    evidenceIds: review.acceptedEvidence.map((entry) => entry.id),
    reason: review.notes || `Imported from saved review ${index + 1}`,
});

export const buildResearchMemoryStateFromRecord = (record: ResearchRecord): ResearchMemoryState => {
    let state = createResearchMemoryState(record.symbol);
    for (const item of evidenceFromRecord(record)) {
        state = { ...state, evidence: [...state.evidence.filter((entry) => entry.id !== item.id), item] };
    }
    record.reviewHistory.forEach((review, index) => {
        state = appendReviewThesis(state, review, index);
    });
    state = appendResearchMemoryThesisVersion(state, {
        id: `record-${record.revision}`,
        createdAt: record.lastReviewedAt,
        thesis: record.bullCase || record.whyInterested || 'No explicit thesis saved yet.',
        invalidation: record.thesisBreak ? [record.thesisBreak] : [],
        decision: toDecision(record.decisionJournal.decision),
        evidenceIds: record.acceptedEvidence.map((entry) => entry.id),
        reason: record.notes || 'Current saved research state',
    });

    const triggers = [];
    if (record.positionPlan.plannedEntryPrice !== null) triggers.push({
        id: `${record.symbol}-planned-entry`,
        ticker: record.symbol,
        type: 'price_below' as const,
        threshold: record.positionPlan.plannedEntryPrice,
        description: `Review when price reaches planned entry ${record.positionPlan.plannedEntryPrice}`,
        createdAt: record.lastReviewedAt,
    });

    return recordResearchMemoryDecision(state, {
        id: `${record.symbol}-decision-${record.revision}`,
        decidedAt: record.lastReviewedAt,
        decision: toDecision(record.decisionJournal.decision),
        thesisVersionId: `record-${record.revision}`,
        reason: record.notes || record.whyInterested || 'Saved research decision',
        triggers,
    });
};

export const buildResearchMemorySnapshotFromProvider = (record: ResearchRecord, snapshot: ResearchSnapshot): ResearchMemorySnapshot => ({
    id: `${record.symbol}-${snapshot.fetchedAt}`,
    ticker: record.symbol,
    observedAt: snapshot.fetchedAt,
    price: snapshot.quote.price ?? undefined,
    revenueGrowthPct: snapshot.fundamentals.revenueGrowthPercent ?? undefined,
    evidence: evidenceFromRecord(record),
    metadata: {
        market: record.market,
        researchRevision: record.revision,
        providerPe: snapshot.valuation.priceEarnings,
        providerFetchedAt: snapshot.fetchedAt,
    },
});

export const addSnapshotToState = (state: ResearchMemoryState, snapshot: ResearchMemorySnapshot) => appendResearchMemorySnapshot(state, snapshot);

export const readResearchMemoryHistory = (ticker: string): readonly ResearchMemorySnapshot[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(RESEARCH_MEMORY_HISTORY_KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return [];
        const value = (parsed as Record<string, unknown>)[ticker.toUpperCase()];
        if (!Array.isArray(value)) return [];
        return value.filter((entry): entry is ResearchMemorySnapshot => typeof entry === 'object' && entry !== null && !Array.isArray(entry)
            && typeof (entry as ResearchMemorySnapshot).id === 'string'
            && typeof (entry as ResearchMemorySnapshot).observedAt === 'string'
            && (entry as ResearchMemorySnapshot).ticker === ticker.toUpperCase())
            .sort((a, b) => a.observedAt.localeCompare(b.observedAt));
    } catch {
        return [];
    }
};

export const writeResearchMemorySnapshot = (snapshot: ResearchMemorySnapshot) => {
    if (typeof window === 'undefined') return;
    try {
        const raw = window.localStorage.getItem(RESEARCH_MEMORY_HISTORY_KEY);
        const parsed: Record<string, unknown> = raw ? JSON.parse(raw) : {};
        const current = readResearchMemoryHistory(snapshot.ticker);
        const next = [...current.filter((entry) => entry.id !== snapshot.id), snapshot]
            .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
            .slice(-maxSnapshotsPerTicker);
        parsed[snapshot.ticker] = next;
        window.localStorage.setItem(RESEARCH_MEMORY_HISTORY_KEY, JSON.stringify(parsed));
    } catch {
        // Memory is an enhancement; saved research remains usable when browser storage is unavailable.
    }
};
