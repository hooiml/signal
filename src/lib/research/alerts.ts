import type { AlertMarketState, ResearchAlert } from '../types/research-alert';

export const parseBuyZone = (value: string): readonly [number, number] | null => {
    const numbers = value.match(/\d[\d,]*(?:\.\d+)?/g)?.map((entry) => Number(entry.replaceAll(',', '')));
    if (!numbers || numbers.length !== 2 || numbers.some((entry) => !Number.isFinite(entry) || entry <= 0)) return null;
    return numbers[0] <= numbers[1] ? [numbers[0], numbers[1]] : [numbers[1], numbers[0]];
};

export const evaluateResearchAlerts = (
    symbol: string,
    targetBuyZone: string,
    market: AlertMarketState,
): readonly ResearchAlert[] => {
    const alerts: ResearchAlert[] = [];
    const add = (severity: ResearchAlert['severity'], title: string, detail: string) => alerts.push({ symbol, severity, title, detail });
    const zone = parseBuyZone(targetBuyZone);
    if (zone && market.price >= zone[0] && market.price <= zone[1]) {
        add('opportunity', 'Inside buy zone', `Price ${market.price.toFixed(2)} is inside ${zone[0].toFixed(2)}-${zone[1].toFixed(2)}.`);
    } else if (zone && market.price > zone[1] && market.price <= zone[1] * 1.03) {
        add('watch', 'Approaching buy zone', `Price is within 3% above the configured upper bound ${zone[1].toFixed(2)}.`);
    }
    if (market.dailyChangePercent !== null && Math.abs(market.dailyChangePercent) >= 8) {
        add('risk', 'Large daily move', `Daily move is ${market.dailyChangePercent > 0 ? '+' : ''}${market.dailyChangePercent.toFixed(1)}%. Review the catalyst before acting.`);
    }
    if (market.ma200 !== null && market.price < market.ma200) {
        add('risk', 'Below 200-day average', `Price ${market.price.toFixed(2)} is below the long-term average ${market.ma200.toFixed(2)}.`);
    } else if (market.ma50 !== null && market.price < market.ma50) {
        add('watch', 'Below 50-day average', `Price ${market.price.toFixed(2)} is below the intermediate average ${market.ma50.toFixed(2)}.`);
    }
    if (market.rsi14 !== null && market.rsi14 <= 30) {
        add('opportunity', 'Oversold review', `RSI is ${market.rsi14.toFixed(1)}. Confirm fundamentals and the cause of weakness.`);
    } else if (market.rsi14 !== null && market.rsi14 >= 70) {
        add('watch', 'Momentum overextended', `RSI is ${market.rsi14.toFixed(1)}. Avoid treating momentum as an automatic entry.`);
    }
    return alerts;
};
