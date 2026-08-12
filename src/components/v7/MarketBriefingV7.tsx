'use client';

import type { MarketSignal } from '@/lib/types/signal-v2';
import { MarketBriefingV6 } from '@/components/v6/MarketBriefingV6';
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
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export const MarketBriefingV7 = ({ signal, enableSocial, theme, updating, refreshError }: MarketBriefingV7Props) => {
    const posture = getDecisionPostureV6(signal);
    const drivers = getRankedDriversV6(signal);
    const support = drivers.find((driver) => driver.support === 'supports' && !driver.conflict) ?? drivers.find((driver) => !driver.conflict) ?? drivers[0];
    const conflict = drivers.find((driver) => driver.conflict) ?? drivers.find((driver) => driver.directionalInfluence < 0);
    const quality = signal.metadata.signal_quality;
    const scenarios = getScenariosV6(signal);
    const delta = signal.metadata.score_delta?.delta;
    const activeIndicators = Object.values(signal.components).filter((component) => component.enabled).length;
    const availableIndicators = drivers.filter((driver) => Number.isFinite(driver.score)).length;

    return (
        <div className={liveStyles.marketLive} aria-busy={updating}>
            {refreshError ? (
                <div role="status" className={liveStyles.refreshNotice}>
                    Showing the previous market conditions while the latest refresh is unavailable: {refreshError}
                </div>
            ) : null}

            <section className={styles.marketIntro} aria-labelledby="market-posture-v7">
                <div className={styles.interpretation}>
                    <p className={styles.eyebrow}>Market conditions · {signal.metadata.market}</p>
                    <h1 id="market-posture-v7">{posture.headline}</h1>
                    <p>{posture.summary}</p>
                </div>
                <div className={styles.marketMeta}>
                    <strong><span className={styles.statusDot} /> {updating ? 'Updating conditions' : 'Conditions available'}</strong>
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

            <section className={styles.attention} aria-labelledby="market-evidence-v7">
                <div className={styles.sectionHeading}>
                    <div><p className={styles.eyebrow}>First reading</p><h2 id="market-evidence-v7">What deserves attention now</h2></div>
                </div>
                <div className={styles.attentionGrid}>
                    <div className={styles.attentionItem} data-tone="support">
                        <span>Strongest support</span><strong>{support?.name ?? 'Support unavailable'}</strong><p>{support?.detail ?? 'No active supporting driver is available for this snapshot.'}</p>
                    </div>
                    <div className={styles.attentionItem} data-tone="risk">
                        <span>Strongest conflict</span><strong>{conflict?.name ?? 'No material conflict'}</strong><p>{conflict?.detail ?? 'The current inputs do not expose a material conflicting driver.'}</p>
                    </div>
                    <div className={styles.attentionItem} data-tone={quality?.freshness === 'fresh' ? 'support' : 'caution'}>
                        <span>Freshness and next change</span><strong>{capitalize(quality?.freshness ?? 'Unavailable')} evidence</strong><p>{scenarios[0]?.title ?? quality?.confidence_explanation ?? 'No next-change scenario is available.'}</p>
                    </div>
                </div>
            </section>

            <div className={liveStyles.marketDetails}>
                <MarketBriefingV6 signal={signal} enableSocial={enableSocial} theme={theme} updating={updating} refreshError={null} hideStory />
            </div>
        </div>
    );
};
