import type { ResearchAction, ResearchRecord } from '../types/research';

export const getResearchAction = (item: Pick<ResearchRecord, 'checklist' | 'thesisStrength' | 'valuationState' | 'positionState' | 'inBuyZone'>): ResearchAction => {
    const count = Object.values(item.checklist).filter(Boolean).length;
    const qualityPassed = item.checklist.understandBusiness
        && item.checklist.revenueGrowingOrStable
        && item.checklist.marginsHealthyOrImproving
        && item.checklist.debtManageable
        && item.checklist.freeCashFlowPositiveOrImproving
        && item.checklist.downsideAcceptable;

    if (count === 0) return 'Watch';
    if (item.thesisStrength === 'low'
        || !item.checklist.downsideAcceptable
        || (item.valuationState === 'expensive' && item.thesisStrength !== 'high')) return 'Avoid';
    if (item.positionState === 'owned' && item.thesisStrength === 'high' && qualityPassed
        && item.valuationState !== 'expensive' && item.inBuyZone
        && item.checklist.valuationReasonable) return 'DCA';
    if (count >= 8 && item.inBuyZone && item.checklist.valuationReasonable
        && item.checklist.downsideAcceptable) return 'Ready';
    if ((item.thesisStrength === 'high' || item.thesisStrength === 'medium')
        && count >= 6 && (item.valuationState === 'expensive' || !item.inBuyZone)) return 'Wait for price';
    return 'Watch';
};
