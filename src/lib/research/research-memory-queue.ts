import type { ResearchMemoryEvidenceItem, ResearchMemorySnapshot, ResearchMemoryState } from './research-memory.ts';
import { diffResearchMemorySnapshots, summarizeResearchMemoryDiff, type ResearchMemorySnapshotDiff } from './research-memory-change.ts';
import { buildResearchMemoryDecisionMemory } from './research-memory-thesis.ts';

export type ResearchMemoryReviewPriority = 'critical' | 'review' | 'context';
export type ResearchMemoryReviewReason = 'trigger' | 'change' | 'stale_evidence' | 'scheduled_review' | 'event';

export type ResearchMemoryReviewQueueItem = {
    readonly id: string;
    readonly ticker: string;
    readonly priority: ResearchMemoryReviewPriority;
    readonly reason: ResearchMemoryReviewReason;
    readonly title: string;
    readonly detail: string;
    readonly dueAt?: string;
    readonly sourceId?: string;
};

export type ResearchMemoryReviewQueueInput = {
    readonly state: ResearchMemoryState;
    readonly previousSnapshot: ResearchMemorySnapshot | null;
    readonly currentSnapshot: ResearchMemorySnapshot;
    readonly scheduledReviewAt?: string | null;
    readonly events?: readonly { id: string; title: string; detail: string; occursAt: string; material?: boolean }[];
    readonly now: string;
};

const priorityRank: Record<ResearchMemoryReviewPriority, number> = { critical: 0, review: 1, context: 2 };
const staleEvidence = (evidence: readonly ResearchMemoryEvidenceItem[]) => evidence.filter((item) => item.freshness === 'stale');
const parse = (value: string) => {
    const time = Date.parse(value);
    if (Number.isNaN(time)) throw new Error('Invalid review-queue date');
    return time;
};

export const buildResearchMemoryReviewQueue = (input: ResearchMemoryReviewQueueInput): readonly ResearchMemoryReviewQueueItem[] => {
    const { state, previousSnapshot, currentSnapshot } = input;
    if (state.ticker !== currentSnapshot.ticker) throw new Error('Review queue ticker does not match research-memory state');
    const now = parse(input.now);
    const items: ResearchMemoryReviewQueueItem[] = [];
    const memory = buildResearchMemoryDecisionMemory(state, previousSnapshot, currentSnapshot);

    for (const evaluation of memory.matchedTriggers) {
        items.push({
            id: `trigger:${evaluation.trigger.id}`,
            ticker: state.ticker,
            priority: 'critical',
            reason: 'trigger',
            title: evaluation.trigger.description,
            detail: evaluation.reason,
            sourceId: evaluation.trigger.id,
        });
    }

    let diff: ResearchMemorySnapshotDiff | null = null;
    if (previousSnapshot) diff = diffResearchMemorySnapshots(previousSnapshot, currentSnapshot);
    if (diff) {
        const summary = summarizeResearchMemoryDiff(diff);
        if (summary.changed) {
            items.push({
                id: `change:${diff.previousSnapshotId}:${diff.currentSnapshotId}`,
                ticker: state.ticker,
                priority: 'review',
                reason: 'change',
                title: 'Tracked research changed since the prior review',
                detail: summary.headline,
            });
        }
    }

    for (const evidence of staleEvidence(currentSnapshot.evidence)) {
        items.push({
            id: `stale:${evidence.id}`,
            ticker: state.ticker,
            priority: 'review',
            reason: 'stale_evidence',
            title: `${evidence.label} needs refreshed evidence`,
            detail: evidence.detail,
            sourceId: evidence.id,
        });
    }

    if (input.scheduledReviewAt && parse(input.scheduledReviewAt) <= now) {
        items.push({
            id: `scheduled:${state.ticker}:${input.scheduledReviewAt}`,
            ticker: state.ticker,
            priority: 'review',
            reason: 'scheduled_review',
            title: 'Scheduled research review is due',
            detail: `Review was scheduled for ${new Date(input.scheduledReviewAt).toISOString()}.`,
            dueAt: new Date(input.scheduledReviewAt).toISOString(),
        });
    }

    for (const event of input.events ?? []) {
        const eventTime = parse(event.occursAt);
        if (eventTime < now) continue;
        items.push({
            id: `event:${event.id}`,
            ticker: state.ticker,
            priority: event.material ? 'review' : 'context',
            reason: 'event',
            title: event.title,
            detail: event.detail,
            dueAt: new Date(event.occursAt).toISOString(),
            sourceId: event.id,
        });
    }

    const deduped = new Map(items.map((item) => [item.id, item]));
    return [...deduped.values()].sort((a, b) => {
        const priority = priorityRank[a.priority] - priorityRank[b.priority];
        if (priority !== 0) return priority;
        return (a.dueAt ?? '').localeCompare(b.dueAt ?? '') || a.id.localeCompare(b.id);
    });
};

export const summarizeResearchMemoryReviewQueue = (items: readonly ResearchMemoryReviewQueueItem[]) => ({
    critical: items.filter((item) => item.priority === 'critical').length,
    review: items.filter((item) => item.priority === 'review').length,
    context: items.filter((item) => item.priority === 'context').length,
    actionable: items.some((item) => item.priority !== 'context'),
});
