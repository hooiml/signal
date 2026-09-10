'use client';

import { useId, useMemo, useState, useEffect, useRef, type PointerEvent as ReactPointerEvent, type KeyboardEvent } from 'react';
import {
    getMarketV8TimelineFixture,
    timelineFixtureDescription,
    timelineSnapshotDate,
    type MarketV8TimelineRecord,
    type TimelineMarket,
    type TimelineMode,
    type TimelineObservationKind,
    type TimelineRange,
} from './market-v8-timeline-fixtures';
import styles from './market-v8-timeline.module.css';
import { tierForMarketScore } from '@/lib/market-sensitivity';
import type { MarketSignal, SignalTier } from '@/lib/types/signal-v2';

type CalibrationTimeline = NonNullable<MarketSignal['metadata']['historical_validation']>['timeline'];
type TimelineDisplayRecord = Omit<MarketV8TimelineRecord, 'coveragePct' | 'timelineOnly' | 'benchmarkKind'> & {
    coveragePct: number | null;
    timelineOnly?: boolean;
    benchmarkKind: TimelineObservationKind | null;
    tier?: SignalTier;
};

export type MarketV8TimelineProps = {
    market: TimelineMarket;
    mode: TimelineMode;
    partial: boolean;
    /** Backend calibration points. When omitted, the existing V8 illustrative fixture is used. */
    data?: CalibrationTimeline;
    benchmarkLabel?: string;
    modelVersion?: string;
    snapshotDate?: string;
};

const RANGE_MONTHS: Record<Exclude<TimelineRange, 'All'>, number> = {
    '1M': 1, '3M': 3, '6M': 6, '1Y': 12, '3Y': 36, '5Y': 60,
};
const ranges: TimelineRange[] = ['1M', '3M', '6M', '1Y', '3Y', '5Y', 'All'];
const SCORE_MIN = 0;
const SCORE_MAX = 100;
const PLOT_LEFT = 54;

const PLOT_TOP = 22;
const PLOT_BOTTOM = 170;
const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;
const CHART_WIDTH = 900;

const formatDate = (date: string) => new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${date}T12:00:00Z`));
const shortDate = (date: string) => new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', timeZone: 'UTC',
}).format(new Date(`${date}T12:00:00Z`));
const formatRangeStart = (range: TimelineRange, latestDate: string) => {
    if (range === 'All') return null;
    const start = rangeStart(range, latestDate);
    return formatDate(start.toISOString().slice(0, 10));
};
const rangeStart = (range: Exclude<TimelineRange, 'All'>, latestDate: string) => {
    const start = new Date(`${latestDate}T12:00:00Z`);
    start.setUTCMonth(start.getUTCMonth() - RANGE_MONTHS[range]);
    return start;
};
const toTimestamp = (date: string) => Date.parse(`${date}T12:00:00Z`);
const kindLabel = (kind: TimelineObservationKind) => kind[0].toUpperCase() + kind.slice(1);
const statusClass = (kind: TimelineObservationKind) => kind === 'observed' ? styles.observed : kind === 'reconstructed' ? styles.reconstructed : styles.limited;

function lineSegments(records: TimelineDisplayRecord[], valueFor: (record: TimelineDisplayRecord, index: number) => number | null) {
    const segments: Array<Array<{ x: number; y: number }>> = [];
    let current: Array<{ x: number; y: number }> = [];
    records.forEach((record, index) => {
        const value = valueFor(record, index);
        if (value === null) {
            if (current.length > 1) segments.push(current);
            current = [];
            return;
        }
        const point = { x: index, y: value };
        current.push(point);
    });
    if (current.length > 1) segments.push(current);
    return segments;
}

function pathFor(points: Array<{ x: number; y: number }>, xFor: (index: number) => number, yFor: (value: number) => number) {
    return points.map((point, index) => `${index ? 'L' : 'M'}${xFor(point.x).toFixed(2)},${yFor(point.y).toFixed(2)}`).join(' ');
}

function selectIndexFromPointer(event: ReactPointerEvent<SVGSVGElement>, records: TimelineDisplayRecord[], xFor: (index: number) => number, chartWidth: number) {
    const box = event.currentTarget.getBoundingClientRect();
    const relativeX = ((event.clientX - box.left) / box.width) * chartWidth;
    return records.reduce((best, _record, index) => Math.abs(xFor(index) - relativeX) < Math.abs(xFor(best) - relativeX) ? index : best, 0);
}

function StatusMarker({ record, x, y, status }: { record: TimelineDisplayRecord; x: number; y: number; status: TimelineObservationKind }) {
    const className = `${styles.marker} ${statusClass(status)} ${record.timelineOnly ? styles.timelineOnlyMarker : ''}`;
    if (status === 'limited') return <rect className={className} x={x - 4} y={y - 4} width="8" height="8" rx="1" />;
    if (status === 'reconstructed') return <circle className={className} cx={x} cy={y} r="4.5" strokeDasharray="2 2" />;
    return <circle className={className} cx={x} cy={y} r="4" />;
}

export function MarketV8Timeline({ market, mode, partial, data, benchmarkLabel, modelVersion, snapshotDate }: MarketV8TimelineProps) {
    const fixture = useMemo(() => getMarketV8TimelineFixture(market, mode, partial), [market, mode, partial]);
    const connected = data !== undefined;
    const fixtureRecords = fixture.records;
    const records = useMemo<TimelineDisplayRecord[]>(() => data
        ? [...data.reduce((points, point) => {
            const next: TimelineDisplayRecord = {
                date: point.date,
                score: point.score,
                benchmark: point.benchmark_rebased,
                scoreKind: point.origin,
                benchmarkKind: null,
                coveragePct: null,
                modelVersion: point.model_version ?? modelVersion ?? 'Model version unavailable',
                note: point.coverage_note ?? 'Coverage note unavailable for this snapshot.',
                tier: point.tier,
            };
            const existing = points.get(point.date);
            if (!existing || point.origin === 'observed') points.set(point.date, next);
            return points;
        }, new Map<string, TimelineDisplayRecord>()).values()].sort((left, right) => left.date.localeCompare(right.date))
        : fixtureRecords,
    [data, fixtureRecords, modelVersion]);
    const effectiveBenchmarkLabel = benchmarkLabel ?? fixture.benchmarkLabel;
    const effectiveSnapshotDate = records.at(-1)?.date ?? snapshotDate ?? timelineSnapshotDate;
    const effectiveModelVersion = modelVersion ?? (connected ? 'Model version unavailable' : fixtureRecords.at(-1)?.modelVersion ?? 'Model version unavailable');
    const supportedRanges = useMemo<TimelineRange[]>(() => {
        if (!connected) return fixture.supportedRanges;
        if (records.length === 0) return [];
        const first = toTimestamp(records[0].date);
        return ranges.filter(option => option === 'All' || first <= rangeStart(option, effectiveSnapshotDate).getTime());
    }, [connected, effectiveSnapshotDate, fixture.supportedRanges, records]);
    const [range, setRange] = useState<TimelineRange>('1Y');
    const [cursorDate, setCursorDate] = useState(effectiveSnapshotDate);
    const titleId = useId().replace(/:/g, '');
    const plotRef = useRef<SVGSVGElement>(null);
    const [chartWidth, setChartWidth] = useState(CHART_WIDTH);
    useEffect(() => {
        const plot = plotRef.current;
        if (!plot) return;
        const observer = new ResizeObserver(() => setChartWidth(Math.max(160, plot.clientWidth)));
        observer.observe(plot);
        return () => observer.disconnect();
    }, []);
    const plotRight = chartWidth - 18;
    const activeRange = supportedRanges.includes(range) ? range : (supportedRanges.at(-1) ?? 'All');

    const visible = useMemo(() => {
        if (activeRange === 'All') return records;
        const start = new Date(`${effectiveSnapshotDate}T12:00:00Z`);
        start.setUTCMonth(start.getUTCMonth() - RANGE_MONTHS[activeRange]);
        const startTimestamp = start.getTime();
        return records.filter(record => toTimestamp(record.date) >= startTimestamp);
    }, [activeRange, effectiveSnapshotDate, records]);

    if (records.length === 0) {
        return <section className={styles.timeline} aria-label="Historical timeline" data-testid="market-v8-timeline">
            <div className={styles.unavailable}>
                <h2>No historical timeline</h2>
                <p>{connected ? 'No dated calibration snapshots are available for this market and configuration.' : 'The illustrative timeline contains no records.'}</p>
                {connected && <small>Model {effectiveModelVersion} · calibration snapshot count 0</small>}
            </div>
        </section>;
    }

    const visibleCursorIndex = visible.findIndex(record => record.date === cursorDate);
    const visibleCursor = visibleCursorIndex >= 0 ? visibleCursorIndex : Math.max(0, visible.length - 1);
    const selected = visible[visibleCursor] ?? visible.at(-1) ?? records.at(-1)!;
    const firstTimestamp = toTimestamp(visible[0]?.date ?? records[0].date);
    const lastTimestamp = toTimestamp(visible.at(-1)?.date ?? records.at(-1)!.date);
    const dateSpan = Math.max(1, lastTimestamp - firstTimestamp);
    const xFor = (index: number) => {
        const timestamp = toTimestamp(visible[index]?.date ?? selected.date);
        return PLOT_LEFT + ((timestamp - firstTimestamp) / dateSpan) * (plotRight - PLOT_LEFT);
    };
    const scoreY = (value: number) => PLOT_BOTTOM - ((value - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * PLOT_HEIGHT;
    const firstBenchmark = visible.find(record => record.benchmark !== null)?.benchmark ?? null;
    const benchmarkValues = visible.map(record => record.benchmark === null || firstBenchmark === null ? null : (record.benchmark / firstBenchmark) * 100);
    const benchmarkNumbers = benchmarkValues.filter((value): value is number => value !== null);
    const benchmarkMin = benchmarkNumbers.length ? Math.min(...benchmarkNumbers) - 1.5 : 95;
    const benchmarkMax = benchmarkNumbers.length ? Math.max(...benchmarkNumbers) + 1.5 : 105;
    const benchmarkY = (value: number) => PLOT_BOTTOM - ((value - benchmarkMin) / Math.max(1, benchmarkMax - benchmarkMin)) * PLOT_HEIGHT;
    const scoreSegments = lineSegments(visible, record => record.score);
    const benchmarkSegments = lineSegments(visible, (_record, index) => benchmarkValues[index]);
    const scorePath = scoreSegments.map(segment => pathFor(segment, xFor, scoreY));
    const benchmarkPath = benchmarkSegments.map(segment => pathFor(segment, xFor, benchmarkY));
    const selectedBenchmark = benchmarkValues[visibleCursor];
    const selectedReadout = `${formatDate(selected.date)}. Score ${selected.score} out of 100, ${kindLabel(selected.scoreKind)}${selected.timelineOnly ? ', timeline-only' : ''}. Benchmark ${selectedBenchmark === null ? 'unavailable' : `${selectedBenchmark.toFixed(1)} rebased`}. ${selected.coveragePct === null ? selected.note : `Coverage ${selected.coveragePct} percent.`}`;

    const chooseIndex = (nextIndex: number) => {
        const bounded = Math.max(0, Math.min(visible.length - 1, nextIndex));
        setCursorDate(visible[bounded].date);
    };
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? visible.length - 1 : visibleCursor + (event.key === 'ArrowRight' ? 1 : -1);
            chooseIndex(next);
        }
    };
    const onPointerSelect = (event: ReactPointerEvent<SVGSVGElement>) => chooseIndex(selectIndexFromPointer(event, visible, xFor, chartWidth));

    return <section className={styles.timeline} aria-labelledby={titleId} data-testid="market-v8-timeline">
        <div className={styles.headingRow}>
            <div>
                <span className={styles.kicker}>{connected ? 'Historical calibration · connected dataset' : 'Historical context · illustrative only'}</span>
                <h2 id={titleId}>Market score through time</h2>
                <p className={styles.intro}>{connected ? 'Backend calibration snapshots and benchmark observations across the selected market and model configuration.' : `${timelineFixtureDescription} Fixed snapshot ends 04 Sep 2026.`}</p>
            </div>
            <span className={styles.snapshot}>As of {formatDate(effectiveSnapshotDate)}</span>
        </div>

        <div className={styles.rangeRow} aria-label="Timeline range">
            <span className={styles.rangeLabel}>Window</span>
            <div className={styles.rangeButtons}>
                {ranges.map(option => <button
                    type="button"
                    key={option}
                    className={styles.rangeButton}
                    data-testid={`timeline-range-${option.toLowerCase()}`}
                    aria-pressed={activeRange === option}
                    disabled={!supportedRanges.includes(option)}
                    aria-label={!supportedRanges.includes(option) ? `${option}, unavailable because the dataset does not cover this window` : `${option} timeline range`}
                    title={!supportedRanges.includes(option) ? (connected ? 'Unavailable: the connected dataset does not cover this window.' : 'Unavailable: this illustrative fixture contains about two years of history.') : undefined}
                    onClick={() => { setRange(option); setCursorDate(effectiveSnapshotDate); }}
                >{option}</button>)}
            </div>
            <span className={styles.rangeNote}>{visible.length} / {records.length} records · {activeRange === 'All' ? `${formatDate(records[0].date)} – ${formatDate(effectiveSnapshotDate)}` : `${formatRangeStart(activeRange, effectiveSnapshotDate)} – ${formatDate(effectiveSnapshotDate)}`}</span>
        </div>

        <div className={styles.legend} aria-label="Timeline legend">
            <span><i className={`${styles.legendMark} ${styles.observed}`} />Observed</span>
            <span><i className={`${styles.legendMark} ${styles.reconstructed}`} />Reconstructed</span>
            <span><i className={`${styles.legendMark} ${styles.limited}`} />Limited coverage</span>
                {!connected && <span><i className={`${styles.legendMark} ${styles.timelineOnly}`} />Timeline-only</span>}
            <span className={styles.legendHint}>Click either panel to move the shared cursor · ← → Home End</span>
        </div>

        <div
            className={styles.chartGroup}
            role="slider"
            tabIndex={0}
            aria-label="Shared historical timeline cursor"
            aria-valuemin={0}
            aria-valuemax={Math.max(0, visible.length - 1)}
            aria-valuenow={visibleCursor}
            aria-valuetext={selectedReadout}
            onKeyDown={onKeyDown}
            data-testid="timeline-shared-cursor"
        >
            <div className={styles.panelHeader}><div><span className={styles.panelEyebrow}>Score</span><h3>Market condition score</h3></div><span>0–100 scale</span></div>
            <svg className={styles.plot} viewBox={`0 0 ${chartWidth} 205`} preserveAspectRatio="none" aria-hidden="true" ref={plotRef} data-testid="score-timeline-plot" onPointerDown={onPointerSelect}>
                <rect x={PLOT_LEFT} y={scoreY(100)} width={plotRight - PLOT_LEFT} height={scoreY(85) - scoreY(100)} className={styles.bandStrong} />
                <rect x={PLOT_LEFT} y={scoreY(85)} width={plotRight - PLOT_LEFT} height={scoreY(65) - scoreY(85)} className={styles.bandPositive} />
                <rect x={PLOT_LEFT} y={scoreY(65)} width={plotRight - PLOT_LEFT} height={scoreY(40) - scoreY(65)} className={styles.bandMixed} />
                <rect x={PLOT_LEFT} y={scoreY(40)} width={plotRight - PLOT_LEFT} height={scoreY(0) - scoreY(40)} className={styles.bandNegative} />
                {[0, 40, 65, 85, 100].map(value => <g key={value}><line x1={PLOT_LEFT} x2={plotRight} y1={scoreY(value)} y2={scoreY(value)} className={styles.gridLine} /><text x={PLOT_LEFT - 11} y={scoreY(value) + 3} textAnchor="end" className={styles.axisLabel}>{value}</text></g>)}
                {connected ? visible.slice(1).map((record,index) => <path key={record.date} d={`M${xFor(index)},${scoreY(visible[index].score)} L${xFor(index+1)},${scoreY(record.score)}`} className={styles.scoreLine} style={{opacity:record.scoreKind==='observed'?1:.5,strokeWidth:record.scoreKind==='observed'?2:1.2}} />) : scorePath.map((path, index) => <path key={index} d={path} className={styles.scoreLine} />)}
                {connected ? visible.map((record,index) => record.scoreKind==='observed'||index===visibleCursor ? <circle key={record.date} cx={xFor(index)} cy={scoreY(record.score)} r={index===visibleCursor?4:2} fill="var(--timeline-green)"/>:null) : visible.map((record, index) => <StatusMarker key={record.date} record={record} x={xFor(index)} y={scoreY(record.score)} status={record.scoreKind} />)}
                <line x1={xFor(visibleCursor)} x2={xFor(visibleCursor)} y1={PLOT_TOP - 5} y2={PLOT_BOTTOM + 5} className={styles.cursorLine} />
                <text x={plotRight} y={scoreY(85) - 6} textAnchor="end" className={styles.bandLabel}>Score 85–100</text>
                <text x={plotRight} y={scoreY(65) - 6} textAnchor="end" className={styles.bandLabel}>Score 65–84</text>
                <text x={plotRight} y={scoreY(40) - 6} textAnchor="end" className={styles.bandLabel}>Score 40–64</text>
                <text x={plotRight} y={scoreY(0) - 6} textAnchor="end" className={styles.bandLabel}>Score 0–39</text>
            </svg>

            <div className={styles.panelHeader}><div><span className={styles.panelEyebrow}>Benchmark</span><h3>{effectiveBenchmarkLabel}</h3></div><span>Rebased to 100</span></div>
            <svg className={styles.plot} viewBox={`0 0 ${chartWidth} 205`} preserveAspectRatio="none" aria-hidden="true" data-testid="benchmark-timeline-plot" onPointerDown={onPointerSelect}>
                {[benchmarkMin, (benchmarkMin + benchmarkMax) / 2, benchmarkMax].map(value => <g key={value}><line x1={PLOT_LEFT} x2={plotRight} y1={benchmarkY(value)} y2={benchmarkY(value)} className={styles.gridLine} /><text x={PLOT_LEFT - 11} y={benchmarkY(value) + 3} textAnchor="end" className={styles.axisLabel}>{value.toFixed(0)}</text></g>)}
                {benchmarkPath.map((path, index) => <path key={index} d={path} className={styles.benchmarkLine} />)}
                {visible.map((record, index) => record.benchmark === null ? <circle key={record.date} cx={xFor(index)} cy={benchmarkY(benchmarkMin)} r="3" className={styles.missingMarker} /> : record.benchmarkKind ? <StatusMarker key={record.date} record={record} x={xFor(index)} y={benchmarkY(benchmarkValues[index]!)} status={record.benchmarkKind} /> : null)}
                <line x1={xFor(visibleCursor)} x2={xFor(visibleCursor)} y1={PLOT_TOP - 5} y2={PLOT_BOTTOM + 5} className={styles.cursorLine} />
            </svg>

            <div className={styles.dateAxis} aria-hidden="true"><span>{shortDate(visible[0].date)} {visible[0].date.slice(0, 4)}</span><span>{shortDate(visible[Math.floor(visible.length / 2)].date)} {visible[Math.floor(visible.length / 2)].date.slice(0, 4)}</span><span>{shortDate(visible.at(-1)!.date)} {visible.at(-1)!.date.slice(0, 4)}</span></div>
        </div>

        <div className={styles.readout} aria-live="polite" data-testid="timeline-current-readout">
            <div><span className={styles.readoutLabel}>Selected date</span><strong>{formatDate(selected.date)}</strong><span className={styles.readoutTags}><span className={statusClass(selected.scoreKind)}>{kindLabel(selected.scoreKind)} score</span>{selected.timelineOnly && <span className={styles.timelineTag}>Timeline-only</span>}</span></div>
            <div><span className={styles.readoutLabel}>Score</span><strong>{selected.score}<small>/100</small></strong></div>
            <div><span className={styles.readoutLabel}>{effectiveBenchmarkLabel}</span><strong>{selectedBenchmark === null ? '—' : selectedBenchmark.toFixed(1)}<small>{selectedBenchmark === null ? 'gap' : ' rebased'}</small></strong></div>
            <div><span className={styles.readoutLabel}>Coverage</span><strong>{selected.coveragePct === null ? '—' : `${selected.coveragePct}%`}</strong><small>{selected.coveragePct === null ? 'See coverage note' : ''}</small></div>
        </div>
        <p className={styles.caption}>Benchmark values are rebased to 100 at the first valid visible record ({firstBenchmark === null ? 'no valid record in this window' : formatDate(visible.find(record => record.benchmark !== null)!.date)}). Missing benchmark records remain gaps; lines do not bridge them.</p>
        <p className={styles.modelNote}>{connected ? `Backend tier: ${selected.tier ?? 'unavailable'}.` : `Mode interpretation: ${tierForMarketScore(selected.score, mode).replaceAll('_', ' ')}.`} <b>{connected ? 'Model' : 'Fixture version'} {selected.modelVersion}</b> · {selected.note}</p>

        <details className={styles.dataDisclosure}>
            <summary>Show dated records and metadata</summary>
            <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Scrollable timeline records">
                <table>
                    <caption>Accessible table for the {activeRange} {connected ? 'connected' : 'illustrative'} timeline window</caption>
                    <thead><tr><th scope="col">Date</th><th scope="col">Score</th><th scope="col">Benchmark</th><th scope="col">Record</th><th scope="col">Coverage</th><th scope="col">{connected ? 'Model version' : 'Fixture version'}</th></tr></thead>
                    <tbody>{visible.map((record, index) => <tr key={record.date} data-date={record.date} className={index === visibleCursor ? styles.selectedRow : undefined}><th scope="row">{formatDate(record.date)}</th><td>{record.score} · {record.tier ? `${record.tier} · ` : ''}{kindLabel(record.scoreKind)}{record.timelineOnly ? ' · timeline-only' : ''}</td><td>{benchmarkValues[index] === null ? `— · ${record.benchmarkKind ? `${kindLabel(record.benchmarkKind)} ` : ''}gap` : `${benchmarkValues[index]!.toFixed(1)} · ${record.benchmarkKind ? kindLabel(record.benchmarkKind) : 'benchmark observation'}`}</td><td>{record.note}</td><td>{record.coveragePct === null ? '—' : `${record.coveragePct}%`}</td><td>{record.modelVersion}</td></tr>)}</tbody>
                </table>
            </div>
        </details>
        <p className={styles.footerNote}>{connected ? 'Connected calibration data · scores and tiers are rendered from the backend; no score or outcome values are recalculated here.' : 'Synthetic data only · no live feed, score API, persistence, or outcome calculation is connected.'}</p>
    </section>;
}
