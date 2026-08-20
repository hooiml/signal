'use client';

import { useEffect, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { MarketSignal } from '@/lib/types/signal-v2';
import type { ResearchThemeV6 } from './research-v6';
import { getThemeV6 } from './research-v6';
import { formatCompactDateV6 } from './market-v6';

type ScoreHistoryV6Props = {
    signal: MarketSignal;
    theme: ResearchThemeV6;
    interactive?: boolean;
};

type ScoreHistoryRangeV6 = '1M' | '3M' | '6M' | '1Y' | 'All';
type HistoryPointV6 = NonNullable<MarketSignal['metadata']['score_history']>[number];

const scoreHistoryRanges: ReadonlyArray<{ readonly id: ScoreHistoryRangeV6; readonly days: number | null }> = [
    { id: '1M', days: 31 },
    { id: '3M', days: 93 },
    { id: '6M', days: 186 },
    { id: '1Y', days: 366 },
    { id: 'All', days: null },
];

export const ScoreHistoryV6 = ({ signal, theme, interactive = false }: ScoreHistoryV6Props) => {
    const history = signal.metadata.score_history ?? [];
    const points = history.length > 0
        ? history
        : [{ date: signal.metadata.score_delta?.snapshot_date ?? new Date().toISOString(), score: signal.composite_score, tier: signal.tier }];

    if (interactive) return <InteractiveScoreHistoryV6 signal={signal} points={points} theme={theme} />;

    const bands = getScoreBandsV6(signal.mode);
    const reconstructedCount = points.filter((point) => point.origin === 'reconstructed').length;

    return (
        <section aria-labelledby="score-history-title" className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <p className={'text-xs font-semibold ' + (theme === 'light' ? 'text-slate-500' : 'text-[#9aa8b8]')}>Historical context</p>
                    <h2 id="score-history-title" className={'mt-0.5 text-lg font-bold ' + (theme === 'light' ? 'text-slate-950' : 'text-[#eef2f7]')}>Score history</h2>
                </div>
                <p className={'text-xs ' + (theme === 'light' ? 'text-slate-500' : 'text-[#9aa8b8]')}>{points.length} snapshots{reconstructedCount > 0 ? ` (${reconstructedCount} backfilled)` : ''} - current {Math.round(signal.composite_score)}</p>
            </div>
            <div className="mt-3 overflow-hidden rounded-md">
                <HistoryChartV6 points={points} currentScore={signal.composite_score} theme={theme} width={340} height={210} compact />
                <HistoryChartV6 points={points} currentScore={signal.composite_score} theme={theme} width={760} height={260} />
            </div>
            {reconstructedCount > 0 ? (
                <p className={'mt-2 flex items-center gap-2 text-[11px] ' + (theme === 'light' ? 'text-slate-600' : 'text-[#9aa8b8]')}>
                    <span className={'inline-block h-1.5 w-1.5 rounded-full border ' + (theme === 'light' ? 'border-emerald-700 bg-white' : 'border-emerald-300 bg-slate-950')} />
                    Backfilled points were calculated from historical inputs; unavailable sources use a documented neutral fallback.
                </p>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4" aria-label={signal.mode === 'contrarian' ? 'Contrarian score zones' : 'Momentum score zones'}>
                {bands.map((band) => (
                    <div key={band.range} className={'flex items-center gap-2 text-[11px] ' + (theme === 'light' ? 'text-slate-600' : 'text-[#9aa8b8]')}>
                        <span className={'h-2 w-2 shrink-0 rounded-full ' + band.tone} />
                        <span><strong className="font-semibold">{band.range}</strong> {band.label}</span>
                    </div>
                ))}
            </div>
        </section>
    );
};

const InteractiveScoreHistoryV6 = ({ signal, points: sourcePoints, theme }: {
    signal: MarketSignal;
    points: HistoryPointV6[];
    theme: ResearchThemeV6;
}) => {
    const [range, setRange] = useState<ScoreHistoryRangeV6>('3M');
    const orderedPoints = useMemo(() => [...sourcePoints].sort((left, right) => left.date.localeCompare(right.date)), [sourcePoints]);
    const points = useMemo(() => filterScoreHistoryRangeV6(orderedPoints, range), [orderedPoints, range]);
    const [activeIndex, setActiveIndex] = useState(points.length - 1);
    const activePointIndex = Math.max(0, Math.min(activeIndex, points.length - 1));
    const activePoint = points[activePointIndex] ?? points.at(-1);
    const bands = getScoreBandsV6(signal.mode);
    const reconstructedCount = points.filter((point) => point.origin === 'reconstructed').length;
    const themeClasses = getThemeV6(theme);

    useEffect(() => {
        setActiveIndex(points.length - 1);
    }, [points]);

    const pointSummary = activePoint
        ? `${formatCompactDateV6(activePoint.date)}. Score ${Math.round(activePoint.score)} out of 100. ${activePoint.tier}. ${activePoint.origin === 'reconstructed' ? 'Backfilled' : 'Observed'} point.`
        : 'Score history is unavailable.';

    return (
        <section aria-labelledby="score-history-title" className="min-w-0" data-testid="market-score-history-explorer">
            <div className="flex flex-col gap-3 min-[700px]:flex-row min-[700px]:items-end min-[700px]:justify-between">
                <div>
                    <p className={'text-xs font-semibold ' + themeClasses.textMuted}>Primary evidence</p>
                    <h2 id="score-history-title" className={'mt-0.5 text-lg font-bold ' + themeClasses.textPrimary}>Score history</h2>
                    <p className={'mt-1 text-xs ' + themeClasses.textMuted}>{points.length} of {orderedPoints.length} snapshots{reconstructedCount > 0 ? ` · ${reconstructedCount} backfilled in range` : ''}</p>
                </div>
                <div className="research-scrollbar flex max-w-full overflow-x-auto rounded-md border p-1" role="group" aria-label="Score history range">
                    {scoreHistoryRanges.map((candidate) => (
                        <button
                            key={candidate.id}
                            type="button"
                            aria-pressed={range === candidate.id}
                            onClick={() => setRange(candidate.id)}
                            className={'min-h-10 min-w-12 rounded px-3 text-xs font-bold ' + (range === candidate.id ? themeClasses.selectedRow : themeClasses.textMuted)}
                        >{candidate.id}</button>
                    ))}
                </div>
            </div>

            <div className="mt-3 overflow-hidden rounded-md border p-2" data-testid="market-score-history-chart">
                <HistoryChartV6 points={points} currentScore={signal.composite_score} theme={theme} width={340} height={210} compact interactive activeIndex={activePointIndex} onPointSelect={setActiveIndex} describedBy="market-score-history-readout" />
                <HistoryChartV6 points={points} currentScore={signal.composite_score} theme={theme} width={760} height={260} interactive activeIndex={activePointIndex} onPointSelect={setActiveIndex} describedBy="market-score-history-readout" />
            </div>

            <label className={'mt-3 grid gap-1 text-xs font-semibold ' + themeClasses.textMuted}>
                <span>Explore score point</span>
                <input
                    data-testid="market-score-history-slider"
                    type="range"
                    min={0}
                    max={Math.max(0, points.length - 1)}
                    step={1}
                    value={activePointIndex}
                    disabled={points.length <= 1}
                    onChange={(event) => setActiveIndex(Number(event.target.value))}
                    aria-describedby="market-score-history-readout"
                    className="min-h-10 w-full accent-emerald-600 disabled:opacity-50"
                />
            </label>

            {activePoint ? (
                <div id="market-score-history-readout" data-testid="market-score-history-readout" className={'mt-2 rounded-md border p-3 ' + themeClasses.row}>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 min-[700px]:grid-cols-4">
                        <HistoryReadoutItemV6 label="Date" value={formatCompactDateV6(activePoint.date)} theme={theme} />
                        <HistoryReadoutItemV6 label="Composite score" value={`${Math.round(activePoint.score)} / 100`} theme={theme} />
                        <HistoryReadoutItemV6 label="Tier" value={activePoint.tier} theme={theme} />
                        <HistoryReadoutItemV6 label="Origin" value={activePoint.origin === 'reconstructed' ? 'Backfilled' : 'Observed'} theme={theme} />
                    </dl>
                    {activePoint.coverage_note ? <p className={'mt-2 text-xs leading-5 ' + themeClasses.textMuted}>{activePoint.coverage_note}</p> : null}
                </div>
            ) : null}
            <span className="sr-only" aria-live="polite">{pointSummary}</span>

            {reconstructedCount > 0 ? (
                <p className={'mt-2 flex items-center gap-2 text-[11px] ' + themeClasses.textMuted}>
                    <span className={'inline-block h-1.5 w-1.5 rounded-full border ' + (theme === 'light' ? 'border-emerald-700 bg-white' : 'border-emerald-300 bg-slate-950')} />
                    Backfilled points were calculated from historical inputs; unavailable sources use a documented neutral fallback.
                </p>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4" aria-label={signal.mode === 'contrarian' ? 'Contrarian score zones' : 'Momentum score zones'}>
                {bands.map((band) => (
                    <div key={band.range} className={'flex items-center gap-2 text-[11px] ' + themeClasses.textMuted}>
                        <span className={'h-2 w-2 shrink-0 rounded-full ' + band.tone} />
                        <span><strong className="font-semibold">{band.range}</strong> {band.label}</span>
                    </div>
                ))}
            </div>
        </section>
    );
};

const HistoryReadoutItemV6 = ({ label, value, theme }: { label: string; value: string; theme: ResearchThemeV6 }) => {
    const themeClasses = getThemeV6(theme);
    return (
        <div className="min-w-0">
            <dt className={'text-[11px] font-semibold uppercase tracking-[0.06em] ' + themeClasses.textMuted}>{label}</dt>
            <dd className={'mt-1 break-words font-mono text-sm font-bold tabular-nums ' + themeClasses.textPrimary}>{value}</dd>
        </div>
    );
};

const filterScoreHistoryRangeV6 = (points: HistoryPointV6[], range: ScoreHistoryRangeV6) => {
    const days = scoreHistoryRanges.find((candidate) => candidate.id === range)?.days ?? null;
    if (days === null || points.length <= 1) return points;
    const latestTime = Date.parse(points.at(-1)?.date ?? '');
    if (!Number.isFinite(latestTime)) return points;
    const cutoff = latestTime - days * 24 * 60 * 60 * 1_000;
    const filtered = points.filter((point) => {
        const pointTime = Date.parse(point.date);
        return !Number.isFinite(pointTime) || pointTime >= cutoff;
    });
    return filtered.length > 0 ? filtered : points.slice(-1);
};

type HistoryChartV6Props = {
    points: HistoryPointV6[];
    currentScore: number;
    theme: ResearchThemeV6;
    width: number;
    height: number;
    compact?: boolean;
    interactive?: boolean;
    activeIndex?: number;
    onPointSelect?: (index: number) => void;
    describedBy?: string;
};

const HistoryChartV6 = ({ points, currentScore, theme, width, height, compact = false, interactive = false, activeIndex = points.length - 1, onPointSelect, describedBy }: HistoryChartV6Props) => {
    const left = compact ? 32 : 42;
    const right = compact ? 12 : 18;
    const top = 14;
    const bottom = compact ? 30 : 38;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const coordinates = points.map((point, index) => ({
        x: left + (points.length === 1 ? plotWidth : (index / (points.length - 1)) * plotWidth),
        y: top + ((100 - point.score) / 100) * plotHeight,
        ...point,
    }));
    const linePoints = coordinates.map((point) => point.x + ',' + point.y).join(' ');
    const areaPoints = left + ',' + (top + plotHeight) + ' ' + linePoints + ' ' + (left + plotWidth) + ',' + (top + plotHeight);
    const stroke = theme === 'light' ? '#047857' : '#6ee7b7';
    const grid = theme === 'light' ? '#cbd5e1' : '#334155';
    const text = theme === 'light' ? '#475569' : '#9aa8b8';
    const fill = theme === 'light' ? 'rgba(16,185,129,0.10)' : 'rgba(52,211,153,0.08)';
    const last = coordinates.at(-1);
    const active = coordinates[Math.max(0, Math.min(activeIndex, coordinates.length - 1))];
    const ticks = compact ? [0, 50, 100] : [0, 25, 50, 75, 100];

    const selectPointerPoint = (event: PointerEvent<SVGSVGElement>) => {
        if (!interactive || coordinates.length === 0 || !onPointSelect) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (bounds.width <= 0) return;
        const viewBoxX = ((event.clientX - bounds.left) / bounds.width) * width;
        const ratio = Math.max(0, Math.min(1, (viewBoxX - left) / plotWidth));
        onPointSelect(Math.round(ratio * (coordinates.length - 1)));
    };

    const selectKeyboardPoint = (event: KeyboardEvent<SVGSVGElement>) => {
        if (!interactive || !onPointSelect || coordinates.length === 0) return;
        let nextIndex: number | null = null;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') nextIndex = Math.max(0, activeIndex - 1);
        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') nextIndex = Math.min(coordinates.length - 1, activeIndex + 1);
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = coordinates.length - 1;
        if (nextIndex === null) return;
        event.preventDefault();
        onPointSelect(nextIndex);
    };

    return (
        <svg
            viewBox={'0 0 ' + width + ' ' + height}
            role={interactive ? 'group' : 'img'}
            aria-label={'Score history from ' + formatCompactDateV6(points[0].date) + ' to ' + formatCompactDateV6(points.at(-1)?.date) + ', ending at ' + Math.round(currentScore) + '.'}
            aria-describedby={interactive ? describedBy : undefined}
            tabIndex={interactive ? 0 : undefined}
            onPointerDown={interactive ? selectPointerPoint : undefined}
            onPointerMove={interactive ? selectPointerPoint : undefined}
            onKeyDown={interactive ? selectKeyboardPoint : undefined}
            style={interactive ? { touchAction: 'pan-y' } : undefined}
            className={(compact ? 'block sm:hidden' : 'hidden sm:block') + ' h-auto w-full focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-500'}
        >
            {ticks.map((value) => {
                const y = top + ((100 - value) / 100) * plotHeight;
                return (
                    <g key={value}>
                        <line x1={left} x2={left + plotWidth} y1={y} y2={y} stroke={grid} strokeWidth="1" opacity="0.65" />
                        <text x={left - 8} y={y + 4} textAnchor="end" fill={text} fontSize={compact ? '9' : '11'}>{value}</text>
                    </g>
                );
            })}
            {[40, 65, 85].map((value) => {
                const y = top + ((100 - value) / 100) * plotHeight;
                return <line key={value} x1={left} x2={left + plotWidth} y1={y} y2={y} stroke={grid} strokeDasharray="4 5" opacity="0.55" />;
            })}
            <polygon points={areaPoints} fill={fill} />
            <polyline points={linePoints} fill="none" stroke={stroke} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            {coordinates.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r={compact ? '1.25' : '1.5'} fill={point.origin === 'reconstructed' ? (theme === 'light' ? '#ffffff' : '#020617') : stroke} stroke={stroke} strokeWidth={point.origin === 'reconstructed' ? '1' : '0'} />)}
            {interactive && active ? <line x1={active.x} x2={active.x} y1={top} y2={top + plotHeight} stroke={stroke} strokeDasharray="3 4" opacity="0.75" /> : null}
            {interactive && active ? <circle cx={active.x} cy={active.y} r={compact ? '4' : '5'} fill={theme === 'light' ? '#ffffff' : '#020617'} stroke={stroke} strokeWidth="2" /> : null}
            {last ? <circle cx={last.x} cy={last.y} r={compact ? '2' : '2.5'} fill={stroke} /> : null}
            {last ? <text x={Math.min(last.x + 10, width - 28)} y={last.y + 4} fill={stroke} fontWeight="700" fontSize={compact ? '11' : '14'}>{Math.round(last.score)}</text> : null}
            <text x={left} y={height - 8} fill={text} fontSize={compact ? '9' : '11'}>{formatCompactDateV6(points[0].date)}</text>
            <text x={left + plotWidth} y={height - 8} textAnchor="end" fill={text} fontSize={compact ? '9' : '11'}>{formatCompactDateV6(points.at(-1)?.date)}</text>
        </svg>
    );
};

const getScoreBandsV6 = (mode: MarketSignal['mode']) => mode === 'contrarian' ? [
    { range: '0-39', label: 'Low risk', tone: 'bg-emerald-500' },
    { range: '40-64', label: 'Elevated', tone: 'bg-sky-500' },
    { range: '65-84', label: 'Cautionary', tone: 'bg-amber-500' },
    { range: '85+', label: 'Extreme risk', tone: 'bg-rose-500' },
] : [
    { range: '0-39', label: 'Negative', tone: 'bg-rose-500' },
    { range: '40-64', label: 'Mixed', tone: 'bg-sky-500' },
    { range: '65-84', label: 'Positive', tone: 'bg-emerald-400' },
    { range: '85+', label: 'Strong positive', tone: 'bg-emerald-600' },
];
