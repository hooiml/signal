import type { ResearchMarket } from '../types/research';

export const normalizeResearchListingSymbol = (symbol: string): string => symbol.trim().toUpperCase();

export const researchListingKey = (market: ResearchMarket, symbol: string): string =>
    `${market}:${normalizeResearchListingSymbol(symbol)}`;
