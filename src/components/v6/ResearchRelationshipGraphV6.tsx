'use client';

import { useMemo, useState } from 'react';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import {
    buildResearchRelationshipGraph,
    relationshipsForSymbol,
} from '@/lib/research/relationship-graph';
import type { ResearchRecord } from '@/lib/types/research';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type RelationshipFilter = 'all' | 'sector' | 'provider';

export const ResearchRelationshipGraphV6 = ({ records, items, theme, onOpen }: {
    readonly records: readonly ResearchRecord[];
    readonly items: readonly ResearchWatchlistItem[];
    readonly theme: ResearchThemeV6;
    readonly onOpen: (symbol: string) => void;
}) => {
    const [selectedSymbol, setSelectedSymbol] = useState(records[0]?.symbol ?? '');
    const [filter, setFilter] = useState<RelationshipFilter>('all');
    const styles = getThemeV6(theme);
    const itemBySymbol = useMemo(() => new Map(items.map((item) => [item.symbol, item])), [items]);
    const graph = useMemo(() => buildResearchRelationshipGraph(records.map((record) => ({
        symbol: record.symbol,
        market: record.market,
        sector: itemBySymbol.get(record.symbol)?.sector ?? 'Unknown',
        providers: record.acceptedEvidence.flatMap((evidence) => evidence.sources.map((source) => source.source)),
    }))), [itemBySymbol, records]);
    const selected = graph.nodes.some((node) => node.symbol === selectedSymbol)
        ? selectedSymbol
        : graph.nodes[0]?.symbol ?? '';
    const relationships = relationshipsForSymbol(graph, selected).filter((edge) =>
        filter === 'all' || (filter === 'sector' ? edge.sharedSector !== null : edge.sharedProviders.length > 0));

    return (
        <section className="min-w-0 flex-1" aria-labelledby="relationship-graph-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + styles.positive}>Research connections</p>
                    <h1 id="relationship-graph-title" className={'mt-1 text-xl font-bold ' + styles.textPrimary}>Relationship graph</h1>
                    <p className={'mt-1 max-w-3xl text-sm leading-6 ' + styles.textMuted}>Connect saved research only when tickers share an explicit watchlist sector or an accepted-evidence provider. Signal does not infer themes, competitors, supply chains, or causality.</p>
                </div>
                <span className={'text-xs ' + styles.textMuted}>{graph.nodes.length} nodes · {graph.edges.length} explicit links</span>
            </div>

            {graph.nodes.length === 0 ? (
                <div className={'mt-5 rounded-lg border p-8 text-center ' + styles.panel}>
                    <h2 className={'text-base font-bold ' + styles.textPrimary}>No saved research to connect</h2>
                    <p className={'mt-2 text-sm ' + styles.textMuted}>Save at least two ticker records to build explicit relationships.</p>
                </div>
            ) : (
                <>
                    <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)]">
                        <label className={'text-xs font-semibold ' + styles.textMuted}>Focus ticker
                            <select aria-label="Relationship focus ticker" value={selected} onChange={(event) => setSelectedSymbol(event.target.value)} className={'mt-1 min-h-10 w-full rounded-md border px-3 ' + styles.panelSolid}>
                                {graph.nodes.map((node) => <option key={node.symbol} value={node.symbol}>{node.symbol} · {node.sector}</option>)}
                            </select>
                        </label>
                        <div>
                            <span className={'text-xs font-semibold ' + styles.textMuted}>Relationship type</span>
                            <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label="Relationship type">
                                {(['all', 'sector', 'provider'] as const).map((option) => (
                                    <button key={option} type="button" aria-pressed={filter === option} onClick={() => setFilter(option)} className={'min-h-10 rounded-md border px-3 text-xs font-semibold ' + (filter === option ? styles.selectedRow : styles.row)}>
                                        {option === 'all' ? 'All' : option === 'sector' ? 'Shared sector' : 'Shared provider'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <section className={'mt-4 rounded-lg border p-4 ' + styles.panelSecondary} aria-labelledby="focused-relationships-title">
                        <h2 id="focused-relationships-title" className={'text-sm font-bold ' + styles.textPrimary}>{selected} connections</h2>
                        {relationships.length === 0 ? <p className={'mt-3 text-xs ' + styles.textMuted}>No explicit relationships match this filter.</p> : (
                            <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {relationships.map((edge) => {
                                    const peer = edge.left === selected ? edge.right : edge.left;
                                    return (
                                        <li key={edge.id} className={'rounded-lg border p-4 ' + styles.panelUtility}>
                                            <button type="button" onClick={() => onOpen(peer)} className={'min-h-10 font-mono text-sm font-bold ' + styles.textPrimary}>{peer}</button>
                                            <ul className={'mt-2 space-y-1 text-xs leading-5 ' + styles.textMuted}>
                                                {edge.sharedSector ? <li>Shared sector: {edge.sharedSector}</li> : null}
                                                {edge.sharedProviders.map((provider) => <li key={provider}>Shared provider: {provider}</li>)}
                                            </ul>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>

                    <section className={'mt-4 rounded-lg border p-4 ' + styles.panelSecondary} aria-labelledby="relationship-inventory-title">
                        <h2 id="relationship-inventory-title" className={'text-sm font-bold ' + styles.textPrimary}>Node inventory</h2>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {graph.nodes.map((node) => (
                                <button key={node.symbol} type="button" onClick={() => setSelectedSymbol(node.symbol)} aria-pressed={selected === node.symbol} className={'min-h-10 rounded-full border px-4 text-xs font-semibold ' + (selected === node.symbol ? styles.selectedRow : styles.row)}>
                                    {node.symbol} · {node.sector} · {node.market}
                                </button>
                            ))}
                        </div>
                    </section>
                </>
            )}
        </section>
    );
};
