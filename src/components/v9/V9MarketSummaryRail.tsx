'use client';

import { useEffect, useState } from 'react';
import type { FearGreedPayload } from '@/app/api/signals/fear-greed/route';
import type { MarketInternalsPayload } from '@/app/api/signals/internals/route';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { getIndicatorBaseWeights } from '@/lib/indicator-registry';
import { buildMarketBrief } from '@/lib/market-brief';
import { marketEvidenceCoverage, marketEvidenceDay } from '@/lib/market-evidence-coverage';
import { marketReadingLabel, marketTimestampLabel } from '@/lib/market-display';
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

function CompactScoreRing({ score, tone }: { readonly score: number | null; readonly tone: Tone }) {
    const r = 25;
    const c = 2 * Math.PI * r;
    const pct = score === null ? 0 : Math.min(100, Math.max(0, score)) / 100;
    const stroke = tone === 'up' ? 'var(--up-mark)' : tone === 'down' ? 'var(--down-mark)' : 'var(--caution-mark)';
    return (
        <div className={styles.v9Ring} role="img" aria-label={score === null ? 'Score unavailable' : `Score ${Math.round(score)} out of 100`}>
            <svg viewBox="0 0 62 62" aria-hidden="true">
                <circle cx="31" cy="31" r={r} fill="none" stroke="var(--surface-muted)" strokeWidth="5.5" />
                <circle
                    cx="31"
                    cy="31"
                    r={r}
                    fill="none"
                    stroke={stroke}
                    strokeWidth="5.5"
                    strokeLinecap="round"
                    strokeDasharray={c.toFixed(1)}
                    strokeDashoffset={(c * (1 - pct)).toFixed(1)}
                />
            </svg>
            <span className={styles.v9RingVal} data-testid="connected-score">{score === null ? '—' : Math.round(score)}</span>
        </div>
    );
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
    internals,
    internalsLoading = false,
    onOpenDrivers,
    onOpenToday,
    onOpenScenarios,
    onOpenContext,
}: {
    readonly market: 'US' | 'MY';
    readonly mode: 'standard' | 'contrarian';
    readonly social: boolean;
    readonly signal: MarketSignal;
    readonly referenceDate?: string;
    readonly comparisonNotice?: string | null;
    readonly internals?: MarketInternalsPayload | null;
    readonly internalsLoading?: boolean;
    readonly onOpenDrivers: () => void;
    readonly onOpenToday: () => void;
    readonly onOpenScenarios: () => void;
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

    const tone = toneForTier(signal.tier);
    const title = market === 'MY' ? 'Malaysia · Bursa' : 'United States';
    const snapshotDay = marketEvidenceDay(signal.metadata.score_delta?.snapshot_date ?? referenceDate);
    const brief = buildMarketBrief(signal, snapshotDay ?? referenceDate);
    const coverage = marketEvidenceCoverage(signal, snapshotDay ?? referenceDate);
    const scoredWeightPct = coverage.observedPct ?? Math.round((signal.metadata.coverage_adjustment?.active_weight ?? 1) * 100);
    const delta = signal.metadata.score_delta?.delta;
    const prevDate = signal.metadata.score_delta?.previous_date;
    const fng = fngState.status === 'ready' ? fngState.payload : null;
    const vixComponent = signal.components.vix;
    const effectiveSourceEnabled = signal.metadata.source_included ?? social;
    const isUsVix = signal.metadata.market === 'US' && vixComponent?.enabled === true && Number.isFinite(vixComponent.value);
    const elevatedVolatility = isUsVix && (vixComponent?.value ?? 0) > 25;
    const elevatedWeights = elevatedVolatility
        ? getIndicatorBaseWeights('US', { vixValue: vixComponent?.value, enableSocial: effectiveSourceEnabled })
        : null;
    const baselineUsVixWeight = getIndicatorBaseWeights('US', { enableSocial: effectiveSourceEnabled }).vix;

    return (
        <aside className={styles.v9SummaryRail} aria-label="Market summary and benchmarks">
            <section className={`${styles.card} ${styles.v9ScoreCard}`} data-tone={tone} aria-label="Market assessment">
                <div className={styles.v9ScoreTop}>
                    <CompactScoreRing score={signal.composite_score} tone={tone} />
                    <div className={styles.v9ScoreMeta}>
                        <div className={styles.v9ScoreTitleRow}>
                            <h1>{title}</h1>
                            <span className={styles.toneBadge} data-tone={tone}>{marketReadingLabel(signal.tier)}</span>
                        </div>
                        <p className={styles.v9ScoreSub}>
                            {mode === 'contrarian' ? 'Contrarian' : 'Momentum'} · {market === 'US' ? 'Model v2.2.0' : 'Malaysia v2'}
                            {snapshotDay ? ` · ${marketTimestampLabel(snapshotDay)}` : ''}
                        </p>
                        {comparisonNotice ? (
                            <p className={styles.v9Caution}>{comparisonNotice}</p>
                        ) : (
                            <button type="button" className={styles.v9DeltaBtn} onClick={onOpenDrivers}>
                                <span data-direction={typeof delta === 'number' && delta !== 0 ? (delta > 0 ? 'up' : 'down') : undefined}>
                                    {typeof delta === 'number' && Number.isFinite(delta)
                                        ? `${signed(delta)} pts${prevDate ? ` vs ${marketTimestampLabel(prevDate)}` : ' vs prior'}`
                                        : 'View driver details'}
                                </span>
                                <span aria-hidden="true">↗</span>
                            </button>
                        )}
                    </div>
                </div>

                {elevatedWeights && (
                    <p className={styles.v9Caution}>
                        VIX is above 25, so its weight ramps smoothly to {(elevatedWeights.vix * 100).toFixed(0)}% of the US score (from its {(baselineUsVixWeight * 100).toFixed(0)}% baseline).
                    </p>
                )}

                <div className={styles.v9CoverageBox}>
                    <div className={styles.v9CoverageHead}>
                        <span>Evidence coverage</span>
                        <span>{Math.round(scoredWeightPct)}% · {coverage.scoredCount}/{coverage.configuredCount} inputs</span>
                    </div>
                    <div className={styles.v9CoverageTrack} aria-hidden="true">
                        <span style={{ flex: Math.max(0, scoredWeightPct), background: 'var(--brand)' }} />
                        {scoredWeightPct < 100 && <span style={{ flex: Math.max(0, 100 - scoredWeightPct), background: 'var(--surface-muted)' }} />}
                    </div>
                    {!social && (
                        <small className={styles.v9CoverageNote}>
                            {market === 'MY' ? 'News excluded by setting; remaining weights scaled.' : 'Social excluded by setting; remaining weights scaled.'}
                        </small>
                    )}
                </div>

                {brief.status !== 'unavailable' && (
                    <p className={styles.v9BriefLine}>
                        <strong>Brief:</strong> {brief.conclusion}
                    </p>
                )}

                <div className={styles.v9CardFoot}>
                    <button type="button" className={styles.textLink} onClick={onOpenToday}>What changed today? →</button>
                    <button type="button" className={styles.textLink} onClick={onOpenScenarios}>Scenarios →</button>
                </div>
            </section>

            <section className={`${styles.card} ${styles.v9FngCard}`} aria-label="Cross-Market Check">
                <div className={styles.v9FngHead}>
                    <div>
                        <h3>Cross-Market Check</h3>
                        <p>{market === 'MY' ? 'KLCI, Ringgit & US credit' : 'Yahoo benchmarks · Context'}</p>
                    </div>
                    {internalsLoading && !internals ? (
                        <span className={styles.toneBadge}>Loading</span>
                    ) : internals && internals.available && internals.items.length > 0 ? (
                        (() => {
                            const summary = overallCheckBadge(signal.composite_score, internals);
                            return <span className={styles.toneBadge} data-tone={summary.tone}>{summary.label}</span>;
                        })()
                    ) : (
                        <span className={styles.toneBadge}>Unavailable</span>
                    )}
                </div>

                {internals && internals.available && internals.items.length > 0 ? (
                    <>
                        <div className={styles.v9CrossRows}>
                            {internals.items.map(item => {
                                const check = confirmationBadge(
                                    signal.composite_score,
                                    item.tone,
                                    market === 'MY' && item.id === 'global_credit',
                                );
                                return (
                                    <div key={item.id} className={styles.v9CrossRow}>
                                        <div>
                                            <b>{item.name}</b>
                                            <small>{item.latestLabel} · {item.baselineLabel}</small>
                                        </div>
                                        <span className={styles.toneBadge} data-tone={check.tone}>{check.label}</span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className={styles.v9CrossAction}>
                            <button type="button" className={styles.textLink} onClick={onOpenContext}>
                                Inspect {internals.items.length} baseline charts ↓
                            </button>
                        </div>
                    </>
                ) : (
                    <p className={styles.v9FngFallback}>
                        {internalsLoading
                            ? 'Fetching cross-market confirmation series…'
                            : 'Cross-market reference feed is unavailable right now. Signal scoring is unaffected.'}
                    </p>
                )}

                {fng && fng.available && (
                    <div className={styles.v9OptionalCnn}>
                        <span>CNN Fear &amp; Greed (optional): <b>{fng.score}/100 · {formatRating(fng.rating)}</b></span>
                    </div>
                )}
            </section>
        </aside>
    );
}
