import type { ResearchInboxItem } from '../types/research-inbox.ts';

export const researchAttentionRank = (item: ResearchInboxItem) => {
    if (item.urgency === 'action' && item.kind === 'risk') return 0;
    if (item.urgency === 'action' && item.kind === 'expectation') return 1;
    if (item.urgency === 'action' && item.kind === 'decision') return 2;
    if (item.urgency === 'action' && item.kind === 'valuation') return 3;
    if (item.urgency === 'action' && item.kind === 'opportunity') return 4;
    if (item.urgency === 'action' && item.kind === 'stale') return 5;
    if (item.kind === 'catalyst') return 6;
    return 7;
};

export const rankResearchAttentionItems = (items: readonly ResearchInboxItem[]) =>
    [...items].sort((a, b) => researchAttentionRank(a) - researchAttentionRank(b) || a.symbol.localeCompare(b.symbol) || a.title.localeCompare(b.title));
