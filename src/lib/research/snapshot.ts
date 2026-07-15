import type { ResearchMarket } from '@/lib/types/research';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import { buildResearchBenchmark, notApplicableResearchBenchmark } from './benchmark';
import { fetchSecFundamentals } from './sec-edgar';
import { fetchYahooResearch } from './yahoo-research';
import { calculateValuation } from './valuation';

const emptyFundamentals: ResearchSnapshot['fundamentals'] = {
    revenueGrowthPercent: null, grossMarginPercent: null, operatingMarginPercent: null,
    freeCashFlow: null, debt: null, cash: null, shares: null,
    annualRevenue: null, annualNetIncome: null, reportingPeriod: null, shareChangePercent: null,
};

const message = (error: unknown) => error instanceof Error ? error.message : 'Unknown provider error.';

export const getResearchSnapshot = async (symbol: string, market: ResearchMarket): Promise<ResearchSnapshot> => {
    const yahooPromise = fetchYahooResearch(symbol, market);
    const secPromise = market === 'US' ? fetchSecFundamentals(symbol) : Promise.resolve(null);
    const benchmarkPromise = market === 'US' && symbol !== 'VOO' ? fetchYahooResearch('VOO', 'US') : Promise.resolve(null);
    const [yahoo, sec, benchmark] = await Promise.allSettled([yahooPromise, secPromise, benchmarkPromise]);
    if (yahoo.status === 'rejected' && sec.status === 'rejected') throw new Error(`Free data sources unavailable: ${message(yahoo.reason)} ${message(sec.reason)}`);

    const warnings: string[] = [];
    if (yahoo.status === 'rejected') warnings.push(message(yahoo.reason));
    if (market === 'MY') warnings.push('Free Bursa fundamentals are unavailable; technical data is from Yahoo Finance.');
    if (market === 'US' && sec.status === 'rejected') warnings.push(message(sec.reason));
    if (market === 'US' && symbol !== 'VOO' && benchmark.status === 'rejected') warnings.push('Passive benchmark data is temporarily unavailable.');
    const yahooData = yahoo.status === 'fulfilled' ? yahoo.value : null;
    const secData = sec.status === 'fulfilled' ? sec.value : null;
    const benchmarkData = symbol === 'VOO'
        ? yahooData
        : benchmark.status === 'fulfilled' ? benchmark.value : null;
    const fundamentals = secData ?? emptyFundamentals;
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
            source: yahooData && secData ? 'Yahoo Finance + SEC EDGAR' : null,
        },
        technicals: yahooData?.technicals ?? {
            ma50: null, ma200: null, rsi14: null, macd: null, low52Week: null, high52Week: null,
            averageVolume20: null, support: null, resistance: null,
        },
        sources: [yahooData ? 'Yahoo Finance' : null, secData ? 'SEC EDGAR' : null].filter((source): source is string => source !== null),
        warnings,
    };
};
