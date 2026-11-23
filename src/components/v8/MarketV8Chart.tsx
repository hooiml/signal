'use client';

import { useId, useState } from 'react';
import type { Point } from './market-v8-fixtures';
import { fullDate } from './MarketV8ConnectedData';
import { getIndicatorDisplayName } from '@/lib/indicator-registry';
import { MARKET_SCORE_TIER_THRESHOLDS } from '@/lib/market-score-thresholds';
import styles from './market-v8.module.css';

type XY = { readonly x: number; readonly y: number };

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

/** Fritsch-Carlson monotone cubic Bézier segments so curves stay smooth without overshooting extrema. */
function monotoneSegments(pts: readonly XY[]): string[] {
    const n = pts.length;
    if (n < 2) return [];
    if (n === 2) return [`L${round2(pts[1].x)},${round2(pts[1].y)}`];

    const dx: number[] = [];
    const slopes: number[] = [];
    for (let i = 0; i < n - 1; i += 1) {
        const span = pts[i + 1].x - pts[i].x;
        dx.push(span);
        slopes.push(Math.abs(span) > 1e-6 ? (pts[i + 1].y - pts[i].y) / span : 0);
    }

    const tangents = new Array<number>(n).fill(0);
    tangents[0] = slopes[0];
    tangents[n - 1] = slopes[n - 2];
    for (let i = 1; i < n - 1; i += 1) {
        if (slopes[i - 1] * slopes[i] <= 0) {
            tangents[i] = 0;
        } else {
            const w1 = 2 * dx[i] + dx[i - 1];
            const w2 = dx[i] + 2 * dx[i - 1];
            const denom = w1 / slopes[i - 1] + w2 / slopes[i];
            tangents[i] = Math.abs(denom) > 1e-12 ? (w1 + w2) / denom : 0;
        }
    }

    for (let i = 0; i < n - 1; i += 1) {
        if (Math.abs(slopes[i]) < 1e-9) {
            tangents[i] = 0;
            tangents[i + 1] = 0;
        } else {
            const a = tangents[i] / slopes[i];
            const b = tangents[i + 1] / slopes[i];
            const sq = a * a + b * b;
            if (sq > 9) {
                const scale = 3 / Math.sqrt(sq);
                tangents[i] = scale * a * slopes[i];
                tangents[i + 1] = scale * b * slopes[i];
            }
        }
    }

    const segments: string[] = [];
    for (let i = 0; i < n - 1; i += 1) {
        const h = dx[i] / 3;
        const c1x = round2(pts[i].x + h);
        const c1y = round2(pts[i].y + h * tangents[i]);
        const c2x = round2(pts[i + 1].x - h);
        const c2y = round2(pts[i + 1].y - h * tangents[i + 1]);
        segments.push(`C${c1x},${c1y} ${c2x},${c2y} ${round2(pts[i + 1].x)},${round2(pts[i + 1].y)}`);
    }
    return segments;
}

function smoothPath(pts: readonly XY[]): string {
    if (pts.length === 0) return '';
    const head = `M${round2(pts[0].x)},${round2(pts[0].y)}`;
    if (pts.length === 1) return head;
    return `${head} ${monotoneSegments(pts).join(' ')}`;
}


/** Time-based trailing average, used only for the optional V9 presentation layer. */
function trailingDateAverage(points: readonly Point[], windowDays: number): number[] {
    let sum = 0;
    let start = 0;
    return points.map((point, index) => {
        sum += point.value;
        const cutoff = Date.parse(point.date) - windowDays * 86_400_000;
        while (start < index && Date.parse(points[start].date) < cutoff) {
            sum -= points[start].value;
            start += 1;
        }
        return sum / (index - start + 1);
    });
}

function geometry(points: Point[], width: number, height: number, min: number, max: number, pad = 0, firstDate = points[0].date, lastDate = points.at(-1)!.date) {
    const first = Date.parse(firstDate);
    const duration = Date.parse(lastDate) - first || 1;
    const rounded = (value: number) => Math.round(value * 100) / 100;
    return points.map(point => ({ x: rounded(pad + (Date.parse(point.date) - first) / duration * (width - pad * 2)), y: rounded(pad + (1 - (point.value - min) / (max - min || 1)) * (height - pad * 2)) }));
}
/** Score axis zoomed to the data, always keeping the neutral band visible and snapping to 10s inside 0–100. */
export function scoreAxis(values: readonly number[]): { minimum: number; maximum: number } {
    const low = Math.min(...values, MARKET_SCORE_TIER_THRESHOLDS.neutralLower);
    const high = Math.max(...values, MARKET_SCORE_TIER_THRESHOLDS.neutralUpper);
    let minimum = Math.max(0, Math.floor((low - 5) / 10) * 10);
    let maximum = Math.min(100, Math.ceil((high + 5) / 10) * 10);
    if (maximum - minimum < 40) { const grow = 40 - (maximum - minimum); minimum = Math.max(0, minimum - Math.ceil(grow / 2)); maximum = Math.min(100, minimum + 40); }
    return { minimum, maximum };
}
export function Sparkline({ points, weekly = false }: { points: Point[]; weekly?: boolean }) {
    if (points.length < 2) return <span className={styles.noHistory}>History unavailable</span>;
    const values = points.map(p => p.value);
    const locations = geometry(points, 160, 44, Math.min(...values), Math.max(...values), 3);
    return <svg className={styles.sparkline} viewBox="0 0 160 44" aria-hidden="true"><path d={locations.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />{weekly && locations.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2" fill="currentColor" />)}</svg>;
}
export type ScoreHistoryView = 'recorded' | 'recalculated';
export type BenchmarkOverlaySeries = {
    readonly label: string;
    readonly shortLabel?: string;
    readonly points: readonly { readonly date: string; readonly close: number }[];
    readonly unitPrefix?: string;
};

function historyPointLabel(point: Point, view: ScoreHistoryView) {
    const source = point.origin === 'reconstructed' ? 'Backfilled' : point.origin === 'observed' ? 'Observed' : 'Origin unavailable';
    return view === 'recalculated'
        ? `Recalculated with v2.2.0 · ${source.toLowerCase()} inputs`
        : `${source} · ${point.modelVersion ? `Model v${point.modelVersion}` : 'Model version unknown'}`;
}

export function MarketChart({ points, selectedDate, onSelect, raw = false, name = 'Market condition score', sourced = false, replayAvailable = true, compactLegend = false, historyView, dateLabels, benchmarkOverlay, enableTrend = false, trendWindowDays = 14 }: {
    points: Point[]; selectedDate?: string; onSelect?: (point: Point) => void; raw?: boolean; name?: string;
    sourced?: boolean; replayAvailable?: boolean; compactLegend?: boolean; historyView?: ScoreHistoryView;
    dateLabels?: readonly [string, string, string]; benchmarkOverlay?: BenchmarkOverlaySeries; enableTrend?: boolean; trendWindowDays?: number;
}) {
    const id = useId().replace(/:/g, '');
    const [cursor, setCursor] = useState(() => {
        const initial = points.findIndex(p => p.date === selectedDate);
        return initial >= 0 ? initial : points.length - 1;
    });
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    // Only embedded V9 enables this view; V8 retains the original chart.
    const [showTrend, setShowTrend] = useState(enableTrend);
    const trendActive = enableTrend && sourced && !raw && showTrend;
    if (!points.length) return <div className={styles.chartEmpty}>
        {historyView === 'recalculated' ? 'No recalculated scores are available in this range.' : 'No historical observations are supplied.'}
    </div>;
    const axis = raw ? { minimum: Math.floor(Math.min(...points.map(p => p.value)) * 0.75), maximum: Math.ceil(Math.max(...points.map(p => p.value)) * 1.15) } : scoreAxis(points.map(p => p.value));
    const { minimum, maximum } = axis;
    const yFor = (value: number) => (1 - (value - minimum) / (maximum - minimum || 1)) * 226;
    const [firstDate, middleDate, lastDate] = dateLabels ?? [points[0].date, points[Math.floor(points.length / 2)].date, points.at(-1)!.date];
    const locations = geometry(points, 800, 226, minimum, maximum, 0, firstDate, lastDate);
    const selectedIndex = points.findIndex(point => point.date === selectedDate);
    const committed = selectedIndex >= 0 ? selectedIndex : Math.max(0, Math.min(cursor, points.length - 1));
    const at = hoverIndex !== null ? Math.max(0, Math.min(hoverIndex, points.length - 1)) : committed;
    const position = locations[at];
    const path = smoothPath(locations);
    const active = points[at];
    const origin = historyView ? historyPointLabel(active, historyView) : `Origin: ${active.origin ?? 'unavailable'}`;
    const missingInputs = historyView === 'recalculated' ? active.recalculatedV220?.missing_inputs ?? [] : [];
    const missing = missingInputs.length > 0 ? `Partial · Neutral fallback for ${missingInputs.map(getIndicatorDisplayName).join(', ')}` : null;
    // V9's v2.2.0 recalculated scores share one scoring scale even when their input
    // provenance alternates. Other views retain the original source/model breaks.
    const comparableRecalculated = enableTrend && historyView === 'recalculated';
    const canConnect = (previous: Point | undefined, point: Point | undefined) => !!previous && !!point
        && !point.breakBefore
        && (comparableRecalculated
            ? !!previous.recalculatedV220 && !!point.recalculatedV220
                // Do not interpolate long unobserved gaps in sparse backfill.
                && Date.parse(point.date) > Date.parse(previous.date)
                && Date.parse(point.date) - Date.parse(previous.date) <= 21 * 86_400_000
            : previous.origin === point.origin
                && (historyView !== 'recorded' || (!!previous.modelVersion && previous.modelVersion === point.modelVersion)));
    const provenancePaths = points.map((point, i) => ({
        point,
        location: locations[i],
        connected: canConnect(points[i - 1], point),
        continues: canConnect(point, points[i + 1]),
    }));
    const provenanceRuns: {
        readonly origin: Point['origin'];
        readonly items: { readonly index: number; readonly point: Point; readonly location: XY }[];
    }[] = [];
    for (let i = 0; i < points.length; i += 1) {
        const point = points[i];
        const location = locations[i];
        const currentRun = provenanceRuns.at(-1);
        if (currentRun && canConnect(points[i - 1], point)) {
            currentRun.items.push({ index: i, point, location });
        } else {
            provenanceRuns.push({ origin: point.origin, items: [{ index: i, point, location }] });
        }
    }
    // Reset at actual gaps or incompatible models; comparable recalculated input
    // origins share the same curve without erasing their per-point labels.
    const trendByIndex = new Map<number, number>();
    const trendRuns = enableTrend && sourced && !raw ? provenanceRuns.map(run => {
        const means = trailingDateAverage(run.items.map(item => item.point), trendWindowDays);
        const locations = run.items.map((item, index) => {
            trendByIndex.set(item.index, means[index]);
            return { x: item.location.x, y: round2(yFor(means[index])) };
        });
        return { origin: run.origin, items: run.items, locations };
    }) : [];
    const selectedTrend = trendByIndex.get(at);
    const segmentByIndex = new Map<number, string>();
    for (const run of provenanceRuns) {
        if (run.items.length < 2) continue;
        const segments = monotoneSegments(run.items.map(item => item.location));
        for (let k = 1; k < run.items.length; k += 1) {
            const prevLoc = run.items[k - 1].location;
            segmentByIndex.set(run.items[k].index, `M${round2(prevLoc.x)},${round2(prevLoc.y)} ${segments[k - 1]}`);
        }
    }
    const latestValue = points[at].value;
    const accentStroke = raw
        ? 'var(--chart-line)'
        : latestValue >= MARKET_SCORE_TIER_THRESHOLDS.neutralUpper
            ? 'var(--up-mark)'
            : latestValue < MARKET_SCORE_TIER_THRESHOLDS.neutralLower
                ? 'var(--down-mark)'
                : 'var(--caution-mark)';

    function nearestIndex(clientX: number, svg: SVGSVGElement) {
        const box = svg.getBoundingClientRect();
        const x = (clientX - box.left) / (box.width || 1) * 816 - 8;
        return locations.reduce((best, p, i) => Math.abs(p.x - x) < Math.abs(locations[best].x - x) ? i : best, 0);
    }

    const firstMs = Date.parse(firstDate);
    const lastMs = Date.parse(lastDate);
    const overlayData = (() => {
        if (!benchmarkOverlay || !Number.isFinite(firstMs) || !Number.isFinite(lastMs) || lastMs <= firstMs) return null;
        const valid = benchmarkOverlay.points
            .map(point => ({ date: point.date, ms: Date.parse(point.date), close: point.close }))
            .filter(point => Number.isFinite(point.ms) && Number.isFinite(point.close) && point.close > 0)
            .sort((a, b) => a.ms - b.ms);
        const inside = valid.filter(point => point.ms >= firstMs && point.ms <= lastMs);
        let windowPoints = inside;
        if (inside.length < 2) {
            const prior = valid.filter(point => point.ms < firstMs).at(-1);
            if (prior) windowPoints = [prior, ...inside];
        }
        if (windowPoints.length < 2) return null;
        const baseClose = windowPoints[0].close;
        const duration = lastMs - firstMs || 1;
        const rawSeries = windowPoints.map(point => ({
            ...point,
            pct: ((point.close - baseClose) / baseClose) * 100,
        }));
        const rawMin = Math.min(...rawSeries.map(point => point.pct));
        const rawMax = Math.max(...rawSeries.map(point => point.pct));
        const rawSpan = rawMax - rawMin;
        const padPct = Math.max(0.5, rawSpan * 0.12);
        const minPct = rawMin - padPct;
        const maxPct = rawMax + padPct;
        const pctSpan = maxPct - minPct || 1;
        const mapped = rawSeries.map(point => {
            const clampedMs = Math.max(firstMs, Math.min(lastMs, point.ms));
            return {
                ...point,
                x: round2(((clampedMs - firstMs) / duration) * 800),
                y: round2((1 - (point.pct - minPct) / pctSpan) * 226),
            };
        });
        const pathD = smoothPath(mapped);
        const activeMs = Date.parse(active.date);
        let matched = Number.isFinite(activeMs) && activeMs >= mapped[0].ms ? mapped[0] : null;
        if (matched && Number.isFinite(activeMs)) {
            for (const point of mapped) {
                if (point.ms <= activeMs) matched = point;
                else break;
            }
        }
        const decimals = pctSpan < 4 ? 1 : 0;
        const formatTick = (value: number) => {
            const cleaned = Math.abs(value) < 0.05 ? 0 : value;
            return `${cleaned > 0 ? '+' : ''}${cleaned.toFixed(decimals)}%`;
        };
        return {
            label: benchmarkOverlay.label,
            shortLabel: benchmarkOverlay.shortLabel ?? benchmarkOverlay.label.split(' ')[0],
            unitPrefix: benchmarkOverlay.unitPrefix ?? '',
            pathD,
            matched,
            ticks: [formatTick(maxPct), formatTick((minPct + maxPct) / 2), formatTick(minPct)] as const,
        };
    })();

    return <div className={styles.chart}>
        <div className={styles.chartTopline}><span>{sourced ? raw ? 'Raw readings from archived snapshots' : `0–100 composite · axis ${minimum}–${maximum}` : raw ? 'Raw observations · illustrative' : '0–100 composite · illustrative history'}</span><output aria-live="polite">{fullDate(active.date)} <b>{active.value.toFixed(raw ? 2 : 0)}{raw ? '' : ' /100'}</b>{sourced && !raw && <span>{origin}</span>}{trendActive && selectedTrend !== undefined && <span>· {trendWindowDays}-day trend {selectedTrend.toFixed(1)} /100</span>}{overlayData?.matched && <span>· {overlayData.shortLabel} {overlayData.unitPrefix}{overlayData.matched.close.toFixed(overlayData.matched.close >= 1000 ? 0 : 2)} ({overlayData.matched.pct >= 0 ? '+' : ''}{overlayData.matched.pct.toFixed(1)}%)</span>}{missing && <span>{missing}</span>}</output></div>
        {enableTrend && sourced && !raw && (
            <div className={styles.chartPresentation}>
                <div className={styles.chartPresentationToggle} role="group" aria-label="Score chart presentation">
                    <button type="button" aria-pressed={trendActive} onClick={() => setShowTrend(true)}>Smooth trend</button>
                    <button type="button" aria-pressed={!trendActive} onClick={() => setShowTrend(false)}>Daily scores</button>
                </div>
                <span>{trendActive ? `${trendWindowDays}-day trailing average (bold) · actual scores (faint) · display only` : 'Actual daily scores · no smoothing'}</span>
            </div>
        )}
        {sourced && !raw && (compactLegend ? <ul className={styles.compactChartLegend} aria-label="Chart legend">
            <li><span aria-hidden="true">━</span> {trendActive ? 'Smoothed trend (solid)' : historyView === 'recalculated' ? 'Observed inputs' : 'Observed'}</li>
            <li><span aria-hidden="true">┄</span> {trendActive ? 'Actual scores (faint; backfilled dashed)' : historyView === 'recalculated' ? 'Backfilled inputs' : historyView ? 'Backfilled' : 'Reconstructed'}</li>
            <li><span aria-hidden="true" className={styles.neutralLegendSwatch} /> Neutral {MARKET_SCORE_TIER_THRESHOLDS.neutralLower}–{MARKET_SCORE_TIER_THRESHOLDS.neutralUpper - 1}</li>
            {overlayData && <li><span aria-hidden="true" data-testid="benchmark-overlay-legend" className={styles.benchmarkLegendLine} /> {overlayData.label} (right axis %)</li>}
        </ul> : <p className={styles.chartLegend}>{comparableRecalculated ? 'Comparable recalculated scores connect across input origins; missing-history gaps remain. ' : '━━ Observed · ┄┄ Reconstructed · breaks separate origins · ' }Shaded band = neutral score tier {MARKET_SCORE_TIER_THRESHOLDS.neutralLower}–{MARKET_SCORE_TIER_THRESHOLDS.neutralUpper - 1}</p>)}
        <div className={styles.chartPlot}>
            <div className={styles.axis}>{[maximum, (maximum + minimum) / 2, minimum].map(value => <span key={value}>{value.toFixed(0)}</span>)}</div>
            <svg viewBox="-8 -8 816 242" preserveAspectRatio="none" role={onSelect ? 'slider' : 'img'} tabIndex={onSelect ? 0 : undefined} aria-label={name} aria-valuemin={onSelect ? 0 : undefined} aria-valuemax={onSelect ? points.length - 1 : undefined} aria-valuenow={onSelect ? at : undefined} aria-valuetext={onSelect ? `${fullDate(active.date)}, score ${active.value}.${historyView ? ` ${origin}.${missing ? ` ${missing}.` : ''}` : ''} Arrow keys preview, Enter selects a preview.` : undefined}
                onKeyDown={event => {
                    if (!onSelect) return;
                    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                        event.preventDefault();
                        setHoverIndex(null);
                        const next = event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : Math.max(0, Math.min(points.length - 1, committed + (event.key === 'ArrowRight' ? 1 : -1)));
                        setCursor(next); if (sourced) onSelect(points[next]);
                    } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(points[at]); }
                }}
                onPointerMove={event => {
                    if (event.pointerType === 'mouse' && onSelect) setHoverIndex(nearestIndex(event.clientX, event.currentTarget));
                }}
                onPointerLeave={() => setHoverIndex(null)}
                onClick={event => {
                    if (!onSelect) return;
                    const nearest = nearestIndex(event.clientX, event.currentTarget);
                    setHoverIndex(null);
                    setCursor(nearest); onSelect(points[nearest]);
                }}>
                <defs>
                    <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
                        <stop stopColor={accentStroke} stopOpacity=".24" />
                        <stop offset="1" stopColor={accentStroke} stopOpacity=".01" />
                    </linearGradient>
                </defs>
                {!raw && <rect x="0" y={yFor(MARKET_SCORE_TIER_THRESHOLDS.neutralUpper)} width="800" height={yFor(MARKET_SCORE_TIER_THRESHOLDS.neutralLower) - yFor(MARKET_SCORE_TIER_THRESHOLDS.neutralUpper)} fill="var(--line-strong)" fillOpacity=".26" />}
                {[0, 56.5, 113, 169.5, 226].map(y => <line key={y} x1="0" x2="800" y1={y} y2={y} stroke="currentColor" strokeOpacity=".10" strokeDasharray="3 5" />)}
                {!raw && [MARKET_SCORE_TIER_THRESHOLDS.neutralLower, MARKET_SCORE_TIER_THRESHOLDS.neutralUpper].map(threshold => <line key={threshold} x1="0" x2="800" y1={yFor(threshold)} y2={yFor(threshold)} stroke="var(--subtle)" strokeOpacity=".72" strokeDasharray="4 4" />)}
                {overlayData && <path d={overlayData.pathD} data-testid="benchmark-overlay-path" fill="none" stroke="var(--benchmark-line, var(--subtle))" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
                {sourced && !raw ? <>
                    {provenanceRuns.map((run, runIndex) => {
                        if (comparableRecalculated || run.origin !== 'observed' || run.items.length < 2) return null;
                        const runLine = smoothPath(trendActive ? trendRuns[runIndex].locations : run.items.map(item => item.location));
                        const firstX = run.items[0].location.x;
                        const lastX = run.items[run.items.length - 1].location.x;
                        return (
                            <path
                                key={`fill-${run.items[0].point.date}`}
                                d={`${runLine} L${lastX},226 L${firstX},226 Z`}
                                fill={`url(#${id})`}
                            />
                        );
                    })}
                    {provenancePaths.map(({ point, location, connected, continues }, index) => {
                        const isReconstructed = point.origin === 'reconstructed';
                        const segStroke = trendActive ? 'var(--muted)' : isReconstructed ? 'var(--muted)' : accentStroke;
                        const segD = connected ? segmentByIndex.get(index) : undefined;
                        return (
                            <g key={point.date} data-origin={point.origin ?? 'unavailable'}>
                                {segD && (
                                    <path
                                        d={segD}
                                        fill="none"
                                        stroke={segStroke}
                                        strokeWidth={trendActive ? '1.3' : isReconstructed ? '2' : '2.4'}
                                        strokeOpacity={trendActive ? 0.42 : 1}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeDasharray={isReconstructed ? '5 4' : undefined}
                                        vectorEffect="non-scaling-stroke"
                                    />
                                )}
                                {!connected && !continues && (
                                    <circle cx={location.x} cy={location.y} r={trendActive ? 2.4 : 3} fill={segStroke} opacity={trendActive ? 0.5 : 1} />
                                )}
                            </g>
                        );
                    })}
                    {trendActive && trendRuns.map((run, index) => run.items.length < 2 ? null : (
                        <path
                            key={`trend-${index}`}
                            data-testid="v9-score-trend-path"
                            d={smoothPath(run.locations)}
                            fill="none"
                            stroke={comparableRecalculated ? accentStroke : run.origin === 'reconstructed' ? 'var(--muted)' : accentStroke}
                            strokeWidth={comparableRecalculated ? '3' : run.origin === 'reconstructed' ? '2.4' : '3'}
                            strokeDasharray={!comparableRecalculated && run.origin === 'reconstructed' ? '6 4' : undefined}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                        />
                    ))}
                </> : <><path d={`${path} L800,226 L0,226 Z`} fill={`url(#${id})`} /><path d={path} fill="none" stroke={accentStroke} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></>}
                <line x1={position.x} x2={position.x} y1="0" y2="226" stroke={accentStroke} strokeDasharray="4 4" opacity=".45" />
                {overlayData?.matched && <circle data-testid="benchmark-overlay-marker" cx={overlayData.matched.x} cy={overlayData.matched.y} r="3.5" fill="var(--surface)" stroke="var(--benchmark-line, var(--subtle))" strokeWidth="2" />}
                {trendActive && selectedTrend !== undefined && <circle cx={position.x} cy={yFor(selectedTrend)} r="3.4" fill={accentStroke} stroke="var(--surface)" strokeWidth="1.2" />}
                <circle cx={position.x} cy={position.y} r="9" fill={accentStroke} opacity=".2" />
                <circle cx={position.x} cy={position.y} r="4.8" fill="var(--surface)" stroke={accentStroke} strokeWidth="2.8" />
            </svg>
            {overlayData && <div className={styles.axisRight} data-testid="benchmark-overlay-axis" aria-hidden="true">{overlayData.ticks.map((tick, index) => <span key={index}>{tick}</span>)}</div>}
        </div>
        <div className={overlayData ? `${styles.chartDates} ${styles.chartDatesWithRight}` : styles.chartDates}><span>{fullDate(firstDate)}</span><span>{fullDate(middleDate)}</span><span>{fullDate(lastDate)}</span></div>
        {onSelect && <span className={styles.chartHint}>{historyView === 'recalculated' ? 'Hover, click or use arrow keys to inspect a recalculated score.' : sourced ? replayAvailable ? 'Hover, click or use arrow keys to preview. Use Open historical snapshot to enter replay.' : 'Hover, click or use arrow keys to inspect a stored score.' : 'Select a date to investigate · keyboard: ← → then Enter'}</span>}
    </div>;
}
