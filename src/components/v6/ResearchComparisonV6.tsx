'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import { buildComparisonMetrics, type ComparisonMetrics } from '@/lib/research/comparison';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import { parseResearchSnapshotResponse } from './research-snapshot-v6';
import { getActionToneV6, getResearchActionV6, getThemeV6, type ResearchThemeV6 } from './research-v6';

type ComparisonResult =
    | { readonly state: 'loading'; readonly symbol: string }
    | { readonly state: 'ready'; readonly symbol: string; readonly snapshot: ResearchSnapshot; readonly metrics: ComparisonMetrics }
    | { readonly state: 'error'; readonly symbol: string; readonly message: string };

const metricRows: readonly { readonly key: keyof ComparisonMetrics; readonly label: string }[] = [
    { key: 'price', label: 'Price' },
    { key: 'dailyChange', label: 'Daily change' },
    { key: 'revenueGrowth', label: 'Revenue growth' },
    { key: 'operatingMargin', label: 'Operating margin' },
    { key: 'priceEarnings', label: 'Price / earnings' },
    { key: 'priceSales', label: 'Price / sales' },
    { key: 'freeCashFlowYield', label: 'Free cash flow yield' },
    { key: 'rsi', label: 'RSI (14)' },
    { key: 'versusMa50', label: 'Price vs MA50' },
    { key: 'versusMa200', label: 'Price vs MA200' },
];

export const ResearchComparisonV6 = ({ items, theme, onOpen }: {
    readonly items: readonly ResearchWatchlistItem[];
    readonly theme: ResearchThemeV6;
    readonly onOpen: (symbol: string) => void;
}) => {
    const initialSymbols = items.slice(0, 2).map((item) => item.symbol);
    const [selectedSymbols, setSelectedSymbols] = useState<readonly string[]>(initialSymbols);
    const [results, setResults] = useState<readonly ComparisonResult[]>([]);
    const styles = getThemeV6(theme);
    const selectedItems = useMemo(
        () => selectedSymbols.flatMap((symbol) => items.find((item) => item.symbol === symbol) ?? []),
        [items, selectedSymbols],
    );

    useEffect(() => {
        let active = true;
        const controller = new AbortController();
        const load = async () => {
            const loaded = await Promise.all(selectedItems.map(async (item): Promise<ComparisonResult> => {
                try {
                    const response = await fetch(`/api/research/symbol/${encodeURIComponent(item.symbol)}?market=${item.market}`, { signal: controller.signal });
                    const payload: unknown = await response.json();
                    if (!response.ok) return { state: 'error', symbol: item.symbol, message: 'Live data unavailable' };
                    const snapshot = parseResearchSnapshotResponse(payload);
                    return { state: 'ready', symbol: item.symbol, snapshot, metrics: buildComparisonMetrics(snapshot) };
                } catch (error) {
                    if (error instanceof DOMException && error.name === 'AbortError') return { state: 'loading', symbol: item.symbol };
                    return { state: 'error', symbol: item.symbol, message: error instanceof Error ? error.message : 'Live data unavailable' };
                }
            }));
            if (active) setResults(loaded);
        };
        void load();
        return () => { active = false; controller.abort(); };
    }, [selectedItems]);

    const toggleSymbol = (symbol: string) => {
        setSelectedSymbols((current) => {
            const valid = current.filter((item) => items.some((candidate) => candidate.symbol === item));
            return valid.includes(symbol)
                ? valid.filter((item) => item !== symbol)
                : valid.length < 3 ? [...valid, symbol] : valid;
        });
    };

    return (
        <section className="min-w-0 flex-1" aria-labelledby="comparison-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + styles.positive}>Research comparison</p>
                    <h1 id="comparison-title" className={'mt-1 text-xl font-bold ' + styles.textPrimary}>Compare evidence, not stories</h1>
                    <p className={'mt-1 text-sm ' + styles.textMuted}>Select up to three watchlist companies. Missing provider data stays visible.</p>
                </div>
                <span aria-live="polite" className={'text-xs ' + styles.textMuted}>{selectedItems.length}/3 selected</span>
            </div>

            <div className="research-scrollbar mt-4 flex gap-2 overflow-x-auto pb-2" aria-label="Companies to compare">
                {items.map((item) => {
                    const selected = selectedItems.some((candidate) => candidate.symbol === item.symbol);
                    const disabled = !selected && selectedItems.length >= 3;
                    return (
                        <label key={item.symbol} className={'flex min-h-10 shrink-0 items-center gap-2 rounded border px-3 text-xs font-semibold ' + (selected ? styles.selectedRow : styles.row) + (disabled ? ' opacity-45' : '')}>
                            <input type="checkbox" checked={selected} disabled={disabled} onChange={() => toggleSymbol(item.symbol)} />
                            {item.symbol}
                        </label>
                    );
                })}
            </div>

            {selectedItems.length === 0 ? (
                <div className={'mt-5 rounded-lg border p-8 text-center ' + styles.panel}>
                    <p className={'text-sm font-semibold ' + styles.textSecondary}>Select at least one company to begin.</p>
                </div>
            ) : (
                <div>
                    <p className={'mt-3 text-xs font-semibold min-[700px]:hidden ' + styles.textMuted}>Scroll horizontally to compare {selectedItems.length} companies</p>
                    <div className="research-scrollbar mt-2 overflow-x-auto min-[700px]:mt-3">
                    <table className={'w-full min-w-[680px] border-separate border-spacing-0 overflow-hidden rounded-lg border text-sm ' + styles.divider}>
                        <thead>
                            <tr>
                                <th className={'w-44 border-b p-3 text-left text-xs font-semibold ' + styles.divider + ' ' + styles.textMuted}>Metric</th>
                                {selectedItems.map((item) => {
                                    const action = getResearchActionV6(item);
                                    return (
                                        <th key={item.symbol} className={'border-b p-3 text-left ' + styles.divider}>
                                            <button type="button" onClick={() => onOpen(item.symbol)} className={'min-h-10 min-w-10 font-mono text-base font-bold ' + styles.textPrimary}>{item.symbol}</button>
                                            <p className={'mt-1 text-xs font-medium ' + getActionToneV6(action, theme)}>{action}</p>
                                            {results.find((result) => result.symbol === item.symbol)?.state === 'error'
                                                ? <p className={'mt-1 text-[11px] font-medium ' + styles.risk}>Live data unavailable</p> : null}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {metricRows.map((row) => (
                                <tr key={row.key}>
                                    <th className={'border-b p-3 text-left text-xs font-medium ' + styles.divider + ' ' + styles.textMuted}>{row.label}</th>
                                    {selectedItems.map((item) => {
                                        const result = results.find((candidate) => candidate.symbol === item.symbol);
                                        const value = result?.state === 'ready' ? result.metrics[row.key]
                                            : result?.state === 'error' ? 'Unavailable' : 'Loading...';
                                        return <td key={item.symbol} className={'border-b p-3 font-mono font-semibold tabular-nums ' + styles.divider + ' ' + styles.textSecondary}>{value}</td>;
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                </div>
            )}
            <p className={'mt-3 text-xs leading-5 ' + styles.textMuted}>Comparison uses the same free Yahoo Finance and SEC EDGAR snapshots as the research view. It is evidence for review, not a recommendation.</p>
        </section>
    );
};
