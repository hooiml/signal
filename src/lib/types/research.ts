export const researchMarkets = ['US', 'MY'] as const;
export const researchStatuses = ['owned', 'watch', 'waiting', 'avoid'] as const;
export const valuationStates = ['cheap', 'fair', 'expensive', 'unknown'] as const;
export const thesisStrengths = ['high', 'medium', 'low'] as const;
export const positionStates = ['owned', 'not-owned'] as const;
export const researchFindingTargets = [
    'whyInterested', 'bullCase', 'bearCase', 'thesisBreak', 'buyTrigger', 'sellTrigger', 'notes',
] as const;
export const researchFindingTones = ['positive', 'risk', 'neutral'] as const;
export const researchSynthesisModes = ['ai', 'evidence'] as const;
export const researchUpdateModes = ['review', 'settings'] as const;

export type ResearchMonitoringRules = {
    readonly buyZone: boolean;
    readonly belowMa200: boolean;
    readonly rsiBelow: number | null;
    readonly rsiAbove: number | null;
    readonly earningsWithinDays: number | null;
    readonly reviewAgeDays: number | null;
};

export const defaultResearchMonitoringRules: ResearchMonitoringRules = {
    buyZone: true,
    belowMa200: true,
    rsiBelow: 30,
    rsiAbove: null,
    earningsWithinDays: 21,
    reviewAgeDays: 30,
};

export type ResearchMarket = typeof researchMarkets[number];
export type ResearchStatus = typeof researchStatuses[number];
export type ValuationState = typeof valuationStates[number];
export type ThesisStrength = typeof thesisStrengths[number];
export type PositionState = typeof positionStates[number];
export type ResearchFindingTarget = typeof researchFindingTargets[number];
export type ResearchFindingTone = typeof researchFindingTones[number];
export type ResearchSynthesisMode = typeof researchSynthesisModes[number];
export type ResearchUpdateMode = typeof researchUpdateModes[number];

export type ResearchEvidence = {
    readonly id: string;
    readonly label: string;
    readonly value: string;
    readonly source: string;
    readonly sourceUrl: string;
    readonly reportingPeriod: string | null;
};

export type AcceptedResearchEvidence = {
    readonly id: string;
    readonly title: string;
    readonly summary: string;
    readonly target: ResearchFindingTarget;
    readonly tone: ResearchFindingTone;
    readonly mode: ResearchSynthesisMode;
    readonly acceptedAt: string;
    readonly sources: readonly ResearchEvidence[];
};

export type InvestmentChecklist = {
    readonly understandBusiness: boolean;
    readonly revenueGrowingOrStable: boolean;
    readonly marginsHealthyOrImproving: boolean;
    readonly debtManageable: boolean;
    readonly freeCashFlowPositiveOrImproving: boolean;
    readonly valuationReasonable: boolean;
    readonly catalystOrCompoundingReason: boolean;
    readonly downsideAcceptable: boolean;
    readonly betterThanCashOrIndex: boolean;
};

export type ResearchReviewSnapshot = {
    readonly id: string;
    readonly reviewedAt: string;
    readonly positionState: PositionState;
    readonly inBuyZone: boolean;
    readonly status: ResearchStatus;
    readonly targetBuyZone: string;
    readonly valuationState: ValuationState;
    readonly thesisStrength: ThesisStrength;
    readonly whyInterested: string;
    readonly bullCase: string;
    readonly bearCase: string;
    readonly buyTrigger: string;
    readonly sellTrigger: string;
    readonly thesisBreak: string;
    readonly notes: string;
    readonly checklist: InvestmentChecklist;
    readonly acceptedEvidence: readonly AcceptedResearchEvidence[];
};

export type ResearchRecord = {
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly companyName: string;
    readonly positionState: PositionState;
    readonly inBuyZone: boolean;
    readonly status: ResearchStatus;
    readonly targetBuyZone: string;
    readonly valuationState: ValuationState;
    readonly thesisStrength: ThesisStrength;
    readonly whyInterested: string;
    readonly bullCase: string;
    readonly bearCase: string;
    readonly buyTrigger: string;
    readonly sellTrigger: string;
    readonly thesisBreak: string;
    readonly notes: string;
    readonly checklist: InvestmentChecklist;
    readonly monitoringRules: ResearchMonitoringRules;
    readonly acceptedEvidence: readonly AcceptedResearchEvidence[];
    readonly reviewHistory: readonly ResearchReviewSnapshot[];
    readonly lastReviewedAt: string;
};

export type ResearchCreateInput = Pick<ResearchRecord, 'symbol' | 'market' | 'companyName'>;
export type ResearchUpdateInput = Partial<Omit<ResearchRecord, 'symbol' | 'market' | 'companyName' | 'lastReviewedAt' | 'checklist' | 'reviewHistory'>> & {
    readonly companyName?: string;
    readonly checklist?: Partial<InvestmentChecklist>;
};

export type ResearchAction = 'Ready' | 'DCA' | 'Wait for price' | 'Watch' | 'Avoid';
