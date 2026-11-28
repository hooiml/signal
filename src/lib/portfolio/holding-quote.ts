import { normalizeCurrencyCode } from '../research/price-format';
import type { ResearchSnapshot } from '../types/research-snapshot';

export type PortfolioQuote = Pick<ResearchSnapshot['quote'], 'price' | 'currency'>;

export const portfolioCurrenciesMatch = (
    reported: string | null | undefined,
    declared: string | null | undefined,
): boolean => {
    const currency = reported && normalizeCurrencyCode(reported);
    return !!currency && !!declared && currency === normalizeCurrencyCode(declared);
};

export const holdingQuotePrice = (
    quote: PortfolioQuote | undefined,
    currency: string | null | undefined,
): number | null => quote && portfolioCurrenciesMatch(quote.currency, currency)
    && quote.price !== null && Number.isFinite(quote.price) && quote.price >= 0
    ? quote.price
    : null;
