import type { ResearchMarket } from './research';

export const portfolioHoldingSnapshotVersion = 1 as const;

export type PortfolioCurrency = 'USD' | 'MYR';

export type PortfolioImportedHolding = {
    readonly accountLabel: string;
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly quantity: number;
    readonly averageCost: number;
    readonly currency: PortfolioCurrency;
    readonly importedAt: string;
    readonly provenanceLabel: string;
};

export type PortfolioImportedCash = {
    readonly accountLabel: string;
    readonly currency: PortfolioCurrency;
    readonly balance: number;
    readonly importedAt: string;
    readonly provenanceLabel: string;
};

export type PortfolioHoldingsSnapshot = {
    readonly version: typeof portfolioHoldingSnapshotVersion;
    readonly updatedAt: string;
    readonly holdings: readonly PortfolioImportedHolding[];
    readonly cashBalances: readonly PortfolioImportedCash[];
};
