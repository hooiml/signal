'use client';

import { useState, type PointerEvent } from 'react';
import type { MarketSignal } from '@/lib/types/signal-v2';
import type { ResearchThemeV6 } from './research-v6';

type CalibrationTimeline = NonNullable<MarketSignal['metadata']['historical_validation']>['timeline'];
type TimelineRange = '1m' | '3m' | '6m' | '1y' | '3y' | '5y' | 'all';

const rangeOptions: ReadonlyArray<{ id: TimelineRange; label: string; days: number | null }> = [
    { id: '1m', label: '1M', days: 31 },
    { id: '3m', label: '3M', days: 92 },
    { id: '6m', label: '6M', days: 183 },
    { id: '1y', label: '1Y', days: 365 },
    { id: '3y', label: '3Y', days: 1_096 },
    { id: '5y', label: '5Y', days: 1_826 },
    { id: 'all', label: 'All', days: null },
];

const WIDTH = 760;
const HEIGHT = 374;
const PLOT = { left: 46, right: 18, scoreTop: 30, scoreBottom: 188, marketTop: 232, marketBottom: 340 } as const;

const dateLabel = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export const HistoricalCalibrationTimelineV6 = ({
    points,
    benchmarkName,
    theme,
}: {
    readonly points: CalibrationTimeline;
    readonly benchmarkName: string;
    readonly theme: ResearchThemeV6;
}) => {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [range, setRange] = useState<TimelineRange>('all');
    if (points.length === 0) return <p className="text-sm">Timeline data is unavailable.</p>;

    const selectedRange = rangeOptions.find((option) => option.id === range) ?? rangeOptions.at(-1)!;
    const latestTime = Date.parse(`${points.at(-1)!.date}T00:00:00Z`);
    const cutoffTime = selectedRange.days === null ? Number.NEGATIVE_INFINITY : latestTime - selectedRange.days * 86_400_000;
    const filteredPoints = points.filter((point) => Date.parse(`${point.date}T00:00:00Z`) >= cutoffTime);
    const visiblePoints = filteredPoints.length > 0 ? filteredPoints : points.slice(-1);
    const visibleBenchmarkBase = visiblePoints[0].benchmark_rebased;
    const plottedPoints = visiblePoints.map((point) => ({
        ...point,
        benchmark_rebased: Number(((point.benchmark_rebased / visibleBenchmarkBase) * 100).toFixed(2)),
    }));

    const palette = theme === 'light' ? {
        primary: '#0f172a', muted: '#64748b', grid: '#cbd5e1', score: '#047857', market: '#2563eb',
        observed: '#047857', reconstructed: '#ffffff', hover: '#b45309',
        zones: ['#fee2e2', '#f1f5f9', '#dcfce7', '#bbf7d0'],
    } : {
        primary: '#eef2f7', muted: '#9aa8b8', grid: '#334155', score: '#34d399', market: '#60a5fa',
        observed: '#34d399', reconstructed: '#020617', hover: '#fbbf24',
        zones: ['#3f1d2a', '#172033', '#123629', '#0b4a32'],
    };
    const firstTime = Date.parse(`${plottedPoints[0].date}T00:00:00Z`);
    const lastTime = Date.parse(`${plottedPoints.at(-1)!.date}T00:00:00Z`);
    const timeSpan = Math.max(1, lastTime - firstTime);
    const plotWidth = WIDTH - PLOT.left - PLOT.right;
    const x = (date: string) => PLOT.left + ((Date.parse(`${date}T00:00:00Z`) - firstTime) / timeSpan) * plotWidth;
    const scoreY = (score: number) => PLOT.scoreBottom - (score / 100) * (PLOT.scoreBottom - PLOT.scoreTop);
    const marketValues = plottedPoints.map((point) => point.benchmark_rebased);
    const marketMin = Math.floor(Math.min(...marketValues) - 1);
    const marketMax = Math.ceil(Math.max(...marketValues) + 1);
    const marketSpan = Math.max(1, marketMax - marketMin);
    const marketY = (value: number) => PLOT.marketBottom - ((value - marketMin) / marketSpan) * (PLOT.marketBottom - PLOT.marketTop);
    const path = (getY: (point: CalibrationTimeline[number]) => number) => plottedPoints.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point.date).toFixed(1)},${getY(point).toFixed(1)}`).join(' ');
    const active = activeIndex === null ? null : plottedPoints[activeIndex];
    const activeX = active ? x(active.date) : null;
    const tierChanges = plottedPoints.filter((point, index) => index > 0 && point.tier !== plottedPoints[index - 1].tier);
    const xTicks = [plottedPoints[0], plottedPoints[Math.floor((plottedPoints.length - 1) / 2)], plottedPoints.at(-1)!].filter((point, index, values) => values.findIndex((candidate) => candidate.date === point.date) === index);

    const move = (event: PointerEvent<SVGSVGElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const pointerX = ((event.clientX - rect.left) / rect.width) * WIDTH;
        let nearestIndex = 0;
        let nearestDistance = Number.POSITIVE_INFINITY;
        plottedPoints.forEach((point, index) => {
            const distance = Math.abs(x(point.date) - pointerX);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = index;
            }
        });
        setActiveIndex(nearestIndex);
    };

    return <figure data-testid="historical-calibration-timeline" data-visible-benchmark-start={plottedPoints[0].benchmark_rebased}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 max-w-full gap-1 overflow-x-auto pb-1" role="group" aria-label="Historical timeline range">
                {rangeOptions.map((option) => <button
                    key={option.id}
                    type="button"
                    data-testid={`timeline-range-${option.id}`}
                    aria-pressed={range === option.id}
                    onClick={() => {
                        setRange(option.id);
                        setActiveIndex(null);
                    }}
                    className="min-h-10 min-w-11 shrink-0 rounded border px-3 py-2 text-xs font-semibold"
                    style={{
                        borderColor: range === option.id ? palette.score : palette.grid,
                        backgroundColor: range === option.id ? palette.zones[2] : 'transparent',
                        color: range === option.id ? palette.primary : palette.muted,
                    }}
                >{option.label}</button>)}
            </div>
            <span className="text-xs" style={{ color: palette.muted }} data-testid="timeline-visible-count">{plottedPoints.length} of {points.length} snapshots</span>
        </div>
        <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: palette.muted }}>
            <span>Score and benchmark share a synchronized date axis; the benchmark is rebased to 100.</span>
            <span>{dateLabel(plottedPoints[0].date)} – {dateLabel(plottedPoints.at(-1)!.date)}</span>
        </figcaption>
        <svg
            className="mt-3 block h-auto w-full touch-pan-y"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label={`Historical Signal score above ${benchmarkName}, rebased to 100, over the same dates.`}
            onPointerMove={move}
            onPointerLeave={() => setActiveIndex(null)}
        >
            <desc>Score zones are shaded. Solid score markers are observed, hollow markers are reconstructed, and vertical ticks mark tier changes.</desc>
            {[
                { min: 0, max: 39, color: palette.zones[0] },
                { min: 40, max: 64, color: palette.zones[1] },
                { min: 65, max: 84, color: palette.zones[2] },
                { min: 85, max: 100, color: palette.zones[3] },
            ].map((zone) => <rect key={zone.min} x={PLOT.left} y={scoreY(zone.max)} width={plotWidth} height={scoreY(zone.min) - scoreY(zone.max)} fill={zone.color} opacity="0.65" />)}
            {[0, 40, 65, 85, 100].map((tick) => <g key={tick}>
                <line x1={PLOT.left} x2={WIDTH - PLOT.right} y1={scoreY(tick)} y2={scoreY(tick)} stroke={palette.grid} strokeWidth="0.75" />
                <text x={PLOT.left - 8} y={scoreY(tick) + 3} textAnchor="end" fontSize="9" fill={palette.muted}>{tick}</text>
            </g>)}
            <text x={PLOT.left} y="17" fontSize="10" fontWeight="700" fill={palette.primary}>Composite score</text>
            <path d={path((point) => scoreY(point.score))} fill="none" stroke={palette.score} strokeWidth="2" strokeLinejoin="round" />
            {tierChanges.map((point) => <line key={`tier-${point.date}`} x1={x(point.date)} x2={x(point.date)} y1={PLOT.scoreTop} y2={PLOT.scoreTop + 10} stroke={palette.muted} strokeWidth="1.5"><title>Tier changed to {point.tier} on {point.date}</title></line>)}
            {plottedPoints.map((point) => <circle
                key={point.date}
                cx={x(point.date)}
                cy={scoreY(point.score)}
                r="3.2"
                fill={point.origin === 'reconstructed' ? palette.reconstructed : palette.observed}
                stroke={palette.observed}
                strokeWidth={point.origin === 'reconstructed' ? '1.8' : '0.75'}
                data-origin={point.origin}
            ><title>{point.date}: score {point.score}, {point.tier}, {point.origin}</title></circle>)}

            {[marketMin, 100, marketMax].filter((tick, index, ticks) => ticks.indexOf(tick) === index).map((tick) => <g key={tick}>
                <line x1={PLOT.left} x2={WIDTH - PLOT.right} y1={marketY(tick)} y2={marketY(tick)} stroke={palette.grid} strokeWidth={tick === 100 ? 1.25 : 0.75} strokeDasharray={tick === 100 ? '4 3' : undefined} />
                <text x={PLOT.left - 8} y={marketY(tick) + 3} textAnchor="end" fontSize="9" fill={palette.muted}>{tick}</text>
            </g>)}
            <text x={PLOT.left} y={PLOT.marketTop - 11} fontSize="10" fontWeight="700" fill={palette.primary}>{benchmarkName} · rebased to 100</text>
            <path d={path((point) => marketY(point.benchmark_rebased))} fill="none" stroke={palette.market} strokeWidth="2" strokeLinejoin="round" />
            {xTicks.map((point) => <text key={`date-${point.date}`} x={x(point.date)} y={HEIGHT - 8} textAnchor={point === plottedPoints[0] ? 'start' : point === plottedPoints.at(-1) ? 'end' : 'middle'} fontSize="9" fill={palette.muted}>{dateLabel(point.date)}</text>)}

            {active && activeX !== null ? <g pointerEvents="none">
                <line x1={activeX} x2={activeX} y1={PLOT.scoreTop} y2={PLOT.marketBottom} stroke={palette.hover} strokeWidth="1" strokeDasharray="3 3" />
                <circle cx={activeX} cy={scoreY(active.score)} r="5" fill={palette.reconstructed} stroke={palette.hover} strokeWidth="2" />
                <circle cx={activeX} cy={marketY(active.benchmark_rebased)} r="5" fill={palette.reconstructed} stroke={palette.hover} strokeWidth="2" />
            </g> : null}
        </svg>
        {active ? <div className="mt-2 grid gap-2 rounded border px-3 py-2 text-xs sm:grid-cols-4" style={{ borderColor: palette.grid, color: palette.muted }} aria-live="polite">
            <span><strong style={{ color: palette.primary }}>{dateLabel(active.date)}</strong></span>
            <span>Score <strong style={{ color: palette.primary }}>{active.score}</strong> · {active.tier}</span>
            <span>{benchmarkName} <strong style={{ color: palette.primary }}>{active.benchmark_rebased.toFixed(1)}</strong></span>
            <span>{active.origin}{active.model_version ? ` · model ${active.model_version}` : ' · model version not recorded'}</span>
            {active.coverage_note ? <span className="sm:col-span-4">Coverage: {active.coverage_note}</span> : null}
        </div> : null}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px]" style={{ color: palette.muted }} aria-hidden="true">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: palette.observed }} />Observed</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border-2 bg-transparent" style={{ borderColor: palette.observed }} />Reconstructed</span>
            <span>Short top ticks mark tier changes</span>
        </div>
    </figure>;
};
