import { marketAlignment, marketReadingLabel, marketReadingSummary } from '@/lib/market-display';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { hasRetrievalTimestamp, marketEvidenceCoverage } from '@/lib/market-evidence-coverage';
import { getIndicatorDisplayName } from '@/lib/indicator-registry';
import { fullDate } from './MarketV8ConnectedData';
import { MARKET_SCORE_TIER_THRESHOLDS } from '@/lib/market-score-thresholds';
import styles from './market-v8.module.css';
import layout from './market-v8-connected.module.css';
import { MarketLeadingEvidence } from './MarketV8Coverage';
import { MarketCoverageRing } from './MarketCoverageRing';
import { MarketSinceLastVisit } from './MarketSinceLastVisit';

const pct = (value: number) => value.toFixed(1) + '%';
const onScale = (value: number) => Math.min(100, Math.max(0, value));

export function MarketV81Hero({ signal, snapshotDate, tierClass, onEvidence, onDrivers, onSelect }: {
    signal: MarketSignal; snapshotDate: string | null | undefined; tierClass: string;
    onEvidence: () => void; onDrivers: () => void;
    onSelect: (key: string, element: HTMLButtonElement) => void;
}) {
    const coverage = marketEvidenceCoverage(signal, snapshotDate);
    const change = signal.metadata.score_delta;
    const compared = change?.delta != null && !!change.previous_date;
    // A delta that rounds to 0.00 is reported as no change, not as a link to empty drivers.
    const unchanged = compared && Math.abs(change!.delta!) < 0.005;
    const alignment = marketAlignment(signal);
    // Only mark a supplied previous score; a reported delta does not establish it.
    const previousScore = compared && !unchanged ? change!.previous_score ?? null : null;
    const { neutralLower, neutralUpper } = MARKET_SCORE_TIER_THRESHOLDS;
    const name = (key: string) => signal.components[key]?.display_name ?? getIndicatorDisplayName(key);

    return <section className={layout.assessment} aria-label="Market assessment">
        <div className={layout.assessmentReading}>
            <MarketSinceLastVisit signal={signal} snapshotDate={snapshotDate} />
            <span className={styles.eyebrow}>{signal.metadata.market === 'MY' ? 'Malaysia' : 'United States'} · {signal.mode === 'contrarian' ? 'Contrarian' : 'Momentum'} · {snapshotDate ? fullDate(snapshotDate) : 'Snapshot date unavailable'}</span>
            <div className={layout.scoreLine}>
                <h1 className={`${styles.zone} ${tierClass}`}>{marketReadingLabel(signal.tier)}</h1>
                <strong><span data-testid="connected-score">{signal.composite_score.toFixed(0)}</span> <small>/100</small></strong>
                {unchanged ? <span data-testid="market-hero-unchanged">No change since {fullDate(change!.previous_date)}</span> : compared ? <button className={layout.changeLink} onClick={onDrivers}>{change!.delta! > 0 ? '+' : ''}{change!.delta!.toFixed(2)} points vs {fullDate(change!.previous_date)} ↗</button> : <span>Earlier comparable score unavailable</span>}
            </div>
            {/* Where the score sits on the 0-100 scale; the ghost pin marks the previous comparable score. */}
            <div className={layout.spectrum} role="img" aria-label={`Score ${signal.composite_score.toFixed(0)} on a 0 to 100 scale; neutral band ${neutralLower} to ${neutralUpper - 1}.${previousScore !== null ? ` Previous score ${previousScore.toFixed(0)} on ${fullDate(change!.previous_date)}.` : ''}`}>
                <div className={styles.v81Spectrum}>
                    <span className={styles.v81NeutralBand} style={{ left: `${neutralLower}%`, width: `${neutralUpper - neutralLower}%` }} />
                    {previousScore !== null && <span className={styles.v81PreviousPin} style={{ left: `${onScale(previousScore)}%` }} />}
                    <span className={styles.v81ScorePin} style={{ left: `${onScale(signal.composite_score)}%` }} />
                </div>
                <div className={styles.v81SpectrumLegend} aria-hidden="true"><span>0 · lower</span><span>Neutral {neutralLower}–{neutralUpper - 1}</span><span>higher · 100</span></div>
            </div>
            <p>{marketReadingSummary(signal)}</p>
            <MarketLeadingEvidence signal={signal} date={snapshotDate ?? ''} onSelect={onSelect} />
            <details className={layout.alignment}><summary>{alignment.summary}</summary><p>{alignment.detail}</p>{signal.confidence.cap_reason && <p>{signal.confidence.cap_reason}</p>}</details>
            <p className={layout.agreement}>A descriptive reading, not a price forecast or trading advice.</p>
        </div>
        <section className={layout.coverage} aria-label="Observed evidence weight">
            <div className={layout.coverageHeading}><b>Evidence coverage · {coverage.scoredCount} of {coverage.configuredCount} inputs included</b><b>{coverage.observedPct === null ? 'Weight unverified' : `${pct(coverage.observedPct)} configured weight`}</b></div>
            {coverage.observedPct !== null && coverage.fallbackPct !== null ? <>
                <MarketCoverageRing signal={signal} coverage={coverage} onSelect={onSelect} />
                <p>{pct(coverage.fallbackPct)} of configured weight uses neutral fallback for missing inputs.</p>
                {coverage.verifiedPartition && <p>Fresh {pct(coverage.freshPct!)} · stale {pct(coverage.stalePct!)} of model weight.</p>}
            </> : <p>Coverage weights could not be reconciled. Verify the source response.</p>}
            {coverage.unknownDateKeys.map(key => <p className={layout.caution} key={key}><b>{name(key)}:</b> {hasRetrievalTimestamp(signal.components[key]) ? 'Observation date unknown.' : 'Observation freshness unknown.'}</p>)}
            {coverage.staleKeys.map(key => <p className={layout.caution} key={key}><b>{name(key)}:</b> Stale · {fullDate(signal.components[key]?.last_updated)} · included.</p>)}
            <button type="button" className={styles.textButton} onClick={onEvidence}>Review source coverage →</button>
        </section>
    </section>;
}
