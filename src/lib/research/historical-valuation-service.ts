import { unstable_cache } from 'next/cache';
import type { ResearchMarket } from '../types/research';
import type { HistoricalValuationReport } from '../types/historical-valuation';
import { buildHistoricalValuationReport } from './historical-valuation';
import { fetchSecCompanyFactsDocument } from './sec-edgar';
import { fetchYahooChartPayload, toYahooSymbol } from './yahoo-research';

const message = (reason: unknown) => reason instanceof Error ? reason.message : 'Unknown provider failure.';

const fetchHistoricalValuationReport = async (
    symbol: string,
    market: ResearchMarket,
): Promise<HistoricalValuationReport> => {
    if (market !== 'US') {
        return buildHistoricalValuationReport({
            symbol,
            market,
            cik: null,
            companyName: null,
            companyFacts: null,
            chartPayload: null,
        });
    }
    const [sec, prices] = await Promise.allSettled([
        fetchSecCompanyFactsDocument(symbol),
        fetchYahooChartPayload(toYahooSymbol(symbol, market), '10y', true),
    ]);
    if (sec.status === 'rejected' && prices.status === 'rejected') {
        throw new Error(`Historical valuation providers are unavailable. SEC: ${message(sec.reason)} Prices: ${message(prices.reason)}`);
    }
    return buildHistoricalValuationReport({
        symbol,
        market,
        cik: sec.status === 'fulfilled' ? sec.value.cik : null,
        companyName: sec.status === 'fulfilled' ? sec.value.title : null,
        companyFacts: sec.status === 'fulfilled' ? sec.value.payload : null,
        chartPayload: prices.status === 'fulfilled' ? prices.value : null,
        secError: sec.status === 'rejected' ? `SEC Company Facts unavailable: ${message(sec.reason)}` : null,
        priceError: prices.status === 'rejected' ? `Historical prices unavailable: ${message(prices.reason)}` : null,
    });
};

export const getHistoricalValuationReport = unstable_cache(
    fetchHistoricalValuationReport,
    ['historical-valuation-v1'],
    { revalidate: 21_600 },
);
