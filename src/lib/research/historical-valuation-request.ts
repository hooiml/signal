import type { ResearchMarket } from '../types/research';

export class HistoricalValuationRequestError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'HistoricalValuationRequestError';
    }
}

export const parseHistoricalValuationRequest = (
    rawSymbol: string,
    rawMarket: string | null,
): { readonly symbol: string; readonly market: ResearchMarket } => {
    const symbol = rawSymbol.trim().toUpperCase();
    if (!/^[A-Z0-9.-]{1,15}$/.test(symbol)) throw new HistoricalValuationRequestError('Invalid symbol.');
    if (rawMarket !== 'US' && rawMarket !== 'MY') throw new HistoricalValuationRequestError('Invalid market. Use US or MY.');
    return { symbol, market: rawMarket };
};
