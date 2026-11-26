'use client';

import { useEffect, useState } from 'react';
import type { MarketInternalsPayload } from '@/app/api/signals/internals/route';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { EmbeddedMarketView } from '@/components/v8/MarketV8Connected';
import { marketSourceToggleStatus } from '@/components/v8/MarketV8ConnectedData';
import type { MarketExposureWorkspace } from '@/components/v8/MarketV8Exposure';
import type { Market, Mode } from '@/components/v8/market-v8-fixtures';
import { V9MarketTodayPanel } from './V9MarketToday';
import { V9CrossMarketStrip, V9MarketSummaryRail } from './V9MarketSummaryRail';
import { V9FearGreedCard } from './V9FearGreedCard';
import { V9MarketInternalsGrid } from './V9MarketInternals';
import { V9MarketCompareStrip } from './V9MarketCompareStrip';
import type { SignalSlot } from './V9HomeView';
import type { V9MarketTodayState } from './useV9MarketToday';
import { V9SegmentedPill } from './V9Primitives';
import styles from './v9-workspace.module.css';

export function V9MarketView({
    market,
    today,
    mode,
    social,
    signal,
    usSlot,
    mySlot,
    loading,
    error,
    receivedAt,
    isDark,
    exposureWorkspace,
    onMarketChange,
    onModeChange,
    onSocialChange,
    onReload,
}: {
    readonly market: Market;
    readonly today: V9MarketTodayState;
    readonly mode: Mode;
    readonly social: boolean;
    readonly signal: MarketSignal | null;
    readonly usSlot?: SignalSlot;
    readonly mySlot?: SignalSlot;
    readonly loading: boolean;
    readonly error: string;
    readonly receivedAt?: string;
    readonly isDark?: boolean;
    readonly exposureWorkspace?: MarketExposureWorkspace;
    readonly onMarketChange: (next: Market) => void;
    readonly onModeChange: (next: Mode) => void;
    readonly onSocialChange: (next: boolean) => void;
    readonly onReload: () => void;
}) {
    const [compareOpen, setCompareOpen] = useState(false);
    const [internalsByMarket, setInternalsByMarket] = useState<Partial<Record<Market, MarketInternalsPayload>>>({});
    const currentInternals = internalsByMarket[market] ?? null;
    const internalsLoading = currentInternals === null;

    useEffect(() => {
        if (currentInternals) return;
        const controller = new AbortController();
        void (async () => {
            try {
                const res = await fetch(`/api/signals/internals?market=${market}`, { signal: controller.signal });
                if (!res.ok) throw new Error('Request failed');
                const body = (await res.json()) as { data?: MarketInternalsPayload };
                if (!controller.signal.aborted) {
                    setInternalsByMarket(prev => ({
                        ...prev,
                        [market]: body?.data ?? { market, available: false, updatedAt: null, items: [] },
                    }));
                }
            } catch {
                if (!controller.signal.aborted) {
                    setInternalsByMarket(prev => ({
                        ...prev,
                        [market]: { market, available: false, updatedAt: null, items: [] },
                    }));
                }
            }
        })();
        return () => controller.abort();
    }, [currentInternals, market]);

    return <>
        {compareOpen && usSlot && mySlot && (
            <V9MarketCompareStrip
                market={market}
                mode={mode}
                social={social}
                usSlot={usSlot}
                mySlot={mySlot}
                onSelectMarket={next => { onMarketChange(next); }}
                onSelectMode={next => { onModeChange(next); }}
                onClose={() => setCompareOpen(false)}
            />
        )}
        <EmbeddedMarketView
        config={{ market, mode, enableSocial: social }}
        signal={signal}
        loading={loading}
        error={error}
        receivedAt={receivedAt}
        isDark={isDark}
        exposureWorkspace={exposureWorkspace}
        todayPanel={<V9MarketTodayPanel market={market} state={today} />}
        onReload={onReload}
        renderSummaryRail={({ signal: railSignal, referenceDate, comparisonNotice, onOpenDrivers, onOpenToday, onOpenScenarios }) => (
            <V9MarketSummaryRail
                market={market}
                mode={mode}
                social={social}
                signal={railSignal}
                referenceDate={referenceDate}
                comparisonNotice={comparisonNotice}
                onOpenDrivers={onOpenDrivers}
                onOpenToday={onOpenToday}
                onOpenScenarios={onOpenScenarios}
            />
        )}
        renderSecondaryRail={() => <V9FearGreedCard />}
        renderBelowTopStage={({ signal: stageSignal, onOpenContext }) => (
            <V9CrossMarketStrip
                market={market}
                signalScore={stageSignal.composite_score}
                internals={currentInternals}
                internalsLoading={internalsLoading}
                onOpenContext={onOpenContext}
            />
        )}
        renderContextExtra={() => (
            <V9MarketInternalsGrid
                market={market}
                signalScore={signal?.composite_score ?? null}
                internals={currentInternals}
                loading={internalsLoading}
            />
        )}
        renderToolbar={(advanced, toggleAdvanced) => (
            <div className={styles.marketToolbar}>
                <div className={styles.marketControlGroup}>
                    <V9SegmentedPill
                        ariaLabel="Select market"
                        value={market}
                        onChange={onMarketChange}
                        options={[
                            { value: 'US', label: 'US Market' },
                            { value: 'MY', label: 'Malaysia · Bursa' },
                        ]}
                    />
                    <V9SegmentedPill
                        ariaLabel="Interpretation lens"
                        value={mode}
                        onChange={onModeChange}
                        options={[
                            { value: 'standard', label: 'Momentum' },
                            { value: 'contrarian', label: 'Contrarian' },
                        ]}
                    />
                    <span className={styles.v9ToggleWithStatus}>
                        <label className={styles.v9LiquidSwitch} data-checked={social ? 'true' : 'false'}>
                            <input type="checkbox" className={styles.v9LiquidInput} checked={social} onChange={event => onSocialChange(event.target.checked)} />
                            <span className={styles.v9LiquidTrack} aria-hidden="true">
                                <span className={styles.v9LiquidThumb} />
                            </span>
                            <span className={styles.v9LiquidLabel}>{market === 'MY' ? 'Include news in score' : 'Include social in score'}</span>
                        </label>
                        {social && !loading && signal && (market === 'US' ? !signal.components.social : !signal.components.news) && (
                            <span className={styles.v9MissingToolbarPill}>unavailable</span>
                        )}
                    </span>
                    <details>
                        <summary>About these settings</summary>
                        <p>{mode === 'standard' ? 'Momentum reads higher scores as stronger trend confirmation.' : 'Contrarian reads higher scores as crowding risk and lower scores as potential opportunity.'}</p>
                        <p>{marketSourceToggleStatus(market, social, signal, loading, error)}</p>
                    </details>
                </div>
                <div className={styles.marketControlGroup}>
                    {usSlot && mySlot && (
                        <button
                            type="button"
                            className={styles.ghostBtn}
                            aria-expanded={compareOpen}
                            aria-pressed={compareOpen}
                            onClick={() => setCompareOpen(value => !value)}
                        >
                            Compare
                        </button>
                    )}
                    <button type="button" className={styles.ghostBtn} aria-pressed={advanced} onClick={toggleAdvanced}>Advanced Market</button>
                    <button type="button" className={styles.ghostBtn} onClick={onReload} disabled={loading}>
                        {loading ? 'Refreshing…' : 'Reload data'}
                    </button>
                </div>
            </div>
        )}
    />
    </>;
}
