import type { ResearchMarket } from '@/lib/types/research';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import { buildResearchBenchmark, notApplicableResearchBenchmark } from './benchmark';
import { fetchSecFundamentals } from './sec-edgar';
import { fetchYahooResearch } from './yahoo-research';
import { fetchYahooFundamentalHistory } from './yahoo-fundamentals';
import { calculateValuation } from './valuation';

const emptyFundamentals: ResearchSnapshot['fundamentals'] = {
    revenueGrowthPercent: null, grossMarginPercent: null, operatingMarginPercent: null,
    freeCashFlow: null, debt: null, cash: null, shares: null,
    annualRevenue: null, annualNetIncome: null, reportingPeriod: null, shareChangePercent: null,
    source: null, history: [],
};

const fundamentalsFromHistory = (
    history: ResearchSnapshot['fundamentals']['history'],
): ResearchSnapshot['fundamentals'] => {
    const latest = history[0];
    if (!latest) return emptyFundamentals;
    return {
        revenueGrowthPercent: latest.revenueGrowthPercent,
        grossMarginPercent: latest.grossMarginPercent,
        operatingMarginPercent: latest.operatingMarginPercent,
        freeCashFlow: latest.freeCashFlow,
        debt: latest.debt,
        cash: latest.cash,
        shares: latest.shares,
        annualRevenue: latest.annualRevenue,
        annualNetIncome: latest.annualNetIncome,
        reportingPeriod: latest.reportingPeriod,
        shareChangePercent: latest.shareChangePercent,
        source: latest.source,
        history,
    };
};

const message = (error: unknown) => error instanceof Error ? error.message : 'Unknown provider error.';

export const getResearchSnapshot = async (symbol: string, market: ResearchMarket): Promise<ResearchSnapshot> => {
    const yahooPromise = fetchYahooResearch(symbol, market);
    const fundamentalsPromise: Promise<ResearchSnapshot['fundamentals']> = market === 'US'
        ? fetchSecFundamentals(symbol)
        : fetchYahooFundamentalHistory(symbol, market).then(fundamentalsFromHistory);
    const benchmarkPromise = market === 'US' && symbol !== 'VOO' ? fetchYahooResearch('VOO', 'US') : Promise.resolve(null);
    const [yahoo, fundamentalResult, benchmark] = await Promise.allSettled([yahooPromise, fundamentalsPromise, benchmarkPromise]);
    if (yahoo.status === 'rejected' && fundamentalResult.status === 'rejected') throw new Error(`Free data sources unavailable: ${message(yahoo.reason)} ${message(fundamentalResult.reason)}`);

    const warnings: string[] = [];
    if (yahoo.status === 'rejected') warnings.push(message(yahoo.reason));
    if (fundamentalResult.status === 'rejected') warnings.push(message(fundamentalResult.reason));
    if (market === 'US' && symbol !== 'VOO' && benchmark.status === 'rejected') warnings.push('Passive benchmark data is temporarily unavailable.');
    const yahooData = yahoo.status === 'fulfilled' ? yahoo.value : null;
    const fundamentals = fundamentalResult.status === 'fulfilled' ? fundamentalResult.value : emptyFundamentals;
    if (fundamentalResult.status === 'fulfilled' && fundamentals.history.length === 0) warnings.push('Annual fundamental history is unavailable from the connected free source.');
    const benchmarkData = symbol === 'VOO'
        ? yahooData
        : benchmark.status === 'fulfilled' ? benchmark.value : null;
    const valuation = calculateValuation({
        price: yahooData?.price ?? null,
        shares: fundamentals.shares,
        annualRevenue: fundamentals.annualRevenue,
        annualNetIncome: fundamentals.annualNetIncome,
        freeCashFlow: fundamentals.freeCashFlow,
        debt: fundamentals.debt,
        cash: fundamentals.cash,
    });
    return {
        symbol,
        market,
        fetchedAt: new Date().toISOString(),
        benchmark: market === 'US' ? buildResearchBenchmark(yahooData, benchmarkData) : notApplicableResearchBenchmark,
        quote: {
            name: yahooData?.name ?? null,
            currency: yahooData?.currency ?? null,
            price: yahooData?.price ?? null,
            dailyChangePercent: yahooData?.dailyChangePercent ?? null,
        },
        fundamentals,
        valuation: {
            ...valuation,
            reportingPeriod: fundamentals.reportingPeriod,
            source: yahooData && fundamentals.source
                ? fundamentals.source === 'SEC EDGAR' ? 'Yahoo Finance + SEC EDGAR' : 'Yahoo Finance'
                : null,
        },
        technicals: yahooData?.technicals ?? {
            ma50: null, ma200: null, rsi14: null, macd: null, low52Week: null, high52Week: null,
            averageVolume20: null, support: null, resistance: null,
        },
        chart: yahooData?.chart ?? { interval: '1d', points: [] },
        sources: [...new Set([
            yahooData ? 'Yahoo Finance' : null,
            fundamentals.source,
        ].filter((source): source is string => source !== null))],
        warnings,
    };
};
