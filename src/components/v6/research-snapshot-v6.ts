import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';

const number = (value: number | null, suffix = '') => value === null ? 'Unavailable' : `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix}`;
const money = (value: number | null) => value === null ? 'Unavailable' : new Intl.NumberFormat('en-US', { notation: 'compact', style: 'currency', currency: 'USD', maximumFractionDigits: 1 }).format(value);

export const applyResearchSnapshotV6 = (item: ResearchWatchlistItem, snapshot: ResearchSnapshot): ResearchWatchlistItem => ({
    ...item,
    name: snapshot.quote.name ?? item.name,
    price: snapshot.quote.price ?? undefined,
    dailyChange: snapshot.quote.dailyChangePercent ?? undefined,
    revenueGrowth: number(snapshot.fundamentals.revenueGrowthPercent, '%'),
    grossMargin: number(snapshot.fundamentals.grossMarginPercent, '%'),
    operatingMargin: number(snapshot.fundamentals.operatingMarginPercent, '%'),
    freeCashFlowTrend: money(snapshot.fundamentals.freeCashFlow),
    debtLevel: money(snapshot.fundamentals.debt),
    cashPosition: money(snapshot.fundamentals.cash),
    shareCountTrend: number(snapshot.fundamentals.shares),
    marketCap: money(snapshot.valuation.marketCap),
    valuation: {
        pe: number(snapshot.valuation.priceEarnings),
        forwardPe: 'Unavailable',
        priceSales: number(snapshot.valuation.priceSales),
        evEbitda: 'Unavailable',
        fcfYield: number(snapshot.valuation.freeCashFlowYieldPercent, '%'),
        dividendYield: 'Unavailable',
        fiveYearRange: 'Unavailable',
        peerNote: snapshot.valuation.source
            ? `${snapshot.valuation.source}; annual period ${snapshot.valuation.reportingPeriod ?? 'unavailable'}. Net cash ${money(snapshot.valuation.netCash)}.`
            : 'Valuation inputs unavailable from free sources.',
    },
    event: {
        nextEarnings: 'Unavailable', lastEarnings: 'Unavailable', revenueResult: 'Unavailable', epsResult: 'Unavailable',
        guidance: 'Unavailable from the connected free sources.', note: 'Add event notes after reviewing a primary filing.',
    },
    technical: {
        ma50: number(snapshot.technicals.ma50),
        ma200: number(snapshot.technicals.ma200),
        range52Week: snapshot.technicals.low52Week === null || snapshot.technicals.high52Week === null
            ? 'Unavailable' : `${number(snapshot.technicals.low52Week)} - ${number(snapshot.technicals.high52Week)}`,
        rsi: number(snapshot.technicals.rsi14),
        macd: number(snapshot.technicals.macd),
        volume: number(snapshot.technicals.averageVolume20),
        supportResistance: snapshot.technicals.support === null || snapshot.technicals.resistance === null
            ? 'Unavailable' : `${number(snapshot.technicals.support)} / ${number(snapshot.technicals.resistance)}`,
    },
});

export const parseResearchSnapshotResponse = (payload: unknown): ResearchSnapshot => {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new Error('Invalid research snapshot response.');
    const body = Object.fromEntries(Object.entries(payload));
    if (body.success !== true || !isResearchSnapshot(body.data)) {
        throw new Error(typeof body.error === 'string' ? body.error : 'Unable to load free-source data.');
    }
    return body.data;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNullableNumber = (value: unknown) => value === null || (typeof value === 'number' && Number.isFinite(value));

const isResearchSnapshot = (value: unknown): value is ResearchSnapshot => {
    if (!isRecord(value) || !isRecord(value.quote) || !isRecord(value.fundamentals) || !isRecord(value.valuation) || !isRecord(value.technicals)) return false;
    return typeof value.symbol === 'string'
        && (value.market === 'US' || value.market === 'MY')
        && typeof value.fetchedAt === 'string'
        && isNullableNumber(value.quote.price)
        && isNullableNumber(value.quote.dailyChangePercent)
        && isNullableNumber(value.fundamentals.revenueGrowthPercent)
        && isNullableNumber(value.valuation.marketCap)
        && isNullableNumber(value.valuation.priceEarnings)
        && isNullableNumber(value.technicals.ma50)
        && Array.isArray(value.sources) && value.sources.every((source) => typeof source === 'string')
        && Array.isArray(value.warnings) && value.warnings.every((warning) => typeof warning === 'string');
};
