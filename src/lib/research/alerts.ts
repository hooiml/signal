import type { AlertMarketState, AlertTickerInput, ResearchAlert } from '../types/research-alert';
import { researchListingKey } from './listing-identity';

export const parseBuyZone = (value: string): readonly [number, number] | null => {
    const numbers = value.match(/\d[\d,]*(?:\.\d+)?/g)?.map((entry) => Number(entry.replaceAll(',', '')));
    if (!numbers || numbers.length !== 2 || numbers.some((entry) => !Number.isFinite(entry) || entry <= 0)) return null;
    return numbers[0] <= numbers[1] ? [numbers[0], numbers[1]] : [numbers[1], numbers[0]];
};

export const evaluateResearchAlerts = (
    { market, symbol }: Pick<AlertTickerInput, 'market' | 'symbol'>,
    targetBuyZone: string,
    state: AlertMarketState,
): readonly ResearchAlert[] => {
    const alerts: ResearchAlert[] = [];
    const add = (severity: ResearchAlert['severity'], title: string, detail: string) => alerts.push({
        id: `${researchListingKey(market, symbol)}-market-${title}`,
        symbol,
        market,
        kind: 'market-condition',
        severity,
        title,
        detail,
        structuredTrigger: null,
    });
    const zone = parseBuyZone(targetBuyZone);
    if (zone && state.price >= zone[0] && state.price <= zone[1]) {
        add('opportunity', 'Inside buy zone', `Price ${state.price.toFixed(2)} is inside ${zone[0].toFixed(2)}-${zone[1].toFixed(2)}.`);
    } else if (zone && state.price > zone[1] && state.price <= zone[1] * 1.03) {
        add('watch', 'Approaching buy zone', `Price is within 3% above the configured upper bound ${zone[1].toFixed(2)}.`);
    }
    if (state.dailyChangePercent !== null && Math.abs(state.dailyChangePercent) >= 8) {
        add('risk', 'Large daily move', `Daily move is ${state.dailyChangePercent > 0 ? '+' : ''}${state.dailyChangePercent.toFixed(1)}%. Review the catalyst before acting.`);
    }
    if (state.ma200 !== null && state.price < state.ma200) {
        add('risk', 'Below 200-day average', `Price ${state.price.toFixed(2)} is below the long-term average ${state.ma200.toFixed(2)}.`);
    } else if (state.ma50 !== null && state.price < state.ma50) {
        add('watch', 'Below 50-day average', `Price ${state.price.toFixed(2)} is below the intermediate average ${state.ma50.toFixed(2)}.`);
    }
    if (state.rsi14 !== null && state.rsi14 <= 30) {
        add('opportunity', 'Oversold review', `RSI is ${state.rsi14.toFixed(1)}. Confirm fundamentals and the cause of weakness.`);
    } else if (state.rsi14 !== null && state.rsi14 >= 70) {
        add('watch', 'Momentum overextended', `RSI is ${state.rsi14.toFixed(1)}. Avoid treating momentum as an automatic entry.`);
    }
    return alerts;
};
