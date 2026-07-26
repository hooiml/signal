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
export const researchUpdateModes = ['review', 'settings', 'evidence', 'factors'] as const;
export const researchDocumentSourceKinds = [
    '10-K',
    '10-Q',
    '8-K',
    'annual-report',
    'interim-quarterly-report',
    'exchange-announcement',
    'earnings-release',
    'other-primary',
] as const;
export const researchDocumentCaptureMethods = ['sec-official', 'manual-unverified'] as const;
export const researchDocumentMigrationStates = ['current', 'migrated-empty', 'invalid-recovered'] as const;
export const researchDecisionConfidences = ['low', 'medium', 'high'] as const;
export const researchDecisionOutcomes = ['unresolved', 'correct', 'mixed', 'incorrect'] as const;
export const researchStructuredTriggerPurposes = [
    'thesis-invalidation',
    'opportunity-review',
    'scheduled-evidence-review',
] as const;
export const researchStructuredTriggerMetrics = [
    'price',
    'rsi14',
    'price-vs-ma50-percent',
    'price-vs-ma200-percent',
    'earnings-within-days',
    'research-age-days',
    'evidence-age-days',
    'price-earnings',
    'free-cash-flow-yield-percent',
    'revenue-growth-percent',
] as const;
export const researchStructuredTriggerOperators = ['above', 'below', 'within'] as const;
export const researchStructuredTriggerMigrationStates = ['current', 'migrated-empty', 'invalid-recovered'] as const;
export const researchFactorIds = [
    'interest-rates',
    'usd-myr-fx',
    'oil-energy-prices',
    'semiconductor-cycle',
    'ai-data-center-capex',
    'china-growth',
    'consumer-demand',
    'credit-conditions',
    'broad-volatility',
    'commodity-input-costs',
] as const;
export const researchFactorDirections = ['benefits-when-rises', 'harmed-when-rises', 'mixed'] as const;
export const researchFactorMaterialities = ['low', 'moderate', 'high'] as const;
export const researchFactorMigrationStates = ['current', 'migrated-empty', 'invalid-recovered'] as const;

export type ResearchStructuredTriggerPurpose = typeof researchStructuredTriggerPurposes[number];
export type ResearchStructuredTriggerMetric = typeof researchStructuredTriggerMetrics[number];
export type ResearchStructuredTriggerOperator = typeof researchStructuredTriggerOperators[number];
export type ResearchStructuredTriggerMigrationState = typeof researchStructuredTriggerMigrationStates[number];
export type ResearchFactorId = typeof researchFactorIds[number];
export type ResearchFactorDirection = typeof researchFactorDirections[number];
export type ResearchFactorMateriality = typeof researchFactorMaterialities[number];
export type ResearchFactorMigrationState = typeof researchFactorMigrationStates[number];

export type ResearchFactorAssumption = {
    readonly factor: ResearchFactorId;
    readonly direction: ResearchFactorDirection;
    readonly materiality: ResearchFactorMateriality;
    readonly evidenceNote: string;
    readonly evidenceDate: string;
    readonly evidenceId: string | null;
};

export type ResearchFactorAssumptionSet = {
    readonly version: 1;
    readonly migrationState: ResearchFactorMigrationState;
    readonly assumptions: readonly ResearchFactorAssumption[];
};

export type ResearchStructuredTriggerRule = {
    readonly id: string;
    readonly enabled: boolean;
    readonly purpose: ResearchStructuredTriggerPurpose;
    readonly metric: ResearchStructuredTriggerMetric;
    readonly operator: ResearchStructuredTriggerOperator;
    readonly threshold: number;
};

export type ResearchStructuredTriggerSet = {
    readonly version: 1;
    readonly migrationState: ResearchStructuredTriggerMigrationState;
    readonly rules: readonly ResearchStructuredTriggerRule[];
};

export type ResearchMonitoringRules = {
    readonly buyZone: boolean;
    readonly belowMa200: boolean;
    readonly rsiBelow: number | null;
    readonly rsiAbove: number | null;
    readonly earningsWithinDays: number | null;
    readonly reviewAgeDays: number | null;
    readonly structuredTriggers: ResearchStructuredTriggerSet;
};

export const defaultResearchMonitoringRules: ResearchMonitoringRules = {
    buyZone: true,
    belowMa200: true,
    rsiBelow: 30,
    rsiAbove: null,
    earningsWithinDays: 21,
    reviewAgeDays: 30,
    structuredTriggers: {
        version: 1,
        migrationState: 'current',
        rules: [],
    },
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
export type ResearchDocumentSourceKind = typeof researchDocumentSourceKinds[number];
export type ResearchDocumentCaptureMethod = typeof researchDocumentCaptureMethods[number];
export type ResearchDocumentMigrationState = typeof researchDocumentMigrationStates[number];
export type ResearchDecisionConfidence = typeof researchDecisionConfidences[number];
export type ResearchDecisionOutcome = typeof researchDecisionOutcomes[number];
export type ResearchAction = 'Ready' | 'DCA' | 'Wait for price' | 'Watch' | 'Avoid';

export type ResearchDecisionJournal = {
    readonly decision: ResearchAction;
    readonly confidence: ResearchDecisionConfidence;
    readonly observedPrice: number | null;
    readonly benchmarkLabel: string | null;
    readonly benchmarkReturnPercent: number | null;
    readonly nextReviewAt: string | null;
    readonly priorReviewId: string | null;
    readonly priorOutcome: ResearchDecisionOutcome;
    readonly outcomeNote: string;
};

export type ResearchPositionPlan = {
    readonly plannedAllocationPercent: number | null;
    readonly averageCost: number | null;
    readonly plannedEntryPrice: number | null;
    readonly invalidationPrice: number | null;
};

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

export type ResearchDocumentCitation = {
    readonly id: string;
    readonly market: ResearchMarket;
    readonly symbol: string;
    readonly sourceKind: ResearchDocumentSourceKind;
    readonly publicationDate: string;
    readonly reportingPeriod: string | null;
    readonly title: string;
    readonly sourceUrl: string;
    readonly providerLabel: string;
    readonly location: string;
    readonly excerpt: string;
    readonly capturedAt: string;
    readonly contentDigest: string;
    readonly captureMethod: ResearchDocumentCaptureMethod;
};

export type ResearchDocumentEvidenceSet = {
    readonly version: 1;
    readonly migrationState: ResearchDocumentMigrationState;
    readonly citations: readonly ResearchDocumentCitation[];
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
    readonly monitoringRules: ResearchMonitoringRules;
    readonly acceptedEvidence: readonly AcceptedResearchEvidence[];
    readonly documentEvidence: ResearchDocumentEvidenceSet;
    readonly factorAssumptions: ResearchFactorAssumptionSet;
    readonly decisionJournal: ResearchDecisionJournal;
    readonly positionPlan: ResearchPositionPlan;
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
    readonly documentEvidence: ResearchDocumentEvidenceSet;
    readonly factorAssumptions: ResearchFactorAssumptionSet;
    readonly decisionJournal: ResearchDecisionJournal;
    readonly positionPlan: ResearchPositionPlan;
    readonly reviewHistory: readonly ResearchReviewSnapshot[];
    readonly lastReviewedAt: string;
    readonly updatedAt: string;
    readonly revision: number;
};

export type ResearchCreateInput = Pick<ResearchRecord, 'symbol' | 'market' | 'companyName'>;
export type ResearchUpdateInput = Partial<Omit<ResearchRecord, 'symbol' | 'market' | 'companyName' | 'lastReviewedAt' | 'updatedAt' | 'revision' | 'checklist' | 'reviewHistory'>> & {
    readonly companyName?: string;
    readonly checklist?: Partial<InvestmentChecklist>;
};
