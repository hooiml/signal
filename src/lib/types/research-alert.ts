import type { AcceptedResearchEvidence, ResearchMarket, ResearchMonitoringRules } from './research';
import type { DiscoveryCatalyst } from './research-discovery';
import type { ResearchStructuredTriggerEvaluation } from '../research/structured-triggers';

export type AlertSeverity = 'opportunity' | 'watch' | 'risk';

export type AlertTickerInput = {
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly targetBuyZone: string;
    readonly lastReviewedAt: string;
    readonly acceptedEvidence: readonly AcceptedResearchEvidence[];
    readonly monitoringRules: ResearchMonitoringRules;
};

export type AlertMarketState = {
    readonly price: number;
    readonly dailyChangePercent: number | null;
    readonly ma50: number | null;
    readonly ma200: number | null;
    readonly rsi14: number | null;
};

export type ResearchAlert = {
    readonly id: string;
    readonly symbol: string;
    readonly kind: 'market-condition' | 'structured-trigger';
    readonly severity: AlertSeverity;
    readonly title: string;
    readonly detail: string;
    readonly structuredTrigger: ResearchStructuredTriggerEvaluation | null;
};

export type ResearchAlertsResponse = {
    readonly generatedAt: string;
    readonly monitoredCount: number;
    readonly alerts: readonly ResearchAlert[];
    readonly triggerCoverage: readonly ResearchStructuredTriggerEvaluation[];
    readonly warnings: readonly string[];
};

export type ResearchAlertEvaluation = {
    readonly input: AlertTickerInput;
    readonly state: AlertMarketState | null;
    readonly alerts: readonly ResearchAlert[];
    readonly structuredTriggers: readonly ResearchStructuredTriggerEvaluation[];
    readonly catalyst: DiscoveryCatalyst | null;
    readonly failed: boolean;
};
