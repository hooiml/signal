import type { ResearchFundamentalProvenance, ResearchSnapshot } from '../types/research-snapshot';

type Fundamentals = ResearchSnapshot['fundamentals'] | null | undefined;

export const financialPeriodLabel = (period: string | null | undefined): string =>
    period ? `Year ended ${period}` : 'Annual reporting period unavailable';

export const researchMetricPeriodLabel = (fundamentals: Fundamentals, metric: keyof ResearchFundamentalProvenance): string => {
    const periods = fundamentals?.metricProvenance?.[metric].reportingPeriods ?? [];
    if (!periods.length) return 'Reporting date unavailable';
    if (metric === 'shareChange') return periods.length === 2
        ? `Annual comparison: ${periods[0]} to ${periods[1]}`
        : 'Comparison dates unavailable';
    if (metric === 'debt' && periods.length > 1) return `Components reported ${periods.join(' and ')}; dates differ`;
    if (metric === 'shares' && fundamentals?.source === 'Yahoo Finance') return financialPeriodLabel(periods[0]);
    return `Reported ${periods[0]}`;
};

export const netCashCurrency = (fundamentals: Fundamentals): string | null => {
    const debtCurrency = fundamentals?.metricProvenance?.debt.currency;
    const cashCurrency = fundamentals?.metricProvenance?.cash.currency;
    return debtCurrency && debtCurrency === cashCurrency ? debtCurrency : null;
};

export const formatResearchTimestamp = (timestamp: string | null | undefined): string => {
    if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return 'Unavailable';
    return `${new Intl.DateTimeFormat('en-GB', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
    }).format(new Date(timestamp))} UTC`;
};
