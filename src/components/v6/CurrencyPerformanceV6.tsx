'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import {
    calculateCurrencyPerformance,
    defaultCurrencyPerformanceSettings,
    type CurrencyPerformanceSettings,
} from '@/lib/research/currency-performance';
import {
    readCurrencyPerformanceSettings,
    writeCurrencyPerformanceSettings,
} from '@/lib/research/currency-performance-client';
import type { ResearchRecord } from '@/lib/types/research';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

const tone = (value: number | null, positive: string, risk: string, muted: string) =>
    value === null ? muted : value >= 0 ? positive : risk;
const percent = (value: number | null) => value === null ? 'Unavailable' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

export const CurrencyPerformanceV6 = ({ records, items, theme, onOpen }: {
    readonly records: readonly ResearchRecord[];
    readonly items: readonly ResearchWatchlistItem[];
    readonly theme: ResearchThemeV6;
    readonly onOpen: (symbol: string) => void;
}) => {
    const styles = getThemeV6(theme);
    const [settings, setSettings] = useState<CurrencyPerformanceSettings>(defaultCurrencyPerformanceSettings);
    const [savedStatus, setSavedStatus] = useState<string | null>(null);

    useEffect(() => {
        const timer = window.setTimeout(() => setSettings(readCurrencyPerformanceSettings()), 0);
        return () => window.clearTimeout(timer);
    }, []);

    const results = useMemo(() => records.map((record) => calculateCurrencyPerformance(
        record,
        items.find((item) => item.symbol === record.symbol)?.price ?? null,
        settings,
    )), [items, records, settings]);
    const available = results.filter((result) => result.available);

    const updateAdjustment = (symbol: string, key: 'dividendsPercent' | 'feesPercent', value: number) => setSettings((current) => ({
        ...current,
        adjustments: [
            ...current.adjustments.filter((item) => item.symbol !== symbol),
            {
                symbol,
                dividendsPercent: key === 'dividendsPercent' ? value : current.adjustments.find((item) => item.symbol === symbol)?.dividendsPercent ?? 0,
                feesPercent: key === 'feesPercent' ? value : current.adjustments.find((item) => item.symbol === symbol)?.feesPercent ?? 0,
            },
        ],
    }));

    return <section data-testid="currency-performance" aria-labelledby="currency-performance-title" className="min-w-0 flex-1">
        <div className="max-w-3xl">
            <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + styles.positive}>Base-currency decision context</p>
            <h1 id="currency-performance-title" className={'mt-1 text-xl font-bold ' + styles.textPrimary}>Multi-currency performance</h1>
            <p className={'mt-2 text-sm leading-6 ' + styles.textSecondary}>Separate security-price return from FX contribution using your own entry and current USD/MYR assumptions. Signal does not fetch or silently substitute an exchange rate.</p>
        </div>

        <section className={'mt-5 rounded border p-4 ' + styles.panelUtility} aria-labelledby="currency-settings-title">
            <div className="flex flex-wrap items-end gap-3">
                <h2 id="currency-settings-title" className={'w-full text-sm font-bold ' + styles.textPrimary}>Performance assumptions</h2>
                <label className={'min-w-40 flex-1 text-xs font-semibold ' + styles.textMuted}>Base currency
                    <select value={settings.baseCurrency} onChange={(event) => setSettings((current) => ({ ...current, baseCurrency: event.target.value as 'MYR' | 'USD' }))} className={'mt-1 h-11 w-full rounded border px-3 text-sm ' + styles.panelSolid + ' ' + styles.textPrimary}>
                        <option value="MYR">MYR</option><option value="USD">USD</option>
                    </select>
                </label>
                <label className={'min-w-40 flex-1 text-xs font-semibold ' + styles.textMuted}>Entry USD/MYR
                    <input type="number" min="0.1" max="20" step="0.01" value={settings.entryUsdMyr} onChange={(event) => setSettings((current) => ({ ...current, entryUsdMyr: Math.min(20, Math.max(0.1, Number(event.target.value) || 0.1)) }))} className={'mt-1 h-11 w-full rounded border px-3 text-sm ' + styles.panelSolid + ' ' + styles.textPrimary} />
                </label>
                <label className={'min-w-40 flex-1 text-xs font-semibold ' + styles.textMuted}>Current USD/MYR
                    <input type="number" min="0.1" max="20" step="0.01" value={settings.currentUsdMyr} onChange={(event) => setSettings((current) => ({ ...current, currentUsdMyr: Math.min(20, Math.max(0.1, Number(event.target.value) || 0.1)) }))} className={'mt-1 h-11 w-full rounded border px-3 text-sm ' + styles.panelSolid + ' ' + styles.textPrimary} />
                </label>
                <button type="button" onClick={() => {
                    setSettings(writeCurrencyPerformanceSettings(settings));
                    setSavedStatus('Currency assumptions saved in this browser.');
                }} className="min-h-11 rounded bg-emerald-500 px-4 text-sm font-bold text-slate-950">Save assumptions</button>
            </div>
            {savedStatus ? <p role="status" className={'mt-2 text-xs ' + styles.positive}>{savedStatus}</p> : null}
        </section>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
                ['Records checked', results.length],
                ['Performance available', available.length],
                ['Needs cost or price', results.length - available.length],
            ].map(([label, value]) => <div key={String(label)} className={'rounded border p-3 ' + styles.panelUtility}><p className={'text-xs ' + styles.textMuted}>{label}</p><p className={'mt-1 text-2xl font-bold ' + styles.textPrimary}>{value}</p></div>)}
        </div>

        <ul className={'mt-4 divide-y border-y ' + styles.divider}>
            {results.map((result) => {
                const adjustment = settings.adjustments.find((item) => item.symbol === result.symbol);
                return <li key={result.symbol} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className={'text-sm font-bold ' + styles.textPrimary}>{result.symbol}</h2>
                                <span className={'rounded border px-2 py-0.5 text-[10px] font-bold uppercase ' + styles.row}>{result.quoteCurrency} → {result.baseCurrency}</span>
                                {!result.available ? <span className={'rounded border px-2 py-0.5 text-[10px] font-bold uppercase ' + styles.risk}>Inputs required</span> : null}
                            </div>
                            {result.available ? <div className="mt-3 grid gap-3 sm:grid-cols-4">
                                {[
                                    ['Price return', result.priceReturnPercent],
                                    ['FX contribution', result.fxReturnPercent],
                                    ['After adjustments', result.totalReturnPercent],
                                    ['Vs saved benchmark', result.relativeToSavedBenchmarkPercent],
                                ].map(([label, value]) => <div key={String(label)}><p className={'text-[11px] ' + styles.textMuted}>{label}</p><p className={'mt-1 font-mono text-sm font-bold ' + tone(value as number | null, styles.positive, styles.risk, styles.textMuted)}>{percent(value as number | null)}</p></div>)}
                            </div> : <p className={'mt-2 text-xs leading-5 ' + styles.textMuted}>Save a positive average cost or planned entry price in Research and wait for a current quote. Missing inputs remain unavailable rather than being estimated.</p>}
                            <div className="mt-3 flex flex-wrap gap-3">
                                <label className={'text-[11px] font-semibold ' + styles.textMuted}>Dividends (% of entry value)
                                    <input type="number" min="0" max="100" step="0.1" value={adjustment?.dividendsPercent ?? 0} onChange={(event) => updateAdjustment(result.symbol, 'dividendsPercent', Math.min(100, Math.max(0, Number(event.target.value) || 0)))} className={'mt-1 h-10 w-36 rounded border px-3 text-xs ' + styles.panelSolid + ' ' + styles.textPrimary} />
                                </label>
                                <label className={'text-[11px] font-semibold ' + styles.textMuted}>Fees (% of entry value)
                                    <input type="number" min="0" max="100" step="0.1" value={adjustment?.feesPercent ?? 0} onChange={(event) => updateAdjustment(result.symbol, 'feesPercent', Math.min(100, Math.max(0, Number(event.target.value) || 0)))} className={'mt-1 h-10 w-36 rounded border px-3 text-xs ' + styles.panelSolid + ' ' + styles.textPrimary} />
                                </label>
                            </div>
                        </div>
                        <button type="button" onClick={() => onOpen(result.symbol)} className={'min-h-10 shrink-0 rounded border px-3 text-xs font-semibold ' + styles.row}>Open research</button>
                    </div>
                </li>;
            })}
        </ul>

        <p className={'mt-4 text-xs leading-5 ' + styles.textMuted}>After-adjustment return combines price and FX multiplicatively, then applies user-entered dividend and fee percentages. “Vs saved benchmark” uses the benchmark context stored with the review and may not share the same holding period; it is context, not performance attribution.</p>
    </section>;
};
