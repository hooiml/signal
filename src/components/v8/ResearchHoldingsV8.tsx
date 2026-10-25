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

    return <section className={styles.root} aria-labelledby="research-holdings-title">
        <header className={styles.header}>
            <div>
                <p className={styles.eyebrow}>Browser-local snapshot · read only</p>
                <h2 id="research-holdings-title">Holdings</h2>
                <p>Saved on this device. Actual holdings stay separate from research position plans.</p>
            </div>
            {importLink}
        </header>
        {state.status === 'loading' ? <p role="status" className={styles.state}>Loading saved holdings…</p> : null}
        {state.status === 'empty' ? <V8EmptyState className={styles.state} message="No holdings have been imported in this browser." action={importLink} /> : null}
        {state.status === 'invalid' || state.status === 'unavailable' ? <p className={styles.state} role="alert">{state.message} {importLink}</p> : null}
        {snapshot ? <>
            {!snapshot.holdings.length && !snapshot.cashBalances.length ? <V8EmptyState className={styles.state} message="The saved snapshot contains no holdings or cash balances." action={importLink} /> : null}
            <div className={styles.note}>
                <p>Current prices are not loaded in this view. Market value and actual weight are unavailable; open the <a href={importHref} target="_blank" rel="noreferrer">Portfolio workspace</a> for price-aware tools.</p>
                {records === null ? <p>Research matches are unavailable until the watchlist is loaded.</p> : null}
            </div>
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
                    <caption>Imported holdings · market value and weight are unavailable until prices are loaded</caption>
                    <thead><tr><th>Account</th><th>Stock</th><th>Market</th><th>Quantity</th><th>Average cost</th><th>Cost basis</th><th>Current price</th><th>Market value</th><th>Actual weight</th><th>Research match</th><th>Source</th></tr></thead>
                    <tbody>{reconciled.map(row => <tr key={`${row.holding.accountLabel}:${row.holding.market}:${row.holding.symbol}`}>
                        <td>{row.holding.accountLabel}</td>
                        <th scope="row">{records === null ? row.holding.symbol : row.researchRecord
                            ? <button type="button" className={styles.stockLink} onClick={() => onOpen(row.holding.symbol, row.holding.market)}>{row.holding.symbol}</button>
                            : row.holding.symbol}</th>
                        <td>{row.holding.market}</td><td>{row.holding.quantity}</td>
                        <td>{formatMoney(row.holding.averageCost, row.holding.currency)}</td>
                        <td>{formatMoney(row.costBasis, row.holding.currency)}</td>
                        <td>—</td><td>—</td><td>—</td>
                        <td>{records === null ? 'Unavailable' : row.researchRecord ? 'Exact match' : 'No saved match'}</td>
                        <td><span>{row.holding.provenanceLabel}</span><small>{formatDate(row.holding.importedAt)}</small></td>
                    </tr>)}</tbody>
                </table>
            </div> : null}
            {snapshot.cashBalances.length ? <div className={styles.cashList}>
                <h3>Cash by account</h3>
                <ul>{snapshot.cashBalances.map((cash, index) => <li key={`${cash.accountLabel}:${cash.currency}:${index}`}>
                    <span>{cash.accountLabel} · {cash.currency}</span><b>{formatMoney(cash.balance, cash.currency)}</b>
                    <small>{cash.provenanceLabel} · {formatDate(cash.importedAt)}</small>
                </li>)}</ul>
            </div> : null}
            <p className={styles.updated}>Snapshot updated {formatDate(snapshot.updatedAt)} · Saved on this device</p>
        </> : null}
    </section>;
}
