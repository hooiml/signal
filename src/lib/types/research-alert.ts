import type { ResearchMarket } from './research';

export type AlertSeverity = 'opportunity' | 'watch' | 'risk';

export type AlertTickerInput = {
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly targetBuyZone: string;
};

export type AlertMarketState = {
    readonly price: number;
    readonly dailyChangePercent: number | null;
    readonly ma50: number | null;
    readonly ma200: number | null;
    readonly rsi14: number | null;
};

export type ResearchAlert = {
    readonly symbol: string;
    readonly severity: AlertSeverity;
    readonly title: string;
    readonly detail: string;
};

export type ResearchAlertsResponse = {
    readonly generatedAt: string;
    readonly monitoredCount: number;
    readonly alerts: readonly ResearchAlert[];
    readonly warnings: readonly string[];
};

export type ResearchAlertEvaluation = {
    readonly input: AlertTickerInput;
    readonly state: AlertMarketState | null;
    readonly alerts: readonly ResearchAlert[];
    readonly failed: boolean;
};
