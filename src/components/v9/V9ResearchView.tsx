'use client';

import { useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { OwnerAccessNotice } from '@/components/OwnerAccessNotice';
import { createWatchlistItemV6 } from '@/components/v6/research-records-v6';
import { applyResearchSnapshotV6 } from '@/components/v6/research-snapshot-v6';
import { getResearchActionV6, type ResearchThemeV6 } from '@/components/v6/research-v6';
import { ResearchFilingsV8 } from '@/components/v8/ResearchFilingsV8';
import { ResearchPeersV8 } from '@/components/v8/ResearchPeersV8';
import { FirstVisitCallout, useFirstVisit } from '@/components/v8/V8FirstVisit';
import { ownerUnlockHref } from '@/lib/owner-access-client';
import type { ResearchMarket, ResearchRecord, ResearchReviewSnapshot } from '@/lib/types/research';
import type { ResearchChartPoint, ResearchSnapshot } from '@/lib/types/research-snapshot';
import { parseResearchSnapshotResponse } from '@/lib/research/snapshot-input';
import { formatResearchTimestamp } from '@/lib/research/metric-provenance';
import { GuestWorkspaceConflictError } from '@/lib/research/guest-workspace';
import { dueReviewReasons, savedReviewContext } from '@/lib/research/due-review';
import { buildRebasedPeerOverlay } from '@/lib/research/peer-overlay';
import { priceSpanChange } from '@/lib/research/reading-display';
import { useReviewDay } from '@/lib/research/use-review-day';
import { readData, readPolicies } from '@/components/v8/read-data';
import { readResearchChart } from '@/components/v8/read-research-chart';
import { useV9OwnerResearch } from './useV9OwnerResearch';
import type { V9GuestDrafts } from './useV9GuestDrafts';
import { V9GuestResearchRecovery } from './V9GuestResearchRecovery';
import { useV9ResearchBenchmark } from './useV9ResearchBenchmark';
import type { V9ResearchDetail } from './V9ResearchDetails';
import { V9Navigation } from './v9-navigation';
import { smoothSplinePath, V9SegmentedPill } from './V9Primitives';
import styles from './v9-workspace.module.css';

type ChartRange = '1M' | '3M' | '1Y' | '5Y';
const OverviewPanel = dynamic(() => import('@/components/v6/OverviewPanelV6').then(module => module.OverviewPanelV6));
const EvidenceDocumentDiff = dynamic(() => import('@/components/v6/EvidenceDocumentDiffV6').then(module => module.EvidenceDocumentDiffV6));
const StructuredTriggerEditor = dynamic(() => import('@/components/v6/StructuredTriggerEditorV6').then(module => module.StructuredTriggerEditorV6));
const ResearchDetails = dynamic(() => import('./V9ResearchDetails').then(module => module.V9ResearchDetails), {
    loading: () => <p role="status">Loading research tools…</p>,
});

const readingPanels = [ ['overview', 'Overview'], ['technicals', 'Technicals'], ['financials', 'Financials & valuation'], ['filings', 'Filings'], ['peers', 'Peers'] ] as const;
const ownerPanels = [ ['review', 'Review'], ['evidence', 'Cited evidence'], ['monitoring', 'Monitoring rules'] ] as const;
const panels = [...readingPanels.map(([id]) => id), 'valuation', 'sources', ...ownerPanels.map(([id]) => id)] as const;
const detailPanels = ['technicals', 'financials', 'valuation', 'sources'] as const satisfies readonly V9ResearchDetail[];

function V9ReviewPanel({ record, snapshot, theme, writer }: {
    record: ResearchRecord;
    snapshot: ResearchSnapshot | null;
    theme: ResearchThemeV6;
    writer: ReturnType<typeof useV9OwnerResearch>;
}) {
    const [editing, setEditing] = useState(true);
    const benchmark = useV9ResearchBenchmark(snapshot, true);
    const comparison = benchmark.snapshot?.benchmark;
    const item = createWatchlistItemV6(record, 0);
    const ticker = snapshot ? applyResearchSnapshotV6(item, snapshot) : item;
    return <OverviewPanel ticker={ticker} action={getResearchActionV6(ticker)} theme={theme} record={record}
        benchmark={benchmark.loading ? null : comparison ?? null} observedCurrency={snapshot?.quote.currency ?? null}
        startReview={editing} stagedEvidence={null} workflowTemplateId={null} saving={writer.saving}
        saveError={writer.error} saveAccessIssue={writer.accessIssue} onReviewChange={setEditing}
        onSave={draft => writer.save(comparison?.baselineReturnPercent == null ? draft : {
            ...draft, decisionJournal: { ...draft.decisionJournal, benchmarkLabel: comparison.baselineName, benchmarkReturnPercent: comparison.baselineReturnPercent },
        })} />;
}

const defaultTickers: readonly { symbol: string; market: ResearchMarket }[] = [
    { symbol: 'AAPL', market: 'US' },
    { symbol: 'MSFT', market: 'US' },
    { symbol: 'NVDA', market: 'US' },
    { symbol: '1155', market: 'MY' },
    { symbol: '1295', market: 'MY' },
    { symbol: '5347', market: 'MY' },
];

const fmtCompact = (value: number | null, currency?: string | null): string => {
    if (value === null || !Number.isFinite(value)) return 'Unavailable';
    const abs = Math.abs(value);
    const sign = value < 0 ? '−' : '';
    const prefix = currency ? `${currency} ` : '';
    if (abs >= 1e12) return `${sign}${prefix}${(abs / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `${sign}${prefix}${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}${prefix}${(abs / 1e6).toFixed(1)}M`;
    return `${sign}${prefix}${abs.toFixed(2)}`;
};

const fmtPrice = (value: number | null, currency: string | null): string => {
    if (value === null || !Number.isFinite(value)) return 'Unavailable';
    return `${currency ? `${currency} ` : ''}${value.toFixed(2)}`;
};

const PEER_COLORS = ['var(--caution-mark)', 'var(--subtle)'] as const;

function PriceChart({
    symbol,
    market,
    points,
    currency,
    range,
    reviewHistory,
    peerSuggestions,
    onRangeChange,
}: {
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly points: readonly ResearchChartPoint[];
    readonly currency: string | null;
    readonly range: ChartRange;
    readonly reviewHistory?: readonly ResearchReviewSnapshot[];
    readonly peerSuggestions: readonly string[];
    readonly onRangeChange: (next: ChartRange) => void;
}) {
    const gradId = `v9-price-grad-${useId().replace(/:/g, '')}`;
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const [focusIndex, setFocusIndex] = useState<number | null>(null);
    const [measureMode, setMeasureMode] = useState(false);
    const [spanStart, setSpanStart] = useState<number | null>(null);
    const [spanEnd, setSpanEnd] = useState<number | null>(null);
    const [draggingPointer, setDraggingPointer] = useState<number | null>(null);
    const [activeReviewId, setActiveReviewId] = useState<string | null>(null);
    const [selectedPeers, setSelectedPeers] = useState<readonly string[]>([]);
    const [peerCharts, setPeerCharts] = useState<Record<string, readonly ResearchChartPoint[] | 'loading' | 'error'>>({});

    const sliced = useMemo(() => {
        if (!points.length) return [];
        const counts: Record<ChartRange, number> = { '1M': 22, '3M': 66, '1Y': 252, '5Y': 1260 };
        return points.slice(-counts[range]);
    }, [points, range]);

    const peerRequestsRef = useRef<AbortController | null>(null);
    useEffect(() => () => peerRequestsRef.current?.abort(), []);
    const missingPeersKey = selectedPeers.filter(peer => !peerCharts[`${market}:${peer}`]).join('|');

    // Fetch overlaid peer histories strictly on demand without aborting on loading state transition.
    useEffect(() => {
        if (!missingPeersKey) return;
        if (!peerRequestsRef.current || peerRequestsRef.current.signal.aborted) {
            peerRequestsRef.current = new AbortController();
        }
        const abortSignal = peerRequestsRef.current.signal;
        const toLoad = missingPeersKey.split('|');
        const timer = window.setTimeout(() => {
            setPeerCharts(current => ({
                ...current,
                ...Object.fromEntries(toLoad.map(peer => [`${market}:${peer}`, 'loading' as const])),
            }));
            for (const peer of toLoad) {
                readResearchChart(peer, market, abortSignal)
                    .then(chart => {
                        if (!abortSignal.aborted) {
                            setPeerCharts(current => ({ ...current, [`${market}:${peer}`]: chart.points }));
                        }
                    })
                    .catch(() => {
                        if (!abortSignal.aborted) {
                            setPeerCharts(current => ({ ...current, [`${market}:${peer}`]: 'error' }));
                        }
                    });
            }
        }, 0);
        return () => window.clearTimeout(timer);
    }, [market, missingPeersKey]);

    const togglePeerOverlay = (peer: string) => {
        const clean = peer.trim().toUpperCase();
        if (!clean || clean === symbol.toUpperCase()) return;
        setSelectedPeers(current => {
            if (current.includes(clean)) return current.filter(item => item !== clean);
            if (current.length >= 2) return [current[1], clean];
            return [...current, clean];
        });
        setMeasureMode(false);
        setSpanStart(null);
        setSpanEnd(null);
    };

    const overlayActive = selectedPeers.length > 0;
    const loadedPeerInputs = useMemo(() => selectedPeers.flatMap(peer => {
        const entry = peerCharts[`${market}:${peer}`];
        return Array.isArray(entry) ? [{ symbol: peer, points: entry }] : [];
    }), [market, peerCharts, selectedPeers]);
    const rebased = useMemo(
        () => (overlayActive ? buildRebasedPeerOverlay(sliced, loadedPeerInputs) : null),
        [loadedPeerInputs, overlayActive, sliced],
    );

    const bounds = useMemo(() => {
        if (!sliced.length) return { min: 0, max: 1 };
        const closes = sliced.map(p => p.close);
        const min = Math.min(...closes);
        const max = Math.max(...closes);
        return { min, max: max === min ? min + 1 : max };
    }, [sliced]);

    const reviewPins = useMemo(() => {
        if (!sliced.length || !reviewHistory?.length || overlayActive) return [];
        const firstDay = sliced[0].time.slice(0, 10);
        const lastDay = sliced[sliced.length - 1].time.slice(0, 10);
        const byDay = new Map<string, ResearchReviewSnapshot>();
        for (const entry of reviewHistory) {
            const day = entry.reviewedAt.slice(0, 10);
            if (day >= firstDay && day <= lastDay) byDay.set(day, entry);
        }
        const pins: { readonly id: string; readonly index: number; readonly day: string; readonly entry: ResearchReviewSnapshot }[] = [];
        byDay.forEach((entry, day) => {
            let bestIdx = 0;
            let bestGap = Infinity;
            const targetMs = Date.parse(`${day}T00:00:00Z`);
            if (!Number.isFinite(targetMs)) return;
            sliced.forEach((pt, idx) => {
                const gap = Math.abs(Date.parse(pt.time) - targetMs);
                if (Number.isFinite(gap) && gap < bestGap) { bestGap = gap; bestIdx = idx; }
            });
            pins.push({ id: entry.id, index: bestIdx, day, entry });
        });
        return pins.sort((a, b) => a.index - b.index);
    }, [overlayActive, reviewHistory, sliced]);

    const hasPins = reviewPins.length > 0;
    const w = 640;
    const h = hasPins ? 210 : 196;
    const padTop = hasPins ? 30 : 14;
    const padBottom = 14;
    const plotRight = overlayActive ? w - 58 : w;

    const coords = useMemo(() => {
        if (!sliced.length) return [];
        const plotH = h - padTop - padBottom;
        if (rebased) {
            const pctSpan = rebased.maxPct - rebased.minPct || 1;
            return rebased.subject.map((pt, index) => {
                const x = rebased.subject.length === 1 ? plotRight / 2 : (index / (rebased.subject.length - 1)) * plotRight;
                const y = padTop + ((rebased.maxPct - pt.pct) / pctSpan) * plotH;
                return { x, y, point: sliced[index]!, pct: pt.pct };
            });
        }
        return sliced.map((point, index) => {
            const x = sliced.length === 1 ? plotRight / 2 : (index / (sliced.length - 1)) * plotRight;
            const y = padTop + ((bounds.max - point.close) / (bounds.max - bounds.min)) * plotH;
            return { x, y, point, pct: null as number | null };
        });
    }, [bounds.max, bounds.min, h, padTop, plotRight, rebased, sliced]);

    const rebasedPeerPaths = useMemo(() => {
        if (!rebased || !coords.length) return [];
        const plotH = h - padTop - padBottom;
        const pctSpan = rebased.maxPct - rebased.minPct || 1;
        const denom = Math.max(1, rebased.subject.length - 1);
        return rebased.peers.map((series, idx) => {
            const pts = series.points.map(pt => ({
                x: (pt.index / denom) * plotRight,
                y: padTop + ((rebased.maxPct - pt.pct) / pctSpan) * plotH,
                pct: pt.pct,
                index: pt.index,
            }));
            const d = smoothSplinePath(pts);
            return {
                symbol: series.symbol,
                available: series.available,
                latestPct: series.latestPct,
                pts,
                d,
                color: PEER_COLORS[idx % PEER_COLORS.length],
                dashed: idx === 1,
            };
        });
    }, [coords.length, h, padTop, plotRight, rebased]);

    const zeroBaselineY = rebased
        ? padTop + ((rebased.maxPct - 0) / (rebased.maxPct - rebased.minPct || 1)) * (h - padTop - padBottom)
        : null;

    const clearMeasurement = () => {
        setSpanStart(null);
        setSpanEnd(null);
        setMeasureMode(false);
        setDraggingPointer(null);
    };

    const validSpan = !overlayActive && spanStart !== null && spanEnd !== null && spanStart !== spanEnd
        && spanStart < sliced.length && spanEnd < sliced.length;
    const measured = useMemo(
        () => (validSpan ? priceSpanChange(sliced, spanStart!, spanEnd!) : null),
        [sliced, spanEnd, spanStart, validSpan],
    );

    const activeIdx = hoverIndex !== null && hoverIndex < sliced.length
        ? hoverIndex
        : focusIndex !== null && focusIndex < sliced.length
            ? focusIndex
            : sliced.length - 1;
    const active = sliced[activeIdx] ?? null;
    const first = sliced[0] ?? null;
    const periodPct = active && first && first.close > 0 ? ((active.close - first.close) / first.close) * 100 : null;
    const isUp = (periodPct ?? 0) >= 0;
    const stroke = overlayActive ? 'var(--brand)' : isUp ? 'var(--up-mark)' : 'var(--down-mark)';

    const linePath = smoothSplinePath(coords);
    const areaPath = !overlayActive && coords.length > 1 ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${h} L ${coords[0].x.toFixed(1)} ${h} Z` : '';
    const activeCoord = coords[activeIdx] ?? null;
    const spanLeftIdx = validSpan ? Math.min(spanStart!, spanEnd!) : null;
    const spanRightIdx = validSpan ? Math.max(spanStart!, spanEnd!) : null;
    const spanLeft = spanLeftIdx !== null ? coords[spanLeftIdx] : null;
    const spanRight = spanRightIdx !== null ? coords[spanRightIdx] : null;
    const activePin = activeReviewId ? reviewPins.find(pin => pin.id === activeReviewId) ?? null : null;

    const indexFromClientX = (clientX: number, svg: SVGSVGElement): number => {
        const rect = svg.getBoundingClientRect();
        if (!rect.width || !coords.length) return 0;
        const scaledX = ((clientX - rect.left) / rect.width) * w;
        const ratio = Math.min(1, Math.max(0, scaledX / plotRight));
        return Math.round(ratio * (coords.length - 1));
    };

    const peerAtIndex = (peerSeries: (typeof rebasedPeerPaths)[number], idx: number) => {
        if (!peerSeries.pts.length) return null;
        return peerSeries.pts.reduce((best, pt) => (Math.abs(pt.index - idx) < Math.abs(best.index - idx) ? pt : best), peerSeries.pts[0]);
    };

    return (
        <div className={styles.chartBox}>
            <div className={styles.chartControls}>
                <div className={styles.chartControlLeft}>
                    <V9SegmentedPill
                        ariaLabel="Chart range"
                        size="sm"
                        value={range}
                        onChange={item => {
                            setHoverIndex(null);
                            setFocusIndex(null);
                            clearMeasurement();
                            setActiveReviewId(null);
                            onRangeChange(item);
                        }}
                        options={[
                            { value: '1M', label: '1M' },
                            { value: '3M', label: '3M' },
                            { value: '1Y', label: '1Y' },
                            { value: '5Y', label: '5Y' },
                        ]}
                    />
                    {coords.length > 1 && !overlayActive && (
                        <button
                            type="button"
                            className={styles.measureBtn}
                            aria-pressed={measureMode || validSpan}
                            onClick={() => {
                                if (measureMode || validSpan) { clearMeasurement(); }
                                else { setMeasureMode(true); setSpanStart(null); setSpanEnd(null); }
                            }}
                        >
                            {validSpan ? 'Clear measure' : measureMode ? 'Cancel measure' : 'Measure'}
                        </button>
                    )}
                </div>
                <span className={styles.chartMeta}>
                    {overlayActive && activeCoord && activeCoord.pct !== null ? (
                        <>
                            <strong>{symbol} {activeCoord.pct >= 0 ? '+' : ''}{activeCoord.pct.toFixed(1)}%</strong>
                            {rebasedPeerPaths.map(peer => {
                                const pt = peerAtIndex(peer, activeIdx);
                                return pt ? ` · ${peer.symbol} ${pt.pct >= 0 ? '+' : ''}${pt.pct.toFixed(1)}%` : '';
                            }).join('')}
                            {active ? ` · ${active.time.slice(0, 10)}` : ''}
                        </>
                    ) : activePin ? (
                        <>
                            <strong>Review · {activePin.day}</strong> · {activePin.entry.decisionJournal.decision}
                            {activePin.entry.decisionJournal.observedPrice !== null
                                ? ` at ${fmtPrice(activePin.entry.decisionJournal.observedPrice, activePin.entry.decisionJournal.observedCurrency ?? currency)}`
                                : ''}
                        </>
                    ) : active ? (
                        <>
                            <strong>{fmtPrice(active.close, currency)}</strong> · {active.time.slice(0, 10)}
                            {periodPct !== null && ` (${periodPct >= 0 ? '+' : ''}${periodPct.toFixed(2)}% over ${range})`}
                        </>
                    ) : (
                        'Price series unavailable'
                    )}
                </span>
            </div>

            {coords.length > 1 && peerSuggestions.length > 0 && (
                <div className={styles.peerOverlayBar} aria-label="Overlay peer comparison" data-testid="v9-peer-overlay-bar">
                    <span className={styles.peerOverlayLabel}>Compare on chart</span>
                    <div className={styles.peerOverlayPills}>
                        {peerSuggestions.map(peer => {
                            const selectedIdx = selectedPeers.indexOf(peer);
                            const activePeer = selectedIdx !== -1;
                            const status = peerCharts[`${market}:${peer}`];
                            return (
                                <button
                                    key={peer}
                                    type="button"
                                    className={styles.peerChip}
                                    aria-pressed={activePeer}
                                    onClick={() => togglePeerOverlay(peer)}
                                >
                                    {activePeer && (
                                        <span
                                            className={styles.peerSwatch}
                                            style={{ background: PEER_COLORS[selectedIdx % PEER_COLORS.length] }}
                                            aria-hidden="true"
                                        />
                                    )}
                                    <span>{activePeer ? peer : `+ ${peer}`}</span>
                                    {activePeer && status === 'loading' && <small>…</small>}
                                    {activePeer && status === 'error' && <small>err</small>}
                                </button>
                            );
                        })}
                        {selectedPeers.length > 0 && (
                            <button type="button" className={styles.peerClearBtn} onClick={() => setSelectedPeers([])}>
                                Clear overlay
                            </button>
                        )}
                    </div>
                </div>
            )}

            {(measureMode || measured) && !overlayActive && (
                <div className={styles.measureReadout} role="status" data-testid="v9-chart-measurement">
                    {measured ? (
                        <>
                            <span>
                                <strong>{measured.start.slice(0, 10)} → {measured.end.slice(0, 10)}</strong>
                                {' · '}
                                <span className={styles.measureDelta} data-direction={measured.amount >= 0 ? 'up' : 'down'}>
                                    {measured.amount >= 0 ? '+' : '−'}{fmtPrice(Math.abs(measured.amount), currency)}
                                    {measured.percentage !== null ? ` (${measured.percentage >= 0 ? '+' : ''}${measured.percentage.toFixed(2)}%)` : ''}
                                </span>
                                {' · '}
                                {measured.observations} returned {measured.observations === 1 ? 'observation' : 'observations'}
                            </span>
                            <span className={styles.measureNote}>Exploring · not saved · Price change only</span>
                        </>
                    ) : (
                        <span>
                            {spanStart !== null && sliced[spanStart]
                                ? `Start: ${sliced[spanStart].time.slice(0, 10)} — tap or click a second date to finish.`
                                : 'Tap or click a start date on the chart, or drag across two dates.'}
                        </span>
                    )}
                </div>
            )}

            {coords.length > 1 ? (
                <div className={styles.chartSvgStage}>
                <svg
                    className={styles.chartSvg}
                    viewBox={`0 0 ${w} ${h}`}
                    role="slider"
                    tabIndex={0}
                    aria-label={overlayActive
                        ? `Rebased percentage price history over ${range} for ${symbol} and ${selectedPeers.join(', ')}`
                        : `Price history over ${range}. Drag or use Shift plus arrow keys to measure between two dates.`}
                    aria-valuemin={0}
                    aria-valuemax={coords.length - 1}
                    aria-valuenow={activeIdx}
                    aria-valuetext={active ? `${active.time.slice(0, 10)}, ${fmtPrice(active.close, currency)}` : undefined}
                    onKeyDown={event => {
                        if (event.key === 'Escape') {
                            if (measureMode || validSpan || spanStart !== null) { event.preventDefault(); clearMeasurement(); }
                            return;
                        }
                        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                        event.preventDefault();
                        const current = focusIndex ?? activeIdx;
                        const next = event.key === 'Home'
                            ? 0
                            : event.key === 'End'
                                ? coords.length - 1
                                : Math.max(0, Math.min(coords.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1)));
                        setHoverIndex(null);
                        setFocusIndex(next);
                        if (event.shiftKey && !overlayActive) {
                            if (spanStart === null) setSpanStart(current);
                            setSpanEnd(next);
                        }
                    }}
                    onPointerDown={event => {
                        if (overlayActive) return;
                        if (event.button !== 0 && event.pointerType === 'mouse') return;
                        const idx = indexFromClientX(event.clientX, event.currentTarget);
                        if (measureMode) {
                            if (spanStart === null || spanEnd !== null) {
                                setSpanStart(idx);
                                setSpanEnd(null);
                            } else {
                                setSpanEnd(idx);
                                setMeasureMode(false);
                            }
                            return;
                        }
                        if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
                            setDraggingPointer(event.pointerId);
                            setSpanStart(idx);
                            setSpanEnd(idx);
                            event.currentTarget.setPointerCapture?.(event.pointerId);
                        }
                    }}
                    onPointerMove={event => {
                        const idx = indexFromClientX(event.clientX, event.currentTarget);
                        setHoverIndex(idx);
                        if (!overlayActive && draggingPointer === event.pointerId) setSpanEnd(idx);
                    }}
                    onPointerUp={event => {
                        if (draggingPointer !== event.pointerId) return;
                        const idx = indexFromClientX(event.clientX, event.currentTarget);
                        setDraggingPointer(null);
                        event.currentTarget.releasePointerCapture?.(event.pointerId);
                        if (spanStart === idx) { setSpanStart(null); setSpanEnd(null); }
                        else setSpanEnd(idx);
                    }}
                    onPointerCancel={event => {
                        if (draggingPointer !== event.pointerId) return;
                        setDraggingPointer(null);
                        setSpanStart(null);
                        setSpanEnd(null);
                    }}
                    onPointerLeave={() => {
                        setHoverIndex(null);
                        setActiveReviewId(null);
                    }}
                >
                    <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
                            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    {zeroBaselineY !== null && (
                        <>
                            <line x1="0" y1={zeroBaselineY.toFixed(1)} x2={plotRight.toFixed(1)} y2={zeroBaselineY.toFixed(1)} stroke="var(--line-strong)" strokeWidth="1" strokeDasharray="4 4" />
                            <text x={(plotRight + 6).toFixed(1)} y={(zeroBaselineY + 4).toFixed(1)} fill="var(--muted)" fontSize="11">0%</text>
                        </>
                    )}
                    {spanLeft && spanRight && (
                        <>
                            <rect
                                x={spanLeft.x.toFixed(1)}
                                y={padTop - 4}
                                width={Math.max(2, spanRight.x - spanLeft.x).toFixed(1)}
                                height={h - padTop + 4}
                                fill="var(--brand)"
                                fillOpacity="0.14"
                            />
                            <line x1={spanLeft.x.toFixed(1)} y1={padTop - 4} x2={spanLeft.x.toFixed(1)} y2={h} stroke="var(--brand)" strokeWidth="1.5" strokeDasharray="3 3" />
                            <line x1={spanRight.x.toFixed(1)} y1={padTop - 4} x2={spanRight.x.toFixed(1)} y2={h} stroke="var(--brand)" strokeWidth="1.5" strokeDasharray="3 3" />
                        </>
                    )}
                    {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}
                    {rebasedPeerPaths.map(peer => peer.available && peer.d ? (
                        <g key={peer.symbol} data-testid={`v9-peer-overlay-line-${peer.symbol}`}>
                            <path
                                d={peer.d}
                                fill="none"
                                stroke={peer.color}
                                strokeWidth="2"
                                strokeDasharray={peer.dashed ? '5 4' : undefined}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                            {peer.pts.at(-1) && (
                                <text
                                    x={(plotRight + 6).toFixed(1)}
                                    y={(peer.pts.at(-1)!.y + 4).toFixed(1)}
                                    fill={peer.color}
                                    fontSize="11"
                                    fontWeight="700"
                                >
                                    {peer.symbol}
                                </text>
                            )}
                        </g>
                    ) : null)}
                    <path key={`${range}-${overlayActive ? 'ov' : 'px'}`} d={linePath} fill="none" stroke={stroke} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" className={styles.chartLineReveal} />
                    {overlayActive && coords.at(-1) && (
                        <text
                            x={(plotRight + 6).toFixed(1)}
                            y={(coords.at(-1)!.y + 4).toFixed(1)}
                            fill="var(--brand)"
                            fontSize="11"
                            fontWeight="700"
                        >
                            {symbol}
                        </text>
                    )}
                    {spanLeft && spanRight && (
                        <>
                            <circle cx={spanLeft.x.toFixed(1)} cy={spanLeft.y.toFixed(1)} r="4.5" fill="var(--surface)" stroke="var(--brand)" strokeWidth="2.5" />
                            <circle cx={spanRight.x.toFixed(1)} cy={spanRight.y.toFixed(1)} r="4.5" fill="var(--surface)" stroke="var(--brand)" strokeWidth="2.5" />
                        </>
                    )}
                    {hasPins && (
                        <g aria-label="Saved review markers">
                            <line x1="0" y1="14" x2={w} y2="14" stroke="var(--line)" strokeWidth="1" />
                            {reviewPins.map(pin => {
                                const pt = coords[pin.index];
                                if (!pt) return null;
                                const isSelected = activeReviewId === pin.id;
                                const cx = pt.x;
                                const cy = 14;
                                return (
                                    <g
                                        key={pin.id}
                                        style={{ cursor: 'pointer' }}
                                        onPointerEnter={() => setActiveReviewId(pin.id)}
                                        onPointerLeave={() => setActiveReviewId(null)}
                                        onClick={event => { event.stopPropagation(); setActiveReviewId(current => current === pin.id ? null : pin.id); }}
                                    >
                                        <line x1={cx.toFixed(1)} y1={cy + 6} x2={cx.toFixed(1)} y2={pt.y.toFixed(1)} stroke="var(--brand)" strokeDasharray="2 3" opacity={isSelected ? '0.9' : '0.45'} />
                                        <polygon
                                            points={`${cx.toFixed(1)},${cy - 6} ${(cx + 6).toFixed(1)},${cy} ${cx.toFixed(1)},${cy + 6} ${(cx - 6).toFixed(1)},${cy}`}
                                            fill={isSelected ? 'var(--brand)' : 'var(--surface)'}
                                            stroke="var(--brand)"
                                            strokeWidth="2"
                                        >
                                            <title>{`Saved review ${pin.day} · ${pin.entry.decisionJournal.decision}`}</title>
                                        </polygon>
                                    </g>
                                );
                            })}
                        </g>
                    )}
                    {activeCoord && !validSpan && (
                        <>
                            <line x1={activeCoord.x.toFixed(1)} y1={padTop - 4} x2={activeCoord.x.toFixed(1)} y2={h - 4} stroke="var(--line-strong)" strokeDasharray="3 4" />
                            <circle cx={activeCoord.x.toFixed(1)} cy={activeCoord.y.toFixed(1)} r="8" fill={stroke} opacity="0.2" />
                            <circle cx={activeCoord.x.toFixed(1)} cy={activeCoord.y.toFixed(1)} r="4.5" fill="var(--surface)" stroke={stroke} strokeWidth="2.5" />
                        </>
                    )}
                </svg>
                {hoverIndex !== null && !validSpan && active && activeCoord && (
                    <div
                        className={styles.v9PriceTooltip}
                        data-flip={activeCoord.x > plotRight * 0.6 ? 'true' : 'false'}
                        style={{ left: `${(activeCoord.x / w) * 100}%` }}
                        aria-hidden="true"
                    >
                        <span className={styles.v9PriceTooltipDate}>{active.time.slice(0, 10)}</span>
                        {overlayActive && activeCoord.pct !== null ? (
                            <strong className={styles.v9PriceTooltipVal}>
                                {symbol} {activeCoord.pct >= 0 ? '+' : ''}{activeCoord.pct.toFixed(1)}%
                            </strong>
                        ) : (
                            <strong className={styles.v9PriceTooltipVal}>
                                {fmtPrice(active.close, currency)}
                                {periodPct !== null && (
                                    <span data-direction={periodPct >= 0 ? 'up' : 'down'}>
                                        {periodPct >= 0 ? '+' : ''}{periodPct.toFixed(1)}%
                                    </span>
                                )}
                            </strong>
                        )}
                    </div>
                )}
                </div>
            ) : (
                <p style={{ margin: '12px 0', color: 'var(--muted)', fontSize: 13 }}>Historical price closes were not returned for this security.</p>
            )}
            {overlayActive && (
                <p className={styles.pinLegend} data-testid="v9-peer-overlay-note">
                    Rebased to 0% at range start · Price return only · Currencies are not combined.
                    {rebasedPeerPaths.some(p => !p.available) && ` Unavailable in range: ${rebasedPeerPaths.filter(p => !p.available).map(p => p.symbol).join(', ')}.`}
                </p>
            )}
            {hasPins && (
                <p className={styles.pinLegend}>
                    <span className={styles.pinDiamond} aria-hidden="true" />
                    {reviewPins.length} saved {reviewPins.length === 1 ? 'review' : 'reviews'} in this range · hover or tap a marker for context
                </p>
            )}
        </div>
    );
}

export function V9ResearchView({
    symbol,
    market,
    records,
    workspace,
    guestDrafts,
    theme,
    onSelectStock,
    onSavedGuest,
    onSavedOwner,
}: {
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly records: readonly ResearchRecord[] | null;
    readonly workspace: 'checking' | 'guest' | 'owner';
    readonly guestDrafts: V9GuestDrafts;
    readonly theme: ResearchThemeV6;
    readonly onSelectStock: (symbol: string, market: ResearchMarket) => void;
    readonly onSavedGuest: () => void;
    readonly onSavedOwner: (record: ResearchRecord) => void;
}) {
    const v9Href = useContext(V9Navigation)!;
    const searchParams = useSearchParams();
    const owner = workspace === 'owner';
    const writer = useV9OwnerResearch(owner, onSavedOwner);
    const tour = useFirstVisit();
    const showTour = searchParams.get('tour') === '1';
    const panel = panels.find(id => id === searchParams.get('tab')) ?? 'overview';
    const detail = detailPanels.find(value => value === panel);
    const activeReadingPanel = panel === 'valuation' ? 'financials' : panel;
    const panelHref = (tab: typeof panel) => v9Href('research', { ticker: symbol, market, ...(tab === 'overview' ? {} : { tab }), ...(showTour ? { tour: '1' } : {}) });
    const [range, setRange] = useState<ChartRange>('3M');
    const [snapshot, setSnapshot] = useState<ResearchSnapshot | null>(null);
    const [extendedPoints, setExtendedPoints] = useState<readonly ResearchChartPoint[] | null>(null);
    const [historyError, setHistoryError] = useState(false);
    const [historyAttempt, setHistoryAttempt] = useState(0);
    const [loading, setLoading] = useState(true);
    const [attempt, setAttempt] = useState(0);
    const [error, setError] = useState('');
    const [targetPrice, setTargetPrice] = useState<number | null>(null);
    const [saveStatus, setSaveStatus] = useState('');
    const [saveError, setSaveError] = useState('');
    const [conflictingNote, setConflictingNote] = useState<string | null>(null);

    const noteRecords = workspace === 'guest' ? guestDrafts.records ?? records : records;
    const savedRecord = useMemo(
        () => (noteRecords ?? []).find(r => r.symbol.toUpperCase() === symbol.toUpperCase() && r.market === market) ?? null,
        [market, noteRecords, symbol],
    );
    const savedNote = savedRecord?.notes ?? null;
    const draftKey = `${market}:${symbol}`;
    const activeDraft = guestDrafts.drafts[draftKey];
    const noteDraft = activeDraft?.text ?? savedNote ?? '';
    const dirtyNote = !!activeDraft && activeDraft.text !== activeDraft.expectedNote;
    const showNoteConflict = dirtyNote && conflictingNote !== null;
    const saving = !!guestDrafts.saving[draftKey];

    useEffect(() => {
        const controller = new AbortController();
        readData(`/api/research/symbol/${encodeURIComponent(symbol)}?market=${market}&benchmark=defer`, controller.signal, readPolicies.provider)
            .then(payload => parseResearchSnapshotResponse(payload))
            .then(result => {
                if (result.symbol !== symbol || result.market !== market) throw new Error('Security data did not match the request.');
                if (controller.signal.aborted) return;
                setSnapshot(result);
                const { low52Week, high52Week } = result.technicals;
                if (result.quote.price !== null && low52Week !== null && high52Week !== null && high52Week > low52Week) {
                    setTargetPrice(Math.max(low52Week, Math.min(high52Week, Number((result.quote.price * 0.9).toFixed(2)))));
                }
            })
            .catch(cause => {
                if (!controller.signal.aborted) {
                    setSnapshot(null);
                    setError(cause instanceof Error ? cause.message : 'Security research could not be loaded.');
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [symbol, market, attempt]);

    useEffect(() => {
        if (panel !== 'overview' || range !== '5Y' || extendedPoints !== null || !snapshot || loading) return;
        const controller = new AbortController();
        readResearchChart(symbol, market, controller.signal)
            .then(chart => { if (!controller.signal.aborted) setExtendedPoints(chart.points); })
            .catch(() => { if (!controller.signal.aborted) setHistoryError(true); });
        return () => controller.abort();
    }, [extendedPoints, historyAttempt, loading, market, panel, range, snapshot, symbol]);

    const pills = useMemo(() => {
        const seen = new Set<string>();
        const list: { symbol: string; market: ResearchMarket }[] = [];
        for (const r of (records ?? []).slice(0, 8)) {
            const key = `${r.market}:${r.symbol.toUpperCase()}`;
            if (!seen.has(key)) { seen.add(key); list.push({ symbol: r.symbol.toUpperCase(), market: r.market }); }
        }
        for (const item of defaultTickers) {
            const key = `${item.market}:${item.symbol}`;
            if (!seen.has(key) && list.length < 8) { seen.add(key); list.push(item); }
        }
        return list;
    }, [records]);

    const livePrice = snapshot?.quote.price ?? null;
    const ready = !loading && !error && livePrice !== null && Number.isFinite(livePrice) && livePrice > 0;
    const low52 = snapshot?.technicals.low52Week ?? null;
    const high52 = snapshot?.technicals.high52Week ?? null;
    const gapPct = livePrice && targetPrice && targetPrice > 0 ? ((livePrice - targetPrice) / targetPrice) * 100 : null;
    const annuals = useMemo(() => (snapshot?.fundamentals.history ?? []).slice(-5), [snapshot]);
    const maxAnnualVal = useMemo(() => {
        const vals = annuals.flatMap(a => [a.annualRevenue ?? 0, Math.max(0, a.freeCashFlow ?? 0)]);
        return Math.max(1, ...vals);
    }, [annuals]);

    async function handleSaveNote() {
        if (workspace !== 'guest' || saving || !snapshot) return;
        setSaveError('');
        setSaveStatus('');
        setConflictingNote(null);
        const tourAtSave = showTour && ready && tour.progress?.state?.stage === 'save' ? tour.progress.state : null;
        try {
            const saved = await guestDrafts.save(symbol, market, snapshot.quote.name || symbol, savedNote);
            if (!saved) return;
            onSavedGuest();
            setSaveStatus('Saved locally in this browser.');
            if (tourAtSave) await tour.advance(tourAtSave, 'complete');
        } catch (cause) {
            if (cause instanceof GuestWorkspaceConflictError) setConflictingNote(cause.currentRecord.notes);
            else setSaveError(cause instanceof Error ? cause.message : 'Could not save guest note.');
        }
    }

    async function keepNoteDraft() {
        if (conflictingNote === null) return;
        setSaveError('');
        try {
            await guestDrafts.keepDraft(symbol, market, conflictingNote);
            setConflictingNote(null);
        } catch (cause) {
            if (cause instanceof GuestWorkspaceConflictError) setConflictingNote(cause.currentRecord.notes);
            else setSaveError(cause instanceof Error ? cause.message : 'Could not keep your draft.');
        }
    }

    async function discardNote() {
        if (!window.confirm('Discard these unsaved changes? Your saved note will stay as it is.')) return;
        try {
            await guestDrafts.discardActive(symbol, market);
            setSaveError('');
            setSaveStatus('');
            setConflictingNote(null);
        } catch (cause) { setSaveError(cause instanceof Error ? cause.message : 'Could not discard this draft.'); }
    }

    async function saveOwnerStock() {
        if (!owner || savedRecord || !records || !snapshot) return;
        const tourAtSave = showTour && ready && tour.progress?.state?.stage === 'save' ? tour.progress.state : null;
        const saved = await writer.create({ symbol, market, companyName: snapshot.quote.name || symbol, saveOnly: true });
        if (saved && tourAtSave) await tour.advance(tourAtSave, 'complete');
    }

    function retryReading() {
        setError('');
        setLoading(true);
        setExtendedPoints(null);
        setTargetPrice(null);
        setHistoryError(false);
        setAttempt(value => value + 1);
    }

    const peerSuggestions = useMemo(() => {
        const currentSym = symbol.toUpperCase();
        const savedPeers = (records ?? [])
            .filter(r => r.market === market && r.symbol.toUpperCase() !== currentSym)
            .map(r => r.symbol.toUpperCase());
        const fallbackPeers = market === 'MY' ? ['1155', '1295', '5347', 'KLCI'] : ['MSFT', 'NVDA', 'AAPL', 'VOO'];
        const list: string[] = [];
        for (const candidate of [...savedPeers, ...fallbackPeers]) {
            if (candidate !== currentSym && !list.includes(candidate) && list.length < 4) list.push(candidate);
        }
        return list;
    }, [market, records, symbol]);

    const ownerRecord = owner ? savedRecord : null;
    const ownerPanel = ownerPanels.some(([id]) => id === panel);
    const todayUtc = useReviewDay();
    const [dismissedDueVisit, setDismissedDueVisit] = useState<string | null>(null);
    const dueReasons = useMemo(
        () => (ownerRecord ? dueReviewReasons(ownerRecord, todayUtc) : []),
        [ownerRecord, todayUtc],
    );
    const dueVisitKey = ownerRecord ? `${ownerRecord.revision}:${dueReasons.map(r => `${r.kind}:${r.date}`).join(',')}` : '';
    const showDueReview = panel === 'overview' && !!ownerRecord && dueReasons.length > 0 && dismissedDueVisit !== dueVisitKey;
    const priorReview = useMemo(() => (ownerRecord ? savedReviewContext(ownerRecord) : null), [ownerRecord]);
    const readinessItems = useMemo(() => {
        if (!ownerRecord) return [];
        const hasThesis = Boolean(ownerRecord.whyInterested.trim() || ownerRecord.notes.trim());
        const citationCount = ownerRecord.documentEvidence.citations.length + ownerRecord.acceptedEvidence.length;
        const triggerCount = ownerRecord.monitoringRules.structuredTriggers.rules.filter(rule => rule.enabled).length;
        const hasPlan = ownerRecord.positionPlan.plannedEntryPrice !== null || ownerRecord.positionPlan.invalidationPrice !== null;
        const reviewStatus = dueReasons.length > 0
            ? (dueReasons.some(r => r.date < todayUtc) ? 'Overdue' : 'Due today')
            : ownerRecord.decisionJournal.nextReviewAt
                ? `Next ${ownerRecord.decisionJournal.nextReviewAt.slice(0, 10)}`
                : 'Unscheduled';
        return [
            { label: 'Thesis', value: hasThesis ? 'Recorded' : 'Not written', tone: hasThesis ? 'up' : 'neutral', tab: 'review' as const },
            { label: 'Cited evidence', value: citationCount > 0 ? `${citationCount} saved` : 'None yet', tone: citationCount > 0 ? 'up' : 'neutral', tab: 'evidence' as const },
            { label: 'Monitoring rules', value: triggerCount > 0 ? `${triggerCount} active` : 'None active', tone: triggerCount > 0 ? 'up' : 'neutral', tab: 'monitoring' as const },
            { label: 'Position plan', value: hasPlan ? 'Entry / stop set' : 'Not set', tone: hasPlan ? 'up' : 'neutral', tab: 'review' as const },
            { label: 'Review cadence', value: reviewStatus, tone: dueReasons.length > 0 ? 'down' : ownerRecord.decisionJournal.nextReviewAt ? 'up' : 'neutral', tab: 'review' as const },
        ];
    }, [dueReasons, ownerRecord, todayUtc]);

    return (
        <>
            <div className={styles.researchBar}>
                <Link className={styles.textLink} href={v9Href('research', { market, tab: 'watchlist' })}>Full watchlist</Link>
                <div className={styles.mobileQuickPills} role="group" aria-label="Quick tickers">
                    {pills.map(item => (
                        <button
                            key={`${item.market}:${item.symbol}`}
                            type="button"
                            className={styles.quickPill}
                            aria-pressed={item.symbol === symbol.toUpperCase() && item.market === market}
                            onClick={() => onSelectStock(item.symbol, item.market)}
                        >
                            {item.market} {item.symbol}
                        </button>
                    ))}
                </div>
            </div>

            <nav className={styles.underlineTabs} aria-label="Company research">
                {[...readingPanels, ...(ownerRecord ? ownerPanels : [])].map(([id, label]) => (
                    <Link key={id} className={styles.uTab} href={panelHref(id)} aria-current={activeReadingPanel === id ? 'page' : undefined}>{label}</Link>
                ))}
            </nav>

            {showTour && <FirstVisitCallout tour={tour} surface="research" ready={ready} saved={!!savedRecord}
                marketHref={v9Href('market', { market, tour: '1' })} researchHref={panelHref('overview')} />}
            {workspace === 'guest' && <V9GuestResearchRecovery drafts={guestDrafts} onOpen={onSelectStock} />}

            {error && (panel === 'overview' || panel === 'peers') && (
                <div className={styles.card} role="alert">
                    <strong>Could not load {symbol} ({market})</strong>
                    <p style={{ margin: '6px 0 12px', color: 'var(--muted)' }}>{error}</p>
                    <button type="button" className={styles.ghostBtn} onClick={retryReading}>Retry research data</button>
                </div>
            )}

            {panel === 'filings' && <div className={styles.card}><ResearchFilingsV8 symbol={symbol} market={market} record={ownerRecord ?? undefined} /></div>}
            {panel === 'peers' && !error && <div className={styles.card}><ResearchPeersV8 symbol={symbol} market={market} snapshot={snapshot} saved={records ?? []} onOpen={onSelectStock} /></div>}
            {detail && <ResearchDetails key={detail} detail={detail} symbol={symbol} market={market} snapshot={snapshot} ownerRecord={ownerRecord}
                loading={loading} error={error} href={panelHref} onRetry={retryReading} />}

            {ownerPanel && (workspace === 'checking' || (owner && !records)) && <div className={styles.card} role="status">Loading saved research…</div>}
            {ownerPanel && workspace === 'guest' && <div className={styles.card}>
                <p>Unlock your owner workspace to manage saved research.</p>
                <Link className={styles.ghostBtn} href={ownerUnlockHref(panelHref(panel))}>Unlock Signal</Link>
            </div>}
            {ownerPanel && owner && records && !ownerRecord && <div className={styles.card}>
                <p>Save {symbol} ({market}) to your watchlist to use this tool.</p>
                <Link className={styles.ghostBtn} href={panelHref('overview')}>Open {symbol} overview</Link>
            </div>}
            {ownerRecord && panel === 'review' && (
                <div className={styles.card}>
                    {loading ? <p role="status">Loading {symbol} research…</p> : <V9ReviewPanel record={ownerRecord} snapshot={snapshot} theme={theme} writer={writer} />}
                </div>
            )}
            {ownerRecord && panel === 'evidence' && <div className={styles.card}>
                <EvidenceDocumentDiff records={[ownerRecord]} initialSymbol={symbol} theme={theme}
                    saving={writer.saving} saveError={writer.error} onSave={writer.save} onOpen={() => onSelectStock(symbol, market)} />
                {writer.accessIssue && <OwnerAccessNotice issue={writer.accessIssue} resource="Cited evidence" preserveDraft />}
            </div>}
            {ownerRecord && panel === 'monitoring' && <div className={styles.card}>
                <h2>Monitoring rules for {symbol} · {market}</h2>
                <StructuredTriggerEditor value={ownerRecord.monitoringRules.structuredTriggers}
                    saving={writer.saving} saveError={writer.error} theme={theme}
                    onSave={structuredTriggers => writer.save({ ...ownerRecord, monitoringRules: { ...ownerRecord.monitoringRules, structuredTriggers } }, 'settings')} />
                {writer.accessIssue && <OwnerAccessNotice issue={writer.accessIssue} resource="Monitoring rules" preserveDraft />}
            </div>}

            {panel === 'overview' && loading && !snapshot && (
                <div className={styles.card} role="status">
                    Loading live quote and fundamentals for {symbol} ({market})…
                </div>
            )}

            {panel === 'overview' && snapshot && (
                <>
                {showDueReview && ownerRecord && (
                    <section className={`${styles.card} ${styles.dueBanner}`} aria-label="Review due comparison" data-testid="v9-due-review">
                        <div className={styles.dueHead}>
                            <div>
                                <h2>{dueReasons.some(r => r.date < todayUtc) ? 'Review overdue · Then vs now' : 'Review due today · Then vs now'}</h2>
                                <p>
                                    {dueReasons.map(r => r.kind === 'scheduled' ? `Scheduled ${r.date} UTC` : `Age deadline passed ${r.date} UTC`).join(' · ')}
                                </p>
                            </div>
                            <div className={styles.dueActions}>
                                <Link className={styles.primaryBtn} href={panelHref('review')}>Start review →</Link>
                                <button type="button" className={styles.ghostBtn} onClick={() => setDismissedDueVisit(dueVisitKey)}>Later</button>
                            </div>
                        </div>
                        <div className={styles.dueGrid}>
                            <div>
                                <small>Saved review price</small>
                                <strong>{priorReview?.journal.observedPrice != null ? fmtPrice(priorReview.journal.observedPrice, priorReview.journal.observedCurrency ?? snapshot.quote.currency) : 'Not recorded'}</strong>
                                <span>{priorReview ? `Reviewed ${priorReview.reviewedAt.slice(0, 10)}` : 'No prior snapshot'}</span>
                            </div>
                            <div>
                                <small>Current market price</small>
                                <strong>{fmtPrice(snapshot.quote.price, snapshot.quote.currency)}</strong>
                                <span>Observed {formatResearchTimestamp(snapshot.quote.observedAt)}</span>
                            </div>
                            <div>
                                <small>Saved thesis</small>
                                <p className={styles.dueThesis}>{priorReview?.thesis?.trim() || ownerRecord.whyInterested.trim() || ownerRecord.notes.trim() || 'No thesis recorded yet.'}</p>
                            </div>
                        </div>
                    </section>
                )}
                <div className={styles.researchLayout}>
                    <div className={styles.researchStack}>
                        <section className={styles.card} aria-label="Security price and key metrics">
                            <div className={styles.quoteHead}>
                                <div className={styles.quoteTitle}>
                                    <h1>{snapshot.quote.name || snapshot.symbol}</h1>
                                    <p>
                                        {snapshot.market} · {snapshot.symbol}
                                        {snapshot.quote.classification?.sector ? ` · ${snapshot.quote.classification.sector}` : ''}
                                        {snapshot.valuation.marketCap ? ` · Mkt Cap ${fmtCompact(snapshot.valuation.marketCap, snapshot.quote.currency)}` : ''}
                                    </p>
                                </div>
                                <div className={styles.quotePrice}>
                                    <strong>{fmtPrice(snapshot.quote.price, snapshot.quote.currency)}</strong>
                                    {typeof snapshot.quote.dailyChangePercent === 'number' && (
                                        <span
                                            className={styles.toneBadge}
                                            data-tone={snapshot.quote.dailyChangePercent >= 0 ? 'up' : 'down'}
                                        >
                                            {snapshot.quote.dailyChangePercent >= 0 ? '+' : ''}
                                            {snapshot.quote.dailyChangePercent.toFixed(2)}% latest session
                                        </span>
                                    )}
                                    <div style={{ marginTop: 6, fontSize: 13, color: 'var(--muted)' }}>
                                        Observed {formatResearchTimestamp(snapshot.quote.observedAt)} · Retrieved {formatResearchTimestamp(snapshot.fetchedAt)} · <Link className={styles.textLink} href={panelHref('sources')}>Sources &amp; coverage →</Link>
                                    </div>
                                    {showTour && workspace === 'guest' && !savedRecord && ready && (
                                        <button type="button" className={styles.ghostBtn} disabled={saving} onClick={handleSaveNote}>Save stock</button>
                                    )}
                                </div>
                            </div>

                            <PriceChart
                                symbol={snapshot.symbol}
                                market={market}
                                points={range === '5Y' && extendedPoints ? extendedPoints : snapshot.chart.points}
                                currency={snapshot.quote.currency}
                                range={range}
                                reviewHistory={ownerRecord?.reviewHistory}
                                peerSuggestions={peerSuggestions}
                                onRangeChange={next => { if (next !== range) setHistoryError(false); setRange(next); }}
                            />
                            {range === '5Y' && extendedPoints === null && (historyError
                                ? <div role="alert"><p>Five-year history is unavailable.{snapshot.chart.points.length > 0 ? ' Showing the daily closes supplied with the snapshot.' : ''}</p>
                                    <button type="button" className={styles.ghostBtn} onClick={() => { setHistoryError(false); setHistoryAttempt(value => value + 1); }}>Retry chart history</button></div>
                                : <p role="status">Loading five-year history…</p>)}

                            <div className={styles.metricGrid}>
                                <div className={styles.metricTile}>
                                    <small>P/E Ratio</small>
                                    <strong>{snapshot.valuation.priceEarnings !== null ? `${snapshot.valuation.priceEarnings.toFixed(1)}×` : 'N/A'}</strong>
                                    <span>{snapshot.valuation.reportingPeriod ?? 'Reported'}</span>
                                </div>
                                <div className={styles.metricTile}>
                                    <small>FCF Yield</small>
                                    <strong>{snapshot.valuation.freeCashFlowYieldPercent !== null ? `${snapshot.valuation.freeCashFlowYieldPercent.toFixed(2)}%` : 'N/A'}</strong>
                                    <span>Annual cash flow</span>
                                </div>
                                <div className={styles.metricTile}>
                                    <small>Operating Margin</small>
                                    <strong>{snapshot.fundamentals.operatingMarginPercent !== null ? `${snapshot.fundamentals.operatingMarginPercent.toFixed(1)}%` : 'N/A'}</strong>
                                    <span>{snapshot.fundamentals.reportingPeriod ?? 'Latest fiscal'}</span>
                                </div>
                                <div className={styles.metricTile}>
                                    <small>Revenue Growth</small>
                                    <strong>{snapshot.fundamentals.revenueGrowthPercent !== null ? `${snapshot.fundamentals.revenueGrowthPercent >= 0 ? '+' : ''}${snapshot.fundamentals.revenueGrowthPercent.toFixed(1)}%` : 'N/A'}</strong>
                                    <span>Year over year</span>
                                </div>
                            </div>
                        </section>

                        <section className={styles.card} aria-label="Annual financials">
                            <div className={styles.sectionHead}>
                                <div>
                                    <h2>Annual Financials</h2>
                                    <p>Revenue vs Free Cash Flow ({snapshot.fundamentals.source ?? 'Provider statements'})</p>
                                </div>
                                <Link className={styles.textLink} href={panelHref('financials')}>Financials &amp; valuation →</Link>
                            </div>
                            {annuals.length > 0 ? (
                                <>
                                    <div className={styles.finLegend}>
                                        <span><i className={styles.finSwatchRev} aria-hidden="true" />Revenue</span>
                                        <span><i className={styles.finSwatchFcf} aria-hidden="true" />Free Cash Flow</span>
                                    </div>
                                    <div className={styles.finBars}>
                                        {annuals.map(period => {
                                            const revH = Math.max(8, Math.round(((period.annualRevenue ?? 0) / maxAnnualVal) * 106));
                                            const fcfH = Math.max(6, Math.round((Math.max(0, period.freeCashFlow ?? 0) / maxAnnualVal) * 106));
                                            return (
                                                <div key={period.reportingPeriod} className={styles.finCol} title={`Rev: ${fmtCompact(period.annualRevenue, period.currency)} · FCF: ${fmtCompact(period.freeCashFlow, period.currency)}`}>
                                                    <div className={styles.finPair}>
                                                        <span className={styles.finBarRev} style={{ height: revH }} />
                                                        <span className={styles.finBarFcf} style={{ height: fcfH }} />
                                                    </div>
                                                    <small>{period.reportingPeriod.slice(0, 4)}</small>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
                                    Multi-year financial history was not returned for this listing.
                                </p>
                            )}
                        </section>
                    </div>

                    <div className={styles.researchStack}>
                        {livePrice !== null && low52 !== null && high52 !== null && targetPrice !== null && (
                            <section className={styles.card} aria-label="Target entry guardrail">
                                <div className={styles.sectionHead}>
                                    <div>
                                        <h2>Target Entry Guardrail</h2>
                                        <p>Local planning slider · saves nothing</p>
                                    </div>
                                    {gapPct !== null && (
                                        <span className={styles.toneBadge} data-tone={gapPct <= 0 ? 'up' : 'neutral'}>
                                            {gapPct >= 0 ? `${gapPct.toFixed(1)}% above` : `${Math.abs(gapPct).toFixed(1)}% below`} target
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)' }}>
                                    <span>Your Calm Entry Target</span>
                                    <strong style={{ color: 'var(--ink)' }}>{fmtPrice(targetPrice, snapshot.quote.currency)}</strong>
                                </div>
                                <input
                                    type="range"
                                    className={styles.guardrailSlider}
                                    min={low52}
                                    max={high52}
                                    step={Math.max(0.01, Number(((high52 - low52) / 100).toFixed(2)))}
                                    value={targetPrice}
                                    onChange={e => setTargetPrice(Number(e.target.value))}
                                    aria-label="Target entry price"
                                />
                                <div className={styles.guardrailRange}>
                                    <span>52W Low {fmtPrice(low52, snapshot.quote.currency)}</span>
                                    <span>Now {fmtPrice(livePrice, snapshot.quote.currency)}</span>
                                    <span>52W High {fmtPrice(high52, snapshot.quote.currency)}</span>
                                </div>
                            </section>
                        )}

                        <section className={styles.card} aria-label="Thesis and note">
                            <div className={styles.sectionHead}>
                                <div>
                                    <h2>Your Thesis & Note</h2>
                                    <p>{owner ? 'Owner workspace record' : workspace === 'guest' ? 'Saved locally in this browser' : 'Loading saved research…'}</p>
                                </div>
                                {savedRecord && <span className={styles.toneBadge} data-tone="up">Saved</span>}
                            </div>
                            {owner ? (
                                <div style={{ display: 'grid', gap: 12 }}>
                                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
                                        {savedRecord?.notes?.trim() || 'No thesis note written yet for this stock.'}
                                    </p>
                                    {ownerRecord && readinessItems.length > 0 && (
                                        <div className={styles.readinessList} aria-label="Research readiness summary" data-testid="v9-research-readiness">
                                            {readinessItems.map(item => (
                                                <Link key={item.label} href={panelHref(item.tab)} className={styles.readinessRow}>
                                                    <span>{item.label}</span>
                                                    <strong data-tone={item.tone}>{item.value} →</strong>
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                    {savedRecord
                                        ? <Link className={styles.primaryBtn} href={panelHref('review')}>Edit saved research</Link>
                                        : <button type="button" className={styles.primaryBtn} disabled={!records || writer.saving || loading} onClick={saveOwnerStock}>{writer.saving ? 'Saving…' : 'Save stock'}</button>}
                                    {!savedRecord && writer.error && <p role="alert">{writer.error}</p>}
                                    {!savedRecord && writer.accessIssue && <OwnerAccessNotice issue={writer.accessIssue} resource="Saved research" />}
                                </div>
                            ) : workspace === 'guest' && (
                                <div style={{ display: 'grid', gap: 10 }}>
                                    <textarea
                                        rows={5}
                                        maxLength={5000}
                                        aria-label="Research note"
                                        value={noteDraft}
                                        onChange={event => {
                                            const text = event.target.value;
                                            guestDrafts.edit(symbol, market, text, savedNote);
                                            setSaveError('');
                                            setSaveStatus('');
                                            if (!activeDraft || text === activeDraft.expectedNote) setConflictingNote(null);
                                        }}
                                        placeholder={`Write your calm investment thesis for ${snapshot.symbol}…`}
                                        style={{
                                            width: '100%',
                                            padding: 12,
                                            borderRadius: 10,
                                            border: '1px solid var(--line)',
                                            background: 'var(--surface-subtle)',
                                            color: 'var(--ink)',
                                            font: 'inherit',
                                            resize: 'vertical',
                                        }}
                                    />
                                    {showNoteConflict && (
                                        <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                                            <span role="alert">The saved note changed in another tab. Keep your draft to edit or save it, or reload the saved note.</span>
                                            <strong>Saved note</strong>
                                            <p style={{ margin: 0, maxHeight: 160, overflowY: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: 'var(--muted)' }}>
                                                {conflictingNote || 'No note saved.'}
                                            </p>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                                        <span role={saveError ? 'alert' : 'status'} style={{ fontSize: 12, color: saveError ? 'var(--down)' : 'var(--muted)' }}>
                                            {saveError || (dirtyNote ? `Unsaved changes · ${noteDraft.length}/5000` : saveStatus || `${noteDraft.length}/5000`)}
                                        </span>
                                        {showNoteConflict && <button type="button" className={styles.ghostBtn} disabled={saving} onClick={keepNoteDraft}>Keep my draft</button>}
                                        {dirtyNote && <button type="button" className={styles.ghostBtn} disabled={saving} onClick={discardNote}>
                                            {showNoteConflict ? 'Reload saved note' : 'Discard changes'}
                                        </button>}
                                        <button type="button" className={styles.primaryBtn} disabled={saving || showNoteConflict || (!!savedRecord && !dirtyNote)} onClick={handleSaveNote}>
                                            {saving ? 'Saving…' : savedRecord ? 'Update note' : 'Save to watchlist'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>
                </div>
                </>
            )}
        </>
    );
}
