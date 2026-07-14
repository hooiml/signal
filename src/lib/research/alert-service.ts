import type { AlertTickerInput, ResearchAlertEvaluation, ResearchAlertsResponse } from '../types/research-alert';
import { evaluateResearchAlerts } from './alerts';
import { fetchYahooResearch } from './yahoo-research';

const evaluateTicker = async (input: AlertTickerInput): Promise<ResearchAlertEvaluation> => {
    try {
        const data = await fetchYahooResearch(input.symbol, input.market);
        if (data.price === null) return { input, state: null, alerts: [], failed: true };
        const state = {
            price: data.price,
            dailyChangePercent: data.dailyChangePercent,
            ma50: data.technicals.ma50,
            ma200: data.technicals.ma200,
            rsi14: data.technicals.rsi14,
        };
        return {
            input,
            state,
            alerts: evaluateResearchAlerts(input.symbol, input.targetBuyZone, state),
            failed: false,
        };
    } catch (error) {
        if (error instanceof Error) return { input, state: null, alerts: [], failed: true };
        throw error;
    }
};

export const evaluateResearchTickers = async (inputs: readonly AlertTickerInput[]): Promise<readonly ResearchAlertEvaluation[]> => {
    const results: ResearchAlertEvaluation[] = [];
    for (let index = 0; index < inputs.length; index += 6) {
        results.push(...await Promise.all(inputs.slice(index, index + 6).map(evaluateTicker)));
    }
    return results;
};

export const getResearchAlerts = async (inputs: readonly AlertTickerInput[]): Promise<ResearchAlertsResponse> => {
    const results = await evaluateResearchTickers(inputs);
    const failedCount = results.filter((result) => result.failed).length;
    const priority = { risk: 0, opportunity: 1, watch: 2 } as const;
    return {
        generatedAt: new Date().toISOString(),
        monitoredCount: inputs.length - failedCount,
        alerts: results.flatMap((result) => result.alerts).sort((left, right) => priority[left.severity] - priority[right.severity]),
        warnings: failedCount > 0 ? [`${failedCount} tickers were unavailable and excluded.`] : [],
    };
};
