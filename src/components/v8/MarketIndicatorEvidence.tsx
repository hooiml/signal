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

export function MarketIndicatorEvidence({ signal, inputKeys, configured, date, referenceLabel, sourceEnabled, onSelect }: {
    signal: MarketSignal; inputKeys: string[]; configured: Record<string, number>; date: string;
    referenceLabel?: string;
    sourceEnabled: boolean; onSelect: (key: string, trigger: HTMLButtonElement) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    // Observations come first; unavailable configured inputs remain inspectable.
    const ordered = [...inputKeys].sort((a, b) => Number(!!signal.components[b]) - Number(!!signal.components[a]) || (signal.components[b]?.weight ?? configured[b] ?? 0) - (signal.components[a]?.weight ?? configured[a] ?? 0));
    // Inputs with no observation share one compact row; each stays a button that opens its detail.
    const observed = ordered.filter(key => signal.components[key]);
    const missing = ordered.filter(key => !signal.components[key]);
    return <section className={styles.evidence} aria-label="Explore indicators">
        <div className={base.sectionHeading}><div><h2>Current indicator evidence</h2><p>{referenceLabel ?? (marketEvidenceDay(date) ? fullDate(date) : 'Snapshot date unavailable')} · select an observation for details</p></div></div>
        <div className={styles.evidenceRows} data-expanded={expanded}>
            {observed.map((key, index) => {
                const item = signal.components[key];
                const disabled = item?.enabled === false || ((key === 'social' || key === 'news') && !sourceEnabled);
                const scored = !!item && !disabled && item.weight > 0;
                const conflict = scored && (signal.confidence.conflicting_indicators.includes(key) || signal.confidence.conflicting_indicators.includes(item.display_name));
                const status = disabled ? 'Disabled' : item ? indicatorStatus(signal, key, date) : 'Current observation unavailable';
                const direction = !scored ? 'unavailable' : indicatorReadingLabel(item.signal);
                return <MetricGlossary key={key} metric={metricForIndicator(key)} onInspect={element => onSelect(key, element)} buttonProps={{ type: 'button', 'data-indicator': key, 'data-overflow': index >= 3, 'data-available': !!item && !disabled, className: styles.evidenceRow, 'aria-label': item?.display_name ?? getIndicatorDisplayName(key) }}>
                    <span><b>{item?.display_name ?? getIndicatorDisplayName(key)}</b><small className={status.startsWith('Stale') ? styles.caution : ''}>{status}</small>{item && <V8FreshnessLine as="small" label={hasRetrievalTimestamp(item) ? 'Retrieved' : 'Dated'} separator=" " value={fullDate(marketEvidenceDay(item.last_updated))} />}</span>
                    <span><strong>{item ? formatRawValue(item, signal.metadata.market) : 'Unavailable'}</strong><span className={styles.direction} data-direction={direction}>{disabled ? 'Disabled' : scored ? `${signal.mode === 'contrarian' ? 'Contrarian' : 'Momentum'}: ${direction}` : item ? 'Context · not scored' : 'No reading'}</span>{scored && <ImpactChip impact={inputImpact(item.score, item.weight)} />}{conflict && <small>Disagrees with composite</small>}</span>
                </MetricGlossary>;
            })}
        </div>
        {missing.length > 0 && <div className={styles.missingRow} role="group" aria-label="Unavailable inputs">
            <span><b>{missing.length} {missing.length === 1 ? 'input' : 'inputs'} unavailable</b><small>No current observation · select one for details</small></span>
            <span className={styles.missingList}>{missing.map(key => <MetricGlossary key={key} metric={metricForIndicator(key)} onInspect={element => onSelect(key, element)} buttonProps={{ type: 'button', 'data-indicator': key, 'data-available': false, 'aria-label': getIndicatorDisplayName(key), className: styles.missingChip }}><span>{getIndicatorDisplayName(key)}</span><small>{(configured[key] ?? 0) > 0 ? `${((configured[key] ?? 0) * 100).toFixed(1)}% configured weight · neutral reserve` : 'No configured scoring weight'}</small></MetricGlossary>)}</span>
        </div>}
        {observed.length > 3 && <button className={`${base.textButton} ${styles.expandEvidence}`} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Show fewer inputs' : `Show all ${observed.length} observed inputs`} {expanded ? '↑' : '↓'}</button>}
        <p className={styles.evidenceNote}>Unavailable observations are not neutral sentiment. Configured missing weight may use neutral fallback.</p>
    </section>;
}

// Points this input adds to or takes from the composite, measured from the neutral 50.
function ImpactChip({ impact }: { impact: number }) {
    const rounded = Math.round(impact * 10) / 10;
    const direction = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat';
    return <small className={styles.impact} data-impact={direction} title="(normalized score − 50) × applied weight">{rounded > 0 ? '+' : rounded < 0 ? '−' : '±'}{Math.abs(rounded).toFixed(1)} pts vs neutral</small>;
}
