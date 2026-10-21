import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import { formatResearchPrice, researchPriceCurrency } from '@/lib/research/price-format';
import { financialPeriodLabel, netCashCurrency, researchMetricPeriodLabel } from '@/lib/research/metric-provenance';
export { parseResearchSnapshotResponse } from '@/lib/research/snapshot-input';

const number = (value: number | null, suffix = '') => value === null ? 'Unavailable' : `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix}`;
const money = (value: number | null, currency?: string | null) => value === null ? 'Unavailable' : `${number(value)} ${researchPriceCurrency(currency) ?? '(currency not recorded)'}`;

export const applyResearchSnapshotV6 = (item: ResearchWatchlistItem, snapshot: ResearchSnapshot): ResearchWatchlistItem => {
    const fundamentals = snapshot.fundamentals;
    const currency = fundamentals.history.find(period => period.reportingPeriod === fundamentals.reportingPeriod)?.currency;
    const annualPeriod = financialPeriodLabel(fundamentals.reportingPeriod);
    return ({
    ...item,
    name: snapshot.quote.name ?? item.name,
    price: snapshot.quote.price ?? undefined,
    quoteCurrency: snapshot.quote.currency,
    dailyChange: snapshot.quote.dailyChangePercent ?? undefined,
    revenueGrowth: number(snapshot.fundamentals.revenueGrowthPercent, '%'),
    grossMargin: number(snapshot.fundamentals.grossMarginPercent, '%'),
    operatingMargin: number(snapshot.fundamentals.operatingMarginPercent, '%'),
    freeCashFlowTrend: money(snapshot.fundamentals.freeCashFlow, currency),
    debtLevel: `${money(fundamentals.debt, fundamentals.metricProvenance?.debt.currency)} · ${researchMetricPeriodLabel(fundamentals, 'debt')}`,
    cashPosition: `${money(fundamentals.cash, fundamentals.metricProvenance?.cash.currency)} · ${researchMetricPeriodLabel(fundamentals, 'cash')}`,
    shareCountTrend: `${number(fundamentals.shares)} · ${fundamentals.source === 'Yahoo Finance' ? 'Annual diluted average' : 'Outstanding'} · ${researchMetricPeriodLabel(fundamentals, 'shares')}`,
    marketCap: money(snapshot.valuation.marketCap, snapshot.quote.currency),
    valuation: {
        pe: number(snapshot.valuation.priceEarnings),
        forwardPe: 'Unavailable',
        priceSales: number(snapshot.valuation.priceSales),
        evEbitda: 'Unavailable',
        fcfYield: number(snapshot.valuation.freeCashFlowYieldPercent, '%'),
        dividendYield: 'Unavailable',
        fiveYearRange: 'Unavailable',
        peerNote: snapshot.valuation.source
            ? `${snapshot.valuation.source}; ${annualPeriod}. Current-price ratios combine the returned quote with annual financials. Net cash ${money(snapshot.valuation.netCash, netCashCurrency(fundamentals))}; cash: ${researchMetricPeriodLabel(fundamentals, 'cash')}; debt: ${researchMetricPeriodLabel(fundamentals, 'debt')}.`
            : 'Valuation inputs unavailable from free sources.',
    },
    event: {
        nextEarnings: 'Unavailable', lastEarnings: 'Unavailable', revenueResult: 'Unavailable', epsResult: 'Unavailable',
        guidance: 'Unavailable from the connected free sources.', note: 'Add event notes after reviewing a primary filing.',
    },
    technical: {
        ma50: formatResearchPrice(snapshot.technicals.ma50, snapshot.quote.currency),
        ma200: formatResearchPrice(snapshot.technicals.ma200, snapshot.quote.currency),
        range52Week: snapshot.technicals.low52Week === null || snapshot.technicals.high52Week === null
            ? 'Unavailable' : `${formatResearchPrice(snapshot.technicals.low52Week, snapshot.quote.currency)} – ${formatResearchPrice(snapshot.technicals.high52Week, snapshot.quote.currency)}`,
        rsi: number(snapshot.technicals.rsi14),
        macd: number(snapshot.technicals.macd),
        volume: number(snapshot.technicals.averageVolume20),
        supportResistance: snapshot.technicals.support === null || snapshot.technicals.resistance === null
            ? 'Unavailable' : `${formatResearchPrice(snapshot.technicals.support, snapshot.quote.currency)} / ${formatResearchPrice(snapshot.technicals.resistance, snapshot.quote.currency)}`,
    },
    });
};

export const applyResearchQuoteV6 = (item: ResearchWatchlistItem, quote: ResearchSnapshot['quote']): ResearchWatchlistItem => ({
    ...item,
    name: quote.name ?? item.name,
    price: quote.price ?? undefined,
    quoteCurrency: quote.currency,
    dailyChange: quote.dailyChangePercent ?? undefined,
});
