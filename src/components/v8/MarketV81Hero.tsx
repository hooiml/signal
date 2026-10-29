import { marketAlignment, marketReadingLabel, marketTimestampLabel } from '@/lib/market-display';
import { buildMarketBrief } from '@/lib/market-brief';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { hasRetrievalTimestamp, marketEvidenceCoverage, marketEvidenceDay } from '@/lib/market-evidence-coverage';
import { getIndicatorDisplayName } from '@/lib/indicator-registry';
import { fullDate } from './MarketV8ConnectedData';
import { MARKET_SCORE_TIER_THRESHOLDS } from '@/lib/market-score-thresholds';
import styles from './market-v8.module.css';
import layout from './market-v8-connected.module.css';
import { MarketCoverageRing } from './MarketCoverageRing';
import { MarketSinceLastVisit } from './MarketSinceLastVisit';
import { MetricGlossary } from './MetricGlossary';
import { metricForIndicator } from '@/lib/learn/metric-links';

const pct = (value: number) => value.toFixed(1) + '%';
const onScale = (value: number) => Math.min(100, Math.max(0, value));

export function MarketV81Hero({ signal, snapshotDate, receivedAt, tierClass, onEvidence, onDrivers, onSelect }: {
    signal: MarketSignal; snapshotDate: string | null | undefined; tierClass: string;
    receivedAt?: string;
    onEvidence: () => void; onDrivers: () => void;
    onSelect: (key: string, element: HTMLButtonElement) => void;
}) {
    const referenceDate = snapshotDate || receivedAt;
    const coverage = marketEvidenceCoverage(signal, referenceDate);
    const brief = buildMarketBrief(signal, referenceDate);
    const snapshotDay = marketEvidenceDay(snapshotDate);
    const coverageVerified = brief.accountingVerified;
    const change = signal.metadata.score_delta;
    const compared = change?.delta != null && !!brief.comparisonDate;
    // A delta that rounds to 0.00 is reported as no change, not as a link to empty drivers.
    const unchanged = compared && Math.abs(change!.delta!) < 0.005;
    const alignment = marketAlignment(signal);
    // Only mark a supplied previous score; a reported delta does not establish it.
    const previousScore = compared && !unchanged ? change!.previous_score ?? null : null;
    const { neutralLower, neutralUpper } = MARKET_SCORE_TIER_THRESHOLDS;
    const name = (key: string) => signal.components[key]?.display_name ?? getIndicatorDisplayName(key);

    return <section className={layout.assessment} aria-label="Market assessment">
        <div className={layout.assessmentReading}>
            <span className={styles.eyebrow}>{signal.metadata.market === 'MY' ? 'Malaysia' : 'United States'} · {signal.mode === 'contrarian' ? 'Contrarian' : 'Momentum'} · {snapshotDay ? `Snapshot ${fullDate(snapshotDay)}` : !snapshotDate && brief.referenceDate && receivedAt ? `Retrieved ${marketTimestampLabel(receivedAt)} · snapshot date unavailable` : 'Snapshot date unavailable'}</span>
            <div className={layout.scoreLine}>
                <h1 className={`${styles.zone} ${brief.status === 'unavailable' ? styles.tierNeutral : tierClass}`}>{brief.status === 'unavailable' ? 'Assessment unavailable' : marketReadingLabel(signal.tier)}</h1>
                <strong><span data-testid="connected-score">{signal.composite_score.toFixed(0)}</span> <small>/100</small></strong>
                {unchanged ? <span data-testid="market-hero-unchanged">Score unchanged since {fullDate(brief.comparisonDate)}</span> : compared ? <button className={layout.changeLink} onClick={onDrivers}>Score {change!.delta! > 0 ? '+' : ''}{change!.delta!.toFixed(2)} points vs {fullDate(brief.comparisonDate)} ↗</button> : <span>Earlier comparable score unavailable</span>}
                <MarketSinceLastVisit signal={signal} snapshotDate={snapshotDay} />
            </div>
            {/* Where the score sits on the 0-100 scale; the ghost pin marks the previous comparable score. */}
            <div className={layout.spectrum} role="img" aria-label={`Score ${signal.composite_score.toFixed(0)} on a 0 to 100 scale; neutral band ${neutralLower} to ${neutralUpper - 1}.${previousScore !== null ? ` Previous score ${previousScore.toFixed(0)} on ${fullDate(brief.comparisonDate)}.` : ''}`}>
                <div className={styles.v81Spectrum}>
                    <span className={styles.v81NeutralBand} style={{ left: `${neutralLower}%`, width: `${neutralUpper - neutralLower}%` }} />
                    {previousScore !== null && <span className={styles.v81PreviousPin} style={{ left: `${onScale(previousScore)}%` }} />}
                    <span className={styles.v81ScorePin} style={{ left: `${onScale(signal.composite_score)}%` }} />
                </div>
                <div className={styles.v81SpectrumLegend} aria-hidden="true"><span>0 · lower</span><span>Neutral {neutralLower}–{neutralUpper - 1}</span><span>higher · 100</span></div>
            </div>
            {brief.status === 'unavailable' && <p className={layout.caution}>Calculated score · insufficient evidence for a current conclusion.</p>}
            <section className={layout.brief} aria-label="Latest Market Brief" data-testid="market-brief" data-status={brief.status}>
                <h2>Latest Market Brief <span>{brief.status === 'available' ? 'Assessment available' : brief.status === 'limited' ? 'Limited assessment' : 'Assessment unavailable'}</span></h2>
                <p>{brief.conclusion}</p>
                <div className={layout.briefRow}><b>What changed</b><p>{brief.change.text} {signal.metadata.change_reconciliation && <button type="button" className={styles.textButton} onClick={onDrivers}>Change details →</button>}</p></div>
                {([[brief.supportKey, 'Leading support'], [brief.conflictKey, 'Leading conflict']] as const).map(([key, label]) => <div className={layout.briefRow} key={label}>
                    <b>{label}</b>{key ? <p><button type="button" className={styles.textButton} data-indicator={key} onClick={event => onSelect(key, event.currentTarget)}>{name(key)} →</button> · {marketReadingLabel(signal.components[key].signal)} · observed {fullDate(marketEvidenceDay(signal.components[key].last_updated))}{signal.metadata.market === 'MY' && (key === 'aaii' || (key === 'vix' && signal.components[key].metadata?.unit === 'VIX points')) ? ' · US proxy' : ''}</p> : <p>{brief.status === 'unavailable' ? 'Withheld until the evidence supports an assessment.' : label === 'Leading support' ? 'No fresh aligned input identified.' : 'No fresh conflicting input identified; evidence gaps can still limit the reading.'}</p>}
                </div>)}
                <div className={layout.briefRow}><b>What to watch</b><ul>{brief.watch.map((watch, index) => <li key={index}><button type="button" className={styles.textButton} onClick={event => watch.key && signal.components[watch.key]?.enabled ? onSelect(watch.key, event.currentTarget) : onEvidence()}>{watch.text} →</button></li>)}</ul></div>
                <details className={layout.alignment}><summary>{brief.reasons.length ? `Evidence limits · ${brief.reasons.length}` : 'How this assessment is qualified'}</summary>
                    {brief.reasons.length > 0 && <ul>{brief.reasons.map((reason, index) => <li key={index}>{reason.text}</li>)}</ul>}
                    <p>Freshness uses each input’s observation date and configured age limit. Retrieval time is not an observation. Leading evidence is selected by weight among fresh inputs; categories indicate variety, not independent confirmation.</p>
                    <p>Complete fresh coverage, at least two indicator categories and no input above 50% of configured weight are required for an available assessment. These are descriptive checks, not forecast accuracy.</p>
                    {signal.mode === 'contrarian' && <p>Contrarian mode interprets higher sentiment scores as crowding risk and lower scores as potential opportunity; a rising score does not mean a more positive reading.</p>}
                    <button type="button" className={styles.textButton} onClick={onEvidence}>Review source coverage →</button>
                </details>
            </section>
            <details className={layout.alignment}><summary>{alignment.summary}</summary><p>{alignment.detail}</p>{signal.confidence.cap_reason && <p>{signal.confidence.cap_reason}</p>}</details>
            <p className={layout.agreement}>A descriptive reading, not a price forecast or trading advice.</p>
        </div>
        <section className={layout.coverage} aria-label="Observed evidence weight">
            <div className={layout.coverageHeading}><b>Evidence coverage · {coverage.scoredCount} of {coverage.configuredCount} inputs included</b><b>{!coverageVerified || coverage.observedPct === null ? 'Weight unverified' : `${pct(coverage.observedPct)} configured weight`}</b></div>
            {coverageVerified && coverage.observedPct !== null && coverage.fallbackPct !== null ? <>
                <MarketCoverageRing signal={signal} coverage={coverage} onSelect={onSelect} />
                <p>{pct(coverage.fallbackPct)} of configured weight uses neutral fallback for missing inputs.</p>
            </> : <p>Coverage weights could not be reconciled. Verify the source response.</p>}
            {coverage.unknownDateKeys.map(key => <p className={layout.caution} key={key}><b><MetricGlossary metric={metricForIndicator(key)}>{name(key)}</MetricGlossary>:</b> {hasRetrievalTimestamp(signal.components[key]) ? 'Observation date unknown.' : 'Observation freshness unknown.'}</p>)}
            {coverage.staleKeys.map(key => <p className={layout.caution} key={key}><b><MetricGlossary metric={metricForIndicator(key)}>{name(key)}</MetricGlossary>:</b> Stale · {fullDate(signal.components[key]?.last_updated)} · included.</p>)}
            <button type="button" className={styles.textButton} onClick={onEvidence}>Review source coverage →</button>
        </section>
    </section>;
}
