import type { AlertTickerInput, ResearchAlertsResponse } from '../types/research-alert';
import { evaluateResearchAlerts } from './alerts';
import { fetchYahooResearch } from './yahoo-research';

const evaluateTicker = async (input: AlertTickerInput) => {
    try {
        const data = await fetchYahooResearch(input.symbol, input.market);
        if (data.price === null) return { alerts: [], failed: true };
        return {
            alerts: evaluateResearchAlerts(input.symbol, input.targetBuyZone, {
                price: data.price,
                dailyChangePercent: data.dailyChangePercent,
                ma50: data.technicals.ma50,
                ma200: data.technicals.ma200,
                rsi14: data.technicals.rsi14,
            }),
            failed: false,
        };
    } catch (error) {
        if (error instanceof Error) return { alerts: [], failed: true };
        throw error;
    }
};

export const getResearchAlerts = async (inputs: readonly AlertTickerInput[]): Promise<ResearchAlertsResponse> => {
    const results: Awaited<ReturnType<typeof evaluateTicker>>[] = [];
    for (let index = 0; index < inputs.length; index += 6) {
        results.push(...await Promise.all(inputs.slice(index, index + 6).map(evaluateTicker)));
    }
    const failedCount = results.filter((result) => result.failed).length;
    const priority = { risk: 0, opportunity: 1, watch: 2 } as const;
    return {
        generatedAt: new Date().toISOString(),
        monitoredCount: inputs.length - failedCount,
        alerts: results.flatMap((result) => result.alerts).sort((left, right) => priority[left.severity] - priority[right.severity]),
        warnings: failedCount > 0 ? [`${failedCount} tickers were unavailable and excluded.`] : [],
    };
};
