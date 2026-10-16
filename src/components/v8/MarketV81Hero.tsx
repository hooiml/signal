import type { MarketSignal } from '@/lib/types/signal-v2';
import { marketEvidenceCoverage } from '@/lib/market-evidence-coverage';
import { MARKET_SCORE_TIER_THRESHOLDS } from '@/lib/market-score-thresholds';
import { fullDate } from './MarketV8ConnectedData';
import styles from './market-v8.module.css';

const pct = (value: number) => value.toFixed(1) + '%';
const signed = (value: number) => (value > 0 ? '+' : '') + value.toFixed(2);

export function MarketV81Hero({ signal, snapshotDate, tierClass, onEvidence, onDrivers }: {
    signal: MarketSignal; snapshotDate: string | null | undefined; tierClass: string;
    onEvidence: () => void; onDrivers: () => void;
}) {
    const coverage = marketEvidenceCoverage(signal, snapshotDate);
    const change = signal.metadata.score_delta;
    const reportedChanges = signal.metadata.driver_changes_available === true ? signal.metadata.driver_changes ?? [] : [];
    const contributors = [...reportedChanges].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 2);
    const conflict = signal.confidence.conflicting_indicators;
    const observed = coverage.observedPct;
    const fallback = coverage.fallbackPct;
    const deltaAvailable = change?.delta !== null && change?.delta !== undefined && !!change.previous_date;
    const currentScore = Math.max(0, Math.min(100, signal.composite_score));
    const active = Object.values(signal.components).filter(item => item.enabled && item.weight > 0);
    const agreeing = active.filter(item => (item.signal.includes('buy') ? 'BUY' : item.signal.includes('sell') ? 'SELL' : 'NEUTRAL') === signal.confidence.majority_signal).length;
    const agreementCount = active.length >= 2 && active.length === signal.confidence.source_count
        ? ` (${agreeing} of ${active.length} scored inputs match the overall classification)` : '';

    return <div className={styles.v81Hero} aria-label="Current score, evidence weight and primary score drivers">
        <section className={styles.v81HeroCell} aria-label="Composite reading">
            <span className={styles.eyebrow}>Composite reading</span>
            <div className={styles.v81ScoreLine}><strong data-testid="connected-score">{signal.composite_score.toFixed(0)}</strong><span>/100</span><span className={[styles.zone, tierClass].join(' ')}>{signal.tier.replaceAll('-', ' ')}</span></div>
            <p>{deltaAvailable ? signed(change!.delta!) + ' points vs ' + fullDate(change!.previous_date) : 'Earlier comparable score unavailable'}</p>
            <div className={styles.v81Spectrum} aria-label="Score tier boundaries and current composite reading">
                <div className={styles.v81NeutralBand} style={{ left: MARKET_SCORE_TIER_THRESHOLDS.neutralLower + '%', width: (MARKET_SCORE_TIER_THRESHOLDS.neutralUpper - MARKET_SCORE_TIER_THRESHOLDS.neutralLower) + '%' }} />
                {deltaAvailable && change?.previous_score !== null && change?.previous_score !== undefined && <span className={styles.v81PreviousPin} style={{ left: Math.max(0, Math.min(100, change.previous_score)) + '%' }} title={'Previous score ' + change.previous_score} />}
                <span className={styles.v81ScorePin} style={{ left: currentScore + '%' }} title={'Current score ' + currentScore} />
            </div>
            <div className={styles.v81SpectrumLegend}><span>0</span><span>Neutral score tier {MARKET_SCORE_TIER_THRESHOLDS.neutralLower}–{MARKET_SCORE_TIER_THRESHOLDS.neutralUpper - 1}</span><span>100</span></div>
            <p className={styles.v81Minor}>{signal.confidence.agreement_pct.toFixed(0)}% indicator agreement{agreementCount} · not forecast accuracy</p>
        </section>
        <section className={styles.v81HeroCell} aria-label="Observed evidence weight">
            <span className={styles.eyebrow}>{coverage.verifiedPartition ? "Observed evidence weight" : "Scored input weight"}</span>
            <div className={styles.v81Metric}>{observed === null ? '—' : pct(observed)}<small>{observed === null ? 'Unverified weight' : fallback && fallback > 0.01 ? 'Partial coverage' : 'Fully scored'}</small></div>
            <p>{coverage.scoredCount} of {coverage.configuredCount} configured inputs scored{observed !== null && fallback !== null ? ` · ${pct(observed)} of model weight; ${pct(fallback)} in neutral fallback` : ''}</p>
            {observed !== null && fallback !== null ? <>
                <div className={styles.v81CoverageBar} role="img" aria-label={coverage.verifiedPartition
                    ? 'Fresh ' + pct(coverage.freshPct!) + ', stale ' + pct(coverage.stalePct!) + ', neutral fallback ' + pct(fallback)
                    : 'Scored ' + pct(observed) + ', neutral fallback ' + pct(fallback) + '. Freshness partition not verified.'}>
                    {coverage.verifiedPartition
                        ? <><span className={styles.v81Fresh} style={{ width: coverage.freshPct + '%' }} /><span className={styles.v81Stale} style={{ width: coverage.stalePct + '%' }} /></>
                        : <span className={styles.v81Observed} style={{ width: observed + '%' }} />}
                    <span className={styles.v81Fallback} style={{ width: fallback + '%' }} />
                </div>
                <div className={styles.v81CoverageLegend}>{coverage.verifiedPartition
                    ? <><span>Fresh {pct(coverage.freshPct!)}</span><span>Stale {pct(coverage.stalePct!)}</span><span>Fallback {pct(fallback)}</span></>
                    : <><span>Scored {pct(observed)}</span><span>Fallback {pct(fallback)}</span></>}</div>
            </> : <p>Coverage weights could not be reconciled. Verify the source response.</p>}
            {!coverage.verifiedPartition && <p className={styles.v81Minor}>{coverage.unknownDateKeys.length
                ? coverage.unknownDateKeys.length + ' scored input(s) lack a verifiable observation date.'
                : 'Detailed fresh/stale split is unavailable until model weights reconcile.'}</p>}
            {!!coverage.staleKeys.length && <p className={styles.v81Minor}>{coverage.staleKeys.length} scored input(s) are stale.</p>}
            <button type="button" className={styles.textButton} onClick={onEvidence}>Review source coverage →</button>
        </section>
        <section className={styles.v81HeroCell} aria-label="What moved the score">
            <span className={styles.eyebrow}>What moved the score?</span>
            <p>{deltaAvailable ? 'vs ' + fullDate(change!.previous_date) + ' (' + signed(change!.delta!) + ' points)' : 'Comparable earlier reading unavailable'}</p>
            {contributors.length ? <div className={styles.v81Drivers}>{contributors.map(driver => <div className={styles.v81Driver} key={driver.key}><span>{driver.name}</span><div className={styles.v81DriverTrack}><span className={driver.delta < 0 ? styles.v81DriverDown : styles.v81DriverUp} style={{ width: Math.min(50, Math.abs(driver.delta) * 12) + '%' }} /></div><strong>{signed(driver.delta)}</strong></div>)}</div>
                : <p className={styles.v81Minor}>No comparable driver contributions were returned.</p>}
            <p className={styles.v81Minor}>{contributors.length ? 'Largest reported drivers · not a complete score reconciliation.' : 'A score change alone does not establish its cause.'}</p>
            {!!conflict.length && <p className={styles.v81Minor}>Conflicting evidence: {conflict.map(key => signal.components[key]?.display_name ?? key).join(', ')}</p>}
            <button type="button" className={styles.textButton} onClick={onDrivers}>Inspect reported changes →</button>
        </section>
    </div>;
}

export function MarketSourceCoverage({ signal, snapshotDate }: { signal: MarketSignal; snapshotDate: string | null | undefined }) {
    const coverage = marketEvidenceCoverage(signal, snapshotDate);
    return <>
        <p>{coverage.scoredCount} of {coverage.configuredCount} configured inputs scored.
            {coverage.observedPct === null || coverage.fallbackPct === null
                ? ' Coverage weights are unverified.'
                : ` ${pct(coverage.observedPct)} of model weight is scored; ${pct(coverage.fallbackPct)} uses neutral fallback.`}
            {` ${coverage.unavailableKeys.length} configured inputs are unavailable or disabled.`}
        </p>
        {!!coverage.staleKeys.length && <p>{coverage.staleKeys.length} scored input(s) are stale.</p>}
        {!!coverage.unknownDateKeys.length && <p>{coverage.unknownDateKeys.length} scored input(s) have unknown observation freshness.</p>}
    </>;
}
