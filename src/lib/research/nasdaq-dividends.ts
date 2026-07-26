import {
    parseNasdaqDividendDiscovery,
} from '../portfolio/dividend-cashflow';
import type { NasdaqDividendDiscovery } from '../types/dividend-cashflow';
import { parsePortfolioSymbol } from '../portfolio/holdings';

export class NasdaqDividendUnavailableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NasdaqDividendUnavailableError';
    }
}

export const fetchNasdaqDividendDiscovery = async (symbolInput: string): Promise<NasdaqDividendDiscovery> => {
    const symbol = parsePortfolioSymbol(symbolInput);
    const response = await fetch(`https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/dividends?assetclass=stocks`, {
        headers: {
            Accept: 'application/json, text/plain, */*',
            Origin: 'https://www.nasdaq.com',
            Referer: 'https://www.nasdaq.com/',
            'User-Agent': 'Mozilla/5.0 Signal research dashboard',
        },
        signal: AbortSignal.timeout(8_000),
        next: { revalidate: 21_600 },
    });
    if (!response.ok) throw new NasdaqDividendUnavailableError(`Nasdaq dividend history failed (${response.status}).`);
    const discovery = parseNasdaqDividendDiscovery(await response.json(), symbol);
    if (discovery.events.length === 0) {
        throw new NasdaqDividendUnavailableError('Nasdaq returned no declared dividend events with usable dates.');
    }
    return discovery;
};
