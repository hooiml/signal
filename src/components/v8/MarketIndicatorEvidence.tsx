import { hasRetrievalTimestamp, marketEvidenceDay } from '@/lib/market-evidence-coverage';
import { useState } from 'react';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { getIndicatorDisplayName } from '@/lib/indicator-registry';
import { formatRawValue } from '@/components/v2/cockpit-utils';
import { fullDate, indicatorReadingLabel, indicatorStatus } from './MarketV8ConnectedData';
import base from './market-v8.module.css';
import styles from './market-v8-connected.module.css';
import { inputImpact } from './market-last-visit';
import { MetricGlossary } from './MetricGlossary';
import { metricForIndicator } from '@/lib/learn/metric-links';
import { V8FreshnessLine } from './V8Primitives';

export type IndicatorSeriesPoint = {
    readonly date: string;
    readonly raw: number | null;
    readonly score: number | null;
};

type ThresholdRef =
    | { readonly kind: 'line'; readonly value: number; readonly label: string }
    | { readonly kind: 'band'; readonly min: number; readonly max: number; readonly label: string };

const INDICATOR_THRESHOLDS: Readonly<Record<string, ThresholdRef>> = {
    vix: { kind: 'line', value: 25, label: 'Threshold 25' },
    aaii: { kind: 'band', min: 32, max: 38, label: 'Neutral ~35%' },
    put_call: { kind: 'line', value: 0.90, label: 'Neutral 0.90' },
    klci_trend: { kind: 'line', value: 50, label: '52w mid 50%' },
    my_breadth: { kind: 'line', value: 50, label: 'Balanced 50%' },
    social: { kind: 'line', value: 0, label: 'Neutral 0.0' },
    news: { kind: 'line', value: 0, label: 'Neutral 0.0' },
};

function IndicatorMiniSpark({
    indicatorKey,
    series,
    direction,
    unit,
}: {
    readonly indicatorKey: string;
    readonly series: readonly IndicatorSeriesPoint[];
    readonly direction: string;
    readonly unit?: string;
}) {
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);
    const plotted = series
        .map(point => ({
            date: point.date,
            isRaw: point.raw !== null && Number.isFinite(point.raw),
            val: point.raw !== null && Number.isFinite(point.raw) ? point.raw : point.score,
        }))
        .filter((point): point is { date: string; isRaw: boolean; val: number } => point.val !== null && Number.isFinite(point.val))
        .slice(-20);
    if (plotted.length < 2) return null;

    const allRaw = plotted.every(point => point.isRaw);
    const threshold = allRaw ? INDICATOR_THRESHOLDS[indicatorKey] : undefined;
    const rawVals = plotted.map(point => point.val);
    const extVals = threshold
        ? threshold.kind === 'line'
            ? [...rawVals, threshold.value]
            : [...rawVals, threshold.min, threshold.max]
        : rawVals;

    const rawMin = Math.min(...extVals);
    const rawMax = Math.max(...extVals);
    const span = rawMax - rawMin || 1;
    const padMin = rawMin - span * 0.08;
    const padMax = rawMax + span * 0.08;

    const w = 220;
    const h = 50;
    const padX = 4;
    const padY = 5;
    const xFor = (idx: number) => padX + (idx / (plotted.length - 1)) * (w - padX * 2);
    const yFor = (val: number) => padY + (1 - (val - padMin) / (padMax - padMin || 1)) * (h - padY * 2);

    const coords = plotted.map((pt, index) => ({
        x: xFor(index),
        y: yFor(pt.val),
        pt,
    }));
    const linePts = coords.map(pt => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
    const areaPts = `${padX},${h - 2} ${linePts} ${(w - padX).toFixed(1)},${h - 2}`;
    const activeIdx = hoverIdx !== null ? Math.max(0, Math.min(coords.length - 1, hoverIdx)) : coords.length - 1;
    const active = coords[activeIdx];
    const stroke = direction.endsWith('positive')
        ? 'var(--up-mark)'
        : direction.endsWith('negative')
            ? 'var(--down-mark)'
            : 'var(--caution-mark)';
    const decimals = Math.abs(active.pt.val) < 10 ? 2 : 1;
    const valueText = `${active.pt.val.toFixed(decimals)}${unit ? ` ${unit}` : ''}`;

    return (
        <span
            className={styles.v9SparkWrap}
            onPointerLeave={() => setHoverIdx(null)}
            onPointerMove={event => {
                const rect = event.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / (rect.width || 1)));
                setHoverIdx(Math.round(ratio * (coords.length - 1)));
            }}
        >
            <svg viewBox={`0 0 ${w} ${h}`} className={styles.v9MiniSpark} aria-hidden="true">
                {threshold?.kind === 'band' && (
                    <rect
                        x={padX}
                        y={yFor(threshold.max)}
                        width={w - padX * 2}
                        height={Math.max(2, yFor(threshold.min) - yFor(threshold.max))}
                        fill="var(--line-strong)"
                        fillOpacity="0.22"
                    />
                )}
                {threshold?.kind === 'line' && (
                    <line
                        x1={padX}
                        x2={w - padX}
                        y1={yFor(threshold.value)}
                        y2={yFor(threshold.value)}
                        stroke="var(--subtle)"
                        strokeWidth="1.2"
                        strokeDasharray="4 3"
                        opacity="0.85"
                    />
                )}
                <polygon fill={stroke} fillOpacity="0.14" points={areaPts} />
                <polyline fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={linePts} />
                {hoverIdx !== null && (
                    <line x1={active.x.toFixed(1)} x2={active.x.toFixed(1)} y1={padY} y2={h - 2} stroke="var(--subtle)" strokeDasharray="3 3" opacity="0.65" />
                )}
                <circle cx={active.x.toFixed(1)} cy={active.y.toFixed(1)} r="3" fill="var(--surface)" stroke={stroke} strokeWidth="2" />
            </svg>
            <span className={styles.v9SparkMeta}>
                <span>
                    {hoverIdx !== null ? (
                        <><b>{fullDate(active.pt.date)}</b>: {valueText}</>
                    ) : (
                        <>{fullDate(plotted[0].date)} – {fullDate(plotted[plotted.length - 1].date)}</>
                    )}
                </span>
                {threshold && <span className={styles.v9SparkRef}>{threshold.label}</span>}
            </span>
        </span>
    );
}

export function MarketIndicatorEvidence({ signal, inputKeys, configured, date, referenceLabel, sourceEnabled, seriesByKey, compactCards, onSelect }: {
    signal: MarketSignal; inputKeys: string[]; configured: Record<string, number>; date: string;
    referenceLabel?: string;
    sourceEnabled: boolean;
    seriesByKey?: Readonly<Record<string, readonly IndicatorSeriesPoint[]>>;
    compactCards?: boolean;
    onSelect: (key: string, trigger: HTMLButtonElement) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    // Observations come first; unavailable configured inputs remain inspectable.
    const ordered = [...inputKeys].sort((a, b) => Number(!!signal.components[b]) - Number(!!signal.components[a]) || (signal.components[b]?.weight ?? configured[b] ?? 0) - (signal.components[a]?.weight ?? configured[a] ?? 0));
    // Inputs with no observation share one compact row in V8 or fill the 2x2 grid in V9.
    const observed = ordered.filter(key => signal.components[key]);
    const missing = ordered.filter(key => !signal.components[key]);
    const changeComponents = signal.metadata.change_reconciliation?.components ?? [];
    const formatDirection = (label: string) => label ? label[0].toUpperCase() + label.slice(1) : '';
    return <section className={styles.evidence} aria-label="Explore indicators">
        <div className={base.sectionHeading}><div><h2>Current indicator evidence</h2><p>{referenceLabel ?? (marketEvidenceDay(date) ? fullDate(date) : 'Snapshot date unavailable')} · select an observation for details</p></div></div>
        <div className={styles.evidenceRows} data-expanded={expanded} data-v9-grid={compactCards ? 'true' : undefined}>
            {observed.map((key, index) => {
                const item = signal.components[key];
                const disabled = item?.enabled === false || ((key === 'social' || key === 'news') && !sourceEnabled);
                const scored = !!item && !disabled && item.weight > 0;
                const conflict = scored && (signal.confidence.conflicting_indicators.includes(key) || signal.confidence.conflicting_indicators.includes(item.display_name));
                const status = disabled ? 'Disabled' : item ? indicatorStatus(signal, key, date) : 'Current observation unavailable';
                const direction = !scored ? 'unavailable' : indicatorReadingLabel(item.signal);
                const series = compactCards ? (seriesByKey?.[key] ?? []) : [];
                const changeRow = compactCards ? changeComponents.find(row => row.key === key) : undefined;
                const hasDeltaHint =
                    changeRow
                    && changeRow.previous_raw_value !== null
                    && changeRow.current_raw_value !== null
                    && changeRow.previous_raw_value !== changeRow.current_raw_value;
                return <MetricGlossary key={key} metric={metricForIndicator(key)} onInspect={element => onSelect(key, element)} buttonProps={{ type: 'button', 'data-indicator': key, 'data-overflow': index >= 3, 'data-available': !!item && !disabled, className: styles.evidenceRow, 'aria-label': item?.display_name ?? getIndicatorDisplayName(key) }}>
                    <span><b>{item?.display_name ?? getIndicatorDisplayName(key)}</b><small className={status.startsWith('Stale') ? styles.caution : ''}>{status}</small>{item && <V8FreshnessLine as="small" label={hasRetrievalTimestamp(item) ? 'Retrieved' : 'Dated'} separator=" " value={fullDate(marketEvidenceDay(item.last_updated))} />}</span>
                    <span>
                        <strong>{item ? formatRawValue(item, signal.metadata.market) : 'Unavailable'}</strong>
                        {compactCards ? (
                            <span className={styles.v9DirectionRow}>
                                <span className={styles.direction} data-direction={direction}>
                                    {disabled ? 'Disabled' : scored ? formatDirection(direction) : item ? 'Not scored' : 'No reading'}
                                </span>
                                {scored && <small className={styles.v9WeightTag}>{Math.round(item.weight * 100)}% wt</small>}
                            </span>
                        ) : (
                            <span className={styles.direction} data-direction={direction}>{disabled ? 'Disabled' : scored ? `${signal.mode === 'contrarian' ? 'Contrarian' : 'Momentum'}: ${direction} · ${Math.round(item.weight * 100)}% wt` : item ? 'Context · not scored' : 'No reading'}</span>
                        )}
                        {scored && <ImpactChip impact={inputImpact(item.score, item.weight)} />}
                        {conflict && <small>Disagrees with composite</small>}
                    </span>
                    {compactCards && (series.length >= 2 ? (
                        <IndicatorMiniSpark indicatorKey={key} series={series} direction={direction} unit={item?.metadata?.unit} />
                    ) : hasDeltaHint && changeRow ? (
                        <span className={styles.v9DeltaHint}>
                            Prior {changeRow.previous_raw_value} → {changeRow.current_raw_value}{changeRow.current_unit ? ` ${changeRow.current_unit}` : ''}
                        </span>
                    ) : null)}
                </MetricGlossary>;
            })}
            {compactCards && missing.map(key => {
                const configuredPct = (configured[key] ?? 0) * 100;
                return (
                    <MetricGlossary
                        key={key}
                        metric={metricForIndicator(key)}
                        onInspect={element => onSelect(key, element)}
                        buttonProps={{
                            type: 'button',
                            'data-indicator': key,
                            'data-available': false,
                            'aria-label': getIndicatorDisplayName(key),
                            className: `${styles.evidenceRow} ${styles.v9MissingCard}`,
                        }}
                    >
                        <span className={styles.v9MissingHead}>
                            <b>{getIndicatorDisplayName(key)}</b>
                            <span className={styles.v9UnavailablePill}>Unavailable</span>
                        </span>
                        <span className={styles.v9MissingBody}>
                            {configuredPct > 0
                                ? `${configuredPct.toFixed(1)}% configured weight · excluded from score, not treated as neutral.`
                                : 'No current observation · excluded from score, not treated as neutral.'}
                        </span>
                        <span className={styles.v9MissingLink}>Select for details ▸</span>
                    </MetricGlossary>
                );
            })}
        </div>
        {!compactCards && missing.length > 0 && <div className={styles.missingRow} role="group" aria-label="Unavailable inputs">
            <span><b>{missing.length} {missing.length === 1 ? 'input' : 'inputs'} unavailable</b><small>No current observation · select one for details</small></span>
            <span className={styles.missingList}>{missing.map(key => <MetricGlossary key={key} metric={metricForIndicator(key)} onInspect={element => onSelect(key, element)} buttonProps={{ type: 'button', 'data-indicator': key, 'data-available': false, 'aria-label': getIndicatorDisplayName(key), className: styles.missingChip }}><span>{getIndicatorDisplayName(key)}</span><small>{(configured[key] ?? 0) > 0 ? `${((configured[key] ?? 0) * 100).toFixed(1)}% configured weight · neutral reserve` : 'No configured scoring weight'}</small></MetricGlossary>)}</span>
        </div>}
        {observed.length > 3 && <button className={`${base.textButton} ${styles.expandEvidence}`} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Show fewer inputs' : `Show all ${observed.length} observed inputs`} {expanded ? '↑' : '↓'}</button>}
        {!compactCards && <p className={styles.evidenceNote}>Unavailable observations are not neutral sentiment. Configured missing weight may use neutral fallback.</p>}
    </section>;
}

// Points this input adds to or takes from the composite, measured from the neutral 50.
function ImpactChip({ impact }: { impact: number }) {
    const rounded = Math.round(impact * 10) / 10;
    const direction = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat';
    return <small className={styles.impact} data-impact={direction} title="(normalized score − 50) × applied weight">{rounded > 0 ? '+' : rounded < 0 ? '−' : '±'}{Math.abs(rounded).toFixed(1)} pts vs neutral</small>;
}
