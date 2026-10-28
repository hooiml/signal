import type { ResearchMarket } from '../types/research';
import type { ResearchCalendarInput, ResearchCalendarResponse } from '../types/research-calendar';
import { isResearchCalendarDate } from './calendar-input';

export type EarningsCalendarTarget = { symbol: string; market: ResearchMarket; date: string };

export function parseEarningsCalendarTarget(symbol: string | undefined, market: string | undefined, date: string | undefined): EarningsCalendarTarget | undefined {
    if (!symbol || !/^[A-Z0-9.-]{1,15}$/.test(symbol) || (market !== 'US' && market !== 'MY') || !date || !isResearchCalendarDate(date)) return undefined;
    return { symbol, market, date };
}

export function earningsCalendarInput(symbol: string, market: ResearchMarket): ResearchCalendarInput[] {
    return [{ symbol, market, nextReviewAt: null, lastReviewedAt: null, reviewAgeDays: null, earningsWithinDays: 30 }];
}

export function nextEarningsEvent(data: ResearchCalendarResponse, symbol: string, market: ResearchMarket, today: string) {
    if (data.rangeDays !== 30 || data.events.some(event => event.symbol !== symbol || event.market !== market || event.type !== 'earnings' || event.source !== 'Nasdaq earnings calendar' || event.sourceDate !== event.displayDate)) throw new Error('Earnings response did not match the selected security.');
    if (data.warnings.length) throw new Error('Earnings coverage is temporarily unavailable.');
    const end = new Date(`${data.generatedAt.slice(0, 10)}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + data.rangeDays);
    return [...data.events].filter(event => event.displayDate >= today && event.displayDate <= end.toISOString().slice(0, 10))
        .sort((a, b) => a.displayDate.localeCompare(b.displayDate))[0] ?? null;
}

export const earningsTimingLabel = (timing?: string) => timing === 'pre-market' ? 'before open' : timing === 'after-hours' ? 'after close' : 'time not supplied';
