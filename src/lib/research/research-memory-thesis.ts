import type {
    ResearchMemoryDecisionRecord,
    ResearchMemorySnapshot,
    ResearchMemoryState,
    ResearchMemoryThesisVersion,
} from './research-memory.ts';
import { evaluateResearchMemoryTrigger, type ResearchMemoryTriggerEvaluation } from './research-memory-change.ts';

export type ResearchMemoryThesisTransition = {
    readonly ticker: string;
    readonly previousVersion: number | null;
    readonly currentVersion: number;
    readonly thesisChanged: boolean;
    readonly decisionChanged: boolean;
    readonly invalidationAdded: readonly string[];
    readonly invalidationRemoved: readonly string[];
    readonly evidenceAdded: readonly string[];
    readonly evidenceRemoved: readonly string[];
};

export type ResearchMemoryDecisionMemory = {
    readonly ticker: string;
    readonly latestDecision: ResearchMemoryDecisionRecord | null;
    readonly previousDecision: ResearchMemoryDecisionRecord | null;
    readonly changed: boolean;
    readonly triggerEvaluations: readonly ResearchMemoryTriggerEvaluation[];
    readonly matchedTriggers: readonly ResearchMemoryTriggerEvaluation[];
};

const added = (before: readonly string[], after: readonly string[]) => after.filter((item) => !before.includes(item));
const removed = (before: readonly string[], after: readonly string[]) => before.filter((item) => !after.includes(item));

export const compareResearchMemoryTheses = (
    previous: ResearchMemoryThesisVersion | null,
    current: ResearchMemoryThesisVersion,
): ResearchMemoryThesisTransition => {
    if (previous && previous.ticker !== current.ticker) throw new Error('Cannot compare thesis versions for different tickers');
    return {
        ticker: current.ticker,
        previousVersion: previous?.version ?? null,
        currentVersion: current.version,
        thesisChanged: previous ? previous.thesis.trim() !== current.thesis.trim() : true,
        decisionChanged: previous ? previous.decision !== current.decision : true,
        invalidationAdded: added(previous?.invalidation ?? [], current.invalidation),
        invalidationRemoved: removed(previous?.invalidation ?? [], current.invalidation),
        evidenceAdded: added(previous?.evidenceIds ?? [], current.evidenceIds),
        evidenceRemoved: removed(previous?.evidenceIds ?? [], current.evidenceIds),
    };
};

export const getResearchMemoryThesisHistory = (state: ResearchMemoryState) =>
    [...state.thesisVersions].sort((a, b) => a.version - b.version);

export const getResearchMemoryDecisionHistory = (state: ResearchMemoryState) =>
    [...state.decisions].sort((a, b) => a.decidedAt.localeCompare(b.decidedAt));

export const buildResearchMemoryDecisionMemory = (
    state: ResearchMemoryState,
    previousSnapshot: ResearchMemorySnapshot | null,
    currentSnapshot: ResearchMemorySnapshot,
): ResearchMemoryDecisionMemory => {
    if (state.ticker !== currentSnapshot.ticker) throw new Error('Decision memory ticker does not match current snapshot');
    const history = getResearchMemoryDecisionHistory(state);
    const latestDecision = history.at(-1) ?? null;
    const previousDecision = history.at(-2) ?? null;
    const triggerEvaluations = latestDecision
        ? latestDecision.triggers.map((trigger) => evaluateResearchMemoryTrigger(trigger, previousSnapshot, currentSnapshot))
        : [];
    return {
        ticker: state.ticker,
        latestDecision,
        previousDecision,
        changed: Boolean(latestDecision && previousDecision && latestDecision.decision !== previousDecision.decision),
        triggerEvaluations,
        matchedTriggers: triggerEvaluations.filter((evaluation) => evaluation.matched),
    };
};

export const getResearchMemoryThesisTransitions = (state: ResearchMemoryState): readonly ResearchMemoryThesisTransition[] => {
    const history = getResearchMemoryThesisHistory(state);
    return history.map((current, index) => compareResearchMemoryTheses(history[index - 1] ?? null, current));
};

export const describeResearchMemoryDecisionMemory = (memory: ResearchMemoryDecisionMemory) => {
    if (!memory.latestDecision) return 'No saved decision yet.';
    if (memory.matchedTriggers.length > 0) {
        return `${memory.latestDecision.decision.toUpperCase()} · ${memory.matchedTriggers.length} saved review condition${memory.matchedTriggers.length === 1 ? '' : 's'} met.`;
    }
    return `${memory.latestDecision.decision.toUpperCase()} · no saved review conditions met.`;
};
