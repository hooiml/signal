'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import {
    loadPortfolioHoldingsSnapshot,
    PORTFOLIO_HOLDINGS_CHANGE_EVENT,
    PORTFOLIO_HOLDINGS_STORAGE_KEY,
    type PortfolioHoldingsLoadResult,
} from '@/lib/portfolio/holdings-client';
import { buildCoveredPortfolioAttribution } from '@/lib/portfolio/performance-attribution';
import { buildPortfolioTransactionReconciliation } from '@/lib/portfolio/transaction-reconciliation';
import {
    loadPortfolioTransactionSnapshot,
    PORTFOLIO_TRANSACTIONS_CHANGE_EVENT,
    PORTFOLIO_TRANSACTIONS_STORAGE_KEY,
    type PortfolioTransactionsLoadResult,
} from '@/lib/portfolio/transactions-client';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type HoldingsState = { readonly status: 'loading'; readonly snapshot: null } | PortfolioHoldingsLoadResult;
type TransactionsState = { readonly status: 'loading'; readonly snapshot: null } | PortfolioTransactionsLoadResult;

const formatMoney = (value: number, currency: string) =>
    new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
const reasonLabel = {
    'incomplete-transaction-history': 'Transaction history does not reconcile',
    'price-unavailable': 'Current price unavailable',
    'currency-conflict': 'Currency conflict',
    'price-currency-mismatch': 'Price currency does not match holding',
} as const;

export const PortfolioCoveredAttributionV6 = ({ items, theme }: {
    readonly items: readonly ResearchWatchlistItem[];
    readonly theme: ResearchThemeV6;
}) => {
    const [holdings, setHoldings] = useState<HoldingsState>({ status: 'loading', snapshot: null });
    const [transactions, setTransactions] = useState<TransactionsState>({ status: 'loading', snapshot: null });
    const styles = getThemeV6(theme);
    const prices = useMemo(() => new Map(items.map((item) => [
        `${item.market}:${item.symbol}`,
        typeof item.price === 'number' ? item.price : null,
    ])), [items]);

    useEffect(() => {
        const restoreHoldings = () => setHoldings(loadPortfolioHoldingsSnapshot());
        const restoreTransactions = () => setTransactions(loadPortfolioTransactionSnapshot());
        const onStorage = (event: StorageEvent) => {
            if (event.key === PORTFOLIO_HOLDINGS_STORAGE_KEY) restoreHoldings();
            if (event.key === PORTFOLIO_TRANSACTIONS_STORAGE_KEY) restoreTransactions();
        };
        const timer = window.setTimeout(() => {
            restoreHoldings();
            restoreTransactions();
        }, 0);
        window.addEventListener('storage', onStorage);
        window.addEventListener(PORTFOLIO_HOLDINGS_CHANGE_EVENT, restoreHoldings);
        window.addEventListener(PORTFOLIO_TRANSACTIONS_CHANGE_EVENT, restoreTransactions);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('storage', onStorage);
            window.removeEventListener(PORTFOLIO_HOLDINGS_CHANGE_EVENT, restoreHoldings);
            window.removeEventListener(PORTFOLIO_TRANSACTIONS_CHANGE_EVENT, restoreTransactions);
        };
    }, []);

    const result = useMemo(() => {
        if (holdings.status !== 'ready' || transactions.status !== 'ready') {
            return { attribution: null, error: null };
        }
        try {
            const reconciliation = buildPortfolioTransactionReconciliation(
                holdings.snapshot,
                transactions.snapshot,
            );
            return {
                attribution: buildCoveredPortfolioAttribution(
                    holdings.snapshot,
                    transactions.snapshot,
                    reconciliation,
                    prices,
                ),
                error: null,
            };
        } catch (error) {
            return {
                attribution: null,
                error: error instanceof Error ? error.message : 'Covered attribution could not be calculated safely.',
            };
        }
    }, [holdings, prices, transactions]);
    const sourceMessages = [
        holdings.status === 'invalid' || holdings.status === 'unavailable' ? holdings.message : null,
        transactions.status === 'invalid' || transactions.status === 'unavailable' ? transactions.message : null,
    ].filter((message): message is string => message !== null);

    return (
        <section className={'mt-5 rounded-lg border p-4 ' + styles.panelSecondary} aria-labelledby="portfolio-covered-attribution-title" data-testid="portfolio-covered-attribution">
            <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + styles.positive}>Covered attribution · evidence limited</p>
            <h2 id="portfolio-covered-attribution-title" className={'mt-1 text-base font-bold ' + styles.textPrimary}>Explain covered portfolio contributions</h2>
            <p className={'mt-1 max-w-3xl text-xs leading-5 ' + styles.textMuted}>
                This view reports only contribution that the accepted local snapshots and exact current prices can support. It is not a return calculation, brokerage statement, tax result, forecast, or recommendation.
            </p>

            {holdings.status === 'loading' || transactions.status === 'loading' ? (
                <p className={'mt-4 text-sm ' + styles.textMuted} role="status">Restoring local evidence…</p>
            ) : sourceMessages.length > 0 ? (
                <div className={'mt-4 rounded-md border p-3 text-sm ' + styles.risk} role="alert">
                    {sourceMessages.map((message) => <p key={message}>{message}</p>)}
                </div>
            ) : holdings.status === 'empty' || transactions.status === 'empty' ? (
                <div className={'mt-4 rounded-md border p-4 ' + styles.panelUtility}>
                    <p className={'text-sm font-semibold ' + styles.textPrimary}>Holdings and transactions are both required</p>
                    <p className={'mt-1 text-xs ' + styles.textMuted}>Import both local snapshots above before calculating covered contribution.</p>
                </div>
            ) : result.error ? (
                <div className={'mt-4 rounded-md border p-3 text-sm ' + styles.risk} role="alert">{result.error}</div>
            ) : result.attribution ? (
                <>
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        {result.attribution.currencies.map((row) => (
                            <section key={row.currency} className={'rounded-md border p-4 ' + styles.panelUtility} aria-label={`${row.currency} covered attribution`}>
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className={'text-sm font-bold ' + styles.textPrimary}>{row.currency}</h3>
                                    <span className={'text-xs ' + styles.textMuted}>{row.holdingsCovered}/{row.holdingsTotal} holdings covered</span>
                                </div>
                                <dl className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                    {[
                                        ['Unrealized price', formatMoney(row.unrealizedPriceContribution, row.currency)],
                                        ['Dividends', formatMoney(row.dividends, row.currency)],
                                        ['Fees', formatMoney(row.fees, row.currency)],
                                        ['Taxes', formatMoney(row.taxes, row.currency)],
                                        ['Realized price', 'Unavailable'],
                                        ['FX contribution', 'Unavailable'],
                                    ].map(([label, value]) => (
                                        <div key={label}>
                                            <dt className={'text-[11px] ' + styles.textMuted}>{label}</dt>
                                            <dd className={'mt-1 font-mono text-sm font-bold ' + styles.textPrimary}>{value}</dd>
                                        </div>
                                    ))}
                                </dl>
                                {row.saleTransactions > 0 ? <p className={'mt-3 text-[11px] ' + styles.risk}>{row.saleTransactions} sale transaction{row.saleTransactions === 1 ? '' : 's'} excluded from realized contribution.</p> : null}
                            </section>
                        ))}
                    </div>

                    <div className="research-scrollbar mt-4 overflow-x-auto rounded-md border">
                        <table className="w-full min-w-[940px] text-left text-xs [&_td]:px-3 [&_th]:px-3">
                            <caption className={'p-3 text-left font-semibold ' + styles.textSecondary}>Holding-level unrealized price coverage</caption>
                            <thead className={styles.panelSolid}>
                                <tr className={styles.textMuted}>
                                    <th className="py-2">Account</th><th className="py-2">Security</th><th className="py-2">Currency</th>
                                    <th className="py-2 text-right">Cost basis</th><th className="py-2 text-right">Known value</th>
                                    <th className="py-2 text-right">Contribution</th><th className="py-2">Coverage</th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.attribution.holdings.map((row) => (
                                    <tr key={`${row.accountLabel}:${row.market}:${row.symbol}:${row.currency}`} className={'border-t ' + styles.divider}>
                                        <td className="py-2">{row.accountLabel}</td>
                                        <th className="py-2 font-mono">{row.market}:{row.symbol}</th>
                                        <td className="py-2 font-mono">{row.currency}</td>
                                        <td className="py-2 text-right font-mono">{row.costBasis === null ? 'Unavailable' : formatMoney(row.costBasis, row.currency)}</td>
                                        <td className="py-2 text-right font-mono">{row.marketValue === null ? 'Unavailable' : formatMoney(row.marketValue, row.currency)}</td>
                                        <td className="py-2 text-right font-mono">{row.unrealizedPriceContribution === null ? 'Unavailable' : formatMoney(row.unrealizedPriceContribution, row.currency)}</td>
                                        <td className={'py-2 font-semibold ' + (row.status === 'covered' ? styles.positive : styles.risk)}>
                                            {row.status === 'covered' ? 'Covered' : reasonLabel[row.unavailableReason!]}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className={'mt-4 rounded-md border p-3 ' + styles.panelUtility}>
                        <p className={'text-xs font-semibold ' + styles.textPrimary}>Coverage limitations</p>
                        <ul className={'mt-2 list-disc space-y-1 pl-5 text-xs leading-5 ' + styles.textMuted}>
                            {result.attribution.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                        </ul>
                    </div>
                </>
            ) : null}
        </section>
    );
};
