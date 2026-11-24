'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FearGreedHistoryPoint, FearGreedPayload } from '@/app/api/signals/fear-greed/route';
import { marketTimestampLabel } from '@/lib/market-display';
import { fullDate } from '../v8/MarketV8ConnectedData';
import styles from './v9-workspace.module.css';

type Tone = 'up' | 'neutral' | 'down';
type FngState =
    | { readonly status: 'loading' }
    | { readonly status: 'ready'; readonly payload: FearGreedPayload };

const formatRating = (rating: string): string =>
    rating
        .trim()
        .split(/\s+/)
        .map(word => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ''))
        .join(' ') || 'Neutral';

const toneForScore = (score: number): Tone =>
    score >= 60 ? 'up' : score < 40 ? 'down' : 'neutral';

const toneColorVar = (tone: Tone): string =>
    tone === 'up' ? 'var(--up-mark)' : tone === 'down' ? 'var(--down-mark)' : 'var(--caution-mark)';

const shortMonthFmt = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' });
const shortMonthYearFmt = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });

function buildSparkPoints(history: readonly FearGreedHistoryPoint[], width: number, height: number) {
    const scores = history.map(item => item.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const span = max - min || 1;
    const firstMs = Date.parse(history[0].date);
    const lastMs = Date.parse(history.at(-1)!.date);
    const duration = lastMs - firstMs || 1;
    const padY = 4;
    const innerH = height - padY * 2;
    const coords = history.map(item => {
        const ms = Date.parse(item.date);
        const x = ((ms - firstMs) / duration) * width;
        const y = padY + (1 - (item.score - min) / span) * innerH;
        return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
    });
    return { coords, min, mid: (min + max) / 2, max };
}

function buildMonthTicks(firstMs: number, lastMs: number, width: number) {
    const start = new Date(firstMs);
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    const duration = lastMs - firstMs || 1;
    const ticks: { readonly x: number; readonly label: string }[] = [];
    let step = 0;
    while (cursor.getTime() <= lastMs && step < 16) {
        const ms = cursor.getTime();
        const x = ((ms - firstMs) / duration) * width;
        const month = cursor.getUTCMonth();
        if (month % 3 === 0 && x > 24 && x < width - 20) {
            const label = month === 0 ? shortMonthYearFmt.format(cursor) : shortMonthFmt.format(cursor);
            ticks.push({ x: Math.round(x * 100) / 100, label });
        }
        cursor.setUTCMonth(month + 1);
        step += 1;
    }
    return ticks;
}

function FearGreedModalChart({ history, tone }: { readonly history: readonly FearGreedHistoryPoint[]; readonly tone: Tone }) {
    const gradId = useId().replace(/:/g, '');
    const [cursor, setCursor] = useState(history.length - 1);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const stroke = toneColorVar(tone);

    const W = 760;
    const H = 220;
    const firstMs = Date.parse(history[0].date);
    const lastMs = Date.parse(history.at(-1)!.date);
    const duration = lastMs - firstMs || 1;
    const yFor = (score: number) => Math.round((1 - score / 100) * H * 100) / 100;

    const coords = useMemo(() => history.map(item => ({
        x: Math.round((((Date.parse(item.date) - firstMs) / duration) * W) * 100) / 100,
        y: yFor(item.score),
    })), [duration, firstMs, history]);

    const monthTicks = useMemo(() => buildMonthTicks(firstMs, lastMs, W), [firstMs, lastMs]);
    const at = Math.max(0, Math.min(hoverIndex ?? cursor, history.length - 1));
    const active = history[at];
    const activeCoord = coords[at];
    const lineD = coords.map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ');
    const areaD = `${lineD} L${coords.at(-1)!.x},${H} L${coords[0].x},${H} Z`;
    const activeTone = toneForScore(active.score);
    const activeColor = toneColorVar(activeTone);

    function nearestIndex(clientX: number, svg: SVGSVGElement) {
        const box = svg.getBoundingClientRect();
        const x = ((clientX - box.left) / (box.width || 1)) * (W + 16) - 8;
        return coords.reduce((best, pt, idx) => (Math.abs(pt.x - x) < Math.abs(coords[best].x - x) ? idx : best), 0);
    }

    return (
        <div className={styles.v9FngModalChartWrap}>
            <div className={styles.v9FngModalReadout}>
                <span>{fullDate(active.date)}</span>
                <b>{active.score.toFixed(0)} / 100</b>
                <span className={styles.toneBadge} data-tone={activeTone}>{formatRating(active.rating)}</span>
            </div>

            <div className={styles.v9FngModalPlot}>
                <div className={styles.v9FngModalSvgWrap}>
                    <svg
                        viewBox={`-8 -8 ${W + 16} ${H + 16}`}
                        preserveAspectRatio="none"
                        role="slider"
                        tabIndex={0}
                        aria-label="CNN Fear & Greed 1-year history"
                        aria-valuemin={0}
                        aria-valuemax={history.length - 1}
                        aria-valuenow={at}
                        aria-valuetext={`${fullDate(active.date)}, ${active.score} out of 100, ${formatRating(active.rating)}`}
                        onKeyDown={event => {
                            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                            event.preventDefault();
                            setHoverIndex(null);
                            const next = event.key === 'Home' ? 0 : event.key === 'End' ? history.length - 1 : Math.max(0, Math.min(history.length - 1, cursor + (event.key === 'ArrowRight' ? 1 : -1)));
                            setCursor(next);
                        }}
                        onPointerMove={event => {
                            if (event.pointerType === 'mouse') setHoverIndex(nearestIndex(event.clientX, event.currentTarget));
                        }}
                        onPointerLeave={() => setHoverIndex(null)}
                        onClick={event => {
                            const nearest = nearestIndex(event.clientX, event.currentTarget);
                            setHoverIndex(null);
                            setCursor(nearest);
                        }}
                    >
                        <defs>
                            <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
                                <stop stopColor={stroke} stopOpacity="0.22" />
                                <stop offset="1" stopColor={stroke} stopOpacity="0.01" />
                            </linearGradient>
                        </defs>
                        {[100, 75, 50, 25, 0].map(val => (
                            <line
                                key={val}
                                x1={0}
                                x2={W}
                                y1={yFor(val)}
                                y2={yFor(val)}
                                stroke={val === 0 ? 'var(--line-strong)' : 'var(--line)'}
                                strokeWidth="1"
                                strokeDasharray={val === 0 ? undefined : '3 4'}
                            />
                        ))}
                        {monthTicks.map(tick => (
                            <line key={tick.label} x1={tick.x} x2={tick.x} y1={0} y2={H} stroke="var(--line)" strokeWidth="1" />
                        ))}
                        <path d={areaD} fill={`url(#${gradId})`} />
                        <path d={lineD} fill="none" stroke={stroke} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                        <line x1={activeCoord.x} x2={activeCoord.x} y1={0} y2={H} stroke={activeColor} strokeDasharray="4 4" opacity="0.55" />
                    </svg>

                    <span className={styles.v9FngZoneTop} aria-hidden="true">⌃ Extreme Greed (75+)</span>
                    <span className={styles.v9FngZoneBottom} aria-hidden="true">⌄ Extreme Fear (&lt;25)</span>

                    <span
                        className={styles.v9FngModalDot}
                        style={{
                            left: `${((activeCoord.x + 8) / (W + 16)) * 100}%`,
                            top: `${((activeCoord.y + 8) / (H + 16)) * 100}%`,
                            borderColor: activeColor,
                            boxShadow: `0 0 0 5px color-mix(in srgb, ${activeColor} 22%, transparent)`,
                        }}
                        aria-hidden="true"
                    />

                    {hoverIndex !== null && (
                        <div
                            className={styles.v9FngModalTooltip}
                            data-flip={activeCoord.x > W * 0.62 ? 'true' : 'false'}
                            style={{ left: `${((activeCoord.x + 8) / (W + 16)) * 100}%` }}
                            aria-hidden="true"
                        >
                            <b>{fullDate(active.date)}</b>
                            <span>{active.score.toFixed(0)} / 100 · {formatRating(active.rating)}</span>
                        </div>
                    )}
                </div>

                <div className={styles.v9FngModalAxis} aria-hidden="true">
                    {[100, 75, 50, 25, 0].map(val => <span key={val}>{val}</span>)}
                </div>
            </div>

            <div className={styles.v9FngModalMonths} aria-hidden="true">
                {monthTicks.map(tick => (
                    <span key={tick.label} style={{ left: `${((tick.x + 8) / (W + 16)) * 100}%` }}>{tick.label}</span>
                ))}
            </div>
        </div>
    );
}

export function V9FearGreedCard() {
    const [fngState, setFngState] = useState<FngState>({ status: 'loading' });
    const [modalOpen, setModalOpen] = useState(false);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const sparkGradId = useId().replace(/:/g, '');

    useEffect(() => {
        const controller = new AbortController();
        void (async () => {
            try {
                const res = await fetch('/api/signals/fear-greed', { signal: controller.signal });
                if (!res.ok) throw new Error('Request failed');
                const body = (await res.json()) as { success?: boolean; data?: FearGreedPayload };
                if (!controller.signal.aborted) {
                    setFngState({
                        status: 'ready',
                        payload: body?.data ?? { available: false, reason: 'CNN Fear & Greed feed is currently unavailable.' },
                    });
                }
            } catch {
                if (!controller.signal.aborted) {
                    setFngState({
                        status: 'ready',
                        payload: { available: false, reason: 'CNN Fear & Greed feed is currently unavailable.' },
                    });
                }
            }
        })();
        return () => controller.abort();
    }, []);

    function openModal() {
        setModalOpen(true);
        requestAnimationFrame(() => {
            if (!dialogRef.current?.open) dialogRef.current?.showModal();
        });
    }

    function closeModal() {
        dialogRef.current?.close();
        setModalOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
    }

    const fng = fngState.status === 'ready' ? fngState.payload : null;
    const tone: Tone = fng && fng.available ? toneForScore(fng.score) : 'neutral';
    const history = fng && fng.available ? fng.history : [];
    const hasHistory = history.length >= 2;
    const spark = hasHistory ? buildSparkPoints(history, 180, 54) : null;
    const sparkStroke = toneColorVar(tone);
    const sparkLast = spark?.coords.at(-1);
    const updatedDay = fng && fng.available && fng.updatedAt ? fng.updatedAt.slice(0, 10) : null;

    return (
        <>
            <section className={`${styles.card} ${styles.v9FngCard}`} aria-label="CNN Fear & Greed">
                <div className={styles.v9FngHead}>
                    <div>
                        <span className={styles.v9FngEyebrow}>
                            External gauge · not scored{updatedDay ? ` · ${marketTimestampLabel(updatedDay)}` : ''}
                        </span>
                        <h2>CNN Fear &amp; Greed</h2>
                    </div>
                    {fngState.status === 'loading' ? (
                        <span className={styles.toneBadge}>Loading</span>
                    ) : fng && fng.available ? (
                        <span className={styles.toneBadge} data-tone={tone}>{formatRating(fng.rating)}</span>
                    ) : (
                        <span className={styles.toneBadge}>Unavailable</span>
                    )}
                </div>

                {fngState.status === 'loading' ? (
                    <p className={styles.v9FngNote}>Loading CNN Fear &amp; Greed index…</p>
                ) : fng && fng.available ? (
                    <>
                        <div className={styles.v9FngMainRow}>
                            <div className={styles.v9FngScoreCol}>
                                <div className={styles.v9FngScoreRow}>
                                    <strong className={styles.v9FngScoreNum} data-tone={tone}>{fng.score}</strong>
                                    <span className={styles.v9FngScoreDenom}>/ 100</span>
                                </div>
                                {!hasHistory && (
                                    <div className={styles.v9FngTrack} aria-hidden="true">
                                        <span className={styles.v9FngFill} data-tone={tone} style={{ width: `${fng.score}%` }} />
                                    </div>
                                )}
                            </div>

                            {spark && sparkLast && (
                                <div className={styles.v9FngSparkWrap}>
                                    <div className={styles.v9FngSparkPlot}>
                                        <div className={styles.v9FngSparkSvgWrap}>
                                            <svg viewBox="0 0 180 54" preserveAspectRatio="none" role="img" aria-label="CNN Fear & Greed 52-week trend">
                                                <defs>
                                                    <linearGradient id={sparkGradId} x1="0" x2="0" y1="0" y2="1">
                                                        <stop stopColor={sparkStroke} stopOpacity="0.28" />
                                                        <stop offset="1" stopColor={sparkStroke} stopOpacity="0.02" />
                                                    </linearGradient>
                                                </defs>
                                                {[4, 27, 50].map(y => (
                                                    <line key={y} x1={0} x2={180} y1={y} y2={y} stroke="var(--line)" strokeWidth="1" strokeDasharray="2 3" />
                                                ))}
                                                <path
                                                    d={`${spark.coords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')} L${sparkLast.x},54 L${spark.coords[0].x},54 Z`}
                                                    fill={`url(#${sparkGradId})`}
                                                />
                                                <path
                                                    d={spark.coords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')}
                                                    fill="none"
                                                    stroke={sparkStroke}
                                                    strokeWidth="1.9"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    vectorEffect="non-scaling-stroke"
                                                />
                                            </svg>
                                            <span
                                                className={styles.v9FngSparkDot}
                                                style={{
                                                    left: `${(sparkLast.x / 180) * 100}%`,
                                                    top: `${(sparkLast.y / 54) * 100}%`,
                                                    background: sparkStroke,
                                                    boxShadow: `0 0 0 3px color-mix(in srgb, ${sparkStroke} 25%, transparent)`,
                                                }}
                                                aria-hidden="true"
                                            />
                                        </div>
                                        <div className={styles.v9FngSparkTicks} aria-hidden="true">
                                            <span>{Math.round(spark.max)}</span>
                                            <span>{Math.round(spark.mid)}</span>
                                            <span>{Math.round(spark.min)}</span>
                                        </div>
                                    </div>
                                    <span className={styles.v9FngSparkCaption}>52W trend</span>
                                </div>
                            )}
                        </div>

                        {(fng.previousClose !== null || fng.oneWeekAgo !== null || fng.oneMonthAgo !== null) && (
                            <dl className={styles.v9FngRefRow}>
                                {fng.previousClose !== null && <div><dt>Prev</dt><dd>{fng.previousClose}</dd></div>}
                                {fng.oneWeekAgo !== null && <div><dt>1W ago</dt><dd>{fng.oneWeekAgo}</dd></div>}
                                {fng.oneMonthAgo !== null && <div><dt>1M ago</dt><dd>{fng.oneMonthAgo}</dd></div>}
                            </dl>
                        )}

                        <div className={styles.v9FngFooter}>
                            <span>Context only · excluded from score</span>
                            {hasHistory && (
                                <button ref={triggerRef} type="button" className={styles.textLink} onClick={openModal}>
                                    See 1Y chart →
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <p className={styles.v9FngNote}>{fng?.reason ?? 'CNN Fear & Greed feed is currently unavailable.'}</p>
                )}
            </section>

            <dialog
                ref={dialogRef}
                className={styles.v9FngModal}
                aria-labelledby="v9-fng-modal-title"
                onCancel={event => { event.preventDefault(); closeModal(); }}
                onClick={event => { if (event.target === event.currentTarget) closeModal(); }}
            >
                {modalOpen && fng && fng.available && hasHistory && (
                    <div className={styles.v9FngModalBody}>
                        <div className={styles.v9FngModalHead}>
                            <div>
                                <span className={styles.v9FngEyebrow}>External sentiment history · context only</span>
                                <h2 id="v9-fng-modal-title">CNN Fear &amp; Greed · 1-year record</h2>
                            </div>
                            <button type="button" className={styles.v9FngModalClose} onClick={closeModal} aria-label="Close Fear & Greed chart">
                                ×
                            </button>
                        </div>

                        <FearGreedModalChart history={history} tone={tone} />

                        <dl className={styles.v9FngModalStats}>
                            <div>
                                <dt>Current</dt>
                                <dd>{fng.score} / 100 · {formatRating(fng.rating)}</dd>
                            </div>
                            <div>
                                <dt>Previous close</dt>
                                <dd>{fng.previousClose !== null ? `${fng.previousClose} / 100` : 'Unavailable'}</dd>
                            </div>
                            <div>
                                <dt>1 week ago</dt>
                                <dd>{fng.oneWeekAgo !== null ? `${fng.oneWeekAgo} / 100` : 'Unavailable'}</dd>
                            </div>
                            <div>
                                <dt>1 month ago</dt>
                                <dd>{fng.oneMonthAgo !== null ? `${fng.oneMonthAgo} / 100` : 'Unavailable'}</dd>
                            </div>
                            {spark && (
                                <div>
                                    <dt>52W range</dt>
                                    <dd>{Math.round(spark.min)}–{Math.round(spark.max)}</dd>
                                </div>
                            )}
                        </dl>

                        <p className={styles.v9FngNote}>
                            CNN Fear &amp; Greed is shown for broader US sentiment context only and does not affect Signal’s composite score or recommendations.
                        </p>
                    </div>
                )}
            </dialog>
        </>
    );
}
