'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    buildCanonicalPortfolioTransactionCsvTemplate,
    createPortfolioTransactionImportSnapshot,
    mergePortfolioTransactionSnapshots,
    parsePortfolioTransactionCsv,
    portfolioTransactionImportLimits,
    previewPortfolioTransactionImportEffect,
    type PortfolioTransactionCsvPreview,
    type PortfolioTransactionImportConflictPolicy,
} from '@/lib/portfolio/transactions';
import {
    loadPortfolioTransactionSnapshot,
    PORTFOLIO_TRANSACTIONS_CHANGE_EVENT,
    PORTFOLIO_TRANSACTIONS_STORAGE_KEY,
    savePortfolioTransactionSnapshot,
    type PortfolioTransactionsLoadResult,
} from '@/lib/portfolio/transactions-client';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type RestoreState =
    | { readonly status: 'loading'; readonly snapshot: null }
    | PortfolioTransactionsLoadResult;

type DraftState =
    | { readonly status: 'idle' }
    | { readonly status: 'error'; readonly message: string }
    | { readonly status: 'ready'; readonly preview: PortfolioTransactionCsvPreview };

const formatMoney = (value: number, currency: string) =>
    new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

const downloadText = (name: string, text: string) => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
};

export const PortfolioTransactionImportV6 = ({ theme }: {
    readonly theme: ResearchThemeV6;
}) => {
    const [restore, setRestore] = useState<RestoreState>({ status: 'loading', snapshot: null });
    const [draft, setDraft] = useState<DraftState>({ status: 'idle' });
    const [provenanceLabel, setProvenanceLabel] = useState('Manual CSV import');
    const [policy, setPolicy] = useState<PortfolioTransactionImportConflictPolicy>('add-only');
    const [confirmed, setConfirmed] = useState(false);
    const [replacementAcknowledged, setReplacementAcknowledged] = useState(false);
    const [invalidStorageAcknowledged, setInvalidStorageAcknowledged] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const styles = getThemeV6(theme);

    useEffect(() => {
        const restoreSnapshot = () => setRestore(loadPortfolioTransactionSnapshot());
        const onStorage = (event: StorageEvent) => {
            if (event.key === PORTFOLIO_TRANSACTIONS_STORAGE_KEY) restoreSnapshot();
        };
        const timer = window.setTimeout(restoreSnapshot, 0);
        window.addEventListener('storage', onStorage);
        window.addEventListener(PORTFOLIO_TRANSACTIONS_CHANGE_EVENT, restoreSnapshot);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('storage', onStorage);
            window.removeEventListener(PORTFOLIO_TRANSACTIONS_CHANGE_EVENT, restoreSnapshot);
        };
    }, []);

    const snapshot = restore.status === 'ready' ? restore.snapshot : null;
    const incoming = useMemo(() => {
        if (draft.status !== 'ready') return null;
        try {
            return createPortfolioTransactionImportSnapshot(
                draft.preview,
                provenanceLabel,
                '2026-01-01T00:00:00.000Z',
            );
        } catch {
            return null;
        }
    }, [draft, provenanceLabel]);
    const effect = incoming ? previewPortfolioTransactionImportEffect(snapshot, incoming, policy) : null;
    const previewTotals = useMemo(() => {
        if (draft.status !== 'ready') return [];
        return [...new Set(draft.preview.transactions.map((transaction) => transaction.currency))]
            .sort()
            .map((currency) => ({
                currency,
                amount: draft.preview.transactions
                    .filter((transaction) => transaction.currency === currency)
                    .reduce((total, transaction) => total + transaction.amount, 0),
            }));
    }, [draft]);

    const readFile = async (file: File | null) => {
        setSaveMessage('');
        setConfirmed(false);
        setReplacementAcknowledged(false);
        if (!file) {
            setDraft({ status: 'idle' });
            return;
        }
        if (file.size > portfolioTransactionImportLimits.maxFileBytes) {
            setDraft({
                status: 'error',
                message: `CSV is larger than ${portfolioTransactionImportLimits.maxFileBytes.toLocaleString()} bytes.`,
            });
            return;
        }
        try {
            setDraft({ status: 'ready', preview: parsePortfolioTransactionCsv(await file.text()) });
        } catch (error) {
            setDraft({
                status: 'error',
                message: error instanceof Error ? error.message : 'CSV could not be read.',
            });
        }
    };

    const persist = () => {
        if (!incoming || !confirmed || restore.status === 'unavailable') return;
        if (effect && effect.replaced > 0 && !replacementAcknowledged) return;
        if (restore.status === 'invalid' && !invalidStorageAcknowledged) return;
        try {
            const timestamped = createPortfolioTransactionImportSnapshot(
                { transactions: incoming.transactions },
                provenanceLabel,
            );
            const merged = mergePortfolioTransactionSnapshots(
                snapshot,
                timestamped,
                policy,
                replacementAcknowledged,
            );
            savePortfolioTransactionSnapshot(merged);
            setRestore({ status: 'ready', snapshot: merged });
            setDraft({ status: 'idle' });
            setConfirmed(false);
            setReplacementAcknowledged(false);
            setInvalidStorageAcknowledged(false);
            setSaveMessage(`Saved ${timestamped.transactions.length} accepted transaction row${timestamped.transactions.length === 1 ? '' : 's'} locally.`);
        } catch (error) {
            setSaveMessage(error instanceof Error ? error.message : 'Transaction snapshot could not be saved.');
        }
    };

    return (
        <section className={'mt-5 rounded-lg border p-4 ' + styles.panelSecondary} aria-labelledby="portfolio-transactions-title" data-testid="portfolio-transactions">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + styles.positive}>Transaction history · local only</p>
                    <h2 id="portfolio-transactions-title" className={'mt-1 text-base font-bold ' + styles.textPrimary}>Read-only transaction import</h2>
                    <p className={'mt-1 max-w-3xl text-xs leading-5 ' + styles.textMuted}>
                        Import a bounded broker export for review. Signal keeps accepted rows in this browser only; it does not upload the CSV, overwrite holdings, calculate tax lots, convert currencies, or place orders.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => downloadText('signal-portfolio-transactions-template.csv', buildCanonicalPortfolioTransactionCsvTemplate())}
                    className={'min-h-10 rounded-md border px-3 text-xs font-semibold ' + styles.panelSolid}
                >
                    Download transaction template
                </button>
            </div>

            {restore.status === 'loading' ? (
                <p className={'mt-4 text-sm ' + styles.textMuted} role="status">Restoring local transactions…</p>
            ) : restore.status === 'unavailable' || restore.status === 'invalid' ? (
                <div className={'mt-4 rounded-md border p-3 text-sm ' + styles.risk} role="alert">
                    <p>{restore.message}</p>
                    {restore.status === 'invalid' ? (
                        <label className="mt-3 flex items-start gap-2 text-xs">
                            <input
                                type="checkbox"
                                checked={invalidStorageAcknowledged}
                                onChange={(event) => setInvalidStorageAcknowledged(event.target.checked)}
                            />
                            <span>I understand that saving a confirmed import will replace the unreadable local transaction snapshot.</span>
                        </label>
                    ) : null}
                </div>
            ) : snapshot === null ? (
                <div className={'mt-4 rounded-md border p-4 ' + styles.panelUtility}>
                    <p className={'text-sm font-semibold ' + styles.textPrimary}>No imported transactions yet</p>
                    <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Use exact broker transaction IDs. Direction comes from the transaction type, so amounts must be positive.</p>
                </div>
            ) : (
                <div className="mt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className={'text-sm font-semibold ' + styles.textPrimary}>
                            {snapshot.transactions.length} saved transaction{snapshot.transactions.length === 1 ? '' : 's'}
                        </p>
                        <p className={'text-xs ' + styles.textMuted}>Updated {new Date(snapshot.updatedAt).toLocaleString()}</p>
                    </div>
                    <div className="research-scrollbar mt-3 max-h-72 overflow-auto rounded-md border">
                        <table className="w-full min-w-[860px] text-left text-xs [&_td]:px-3 [&_th]:px-3">
                            <caption className="sr-only">Saved browser-local transaction history</caption>
                            <thead className={styles.panelSolid}>
                                <tr className={styles.textMuted}>
                                    <th className="py-2">Date</th><th className="py-2">Account</th><th className="py-2">Transaction ID</th>
                                    <th className="py-2">Type</th><th className="py-2">Security</th><th className="py-2 text-right">Quantity</th>
                                    <th className="py-2 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {snapshot.transactions.map((transaction) => (
                                    <tr key={`${transaction.accountLabel}:${transaction.id}`} className={'border-t ' + styles.divider}>
                                        <td className="py-2 font-mono">{transaction.occurredOn}</td>
                                        <td className="py-2">{transaction.accountLabel}</td>
                                        <th className="py-2 font-mono">{transaction.id}</th>
                                        <td className="py-2 capitalize">{transaction.type}</td>
                                        <td className="py-2 font-mono">{transaction.market && transaction.symbol ? `${transaction.market}:${transaction.symbol}` : '—'}</td>
                                        <td className="py-2 text-right font-mono">{transaction.quantity ?? '—'}</td>
                                        <td className="py-2 text-right font-mono">{formatMoney(transaction.amount, transaction.currency)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className={'mt-5 rounded-lg border p-4 ' + styles.panelUtility}>
                <h3 className={'text-sm font-bold ' + styles.textPrimary}>Transaction import preview</h3>
                <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>
                    Maximum {portfolioTransactionImportLimits.maxRows} rows and {portfolioTransactionImportLimits.maxFileBytes.toLocaleString()} bytes. Accepted types: buy, sell, dividend, fee, tax, deposit, and withdrawal.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className={'text-xs font-semibold ' + styles.textMuted}>Canonical transaction CSV
                        <input
                            type="file"
                            accept=".csv,text/csv"
                            onChange={(event) => void readFile(event.target.files?.[0] ?? null)}
                            className={'mt-1 block min-h-10 w-full rounded-md border p-2 text-xs ' + styles.panelSolid}
                        />
                    </label>
                    <label className={'text-xs font-semibold ' + styles.textMuted}>Non-sensitive provenance label
                        <input
                            value={provenanceLabel}
                            maxLength={portfolioTransactionImportLimits.maxProvenanceLabelLength}
                            onChange={(event) => setProvenanceLabel(event.target.value)}
                            className={'mt-1 min-h-10 w-full rounded-md border px-3 ' + styles.panelSolid}
                        />
                    </label>
                </div>

                {draft.status === 'error' ? <p className={'mt-3 text-sm ' + styles.risk} role="alert">{draft.message}</p> : null}
                {draft.status === 'ready' ? (
                    <div className="mt-4" data-testid="portfolio-transaction-import-preview">
                        <dl className="grid gap-2 sm:grid-cols-3">
                            {[
                                ['Rows read', draft.preview.totalDataRows],
                                ['Valid transactions', draft.preview.transactions.length],
                                ['Rejected', draft.preview.rejectedRows.length],
                            ].map(([label, value]) => (
                                <div key={label} className={'rounded-md border p-3 ' + styles.panelSolid}>
                                    <dt className={'text-[11px] ' + styles.textMuted}>{label}</dt>
                                    <dd className={'mt-1 font-mono text-base font-bold ' + styles.textPrimary}>{value}</dd>
                                </div>
                            ))}
                        </dl>
                        {previewTotals.length > 0 ? (
                            <p className={'mt-3 text-xs ' + styles.textMuted}>
                                Accepted-row amounts by currency: {previewTotals.map((total) => `${formatMoney(total.amount, total.currency)} ${total.currency}`).join('; ')}. These are not net cash-flow calculations.
                            </p>
                        ) : null}
                        {draft.preview.transactions.length > 0 ? (
                            <div className="research-scrollbar mt-3 max-h-72 overflow-auto rounded-md border">
                                <table className="w-full min-w-[860px] text-left text-xs [&_td]:px-3 [&_th]:px-3">
                                    <caption className="sr-only">Every accepted transaction import row</caption>
                                    <thead className={styles.panelSolid}>
                                        <tr className={styles.textMuted}>
                                            <th className="py-2">Row</th><th className="py-2">Date</th><th className="py-2">Account</th>
                                            <th className="py-2">Transaction ID</th><th className="py-2">Type</th><th className="py-2">Security</th>
                                            <th className="py-2 text-right">Quantity</th><th className="py-2 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {draft.preview.transactions.map((transaction, index) => (
                                            <tr key={`${transaction.accountLabel}:${transaction.id}`} className={'border-t ' + styles.divider}>
                                                <td className="py-2 font-mono">{index + 2}</td>
                                                <td className="py-2 font-mono">{transaction.occurredOn}</td>
                                                <td className="py-2">{transaction.accountLabel}</td>
                                                <th className="py-2 font-mono">{transaction.id}</th>
                                                <td className="py-2 capitalize">{transaction.type}</td>
                                                <td className="py-2 font-mono">{transaction.market && transaction.symbol ? `${transaction.market}:${transaction.symbol}` : '—'}</td>
                                                <td className="py-2 text-right font-mono">{transaction.quantity ?? '—'}</td>
                                                <td className="py-2 text-right font-mono">{formatMoney(transaction.amount, transaction.currency)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : null}
                        {draft.preview.rejectedRows.length > 0 ? (
                            <div className={'mt-3 rounded-md border p-3 ' + styles.risk} role="alert">
                                <p className="font-semibold">Partial import: rejected rows will not be saved.</p>
                                <ul className="mt-2 space-y-1 text-xs">
                                    {draft.preview.rejectedRows.map((error) => (
                                        <li key={`${error.rowNumber}:${error.message}`}>Row {error.rowNumber}: {error.message}</li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}
                        {draft.preview.duplicates.length > 0 ? (
                            <p className={'mt-2 text-xs ' + styles.risk}>Duplicate account and transaction ID pairs are rejected as a group; no first-row guess is made.</p>
                        ) : null}
                        {incoming && effect ? (
                            <>
                                <div className={'mt-3 rounded-md border p-3 text-xs ' + styles.panelSolid}>
                                    <p className={'font-semibold ' + styles.textPrimary}>Exact save effect</p>
                                    <p className={'mt-1 ' + styles.textMuted}>
                                        Add {effect.added}; {policy === 'add-only' ? `skip ${effect.skipped} exact matches` : `replace ${effect.replaced} exact matches`}; keep {effect.unchangedExisting} unrelated saved transactions.
                                    </p>
                                </div>
                                <fieldset className="mt-3">
                                    <legend className={'text-xs font-semibold ' + styles.textMuted}>Conflict policy</legend>
                                    <div className="mt-2 flex flex-wrap gap-4 text-xs">
                                        <label className="flex items-center gap-2">
                                            <input type="radio" name="portfolio-transaction-import-policy" checked={policy === 'add-only'} onChange={() => { setPolicy('add-only'); setReplacementAcknowledged(false); }} />
                                            Add only (default)
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input type="radio" name="portfolio-transaction-import-policy" checked={policy === 'replace-matching'} onChange={() => setPolicy('replace-matching')} />
                                            Replace exact matches
                                        </label>
                                    </div>
                                </fieldset>
                                {effect.replaced > 0 ? (
                                    <label className={'mt-3 flex items-start gap-2 text-xs ' + styles.risk}>
                                        <input type="checkbox" checked={replacementAcknowledged} onChange={(event) => setReplacementAcknowledged(event.target.checked)} />
                                        <span>I acknowledge that {effect.replaced} exact matching local transaction{effect.replaced === 1 ? '' : 's'} will be replaced. Unrelated transactions will remain.</span>
                                    </label>
                                ) : null}
                                <label className={'mt-3 flex items-start gap-2 text-xs ' + styles.textSecondary}>
                                    <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                                    <span>I reviewed the complete preview and confirm saving the accepted rows locally.</span>
                                </label>
                                <button
                                    type="button"
                                    disabled={
                                        incoming.transactions.length === 0
                                        || !confirmed
                                        || (effect.replaced > 0 && !replacementAcknowledged)
                                        || restore.status === 'unavailable'
                                        || (restore.status === 'invalid' && !invalidStorageAcknowledged)
                                    }
                                    onClick={persist}
                                    className={'mt-3 min-h-10 rounded-md border px-4 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 ' + styles.panelAction}
                                >
                                    Save accepted transactions
                                </button>
                            </>
                        ) : <p className={'mt-3 text-xs ' + styles.risk}>Enter a valid provenance label before saving.</p>}
                    </div>
                ) : null}
                {saveMessage ? <p className={'mt-3 text-sm ' + (saveMessage.startsWith('Saved') ? styles.positive : styles.risk)} role="status">{saveMessage}</p> : null}
            </div>
        </section>
    );
};
