import type { ResearchRecord } from '../types/research';
import type { ResearchInboxItem, ResearchInboxResponse } from '../types/research-inbox';
import { listResearchState } from './store';
import { listStoredResearchExpectationEvents } from './research-expectation-store';
import { findStoredResearchValuationPlan } from './research-valuation-plan-store';
import { listStoredDecisionCalibrations } from './research-decision-calibration-store';

const DAY_MS = 86_400_000;
const daysUntil = (value: string, now: Date) => Math.ceil((new Date(`${value}T00:00:00Z`).getTime() - now.getTime()) / DAY_MS);

const stateItemsForRecord = async (record: ResearchRecord, now: Date): Promise<ResearchInboxItem[]> => {
    const symbol = record.symbol;
    const [events, valuationPlan, calibrations] = await Promise.all([
        listStoredResearchExpectationEvents(symbol).catch(() => []),
        findStoredResearchValuationPlan(symbol).catch(() => null),
        listStoredDecisionCalibrations(symbol).catch(() => []),
    ]);
    const items: ResearchInboxItem[] = [];

    const latestEvent = events[0] ?? null;
    if (latestEvent) {
        const pendingActuals = latestEvent.metrics.some((metric) => metric.actual === null);
        const pendingExpectations = latestEvent.metrics.some((metric) => metric.expected === null);
        const until = daysUntil(latestEvent.eventDate, now);
        if (until <= 0 && pendingActuals) {
            items.push({
                id: `${symbol}-attention-expectation-${latestEvent.id}-actuals`, symbol, kind: 'expectation', urgency: 'action',
                title: 'Complete expectation vs reality',
                detail: 'The event date has passed but actual metrics are incomplete. Record actuals before explaining the result with hindsight.',
                proximity: until === 0 ? 'Event is today' : `${Math.abs(until)} day${Math.abs(until) === 1 ? '' : 's'} after event`,
                source: 'Expectation journal', eventDate: latestEvent.eventDate, structuredTriggerRuleId: null,
            });
        } else if (until > 0 && until <= 14 && pendingExpectations) {
            items.push({
                id: `${symbol}-attention-expectation-${latestEvent.id}-pre`, symbol, kind: 'expectation', urgency: 'upcoming',
                title: 'Capture pre-event expectations',
                detail: 'An upcoming event has incomplete expected metrics. Capture what matters before the outcome is known.',
                proximity: `${until} day${until === 1 ? '' : 's'} before event`, source: 'Expectation journal', eventDate: latestEvent.eventDate, structuredTriggerRuleId: null,
            });
        }
    }

    if (valuationPlan && valuationPlan.currentEps === null) {
        items.push({
            id: `${symbol}-attention-valuation-input`, symbol, kind: 'valuation', urgency: 'action',
            title: 'Complete valuation evidence input',
            detail: 'A valuation plan exists but current EPS is missing. Add an evidence-backed EPS anchor before interpreting scenario values.',
            proximity: 'EPS input missing', source: 'Valuation plan', eventDate: null, structuredTriggerRuleId: null,
        });
    }

    const latestReview = record.reviewHistory.at(-1) ?? null;
    if (latestReview && !calibrations.some((entry) => entry.reviewId === latestReview.id)) {
        const ageDays = Math.max(0, Math.floor((now.getTime() - new Date(latestReview.reviewedAt).getTime()) / DAY_MS));
        if (ageDays >= 14) {
            items.push({
                id: `${symbol}-attention-calibration-${latestReview.id}`, symbol, kind: 'decision', urgency: 'action',
                title: 'Review the prior decision process',
                detail: 'A saved decision has not been calibrated yet. Review thesis, evidence, valuation and triggers without grading it only by the later return.',
                proximity: `${ageDays} days since saved review`, source: 'Decision review', eventDate: null, structuredTriggerRuleId: null,
            });
        }
    }
    return items;
};

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

export const enrichResearchInboxWithAttention = async (
    base: ResearchInboxResponse,
    symbols: readonly string[],
    now = new Date(base.generatedAt),
): Promise<ResearchInboxResponse> => {
    const state = await listResearchState();
    const wanted = new Set(symbols);
    const enriched = await Promise.all(state.records.filter((record) => wanted.has(record.symbol)).map((record) => stateItemsForRecord(record, now)));
    const deduped = new Map<string, ResearchInboxItem>();
    [...base.items, ...enriched.flat()].forEach((item) => deduped.set(item.id, item));
    return { ...base, items: rankResearchAttentionItems([...deduped.values()]) };
};
