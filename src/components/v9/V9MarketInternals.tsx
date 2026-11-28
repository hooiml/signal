'use client';

import { useState } from 'react';
import type { InternalPoint, MarketInternalItem, MarketInternalsPayload } from '@/app/api/signals/internals/route';
import { fullDate } from '@/components/v8/MarketV8ConnectedData';
import { MetricGlossary, type GlossaryEntry } from '@/components/v8/MetricGlossary';
import { smoothSplinePath } from './V9Primitives';
import styles from './v9-workspace.module.css';

const INTERNAL_GLOSSARY: Readonly<Record<string, GlossaryEntry>> = {
    credit: {
        id: 'internal-credit',
        label: 'Credit Stress (HYG / LQD)',
        definition: 'High-yield corporate bonds relative to investment-grade bonds vs. their 50-day average. Context only (not scored): falling ratios reflect tighter credit appetite.',
    },
    breadth: {
        id: 'internal-breadth',
        label: 'Equal-Weight Breadth (RSP / SPY)',
        definition: 'Equal-weight S&P 500 relative to cap-weighted S&P 500 vs. its 50-day average. Context only (not scored): shows whether participation extends beyond mega-caps.',
    },
    safe_haven: {
        id: 'internal-safe-haven',
        label: 'Safe-Haven Demand (SPY vs. TLT)',
        definition: '20-day return difference between US equities (SPY) and long Treasuries (TLT). Context only (not scored): negative spreads mark defensive bond preference.',
    },
    klci_trend: {
        id: 'internal-klci-trend',
        label: 'FBM KLCI Longer Trend',
        definition: 'FBM KLCI index close relative to its 125-day moving average. Context only (not scored): frames broader Malaysian equity trend beyond short-term swings.',
    },
    myr_fx: {
        id: 'internal-myr-fx',
        label: 'Ringgit Stability (USD/MYR)',
        definition: 'USD/MYR spot exchange rate compared with its 50-day average. Context only (not scored): highlights external currency pressure alongside local market conditions.',
    },
    global_credit: {
        id: 'internal-global-credit',
        label: 'US Credit Check (HYG / LQD)',
        definition: 'High-yield versus investment-grade US credit ratio relative to its 50-day average. Context only (not scored): reflects global risk appetite affecting regional flows.',
    },
};

export type CheckTone = 'up' | 'neutral' | 'down';

export function confirmationBadge(
    signalScore: number | null,
    internalTone: CheckTone,
    isGlobalForMy = false,
): { readonly label: string; readonly tone: CheckTone } {
    if (isGlobalForMy) {
        return {
            label: internalTone === 'down' ? 'Global caution' : internalTone === 'up' ? 'Global constructive' : 'Neutral',
            tone: internalTone,
        };
    }
    if (signalScore === null || !Number.isFinite(signalScore)) {
        return {
            label: internalTone === 'up' ? 'Constructive' : internalTone === 'down' ? 'Cautious' : 'Neutral',
            tone: internalTone,
        };
    }
    if (signalScore < 40) {
        if (internalTone === 'down') return { label: 'Confirms caution', tone: 'down' };
        if (internalTone === 'up') return { label: 'Diverges · supportive', tone: 'up' };
        return { label: 'Neutral', tone: 'neutral' };
    }
    if (signalScore >= 65) {
        if (internalTone === 'up') return { label: 'Confirms strength', tone: 'up' };
        if (internalTone === 'down') return { label: 'Diverges · cautious', tone: 'down' };
        return { label: 'Neutral', tone: 'neutral' };
    }
    if (internalTone === 'up') return { label: 'Supportive', tone: 'up' };
    if (internalTone === 'down') return { label: 'Headwind', tone: 'down' };
    return { label: 'Neutral', tone: 'neutral' };
}

function InternalChart({
    points,
    tone,
    name,
}: {
    readonly points: readonly InternalPoint[];
    readonly tone: CheckTone;
    readonly name: string;
}) {
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);
    if (points.length < 2) return null;

    const allVals = points.flatMap(point => (
        point.baseline !== null && Number.isFinite(point.baseline) ? [point.value, point.baseline] : [point.value]
    ));
    const min = Math.min(...allVals);
    const max = Math.max(...allVals);
    const span = max - min || 1;
    const padMin = min - span * 0.1;
    const padMax = max + span * 0.1;
    const w = 320;
    const h = 72;
    const xFor = (idx: number) => (idx / (points.length - 1)) * w;
    const yFor = (val: number) => h - ((val - padMin) / (padMax - padMin || 1)) * h;

    const coords = points.map((point, idx) => ({
        x: xFor(idx),
        y: yFor(point.value),
        point,
    }));
    const lineD = smoothSplinePath(coords);
    const areaD = `${lineD} L${w},${h} L0,${h} Z`;
    const basePts = coords
        .filter(pt => pt.point.baseline !== null)
        .map(pt => ({ x: pt.x, y: yFor(pt.point.baseline!) }));
    const baseD = basePts.length >= 2 ? smoothSplinePath(basePts) : null;

    const stroke = tone === 'up' ? 'var(--up-mark)' : tone === 'down' ? 'var(--down-mark)' : 'var(--caution-mark)';
    const activeIdx = hoverIdx !== null ? Math.max(0, Math.min(points.length - 1, hoverIdx)) : points.length - 1;
    const active = coords[activeIdx];
    const gradId = `v9int-${name.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;

    return (
        <div
            className={styles.v9InternalPlotWrap}
            onPointerLeave={() => setHoverIdx(null)}
            onPointerMove={event => {
                const rect = event.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / (rect.width || 1)));
                setHoverIdx(Math.round(ratio * (points.length - 1)));
            }}
        >
            <svg viewBox={`0 0 ${w} ${h}`} className={styles.v9InternalSvg} aria-label={`${name} trend chart`}>
                <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={stroke} stopOpacity="0.2" />
                        <stop offset="100%" stopColor={stroke} stopOpacity="0.01" />
                    </linearGradient>
                </defs>
                {baseD && (
                    <path
                        d={baseD}
                        fill="none"
                        stroke="var(--subtle)"
                        strokeWidth="1.4"
                        strokeDasharray="4 3"
                        opacity="0.85"
                        vectorEffect="non-scaling-stroke"
                    />
                )}
                <path d={areaD} fill={`url(#${gradId})`} />
                <path d={lineD} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                {hoverIdx !== null && (
                    <line x1={active.x} x2={active.x} y1="0" y2={h} stroke="var(--subtle)" strokeDasharray="3 3" opacity="0.6" />
                )}
                <circle cx={active.x} cy={active.y} r="3.4" fill="var(--surface)" stroke={stroke} strokeWidth="2" />
            </svg>
            <div className={styles.v9InternalPlotDates}>
                <span>{fullDate(active.point.date)} · <b>{active.point.value}</b></span>
                <span>{fullDate(points[0].date)} – {fullDate(points[points.length - 1].date)}</span>
            </div>
        </div>
    );
}

export function V9MarketInternalsGrid({
    market,
    signalScore,
    internals,
    loading,
}: {
    readonly market: 'US' | 'MY';
    readonly signalScore: number | null;
    readonly internals: MarketInternalsPayload | null;
    readonly loading: boolean;
}) {
    if (loading && !internals) {
        return (
            <section className={styles.v9InternalsWrap} aria-label="Cross-Market Internals">
                <div className={styles.v9InternalsHead}>
                    <h3>{market === 'MY' ? 'Malaysia & Global Cross-Market Internals' : 'US Cross-Market Internals'}</h3>
                    <span>Context only · Not scored</span>
                </div>
                <p className={styles.v9FngFallback}>Loading cross-market reference series…</p>
            </section>
        );
    }

    if (!internals || !internals.available || internals.items.length === 0) {
        return null;
    }

    return (
        <section className={styles.v9InternalsWrap} aria-label="Cross-Market Internals">
            <div className={styles.v9InternalsHead}>
                <div>
                    <h3>{market === 'MY' ? 'Malaysia & Global Cross-Market Internals' : 'US Cross-Market Internals'}</h3>
                    <p>
                        {market === 'MY'
                            ? 'Pairs FBM KLCI trend and Ringgit stability with US high-yield credit appetite.'
                            : 'Credit spreads, equal-weight breadth, and Treasury safe-haven flows — dimensions outside Signal’s 4 scored inputs.'}
                    </p>
                </div>
                <span className={styles.toneBadge}>3 checks · Context only</span>
            </div>
            <div className={styles.v9InternalsGrid}>
                {internals.items.map((item: MarketInternalItem) => {
                    const check = confirmationBadge(signalScore, item.tone, market === 'MY' && item.id === 'global_credit');
                    return (
                        <article key={item.id} className={styles.v9InternalCard}>
                            <div className={styles.v9InternalTop}>
                                <div>
                                    <h4>
                                        {INTERNAL_GLOSSARY[item.id]
                                            ? <MetricGlossary entry={INTERNAL_GLOSSARY[item.id]}>{item.name}</MetricGlossary>
                                            : item.name}
                                    </h4>
                                    <p>{item.subtitle}</p>
                                </div>
                                <span className={styles.toneBadge} data-tone={check.tone}>{check.label}</span>
                            </div>
                            <div className={styles.v9InternalMeta}>
                                <span>Current: <b>{item.latestLabel}</b></span>
                                <span>{item.baselineLabel}</span>
                            </div>
                            <InternalChart points={item.points} tone={check.tone} name={item.name} />
                            <p className={styles.v9InternalDesc}>{item.description}</p>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
