'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { getReadLimitations } from '@/components/v2/cockpit-utils';
import { MarketBriefingV6 } from '@/components/v6/MarketBriefingV6';
import { MarketToResearchLinkV6 } from '@/components/v6/MarketResearchHandoffV6';
import { ScoreHistoryV6 } from '@/components/v6/ScoreHistoryV6';
import { formatCompactDateV6, getDecisionPostureV6, getRankedDriversV6, getScenariosV6 } from '@/components/v6/market-v6';
import type { ResearchThemeV6 } from '@/components/v6/research-v6';
import styles from './v7-prototype.module.css';
import liveStyles from './v7-live.module.css';

type MarketBriefingV7Props = {
    readonly signal: MarketSignal;
    readonly enableSocial: boolean;
    readonly theme: ResearchThemeV6;
    readonly updating: boolean;
    readonly refreshError: string | null;
    readonly updateCause: string | null;
    readonly failedAction: string | null;
    readonly updateSummary: string | null;
    readonly onRetry: () => void;
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const advancedEvidenceStorageKey = 'signal-v7-market-advanced-evidence-v1';
const evidenceTargets = new Set(['drivers-title', 'market-trust-limitations']);

type MarketEvidenceHistoryState = {
    readonly signalV7MarketEvidence?: string;
    readonly signalV7MarketReturn?: {
        readonly scrollY: number;
        readonly advancedOpen: boolean;
        readonly focusId?: string;
    };
};

export const MarketBriefingV7 = ({ signal, enableSocial, theme, updating, refreshError, updateCause, failedAction, updateSummary, onRetry }: MarketBriefingV7Props) => {
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const advancedRef = useRef<HTMLDetailsElement>(null);
    const posture = getDecisionPostureV6(signal);
    const drivers = getRankedDriversV6(signal);
    const support = drivers.find((driver) => driver.support === 'supports' && !driver.conflict) ?? drivers.find((driver) => !driver.conflict) ?? drivers[0];
    const conflict = drivers.find((driver) => driver.conflict) ?? drivers.find((driver) => driver.directionalInfluence < 0);
    const quality = signal.metadata.signal_quality;
    const scenarios = getScenariosV6(signal);
    const delta = signal.metadata.score_delta?.delta;
    const activeIndicators = Object.values(signal.components).filter((component) => component.enabled).length;
    const availableIndicators = drivers.filter((driver) => Number.isFinite(driver.score)).length;
    const primaryCaveat = getReadLimitations(signal)[0]
        ?? conflict?.detail
        ?? 'The score is one decision-support input and not a complete investment thesis.';

    const focusEvidence = useCallback((targetId: string) => {
        setAdvancedOpen(true);
        window.requestAnimationFrame(() => {
            const target = document.getElementById(targetId);
            if (!target) return;
            const nestedDisclosure = target.closest('details');
            if (nestedDisclosure && nestedDisclosure !== advancedRef.current) nestedDisclosure.open = true;
            if (!target.matches('summary, button, a, input, select, textarea')) target.tabIndex = -1;
            target.focus({ preventScroll: true });
            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
        });
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            try {
                setAdvancedOpen(window.localStorage.getItem(advancedEvidenceStorageKey) === 'open');
            } catch {
                setAdvancedOpen(false);
            }
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        const restoreHistory = (event: PopStateEvent) => {
            const state = (event.state ?? {}) as MarketEvidenceHistoryState;
            if (state.signalV7MarketEvidence && evidenceTargets.has(state.signalV7MarketEvidence)) {
                focusEvidence(state.signalV7MarketEvidence);
                return;
            }
            if (!state.signalV7MarketReturn) return;
            const returnState = state.signalV7MarketReturn;
            setAdvancedOpen(returnState.advancedOpen);
            window.requestAnimationFrame(() => {
                window.scrollTo({ top: returnState.scrollY, behavior: 'auto' });
                const returnTarget = returnState.focusId ? document.getElementById(returnState.focusId) : null;
                if (returnTarget instanceof HTMLElement) returnTarget.focus({ preventScroll: true });
            });
        };
        window.addEventListener('popstate', restoreHistory);
        const initialTarget = window.location.hash.slice(1);
        const timer = window.setTimeout(() => {
            if (evidenceTargets.has(initialTarget)) focusEvidence(initialTarget);
        }, 0);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('popstate', restoreHistory);
        };
    }, [focusEvidence]);

    const inspectEvidence = (event: MouseEvent<HTMLAnchorElement>, targetId: string) => {
        event.preventDefault();
        const currentState = typeof window.history.state === 'object' && window.history.state !== null
            ? window.history.state as Record<string, unknown>
            : {};
        const returnState: MarketEvidenceHistoryState & Record<string, unknown> = {
            ...currentState,
            signalV7MarketEvidence: undefined,
            signalV7MarketReturn: { scrollY: window.scrollY, advancedOpen, focusId: event.currentTarget.id || undefined },
        };
        window.history.replaceState(returnState, '', window.location.href);
        const nextUrl = new URL(window.location.href);
        nextUrl.hash = targetId;
        window.history.pushState({ ...returnState, signalV7MarketEvidence: targetId }, '', nextUrl);
        focusEvidence(targetId);
    };

    const persistAdvancedState = (open: boolean) => {
        setAdvancedOpen(open);
        try {
            window.localStorage.setItem(advancedEvidenceStorageKey, open ? 'open' : 'closed');
        } catch {
            // The disclosure remains usable when browser storage is unavailable.
        }
    };

    return (
        <div className={liveStyles.marketLive} aria-busy={updating}>
            {refreshError ? (
                <div role="alert" className={liveStyles.refreshNotice}>
                    <span>Previous market conditions remain visible. The update{failedAction ? ` for ${failedAction}` : ''} failed: {refreshError}</span>
                    <button type="button" onClick={onRetry}>Retry</button>
                </div>
            ) : null}
            {!refreshError && updating ? <div role="status" className={liveStyles.updateNotice}>Updating for {updateCause ?? 'the active configuration'}. Previous market conditions remain visible.</div> : null}
            {!refreshError && !updating && updateSummary ? <div role="status" className={liveStyles.updateNotice}><strong>Active configuration</strong> · {updateSummary}</div> : null}

            <section className={styles.marketIntro} aria-labelledby="market-posture-v7">
                <div className={styles.interpretation}>
                    <p className={styles.eyebrow}>Market conditions · {signal.metadata.market}</p>
                    <h1 id="market-posture-v7">{posture.headline}</h1>
                    <p>{posture.summary}</p>
                </div>
                <div className={styles.marketMeta}>
                    <strong><span className={styles.statusDot} /> {updating ? `Updating for ${updateCause ?? 'the active configuration'}` : 'Conditions available'}</strong>
                    <span>Conditions date · {formatCompactDateV6(signal.metadata.score_delta?.snapshot_date)}</span>
                    <span>{signal.mode === 'contrarian' ? 'Contrarian interpretation' : 'Momentum interpretation'} · {enableSocial ? 'social source on' : 'social source off'}</span>
                    <span>Decision support, not a forecast</span>
                </div>
            </section>

            <section className={styles.metrics} aria-label="Market orientation metrics">
                <div className={`${styles.metric} ${styles.metricPrimary}`}>
                    <span>Composite score</span>
                    <strong>{Math.round(signal.composite_score)} / 100</strong>
                    <small>{typeof delta === 'number' ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)} from the prior snapshot` : 'Prior comparison unavailable'}</small>
                </div>
                <div className={styles.metric}>
                    <span>Signal alignment</span>
                    <strong>{Math.round(signal.confidence.agreement_pct)}%</strong>
                    <small>{signal.confidence.conflicting_indicators.length} conflicting indicator{signal.confidence.conflicting_indicators.length === 1 ? '' : 's'}</small>
                </div>
                <div className={styles.metric}>
                    <span>Inputs available</span>
                    <strong>{availableIndicators} / {activeIndicators}</strong>
                    <small>{capitalize(quality?.freshness ?? 'unavailable')} freshness · {capitalize(quality?.source_coverage ?? 'unavailable')} coverage</small>
                </div>
            </section>

            <div className={liveStyles.marketFirstReadingGrid} data-testid="market-first-reading">
                <div className={styles.chartPanel} data-surface-tier="primary">
                    <ScoreHistoryV6 signal={signal} theme={theme} interactive />
                </div>
                <section className={styles.attention} aria-labelledby="market-evidence-v7">
                    <div className={styles.sectionHeading}>
                        <div><p className={styles.eyebrow}>First reading</p><h2 id="market-evidence-v7">What deserves attention now</h2></div>
                    </div>
                    <div className={styles.attentionGrid}>
                        <a id="market-support-inspection" href="#drivers-title" onClick={(event) => inspectEvidence(event, 'drivers-title')} className={styles.attentionItem} data-tone="support">
                            <span>Strongest support · Inspect evidence</span><strong>{support?.name ?? 'Support unavailable'}</strong><p>{support?.detail ?? 'No active supporting driver is available for this snapshot.'}</p>
                        </a>
                        <a id="market-conflict-inspection" href="#drivers-title" onClick={(event) => inspectEvidence(event, 'drivers-title')} className={styles.attentionItem} data-tone="risk">
                            <span>Strongest conflict · Inspect evidence</span><strong>{conflict?.name ?? 'No material conflict'}</strong><p>{conflict?.detail ?? 'The current inputs do not expose a material conflicting driver.'}</p>
                        </a>
                        <a id="market-freshness-inspection" href="#market-trust-limitations" onClick={(event) => inspectEvidence(event, 'market-trust-limitations')} className={styles.attentionItem} data-tone={quality?.freshness === 'fresh' ? 'support' : 'caution'}>
                            <span>Freshness concern · Inspect evidence</span><strong>{capitalize(quality?.freshness ?? 'Unavailable')} evidence</strong><p>{scenarios[0]?.title ?? quality?.confidence_explanation ?? 'No next-change scenario is available.'}</p>
                        </a>
                    </div>
                    <p className={liveStyles.primaryCaveat}><strong>Primary caveat</strong> · {primaryCaveat}</p>
                </section>
            </div>

            <div className="mt-6">
                <MarketToResearchLinkV6 signal={signal} theme={theme} />
            </div>

            <details
                ref={advancedRef}
                open={advancedOpen}
                onToggle={(event) => persistAdvancedState(event.currentTarget.open)}
                className={liveStyles.advancedEvidence}
                data-testid="market-advanced-evidence"
            >
                <summary>
                    <span><strong>Advanced evidence</strong><small>Contribution drivers, calibration, outcomes, secondary context, glossary, limitations, and methodology</small></span>
                    <span aria-hidden="true">{advancedOpen ? '−' : '+'}</span>
                </summary>
                <div className={liveStyles.marketDetails}>
                    <MarketBriefingV6 signal={signal} enableSocial={enableSocial} theme={theme} updating={updating} refreshError={null} hideStory hideResearchHandoff hideScoreHistory />
                </div>
            </details>
        </div>
    );
};
