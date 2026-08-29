import type { ResearchMemorySnapshot, ResearchMemoryState } from './research-memory.ts';
import { diffResearchMemorySnapshots, summarizeResearchMemoryDiff } from './research-memory-change.ts';
import { buildResearchMemoryDecisionMemory, getResearchMemoryThesisTransitions } from './research-memory-thesis.ts';
import { buildResearchMemoryReviewQueue, summarizeResearchMemoryReviewQueue } from './research-memory-queue.ts';
import { calculateResearchMemoryImpliedEpsGrowth, calculateResearchMemoryValuationRange, type ResearchMemoryValuationScenario } from './research-memory-valuation.ts';

export type ResearchMemoryWorkflowInput = {
    readonly state: ResearchMemoryState;
    readonly previousSnapshot: ResearchMemorySnapshot | null;
    readonly currentSnapshot: ResearchMemorySnapshot;
    readonly now: string;
    readonly scheduledReviewAt?: string | null;
    readonly events?: readonly { id: string; title: string; detail: string; occursAt: string; material?: boolean }[];
    readonly valuation?: {
        readonly marketPrice: number;
        readonly scenarios: readonly ResearchMemoryValuationScenario[];
        readonly impliedTerminalPe: number;
        readonly impliedYears: number;
        readonly impliedDiscountRatePct: number;
    };
};

export const buildResearchMemoryWorkflow = (input: ResearchMemoryWorkflowInput) => {
    const diff = input.previousSnapshot ? diffResearchMemorySnapshots(input.previousSnapshot, input.currentSnapshot) : null;
    const decisionMemory = buildResearchMemoryDecisionMemory(input.state, input.previousSnapshot, input.currentSnapshot);
    const queue = buildResearchMemoryReviewQueue({
        state: input.state,
        previousSnapshot: input.previousSnapshot,
        currentSnapshot: input.currentSnapshot,
        now: input.now,
        scheduledReviewAt: input.scheduledReviewAt,
        events: input.events,
    });
    const valuation = input.valuation ? (() => {
        const range = calculateResearchMemoryValuationRange(input.valuation.scenarios);
        const currentEps = input.currentSnapshot.forwardEps;
        const implied = currentEps === undefined ? null : calculateResearchMemoryImpliedEpsGrowth({
            marketPrice: input.valuation.marketPrice,
            currentEps,
            terminalPe: input.valuation.impliedTerminalPe,
            years: input.valuation.impliedYears,
            annualDiscountRatePct: input.valuation.impliedDiscountRatePct,
        });
        return { range, implied };
    })() : null;

    return {
        ticker: input.state.ticker,
        currentSnapshotId: input.currentSnapshot.id,
        changeSummary: diff ? summarizeResearchMemoryDiff(diff) : null,
        thesisTransitions: getResearchMemoryThesisTransitions(input.state),
        decisionMemory,
        reviewQueue: queue,
        reviewSummary: summarizeResearchMemoryReviewQueue(queue),
        valuation,
    };
};
