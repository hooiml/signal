import type { ResearchMarket } from './research';
import type { PortfolioCurrency } from './portfolio-holdings';

export const dividendCashFlowSnapshotVersion = 1 as const;
export const dividendCashFlowCategories = [
    'contribution',
    'withdrawal',
    'fee',
    'tax',
    'interest',
    'other',
] as const;

export type DividendCashFlowCategory = typeof dividendCashFlowCategories[number];
export type DividendCashFlowDirection = 'inflow' | 'outflow';
export type DividendEventStatus = 'declared' | 'confirmed';

export type NasdaqDividendEvidence = {
    readonly providerEventId: string;
    readonly provider: 'Nasdaq dividends';
    readonly sourceUrl: string;
    readonly fetchedAt: string;
    readonly status: 'declared';
    readonly declarationDate: string | null;
    readonly recordDate: string | null;
    readonly exDate: string | null;
    readonly paymentDate: string | null;
    readonly amountPerShare: number | null;
    readonly currency: PortfolioCurrency;
};

type DividendCashFlowEventBase = {
    readonly id: string;
    readonly revision: number;
    readonly accountLabel: string;
    readonly currency: PortfolioCurrency;
    readonly notes: string;
    readonly createdAt: string;
    readonly updatedAt: string;
};

export type DividendPlanningEvent = DividendCashFlowEventBase & {
    readonly kind: 'dividend';
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly status: DividendEventStatus;
    readonly declarationDate: string | null;
    readonly recordDate: string | null;
    readonly exDate: string | null;
    readonly paymentDate: string | null;
    readonly amountPerShare: number | null;
    readonly source: 'user-entered' | 'provider-confirmed';
    readonly providerEvidence: NasdaqDividendEvidence | null;
};

export type CashFlowPlanningEvent = DividendCashFlowEventBase & {
    readonly kind: 'cash-flow';
    readonly category: DividendCashFlowCategory;
    readonly status: 'planned';
    readonly plannedDate: string;
    readonly direction: DividendCashFlowDirection;
    readonly amount: number;
    readonly source: 'user-entered';
};

export type DividendCashFlowEvent = DividendPlanningEvent | CashFlowPlanningEvent;

export type DividendCashFlowRevision = {
    readonly snapshotRevision: number;
    readonly eventId: string;
    readonly eventRevision: number;
    readonly changedAt: string;
    readonly change: 'created' | 'updated' | 'removed';
    readonly previous: DividendCashFlowEvent | null;
};

export type DividendCashFlowSnapshot = {
    readonly version: typeof dividendCashFlowSnapshotVersion;
    readonly revision: number;
    readonly updatedAt: string;
    readonly events: readonly DividendCashFlowEvent[];
    readonly history: readonly DividendCashFlowRevision[];
};

export type NasdaqDividendEvent = {
    readonly providerEventId: string;
    readonly symbol: string;
    readonly market: 'US';
    readonly status: 'declared';
    readonly declarationDate: string | null;
    readonly recordDate: string | null;
    readonly exDate: string | null;
    readonly paymentDate: string | null;
    readonly amountPerShare: number | null;
    readonly currency: PortfolioCurrency;
    readonly provider: 'Nasdaq dividends';
    readonly sourceUrl: string;
    readonly fetchedAt: string;
};

export type NasdaqDividendDiscovery = {
    readonly symbol: string;
    readonly market: 'US';
    readonly fetchedAt: string;
    readonly provider: 'Nasdaq dividends';
    readonly sourceUrl: string;
    readonly events: readonly NasdaqDividendEvent[];
};
