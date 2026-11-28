'use client';

import { useCallback, useContext, useMemo, useState } from 'react';
import { V9DiscoverQuickPeekDrawer } from '@/components/v9/V9DiscoverQuickPeekDrawer';
import { V9Navigation } from '@/components/v9/v9-navigation';
import {
    defaultDiscoveryFilterState,
    extractDiscoverySectors,
    filterDiscoveryRows,
    formatDiscoveryRankDelta,
    type DiscoveryFilterState,
} from '@/lib/research/discover-v9';
import type { QualityDiscoveryResult } from '@/lib/types/research-discovery';
import type { DiscoveryScan } from './ResearchDiscoverV8';
import { direction, ScanStatus, signedPercent } from './ResearchTrendingV8';
import { retrievedAt } from './research-v8-connected-data';
import styles from './research-discover-v8.module.css';

const stageLabel = (row: QualityDiscoveryResult) => row.earlyTrendStage === 'emerging' ? 'Emerging' : 'Confirmed';

// Controlled moves from the same scan that have not yet become extended; emerging stages rank first.
export function ResearchEarlyTrendsV8({
    scan,
    savedSymbols = [],
    onSelect,
    onSaveToWatchlist,
}: {
    scan: DiscoveryScan;
    savedSymbols?: readonly string[];
    onSelect: (symbol: string) => void;
    onSaveToWatchlist?: (symbol: string, name: string) => Promise<{ ok: boolean; error?: string }>;
}) {
    const isV9 = Boolean(useContext(V9Navigation));
    const [filters, setFilters] = useState<DiscoveryFilterState>(defaultDiscoveryFilterState);
    const [peekSymbol, setPeekSymbol] = useState<string | null>(null);
    const [savingSymbol, setSavingSymbol] = useState<string | null>(null);
    const [saveError, setSaveError] = useState('');
    const { data } = scan;

    const savedSet = useMemo(
        () => new Set(savedSymbols.map(symbol => symbol.trim().toUpperCase())),
        [savedSymbols],
    );

    const rows = useMemo(() => data?.emergingCandidates ?? [], [data]);
    const sectors = useMemo(() => extractDiscoverySectors(rows), [rows]);

    const closePeek = useCallback(() => {
        setPeekSymbol(null);
        setSaveError('');
    }, []);

    const handleSave = useCallback(async (symbol: string, name: string) => {
        if (!onSaveToWatchlist) return;
        setSavingSymbol(symbol);
        setSaveError('');
        const outcome = await onSaveToWatchlist(symbol, name);
        setSavingSymbol(null);
        if (!outcome.ok && outcome.error) {
            setSaveError(outcome.error);
        }
    }, [onSaveToWatchlist]);

    if (!data) return <ScanStatus scan={scan} />;

    const top20 = new Set([...data.candidates.slice(0, 10), ...data.contenders.slice(0, 10)].map(row => row.symbol));
    const filteredRows = isV9 ? filterDiscoveryRows(rows, filters, savedSet) : rows;
    const filtersActive = filters.sector !== 'all' || filters.lowRiskOnly || filters.hideSaved;
    const peekRow = peekSymbol ? rows.find(row => row.symbol === peekSymbol) ?? null : null;

    return <>
        <p className={styles.meta}>Trends that are starting, before the move is extended · {retrievedAt(data.generatedAt)}</p>
        <details className={styles.method}>
            <summary>How early trends are found</summary>
            <p>Same liquid US universe and risk rules as Trending. <b>Emerging</b>: price above its 200-day average, a positive six-month trend, at least 5% over three months, and between 2% below and 6% above its 50-day average. <b>Confirmed</b>: up to 12% above the 50-day average with at least 8% over three months. Moves above 35% in three months or more than 12% above the 50-day average are extended and left out. A research shortlist, not a buy recommendation or a forecast.</p>
        </details>
        {isV9 && (
            <div className={styles.filterBar} data-testid="discover-filter-bar" role="group" aria-label="Filter early trend candidates">
                <label className={styles.filterSelectWrap}>
                    <span className={styles.srOnly}>Sector</span>
                    <select
                        aria-label="Filter by sector"
                        value={filters.sector}
                        onChange={event => setFilters(current => ({ ...current, sector: event.target.value }))}
                    >
                        <option value="all">All sectors</option>
                        {sectors.map(sector => <option key={sector} value={sector}>{sector}</option>)}
                    </select>
                </label>
                <button
                    type="button"
                    className={styles.filterChip}
                    aria-pressed={filters.lowRiskOnly}
                    onClick={() => setFilters(current => ({ ...current, lowRiskOnly: !current.lowRiskOnly }))}
                >
                    Low risk only
                </button>
                <button
                    type="button"
                    className={styles.filterChip}
                    aria-pressed={filters.hideSaved}
                    onClick={() => setFilters(current => ({ ...current, hideSaved: !current.hideSaved }))}
                >
                    Hide saved
                </button>
                {filtersActive && (
                    <button
                        type="button"
                        className={styles.link}
                        onClick={() => setFilters(defaultDiscoveryFilterState)}
                    >
                        Reset
                    </button>
                )}
            </div>
        )}
        {filteredRows.length === 0 ? (
            <p className={styles.meta}>
                {rows.length === 0
                    ? 'No early trends passed the current checks.'
                    : <>No early trends match the active filters. <button type="button" className={styles.link} onClick={() => setFilters(defaultDiscoveryFilterState)}>Reset filters</button></>}
            </p>
        ) : <ol className={styles.list} data-testid="research-early-trends" data-v9-peek={isV9 ? 'true' : undefined}>
            <li className={`${styles.head} ${styles.earlyRow}`} aria-hidden="true"><span>#</span><span>Stock</span><span>Stage</span><span>Score</span><span className={styles.num}>3M</span><span className={styles.num}>6M</span><span>Risk</span>{isV9 && <span />}</li>
            {filteredRows.map((row, index) => {
                const isSaved = savedSet.has(row.symbol.trim().toUpperCase());
                const delta = isV9 ? formatDiscoveryRankDelta(row) : null;
                const rowButton = (
                    <button type="button" className={styles.earlyRow} onClick={() => onSelect(row.symbol)} aria-label={`Read ${row.symbol}, ${row.name}, ${stageLabel(row).toLowerCase()} trend`}>
                        <span className={styles.rank}>{index + 1}</span>
                        <span className={styles.name}>
                            <span className={styles.titleLine}>
                                <b>{row.symbol}</b>
                                {isV9 && isSaved && <span className={styles.savedBadge} data-testid="discover-saved-badge">Saved</span>}
                                {delta && <span className={styles.deltaBadge} data-tone={delta.tone} data-testid="discover-rank-delta" title={delta.title}>{delta.label}</span>}
                            </span>
                            <small>{row.name} · ${row.price.toFixed(2)}</small>
                        </span>
                        <span className={styles.stage} data-stage={row.earlyTrendStage}>{stageLabel(row)}<small>{signedPercent(row.distanceFromMa50Percent)} vs 50-day avg{top20.has(row.symbol) ? ' · also in Trending' : ''}</small></span>
                        <span className={styles.score}><b>{row.discoveryScore}</b><small>trend {row.trendScore} · quality {row.qualityScore ?? '—'}</small></span>
                        <span className={styles.move} data-direction={direction(row.momentum3MonthPercent)}><small>3M </small>{signedPercent(row.momentum3MonthPercent)}</span>
                        <span className={styles.move} data-direction={direction(row.momentum6MonthPercent)}><small>6M </small>{signedPercent(row.momentum6MonthPercent)}</span>
                        <span className={styles.risk} data-risk={row.risk}>{row.risk} risk</span>
                    </button>
                );

                if (!isV9) {
                    return <li key={row.symbol} data-stage={row.earlyTrendStage}>{rowButton}</li>;
                }

                return (
                    <li key={row.symbol} data-stage={row.earlyTrendStage} className={styles.rowWrap}>
                        {rowButton}
                        <button
                            type="button"
                            className={styles.peekBtn}
                            data-testid={`discover-peek-${row.symbol}`}
                            aria-label={`Quick peek ${row.symbol}`}
                            onClick={() => { setSaveError(''); setPeekSymbol(row.symbol); }}
                        >
                            Peek
                        </button>
                    </li>
                );
            })}
        </ol>}
        {isV9 && (
            <V9DiscoverQuickPeekDrawer
                row={peekRow}
                isSaved={peekRow ? savedSet.has(peekRow.symbol.trim().toUpperCase()) : false}
                saving={peekRow ? savingSymbol === peekRow.symbol : false}
                saveError={saveError}
                canSave={Boolean(onSaveToWatchlist)}
                onClose={closePeek}
                onOpenResearch={onSelect}
                onSaveToWatchlist={onSaveToWatchlist ? (symbol, name) => void handleSave(symbol, name) : undefined}
            />
        )}
    </>;
}
