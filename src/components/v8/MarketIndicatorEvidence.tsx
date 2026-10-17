import { hasRetrievalTimestamp } from '@/lib/market-evidence-coverage';
import { useState } from 'react';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { getIndicatorDisplayName } from '@/lib/indicator-registry';
import { formatRawValue } from '@/components/v2/cockpit-utils';
import { fullDate, indicatorReadingLabel, indicatorStatus } from './MarketV8ConnectedData';
import base from './market-v8.module.css';
import styles from './market-v8-connected.module.css';

export function MarketIndicatorEvidence({ signal, inputKeys, configured, date, sourceEnabled, onSelect }: {
    signal: MarketSignal; inputKeys: string[]; configured: Record<string, number>; date: string;
    sourceEnabled: boolean; onSelect: (key: string, trigger: HTMLButtonElement) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    // Observations come first; unavailable configured inputs remain inspectable.
    const ordered = [...inputKeys].sort((a, b) => Number(!!signal.components[b]) - Number(!!signal.components[a]) || (signal.components[b]?.weight ?? configured[b] ?? 0) - (signal.components[a]?.weight ?? configured[a] ?? 0));
    return <section className={styles.evidence} aria-label="Explore indicators">
        <div className={base.sectionHeading}><div><h2>Current indicator evidence</h2><p>{date ? fullDate(date) : 'Snapshot date unavailable'} · select an observation for details</p></div></div>
        <div className={styles.evidenceRows} data-expanded={expanded}>
            {ordered.map((key, index) => {
                const item = signal.components[key];
                const disabled = item?.enabled === false || ((key === 'social' || key === 'news') && !sourceEnabled);
                const scored = !!item && !disabled && item.weight > 0;
                const conflict = scored && (signal.confidence.conflicting_indicators.includes(key) || signal.confidence.conflicting_indicators.includes(item.display_name));
                const status = disabled ? 'Disabled' : item ? indicatorStatus(signal, key, date) : 'Current observation unavailable';
                const direction = !scored ? 'unavailable' : indicatorReadingLabel(item.signal);
                return <button type="button" key={key} data-indicator={key} data-overflow={index >= 3} data-available={!!item && !disabled} className={styles.evidenceRow} onClick={event => onSelect(key, event.currentTarget)}>
                    <span><b>{item?.display_name ?? getIndicatorDisplayName(key)}</b><small className={status.startsWith('Stale') ? styles.caution : ''}>{status}</small>{item && <small>{hasRetrievalTimestamp(item) ? 'Retrieved ' : 'Dated '}{fullDate(item.last_updated)}</small>}</span>
                    <span><strong>{item ? formatRawValue(item, signal.metadata.market) : 'Unavailable'}</strong><span className={styles.direction} data-direction={direction}>{disabled ? 'Disabled' : scored ? `${signal.mode === 'contrarian' ? 'Contrarian' : 'Momentum'}: ${direction}` : item ? 'Context · not scored' : 'No reading'}</span>{conflict && <small>Disagrees with composite</small>}</span>
                </button>;
            })}
        </div>
        {ordered.length > 3 && <button className={`${base.textButton} ${styles.expandEvidence}`} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Show fewer inputs' : `Show all ${ordered.length} inputs`} {expanded ? '↑' : '↓'}</button>}
        <p className={styles.evidenceNote}>Unavailable observations are not neutral sentiment. Configured missing weight may use neutral fallback.</p>
    </section>;
}
