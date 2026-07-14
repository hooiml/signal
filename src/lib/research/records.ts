import type {
    InvestmentChecklist,
    ResearchCreateInput,
    ResearchRecord,
    ResearchReviewSnapshot,
    ResearchUpdateInput,
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
    reviewHistory: [],
    lastReviewedAt: new Date().toISOString().slice(0, 10),
});

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
    };
    return {
        ...record,
        lastReviewedAt: reviewedAt.slice(0, 10),
        reviewHistory: [snapshot, ...record.reviewHistory].slice(0, reviewHistoryLimit),
    };
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
