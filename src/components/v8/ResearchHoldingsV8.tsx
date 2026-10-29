'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildPortfolioActualSummary, reconcilePortfolioHoldings } from '@/lib/portfolio/holdings';
import {
    loadPortfolioHoldingsSnapshot,
    PORTFOLIO_HOLDINGS_CHANGE_EVENT,
    type PortfolioHoldingsLoadResult,
} from '@/lib/portfolio/holdings-client';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import styles from './research-holdings-v8.module.css';
import { V8EmptyState } from './V8Primitives';

type HoldingsState = { readonly status: 'loading' } | PortfolioHoldingsLoadResult;
const importHref = '/research?workspace=portfolio';
const formatMoney = (value: number, currency: string) =>
    new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
const formatDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};
const importLink = <a className={styles.action} href={importHref} target="_blank" rel="noreferrer">Import or update holdings</a>;
const sourceOf = (row: { readonly provenanceLabel: string; readonly importedAt: string }) => `${row.provenanceLabel} · ${formatDate(row.importedAt)}`;

export function ResearchHoldingsV8({ records, onOpen }: {
    readonly records: readonly ResearchRecord[] | null;
    readonly onOpen: (symbol: string, market: ResearchMarket) => void;
}) {
    const [state, setState] = useState<HoldingsState>({ status: 'loading' });
    useEffect(() => {
        const refresh = () => setState(loadPortfolioHoldingsSnapshot());
        refresh();
        window.addEventListener('storage', refresh);
        window.addEventListener(PORTFOLIO_HOLDINGS_CHANGE_EVENT, refresh);
        return () => {
            window.removeEventListener('storage', refresh);
            window.removeEventListener(PORTFOLIO_HOLDINGS_CHANGE_EVENT, refresh);
        };
    }, []);

    const snapshot = state.status === 'ready' ? state.snapshot : null;
    const reconciled = useMemo(() => snapshot
        ? reconcilePortfolioHoldings(snapshot, records ?? [], new Map())
        : [], [records, snapshot]);
    const summaries = useMemo(() => snapshot
        ? buildPortfolioActualSummary(snapshot, reconciled)
        : [], [reconciled, snapshot]);
    // One import shares one source, stated once; mixed sources keep a source on every row.
    const sources = useMemo(() => snapshot
        ? [...new Set([...snapshot.holdings, ...snapshot.cashBalances].map(sourceOf))]
        : [], [snapshot]);
    const perRowSource = sources.length > 1;
    const first = snapshot?.holdings[0] ?? snapshot?.cashBalances[0];
    // A source imported at the snapshot's own time needs no second timestamp.
    const sharedSource = !first || perRowSource ? '' : first.importedAt === snapshot?.updatedAt ? first.provenanceLabel : sources[0];
    // Currency totals carry cash; retain its rows when the shared header cannot state their source.
    const showCashAccounts = snapshot !== null && snapshot.cashBalances.length > 0
        && (perRowSource || new Set(snapshot.cashBalances.map(cash => cash.accountLabel)).size > 1 || !snapshot.holdings.length);

    return <section className={styles.root} aria-labelledby="research-holdings-title">
        <header className={styles.header}>
            <div>
                <h2 id="research-holdings-title">Holdings</h2>
                {snapshot ? <p>Snapshot updated {formatDate(snapshot.updatedAt)}{sharedSource ? ` · ${sharedSource}` : ''} · Saved on this device · Prices not loaded</p> : null}
            </div>
            {importLink}
        </header>
        {state.status === 'loading' ? <p role="status" className={styles.state}>Loading saved holdings…</p> : null}
        {state.status === 'empty' ? <V8EmptyState className={styles.state} message="No holdings have been imported in this browser." action={importLink} /> : null}
        {state.status === 'invalid' || state.status === 'unavailable' ? <p className={styles.state} role="alert">{state.message} {importLink}</p> : null}
        {snapshot ? <>
            {!snapshot.holdings.length && !snapshot.cashBalances.length ? <V8EmptyState className={styles.state} message="The saved snapshot contains no holdings or cash balances." action={importLink} /> : null}
            {records === null ? <p className={styles.note}>Research matches are unavailable until the watchlist is loaded.</p> : null}
            {summaries.length > 0 ? <div className={styles.summaries} aria-label="Totals by currency">
                {summaries.map(summary => <section className={styles.summary} key={summary.currency}>
                    <h3>{summary.currency} totals</h3>
                    <p><span>Cost basis</span><b>{formatMoney(summary.costBasis, summary.currency)}</b></p>
                    <p><span>Cash</span><b>{formatMoney(summary.cashBalance, summary.currency)}</b></p>
                    <p><span>Holdings without current price</span><b>{summary.missingMarketValues}</b></p>
                </section>)}
            </div> : null}
            {snapshot.holdings.length ? <div className={styles.tableWrap} role="region" aria-label="Imported holdings table" tabIndex={0}>
                <table>
                    <caption className={styles.visuallyHidden}>Imported holdings at cost</caption>
                    <thead><tr><th>Account</th><th>Stock</th><th className={styles.num}>Quantity</th><th className={styles.num}>Average cost</th><th className={styles.num}>Cost basis</th>{perRowSource ? <th>Source</th> : null}</tr></thead>
                    <tbody>{reconciled.map(row => <tr key={`${row.holding.accountLabel}:${row.holding.market}:${row.holding.symbol}`}>
                        <td>{row.holding.accountLabel}</td>
                        <th scope="row">{records !== null && row.researchRecord
                            ? <button type="button" className={styles.stockLink} onClick={() => onOpen(row.holding.symbol, row.holding.market)}>{row.holding.symbol}</button>
                            : <span>{row.holding.symbol}</span>}
                            <small>{row.holding.market}{records !== null && !row.researchRecord ? <> · <span>No saved match</span></> : null}</small></th>
                        <td className={styles.num}>{row.holding.quantity}</td>
                        <td className={styles.num}>{formatMoney(row.holding.averageCost, row.holding.currency)}</td>
                        <td className={styles.num}>{formatMoney(row.costBasis, row.holding.currency)}</td>
                        {perRowSource ? <td>{sourceOf(row.holding)}</td> : null}
                    </tr>)}</tbody>
                </table>
            </div> : null}
            {showCashAccounts ? <div className={styles.cashList}>
                <h3>Cash by account</h3>
                <ul>{snapshot.cashBalances.map((cash, index) => <li key={`${cash.accountLabel}:${cash.currency}:${index}`}>
                    <span>{cash.accountLabel} · {cash.currency}</span><b>{formatMoney(cash.balance, cash.currency)}</b>
                    {perRowSource ? <small>{sourceOf(cash)}</small> : null}
                </li>)}</ul>
            </div> : null}
        </> : null}
    </section>;
}
