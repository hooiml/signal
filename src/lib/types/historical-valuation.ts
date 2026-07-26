import type { ResearchMarket } from './research';

export const historicalValuationCapabilityStatuses = ['available', 'partial', 'unavailable'] as const;
export type HistoricalValuationCapabilityStatus = typeof historicalValuationCapabilityStatuses[number];

export type HistoricalValuationCapability = {
    readonly status: HistoricalValuationCapabilityStatus;
    readonly detail: string;
};

export type HistoricalValuationMetric = {
    readonly value: number | null;
    readonly formula: string;
    readonly unavailableReason: string | null;
};

export type HistoricalValuationFact = {
    readonly label: string;
    readonly concept: string;
    readonly value: number;
    readonly unit: 'USD' | 'shares';
    readonly fiscalStart: string;
    readonly fiscalEnd: string;
    readonly filedAt: string;
    readonly accession: string;
};

export type HistoricalValuationObservation = {
    readonly id: string;
    readonly fiscalPeriodStart: string;
    readonly fiscalPeriodEnd: string;
    readonly filedAt: string;
    readonly priceDate: string | null;
    readonly price: number | null;
    readonly priceCurrency: string | null;
    readonly priceConvention: string;
    readonly reportedDilutedShares: number | null;
    readonly splitAdjustmentFactor: number | null;
    readonly splitAdjustedShares: number | null;
    readonly marketCapitalization: number | null;
    readonly annualRevenue: number | null;
    readonly annualNetIncome: number | null;
    readonly operatingCashFlow: number | null;
    readonly capitalExpenditure: number | null;
    readonly freeCashFlow: number | null;
    readonly priceEarnings: HistoricalValuationMetric;
    readonly priceSales: HistoricalValuationMetric;
    readonly freeCashFlowYield: HistoricalValuationMetric;
    readonly form: '10-K' | '10-K/A';
    readonly accession: string;
    readonly isAmendment: boolean;
    readonly restatementStatus: 'original' | 'amended-baseline-unavailable' | 'amended-unchanged' | 'amended-values-changed';
    readonly filingUrl: string;
    readonly facts: readonly HistoricalValuationFact[];
    readonly gaps: readonly string[];
};

export type HistoricalValuationReport = {
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly companyName: string | null;
    readonly generatedAt: string;
    readonly observationKind: 'filing observation';
    readonly priceConvention: string;
    readonly capabilities: {
        readonly historicalPrices: HistoricalValuationCapability;
        readonly periodCorrectFundamentals: HistoricalValuationCapability;
        readonly analystEstimateRevisions: HistoricalValuationCapability;
    };
    readonly observations: readonly HistoricalValuationObservation[];
    readonly sources: readonly {
        readonly name: string;
        readonly url: string;
        readonly detail: string;
    }[];
    readonly warnings: readonly string[];
};
