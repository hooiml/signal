'use client';

import { useEffect, useState } from 'react';
import type { FearGreedPayload } from '@/app/api/signals/fear-greed/route';
import type { MarketInternalsPayload } from '@/app/api/signals/internals/route';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { getIndicatorBaseWeights, getIndicatorDisplayName } from '@/lib/indicator-registry';
import { buildMarketBrief } from '@/lib/market-brief';
import { marketEvidenceCoverage, marketEvidenceDay } from '@/lib/market-evidence-coverage';
import { marketReadingLabel, marketTimestampLabel } from '@/lib/market-display';
import { MARKET_SCORE_TIER_THRESHOLDS } from '@/lib/market-score-thresholds';
import { signed } from '@/components/v8/market-v8-fixtures';
import { confirmationBadge } from './V9MarketInternals';
import styles from './v9-workspace.module.css';

type Tone = 'up' | 'neutral' | 'down';

const toneForTier = (tier: MarketSignal['tier']): Tone =>
    tier === 'buy' || tier === 'strong-buy' ? 'up' : tier === 'sell' || tier === 'strong-sell' ? 'down' : 'neutral';

const formatRating = (rating: string): string =>
    rating
        .trim()
        .split(/\s+/)
        .map(word => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ''))
        .join(' ') || 'Neutral';

function overallCheckBadge(
    signalScore: number,
    internals: MarketInternalsPayload,
): { readonly label: string; readonly tone: Tone } {
    const items = internals.items;
    if (internals.market === 'MY') {
        const upCount = items.filter(item => item.tone === 'up').length;
        const downCount = items.filter(item => item.tone === 'down').length;
        if (upCount >= 2) return { label: `Resilient locally · ${upCount}/${items.length}`, tone: 'up' };
        if (downCount >= 2) return { label: `Caution · ${downCount}/${items.length}`, tone: 'down' };
        return { label: `Mixed · ${items.length} checks`, tone: 'neutral' };
    }
    const signalBearish = signalScore < 40;
    const signalBullish = signalScore >= 65;
    if (signalBearish) {
        const confirms = items.filter(item => item.tone === 'down').length;
        return confirms >= 2
            ? { label: `Confirms caution · ${confirms}/${items.length}`, tone: 'down' }
            : { label: `Mixed vs caution · ${confirms}/${items.length}`, tone: 'neutral' };
    }
    if (signalBullish) {
        const confirms = items.filter(item => item.tone === 'up').length;
        return confirms >= 2
            ? { label: `Confirms strength · ${confirms}/${items.length}`, tone: 'up' }
            : { label: `Divergent · ${confirms}/${items.length}`, tone: 'neutral' };
    }
    const downCount = items.filter(item => item.tone === 'down').length;
    const upCount = items.filter(item => item.tone === 'up').length;
    if (downCount >= 2) return { label: `Cautious internals · ${downCount}/${items.length}`, tone: 'down' };
    if (upCount >= 2) return { label: `Constructive · ${upCount}/${items.length}`, tone: 'up' };
    return { label: `Balanced · ${items.length} checks`, tone: 'neutral' };
}

function findRangeStartComparison(
    signal: MarketSignal,
    snapshotDay: string | null,
    prevDay: string | null,
): { readonly date: string; readonly delta: number } | null {
    const history = signal.metadata.score_history;
    const currentScore = Number.isFinite(signal.composite_score) ? signal.composite_score : null;
    if (!history || history.length === 0 || currentScore === null) return null;

    const refMs = snapshotDay ? Date.parse(`${snapshotDay}T00:00:00Z`) : Date.now();
    const valid = history
        .map(entry => ({
            date: marketEvidenceDay(entry.date) ?? entry.date,
            ms: Date.parse(entry.date),
            score: entry.score,
        }))
        .filter(entry =>
            Number.isFinite(entry.ms)
            && Number.isFinite(entry.score)
            && (!snapshotDay || entry.date < snapshotDay)
            && (!prevDay || entry.date !== prevDay),
        )
        .sort((a, b) => a.ms - b.ms);

    if (valid.length === 0) return null;
    const ninetyTwoDaysMs = 92 * 86_400_000;
    const inQuarter = valid.filter(entry => refMs - entry.ms <= ninetyTwoDaysMs);
    const baseline = inQuarter[0] ?? valid[0];
    if (!baseline) return null;
    return {
        date: baseline.date,
        delta: currentScore - baseline.score,
    };
}

type FngState =
    | { readonly status: 'loading' }
    | { readonly status: 'ready'; readonly payload: FearGreedPayload };

export function V9MarketSummaryRail({
    market,
    mode,
    social,
    signal,
    referenceDate,
    comparisonNotice,
    onOpenDrivers,
    onOpenToday,
    onOpenScenarios,
}: {
    readonly market: 'US' | 'MY';
    readonly mode: 'standard' | 'contrarian';
    readonly social: boolean;
    readonly signal: MarketSignal;
    readonly referenceDate?: string;
    readonly comparisonNotice?: string | null;
    readonly onOpenDrivers: () => void;
    readonly onOpenToday: () => void;
    readonly onOpenScenarios: () => void;
}) {
    const tone = toneForTier(signal.tier);
    const title = market === 'MY' ? 'Malaysia · Bursa' : 'United States';
    const snapshotDay = marketEvidenceDay(signal.metadata.score_delta?.snapshot_date ?? referenceDate);
    const brief = buildMarketBrief(signal, snapshotDay ?? referenceDate);
    const coverage = marketEvidenceCoverage(signal, snapshotDay ?? referenceDate);
    const scoredWeightPct = coverage.observedPct ?? Math.round((signal.metadata.coverage_adjustment?.active_weight ?? 1) * 100);
    const delta = signal.metadata.score_delta?.delta;
    const prevDate = signal.metadata.score_delta?.previous_date;
    const prevDay = marketEvidenceDay(prevDate);
    const rangeBaseline = findRangeStartComparison(signal, snapshotDay, prevDay);
    const currentScore = Number.isFinite(signal.composite_score) ? signal.composite_score : null;
    const clampedPct = currentScore === null ? 50 : Math.min(98, Math.max(2, currentScore));

    const vixComponent = signal.components.vix;
    const effectiveSourceEnabled = signal.metadata.source_included ?? social;
    const isUsVix = signal.metadata.market === 'US' && vixComponent?.enabled === true && Number.isFinite(vixComponent.value);
    const elevatedVolatility = isUsVix && (vixComponent?.value ?? 0) > 25;
    const elevatedWeights = elevatedVolatility
        ? getIndicatorBaseWeights('US', { vixValue: vixComponent?.value, enableSocial: effectiveSourceEnabled })
        : null;
    const baselineUsVixWeight = getIndicatorBaseWeights('US', { enableSocial: effectiveSourceEnabled }).vix;

    const staleItems = coverage.staleKeys
        .map(itemKey => ({ key: itemKey, comp: signal.components[itemKey] }))
        .filter((entry): entry is { key: string; comp: NonNullable<MarketSignal['components'][string]> } => Boolean(entry.comp))
        .sort((a, b) => (b.comp.weight ?? 0) - (a.comp.weight ?? 0));
    const topStale = staleItems[0] ?? null;
    const topStaleDay = topStale ? marketEvidenceDay(topStale.comp.last_updated) : null;
    const topStaleAgeDays = topStaleDay && snapshotDay
        ? Math.round((Date.parse(`${snapshotDay}T00:00:00Z`) - Date.parse(`${topStaleDay}T00:00:00Z`)) / 86_400_000)
        : null;

    const missingLabels = coverage.unavailableKeys.map(getIndicatorDisplayName);
    const coverageSubtext = [
        `${coverage.scoredCount} of ${coverage.configuredCount} inputs`,
        missingLabels.length > 0
            ? `${missingLabels.join(', ')} missing`
            : !social
                ? market === 'MY'
                    ? 'News off by setting'
                    : 'Social off by setting'
                : null,
    ]
        .filter(Boolean)
        .join(' · ');

    const { neutralLower, neutralUpper } = MARKET_SCORE_TIER_THRESHOLDS;
    const negWidth = neutralLower;
    const neuWidth = neutralUpper - neutralLower;
    const posWidth = 100 - neutralUpper;

    return (
        <aside className={styles.v9SummaryRail} aria-label="Market summary">
            <section className={`${styles.card} ${styles.v9ScoreCard}`} data-tone={tone} aria-label="Market assessment">
                <div className={styles.v9ScoreHeaderRow}>
                    <div>
                        <h1>{title}</h1>
                        <p className={styles.v9ScoreSub}>
                            {mode === 'contrarian' ? 'Contrarian' : 'Momentum'} · {market === 'US' ? 'Model v2.2.0' : 'Malaysia v2'}
                            {snapshotDay ? ` · ${marketTimestampLabel(snapshotDay)}` : ''}
                        </p>
                    </div>
                    <span className={styles.toneBadge} data-tone={tone}>{marketReadingLabel(signal.tier)}</span>
                </div>

                <div className={styles.v9HeroScoreRow}>
                    <div className={styles.v9HeroScoreMain}>
                        <span className={styles.v9HeroScoreNum} data-tone={tone} data-testid="connected-score">
                            {currentScore === null ? '—' : Math.round(currentScore)}
                        </span>
                        <span className={styles.v9HeroScoreDenom}>/ 100</span>
                    </div>

                    {!comparisonNotice && (
                        <div className={styles.v9HeroDeltas}>
                            <button type="button" className={styles.v9DeltaBtn} onClick={onOpenDrivers}>
                                <span className={styles.v9DeltaLabel}>
                                    {prevDate ? `vs ${marketTimestampLabel(prevDate)}` : 'vs prior'}
                                </span>
                                <span
                                    className={styles.v9DeltaVal}
                                    data-direction={typeof delta === 'number' && delta !== 0 ? (delta > 0 ? 'up' : 'down') : undefined}
                                >
                                    {typeof delta === 'number' && Number.isFinite(delta)
                                        ? `${signed(delta, 1)} pts`
                                        : 'Details'}{' '}
                                    <span aria-hidden="true">↗</span>
                                </span>
                            </button>
                            {rangeBaseline && (
                                <div className={styles.v9DeltaItem}>
                                    <span className={styles.v9DeltaLabel}>vs {marketTimestampLabel(rangeBaseline.date)}</span>
                                    <span
                                        className={styles.v9DeltaVal}
                                        data-direction={rangeBaseline.delta > 0.5 ? 'up' : rangeBaseline.delta < -0.5 ? 'down' : undefined}
                                    >
                                        {signed(rangeBaseline.delta, 0)} pts
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {comparisonNotice && <p className={styles.v9Caution}>{comparisonNotice}</p>}

                <div className={styles.v9ZoneScale} aria-label="Score position on 0 to 100 scale">
                    <div className={styles.v9ZoneTrack}>
                        <div className={styles.v9ZoneSegNeg} style={{ width: `${negWidth}%` }} />
                        <div className={styles.v9ZoneSegNeu} style={{ width: `${neuWidth}%` }} />
                        <div className={styles.v9ZoneSegPos} style={{ width: `${posWidth}%` }} />
                        {currentScore !== null && (
                            <span
                                className={styles.v9ZoneMarker}
                                style={{ left: `${clampedPct}%` }}
                                aria-hidden="true"
                            />
                        )}
                    </div>
                    <div className={styles.v9ZoneLabels} aria-hidden="true">
                        <span style={{ width: `${negWidth}%` }}>0 · Negative</span>
                        <span style={{ width: `${neuWidth}%` }}>{neutralLower} · Neutral</span>
                        <span style={{ width: `${posWidth}%` }} className={styles.v9ZoneEndLabels}>
                            <span>{neutralUpper} · Positive</span>
                            <span>100</span>
                        </span>
                    </div>
                </div>

                {elevatedWeights && (
                    <p className={styles.v9Caution}>
                        VIX is above 25, so its weight ramps smoothly to {(elevatedWeights.vix * 100).toFixed(0)}% of the US score (from its {(baselineUsVixWeight * 100).toFixed(0)}% baseline).
                    </p>
                )}

                {brief.status !== 'unavailable' && (
                    <p className={styles.v9BriefLine}>
                        <strong>Brief:</strong> {brief.conclusion}
                    </p>
                )}

                <div className={styles.v9TrustGrid} data-has-stale={topStale ? 'true' : 'false'}>
                    <div className={styles.v9CoverageBox}>
                        <div className={styles.v9CoverageHead}>
                            <span>Evidence coverage</span>
                            <span>{Math.round(scoredWeightPct)}% of weight</span>
                        </div>
                        <div className={styles.v9CoverageTrack} aria-hidden="true">
                            <span style={{ flex: Math.max(0, scoredWeightPct), background: 'var(--brand)' }} />
                            {scoredWeightPct < 100 && <span style={{ flex: Math.max(0, 100 - scoredWeightPct), background: 'var(--surface-muted)' }} />}
                        </div>
                        <small className={styles.v9CoverageNote}>{coverageSubtext}</small>
                    </div>

                    {topStale && (
                        <div className={styles.v9StaleBox} role="note">
                            <b>{(topStale.comp.weight ?? 0) >= 0.35 ? 'Main driver is stale' : 'Stale input included'}</b>
                            <span>
                                {topStale.comp.display_name || getIndicatorDisplayName(topStale.key)} ({Math.round(topStale.comp.weight * 100)}% wt)
                                {topStaleDay ? ` dated ${marketTimestampLabel(topStaleDay)}` : ''}
                                {topStaleAgeDays !== null && topStaleAgeDays > 0 ? `, ${topStaleAgeDays} ${topStaleAgeDays === 1 ? 'day' : 'days'} old` : ''}.
                            </span>
                        </div>
                    )}
                </div>

                <div className={styles.v9CardFoot}>
                    <button type="button" className={styles.textLink} onClick={onOpenToday}>What changed today? →</button>
                    <button type="button" className={styles.textLink} onClick={onOpenScenarios}>Scenarios →</button>
                </div>
            </section>
        </aside>
    );
}

export function V9CrossMarketStrip({
    market,
    signalScore,
    internals,
    internalsLoading = false,
    onOpenContext,
}: {
    readonly market: 'US' | 'MY';
    readonly signalScore: number;
    readonly internals?: MarketInternalsPayload | null;
    readonly internalsLoading?: boolean;
    readonly onOpenContext: () => void;
}) {
    const [fngState, setFngState] = useState<FngState>({ status: 'loading' });

    useEffect(() => {
        const controller = new AbortController();
        void (async () => {
            try {
                const res = await fetch('/api/signals/fear-greed', { signal: controller.signal });
                if (!res.ok) throw new Error('Request failed');
                const body = (await res.json()) as { success?: boolean; data?: FearGreedPayload };
                if (!controller.signal.aborted) {
                    setFngState({
                        status: 'ready',
                        payload: body?.data ?? { available: false, reason: 'CNN Fear & Greed feed is currently unavailable.' },
                    });
                }
            } catch {
                if (!controller.signal.aborted) {
                    setFngState({
                        status: 'ready',
                        payload: { available: false, reason: 'CNN Fear & Greed feed is currently unavailable.' },
                    });
                }
            }
        })();
        return () => controller.abort();
    }, []);

    const fng = fngState.status === 'ready' ? fngState.payload : null;
    const hasInternals = Boolean(internals && internals.available && internals.items.length > 0);
    const summaryBadge = hasInternals && internals ? overallCheckBadge(signalScore, internals) : null;
    const hasFngCard = Boolean(fng && fng.available);

    return (
        <section className={`${styles.card} ${styles.v9CrossStrip}`} aria-label="Cross-Market Check">
            <div className={styles.v9CrossStripHead}>
                <div className={styles.v9CrossStripTitle}>
                    <div className={styles.v9CrossStripTitleRow}>
                        <h3>Cross-Market Check</h3>
                        {internalsLoading && !internals ? (
                            <span className={styles.toneBadge}>Loading</span>
                        ) : summaryBadge ? (
                            <span className={styles.toneBadge} data-tone={summaryBadge.tone}>{summaryBadge.label}</span>
                        ) : (
                            <span className={styles.toneBadge}>Unavailable</span>
                        )}
                    </div>
                    <p>{market === 'MY' ? 'KLCI, Ringgit & US credit · Context (not scored)' : 'Yahoo benchmarks · Context (not scored)'}</p>
                </div>
                {hasInternals && internals && (
                    <button type="button" className={styles.textLink} onClick={onOpenContext}>
                        Inspect {internals.items.length} baseline charts ↓
                    </button>
                )}
            </div>

            {hasInternals && internals ? (
                <div className={styles.v9CrossStripGrid} data-cols={hasFngCard ? '4' : '3'}>
                    {internals.items.map(item => {
                        const check = confirmationBadge(
                            signalScore,
                            item.tone,
                            market === 'MY' && item.id === 'global_credit',
                        );
                        return (
                            <div key={item.id} className={styles.v9CrossTile}>
                                <div className={styles.v9CrossTileTop}>
                                    <b>{item.name}</b>
                                    <span className={styles.toneBadge} data-tone={check.tone}>{check.label}</span>
                                </div>
                                <strong className={styles.v9CrossTileVal}>{item.latestLabel}</strong>
                                <small className={styles.v9CrossTileMeta}>{item.baselineLabel}</small>
                            </div>
                        );
                    })}
                    {hasFngCard && fng && fng.available && (
                        <div className={`${styles.v9CrossTile} ${styles.v9CrossTileOptional}`}>
                            <div className={styles.v9CrossTileTop}>
                                <b>CNN Fear &amp; Greed</b>
                                <span className={styles.toneBadge}>Not scored</span>
                            </div>
                            <strong className={styles.v9CrossTileVal}>{fng.score}/100</strong>
                            <small className={styles.v9CrossTileMeta}>{formatRating(fng.rating)}</small>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    <p className={styles.v9FngFallback}>
                        {internalsLoading
                            ? 'Fetching cross-market confirmation series…'
                            : 'Cross-market reference feed is unavailable right now. Signal scoring is unaffected.'}
                    </p>
                    {hasFngCard && fng && fng.available && (
                        <div className={styles.v9OptionalCnn}>
                            <span>CNN Fear &amp; Greed (optional): <b>{fng.score}/100 · {formatRating(fng.rating)}</b></span>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
