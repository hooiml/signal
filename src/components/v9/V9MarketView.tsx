'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { getIndicatorBaseWeights } from '@/lib/indicator-registry';
import { MarketV81Hero } from '@/components/v8/MarketV81Hero';
import { MarketChart } from '@/components/v8/MarketV8Chart';
import { MarketIndicatorEvidence } from '@/components/v8/MarketIndicatorEvidence';
import { MarketContextSummary } from '@/components/v8/MarketV8ContextSummary';
import { overviewHistory } from '@/components/v8/MarketV8ConnectedData';
import type { Market, Mode, Point } from '@/components/v8/market-v8-fixtures';
import base from '@/components/v8/market-v8.module.css';
import styles from './v9-workspace.module.css';

const tierClasses: Record<MarketSignal['tier'], string> = {
    'strong-buy': base.tierStrongBuy,
    buy: base.tierBuy,
    neutral: base.tierNeutral,
    sell: base.tierSell,
    'strong-sell': base.tierStrongSell,
};

export function V9MarketView({
    market,
    mode,
    social,
    signal,
    loading,
    error,
    onMarketChange,
    onModeChange,
    onSocialChange,
    onReload,
}: {
    readonly market: Market;
    readonly mode: Mode;
    readonly social: boolean;
    readonly signal: MarketSignal | null;
    readonly loading: boolean;
    readonly error: string;
    readonly onMarketChange: (next: Market) => void;
    readonly onModeChange: (next: Mode) => void;
    readonly onSocialChange: (next: boolean) => void;
    readonly onReload: () => void;
}) {
    const [range, setRange] = useState('3M');
    const [selectedPoint, setSelectedPoint] = useState<Point | null>(null);
    const [focusedIndicator, setFocusedIndicator] = useState<string | null>(null);

    const configured = useMemo(
        () => getIndicatorBaseWeights(market, { highVolatilityOverride: market === 'US' && (signal?.components.vix?.value ?? 0) > 30 }),
        [market, signal],
    );
    const inputKeys = useMemo(
        () => [...new Set([...Object.keys(configured).filter(k => configured[k] > 0), ...Object.keys(signal?.components ?? {})])],
        [configured, signal],
    );
    const snapshotDate = signal?.metadata.score_delta?.snapshot_date ?? new Date().toISOString().slice(0, 10);
    const series = useMemo(() => (signal ? overviewHistory(signal) : []), [signal]);
    const chartPoints = useMemo(() => {
        if (range === 'All' || !series.length) return series;
        const latest = series.at(-1)?.date;
        if (!latest) return series;
        const cutoff = new Date(`${latest}T00:00:00Z`);
        cutoff.setUTCMonth(cutoff.getUTCMonth() - (range === '1M' ? 1 : 3));
        return series.filter(point => Date.parse(point.date) >= cutoff.getTime());
    }, [range, series]);
    const activePoint = selectedPoint ?? chartPoints.at(-1) ?? null;

    const fullMarketHref = `/main-v8?market=${market}&mode=${mode}&enableSocial=${social}`;
    const focusedItem = focusedIndicator && signal ? signal.components[focusedIndicator] : null;

    return (
        <div className={base.tokens} style={{ display: 'grid', gap: 18 }}>
            <div className={styles.marketToolbar}>
                <div className={styles.marketControlGroup}>
                    <div className={styles.segWrap} role="group" aria-label="Select market">
                        <button type="button" className={styles.segBtn} aria-pressed={market === 'US'} onClick={() => onMarketChange('US')}>US Market</button>
                        <button type="button" className={styles.segBtn} aria-pressed={market === 'MY'} onClick={() => onMarketChange('MY')}>Malaysia · Bursa</button>
                    </div>
                    <div className={styles.segWrap} role="group" aria-label="Interpretation lens">
                        <button type="button" className={styles.segBtn} aria-pressed={mode === 'standard'} onClick={() => onModeChange('standard')}>Momentum</button>
                        <button type="button" className={styles.segBtn} aria-pressed={mode === 'contrarian'} onClick={() => onModeChange('contrarian')}>Contrarian</button>
                    </div>
                    <label className={base.sourceToggle}>
                        <input type="checkbox" checked={social} onChange={e => onSocialChange(e.target.checked)} />
                        <span>{market === 'MY' ? 'Include news in score' : 'Include social in score'}</span>
                    </label>
                </div>
                <div className={styles.marketControlGroup}>
                    <button type="button" className={styles.ghostBtn} onClick={onReload} disabled={loading}>
                        {loading ? 'Refreshing…' : 'Reload data'}
                    </button>
                    <Link className={styles.ghostBtn} href={fullMarketHref}>Full V8 Market →</Link>
                </div>
            </div>

            {error && (
                <div className={styles.card} role="alert">
                    <strong>Live market signal unavailable</strong>
                    <p style={{ margin: '6px 0 12px', color: 'var(--muted)' }}>{error}</p>
                    <button type="button" className={styles.primaryBtn} onClick={onReload}>Retry</button>
                </div>
            )}

            {!signal && loading && (
                <div className={styles.card} role="status">
                    Loading {market === 'MY' ? 'Malaysia · Bursa' : 'United States'} market signal…
                </div>
            )}

            {signal && (
                <>
                    <MarketV81Hero
                        signal={signal}
                        snapshotDate={snapshotDate}
                        tierClass={tierClasses[signal.tier]}
                        onSelect={key => setFocusedIndicator(key)}
                        onDrivers={() => window.location.assign(`${fullMarketHref}#drivers-title`)}
                        onEvidence={() => window.location.assign(`${fullMarketHref}#score-evidence-title`)}
                    />

                    {focusedItem && (
                        <div className={styles.card} aria-live="polite">
                            <div className={styles.sectionHead}>
                                <div>
                                    <h2>{focusedItem.display_name}</h2>
                                    <p>
                                        Score {focusedItem.score.toFixed(1)}/100 · Weight {(focusedItem.weight * 100).toFixed(0)}% ·
                                        Observed {focusedItem.last_updated || 'date unavailable'}
                                    </p>
                                </div>
                                <button type="button" className={styles.ghostBtn} onClick={() => setFocusedIndicator(null)}>Close detail</button>
                            </div>
                            <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
                                Raw reading: <strong>{focusedItem.value ?? 'Unavailable'}</strong>
                                {focusedItem.metadata?.unit ? ` ${focusedItem.metadata.unit}` : ''} · Signal: <strong>{focusedItem.signal}</strong>
                            </p>
                        </div>
                    )}

                    <div className={styles.marketGrid}>
                        <div className={styles.researchStack}>
                            <div className={styles.card}>
                                <div className={styles.sectionHead}>
                                    <div>
                                        <h2>Market condition score</h2>
                                        <p>{activePoint ? `${activePoint.date} · ${activePoint.value.toFixed(0)}/100` : 'Recent score history'}</p>
                                    </div>
                                    <div className={styles.segWrap}>
                                        {(['1M', '3M', 'All'] as const).map(item => (
                                            <button key={item} type="button" className={styles.segBtn} aria-pressed={range === item} onClick={() => setRange(item)}>{item}</button>
                                        ))}
                                    </div>
                                </div>
                                {chartPoints.length > 0 ? (
                                    <MarketChart
                                        points={chartPoints}
                                        selectedDate={activePoint?.date}
                                        onSelect={point => setSelectedPoint(point)}
                                        sourced
                                        replayAvailable={false}
                                    />
                                ) : (
                                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>No historical observations supplied for this reading.</p>
                                )}
                            </div>
                            <MarketContextSummary
                                signal={signal}
                                onExplore={() => window.location.assign(`${fullMarketHref}#market-context-title`)}
                            />
                        </div>

                        <MarketIndicatorEvidence
                            signal={signal}
                            inputKeys={inputKeys}
                            configured={configured}
                            date={snapshotDate}
                            sourceEnabled={social}
                            onSelect={key => setFocusedIndicator(key)}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
