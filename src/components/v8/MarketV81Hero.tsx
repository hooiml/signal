'use client';

import { useState } from 'react';
import { marketAlignment, marketReadingLabel, marketTimestampLabel } from '@/lib/market-display';
import { buildMarketBrief } from '@/lib/market-brief';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { hasRetrievalTimestamp, marketEvidenceCoverage, marketEvidenceDay } from '@/lib/market-evidence-coverage';
import { getIndicatorBaseWeights, getIndicatorDisplayName } from '@/lib/indicator-registry';
import { fullDate } from './MarketV8ConnectedData';
import { MARKET_SCORE_TIER_THRESHOLDS } from '@/lib/market-score-thresholds';
import styles from './market-v8.module.css';
import layout from './market-v8-connected.module.css';
import { MarketCoverageRing } from './MarketCoverageRing';
import { MarketSinceLastVisit } from './MarketSinceLastVisit';
import { MetricGlossary } from './MetricGlossary';
import { metricForIndicator } from '@/lib/learn/metric-links';
import { MarketScoreArc } from './MarketScoreArc';
import { MarketStressTest, computeVixStress } from './MarketStressTest';

const pct = (value: number) => value.toFixed(1) + '%';

export function MarketV81Hero({ signal, snapshotDate, receivedAt, tierClass, onEvidence, onDrivers, onSelect, sourceEnabled, advanced = false }: {
    signal: MarketSignal; snapshotDate: string | null | undefined; tierClass: string;
    receivedAt?: string;
    sourceEnabled?: boolean;
    advanced?: boolean;
    onEvidence: () => void; onDrivers: () => void;
    onSelect: (key: string, element: HTMLButtonElement) => void;
}) {
    const [simulatedVix, setSimulatedVix] = useState<number | null>(null);
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

    const vixComponent = signal.components.vix;
    const inV9 = sourceEnabled !== undefined;
    const effectiveSourceEnabled = signal.metadata.source_included ?? (sourceEnabled ?? true);
    const isUsVix = signal.metadata.market === 'US' && vixComponent?.enabled === true && Number.isFinite(vixComponent.value);
    const elevatedVolatility = isUsVix && (vixComponent?.value ?? 0) > 25;
    const elevatedWeights = elevatedVolatility
        ? getIndicatorBaseWeights('US', { vixValue: vixComponent?.value, enableSocial: effectiveSourceEnabled })
        : null;
    const baselineUsVixWeight = getIndicatorBaseWeights('US', { enableSocial: effectiveSourceEnabled }).vix;
    const liveVix = typeof vixComponent?.value === 'number' && Number.isFinite(vixComponent.value) && vixComponent.value > 5 && vixComponent.value < 90
        ? vixComponent.value
        : 16.0;
    const stress = computeVixStress({
        liveScore: signal.composite_score,
        liveVix,
        simulatedVix,
        vixWeight: vixComponent?.weight ?? (signal.metadata.market === 'MY' ? 0.30 : 0.40),
        mode: signal.mode === 'contrarian' ? 'contrarian' : 'standard',
        signal,
    });

    const displayedScore = stress.active ? stress.score : signal.composite_score;
    const posture: 'up' | 'neutral' | 'down' = brief.status === 'unavailable'
        ? 'neutral'
        : displayedScore >= neutralUpper
            ? 'up'
            : displayedScore < neutralLower
                ? 'down'
                : 'neutral';

    return <section className={layout.assessment} data-posture={posture} aria-label="Market assessment">
        <div className={layout.assessmentTop}>
            <div className={layout.assessmentReading}>
                <span className={styles.eyebrow}>{signal.metadata.market === 'MY' ? 'Malaysia' : 'United States'} · {signal.mode === 'contrarian' ? 'Contrarian' : 'Momentum'} · {snapshotDay ? `Snapshot ${fullDate(snapshotDay)}` : !snapshotDate && brief.referenceDate && receivedAt ? `Retrieved ${marketTimestampLabel(receivedAt)} · snapshot date unavailable` : 'Snapshot date unavailable'}</span>

                <div className={layout.heroGaugeRow}>
                    <MarketScoreArc
                        score={displayedScore}
                        previousScore={previousScore}
                        previousDateLabel={brief.comparisonDate ? fullDate(brief.comparisonDate) : null}
                        neutralLower={neutralLower}
                        neutralUpper={neutralUpper}
                        posture={posture}
                        simulated={stress.active}
                    />
                    <div className={layout.scoreSummary}>
                        <div className={layout.scoreLine}>
                            <h1 className={`${styles.zone} ${brief.status === 'unavailable' ? styles.tierNeutral : tierClass}`}>{brief.status === 'unavailable' ? 'Assessment unavailable' : marketReadingLabel(signal.tier)}</h1>
                            <strong><span data-testid="connected-score">{signal.composite_score.toFixed(0)}</span> <small>/100</small></strong>
                            {stress.active && <span className={layout.simBadge}>Preview {stress.score}/100</span>}
                        </div>
                        <div className={layout.scoreMetaRow}>
                            {unchanged ? <span data-testid="market-hero-unchanged">Score unchanged {inV9 ? 'vs prior snapshot' : 'since'} {fullDate(brief.comparisonDate)}</span> : compared ? <button type="button" className={layout.changeLink} onClick={onDrivers}>Score {change!.delta! > 0 ? '+' : ''}{change!.delta!.toFixed(2)} points vs {inV9 ? 'prior snapshot ' : ''}{fullDate(brief.comparisonDate)} ↗</button> : <span>Earlier comparable score unavailable</span>}
                            <MarketSinceLastVisit signal={signal} snapshotDate={snapshotDay} sourceEnabled={sourceEnabled} />
                        </div>
                        {inV9 && elevatedWeights && <p className={layout.caution}>VIX is above 25, so its weight ramps smoothly to {(elevatedWeights.vix * 100).toFixed(0)}% of the US score (from its {(baselineUsVixWeight * 100).toFixed(0)}% baseline).</p>}
                        {brief.status === 'unavailable' && <p className={layout.caution}>Calculated score · insufficient evidence for a current conclusion.</p>}
                    </div>
                </div>
            </div>

            <section className={layout.coverage} aria-label="Observed evidence weight">
                <div className={layout.coverageHeading}><b>Evidence coverage · {coverage.scoredCount} of {coverage.configuredCount} inputs included</b><b>{!coverageVerified || coverage.observedPct === null ? 'Weight unverified' : `${pct(coverage.observedPct)} configured weight`}</b></div>
                {coverageVerified && coverage.observedPct !== null && coverage.fallbackPct !== null ? <>
                    <MarketCoverageRing signal={signal} coverage={coverage} onSelect={onSelect} />
                    {(!inV9 || coverage.fallbackPct > 0) && <p>{pct(coverage.fallbackPct)} of configured weight uses neutral fallback for missing inputs.</p>}
                </> : <p>Coverage weights could not be reconciled. Verify the source response.</p>}
                {coverage.unknownDateKeys.map(key => <p className={layout.caution} key={key}><b><MetricGlossary metric={metricForIndicator(key)}>{name(key)}</MetricGlossary>:</b> {hasRetrievalTimestamp(signal.components[key]) ? 'Observation date unknown.' : 'Observation freshness unknown.'}</p>)}
                {coverage.staleKeys.map(key => <p className={layout.caution} key={key}><b><MetricGlossary metric={metricForIndicator(key)}>{name(key)}</MetricGlossary>:</b> Stale · {fullDate(signal.components[key]?.last_updated)} · included.</p>)}
                <button type="button" className={styles.textButton} onClick={onEvidence}>Review source coverage →</button>
            </section>
        </div>

        {brief.status !== 'unavailable' && (!inV9 || (advanced && isUsVix)) && (
            <MarketStressTest
                liveVix={liveVix}
                simulatedVix={simulatedVix}
                simulation={stress}
                onChange={setSimulatedVix}
            />
        )}

        <section className={layout.brief} aria-label="Latest Market Brief" data-testid="market-brief" data-status={brief.status}>
            <div className={layout.briefHead}>
                <h2>Latest Market Brief <span>{brief.status === 'available' ? 'Assessment available' : brief.status === 'limited' ? 'Limited assessment' : 'Assessment unavailable'}</span></h2>
                <p>{brief.conclusion}</p>
            </div>
            {(!inV9 || advanced) ? <>
            <div className={layout.briefGrid}>
                <div className={layout.briefRow}>
                    <b>What changed</b>
                    <p>{brief.change.text} {signal.metadata.change_reconciliation && <button type="button" className={styles.textButton} onClick={onDrivers}>Change details →</button>}</p>
                </div>
                <div className={layout.briefRow}>
                    {([[brief.supportKey, 'Leading support'], [brief.conflictKey, 'Leading conflict']] as const).map(([key, label]) => <div className={layout.briefSubRow} key={label}>
                        <b>{label}</b>{key ? <p><button type="button" className={styles.textButton} data-indicator={key} onClick={event => onSelect(key, event.currentTarget)}>{name(key)} →</button> · {marketReadingLabel(signal.components[key].signal)} · observed {fullDate(marketEvidenceDay(signal.components[key].last_updated))}{signal.metadata.market === 'MY' && (key === 'aaii' || (key === 'vix' && signal.components[key].metadata?.unit === 'VIX points')) ? ' · US proxy' : ''}</p> : <p>{brief.status === 'unavailable' ? 'Withheld until the evidence supports an assessment.' : label === 'Leading support' ? 'No fresh aligned input identified.' : 'No fresh conflicting input identified; evidence gaps can still limit the reading.'}</p>}
                    </div>)}
                </div>
                <div className={layout.briefRow}>
                    <b>What to watch</b>
                    <ul>{brief.watch.map((watch, index) => <li key={index}><button type="button" className={styles.textButton} onClick={event => watch.key && signal.components[watch.key]?.enabled ? onSelect(watch.key, event.currentTarget) : onEvidence()}>{watch.text} →</button></li>)}</ul>
                </div>
            </div>
            <div className={layout.briefFoot}>
                <details className={layout.alignment}><summary>{brief.reasons.length ? `Evidence limits · ${brief.reasons.length}` : 'How this assessment is qualified'}</summary>
                    {brief.reasons.length > 0 && <ul>{brief.reasons.map((reason, index) => <li key={index}>{reason.text}</li>)}</ul>}
                    <p>Freshness uses each input’s observation date and configured age limit. Retrieval time is not an observation. Leading evidence is selected by weight among fresh inputs; categories indicate variety, not independent confirmation.</p>
                    <p>Complete fresh coverage, at least two indicator categories and no input above 50% of configured weight are required for an available assessment. These are descriptive checks, not forecast accuracy.</p>
                    {signal.mode === 'contrarian' && <p>Contrarian mode interprets higher sentiment scores as crowding risk and lower scores as potential opportunity; a rising score does not mean a more positive reading.</p>}
                    <button type="button" className={styles.textButton} onClick={onEvidence}>Review source coverage →</button>
                </details>
            </div>
            </> : (
                <div className={layout.briefFoot}>
                    <span>{brief.change.text}</span>
                    {signal.metadata.change_reconciliation && <button type="button" className={styles.textButton} onClick={onDrivers}>Change details →</button>}
                    {brief.reasons.length > 0 && <details className={layout.alignment}><summary>Evidence notes · {brief.reasons.length}</summary><ul>{brief.reasons.map((reason, index) => <li key={index}>{reason.text}</li>)}</ul></details>}
                </div>
            )}
        </section>

        <div className={layout.briefFoot}>
            <details className={layout.alignment}><summary>{alignment.summary}</summary><p>{alignment.detail}</p>{signal.confidence.cap_reason && <p>{signal.confidence.cap_reason}</p>}</details>
            <p className={layout.agreement}>A descriptive reading, not a price forecast or trading advice.</p>
        </div>
    </section>;
}
