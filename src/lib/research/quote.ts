import type { ResearchMarket } from '../types/research';
import type { ResearchQuoteData } from '../types/research-quote';
import { fetchYahooQuote, toYahooSymbol } from './yahoo-research';

export const getResearchQuote = async (
    symbol: string,
    market: ResearchMarket,
): Promise<ResearchQuoteData> => ({
    symbol,
    market,
    providerSymbol: toYahooSymbol(symbol, market),
    fetchedAt: new Date().toISOString(),
    quote: await fetchYahooQuote(symbol, market),
});
