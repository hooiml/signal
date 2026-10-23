import type { ResearchFundamentalPeriod, ResearchSnapshot } from '../types/research-snapshot';

export type AnnualAmount = 'annualRevenue' | 'annualNetIncome' | 'freeCashFlow';
export type AnnualMarginField = 'grossMarginPercent' | 'operatingMarginPercent';
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

// Annual-change summaries and their explanations use the same display precision.
export function financialPercentage(value: number | null | undefined): string {
    return finite(value) ? `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}%` : 'Unavailable';
}

export function compactShareCount(value: number | null | undefined): string {
    if (!finite(value) || value <= 0) return 'Unavailable';
    const scale = value >= 1e9 ? 1e9 : value >= 1e6 ? 1e6 : 1;
    const suffix = scale === 1e9 ? ' billion' : scale === 1e6 ? ' million' : '';
    return `${(value / scale).toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix} shares`;
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

export type AnnualHistoryPoint = {
    readonly reportingPeriod: string;
    readonly value: number;
    readonly heightPercent: number;
    readonly sign: 'positive' | 'negative' | 'zero';
};

export type AnnualHistorySeries = {
    readonly currency: string;
    readonly source: string;
    readonly points: readonly AnnualHistoryPoint[];
    readonly hasNegative: boolean;
    readonly startPeriod: string;
    readonly endPeriod: string;
};

// Returns chronological comparable annual observations sharing the current period's currency and source.
export function annualHistorySeries(f: ResearchSnapshot['fundamentals'] | null | undefined, field: AnnualAmount): AnnualHistorySeries | null {
    if (!f || !f.source || !f.reportingPeriod) return null;
    const currentCandidates = f.history.filter(row => row.reportingPeriod === f.reportingPeriod);
    if (currentCandidates.length !== 1) return null;
    const current = currentCandidates[0];
    const currency = current.currency?.trim();
    if (!currency || current.source !== f.source || current.comparableAnnual === false || !finite(current[field]) || current[field] !== f[field]) return null;
    const comparable = f.history.filter(row => {
        const parsed = Date.parse(row.reportingPeriod);
        return Number.isFinite(parsed)
            && row.currency?.trim() === currency
            && row.source === current.source
            && row.comparableAnnual !== false
            && finite(row[field]);
    });
    const uniquePeriods = new Set(comparable.map(row => row.reportingPeriod));
    if (uniquePeriods.size !== comparable.length || comparable.length < 2) return null;
    const sorted = [...comparable].sort((a, b) => Date.parse(a.reportingPeriod) - Date.parse(b.reportingPeriod));
    // Require consecutive annual-scale intervals (330 to 400 days) so skipped years are not plotted as adjacent bars.
    for (let index = 1; index < sorted.length; index += 1) {
        const days = (Date.parse(sorted[index].reportingPeriod) - Date.parse(sorted[index - 1].reportingPeriod)) / 86400000;
        if (days < 330 || days > 400) return null;
    }
    const maxMagnitude = Math.max(...sorted.map(row => Math.abs(row[field]!)), 0);
    const points: AnnualHistoryPoint[] = sorted.map(row => {
        const value = row[field]!;
        const sign = value > 0 ? 'positive' : value < 0 ? 'negative' : 'zero';
        const heightPercent = maxMagnitude > 0 ? Math.max(sign === 'zero' ? 6 : 14, Math.round(Math.abs(value) / maxMagnitude * 100)) : 6;
        return { reportingPeriod: row.reportingPeriod, value, heightPercent, sign };
    });
    return {
        currency,
        source: current.source,
        points,
        hasNegative: points.some(point => point.sign === 'negative'),
        startPeriod: points[0].reportingPeriod,
        endPeriod: points[points.length - 1].reportingPeriod,
    };
}

export type AnnualMarginComparison = {
    readonly current: ResearchFundamentalPeriod;
    readonly previous: ResearchFundamentalPeriod;
    readonly deltaPercentagePoints: number;
};

export function annualMarginComparison(
    f: ResearchSnapshot['fundamentals'] | null | undefined,
    field: AnnualMarginField,
): AnnualMarginComparison | null {
    if (!f || !f.source || !f.reportingPeriod) return null;
    const candidates = f.history.filter(row => row.reportingPeriod === f.reportingPeriod);
    if (candidates.length !== 1) return null;
    const current = candidates[0];
    const currentTime = Date.parse(current.reportingPeriod);
    if (!Number.isFinite(currentTime) || current.source !== f.source || !current.currency.trim()
        || current.comparableAnnual === false || !finite(current[field]) || current[field] !== f[field]) return null;
    const earlier = f.history.filter(row => Date.parse(row.reportingPeriod) < currentTime)
        .sort((a, b) => Date.parse(b.reportingPeriod) - Date.parse(a.reportingPeriod));
    const previous = earlier[0];
    if (!previous || earlier.filter(row => row.reportingPeriod === previous.reportingPeriod).length !== 1
        || previous.source !== current.source || previous.currency !== current.currency || !finite(previous[field])) return null;
    const days = (currentTime - Date.parse(previous.reportingPeriod)) / 86400000;
    if (days < 350 || days > 380) return null;
    const deltaPercentagePoints = Number((current[field]! - previous[field]!).toFixed(2));
    return finite(deltaPercentagePoints) ? { current, previous, deltaPercentagePoints } : null;
}

export function annualMarginSeries(
    f: ResearchSnapshot['fundamentals'] | null | undefined,
    field: AnnualMarginField,
): AnnualHistorySeries | null {
    if (!f || !f.source || !f.reportingPeriod) return null;
    const currentCandidates = f.history.filter(row => row.reportingPeriod === f.reportingPeriod);
    if (currentCandidates.length !== 1) return null;
    const current = currentCandidates[0];
    const currency = current.currency?.trim();
    if (!currency || current.source !== f.source || current.comparableAnnual === false || !finite(current[field]) || current[field] !== f[field]) return null;
    const comparable = f.history.filter(row => {
        const parsed = Date.parse(row.reportingPeriod);
        return Number.isFinite(parsed)
            && row.currency?.trim() === currency
            && row.source === current.source
            && row.comparableAnnual !== false
            && finite(row[field]);
    });
    const uniquePeriods = new Set(comparable.map(row => row.reportingPeriod));
    if (uniquePeriods.size !== comparable.length || comparable.length < 2) return null;
    const sorted = [...comparable].sort((a, b) => Date.parse(a.reportingPeriod) - Date.parse(b.reportingPeriod));
    for (let index = 1; index < sorted.length; index += 1) {
        const days = (Date.parse(sorted[index].reportingPeriod) - Date.parse(sorted[index - 1].reportingPeriod)) / 86400000;
        if (days < 330 || days > 400) return null;
    }
    const maxMagnitude = Math.max(...sorted.map(row => Math.abs(row[field]!)), 0);
    const points: AnnualHistoryPoint[] = sorted.map(row => {
        const value = row[field]!;
        const sign = value > 0 ? 'positive' : value < 0 ? 'negative' : 'zero';
        const heightPercent = maxMagnitude > 0 ? Math.max(sign === 'zero' ? 6 : 14, Math.round(Math.abs(value) / maxMagnitude * 100)) : 6;
        return { reportingPeriod: row.reportingPeriod, value, heightPercent, sign };
    });
    return {
        currency,
        source: current.source,
        points,
        hasNegative: points.some(point => point.sign === 'negative'),
        startPeriod: points[0].reportingPeriod,
        endPeriod: points[points.length - 1].reportingPeriod,
    };
}

export type BalanceSheetCushion = {
    readonly currency: string;
    readonly cash: number;
    readonly debt: number;
    readonly netCash: number;
    readonly posture: 'net-cash' | 'net-debt' | 'balanced';
    readonly cashWidthPercent: number;
    readonly debtWidthPercent: number;
};

export function balanceSheetCushion(f: ResearchSnapshot['fundamentals'] | null | undefined): BalanceSheetCushion | null {
    if (!f || !finite(f.cash) || !finite(f.debt) || f.cash < 0 || f.debt < 0) return null;
    const currentPeriod = f.history.find(row => row.reportingPeriod === f.reportingPeriod);
    const cashCurrency = f.metricProvenance?.cash.currency?.trim() || currentPeriod?.currency?.trim() || null;
    const debtCurrency = f.metricProvenance?.debt.currency?.trim() || currentPeriod?.currency?.trim() || null;
    if (!cashCurrency || !debtCurrency || cashCurrency !== debtCurrency) return null;
    const netCash = f.cash - f.debt;
    const posture: BalanceSheetCushion['posture'] = netCash > 0 ? 'net-cash' : netCash < 0 ? 'net-debt' : 'balanced';
    const maxSide = Math.max(f.cash, f.debt, 0);
    const widthPercent = (amount: number): number =>
        amount === 0 || maxSide === 0 ? 0 : Math.max(8, Math.round((amount / maxSide) * 100));
    return {
        currency: cashCurrency,
        cash: f.cash,
        debt: f.debt,
        netCash,
        posture,
        cashWidthPercent: widthPercent(f.cash),
        debtWidthPercent: widthPercent(f.debt),
    };
}

export type AnnualSharePoint = {
    readonly reportingPeriod: string;
    readonly shares: number;
    readonly shareChangePercent: number | null;
    readonly heightPercent: number;
};

export type AnnualShareSeries = {
    readonly source: string;
    readonly shareBasisLabel: string;
    readonly points: readonly AnnualSharePoint[];
    readonly startPeriod: string;
    readonly endPeriod: string;
    readonly cumulativeChangePercent: number | null;
    readonly posture: 'buyback' | 'dilution' | 'unchanged';
};

export function annualShareSeries(f: ResearchSnapshot['fundamentals'] | null | undefined): AnnualShareSeries | null {
    if (!f || !f.source) return null;
    const comparable = f.history.filter(row => {
        const parsed = Date.parse(row.reportingPeriod);
        return Number.isFinite(parsed)
            && row.source === f.source
            && row.comparableAnnual !== false
            && finite(row.shares)
            && row.shares > 0;
    });
    const uniquePeriods = new Set(comparable.map(row => row.reportingPeriod));
    if (uniquePeriods.size !== comparable.length || comparable.length < 2) return null;
    const sorted = [...comparable].sort((a, b) => Date.parse(a.reportingPeriod) - Date.parse(b.reportingPeriod));
    for (let index = 1; index < sorted.length; index += 1) {
        const days = (Date.parse(sorted[index].reportingPeriod) - Date.parse(sorted[index - 1].reportingPeriod)) / 86400000;
        if (days < 330 || days > 400) return null;
    }
    const maxShares = Math.max(...sorted.map(row => row.shares!), 1);
    const points: AnnualSharePoint[] = sorted.map((row, index) => {
        const shares = row.shares!;
        const priorShares = index > 0 ? sorted[index - 1].shares! : null;
        const derivedChange = priorShares !== null && priorShares > 0
            ? Number((((shares - priorShares) / priorShares) * 100).toFixed(2))
            : null;
        const shareChangePercent = finite(row.shareChangePercent) ? row.shareChangePercent : derivedChange;
        const heightPercent = Math.max(18, Math.round((shares / maxShares) * 100));
        return {
            reportingPeriod: row.reportingPeriod,
            shares,
            shareChangePercent: finite(shareChangePercent) ? shareChangePercent : null,
            heightPercent,
        };
    });
    const firstShares = points[0].shares;
    const lastShares = points[points.length - 1].shares;
    const cumulativeChangePercent = firstShares > 0
        ? Number((((lastShares - firstShares) / firstShares) * 100).toFixed(2))
        : null;
    const posture: AnnualShareSeries['posture'] = cumulativeChangePercent === null || cumulativeChangePercent === 0
        ? 'unchanged'
        : cumulativeChangePercent < 0 ? 'buyback' : 'dilution';
    return {
        source: f.source,
        shareBasisLabel: f.source === 'Yahoo Finance' ? 'Annual diluted average shares' : 'Shares outstanding',
        points,
        startPeriod: points[0].reportingPeriod,
        endPeriod: points[points.length - 1].reportingPeriod,
        cumulativeChangePercent,
        posture,
    };
}

export type PositionPlanMarker = {
    readonly id: 'invalidation' | 'entry' | 'cost' | 'current' | 'low52' | 'high52';
    readonly label: string;
    readonly price: number;
    readonly offsetPercent: number;
    readonly deltaFromCurrentPercent: number | null;
};

export type PositionPlanPriceContext = {
    readonly currency: string;
    readonly currentPrice: number;
    readonly scaleLow: number;
    readonly scaleHigh: number;
    readonly markers: readonly PositionPlanMarker[];
    readonly distances: {
        readonly plannedEntryPercent: number | null;
        readonly averageCostPercent: number | null;
        readonly invalidationPercent: number | null;
    };
};

const validCurrency = (value: unknown): string | null =>
    typeof value === 'string' && /^[A-Za-z]{3}$/.test(value.trim()) ? value.trim() : null;

// Compares saved position-plan levels with the returned quote only when both carry the exact same 3-letter currency.
export function positionPlanPriceContext(
    plan: {
        readonly currency?: string | null;
        readonly plannedEntryPrice: number | null;
        readonly averageCost: number | null;
        readonly invalidationPrice: number | null;
    } | null | undefined,
    quote: {
        readonly price: number | null;
        readonly currency: string | null;
    } | null | undefined,
    bounds?: {
        readonly low52Week?: number | null;
        readonly high52Week?: number | null;
    } | null,
): PositionPlanPriceContext | null {
    if (!plan || !quote || !finite(quote.price) || quote.price <= 0) return null;
    const planCurrency = validCurrency(plan.currency);
    const quoteCurrency = validCurrency(quote.currency);
    if (!planCurrency || !quoteCurrency || planCurrency !== quoteCurrency) return null;
    const currentPrice = quote.price;
    const positiveLevel = (value: number | null | undefined): number | null => finite(value) && value > 0 ? value : null;
    const entry = positiveLevel(plan.plannedEntryPrice);
    const cost = positiveLevel(plan.averageCost);
    const invalidation = positiveLevel(plan.invalidationPrice);
    if (entry === null && cost === null && invalidation === null) return null;
    const low52 = positiveLevel(bounds?.low52Week);
    const high52 = positiveLevel(bounds?.high52Week);
    const include52 = low52 !== null && high52 !== null && high52 > low52;
    const rawMarkers: Array<{ id: PositionPlanMarker['id']; label: string; price: number }> = [
        ...(include52 ? [{ id: 'low52' as const, label: '52-wk low', price: low52! }] : []),
        ...(invalidation !== null ? [{ id: 'invalidation' as const, label: 'Invalidation', price: invalidation }] : []),
        ...(entry !== null ? [{ id: 'entry' as const, label: 'Planned entry', price: entry }] : []),
        ...(cost !== null ? [{ id: 'cost' as const, label: 'Average cost', price: cost }] : []),
        { id: 'current' as const, label: 'Current price', price: currentPrice },
        ...(include52 ? [{ id: 'high52' as const, label: '52-wk high', price: high52! }] : []),
    ];
    const prices = rawMarkers.map(marker => marker.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const span = maxPrice - minPrice;
    const padding = span > 0 ? span * 0.06 : currentPrice * 0.05;
    const scaleLow = Math.max(0, minPrice - padding);
    const scaleHigh = maxPrice + padding;
    const scaleSpan = scaleHigh - scaleLow || 1;
    const deltaPercent = (target: number | null): number | null =>
        target === null ? null : (target - currentPrice) / currentPrice * 100;
    const markers: PositionPlanMarker[] = rawMarkers.map(marker => ({
        ...marker,
        offsetPercent: Math.max(2, Math.min(98, (marker.price - scaleLow) / scaleSpan * 100)),
        deltaFromCurrentPercent: marker.id === 'current' || marker.id === 'low52' || marker.id === 'high52' ? null : deltaPercent(marker.price),
    }));
    return {
        currency: quoteCurrency,
        currentPrice,
        scaleLow,
        scaleHigh,
        markers,
        distances: {
            plannedEntryPercent: deltaPercent(entry),
            averageCostPercent: deltaPercent(cost),
            invalidationPercent: deltaPercent(invalidation),
        },
    };
}
