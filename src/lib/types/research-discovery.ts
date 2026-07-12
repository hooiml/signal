export type DiscoveryRisk = 'low' | 'moderate' | 'high';
export type DiscoveryCategory = 'quality compounder' | 'cyclical acceleration' | 'turnaround' | 'momentum only' | 'fundamentally unsupported' | 'unconfirmed';
export type EarlyTrendStage = 'emerging' | 'confirmed' | 'extended' | 'not ready';
export type ValuationGuardrail = 'attractive' | 'fair' | 'expensive' | 'extreme' | 'unavailable';

export type DiscoveryCatalyst = {
    readonly date: string;
    readonly type: 'earnings';
    readonly timing: 'pre-market' | 'after-hours' | 'time-not-supplied';
    readonly fiscalQuarterEnding: string | null;
    readonly epsForecast: string | null;
    readonly source: 'Nasdaq earnings calendar';
};

export type DiscoveryCandidate = {
    readonly symbol: string;
    readonly name: string;
    readonly price: number;
    readonly momentum3MonthPercent: number;
    readonly momentum6MonthPercent: number;
    readonly distanceFromMa50Percent: number;
    readonly averageDollarVolume: number;
    readonly volumeSpikeRatio: number;
    readonly maxDailyMovePercent: number;
    readonly annualizedVolatilityPercent: number;
    readonly aboveMa50: boolean;
    readonly aboveMa200: boolean;
};

export type DiscoveryResult = DiscoveryCandidate & {
    readonly trendScore: number;
    readonly riskScore: number;
    readonly risk: DiscoveryRisk;
    readonly reasons: readonly string[];
    readonly flags: readonly string[];
};

export type QualityDiscoveryResult = DiscoveryResult & {
    readonly qualityScore: number | null;
    readonly discoveryScore: number;
    readonly category: DiscoveryCategory;
    readonly qualityReasons: readonly string[];
    readonly sector: string;
    readonly sectorRelativeStrengthPercent: number;
    readonly scoreChange1Day: number | null;
    readonly scoreChange1Week: number | null;
    readonly scoreChange1Month: number | null;
    readonly rankChange1Week: number | null;
    readonly firstSeenAt: string;
    readonly earlyTrendStage: EarlyTrendStage;
    readonly valuation: {
        readonly guardrail: ValuationGuardrail;
        readonly priceEarnings: number | null;
        readonly priceSales: number | null;
        readonly freeCashFlowYieldPercent: number | null;
    };
    readonly catalyst: DiscoveryCatalyst | null;
};

export type DiscoveryContender = QualityDiscoveryResult & {
    readonly contenderReason: string;
};

export type DiscoveryPerformance = {
    readonly period: '1D' | '1W' | '1M';
    readonly averageReturnPercent: number | null;
    readonly trackedCount: number;
    readonly winnerCount: number;
};

export type DiscoveryResponse = {
    readonly generatedAt: string;
    readonly universeSize: number;
    readonly scannedCount: number;
    readonly candidates: readonly QualityDiscoveryResult[];
    readonly contenders: readonly DiscoveryContender[];
    readonly emergingCandidates: readonly QualityDiscoveryResult[];
    readonly performance: readonly DiscoveryPerformance[];
    readonly historySnapshotCount: number;
    readonly warnings: readonly string[];
};
