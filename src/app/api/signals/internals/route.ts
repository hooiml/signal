import { NextResponse } from 'next/server';
import { fetchYahooResearchChart } from '@/lib/research/yahoo-research';
import type { ResearchChartPoint } from '@/lib/types/research-snapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type InternalPoint = {
    readonly date: string;
    readonly value: number;
    readonly baseline: number | null;
};

export type MarketInternalItem = {
    readonly id: string;
    readonly name: string;
    readonly subtitle: string;
    readonly latestLabel: string;
    readonly baselineLabel: string;
    readonly tone: 'up' | 'neutral' | 'down';
    readonly description: string;
    readonly points: readonly InternalPoint[];
};

export type MarketInternalsPayload = {
    readonly market: 'US' | 'MY';
    readonly available: boolean;
    readonly updatedAt: string | null;
    readonly items: readonly MarketInternalItem[];
};

const CACHE_TTL_MS = 15 * 60 * 1000;
const TRAILING_WINDOW = 60;
const cache = new Map<'US' | 'MY', { readonly payload: MarketInternalsPayload; readonly expiresAt: number }>();

const round = (value: number, decimals = 2) => {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
};

function rollingSma(values: readonly number[], period: number): (number | null)[] {
    let sum = 0;
    return values.map((val, idx) => {
        sum += val;
        if (idx >= period) sum -= values[idx - period];
        const count = Math.min(idx + 1, period);
        return idx + 1 >= Math.min(period, 10) ? sum / count : null;
    });
}

function ratioVsMaItem(params: {
    id: string;
    name: string;
    subtitle: string;
    numerator: readonly ResearchChartPoint[];
    denominator: readonly ResearchChartPoint[];
    maPeriod: number;
    indexed: boolean;
    decimals: number;
    thresholdPct: number;
    positiveDesc: string;
    negativeDesc: string;
    neutralDesc: string;
}): MarketInternalItem | null {
    const denomByDate = new Map(params.denominator.map(point => [point.time, point.close]));
    const aligned = params.numerator.flatMap(point => {
        const denomClose = denomByDate.get(point.time);
        if (denomClose === undefined || denomClose <= 0 || point.close <= 0) return [];
        return [{ date: point.time, raw: point.close / denomClose }];
    });
    if (aligned.length < 15) return null;

    const base = params.indexed ? aligned[0].raw : 1;
    const scaled = aligned.map(row => (params.indexed ? (row.raw / base) * 100 : row.raw));
    const ma = rollingSma(scaled, params.maPeriod);
    const series: InternalPoint[] = aligned.map((row, idx) => ({
        date: row.date,
        value: round(scaled[idx], params.decimals),
        baseline: ma[idx] !== null ? round(ma[idx]!, params.decimals) : null,
    }));
    const sliced = series.slice(-TRAILING_WINDOW);
    const latest = sliced.at(-1);
    if (!latest) return null;

    const diffPct = latest.baseline && latest.baseline !== 0
        ? ((latest.value - latest.baseline) / latest.baseline) * 100
        : 0;
    const tone: 'up' | 'neutral' | 'down' =
        diffPct >= params.thresholdPct ? 'up' : diffPct <= -params.thresholdPct ? 'down' : 'neutral';

    return {
        id: params.id,
        name: params.name,
        subtitle: params.subtitle,
        latestLabel: latest.value.toFixed(params.decimals),
        baselineLabel: latest.baseline !== null
            ? `${params.maPeriod}DMA: ${latest.baseline.toFixed(params.decimals)} (${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}%)`
            : `${params.maPeriod}DMA unavailable`,
        tone,
        description: tone === 'up' ? params.positiveDesc : tone === 'down' ? params.negativeDesc : params.neutralDesc,
        points: sliced,
    };
}

function singleVsMaItem(params: {
    id: string;
    name: string;
    subtitle: string;
    chart: readonly ResearchChartPoint[];
    maPeriod: number;
    decimals: number;
    thresholdPct: number;
    invertTone?: boolean;
    positiveDesc: string;
    negativeDesc: string;
    neutralDesc: string;
}): MarketInternalItem | null {
    const valid = params.chart.filter(point => Number.isFinite(point.close) && point.close > 0);
    if (valid.length < 15) return null;

    const values = valid.map(point => point.close);
    const ma = rollingSma(values, params.maPeriod);
    const series: InternalPoint[] = valid.map((point, idx) => ({
        date: point.time,
        value: round(point.close, params.decimals),
        baseline: ma[idx] !== null ? round(ma[idx]!, params.decimals) : null,
    }));
    const sliced = series.slice(-TRAILING_WINDOW);
    const latest = sliced.at(-1);
    if (!latest) return null;

    const diffPct = latest.baseline && latest.baseline !== 0
        ? ((latest.value - latest.baseline) / latest.baseline) * 100
        : 0;
    let tone: 'up' | 'neutral' | 'down' =
        diffPct >= params.thresholdPct ? 'up' : diffPct <= -params.thresholdPct ? 'down' : 'neutral';
    if (params.invertTone && tone !== 'neutral') {
        tone = tone === 'up' ? 'down' : 'up';
    }

    return {
        id: params.id,
        name: params.name,
        subtitle: params.subtitle,
        latestLabel: latest.value.toFixed(params.decimals),
        baselineLabel: latest.baseline !== null
            ? `${params.maPeriod}DMA: ${latest.baseline.toFixed(params.decimals)} (${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}%)`
            : `${params.maPeriod}DMA unavailable`,
        tone,
        description: tone === 'up' ? params.positiveDesc : tone === 'down' ? params.negativeDesc : params.neutralDesc,
        points: sliced,
    };
}

function buildSafeHavenItem(
    spy: readonly ResearchChartPoint[],
    tlt: readonly ResearchChartPoint[],
): MarketInternalItem | null {
    const tltByDate = new Map(tlt.map(point => [point.time, point.close]));
    const aligned = spy.flatMap(point => {
        const tltClose = tltByDate.get(point.time);
        if (tltClose === undefined || tltClose <= 0 || point.close <= 0) return [];
        return [{ date: point.time, spy: point.close, tlt: tltClose }];
    });
    const lookback = 20;
    if (aligned.length <= lookback + 5) return null;

    const series: InternalPoint[] = [];
    for (let idx = lookback; idx < aligned.length; idx++) {
        const curr = aligned[idx];
        const prev = aligned[idx - lookback];
        const spyRet = ((curr.spy / prev.spy) - 1) * 100;
        const tltRet = ((curr.tlt / prev.tlt) - 1) * 100;
        series.push({
            date: curr.date,
            value: round(spyRet - tltRet, 2),
            baseline: 0,
        });
    }
    const sliced = series.slice(-TRAILING_WINDOW);
    const latest = sliced.at(-1);
    if (!latest) return null;

    const tone: 'up' | 'neutral' | 'down' =
        latest.value >= 1 ? 'up' : latest.value <= -1 ? 'down' : 'neutral';

    return {
        id: 'safe_haven',
        name: 'Safe-Haven Demand',
        subtitle: 'SPY vs TLT 20D relative return',
        latestLabel: `${latest.value >= 0 ? '+' : ''}${latest.value.toFixed(1)}%`,
        baselineLabel: 'Baseline: 0.0% neutral',
        tone,
        description: tone === 'up'
            ? 'Equities outperformed long Treasuries over the past 20 trading days.'
            : tone === 'down'
                ? 'Long Treasuries outperformed equities over the past 20 trading days as capital turned defensive.'
                : 'Stocks and long Treasuries performed roughly in line over the trailing 20 trading days.',
        points: sliced,
    };
}

async function computeUsInternals(): Promise<readonly MarketInternalItem[]> {
    const [spyRes, tltRes, hygRes, lqdRes, rspRes] = await Promise.allSettled([
        fetchYahooResearchChart('SPY', 'US', '1y'),
        fetchYahooResearchChart('TLT', 'US', '1y'),
        fetchYahooResearchChart('HYG', 'US', '1y'),
        fetchYahooResearchChart('LQD', 'US', '1y'),
        fetchYahooResearchChart('RSP', 'US', '1y'),
    ]);

    const spy = spyRes.status === 'fulfilled' ? spyRes.value.points : null;
    const tlt = tltRes.status === 'fulfilled' ? tltRes.value.points : null;
    const hyg = hygRes.status === 'fulfilled' ? hygRes.value.points : null;
    const lqd = lqdRes.status === 'fulfilled' ? lqdRes.value.points : null;
    const rsp = rspRes.status === 'fulfilled' ? rspRes.value.points : null;

    const items: MarketInternalItem[] = [];
    if (hyg && lqd) {
        const credit = ratioVsMaItem({
            id: 'credit',
            name: 'Credit Stress',
            subtitle: 'HYG / LQD ratio vs 50-day MA',
            numerator: hyg,
            denominator: lqd,
            maPeriod: 50,
            indexed: true,
            decimals: 1,
            thresholdPct: 0.4,
            positiveDesc: 'High-yield bonds outperformed investment-grade credit relative to their 50-day trend.',
            negativeDesc: 'High-yield bonds lagged investment-grade credit below the 50-day trend, signaling credit caution.',
            neutralDesc: 'High-yield vs investment-grade credit ratio sits close to its 50-day average.',
        });
        if (credit) items.push(credit);
    }

    if (rsp && spy) {
        const breadth = ratioVsMaItem({
            id: 'breadth',
            name: 'Equal-Weight Breadth',
            subtitle: 'RSP / SPY ratio vs 50-day MA',
            numerator: rsp,
            denominator: spy,
            maPeriod: 50,
            indexed: false,
            decimals: 3,
            thresholdPct: 0.5,
            positiveDesc: 'Equal-weight S&P 500 outperformed cap-weighted SPY above its 50-day average.',
            negativeDesc: 'Equal-weight S&P 500 lagged cap-weighted SPY below its 50-day average.',
            neutralDesc: 'Equal-weight vs cap-weight S&P participation is balanced near its 50-day average.',
        });
        if (breadth) items.push(breadth);
    }

    if (spy && tlt) {
        const safeHaven = buildSafeHavenItem(spy, tlt);
        if (safeHaven) items.push(safeHaven);
    }

    return items;
}

async function computeMyInternals(): Promise<readonly MarketInternalItem[]> {
    const [klciRes, myrRes, hygRes, lqdRes] = await Promise.allSettled([
        fetchYahooResearchChart('KLCI', 'MY', '1y'),
        fetchYahooResearchChart('MYR=X', 'US', '1y'),
        fetchYahooResearchChart('HYG', 'US', '1y'),
        fetchYahooResearchChart('LQD', 'US', '1y'),
    ]);

    const klci = klciRes.status === 'fulfilled' ? klciRes.value.points : null;
    const myr = myrRes.status === 'fulfilled' ? myrRes.value.points : null;
    const hyg = hygRes.status === 'fulfilled' ? hygRes.value.points : null;
    const lqd = lqdRes.status === 'fulfilled' ? lqdRes.value.points : null;

    const items: MarketInternalItem[] = [];
    if (klci) {
        const trend = singleVsMaItem({
            id: 'klci_trend',
            name: 'FBM KLCI Longer Trend',
            subtitle: 'Index close vs 125-day MA',
            chart: klci,
            maPeriod: 125,
            decimals: 0,
            thresholdPct: 1.0,
            positiveDesc: 'FBM KLCI is holding constructively above its 125-day trend baseline.',
            negativeDesc: 'FBM KLCI sits below its 125-day moving average.',
            neutralDesc: 'FBM KLCI is trading right around its 125-day moving average.',
        });
        if (trend) items.push(trend);
    }

    if (myr) {
        const fx = singleVsMaItem({
            id: 'myr_fx',
            name: 'Ringgit Stability (USD/MYR)',
            subtitle: 'Spot rate vs 50-day MA',
            chart: myr,
            maPeriod: 50,
            decimals: 3,
            thresholdPct: 0.5,
            invertTone: true,
            positiveDesc: 'MYR firmed against USD relative to its 50-day average.',
            negativeDesc: 'USD/MYR pushed above its 50-day average (softer ringgit backdrop).',
            neutralDesc: 'USD/MYR is holding steady near its 50-day moving average.',
        });
        if (fx) items.push(fx);
    }

    if (hyg && lqd) {
        const globalCredit = ratioVsMaItem({
            id: 'global_credit',
            name: 'US Credit Check (HYG / LQD)',
            subtitle: 'Global risk appetite vs 50-day MA',
            numerator: hyg,
            denominator: lqd,
            maPeriod: 50,
            indexed: true,
            decimals: 1,
            thresholdPct: 0.4,
            positiveDesc: 'Global US high-yield credit is supportive above its 50-day average.',
            negativeDesc: 'Global US high-yield credit is lagging investment grade, signaling external caution.',
            neutralDesc: 'Global US credit appetite is balanced near its 50-day trend.',
        });
        if (globalCredit) items.push(globalCredit);
    }

    return items;
}

export const GET = async (request: Request): Promise<NextResponse> => {
    const rawMarket = new URL(request.url).searchParams.get('market')?.toUpperCase();
    if (rawMarket !== 'US' && rawMarket !== 'MY') {
        return NextResponse.json({ success: false, error: 'Invalid market. Use US or MY.' }, { status: 400 });
    }

    const now = Date.now();
    const cached = cache.get(rawMarket);
    if (cached && cached.expiresAt > now) {
        return NextResponse.json({ success: true, data: cached.payload });
    }

    try {
        const items = rawMarket === 'MY' ? await computeMyInternals() : await computeUsInternals();
        const payload: MarketInternalsPayload = {
            market: rawMarket,
            available: items.length > 0,
            updatedAt: new Date(now).toISOString(),
            items,
        };
        if (items.length > 0) {
            cache.set(rawMarket, { payload, expiresAt: now + CACHE_TTL_MS });
        }
        return NextResponse.json({ success: true, data: payload });
    } catch {
        return NextResponse.json({
            success: true,
            data: { market: rawMarket, available: false, updatedAt: null, items: [] } satisfies MarketInternalsPayload,
        });
    }
};
