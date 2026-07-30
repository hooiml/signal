import type {
    PortfolioCurrency,
    PortfolioHoldingsSnapshot,
} from '../types/portfolio-holdings';
import type {
    PortfolioTransaction,
    PortfolioTransactionSnapshot,
} from '../types/portfolio-transactions';
import type { ResearchMarket } from '../types/research';

export type PortfolioReconciliationStatus =
    | 'match'
    | 'difference'
    | 'missing-opening-balance'
    | 'transactions-only'
    | 'closed';

export type PortfolioPositionReconciliation = {
    readonly accountLabel: string;
    readonly market: ResearchMarket;
    readonly symbol: string;
    readonly currency: PortfolioCurrency;
    readonly holdingQuantity: number | null;
    readonly derivedQuantity: number;
    readonly differenceQuantity: number | null;
    readonly possibleOpeningQuantity: number | null;
    readonly transactionCount: number;
    readonly status: PortfolioReconciliationStatus;
    readonly currencyConflict: boolean;
};

export type PortfolioCashReconciliation = {
    readonly accountLabel: string;
    readonly currency: PortfolioCurrency;
    readonly snapshotBalance: number | null;
    readonly derivedBalance: number;
    readonly differenceBalance: number | null;
    readonly possibleOpeningBalance: number | null;
    readonly transactionCount: number;
    readonly status: PortfolioReconciliationStatus;
};

export type PortfolioTransactionReconciliation = {
    readonly positions: readonly PortfolioPositionReconciliation[];
    readonly cashBalances: readonly PortfolioCashReconciliation[];
    readonly dateRange: {
        readonly first: string;
        readonly last: string;
    } | null;
    readonly summary: {
        readonly matchedPositions: number;
        readonly incompletePositions: number;
        readonly transactionOnlyPositions: number;
        readonly closedPositions: number;
        readonly matchedCashBalances: number;
        readonly incompleteCashBalances: number;
        readonly transactionOnlyCashBalances: number;
    };
    readonly warnings: readonly string[];
};

type PositionAccumulator = {
    accountLabel: string;
    market: ResearchMarket;
    symbol: string;
    currency: PortfolioCurrency;
    holdingQuantity: number | null;
    derivedQuantity: number;
    transactionCount: number;
};

type CashAccumulator = {
    accountLabel: string;
    currency: PortfolioCurrency;
    snapshotBalance: number | null;
    derivedBalance: number;
    transactionCount: number;
};

const normalizedAccount = (value: string): string => value.trim().toLocaleLowerCase('en');
const positionKey = (
    accountLabel: string,
    market: ResearchMarket,
    symbol: string,
    currency: PortfolioCurrency,
) => `${normalizedAccount(accountLabel)}:${market}:${symbol}:${currency}`;
const securityKey = (accountLabel: string, market: ResearchMarket, symbol: string) =>
    `${normalizedAccount(accountLabel)}:${market}:${symbol}`;
const cashKey = (accountLabel: string, currency: PortfolioCurrency) =>
    `${normalizedAccount(accountLabel)}:${currency}`;
const safeRound = (value: number, precision: number, label: string): number => {
    const factor = 10 ** precision;
    if (!Number.isFinite(value) || !Number.isSafeInteger(Math.round(value * factor))) {
        throw new Error(`${label} exceeds safe reconciliation precision.`);
    }
    return Number(value.toFixed(precision));
};
const roundQuantity = (value: number): number => safeRound(value, 8, 'Quantity');
const roundMoney = (value: number): number => safeRound(value, 2, 'Cash amount');
const equalQuantity = (left: number, right: number): boolean =>
    Math.abs(roundQuantity(left - right)) === 0;
const equalMoney = (left: number, right: number): boolean =>
    Math.abs(roundMoney(left - right)) === 0;

const cashDirection = (transaction: PortfolioTransaction): number => {
    switch (transaction.type) {
        case 'buy':
        case 'fee':
        case 'tax':
        case 'withdrawal':
            return -transaction.amount;
        case 'sell':
        case 'dividend':
        case 'deposit':
            return transaction.amount;
    }
};

const positionStatus = (
    holdingQuantity: number | null,
    derivedQuantity: number,
    transactionCount: number,
): PortfolioReconciliationStatus => {
    if (holdingQuantity !== null) {
        if (transactionCount === 0) return 'missing-opening-balance';
        return equalQuantity(holdingQuantity, derivedQuantity) ? 'match' : 'difference';
    }
    if (equalQuantity(derivedQuantity, 0)) return 'closed';
    return derivedQuantity < 0 ? 'missing-opening-balance' : 'transactions-only';
};

const cashStatus = (
    snapshotBalance: number | null,
    derivedBalance: number,
    transactionCount: number,
): PortfolioReconciliationStatus => {
    if (snapshotBalance !== null) {
        if (transactionCount === 0) return 'missing-opening-balance';
        return equalMoney(snapshotBalance, derivedBalance) ? 'match' : 'difference';
    }
    if (equalMoney(derivedBalance, 0)) return 'closed';
    return derivedBalance < 0 ? 'missing-opening-balance' : 'transactions-only';
};

export const buildPortfolioTransactionReconciliation = (
    holdings: PortfolioHoldingsSnapshot,
    transactions: PortfolioTransactionSnapshot,
): PortfolioTransactionReconciliation => {
    const positions = new Map<string, PositionAccumulator>();
    const cashBalances = new Map<string, CashAccumulator>();
    const currenciesBySecurity = new Map<string, Set<PortfolioCurrency>>();

    for (const holding of holdings.holdings) {
        const key = positionKey(holding.accountLabel, holding.market, holding.symbol, holding.currency);
        positions.set(key, {
            accountLabel: holding.accountLabel,
            market: holding.market,
            symbol: holding.symbol,
            currency: holding.currency,
            holdingQuantity: holding.quantity,
            derivedQuantity: 0,
            transactionCount: 0,
        });
        const currencies = currenciesBySecurity.get(securityKey(holding.accountLabel, holding.market, holding.symbol))
            ?? new Set<PortfolioCurrency>();
        currencies.add(holding.currency);
        currenciesBySecurity.set(securityKey(holding.accountLabel, holding.market, holding.symbol), currencies);
    }

    for (const cash of holdings.cashBalances) {
        cashBalances.set(cashKey(cash.accountLabel, cash.currency), {
            accountLabel: cash.accountLabel,
            currency: cash.currency,
            snapshotBalance: cash.balance,
            derivedBalance: 0,
            transactionCount: 0,
        });
    }

    for (const transaction of transactions.transactions) {
        const cashIdentity = cashKey(transaction.accountLabel, transaction.currency);
        const cash = cashBalances.get(cashIdentity) ?? {
            accountLabel: transaction.accountLabel,
            currency: transaction.currency,
            snapshotBalance: null,
            derivedBalance: 0,
            transactionCount: 0,
        };
        cash.derivedBalance = roundMoney(cash.derivedBalance + cashDirection(transaction));
        cash.transactionCount += 1;
        cashBalances.set(cashIdentity, cash);

        if ((transaction.type !== 'buy' && transaction.type !== 'sell')
            || transaction.market === null
            || transaction.symbol === null
            || transaction.quantity === null) {
            continue;
        }
        const identity = positionKey(
            transaction.accountLabel,
            transaction.market,
            transaction.symbol,
            transaction.currency,
        );
        const position = positions.get(identity) ?? {
            accountLabel: transaction.accountLabel,
            market: transaction.market,
            symbol: transaction.symbol,
            currency: transaction.currency,
            holdingQuantity: null,
            derivedQuantity: 0,
            transactionCount: 0,
        };
        position.derivedQuantity = roundQuantity(
            position.derivedQuantity + (transaction.type === 'buy' ? transaction.quantity : -transaction.quantity),
        );
        position.transactionCount += 1;
        positions.set(identity, position);
        const exactSecurityKey = securityKey(transaction.accountLabel, transaction.market, transaction.symbol);
        const currencies = currenciesBySecurity.get(exactSecurityKey) ?? new Set<PortfolioCurrency>();
        currencies.add(transaction.currency);
        currenciesBySecurity.set(exactSecurityKey, currencies);
    }

    const positionRows = [...positions.values()].map((position): PortfolioPositionReconciliation => {
        const status = positionStatus(
            position.holdingQuantity,
            position.derivedQuantity,
            position.transactionCount,
        );
        const differenceQuantity = position.holdingQuantity === null
            ? null
            : roundQuantity(position.holdingQuantity - position.derivedQuantity);
        return {
            ...position,
            differenceQuantity,
            possibleOpeningQuantity: position.holdingQuantity !== null
                ? differenceQuantity
                : position.derivedQuantity < 0
                    ? roundQuantity(-position.derivedQuantity)
                    : null,
            status,
            currencyConflict: (currenciesBySecurity.get(
                securityKey(position.accountLabel, position.market, position.symbol),
            )?.size ?? 0) > 1,
        };
    }).sort((left, right) =>
        normalizedAccount(left.accountLabel).localeCompare(normalizedAccount(right.accountLabel))
        || left.currency.localeCompare(right.currency)
        || left.market.localeCompare(right.market)
        || left.symbol.localeCompare(right.symbol));

    const cashRows = [...cashBalances.values()].map((cash): PortfolioCashReconciliation => {
        const status = cashStatus(cash.snapshotBalance, cash.derivedBalance, cash.transactionCount);
        const differenceBalance = cash.snapshotBalance === null
            ? null
            : roundMoney(cash.snapshotBalance - cash.derivedBalance);
        return {
            ...cash,
            differenceBalance,
            possibleOpeningBalance: cash.snapshotBalance !== null
                ? differenceBalance
                : cash.derivedBalance < 0
                    ? roundMoney(-cash.derivedBalance)
                    : null,
            status,
        };
    }).sort((left, right) =>
        normalizedAccount(left.accountLabel).localeCompare(normalizedAccount(right.accountLabel))
        || left.currency.localeCompare(right.currency));

    const dates = transactions.transactions.map((transaction) => transaction.occurredOn).sort();
    const incompleteStatuses = new Set<PortfolioReconciliationStatus>([
        'difference',
        'missing-opening-balance',
    ]);
    const currencyConflicts = positionRows.filter((row) => row.currencyConflict).length;

    return {
        positions: positionRows,
        cashBalances: cashRows,
        dateRange: dates.length > 0 ? { first: dates[0]!, last: dates[dates.length - 1]! } : null,
        summary: {
            matchedPositions: positionRows.filter((row) => row.status === 'match').length,
            incompletePositions: positionRows.filter((row) => incompleteStatuses.has(row.status)).length,
            transactionOnlyPositions: positionRows.filter((row) => row.status === 'transactions-only').length,
            closedPositions: positionRows.filter((row) => row.status === 'closed').length,
            matchedCashBalances: cashRows.filter((row) => row.status === 'match').length,
            incompleteCashBalances: cashRows.filter((row) => incompleteStatuses.has(row.status)).length,
            transactionOnlyCashBalances: cashRows.filter((row) => row.status === 'transactions-only').length,
        },
        warnings: [
            'Derived values cover only the imported transaction date range. Differences may require an opening quantity or cash balance from earlier history.',
            'Buy amounts reduce cash; sells, dividends, and deposits increase cash; fees, taxes, and withdrawals reduce cash. Signal does not infer whether broker amounts are gross or net.',
            'Splits, mergers, transfers, reinvestments, currency conversion, and other corporate actions are unsupported and can make reconciliation incomplete.',
            ...(currencyConflicts > 0
                ? [`${currencyConflicts} position row${currencyConflicts === 1 ? '' : 's'} has a currency conflict. Currencies remain separate.`]
                : []),
        ],
    };
};
