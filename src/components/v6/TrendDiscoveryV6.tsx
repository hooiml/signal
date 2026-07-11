'use client';

import { useEffect, useState } from 'react';
import type { DiscoveryCategory, DiscoveryCatalyst, DiscoveryResponse, DiscoveryResult, EarlyTrendStage, QualityDiscoveryResult, ValuationGuardrail } from '@/lib/types/research-discovery';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type TrendDiscoveryV6Props = {
    readonly theme: ResearchThemeV6;
    readonly savedSymbols: readonly string[];
    readonly adding: boolean;
    readonly onAdd: (candidate: DiscoveryResult) => Promise<void>;
    readonly onOpen: (symbol: string) => void;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const discoveryCategories: readonly DiscoveryCategory[] = ['quality compounder', 'cyclical acceleration', 'turnaround', 'momentum only', 'fundamentally unsupported', 'unconfirmed'];
const isDiscoveryCategory = (value: unknown): value is DiscoveryCategory => typeof value === 'string' && discoveryCategories.some((category) => category === value);
const isNullableNumber = (value: unknown) => value === null || typeof value === 'number';
const earlyTrendStages: readonly EarlyTrendStage[] = ['emerging', 'confirmed', 'extended', 'not ready'];
const valuationGuardrails: readonly ValuationGuardrail[] = ['attractive', 'fair', 'expensive', 'extreme', 'unavailable'];
const isListedValue = <T extends string>(value: unknown, values: readonly T[]): value is T =>
    typeof value === 'string' && values.some((candidate) => candidate === value);

const isCatalyst = (value: unknown): value is DiscoveryCatalyst => {
    if (!isRecord(value)) return false;
    return typeof value.date === 'string' && value.type === 'earnings'
        && (value.timing === 'pre-market' || value.timing === 'after-hours' || value.timing === 'time-not-supplied')
        && (value.fiscalQuarterEnding === null || typeof value.fiscalQuarterEnding === 'string')
        && (value.epsForecast === null || typeof value.epsForecast === 'string')
        && value.source === 'Nasdaq earnings calendar';
};

const isCandidate = (value: unknown): value is QualityDiscoveryResult => {
    if (!isRecord(value)) return false;
    return typeof value.symbol === 'string' && typeof value.name === 'string'
        && typeof value.price === 'number' && typeof value.trendScore === 'number'
        && typeof value.riskScore === 'number' && (value.risk === 'low' || value.risk === 'moderate' || value.risk === 'high')
        && typeof value.momentum3MonthPercent === 'number' && typeof value.momentum6MonthPercent === 'number'
        && (value.qualityScore === null || typeof value.qualityScore === 'number') && typeof value.discoveryScore === 'number'
        && isDiscoveryCategory(value.category)
        && typeof value.sector === 'string' && typeof value.sectorRelativeStrengthPercent === 'number'
        && isNullableNumber(value.scoreChange1Day) && isNullableNumber(value.scoreChange1Week)
        && isNullableNumber(value.scoreChange1Month) && isNullableNumber(value.rankChange1Week)
        && typeof value.firstSeenAt === 'string'
        && isListedValue(value.earlyTrendStage, earlyTrendStages)
        && isRecord(value.valuation) && isListedValue(value.valuation.guardrail, valuationGuardrails)
        && isNullableNumber(value.valuation.priceEarnings) && isNullableNumber(value.valuation.priceSales)
        && isNullableNumber(value.valuation.freeCashFlowYieldPercent)
        && (value.catalyst === null || isCatalyst(value.catalyst))
        && Array.isArray(value.reasons) && value.reasons.every((reason) => typeof reason === 'string')
        && Array.isArray(value.qualityReasons) && value.qualityReasons.every((reason) => typeof reason === 'string')
        && Array.isArray(value.flags) && value.flags.every((flag) => typeof flag === 'string');
};

const parseResponse = (payload: unknown): DiscoveryResponse => {
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) throw new Error('Invalid trend discovery response.');
    const data = payload.data;
    if (typeof data.generatedAt !== 'string' || typeof data.universeSize !== 'number' || typeof data.scannedCount !== 'number'
        || !Array.isArray(data.candidates) || !data.candidates.every(isCandidate)
        || !Array.isArray(data.emergingCandidates) || !data.emergingCandidates.every(isCandidate)
        || !Array.isArray(data.performance) || !data.performance.every((item) => isRecord(item)
            && (item.period === '1D' || item.period === '1W' || item.period === '1M')
            && isNullableNumber(item.averageReturnPercent) && typeof item.trackedCount === 'number' && typeof item.winnerCount === 'number')
        || typeof data.historySnapshotCount !== 'number'
        || !Array.isArray(data.warnings) || !data.warnings.every((warning) => typeof warning === 'string')) {
        throw new Error('Invalid trend discovery data.');
    }
    return {
        generatedAt: data.generatedAt,
        universeSize: data.universeSize,
        scannedCount: data.scannedCount,
        candidates: data.candidates,
        emergingCandidates: data.emergingCandidates,
        performance: data.performance,
        historySnapshotCount: data.historySnapshotCount,
        warnings: data.warnings,
    };
};

const riskTone = (risk: DiscoveryResult['risk'], theme: ResearchThemeV6) => {
    if (risk === 'low') return theme === 'light' ? 'text-emerald-700' : 'text-emerald-300';
    if (risk === 'moderate') return theme === 'light' ? 'text-amber-700' : 'text-amber-300';
    return theme === 'light' ? 'text-rose-600' : 'text-rose-300';
};

export const TrendDiscoveryV6 = ({ theme, savedSymbols, adding, onAdd, onOpen }: TrendDiscoveryV6Props) => {
    const [data, setData] = useState<DiscoveryResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState<'leaders' | 'early'>('leaders');
    const styles = getThemeV6(theme);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const response = await fetch('/api/research/discovery');
                const payload: unknown = await response.json();
                if (!response.ok && isRecord(payload) && typeof payload.error === 'string') throw new Error(payload.error);
                const parsed = parseResponse(payload);
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
    const displayedCandidates = view === 'leaders' ? data.candidates : data.emergingCandidates;

    return (
        <section className="min-w-0 flex-1">
            <header className={'border-b pb-4 ' + styles.divider}>
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className={'text-lg font-bold ' + styles.textPrimary}>Trend Discovery</h1>
                        <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Trend, SEC business quality, and manipulation-pattern risk across {data.universeSize} established, liquid US stocks.</p>
                    </div>
                    <p className={'text-[11px] ' + styles.textMuted}>{data.scannedCount} scanned · {new Date(data.generatedAt).toLocaleString()}</p>
                </div>
                <div className={'mt-4 inline-flex rounded-md border p-1 ' + styles.divider}>
                    <button type="button" onClick={() => setView('leaders')} className={'rounded px-3 py-1.5 text-xs font-semibold ' + (view === 'leaders' ? styles.selectedRow : styles.textMuted)}>Leaders</button>
                    <button type="button" onClick={() => setView('early')} className={'rounded px-3 py-1.5 text-xs font-semibold ' + (view === 'early' ? styles.selectedRow : styles.textMuted)}>Early trends</button>
                </div>
            </header>
            <div className={'flex flex-wrap items-center gap-x-6 gap-y-2 border-b px-2 py-3 ' + styles.divider}>
                <span className={'text-[10px] font-semibold uppercase ' + styles.textMuted}>Tracked performance</span>
                {data.performance.map((period) => (
                    <span key={period.period} className={'text-xs ' + styles.textSecondary}>
                        <strong className="font-mono">{period.period}</strong>{' '}
                        <span className={period.averageReturnPercent === null ? styles.textMuted : period.averageReturnPercent >= 0 ? styles.positive : styles.risk}>
                            {period.averageReturnPercent === null ? 'collecting' : `${period.averageReturnPercent >= 0 ? '+' : ''}${period.averageReturnPercent.toFixed(1)}%`}
                        </span>
                        {period.trackedCount > 0 ? ` · ${period.winnerCount}/${period.trackedCount} positive` : ''}
                    </span>
                ))}
                <span className={'ml-auto text-[10px] ' + styles.textMuted}>{data.historySnapshotCount} hourly snapshots</span>
            </div>
            <div className={'grid grid-cols-[36px_minmax(80px,1fr)_48px_48px_62px] gap-2 border-b px-2 py-2 text-[10px] font-semibold uppercase min-[900px]:grid-cols-[42px_minmax(140px,1fr)_60px_60px_70px_60px_minmax(220px,1.5fr)_100px] ' + styles.divider + ' ' + styles.textMuted}>
                <span>Rank</span><span>Ticker</span><span>Score</span><span>Quality</span><span>Risk</span><span className="hidden min-[900px]:block">Trend</span><span className="hidden min-[900px]:block">Category and evidence</span><span className="hidden min-[900px]:block">Action</span>
            </div>
            <ol>
                {displayedCandidates.map((candidate, index) => {
                    const saved = savedSymbols.includes(candidate.symbol);
                    return (
                        <li key={candidate.symbol} className={'grid grid-cols-[36px_minmax(80px,1fr)_48px_48px_62px] items-center gap-2 border-b px-2 py-3 min-[900px]:grid-cols-[42px_minmax(140px,1fr)_60px_60px_70px_60px_minmax(220px,1.5fr)_100px] ' + styles.divider}>
                            <span className={'font-mono text-xs ' + styles.textMuted}>{String(index + 1).padStart(2, '0')}</span>
                            <button type="button" onClick={() => saved ? onOpen(candidate.symbol) : void onAdd(candidate)} className="min-w-0 text-left">
                                <span className={'block font-mono text-sm font-bold ' + styles.textPrimary}>{candidate.symbol}</span>
                                <span className={'block truncate text-[11px] ' + styles.textMuted}>{candidate.name} · ${candidate.price.toFixed(2)}</span>
                            </button>
                            <span>
                                <strong className={'block font-mono text-sm ' + styles.positive}>{candidate.discoveryScore}</strong>
                                <small className={'block font-mono text-[9px] ' + styles.textMuted}>{candidate.scoreChange1Week === null ? 'new' : `${candidate.scoreChange1Week >= 0 ? '+' : ''}${candidate.scoreChange1Week} 1W`}</small>
                            </span>
                            <span className={'font-mono text-sm font-semibold ' + styles.textSecondary}>{candidate.qualityScore ?? '--'}</span>
                            <span className={'text-xs font-semibold capitalize ' + riskTone(candidate.risk, theme)}>{candidate.risk}</span>
                            <span className={'hidden font-mono text-xs min-[900px]:block ' + styles.textSecondary}>{candidate.trendScore}</span>
                            <span className={'hidden text-[11px] leading-4 min-[900px]:block ' + styles.textSecondary}><strong className="capitalize">{view === 'early' ? candidate.earlyTrendStage : candidate.category}</strong> · {candidate.sector} · {candidate.sectorRelativeStrengthPercent >= 0 ? '+' : ''}{candidate.sectorRelativeStrengthPercent.toFixed(1)}% vs sector · <span className="capitalize">{candidate.valuation.guardrail} valuation</span>{candidate.valuation.priceEarnings !== null ? ` · P/E ${candidate.valuation.priceEarnings.toFixed(1)}` : ''}{candidate.catalyst ? ` · Earnings ${new Date(candidate.catalyst.date + 'T00:00:00').toLocaleDateString()}` : ''} · {[...candidate.qualityReasons, ...candidate.reasons].slice(0, 1).join(' · ')}</span>
                            <button type="button" disabled={saved || adding} onClick={() => void onAdd(candidate)} className={'hidden rounded border px-2 py-1.5 text-xs font-semibold disabled:opacity-50 min-[900px]:block ' + styles.row}>{saved ? 'In research' : 'Add'}</button>
                            <p className={'col-span-4 col-start-2 text-[11px] capitalize min-[900px]:hidden ' + styles.textMuted}>{view === 'early' ? candidate.earlyTrendStage : candidate.category} · {candidate.sector} · {candidate.valuation.guardrail} valuation{candidate.catalyst ? ` · Earnings ${new Date(candidate.catalyst.date + 'T00:00:00').toLocaleDateString()}` : ''}</p>
                            <button type="button" disabled={saved || adding} onClick={() => void onAdd(candidate)} className={'col-span-4 col-start-2 rounded border px-2 py-1.5 text-xs font-semibold disabled:opacity-50 min-[900px]:hidden ' + styles.row}>{saved ? 'In research' : 'Add to research'}</button>
                        </li>
                    );
                })}
            </ol>
            {displayedCandidates.length === 0 ? <p className={'px-2 py-8 text-center text-sm ' + styles.textMuted}>No candidates currently meet this view&apos;s rules.</p> : null}
            {data.warnings.map((warning) => <p key={warning} className={'mt-3 text-[11px] ' + styles.textMuted}>{warning}</p>)}
        </section>
    );
};
