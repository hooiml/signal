import type { ResearchFundamentalPeriod, ResearchSnapshot } from '../types/research-snapshot';

export type AnnualAmount = 'annualRevenue' | 'annualNetIncome' | 'freeCashFlow';
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

// Annual-change summaries and their explanations use the same display precision.
export function financialPercentage(value: number | null | undefined): string {
    return finite(value) ? `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}%` : 'Unavailable';
}

export function compactFinancialAmount(value: number | null | undefined, currency?: string | null): string {
    if (!finite(value)) return 'Unavailable';
    const magnitude = Math.abs(value);
    const scale = magnitude >= 1e12 ? 1e12 : magnitude >= 1e9 ? 1e9 : magnitude >= 1e6 ? 1e6 : 1;
    const suffix = scale === 1e12 ? ' trillion' : scale === 1e9 ? ' billion' : scale === 1e6 ? ' million' : '';
    return `${currency?.trim() || 'Currency not supplied'} ${(value / scale).toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix}`;
}

export function cashDebtDisplay(netCash: number | null | undefined, currency?: string | null): { label: string; amount: string } {
    if (!finite(netCash)) return { label: 'Net cash / (debt)', amount: 'Unavailable' };
    return netCash < 0
        ? { label: 'Net debt', amount: compactFinancialAmount(Math.abs(netCash), currency) }
        : { label: 'Net cash', amount: compactFinancialAmount(netCash, currency) };
}

export type AnnualComparison = {
    current: ResearchFundamentalPeriod;
    previous: ResearchFundamentalPeriod;
    delta: number;
    percentage: number | null;
};

export function annualAmountComparison(f: ResearchSnapshot['fundamentals'], field: AnnualAmount): AnnualComparison | null {
    const candidates = f.history.filter(row => row.reportingPeriod === f.reportingPeriod);
    if (candidates.length !== 1) return null;
    const current = candidates[0];
    const currentTime = Date.parse(current.reportingPeriod);
    if (!Number.isFinite(currentTime) || !f.source || current.source !== f.source || !current.currency.trim()
        || current.comparableAnnual === false || !finite(current[field]) || current[field] !== f[field]) return null;
    const earlier = f.history.filter(row => Date.parse(row.reportingPeriod) < currentTime)
        .sort((a, b) => Date.parse(b.reportingPeriod) - Date.parse(a.reportingPeriod));
    const previous = earlier[0];
    if (!previous || earlier.filter(row => row.reportingPeriod === previous.reportingPeriod).length !== 1
        || previous.source !== current.source || previous.currency !== current.currency || !finite(previous[field])) return null;
    const days = (currentTime - Date.parse(previous.reportingPeriod)) / 86400000;
    // Same conservative annual endpoint window already used by the Yahoo adapter.
    // Never turn skipped years or a currency/source change into a YoY comparison.
    if (days < 350 || days > 380) return null;
    const delta = current[field]! - previous[field]!;
    if (!finite(delta)) return null;
    const percentage = previous[field]! > 0 ? delta / previous[field]! * 100 : null;
    return { current, previous, delta, percentage: finite(percentage) ? percentage : null };
}
