import type { InvestmentChecklist, ResearchCreateInput, ResearchRecord, ResearchUpdateInput } from '../types/research';

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
});
