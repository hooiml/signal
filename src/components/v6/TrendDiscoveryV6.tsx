'use client';

import { useEffect, useState } from 'react';
import { defaultDiscoveryFilters, filterDiscoveryCandidates, hasDiscoveryFilters } from '@/lib/research/discovery-filters';
import type { DiscoveryContender, DiscoveryResponse, DiscoveryResult, QualityDiscoveryResult } from '@/lib/types/research-discovery';
import { DiscoveryFiltersV6 } from './DiscoveryFiltersV6';
import { DiscoveryOwnershipEvidenceV6 } from './DiscoveryOwnershipEvidenceV6';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';
import { parseDiscoveryResponseV6 } from './research-discovery-response-v6';

type TrendDiscoveryV6Props = {
    readonly theme: ResearchThemeV6;
    readonly savedSymbols: readonly string[];
    readonly adding: boolean;
    readonly onAdd: (candidate: DiscoveryResult) => Promise<void>;
    readonly onOpen: (symbol: string) => void;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const riskTone = (risk: DiscoveryResult['risk'], theme: ResearchThemeV6) => {
    if (risk === 'low') return theme === 'light' ? 'text-emerald-700' : 'text-emerald-300';
    if (risk === 'moderate') return theme === 'light' ? 'text-amber-700' : 'text-amber-300';
    return theme === 'light' ? 'text-rose-600' : 'text-rose-300';
};

const CandidateRows = ({ candidates, rankStart, rankFor, view, theme, savedSymbols, adding, onAdd, onOpen }: {
    readonly candidates: readonly (QualityDiscoveryResult | DiscoveryContender)[];
    readonly rankStart: number;
    readonly view: 'leaders' | 'early';
    readonly theme: ResearchThemeV6;
    readonly savedSymbols: readonly string[];
    readonly adding: boolean;
    readonly onAdd: (candidate: DiscoveryResult) => Promise<void>;
    readonly onOpen: (symbol: string) => void;
    readonly rankFor?: (candidate: QualityDiscoveryResult | DiscoveryContender, index: number) => number;
}) => {
    const styles = getThemeV6(theme);
    return candidates.map((candidate, index) => {
        const saved = savedSymbols.includes(candidate.symbol);
        const contenderReason = 'contenderReason' in candidate ? candidate.contenderReason : null;
        const rank = String(rankFor?.(candidate, index) ?? rankStart + index).padStart(2, '0');
        const scoreChange = candidate.scoreChange1Week === null
            ? 'new'
            : (candidate.scoreChange1Week >= 0 ? '+' : '') + candidate.scoreChange1Week + ' 1W';
        const details = (view === 'early' ? candidate.earlyTrendStage : candidate.category)
            + (contenderReason ? ' · ' + contenderReason : '')
            + ' · ' + candidate.sector
            + ' · ' + (candidate.sectorRelativeStrengthPercent >= 0 ? '+' : '') + candidate.sectorRelativeStrengthPercent.toFixed(1) + '% vs sector'
            + ' · ' + candidate.valuation.guardrail + ' valuation'
            + (candidate.valuation.priceEarnings !== null ? ' · P/E ' + candidate.valuation.priceEarnings.toFixed(1) : '')
            + (candidate.catalyst ? ' · Earnings ' + new Date(candidate.catalyst.date + 'T00:00:00').toLocaleDateString() : '');
        return (
            <li key={candidate.symbol} className={'border-b px-2 py-3 ' + styles.divider}>
                <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-x-3 gap-y-3 min-[900px]:hidden">
                    <span className={'font-mono text-xs ' + styles.textMuted}>{rank}</span>
                    <div className="min-w-0">
                        <button type="button" onClick={() => saved ? onOpen(candidate.symbol) : void onAdd(candidate)} className="min-h-10 min-w-0 text-left">
                            <span className={'block font-mono text-sm font-bold ' + styles.textPrimary}>{candidate.symbol}</span>
                            <span className={'block truncate text-xs ' + styles.textMuted}>{candidate.name} · ${candidate.price.toFixed(2)}</span>
                        </button>
                        <dl className="mt-3 grid grid-cols-3 gap-2">
                            <div>
                                <dt className={'text-xs font-semibold uppercase tracking-[0.08em] ' + styles.textMuted}>Score</dt>
                                <dd className={'mt-1 font-mono text-sm font-semibold ' + styles.positive}>{candidate.discoveryScore}<span className={'ml-1 text-xs font-normal ' + styles.textMuted}>{scoreChange}</span></dd>
                            </div>
                            <div>
                                <dt className={'text-xs font-semibold uppercase tracking-[0.08em] ' + styles.textMuted}>Quality</dt>
                                <dd className={'mt-1 font-mono text-sm font-semibold ' + styles.textSecondary}>{candidate.qualityScore ?? '--'}</dd>
                            </div>
                            <div>
                                <dt className={'text-xs font-semibold uppercase tracking-[0.08em] ' + styles.textMuted}>Risk</dt>
                                <dd className={'mt-1 text-xs font-semibold capitalize ' + riskTone(candidate.risk, theme)}>{candidate.risk}</dd>
                            </div>
                        </dl>
                        <p className={'mt-3 text-xs leading-5 ' + styles.textSecondary}>{details}</p>
                        <DiscoveryOwnershipEvidenceV6 ownership={candidate.ownership} theme={theme} className="mt-2" />
                        <button type="button" disabled={saved || adding} onClick={() => void onAdd(candidate)} className={'mt-3 min-h-10 w-full rounded border px-2 text-xs font-semibold disabled:opacity-50 ' + styles.row}>{saved ? 'In research' : 'Add to research'}</button>
                    </div>
                </div>
                <div className={'hidden grid-cols-[42px_minmax(140px,1fr)_60px_60px_70px_60px_minmax(220px,1.5fr)_100px] items-center gap-2 min-[900px]:grid'}>
                    <span className={'font-mono text-xs ' + styles.textMuted}>{rank}</span>
                    <button type="button" onClick={() => saved ? onOpen(candidate.symbol) : void onAdd(candidate)} className="min-h-10 min-w-0 text-left">
                        <span className={'block font-mono text-sm font-bold ' + styles.textPrimary}>{candidate.symbol}</span>
                        <span className={'block truncate text-xs ' + styles.textMuted}>{candidate.name} · ${candidate.price.toFixed(2)}</span>
                    </button>
                    <span>
                        <strong className={'block font-mono text-sm ' + styles.positive}>{candidate.discoveryScore}</strong>
                        <small className={'block font-mono text-[9px] ' + styles.textMuted}>{scoreChange}</small>
                    </span>
                    <span className={'font-mono text-sm font-semibold ' + styles.textSecondary}>{candidate.qualityScore ?? '--'}</span>
                    <span className={'text-xs font-semibold capitalize ' + riskTone(candidate.risk, theme)}>{candidate.risk}</span>
                    <span className={'font-mono text-xs ' + styles.textSecondary}>{candidate.trendScore}</span>
                    <div className={'text-xs leading-5 ' + styles.textSecondary}>
                        <p><strong className="capitalize">{details}</strong> · {[...candidate.qualityReasons, ...candidate.reasons].slice(0, 1).join(' · ')}</p>
                        <DiscoveryOwnershipEvidenceV6 ownership={candidate.ownership} theme={theme} />
                    </div>
                    <button type="button" disabled={saved || adding} onClick={() => void onAdd(candidate)} className={'min-h-10 rounded border px-2 text-xs font-semibold disabled:opacity-50 ' + styles.row}>{saved ? 'In research' : 'Add'}</button>
                </div>
            </li>
        );
    });
};

export const TrendDiscoveryV6 = ({ theme, savedSymbols, adding, onAdd, onOpen }: TrendDiscoveryV6Props) => {
    const [data, setData] = useState<DiscoveryResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState<'leaders' | 'early'>('leaders');
    const [showContenders, setShowContenders] = useState(false);
    const [filters, setFilters] = useState(defaultDiscoveryFilters);
    const styles = getThemeV6(theme);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const response = await fetch('/api/research/discovery');
                const payload: unknown = await response.json();
                if (!response.ok && isRecord(payload) && typeof payload.error === 'string') throw new Error(payload.error);
                const parsed = parseDiscoveryResponseV6(payload);
                if (active) setData(parsed);
            } catch (caught) {
                if (active) setError(caught instanceof Error ? caught.message : 'Trend discovery is unavailable.');
            }
        };
        void load();
        return () => { active = false; };
    }, []);

    if (error) return <section className={'min-h-72 flex-1 p-4 text-sm ' + styles.risk}>{error}</section>;
    if (!data) return <section className={'min-h-72 flex-1 p-4 text-sm ' + styles.textMuted}>Scanning liquid trend candidates...</section>;
    const allCandidates = [...data.candidates, ...data.contenders, ...data.emergingCandidates];
    const sectors = [...new Set(allCandidates.map((candidate) => candidate.sector))].sort();
    const filteredLeaders = filterDiscoveryCandidates(data.candidates, filters);
    const filteredContenders = filterDiscoveryCandidates(data.contenders, filters);
    const filteredEarly = filterDiscoveryCandidates(data.emergingCandidates, filters);
    const displayedCandidates = view === 'leaders' ? filteredLeaders : filteredEarly;
    const resultCount = view === 'leaders' ? filteredLeaders.length + filteredContenders.length : filteredEarly.length;
    const rankForLeaders = (candidate: QualityDiscoveryResult | DiscoveryContender) => data.candidates.findIndex((item) => item.symbol === candidate.symbol) + 1;
    const rankForContenders = (candidate: QualityDiscoveryResult | DiscoveryContender) => data.candidates.length + data.contenders.findIndex((item) => item.symbol === candidate.symbol) + 1;
    const rankForEarly = (candidate: QualityDiscoveryResult | DiscoveryContender) => data.emergingCandidates.findIndex((item) => item.symbol === candidate.symbol) + 1;

    return (
        <section className="min-w-0 flex-1">
            <header className={'border-b pb-4 ' + styles.divider}>
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className={'text-xl font-bold ' + styles.textPrimary}>Trend Discovery</h1>
                        <p className={'mt-1 text-sm leading-5 ' + styles.textMuted}>Trend, SEC business quality, and manipulation-pattern risk across {data.universeSize} established, liquid US stocks.</p>
                    </div>
                    <p className={'text-xs ' + styles.textMuted}>{data.scannedCount} scanned · {new Date(data.generatedAt).toLocaleString()}</p>
                </div>
                <div className={'mt-4 inline-flex rounded-md border p-1 ' + styles.divider}>
                    <button type="button" onClick={() => setView('leaders')} className={'min-h-10 rounded px-3 text-xs font-semibold ' + (view === 'leaders' ? styles.selectedRow : styles.textMuted)}>Leaders</button>
                    <button type="button" onClick={() => setView('early')} className={'min-h-10 rounded px-3 text-xs font-semibold ' + (view === 'early' ? styles.selectedRow : styles.textMuted)}>Early trends</button>
                </div>
            </header>
            <div className={'flex flex-wrap items-center gap-x-6 gap-y-2 border-b px-2 py-3 ' + styles.divider}>
                <span className={'text-xs font-semibold uppercase ' + styles.textMuted}>Tracked performance</span>
                {data.performance.map((period) => (
                    <span key={period.period} className={'text-xs ' + styles.textSecondary}>
                        <strong className="font-mono">{period.period}</strong>{' '}
                        <span className={period.averageReturnPercent === null ? styles.textMuted : period.averageReturnPercent >= 0 ? styles.positive : styles.risk}>
                            {period.averageReturnPercent === null ? 'collecting' : `${period.averageReturnPercent >= 0 ? '+' : ''}${period.averageReturnPercent.toFixed(1)}%`}
                        </span>
                        {period.trackedCount > 0 ? ` · ${period.winnerCount}/${period.trackedCount} positive` : ''}
                    </span>
                ))}
                <span className={'ml-auto text-xs ' + styles.textMuted}>{data.historySnapshotCount} hourly snapshots</span>
            </div>
            <DiscoveryFiltersV6 filters={filters} sectors={sectors} resultCount={resultCount} active={hasDiscoveryFilters(filters)} theme={theme} onChange={setFilters} onReset={() => setFilters(defaultDiscoveryFilters)} />
            <div className={'grid grid-cols-[36px_minmax(0,1fr)] gap-2 border-b px-2 py-2 text-xs font-semibold uppercase min-[900px]:hidden ' + styles.divider + ' ' + styles.textMuted}>
                <span>Rank</span><span>Candidate scan</span>
            </div>
            <div className={'hidden grid-cols-[42px_minmax(140px,1fr)_60px_60px_70px_60px_minmax(220px,1.5fr)_100px] gap-2 border-b px-2 py-2 text-xs font-semibold uppercase min-[900px]:grid ' + styles.divider + ' ' + styles.textMuted}>
                <span>Rank</span><span>Ticker</span><span>Score</span><span>Quality</span><span>Risk</span><span>Trend</span><span>Category and evidence</span><span>Action</span>
            </div>
            <ol>
                <CandidateRows candidates={displayedCandidates} rankStart={1} rankFor={view === 'leaders' ? rankForLeaders : rankForEarly} view={view} theme={theme} savedSymbols={savedSymbols} adding={adding} onAdd={onAdd} onOpen={onOpen} />
            </ol>
            {view === 'leaders' && filteredContenders.length > 0 ? (
                <div className={'border-b ' + styles.divider}>
                    <button type="button" aria-expanded={showContenders} onClick={() => setShowContenders((current) => !current)} className={'flex min-h-12 w-full items-center justify-between px-2 text-left text-xs font-semibold ' + styles.textSecondary}>
                        <span>Contenders · ranks {data.candidates.length + 1}–{data.candidates.length + data.contenders.length}</span>
                        <span className={styles.textMuted}>{showContenders ? 'Hide' : `Show ${filteredContenders.length}`}</span>
                    </button>
                    {showContenders ? <ol><CandidateRows candidates={filteredContenders} rankStart={data.candidates.length + 1} rankFor={rankForContenders} view="leaders" theme={theme} savedSymbols={savedSymbols} adding={adding} onAdd={onAdd} onOpen={onOpen} /></ol> : null}
                </div>
            ) : null}
            {resultCount === 0 ? <p className={'px-2 py-8 text-center text-sm ' + styles.textMuted}>No candidates match the current filters.</p> : null}
            {data.warnings.map((warning) => <p key={warning} className={'mt-3 text-xs ' + styles.textMuted}>{warning}</p>)}
        </section>
    );
};
