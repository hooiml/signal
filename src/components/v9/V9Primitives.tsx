'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import styles from './v9-workspace.module.css';

export type V9Tone = 'up' | 'neutral' | 'down';

export type XYPoint = { readonly x: number; readonly y: number };

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

/**
 * Fritsch-Carlson monotone cubic Bezier path builder.
 * Produces smooth financial curves that never overshoot local extrema.
 */
export function smoothSplinePath(pts: readonly XYPoint[]): string {
    const n = pts.length;
    if (n === 0) return '';
    const head = `M${round2(pts[0].x)},${round2(pts[0].y)}`;
    if (n === 1) return head;
    if (n === 2) return `${head} L${round2(pts[1].x)},${round2(pts[1].y)}`;

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
    return `${head} ${segments.join(' ')}`;
}

const clamp = (value: number, min = 0, max = 100): number => Math.min(max, Math.max(min, value));

const toneStrokeVar = (tone: V9Tone): string =>
    tone === 'up' ? 'var(--up-mark)' : tone === 'down' ? 'var(--down-mark)' : 'var(--caution-mark)';

/**
 * Efferd-inspired compact 180-degree 3-zone segmented radial tick gauge for 0-100 scores.
 * Shows faint rose / amber / emerald zone tracks with clean boundary notches at neutralLower & neutralUpper.
 */
export function V9RadialTickGauge({
    score,
    tone,
    neutralLower = 40,
    neutralUpper = 60,
    size = 'lg',
    scoreTestId,
    ariaLabel,
    showScaleLabels = false,
}: {
    readonly score: number | null;
    readonly tone: V9Tone;
    readonly neutralLower?: number;
    readonly neutralUpper?: number;
    readonly size?: 'lg' | 'sm';
    readonly scoreTestId?: string;
    readonly ariaLabel?: string;
    readonly showScaleLabels?: boolean;
}) {
    const isLarge = size === 'lg';
    const tickCount = isLarge ? 41 : 25;
    const width = isLarge ? 216 : 138;
    const height = isLarge ? 106 : 70;
    const cx = width / 2;
    const cy = isLarge ? 98 : 64;
    const outerR = isLarge ? 84 : 54;
    const innerR = isLarge ? 67 : 42;
    const safeScore = score !== null && Number.isFinite(score) ? clamp(score) : null;
    const step = 100 / (tickCount - 1);

    const zoneColorFor = (pct: number): string =>
        pct < neutralLower ? 'var(--down-mark)' : pct < neutralUpper ? 'var(--caution-mark)' : 'var(--up-mark)';

    const leadIndex = safeScore === null
        ? -1
        : Math.max(0, Math.min(tickCount - 1, Math.round(safeScore / step)));

    const ticks = Array.from({ length: tickCount }, (_, index) => {
        const pct = index * step;
        const angleDeg = 180 - (pct / 100) * 180;
        const rad = (angleDeg * Math.PI) / 180;
        const isBoundary = isLarge && (
            Math.abs(pct - neutralLower) < step * 0.45
            || Math.abs(pct - neutralUpper) < step * 0.45
        );
        const isFilled = safeScore !== null && index <= leadIndex;
        const isLead = safeScore !== null && index === leadIndex;
        const zoneStroke = zoneColorFor(pct);

        if (isBoundary && !isLead) {
            // Crisp outward threshold notch leaving a clean visual gap between score zones
            const bx1 = round2(cx + (outerR + 1) * Math.cos(rad));
            const by1 = round2(cy - (outerR + 1) * Math.sin(rad));
            const bx2 = round2(cx + (outerR + 6) * Math.cos(rad));
            const by2 = round2(cy - (outerR + 6) * Math.sin(rad));
            return { index, kind: 'boundary' as const, x1: bx1, y1: by1, x2: bx2, y2: by2, stroke: 'var(--subtle)', opacity: 0.85, isLead: false };
        }

        const rIn = isLead ? innerR - 3.5 : innerR;
        const rOut = isLead ? outerR + 3 : outerR;
        const x1 = round2(cx + rIn * Math.cos(rad));
        const y1 = round2(cy - rIn * Math.sin(rad));
        const x2 = round2(cx + rOut * Math.cos(rad));
        const y2 = round2(cy - rOut * Math.sin(rad));
        const rampOpacity = isLead
            ? 1
            : isFilled && leadIndex > 0
                ? round2(0.58 + 0.36 * (index / leadIndex))
                : isFilled
                    ? 1
                    : 0.24;
        return { index, kind: 'tick' as const, x1, y1, x2, y2, stroke: zoneStroke, opacity: rampOpacity, isLead };
    });

    const formattedScore = safeScore === null ? '—' : String(Math.round(safeScore));

    return (
        <div
            className={styles.v9RadialGauge}
            data-size={size}
            data-tone={tone}
            aria-label={ariaLabel}
        >
            <div className={styles.v9RadialStage}>
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className={styles.v9RadialSvg}
                    aria-hidden="true"
                >
                    {ticks.map(tick => (
                        tick.kind === 'boundary' ? (
                            <line
                                key={tick.index}
                                x1={tick.x1}
                                y1={tick.y1}
                                x2={tick.x2}
                                y2={tick.y2}
                                stroke={tick.stroke}
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                opacity={tick.opacity}
                            />
                        ) : (
                            <g key={tick.index}>
                                {tick.isLead && (
                                    <line
                                        x1={tick.x1}
                                        y1={tick.y1}
                                        x2={tick.x2}
                                        y2={tick.y2}
                                        stroke={tick.stroke}
                                        strokeWidth={isLarge ? 8 : 6}
                                        strokeLinecap="round"
                                        opacity="0.22"
                                    />
                                )}
                                <line
                                    x1={tick.x1}
                                    y1={tick.y1}
                                    x2={tick.x2}
                                    y2={tick.y2}
                                    stroke={tick.stroke}
                                    strokeWidth={tick.isLead ? (isLarge ? 3.8 : 3.2) : (isLarge ? 2.5 : 2.1)}
                                    strokeLinecap="round"
                                    opacity={tick.opacity}
                                    className={styles.v9RadialTick}
                                />
                            </g>
                        )
                    ))}
                </svg>
                <div className={styles.v9RadialCenter}>
                    <span
                        className={styles.v9RadialNum}
                        data-tone={tone}
                        data-testid={scoreTestId}
                    >
                        {formattedScore}
                    </span>
                    <span className={styles.v9RadialDenom}>/ 100</span>
                </div>
            </div>
            {showScaleLabels && (
                <div className={styles.v9RadialScaleLabels} aria-hidden="true">
                    <span>0</span>
                    <span>Neutral {neutralLower}–{neutralUpper - 1}</span>
                    <span>100</span>
                </div>
            )}
        </div>
    );
}

/**
 * EasyUI-inspired segmented pill switcher with smoothly sliding active indicator.
 * Uses native buttons with aria-pressed for full keyboard and Playwright accessibility.
 */
export function V9SegmentedPill<T extends string>({
    ariaLabel,
    value,
    options,
    onChange,
    size = 'md',
    className,
}: {
    readonly ariaLabel: string;
    readonly value: T;
    readonly options: readonly { readonly value: T; readonly label: string }[];
    readonly onChange: (next: T) => void;
    readonly size?: 'sm' | 'md';
    readonly className?: string;
}) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const [indicator, setIndicator] = useState<{ readonly left: number; readonly width: number } | null>(null);

    const activeIndex = Math.max(0, options.findIndex(option => option.value === value));

    const measure = useCallback(() => {
        const wrap = wrapRef.current;
        const activeBtn = btnRefs.current[activeIndex];
        if (!wrap || !activeBtn) return;
        const left = activeBtn.offsetLeft;
        const width = activeBtn.offsetWidth;
        if (width > 0) {
            setIndicator(prev => (prev && prev.left === left && prev.width === width ? prev : { left, width }));
        }
    }, [activeIndex]);

    useLayoutEffect(() => {
        measure();
    }, [measure, options.length]);

    useEffect(() => {
        const wrap = wrapRef.current;
        if (!wrap || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(measure);
        observer.observe(wrap);
        return () => observer.disconnect();
    }, [measure]);

    return (
        <div
            ref={wrapRef}
            className={className ? `${styles.segWrap} ${className}` : styles.segWrap}
            data-sliding={indicator ? 'true' : 'false'}
            data-size={size}
            role="group"
            aria-label={ariaLabel}
        >
            {indicator && (
                <span
                    className={styles.segPillIndicator}
                    style={{
                        width: `${indicator.width}px`,
                        transform: `translate3d(${indicator.left}px, 0, 0)`,
                    }}
                    aria-hidden="true"
                />
            )}
            {options.map((option, index) => (
                <button
                    key={option.value}
                    ref={node => { btnRefs.current[index] = node; }}
                    type="button"
                    className={styles.segBtn}
                    aria-pressed={option.value === value}
                    onClick={() => onChange(option.value)}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

/**
 * EasyUI-inspired inline smooth SVG sparkline with soft gradient fill and endpoint beacon.
 */
export function V9MiniSparkline({
    values,
    tone,
    baseline = null,
    width = 96,
    height = 28,
}: {
    readonly values: readonly number[];
    readonly tone: V9Tone;
    readonly baseline?: number | null;
    readonly width?: number;
    readonly height?: number;
}) {
    const gradId = `v9-mini-spark-${useId().replace(/:/g, '')}`;
    if (values.length < 2) return null;

    const all = baseline !== null && Number.isFinite(baseline) ? [...values, baseline] : values;
    const min = Math.min(...all);
    const max = Math.max(...all);
    const span = max - min || 1;
    const padY = 4;
    const innerH = height - padY * 2;
    const pts: XYPoint[] = values.map((val, idx) => ({
        x: round2((idx / (values.length - 1)) * width),
        y: round2(padY + (1 - (val - min) / span) * innerH),
    }));
    const lineD = smoothSplinePath(pts);
    const last = pts[pts.length - 1];
    const areaD = `${lineD} L${last.x},${height} L${pts[0].x},${height} Z`;
    const baseY = baseline !== null && Number.isFinite(baseline)
        ? round2(padY + (1 - (baseline - min) / span) * innerH)
        : null;
    const stroke = toneStrokeVar(tone);

    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            className={styles.v9MiniSparkSvg}
            aria-hidden="true"
        >
            <defs>
                <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
                    <stop offset="100%" stopColor={stroke} stopOpacity="0" />
                </linearGradient>
            </defs>
            {baseY !== null && (
                <line
                    x1={0}
                    x2={width}
                    y1={baseY}
                    y2={baseY}
                    stroke="var(--line-strong)"
                    strokeWidth="1"
                    strokeDasharray="2 3"
                    opacity="0.7"
                />
            )}
            <path d={areaD} fill={`url(#${gradId})`} />
            <path
                d={lineD}
                fill="none"
                stroke={stroke}
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
            />
            <circle cx={last.x} cy={last.y} r="2.6" fill="var(--surface)" stroke={stroke} strokeWidth="1.8" />
        </svg>
    );
}
