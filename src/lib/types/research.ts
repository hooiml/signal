export const researchMarkets = ['US', 'MY'] as const;
export const researchStatuses = ['owned', 'watch', 'waiting', 'avoid'] as const;
export const valuationStates = ['cheap', 'fair', 'expensive', 'unknown'] as const;
export const thesisStrengths = ['high', 'medium', 'low'] as const;
export const positionStates = ['owned', 'not-owned'] as const;

export type ResearchMarket = typeof researchMarkets[number];
export type ResearchStatus = typeof researchStatuses[number];
export type ValuationState = typeof valuationStates[number];
export type ThesisStrength = typeof thesisStrengths[number];
export type PositionState = typeof positionStates[number];

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
    readonly lastReviewedAt: string;
};

export type ResearchCreateInput = Pick<ResearchRecord, 'symbol' | 'market' | 'companyName'>;
export type ResearchUpdateInput = Partial<Omit<ResearchRecord, 'symbol' | 'market' | 'companyName' | 'lastReviewedAt' | 'checklist'>> & {
    readonly companyName?: string;
    readonly checklist?: Partial<InvestmentChecklist>;
};

export type ResearchAction = 'Ready' | 'DCA' | 'Wait for price' | 'Watch' | 'Avoid';
