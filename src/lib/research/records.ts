import type {
    InvestmentChecklist,
    ResearchCreateInput,
    ResearchRecord,
    ResearchReviewSnapshot,
    ResearchUpdateInput,
    ResearchUpdateMode,
} from '../types/research';
import { defaultResearchMonitoringRules } from '../types/research';

const reviewHistoryLimit = 25;

export const emptyChecklist: InvestmentChecklist = {
    understandBusiness: false,
    revenueGrowingOrStable: false,
    marginsHealthyOrImproving: false,
    debtManageable: false,
    freeCashFlowPositiveOrImproving: false,
    valuationReasonable: false,
    catalystOrCompoundingReason: false,
    downsideAcceptable: false,
    betterThanCashOrIndex: false,
};

export const emptyDecisionJournal: ResearchRecord['decisionJournal'] = {
    decision: 'Watch',
    confidence: 'medium',
    observedPrice: null,
    benchmarkLabel: null,
    benchmarkReturnPercent: null,
    nextReviewAt: null,
    priorReviewId: null,
    priorOutcome: 'unresolved',
    outcomeNote: '',
};

export const emptyPositionPlan: ResearchRecord['positionPlan'] = {
    plannedAllocationPercent: null,
    averageCost: null,
    plannedEntryPrice: null,
    invalidationPrice: null,
};

export const createResearchRecord = (input: ResearchCreateInput): ResearchRecord => ({
    ...input,
    positionState: 'not-owned',
    inBuyZone: false,
    status: 'watch',
    targetBuyZone: '',
    valuationState: 'unknown',
    thesisStrength: 'medium',
    whyInterested: '',
    bullCase: '',
    bearCase: '',
    buyTrigger: '',
    sellTrigger: '',
    thesisBreak: '',
    notes: '',
    checklist: emptyChecklist,
    monitoringRules: defaultResearchMonitoringRules,
    acceptedEvidence: [],
    decisionJournal: emptyDecisionJournal,
    positionPlan: emptyPositionPlan,
    reviewHistory: [],
    lastReviewedAt: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString(),
    revision: 0,
});

type ResearchDecisionInput = Pick<ResearchRecord, 'checklist' | 'thesisStrength' | 'valuationState' | 'positionState' | 'inBuyZone'>;

export const calculateResearchDecision = (record: ResearchDecisionInput): ResearchRecord['decisionJournal']['decision'] => {
    const count = Object.values(record.checklist).filter(Boolean).length;
    const qualityPassed = record.checklist.understandBusiness
        && record.checklist.revenueGrowingOrStable
        && record.checklist.marginsHealthyOrImproving
        && record.checklist.debtManageable
        && record.checklist.freeCashFlowPositiveOrImproving
        && record.checklist.downsideAcceptable;
    if (count === 0) return 'Watch';
    if (record.thesisStrength === 'low' || !record.checklist.downsideAcceptable
        || (record.valuationState === 'expensive' && record.thesisStrength !== 'high')) return 'Avoid';
    if (record.positionState === 'owned' && record.thesisStrength === 'high' && qualityPassed
        && record.valuationState !== 'expensive' && record.inBuyZone && record.checklist.valuationReasonable) return 'DCA';
    if (count >= 8 && record.inBuyZone && record.checklist.valuationReasonable && record.checklist.downsideAcceptable) return 'Ready';
    if ((record.thesisStrength === 'high' || record.thesisStrength === 'medium')
        && count >= 6 && (record.valuationState === 'expensive' || !record.inBuyZone)) return 'Wait for price';
    return 'Watch';
};

export const applyResearchUpdate = (current: ResearchRecord, update: ResearchUpdateInput): ResearchRecord => ({
    ...current,
    companyName: update.companyName ?? current.companyName,
    positionState: update.positionState ?? current.positionState,
    inBuyZone: update.inBuyZone ?? current.inBuyZone,
    status: update.status ?? current.status,
    targetBuyZone: update.targetBuyZone ?? current.targetBuyZone,
    valuationState: update.valuationState ?? current.valuationState,
    thesisStrength: update.thesisStrength ?? current.thesisStrength,
    whyInterested: update.whyInterested ?? current.whyInterested,
    bullCase: update.bullCase ?? current.bullCase,
    bearCase: update.bearCase ?? current.bearCase,
    buyTrigger: update.buyTrigger ?? current.buyTrigger,
    sellTrigger: update.sellTrigger ?? current.sellTrigger,
    thesisBreak: update.thesisBreak ?? current.thesisBreak,
    notes: update.notes ?? current.notes,
    checklist: { ...current.checklist, ...update.checklist },
    monitoringRules: update.monitoringRules ?? current.monitoringRules,
    acceptedEvidence: update.acceptedEvidence ?? current.acceptedEvidence,
    decisionJournal: update.decisionJournal ?? current.decisionJournal,
    positionPlan: update.positionPlan ?? current.positionPlan,
});

export const appendResearchReview = (record: ResearchRecord, reviewedAt = new Date().toISOString()): ResearchRecord => {
    const snapshot: ResearchReviewSnapshot = {
        id: reviewedAt,
        reviewedAt,
        positionState: record.positionState,
        inBuyZone: record.inBuyZone,
        status: record.status,
        targetBuyZone: record.targetBuyZone,
        valuationState: record.valuationState,
        thesisStrength: record.thesisStrength,
        whyInterested: record.whyInterested,
        bullCase: record.bullCase,
        bearCase: record.bearCase,
        buyTrigger: record.buyTrigger,
        sellTrigger: record.sellTrigger,
        thesisBreak: record.thesisBreak,
        notes: record.notes,
        checklist: { ...record.checklist },
        acceptedEvidence: record.acceptedEvidence.map((item) => ({
            ...item,
            sources: item.sources.map((source) => ({ ...source })),
        })),
        decisionJournal: { ...record.decisionJournal },
        positionPlan: { ...record.positionPlan },
    };
    return {
        ...record,
        lastReviewedAt: reviewedAt.slice(0, 10),
        reviewHistory: [snapshot, ...record.reviewHistory].slice(0, reviewHistoryLimit),
    };
};

export const prepareStoredResearchRecord = (current: ResearchRecord, input: ResearchUpdateInput, mode: ResearchUpdateMode): ResearchRecord => {
    const modeInput: ResearchUpdateInput = mode === 'settings' ? { monitoringRules: input.monitoringRules } : input;
    let updated = applyResearchUpdate(current, modeInput);
    if (mode !== 'review') return updated;
    const priorReviewId = current.reviewHistory[0]?.id ?? null;
    updated = {
        ...updated,
        decisionJournal: {
            ...updated.decisionJournal,
            decision: calculateResearchDecision(updated),
            priorReviewId,
            priorOutcome: priorReviewId ? updated.decisionJournal.priorOutcome : 'unresolved',
            outcomeNote: priorReviewId ? updated.decisionJournal.outcomeNote : '',
        },
    };
    return appendResearchReview(updated);
};

const reviewFields = [
    ['positionState', 'Ownership'], ['inBuyZone', 'Buy-zone state'], ['status', 'Status'],
    ['targetBuyZone', 'Target buy zone'], ['valuationState', 'Valuation'], ['thesisStrength', 'Thesis strength'],
    ['whyInterested', 'Why interested'], ['bullCase', 'Bull case'], ['bearCase', 'Bear case'],
    ['buyTrigger', 'Buy trigger'], ['sellTrigger', 'Sell trigger'], ['thesisBreak', 'Thesis invalidation'],
    ['notes', 'Review notes'],
] as const satisfies readonly (readonly [keyof ResearchReviewSnapshot, string])[];

export const describeReviewChanges = (current: ResearchReviewSnapshot | undefined, previous: ResearchReviewSnapshot | undefined): readonly string[] => {
    if (!current) return [];
    if (!previous) return ['Initial saved review'];
    const changed: string[] = [];
    for (const [key, label] of reviewFields) {
        if (current[key] !== previous[key]) changed.push(label);
    }
    if (JSON.stringify(current.checklist) !== JSON.stringify(previous.checklist)) changed.push('Checklist');
    if (JSON.stringify(current.acceptedEvidence) !== JSON.stringify(previous.acceptedEvidence)) changed.push('Evidence');
    if (JSON.stringify(current.decisionJournal) !== JSON.stringify(previous.decisionJournal)) changed.push('Decision journal');
    if (JSON.stringify(current.positionPlan) !== JSON.stringify(previous.positionPlan)) changed.push('Position plan');
    return changed.length > 0 ? changed : ['No material changes'];
};

export const latestReviewChanges = (record: ResearchRecord): readonly string[] =>
    describeReviewChanges(record.reviewHistory[0], record.reviewHistory[1]);

export const appendQuickReviewNote = (current: string, note: string, reviewedOn: string): string => {
    const trimmed = note.trim();
    if (!trimmed) return current;
    const entry = `${reviewedOn} · ${trimmed}`;
    return current.trim() ? `${current.trim()}\n\n${entry}` : entry;
};
