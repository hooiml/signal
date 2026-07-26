'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import { buildPeerBenchmark } from '@/lib/research/peer-benchmark';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import { parseResearchSnapshotResponse } from './research-snapshot-v6';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';
import { trackProductAnalyticsEvent } from '@/lib/product-analytics-client';

type SnapshotState = {
    readonly key: string;
    readonly snapshots: ReadonlyMap<string, ResearchSnapshot>;
    readonly failures: readonly string[];
};

const initialPeers = (items: readonly ResearchWatchlistItem[], subject: string): readonly string[] => {
    const selected = items.find((item) => item.symbol === subject);
    if (!selected) return [];
    const sameIndustry = items.filter((item) => item.symbol !== subject && item.industry === selected.industry);
    const sameSector = items.filter((item) => item.symbol !== subject && item.sector === selected.sector && !sameIndustry.some((peer) => peer.symbol === item.symbol));
    return [...sameIndustry, ...sameSector].slice(0, 5).map((item) => item.symbol);
};

const formatMetric = (value: number | null, suffix: string) =>
    value === null ? 'Unavailable' : `${value.toFixed(2)}${suffix}`;

export const ResearchPeerBenchmarkV6 = ({ items, theme, onOpen }: {
    readonly items: readonly ResearchWatchlistItem[];
    readonly theme: ResearchThemeV6;
    readonly onOpen: (symbol: string) => void;
}) => {
    const firstSymbol = items[0]?.symbol ?? '';
    const [subject, setSubject] = useState(firstSymbol);
    const [peerSymbols, setPeerSymbols] = useState<readonly string[]>(() => initialPeers(items, firstSymbol));
    const [state, setState] = useState<SnapshotState>({ key: '', snapshots: new Map(), failures: [] });
    const styles = getThemeV6(theme);
    const selectedItem = items.find((item) => item.symbol === subject) ?? null;
    const targetSymbols = useMemo(() => [subject, ...peerSymbols].filter(Boolean), [peerSymbols, subject]);
    const targetKey = targetSymbols.join('|');
    const needsLoad = targetSymbols.length > 0 && state.key !== targetKey;
    const currentSnapshots = state.key === targetKey ? state.snapshots : new Map<string, ResearchSnapshot>();
    const currentFailures = state.key === targetKey ? state.failures : [];

    useEffect(() => {
        if (targetSymbols.length === 0 || state.key === targetKey) return;
        const controller = new AbortController();
        void Promise.allSettled(targetSymbols.map(async (symbol) => {
            const item = items.find((candidate) => candidate.symbol === symbol);
            if (!item) throw new Error(symbol);
            const response = await fetch(`/api/research/symbol/${encodeURIComponent(symbol)}?market=${item.market}`, { signal: controller.signal });
            const payload: unknown = await response.json();
            if (!response.ok) throw new Error(symbol);
            return parseResearchSnapshotResponse(payload);
        })).then((results) => {
            const snapshots = new Map<string, ResearchSnapshot>();
            const failures: string[] = [];
            for (const result of results) {
                if (result.status === 'fulfilled') snapshots.set(result.value.symbol, result.value);
                else if (!(result.reason instanceof DOMException && result.reason.name === 'AbortError')) failures.push(result.reason instanceof Error ? result.reason.message : 'Unknown');
            }
            setState({ key: targetKey, snapshots, failures });
        });
        return () => controller.abort();
    }, [items, state.key, targetKey, targetSymbols]);

    const subjectSnapshot = currentSnapshots.get(subject) ?? null;
    const peerSnapshots = peerSymbols.flatMap((symbol) => currentSnapshots.get(symbol) ?? []);
    const benchmark = subjectSnapshot ? buildPeerBenchmark(subjectSnapshot, peerSnapshots) : null;

    const changeSubject = (symbol: string) => {
        setSubject(symbol);
        setPeerSymbols(initialPeers(items, symbol));
        setState({ key: '', snapshots: new Map(), failures: [] });
    };
    const togglePeer = (symbol: string) => setPeerSymbols((current) => {
        const exists = current.includes(symbol);
        const next = exists ? current.filter((candidate) => candidate !== symbol)
            : current.length < 5 ? [...current, symbol] : current;
        if (next !== current) {
            trackProductAnalyticsEvent({
                name: 'peer_set_changed',
                surface: 'research',
                workspace: 'peers',
                attributes: { change: exists ? 'remove' : 'add' },
            });
        }
        return next;
    });

    if (items.length === 0) return <section className={'min-h-72 flex-1 p-8 text-center text-sm ' + styles.textMuted}>Add companies to Research before building a peer set.</section>;

    return (
        <section className="min-w-0 flex-1" aria-labelledby="peer-benchmark-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + styles.positive}>Relative evidence</p>
                    <h1 id="peer-benchmark-title" className={'mt-1 text-xl font-bold ' + styles.textPrimary}>Peer and sector benchmarking</h1>
                    <p className={'mt-1 max-w-3xl text-sm leading-6 ' + styles.textMuted}>Compare one company with an editable watchlist peer set. Suggestions use the same industry first, then the same sector; they never determine the saved decision.</p>
                </div>
                <span className={'text-xs ' + styles.textMuted}>{peerSymbols.length}/5 peers selected</span>
            </div>

            <div className={'mt-5 grid gap-4 rounded-lg border p-4 lg:grid-cols-[240px_minmax(0,1fr)] ' + styles.panelSecondary}>
                <label className={'text-xs font-semibold ' + styles.textMuted}>Company to benchmark
                    <select value={subject} onChange={(event) => changeSubject(event.target.value)} className={'mt-1 min-h-10 w-full rounded border bg-transparent px-3 text-sm ' + styles.textPrimary}>
                        {items.map((item) => <option key={item.symbol} value={item.symbol}>{item.symbol} · {item.name}</option>)}
                    </select>
                </label>
                <fieldset>
                    <legend className={'text-xs font-semibold ' + styles.textMuted}>Editable peer set</legend>
                    <div className="mt-1 flex flex-wrap gap-2">
                        {items.filter((item) => item.symbol !== subject).map((item) => {
                            const checked = peerSymbols.includes(item.symbol);
                            const disabled = !checked && peerSymbols.length >= 5;
                            const reason = selectedItem && item.industry === selectedItem.industry ? 'Same industry'
                                : selectedItem && item.sector === selectedItem.sector ? 'Same sector' : 'Custom watchlist peer';
                            return (
                                <label key={item.symbol} title={reason} className={'flex min-h-10 items-center gap-2 rounded border px-3 text-xs ' + (checked ? styles.selectedRow : styles.row) + (disabled ? ' opacity-45' : '')}>
                                    <input type="checkbox" checked={checked} disabled={disabled} onChange={() => togglePeer(item.symbol)} />
                                    <span className="font-mono font-bold">{item.symbol}</span>
                                    <span className={styles.textMuted}>{reason}</span>
                                </label>
                            );
                        })}
                    </div>
                </fieldset>
            </div>

            {needsLoad ? <p className={'mt-5 text-sm ' + styles.textMuted}>Loading validated company and peer snapshots…</p> : null}
            {!needsLoad && !subjectSnapshot ? (
                <div className={'mt-5 rounded-lg border p-8 text-center ' + styles.panel}>
                    <h2 className={'text-base font-bold ' + styles.textPrimary}>Benchmark data unavailable</h2>
                    <p className={'mt-2 text-sm ' + styles.textMuted}>The selected company snapshot could not be loaded. Change the company or retry later.</p>
                </div>
            ) : benchmark ? (
                <>
                    <section className={'mt-5 rounded-lg border p-4 ' + styles.panelSecondary} aria-labelledby="peer-metrics-title">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h2 id="peer-metrics-title" className={'text-sm font-bold ' + styles.textPrimary}>{subject} versus selected peers</h2>
                                <p className={'mt-1 text-xs ' + styles.textMuted}>{peerSnapshots.length} peer snapshot{peerSnapshots.length === 1 ? '' : 's'} loaded · reporting periods and currency may differ</p>
                            </div>
                            <button type="button" onClick={() => onOpen(subject)} className={'min-h-10 rounded border px-3 text-xs font-semibold ' + styles.row}>Open {subject} research</button>
                        </div>
                        <div className="research-scrollbar mt-3 overflow-x-auto">
                            <table className="w-full min-w-[700px] text-left text-xs">
                                <thead><tr className={styles.textMuted}><th className="pb-2">Metric</th><th className="pb-2 text-right">{subject}</th><th className="pb-2 text-right">Peer median</th><th className="pb-2 text-right">Percentile</th><th className="pb-2 text-right">Coverage</th></tr></thead>
                                <tbody>{benchmark.metrics.map((metric) => (
                                    <tr key={metric.key} className={'border-t ' + styles.divider}>
                                        <th className={'py-3 font-semibold ' + styles.textSecondary}>{metric.label}</th>
                                        <td className={'py-3 text-right font-mono font-bold ' + styles.textPrimary}>{formatMetric(metric.subjectValue, metric.suffix)}</td>
                                        <td className={'py-3 text-right font-mono ' + styles.textSecondary}>{formatMetric(metric.peerMedian, metric.suffix)}</td>
                                        <td className={'py-3 text-right font-mono ' + styles.textSecondary}>{metric.percentile === null ? 'Unavailable' : `${metric.percentile}th`}</td>
                                        <td className={'py-3 text-right font-mono ' + styles.textMuted}>{metric.peerCoverage}/{peerSymbols.length}</td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                    </section>

                    <section className={'mt-5 rounded-lg border p-4 ' + styles.panelUtility}>
                        <h2 className={'text-sm font-bold ' + styles.textPrimary}>Historical valuation band</h2>
                        <p className={'mt-2 text-xs leading-5 ' + styles.textMuted}>Unavailable from the connected free snapshots. Signal will not combine today’s filing fundamentals with old prices and present the result as a historical valuation series. Current valuation remains visible above with its reporting-period limitations.</p>
                    </section>
                </>
            ) : null}

            {currentFailures.length > 0 ? <p role="status" className={'mt-3 text-xs ' + styles.risk}>{currentFailures.length} selected symbol{currentFailures.length === 1 ? '' : 's'} could not be loaded; available peers remain usable.</p> : null}
        </section>
    );
};
