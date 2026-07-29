import type { ResearchMarket } from './research';
import type { PortfolioCurrency } from './portfolio-holdings';

export const portfolioTransactionSnapshotVersion = 1 as const;

export const portfolioTransactionTypes = [
    'buy',
    'sell',
    'dividend',
    'fee',
    'tax',
    'deposit',
    'withdrawal',
] as const;

export type PortfolioTransactionType = typeof portfolioTransactionTypes[number];

export type PortfolioTransaction = {
    readonly id: string;
    readonly accountLabel: string;
    readonly type: PortfolioTransactionType;
    readonly occurredOn: string;
    readonly market: ResearchMarket | null;
    readonly symbol: string | null;
    readonly quantity: number | null;
    readonly amount: number;
    readonly currency: PortfolioCurrency;
    readonly importedAt: string;
    readonly provenanceLabel: string;
};

export type PortfolioTransactionSnapshot = {
    readonly version: typeof portfolioTransactionSnapshotVersion;
    readonly updatedAt: string;
    readonly transactions: readonly PortfolioTransaction[];
};
