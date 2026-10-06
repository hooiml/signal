import { unstable_cache } from 'next/cache';
import { searchSecurities } from './security-search';
import { toYahooSymbol } from './yahoo-research';
import type { ResearchMarket } from '../types/research';
import type { ResearchSnapshot } from '../types/research-snapshot';

/** Resolve metadata server-side by exact provider identity, never by a name or browser selection. */
export const getSecurityClassification = unstable_cache(async (
    symbol: string, market: ResearchMarket,
): Promise<ResearchSnapshot['quote']['classification']> => {
    const canonical = toYahooSymbol(symbol, market).toUpperCase();
    const rows = await searchSecurities(canonical, market);
    const match = rows.find(row => row.symbol === canonical);
    if (!match) return null;
    return { source: 'Yahoo Finance', instrumentType: match.instrumentType, sector: match.sector,
        industry: match.industry, retrievedAt: new Date().toISOString() };
}, ['research-security-classification-v1'], { revalidate: 86400 });
