'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import {
    buildCanonicalPortfolioCsvTemplate,
    buildPortfolioActualSummary,
    createPortfolioImportSnapshot,
    mergePortfolioHoldingsSnapshots,
    parsePortfolioCsv,
    portfolioActualWeightPercent,
    portfolioImportLimits,
    previewPortfolioImportEffect,
    reconcilePortfolioHoldings,
    type PortfolioCsvPreview,
    type PortfolioImportConflictPolicy,
} from '@/lib/portfolio/holdings';
import {
    loadPortfolioHoldingsSnapshot,
    savePortfolioHoldingsSnapshot,
    type PortfolioHoldingsLoadResult,
} from '@/lib/portfolio/holdings-client';
import type { ResearchRecord } from '@/lib/types/research';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type RestoreState =
    | { readonly status: 'loading'; readonly snapshot: null }
    | PortfolioHoldingsLoadResult;

type DraftState =
    | { readonly status: 'idle' }
    | { readonly status: 'error'; readonly message: string }
    | { readonly status: 'ready'; readonly preview: PortfolioCsvPreview };

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

export const PortfolioHoldingsImportV6 = ({ records, items, theme, onOpen }: {
    readonly records: readonly ResearchRecord[];
    readonly items: readonly ResearchWatchlistItem[];
    readonly theme: ResearchThemeV6;
    readonly onOpen: (symbol: string) => void;
}) => {
    const [restore, setRestore] = useState<RestoreState>({ status: 'loading', snapshot: null });
    const [draft, setDraft] = useState<DraftState>({ status: 'idle' });
    const [provenanceLabel, setProvenanceLabel] = useState('Manual CSV import');
    const [policy, setPolicy] = useState<PortfolioImportConflictPolicy>('add-only');
    const [confirmed, setConfirmed] = useState(false);
    const [replacementAcknowledged, setReplacementAcknowledged] = useState(false);
    const [invalidStorageAcknowledged, setInvalidStorageAcknowledged] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const styles = getThemeV6(theme);

    useEffect(() => {
        const timer = window.setTimeout(() => setRestore(loadPortfolioHoldingsSnapshot()), 0);
        return () => window.clearTimeout(timer);
    }, []);

    const snapshot = restore.status === 'ready' ? restore.snapshot : null;
    const incoming = useMemo(() => {
        if (draft.status !== 'ready') return null;
        try {
            return createPortfolioImportSnapshot(draft.preview, provenanceLabel, '2026-01-01T00:00:00.000Z');
        } catch {
            return null;
        }
    }, [draft, provenanceLabel]);
    const effect = incoming ? previewPortfolioImportEffect(snapshot, incoming, policy) : null;
    const replacementCount = (effect?.replacedHoldings ?? 0) + (effect?.replacedCashBalances ?? 0);

    const prices = useMemo(() => new Map(items.map((item) => [
        `${item.market}:${item.symbol}`,
        typeof item.price === 'number' ? item.price : null,
    ])), [items]);
    const reconciled = useMemo(
        () => snapshot ? reconcilePortfolioHoldings(snapshot, records, prices) : [],
        [prices, records, snapshot],
    );
    const actualSummaries = useMemo(
        () => snapshot ? buildPortfolioActualSummary(snapshot, reconciled) : [],
        [reconciled, snapshot],
    );
    const previewCurrencyTotals = useMemo(() => {
        if (draft.status !== 'ready') return [];
        const currencies = [...new Set([
            ...draft.preview.holdings.map((holding) => holding.currency),
            ...draft.preview.cashBalances.map((cash) => cash.currency),
        ])].sort();
        return currencies.map((currency) => ({
            currency,
            costBasis: draft.preview.holdings
                .filter((holding) => holding.currency === currency)
                .reduce((total, holding) => total + (holding.quantity * holding.averageCost), 0),
            cash: draft.preview.cashBalances
                .filter((balance) => balance.currency === currency)
                .reduce((total, balance) => total + balance.balance, 0),
        }));
    }, [draft]);
    const summaryByCurrency = useMemo(
        () => new Map(actualSummaries.map((summary) => [summary.currency, summary])),
        [actualSummaries],
    );

    const readFile = async (file: File | null) => {
        setSaveMessage('');
        setConfirmed(false);
        setReplacementAcknowledged(false);
        if (!file) {
            setDraft({ status: 'idle' });
            return;
        }
        if (file.size > portfolioImportLimits.maxFileBytes) {
            setDraft({ status: 'error', message: `CSV is larger than ${portfolioImportLimits.maxFileBytes.toLocaleString()} bytes.` });
            return;
        }
        try {
            setDraft({ status: 'ready', preview: parsePortfolioCsv(await file.text()) });
        } catch (error) {
            setDraft({
                status: 'error',
                message: error instanceof Error ? error.message : 'CSV could not be read.',
            });
        }
    };

    const persist = () => {
        if (!incoming || !confirmed || restore.status === 'unavailable') return;
        if (replacementCount > 0 && !replacementAcknowledged) return;
        if (restore.status === 'invalid' && !invalidStorageAcknowledged) return;
        try {
            const timestamped = createPortfolioImportSnapshot(
                { holdings: incoming.holdings, cashBalances: incoming.cashBalances },
                provenanceLabel,
            );
            const merged = mergePortfolioHoldingsSnapshots(
                snapshot,
                timestamped,
                policy,
                replacementAcknowledged,
            );
            savePortfolioHoldingsSnapshot(merged);
            setRestore({ status: 'ready', snapshot: merged });
            setDraft({ status: 'idle' });
            setConfirmed(false);
            setReplacementAcknowledged(false);
            setInvalidStorageAcknowledged(false);
            setSaveMessage(
                `Saved ${timestamped.holdings.length} holding row${timestamped.holdings.length === 1 ? '' : 's'}`
                + ` and ${timestamped.cashBalances.length} cash balance${timestamped.cashBalances.length === 1 ? '' : 's'} locally.`,
            );
        } catch (error) {
            setSaveMessage(error instanceof Error ? error.message : 'Portfolio snapshot could not be saved.');
        }
    };

    return (
        <section className={'mt-5 rounded-lg border p-4 ' + styles.panelSecondary} aria-labelledby="portfolio-import-title" data-testid="portfolio-import">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + styles.positive}>Imported holdings · local only</p>
                    <h2 id="portfolio-import-title" className={'mt-1 text-base font-bold ' + styles.textPrimary}>Read-only holdings snapshot</h2>
                    <p className={'mt-1 max-w-3xl text-xs leading-5 ' + styles.textMuted}>
                        Import a bounded CSV for actual quantities, cost basis, and cash. Signal stores the accepted snapshot only in this browser; it never uploads the CSV, connects to a broker, or places orders.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => downloadText('signal-portfolio-template.csv', buildCanonicalPortfolioCsvTemplate())}
                    className={'min-h-10 rounded-md border px-3 text-xs font-semibold ' + styles.panelSolid}
                >
                    Download CSV template
                </button>
            </div>

            {restore.status === 'loading' ? (
                <p className={'mt-4 text-sm ' + styles.textMuted} role="status">Restoring local holdings…</p>
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
                            <span>I understand that saving a confirmed import will replace the unreadable local snapshot.</span>
                        </label>
                    ) : null}
                </div>
            ) : snapshot === null ? (
                <div className={'mt-4 rounded-md border p-4 ' + styles.panelUtility}>
                    <p className={'text-sm font-semibold ' + styles.textPrimary}>No imported holdings yet</p>
                    <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Use the canonical template. Values are never inferred from account names or symbol descriptions.</p>
                </div>
            ) : (
                <>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="portfolio-actual-summary">
                        {actualSummaries.flatMap((summary) => [
                            ['Cost basis', formatMoney(summary.costBasis, summary.currency), summary.currency],
                            ['Cash', formatMoney(summary.cashBalance, summary.currency), summary.currency],
                            ['Known value + cash', formatMoney(summary.totalKnownValue, summary.currency), summary.missingMarketValues > 0 ? `${summary.missingMarketValues} holding value unavailable` : 'Complete price coverage'],
                        ].map(([label, value, note]) => (
                            <div key={`${summary.currency}-${label}`} className={'rounded-md border p-3 ' + styles.panelUtility}>
                                <p className={'text-[11px] font-semibold ' + styles.textMuted}>{label} · {summary.currency}</p>
                                <p className={'mt-1 font-mono text-base font-bold ' + styles.textPrimary}>{value}</p>
                                <p className={'mt-1 text-[11px] ' + styles.textMuted}>{note}</p>
                            </div>
                        )))}
                        <div className={'rounded-md border p-3 ' + styles.panelUtility}>
                            <p className={'text-[11px] font-semibold ' + styles.textMuted}>Last local import</p>
                            <p className={'mt-1 text-sm font-semibold ' + styles.textPrimary}>{new Date(snapshot.updatedAt).toLocaleString()}</p>
                            <p className={'mt-1 text-[11px] ' + styles.textMuted}>{snapshot.holdings.length} holdings · {snapshot.cashBalances.length} cash balances</p>
                        </div>
                    </div>
                    <div className="research-scrollbar mt-4 overflow-x-auto">
                        <table className="w-full min-w-[980px] text-left text-xs [&_td]:pr-4 [&_th]:pr-4">
                            <caption className={'mb-2 text-left font-semibold ' + styles.textSecondary}>Imported holdings — actual values, separate from planned allocation</caption>
                            <thead>
                                <tr className={styles.textMuted}>
                                    <th className="pb-2">Account</th><th className="pb-2">Symbol</th><th className="pb-2">Market</th>
                                    <th className="pb-2 text-right">Quantity</th><th className="pb-2 text-right">Average cost</th>
                                    <th className="pb-2 text-right">Cost basis</th><th className="pb-2 text-right">Current value</th>
                                    <th className="pb-2 text-right">Actual weight</th><th className="pb-2">Research match</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reconciled.map((row) => {
                                    const currencySummary = summaryByCurrency.get(row.holding.currency);
                                    const weight = currencySummary ? portfolioActualWeightPercent(row, currencySummary) : null;
                                    return (
                                        <tr key={`${row.holding.accountLabel}:${row.holding.market}:${row.holding.symbol}`} className={'border-t ' + styles.divider}>
                                            <td className="py-2">{row.holding.accountLabel}</td>
                                            <th className="py-2 font-mono">{row.holding.symbol}</th>
                                            <td className="py-2">{row.holding.market}</td>
                                            <td className="py-2 text-right font-mono">{row.holding.quantity}</td>
                                            <td className="py-2 text-right font-mono">{formatMoney(row.holding.averageCost, row.holding.currency)}</td>
                                            <td className="py-2 text-right font-mono">{formatMoney(row.costBasis, row.holding.currency)}</td>
                                            <td className="py-2 text-right font-mono">{row.marketValue === null ? 'Unavailable' : formatMoney(row.marketValue, row.holding.currency)}</td>
                                            <td className="py-2 text-right font-mono">{weight === null ? 'Unavailable' : `${weight.toFixed(2)}%`}</td>
                                            <td className="py-2">
                                                {row.researchRecord ? (
                                                    <button type="button" className={'min-h-10 font-semibold underline ' + styles.positive} onClick={() => onOpen(row.holding.symbol)}>Exact match</button>
                                                ) : <span className={styles.textMuted}>Unmatched — kept visible</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {snapshot.cashBalances.length > 0 ? (
                        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Imported cash balances">
                            {snapshot.cashBalances.map((cash) => (
                                <li key={`${cash.accountLabel}:${cash.currency}`} className={'rounded-md border px-3 py-2 text-xs ' + styles.panelUtility}>
                                    <span className={'font-semibold ' + styles.textSecondary}>{cash.accountLabel}</span>
                                    <span className={'ml-2 font-mono ' + styles.textPrimary}>{formatMoney(cash.balance, cash.currency)}</span>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </>
            )}

            <div className={'mt-5 rounded-lg border p-4 ' + styles.panelUtility}>
                <h3 className={'text-sm font-bold ' + styles.textPrimary}>Import preview</h3>
                <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>
                    Maximum {portfolioImportLimits.maxRows} rows and {portfolioImportLimits.maxFileBytes.toLocaleString()} bytes. Required holding fields: account label, symbol, market, quantity, average cost, and currency.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className={'text-xs font-semibold ' + styles.textMuted}>Canonical CSV
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
                            maxLength={portfolioImportLimits.maxProvenanceLabelLength}
                            onChange={(event) => setProvenanceLabel(event.target.value)}
                            className={'mt-1 min-h-10 w-full rounded-md border px-3 ' + styles.panelSolid}
                        />
                    </label>
                </div>

                {draft.status === 'error' ? <p className={'mt-3 text-sm ' + styles.risk} role="alert">{draft.message}</p> : null}
                {draft.status === 'ready' ? (
                    <div className="mt-4" data-testid="portfolio-import-preview">
                        <dl className="grid gap-2 sm:grid-cols-4">
                            {[
                                ['Rows read', draft.preview.totalDataRows],
                                ['Valid holdings', draft.preview.holdings.length],
                                ['Valid cash', draft.preview.cashBalances.length],
                                ['Rejected', draft.preview.rejectedRows.length],
                            ].map(([label, value]) => (
                                <div key={label} className={'rounded-md border p-3 ' + styles.panelSolid}>
                                    <dt className={'text-[11px] ' + styles.textMuted}>{label}</dt>
                                    <dd className={'mt-1 font-mono text-base font-bold ' + styles.textPrimary}>{value}</dd>
                                </div>
                            ))}
                        </dl>
                        {previewCurrencyTotals.length > 0 ? (
                            <p className={'mt-3 text-xs ' + styles.textMuted}>
                                Preview totals:{' '}
                                {previewCurrencyTotals.map((total) =>
                                    `${total.currency} cost basis ${formatMoney(total.costBasis, total.currency)}`
                                    + ` + cash ${formatMoney(total.cash, total.currency)}`).join('; ')}.
                            </p>
                        ) : null}
                        {draft.preview.holdings.length + draft.preview.cashBalances.length > 0 ? (
                            <div className="research-scrollbar mt-3 max-h-72 overflow-auto rounded-md border">
                                <table className="w-full min-w-[720px] text-left text-xs [&_td]:px-3 [&_th]:px-3">
                                    <caption className="sr-only">Every accepted portfolio import row</caption>
                                    <thead className={styles.panelSolid}>
                                        <tr className={styles.textMuted}>
                                            <th className="py-2">Type</th><th className="py-2">Account</th><th className="py-2">Identity</th>
                                            <th className="py-2 text-right">Quantity / balance</th><th className="py-2 text-right">Average cost</th>
                                            <th className="py-2 text-right">Cost basis</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {draft.preview.holdings.map((holding) => (
                                            <tr key={`holding:${holding.accountLabel}:${holding.market}:${holding.symbol}`} className={'border-t ' + styles.divider}>
                                                <td className="py-2">Holding</td>
                                                <td className="py-2">{holding.accountLabel}</td>
                                                <td className="py-2 font-mono">{holding.symbol} · {holding.market} · {holding.currency}</td>
                                                <td className="py-2 text-right font-mono">{holding.quantity}</td>
                                                <td className="py-2 text-right font-mono">{formatMoney(holding.averageCost, holding.currency)}</td>
                                                <td className="py-2 text-right font-mono">{formatMoney(holding.quantity * holding.averageCost, holding.currency)}</td>
                                            </tr>
                                        ))}
                                        {draft.preview.cashBalances.map((cash) => (
                                            <tr key={`cash:${cash.accountLabel}:${cash.currency}`} className={'border-t ' + styles.divider}>
                                                <td className="py-2">Cash</td>
                                                <td className="py-2">{cash.accountLabel}</td>
                                                <td className="py-2 font-mono">{cash.currency}</td>
                                                <td className="py-2 text-right font-mono">{formatMoney(cash.balance, cash.currency)}</td>
                                                <td className="py-2 text-right">—</td>
                                                <td className="py-2 text-right">—</td>
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
                                    {draft.preview.rejectedRows.map((error) => <li key={`${error.rowNumber}:${error.message}`}>Row {error.rowNumber}: {error.message}</li>)}
                                </ul>
                            </div>
                        ) : null}
                        {draft.preview.duplicates.length > 0 ? (
                            <p className={'mt-2 text-xs ' + styles.risk}>Duplicate identities are rejected as a group; no first-row guess is made.</p>
                        ) : null}
                        {incoming && effect ? (
                            <>
                                <div className={'mt-3 rounded-md border p-3 text-xs ' + styles.panelSolid}>
                                    <p className={'font-semibold ' + styles.textPrimary}>Exact save effect</p>
                                    <p className={'mt-1 ' + styles.textMuted}>
                                        Add {effect.addedHoldings} holdings and {effect.addedCashBalances} cash balances;
                                        {' '}{policy === 'add-only' ? `skip ${effect.skippedHoldings + effect.skippedCashBalances} matches` : `replace ${replacementCount} matches`};
                                        {' '}keep {effect.unchangedExistingHoldings} unrelated holdings and {effect.unchangedExistingCashBalances} unrelated cash balances.
                                    </p>
                                </div>
                                <fieldset className="mt-3">
                                    <legend className={'text-xs font-semibold ' + styles.textMuted}>Conflict policy</legend>
                                    <div className="mt-2 flex flex-wrap gap-4 text-xs">
                                        <label className="flex items-center gap-2">
                                            <input type="radio" name="portfolio-import-policy" checked={policy === 'add-only'} onChange={() => { setPolicy('add-only'); setReplacementAcknowledged(false); }} />
                                            Add only (default)
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input type="radio" name="portfolio-import-policy" checked={policy === 'replace-matching'} onChange={() => setPolicy('replace-matching')} />
                                            Replace exact matches
                                        </label>
                                    </div>
                                </fieldset>
                                {replacementCount > 0 ? (
                                    <label className={'mt-3 flex items-start gap-2 text-xs ' + styles.risk}>
                                        <input type="checkbox" checked={replacementAcknowledged} onChange={(event) => setReplacementAcknowledged(event.target.checked)} />
                                        <span>I acknowledge that {replacementCount} exact matching local row{replacementCount === 1 ? '' : 's'} will be replaced. Unrelated rows will remain.</span>
                                    </label>
                                ) : null}
                                <label className={'mt-3 flex items-start gap-2 text-xs ' + styles.textSecondary}>
                                    <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                                    <span>I reviewed the complete preview and confirm saving the accepted rows locally.</span>
                                </label>
                                <button
                                    type="button"
                                    disabled={
                                        !incoming
                                        || incoming.holdings.length + incoming.cashBalances.length === 0
                                        || !confirmed
                                        || (replacementCount > 0 && !replacementAcknowledged)
                                        || restore.status === 'unavailable'
                                        || (restore.status === 'invalid' && !invalidStorageAcknowledged)
                                    }
                                    onClick={persist}
                                    className={'mt-3 min-h-10 rounded-md border px-4 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 ' + styles.panelAction}
                                >
                                    Save accepted snapshot
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
