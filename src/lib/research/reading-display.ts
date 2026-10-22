import type { ResearchMarket } from '../types/research';
import type { ResearchSnapshot } from '../types/research-snapshot';

export type ProviderResearchIdentity = {
    symbol: string;
    market: ResearchMarket;
    name: string | null;
};

/** Only show identity returned for the selection currently being read. */
export function researchIdentityName(identity: ProviderResearchIdentity | null, symbol: string, market?: ResearchMarket): string | null {
    return identity?.symbol === symbol && identity.market === market ? identity.name?.trim() || null : null;
}

type ClosePoint = { readonly time: string; readonly close: number };
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;

/** A display comparison over returned closes, not adjusted/total return or a forecast. */
export function priceRangeChange(points: readonly ClosePoint[]) {
    if (points.length < 2) return null;
    if (points.some((point, i) => !finite(point.close) || point.close < 0 || !Number.isFinite(Date.parse(point.time))
        || (i > 0 && Date.parse(point.time) <= Date.parse(points[i - 1].time)))) return null;
    const first = points[0], last = points[points.length - 1];
    const amount = last.close - first.close;
    const percentage = first.close > 0 ? amount / first.close * 100 : null;
    if (!finite(amount) || (percentage !== null && !finite(percentage))) return null;
    return { amount, percentage, start: first.time, end: last.time };
}

/** Nearest actual observation in time; never fabricate a price in a missing session. */
export function nearestPricePoint(points: readonly ClosePoint[], timestamp: number): number | null {
    if (!points.length || !finite(timestamp)) return null;
    let best: number | null = null, distance = Infinity;
    points.forEach((point, i) => {
        const gap = Math.abs(Date.parse(point.time) - timestamp);
        if (finite(gap) && finite(point.close) && gap < distance) { best = i; distance = gap; }
    });
    return best;
}

export type AvailabilityNote = { heading: string; detail: string; reasons: string[] };

/** New responses carry the exact calculation basis; older responses retain their original basis. */
export function valuationShareCount(snapshot: ResearchSnapshot | null): number | null {
    if (!snapshot) return null;
    if (snapshot.valuation.shareCount !== undefined) return snapshot.valuation.shareCount;
    return snapshot.market === 'MY' ? snapshot.quote.sharesOutstanding ?? null : snapshot.fundamentals.shares;
}

/** Describe only gaps supported by the existing snapshot/valuation contract. */
export function researchAvailability(snapshot: ResearchSnapshot, section: 'Financials' | 'Valuation'): AvailabilityNote | null {
    const f = snapshot.fundamentals;
    if (section === 'Financials') {
        const entries = [['revenue', f.annualRevenue], ['net income', f.annualNetIncome], ['free cash flow', f.freeCashFlow]] as const;
        const missing = entries.filter(([, value]) => !finite(value)).map(([name]) => name);
        if (!missing.length) return null;
        return {
            heading: missing.length === entries.length ? 'Annual financial figures not supplied' : 'Some annual figures are unavailable',
            detail: `Not supplied: ${missing.join(', ')}. Missing amounts are not zero.`,
            reasons: ['The response does not establish whether another request will supply these figures. Check the provider notices or the issuer report; any returned figures remain below.'],
        };
    }
    const v = snapshot.valuation;
    const fields = [['market capitalization', v.marketCap], ['P/E', v.priceEarnings], ['P/S', v.priceSales], ['free-cash-flow yield', v.freeCashFlowYieldPercent]] as const;
    const missing = fields.filter(([, value]) => !finite(value)).map(([label]) => label);
    if (!missing.length) return null;
    const reasons: string[] = [];
    if (!finite(v.marketCap)) {
        const shares = valuationShareCount(snapshot);
        if (!positive(shares)) reasons.push(`Compatible outstanding shares are unavailable or non-positive. Share-based measures need this input.${snapshot.market === 'MY' ? ' Annual diluted average shares are not substituted.' : ''}`);
        if (!positive(snapshot.quote.price)) reasons.push('A positive current price was not supplied for market capitalization.');
        if (snapshot.market === 'MY' && snapshot.quote.currency !== 'MYR') reasons.push('The quote currency is not confirmed as MYR. No currency conversion is applied to the MYR financial figures.');
    }
    if (!finite(v.priceEarnings)) {
        if (!finite(f.annualNetIncome)) reasons.push('P/E also needs annual net income, which was not supplied.');
        else if (f.annualNetIncome <= 0) reasons.push('P/E is withheld because reported annual net income is zero or negative; this is not a failed request.');
    }
    if (!finite(v.priceSales) && !positive(f.annualRevenue)) reasons.push('P/S needs a positive annual revenue amount.');
    if (!finite(v.freeCashFlowYieldPercent) && !finite(f.freeCashFlow)) reasons.push('Free-cash-flow yield needs annual free cash flow, which was not supplied.');
    return {
        heading: 'Some valuation measures are unavailable',
        detail: `Not supplied: ${missing.join(', ')}.`,
        reasons: reasons.length ? reasons : ['The response does not establish the missing dependency. Check the provider notices; no replacement value has been estimated.'],
    };
}
