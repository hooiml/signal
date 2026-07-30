'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import {
    loadPortfolioHoldingsSnapshot,
    PORTFOLIO_HOLDINGS_CHANGE_EVENT,
    PORTFOLIO_HOLDINGS_STORAGE_KEY,
    type PortfolioHoldingsLoadResult,
} from '@/lib/portfolio/holdings-client';
import {
    buildPortfolioTransactionReconciliation,
    type PortfolioReconciliationStatus,
} from '@/lib/portfolio/transaction-reconciliation';
import {
    loadPortfolioTransactionSnapshot,
    PORTFOLIO_TRANSACTIONS_CHANGE_EVENT,
    PORTFOLIO_TRANSACTIONS_STORAGE_KEY,
    type PortfolioTransactionsLoadResult,
} from '@/lib/portfolio/transactions-client';
import { enqueueResearchWorkflowTaskClient } from '@/lib/research/workflow-queue-client';
import { trackProductAnalyticsEvent } from '@/lib/product-analytics-client';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type HoldingsState =
    | { readonly status: 'loading'; readonly snapshot: null }
    | PortfolioHoldingsLoadResult;
type TransactionsState =
    | { readonly status: 'loading'; readonly snapshot: null }
    | PortfolioTransactionsLoadResult;

const formatMoney = (value: number, currency: string) =>
    new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

const statusLabel: Readonly<Record<PortfolioReconciliationStatus, string>> = {
    match: 'Match',
    difference: 'Difference',
    'missing-opening-balance': 'Opening history needed',
    'transactions-only': 'Transactions only',
    closed: 'Closed / zero derived',
};

export const PortfolioTransactionReconciliationV6 = ({ items, theme }: {
    readonly items: readonly ResearchWatchlistItem[];
    readonly theme: ResearchThemeV6;
}) => {
    const [holdings, setHoldings] = useState<HoldingsState>({ status: 'loading', snapshot: null });
    const [transactions, setTransactions] = useState<TransactionsState>({ status: 'loading', snapshot: null });
    const [queueMessage, setQueueMessage] = useState('');
    const styles = getThemeV6(theme);
    const researchSymbolByIdentity = useMemo(
        () => new Map(items.flatMap((item) => [
            [`${item.market}:${item.symbol}`, item.symbol] as const,
            [`${item.market}:${item.providerSymbol}`, item.symbol] as const,
        ])),
        [items],
    );

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

    const reconciliationResult = useMemo(
        () => {
            if (holdings.status !== 'ready' || transactions.status !== 'ready') {
                return { reconciliation: null, error: null };
            }
            try {
                return {
                    reconciliation: buildPortfolioTransactionReconciliation(
                        holdings.snapshot,
                        transactions.snapshot,
                    ),
                    error: null,
                };
            } catch (error) {
                return {
                    reconciliation: null,
                    error: error instanceof Error
                        ? error.message
                        : 'Transaction reconciliation could not be calculated safely.',
                };
            }
        },
        [holdings, transactions],
    );
    const reconciliation = reconciliationResult.reconciliation;
    const transactionCount = transactions.status === 'ready' ? transactions.snapshot.transactions.length : 0;
    const unavailableMessages = [
        holdings.status === 'invalid' || holdings.status === 'unavailable' ? holdings.message : null,
        transactions.status === 'invalid' || transactions.status === 'unavailable' ? transactions.message : null,
    ].filter((message): message is string => message !== null);
    const queueExceptionReview = (symbol: string) => {
        try {
            const result = enqueueResearchWorkflowTaskClient({
                symbol,
                templateId: 'thesis-challenge',
                source: 'portfolio-reconciliation',
                dueAt: new Date().toISOString().slice(0, 10),
            });
            if (result.created) {
                trackProductAnalyticsEvent({
                    name: 'workflow_queued',
                    surface: 'research',
                    workspace: 'portfolio',
                    source: 'portfolio_reconciliation',
                });
            }
            setQueueMessage(result.created
                ? `${symbol} reconciliation review added to the Queue.`
                : `${symbol} already has a reconciliation review in the Queue.`);
        } catch {
            setQueueMessage('The Research Queue is unavailable in this browser.');
        }
    };

    return (
        <section className={'mt-5 rounded-lg border p-4 ' + styles.panelSecondary} aria-labelledby="portfolio-transaction-reconciliation-title" data-testid="portfolio-transaction-reconciliation">
            <div>
                <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + styles.positive}>Transaction reconciliation · derived locally</p>
                <h2 id="portfolio-transaction-reconciliation-title" className={'mt-1 text-base font-bold ' + styles.textPrimary}>Compare transaction history with the holdings snapshot</h2>
                <p className={'mt-1 max-w-3xl text-xs leading-5 ' + styles.textMuted}>
                    Signal derives quantities and cash from explicit accepted transactions, then compares them with the independently stored holdings snapshot. It never overwrites either source, invents opening balances, combines currencies, or sends the comparison anywhere.
                </p>
            </div>

            {holdings.status === 'loading' || transactions.status === 'loading' ? (
                <p className={'mt-4 text-sm ' + styles.textMuted} role="status">Restoring local holdings and transactions…</p>
            ) : unavailableMessages.length > 0 ? (
                <div className={'mt-4 rounded-md border p-3 text-sm ' + styles.risk} role="alert">
                    {unavailableMessages.map((message) => <p key={message}>{message}</p>)}
                    <p className="mt-2 text-xs">Reconciliation is unavailable until both local snapshots can be validated.</p>
                </div>
            ) : holdings.status === 'empty' || transactions.status === 'empty' ? (
                <div className={'mt-4 rounded-md border p-4 ' + styles.panelUtility}>
                    <p className={'text-sm font-semibold ' + styles.textPrimary}>Both local snapshots are required</p>
                    <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>
                        {holdings.status === 'empty' && transactions.status === 'empty'
                            ? 'Import a holdings snapshot and a transaction history above.'
                            : holdings.status === 'empty'
                                ? 'Import a holdings snapshot above. The transaction history remains unchanged.'
                                : 'Import a transaction history above. The holdings snapshot remains unchanged.'}
                    </p>
                </div>
            ) : reconciliationResult.error ? (
                <div className={'mt-4 rounded-md border p-3 text-sm ' + styles.risk} role="alert">
                    <p>{reconciliationResult.error}</p>
                    <p className="mt-2 text-xs">The local snapshots remain unchanged. Review unusually large quantity or amount values before retrying.</p>
                </div>
            ) : reconciliation ? (
                <>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {[
                            ['Transaction range', reconciliation.dateRange ? `${reconciliation.dateRange.first} to ${reconciliation.dateRange.last}` : 'Unavailable', `${transactionCount} accepted rows`],
                            ['Position matches', reconciliation.summary.matchedPositions, `${reconciliation.summary.incompletePositions} need review or opening history`],
                            ['Transaction-only positions', reconciliation.summary.transactionOnlyPositions, `${reconciliation.summary.closedPositions} closed or zero-derived`],
                            ['Cash matches', reconciliation.summary.matchedCashBalances, `${reconciliation.summary.incompleteCashBalances} need review or opening history`],
                        ].map(([label, value, note]) => (
                            <div key={label} className={'rounded-md border p-3 ' + styles.panelUtility}>
                                <p className={'text-[11px] font-semibold ' + styles.textMuted}>{label}</p>
                                <p className={'mt-1 font-mono text-base font-bold ' + styles.textPrimary}>{value}</p>
                                <p className={'mt-1 text-[11px] leading-4 ' + styles.textMuted}>{note}</p>
                            </div>
                        ))}
                    </div>

                    <div className="research-scrollbar mt-4 overflow-x-auto rounded-md border">
                        <table className="w-full min-w-[1040px] text-left text-xs [&_td]:px-3 [&_th]:px-3">
                            <caption className={'p-3 text-left font-semibold ' + styles.textSecondary}>Position quantity comparison</caption>
                            <thead className={styles.panelSolid}>
                                <tr className={styles.textMuted}>
                                    <th className="py-2">Account</th><th className="py-2">Security</th><th className="py-2">Currency</th>
                                    <th className="py-2 text-right">Snapshot</th><th className="py-2 text-right">From transactions</th>
                                    <th className="py-2 text-right">Difference</th><th className="py-2">Status</th><th className="py-2">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reconciliation.positions.map((row) => {
                                    const needsReview = row.status !== 'match' && row.status !== 'closed';
                                    const queueSymbol = researchSymbolByIdentity.get(`${row.market}:${row.symbol}`) ?? null;
                                    const canQueue = needsReview && queueSymbol !== null;
                                    return (
                                        <tr key={`${row.accountLabel}:${row.market}:${row.symbol}:${row.currency}`} className={'border-t ' + styles.divider}>
                                            <td className="py-2">{row.accountLabel}</td>
                                            <th className="py-2 font-mono">{row.market}:{row.symbol}</th>
                                            <td className="py-2 font-mono">{row.currency}{row.currencyConflict ? ' · conflict' : ''}</td>
                                            <td className="py-2 text-right font-mono">{row.holdingQuantity ?? 'Unavailable'}</td>
                                            <td className="py-2 text-right font-mono">{row.derivedQuantity}</td>
                                            <td className="py-2 text-right font-mono">{row.differenceQuantity ?? 'Unavailable'}</td>
                                            <td className={'py-2 font-semibold ' + (row.status === 'match' || row.status === 'closed' ? styles.positive : styles.risk)}>
                                                {statusLabel[row.status]}
                                            </td>
                                            <td className="py-2">
                                                {canQueue ? (
                                                    <button
                                                        type="button"
                                                        aria-label={`Queue ${row.symbol} reconciliation review`}
                                                        className={'min-h-10 rounded border px-2 font-semibold ' + styles.row}
                                                        onClick={() => queueExceptionReview(queueSymbol)}
                                                    >
                                                        Queue review
                                                    </button>
                                                ) : needsReview ? <span className={styles.textMuted}>Research match required</span> : <span className={styles.textMuted}>—</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {queueMessage ? <p className={'mt-3 text-xs ' + (queueMessage.includes('unavailable') ? styles.risk : styles.positive)} role="status">{queueMessage}</p> : null}

                    <div className="research-scrollbar mt-4 overflow-x-auto rounded-md border">
                        <table className="w-full min-w-[820px] text-left text-xs [&_td]:px-3 [&_th]:px-3">
                            <caption className={'p-3 text-left font-semibold ' + styles.textSecondary}>Cash comparison by exact account and currency</caption>
                            <thead className={styles.panelSolid}>
                                <tr className={styles.textMuted}>
                                    <th className="py-2">Account</th><th className="py-2">Currency</th>
                                    <th className="py-2 text-right">Snapshot</th><th className="py-2 text-right">From transactions</th>
                                    <th className="py-2 text-right">Difference</th><th className="py-2">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reconciliation.cashBalances.map((row) => (
                                    <tr key={`${row.accountLabel}:${row.currency}`} className={'border-t ' + styles.divider}>
                                        <td className="py-2">{row.accountLabel}</td>
                                        <th className="py-2 font-mono">{row.currency}</th>
                                        <td className="py-2 text-right font-mono">{row.snapshotBalance === null ? 'Unavailable' : formatMoney(row.snapshotBalance, row.currency)}</td>
                                        <td className="py-2 text-right font-mono">{formatMoney(row.derivedBalance, row.currency)}</td>
                                        <td className="py-2 text-right font-mono">{row.differenceBalance === null ? 'Unavailable' : formatMoney(row.differenceBalance, row.currency)}</td>
                                        <td className={'py-2 font-semibold ' + (row.status === 'match' || row.status === 'closed' ? styles.positive : styles.risk)}>
                                            {statusLabel[row.status]}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className={'mt-4 rounded-md border p-3 ' + styles.panelUtility}>
                        <p className={'text-xs font-semibold ' + styles.textPrimary}>Coverage and limitations</p>
                        <ul className={'mt-2 list-disc space-y-1 pl-5 text-xs leading-5 ' + styles.textMuted}>
                            {reconciliation.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                        </ul>
                    </div>
                </>
            ) : null}
        </section>
    );
};
