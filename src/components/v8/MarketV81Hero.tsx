import { marketAlignment, marketReadingLabel, marketReadingSummary } from '@/lib/market-display';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { hasRetrievalTimestamp, marketEvidenceCoverage } from '@/lib/market-evidence-coverage';
import { getIndicatorDisplayName } from '@/lib/indicator-registry';
import { fullDate } from './MarketV8ConnectedData';
import styles from './market-v8.module.css';
import layout from './market-v8-connected.module.css';

const pct = (value: number) => value.toFixed(1) + '%';

export function MarketV81Hero({ signal, snapshotDate, tierClass, onEvidence, onDrivers }: {
    signal: MarketSignal; snapshotDate: string | null | undefined; tierClass: string;
    onEvidence: () => void; onDrivers: () => void;
}) {
    const coverage = marketEvidenceCoverage(signal, snapshotDate);
    const change = signal.metadata.score_delta;
    const compared = change?.delta != null && !!change.previous_date;
    const alignment = marketAlignment(signal);
    const name = (key: string) => signal.components[key]?.display_name ?? getIndicatorDisplayName(key);

    return <section className={layout.assessment} aria-label="Market assessment">
        <div className={layout.assessmentReading}>
            <span className={styles.eyebrow}>{signal.metadata.market === 'MY' ? 'Malaysia' : 'United States'} · {signal.mode === 'contrarian' ? 'Contrarian' : 'Momentum'} · {snapshotDate ? fullDate(snapshotDate) : 'Snapshot date unavailable'}</span>
            <div className={layout.scoreLine}>
                <h1 className={`${styles.zone} ${tierClass}`}>{marketReadingLabel(signal.tier)}</h1>
                <strong><span data-testid="connected-score">{signal.composite_score.toFixed(0)}</span> <small>/100</small></strong>
                {compared ? <button className={layout.changeLink} onClick={onDrivers}>{change!.delta! > 0 ? '+' : ''}{change!.delta!.toFixed(2)} points vs {fullDate(change!.previous_date)} ↗</button> : <span>Earlier comparable score unavailable</span>}
            </div>
            <p>{marketReadingSummary(signal)}</p>
            <details className={layout.alignment}><summary>{alignment.summary}</summary><p>{alignment.detail}</p>{signal.confidence.cap_reason && <p>{signal.confidence.cap_reason}</p>}</details>
            <p className={layout.agreement}>A descriptive reading, not a price forecast or trading advice.</p>
        </div>
        <section className={layout.coverage} aria-label="Observed evidence weight">
            <div className={layout.coverageHeading}><b>Evidence coverage · {coverage.scoredCount} of {coverage.configuredCount} inputs included</b><b>{coverage.observedPct === null ? 'Weight unverified' : `${pct(coverage.observedPct)} configured weight`}</b></div>
            {coverage.observedPct !== null && coverage.fallbackPct !== null ? <>
                <div className={styles.v81CoverageBar} role="img" aria-label={coverage.verifiedPartition
                    ? `Fresh ${pct(coverage.freshPct!)}, stale ${pct(coverage.stalePct!)}, neutral fallback ${pct(coverage.fallbackPct)}`
                    : `Scored ${pct(coverage.observedPct)}, neutral fallback ${pct(coverage.fallbackPct)}. Observation freshness is not fully verified.`}>
                    {coverage.verifiedPartition
                        ? <><span className={styles.v81Fresh} style={{ width: coverage.freshPct + '%' }} /><span className={styles.v81Stale} style={{ width: coverage.stalePct + '%' }} /></>
                        : <span className={styles.v81Observed} style={{ width: coverage.observedPct + '%' }} />}
                    <span className={styles.v81Fallback} style={{ width: coverage.fallbackPct + '%' }} />
                </div>
                <p>{pct(coverage.fallbackPct)} of configured weight uses neutral fallback for missing inputs.</p>
                {coverage.verifiedPartition && <p>Fresh {pct(coverage.freshPct!)} · stale {pct(coverage.stalePct!)} of model weight.</p>}
            </> : <p>Coverage weights could not be reconciled. Verify the source response.</p>}
            {coverage.unknownDateKeys.map(key => <p className={layout.caution} key={key}><b>{name(key)}:</b> {hasRetrievalTimestamp(signal.components[key]) ? 'Observation date unknown.' : 'Observation freshness unknown.'}</p>)}
            {coverage.staleKeys.map(key => <p className={layout.caution} key={key}><b>{name(key)}:</b> Stale · {fullDate(signal.components[key]?.last_updated)} · included.</p>)}
            <button type="button" className={styles.textButton} onClick={onEvidence}>Review source coverage →</button>
        </section>
    </section>;
}
