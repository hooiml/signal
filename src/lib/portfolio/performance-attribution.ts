import type {
    PortfolioCurrency,
    PortfolioHoldingsSnapshot,
} from '../types/portfolio-holdings';
import type { PortfolioTransactionSnapshot } from '../types/portfolio-transactions';
import type { PortfolioTransactionReconciliation } from './transaction-reconciliation';

export type CoveredAttributionUnavailableReason =
    | 'incomplete-transaction-history'
    | 'price-unavailable'
    | 'currency-conflict'
    | 'price-currency-mismatch';

export type CoveredHoldingAttribution = {
    readonly accountLabel: string;
    readonly market: 'US' | 'MY';
    readonly symbol: string;
    readonly currency: PortfolioCurrency;
    readonly quantity: number;
    readonly averageCost: number;
    readonly currentPrice: number | null;
    readonly costBasis: number | null;
    readonly marketValue: number | null;
    readonly unrealizedPriceContribution: number | null;
    readonly status: 'covered' | 'unavailable';
    readonly unavailableReason: CoveredAttributionUnavailableReason | null;
};

export type CoveredCurrencyAttribution = {
    readonly currency: PortfolioCurrency;
    readonly holdingsCovered: number;
    readonly holdingsTotal: number;
    readonly costBasisCovered: number;
    readonly marketValueCovered: number;
    readonly unrealizedPriceContribution: number;
    readonly dividends: number;
    readonly fees: number;
    readonly taxes: number;
    readonly saleTransactions: number;
    readonly realizedPriceContribution: null;
    readonly fxContribution: null;
};

export type CoveredPortfolioAttribution = {
    readonly holdings: readonly CoveredHoldingAttribution[];
    readonly currencies: readonly CoveredCurrencyAttribution[];
    readonly warnings: readonly string[];
};

const normalizedAccount = (value: string): string => value.trim().toLocaleLowerCase('en');
const holdingIdentity = (
    accountLabel: string,
    market: 'US' | 'MY',
    symbol: string,
    currency: PortfolioCurrency,
) => `${normalizedAccount(accountLabel)}:${market}:${symbol}:${currency}`;
const safeMoney = (value: number, label: string): number => {
    if (!Number.isFinite(value) || !Number.isSafeInteger(Math.round(value * 100))) {
        throw new Error(`${label} exceeds safe attribution precision.`);
    }
    return Number(value.toFixed(2));
};
const addMoney = (left: number, right: number, label: string): number =>
    safeMoney(left + right, label);

export const buildCoveredPortfolioAttribution = (
    holdings: PortfolioHoldingsSnapshot,
    transactions: PortfolioTransactionSnapshot,
    reconciliation: PortfolioTransactionReconciliation,
    prices: ReadonlyMap<string, number | null>,
): CoveredPortfolioAttribution => {
    const reconciliationByIdentity = new Map(reconciliation.positions.map((row) => [
        holdingIdentity(row.accountLabel, row.market, row.symbol, row.currency),
        row,
    ]));

    const holdingRows = holdings.holdings.map((holding): CoveredHoldingAttribution => {
        const reconciled = reconciliationByIdentity.get(
            holdingIdentity(holding.accountLabel, holding.market, holding.symbol, holding.currency),
        );
        const candidatePrice = prices.get(`${holding.market}:${holding.symbol}`) ?? null;
        const currentPrice = typeof candidatePrice === 'number'
            && Number.isFinite(candidatePrice)
            && candidatePrice >= 0
            ? candidatePrice
            : null;
        const expectedCurrency: PortfolioCurrency = holding.market === 'MY' ? 'MYR' : 'USD';
        const unavailableReason: CoveredAttributionUnavailableReason | null = !reconciled
            || reconciled.status !== 'match'
            ? 'incomplete-transaction-history'
            : reconciled.currencyConflict
                ? 'currency-conflict'
                : holding.currency !== expectedCurrency
                    ? 'price-currency-mismatch'
                    : currentPrice === null
                        ? 'price-unavailable'
                        : null;
        if (unavailableReason !== null || currentPrice === null) {
            return {
                ...holding,
                currentPrice,
                costBasis: null,
                marketValue: null,
                unrealizedPriceContribution: null,
                status: 'unavailable',
                unavailableReason,
            };
        }
        const costBasis = safeMoney(holding.quantity * holding.averageCost, 'Covered cost basis');
        const marketValue = safeMoney(holding.quantity * currentPrice, 'Covered market value');
        return {
            ...holding,
            currentPrice,
            costBasis,
            marketValue,
            unrealizedPriceContribution: safeMoney(
                marketValue - costBasis,
                'Unrealized price contribution',
            ),
            status: 'covered',
            unavailableReason: null,
        };
    }).sort((left, right) =>
        normalizedAccount(left.accountLabel).localeCompare(normalizedAccount(right.accountLabel))
        || left.currency.localeCompare(right.currency)
        || left.market.localeCompare(right.market)
        || left.symbol.localeCompare(right.symbol));

    const currencies = [...new Set<PortfolioCurrency>([
        ...holdings.holdings.map((holding) => holding.currency),
        ...transactions.transactions.map((transaction) => transaction.currency),
    ])].sort();
    const currencyRows = currencies.map((currency): CoveredCurrencyAttribution => {
        const currencyHoldings = holdingRows.filter((holding) => holding.currency === currency);
        const covered = currencyHoldings.filter((holding) => holding.status === 'covered');
        const currencyTransactions = transactions.transactions.filter(
            (transaction) => transaction.currency === currency,
        );
        const sumType = (type: 'dividend' | 'fee' | 'tax') =>
            currencyTransactions
                .filter((transaction) => transaction.type === type)
                .reduce((total, transaction) =>
                    addMoney(total, transaction.amount, `${type} total`), 0);
        return {
            currency,
            holdingsCovered: covered.length,
            holdingsTotal: currencyHoldings.length,
            costBasisCovered: covered.reduce(
                (total, holding) => addMoney(total, holding.costBasis ?? 0, 'Covered cost basis total'),
                0,
            ),
            marketValueCovered: covered.reduce(
                (total, holding) => addMoney(total, holding.marketValue ?? 0, 'Covered market value total'),
                0,
            ),
            unrealizedPriceContribution: covered.reduce(
                (total, holding) => addMoney(
                    total,
                    holding.unrealizedPriceContribution ?? 0,
                    'Unrealized contribution total',
                ),
                0,
            ),
            dividends: sumType('dividend'),
            fees: sumType('fee'),
            taxes: sumType('tax'),
            saleTransactions: currencyTransactions.filter((transaction) => transaction.type === 'sell').length,
            realizedPriceContribution: null,
            fxContribution: null,
        };
    });

    return {
        holdings: holdingRows,
        currencies: currencyRows,
        warnings: [
            'Unrealized price contribution is shown only when the accepted holdings quantity exactly reconciles with imported transactions and an exact current price is available.',
            'Average cost comes from the accepted holdings snapshot. It is not reconstructed as a tax lot or verified against broker statements.',
            'Dividends, fees, and taxes are explicit transaction amounts. They are shown separately and are not combined into a return percentage.',
            'Realized price contribution is unavailable because the current contract has no proven opening lots or tax-lot method.',
            'FX contribution is unavailable. USD and MYR remain separate because no explicit FX assumptions or approved FX provider exist.',
        ],
    };
};
