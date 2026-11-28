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
import type { DiscoveryContender, InstitutionalOwnershipEvidence, QualityDiscoveryResult } from '@/lib/types/research-discovery';
import type { DiscoveryScan } from './ResearchDiscoverV8';
import { retrievedAt } from './research-v8-connected-data';
import styles from './research-discover-v8.module.css';

type Row = QualityDiscoveryResult | DiscoveryContender;

export const signedPercent = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)}%`;
export const direction = (value: number) => value > 0 ? 'up' : value < 0 ? 'down' : 'flat';

// Quarterly holder filings: a delayed disclosure balance, never described as current buying.
const holderLabel = (ownership: InstitutionalOwnershipEvidence | null) => ownership === null ? 'Holder filings unavailable'
    : `Holder filings: ${ownership.activity === 'increases-led' ? 'increases led' : ownership.activity === 'decreases-led' ? 'decreases led' : 'mixed'}${ownership.institutionalOwnershipPercent === null ? '' : ` · ${ownership.institutionalOwnershipPercent.toFixed(0)}% institutional`}`;

export function ScanStatus({ scan }: { scan: DiscoveryScan }) {
    if (scan.error) return <p role="alert">{scan.error} <button className={styles.secondary} onClick={scan.retry}>Retry scan</button></p>;
    return <p role="status">Scanning liquid US trend candidates… The first scan of the hour can take up to a minute.</p>;
}

// Top 20 of the existing Trend Discovery scan: 10 Leaders, with the 10 Contenders one click away.
export function ResearchTrendingV8({
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
    const [showContenders, setShowContenders] = useState(false);
    const [filters, setFilters] = useState<DiscoveryFilterState>(defaultDiscoveryFilterState);
    const [peekSymbol, setPeekSymbol] = useState<string | null>(null);
    const [savingSymbol, setSavingSymbol] = useState<string | null>(null);
    const [saveError, setSaveError] = useState('');
    const { data } = scan;

    const savedSet = useMemo(
        () => new Set(savedSymbols.map(symbol => symbol.trim().toUpperCase())),
        [savedSymbols],
    );

    const allRows = useMemo(() => {
        if (!data) return [] as { row: Row; rank: number; group: 'Leader' | 'Contender' }[];
        return [
            ...data.candidates.slice(0, 10).map((row, index) => ({ row, rank: index + 1, group: 'Leader' as const })),
            ...data.contenders.slice(0, 10).map((row, index) => ({ row, rank: Math.min(data.candidates.length, 10) + index + 1, group: 'Contender' as const })),
        ];
    }, [data]);

    const sectors = useMemo(
        () => extractDiscoverySectors(allRows.map(item => item.row)),
        [allRows],
    );

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

    const visiblePool = showContenders ? allRows : allRows.filter(({ group }) => group === 'Leader');
    const filteredPool = isV9
        ? visiblePool.filter(item => filterDiscoveryRows([item.row], filters, savedSet).length > 0)
        : visiblePool;
    const leaderCount = allRows.filter(({ group }) => group === 'Leader').length;
    const filtersActive = filters.sector !== 'all' || filters.lowRiskOnly || filters.hideSaved;
    const peekRow = peekSymbol ? allRows.find(item => item.row.symbol === peekSymbol)?.row ?? null : null;

    return <>
        <p className={styles.meta}>{data.scannedCount} of {data.universeSize} stocks scanned · {retrievedAt(data.generatedAt)}</p>
        <details className={styles.method}>
            <summary>How this list is built</summary>
            <p>Ranked by sustained 3- and 6-month momentum and SEC-confirmed business quality. A research shortlist, not a buy recommendation or a forecast. High-risk and fundamentally unsupported names are excluded. Holder filings are delayed quarterly 13F disclosures, not evidence of current buying.</p>
        </details>
        {isV9 && (
            <div className={styles.filterBar} data-testid="discover-filter-bar" role="group" aria-label="Filter trending candidates">
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
        {filteredPool.length === 0 ? (
            <p className={styles.meta}>
                {allRows.length === 0
                    ? 'No candidates passed the current eligibility checks.'
                    : <>No candidates match the active filters. <button type="button" className={styles.link} onClick={() => setFilters(defaultDiscoveryFilterState)}>Reset filters</button></>}
            </p>
        ) : <ol className={styles.list} data-testid="research-trending" data-v9-peek={isV9 ? 'true' : undefined}>
            <li className={styles.head} aria-hidden="true"><span>#</span><span>Stock</span><span>Score</span><span className={styles.num}>3M</span><span className={styles.num}>6M</span><span>Risk</span><span>Category</span>{isV9 && <span />}</li>
            {filteredPool.map(({ row, rank, group }) => {
                const isSaved = savedSet.has(row.symbol.trim().toUpperCase());
                const delta = isV9 ? formatDiscoveryRankDelta(row) : null;
                const rowButton = (
                    <button type="button" onClick={() => onSelect(row.symbol)} aria-label={`Read ${row.symbol}, ${row.name}, rank ${rank}`}>
                        <span className={styles.rank}>{rank}</span>
                        <span className={styles.name}>
                            <span className={styles.titleLine}>
                                <b>{row.symbol}</b>
                                {isV9 && isSaved && <span className={styles.savedBadge} data-testid="discover-saved-badge">Saved</span>}
                                {delta && <span className={styles.deltaBadge} data-tone={delta.tone} data-testid="discover-rank-delta" title={delta.title}>{delta.label}</span>}
                            </span>
                            <small>{row.name} · ${row.price.toFixed(2)}</small>
                        </span>
                        <span className={styles.score}><b>{row.discoveryScore}</b><small>trend {row.trendScore} · quality {row.qualityScore ?? '—'}</small></span>
                        <span className={styles.move} data-direction={direction(row.momentum3MonthPercent)}><small>3M </small>{signedPercent(row.momentum3MonthPercent)}</span>
                        <span className={styles.move} data-direction={direction(row.momentum6MonthPercent)}><small>6M </small>{signedPercent(row.momentum6MonthPercent)}</span>
                        <span className={styles.risk} data-risk={row.risk}>{row.risk} risk</span>
                        <span className={styles.category}>{row.category}<small>{'contenderReason' in row ? `Contender · ${row.contenderReason}` : row.catalyst ? `Earnings ${row.catalyst.date}` : ''}</small><small className={styles.holders} data-activity={row.ownership?.activity ?? 'unavailable'} title={row.ownership?.reportPeriod ? `Latest listed holder report ${row.ownership.reportPeriod}` : undefined}>{holderLabel(row.ownership)}</small></span>
                    </button>
                );

                if (!isV9) {
                    return <li key={row.symbol} data-group={group}>{rowButton}</li>;
                }

                return (
                    <li key={row.symbol} data-group={group} className={styles.rowWrap}>
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
        {allRows.length > leaderCount && <button className={styles.more} aria-expanded={showContenders} onClick={() => setShowContenders(value => !value)}>{showContenders ? 'Hide contenders' : `Show ${allRows.length - leaderCount} contenders`}</button>}
        {data.warnings.map(warning => <p key={warning} className={styles.meta}>{warning}</p>)}
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
