'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSignalConfig } from '@/hooks/use-signal-config';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { AppNavV6 } from './AppNavV6';
import { MarketBriefingV6 } from './MarketBriefingV6';
import { MarketCommandBarV6, type BriefingStatus } from './MarketCommandBarV6';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';
import { useThemeV6 } from './ThemeProviderV6';
import {
    currentProductAnalyticsWorkflowSource,
    trackProductAnalyticsEvent,
} from '@/lib/product-analytics-client';
import type { AppCommandV6 } from './CommandPaletteV6';
import { createTodayMarketContinuation } from '@/lib/research/since-last-visit';
import { writeTodayContinuation } from '@/lib/research/since-last-visit-client';
import { V7Shell } from '@/components/v7/foundation/V7Foundation';
import { MarketBriefingV7 } from '@/components/v7/MarketBriefingV7';
import liveStyles from '@/components/v7/v7-live.module.css';

const describeMarketConfiguration = (market: 'US' | 'MY', mode: 'standard' | 'contrarian', enableSocial: boolean) =>
    `${market === 'US' ? 'US' : 'Malaysia'} · ${mode === 'contrarian' ? 'Contrarian' : 'Momentum'} interpretation · sentiment ${enableSocial ? 'included' : 'excluded'}`;

const summarizeMarketUpdate = (previous: MarketSignal, next: MarketSignal) => {
    const changes: string[] = [];
    const scoreChange = Math.round((next.composite_score - previous.composite_score) * 10) / 10;
    if (scoreChange !== 0) changes.push(`Composite score ${scoreChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(scoreChange).toFixed(1)} points`);
    if (previous.tier !== next.tier) changes.push(`posture changed from ${previous.tier} to ${next.tier}`);
    const previousFreshness = previous.metadata.signal_quality?.freshness ?? 'unavailable';
    const nextFreshness = next.metadata.signal_quality?.freshness ?? 'unavailable';
    if (previousFreshness !== nextFreshness) changes.push(`freshness changed from ${previousFreshness} to ${nextFreshness}`);
    return changes.length > 0 ? `${changes.join('; ')}.` : 'The headline posture, score, and freshness are unchanged.';
};

export const MarketDashboardV6 = ({ presentation = 'v6' }: { readonly presentation?: 'v6' | 'v7' }) => {
    const searchParams = useSearchParams();
    const returnsToToday = searchParams.get('returnTo') === 'today';
    const { config, updateConfig, isLoaded } = useSignalConfig();
    const [signal, setSignal] = useState<MarketSignal | null>(null);
    const [signalEnableSocial, setSignalEnableSocial] = useState(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastAttemptedAt, setLastAttemptedAt] = useState<Date | null>(null);
    const [lastSuccessfulAt, setLastSuccessfulAt] = useState<Date | null>(null);
    const [updateCause, setUpdateCause] = useState<string | null>(null);
    const [lastUpdateCause, setLastUpdateCause] = useState<string | null>(null);
    const [updateSummary, setUpdateSummary] = useState<string | null>(null);
    const requestSequence = useRef(0);
    const activeRequest = useRef<AbortController | null>(null);
    const signalRef = useRef<MarketSignal | null>(null);
    const pendingConfigCause = useRef<string | null>(null);
    const { theme, toggleTheme } = useThemeV6();
    const themeClasses = getThemeV6(theme);

    const fetchSignal = useCallback(async (forceRefresh = false, requestedCause?: string) => {
        const requestId = ++requestSequence.current;
        const previousSignal = signalRef.current;
        const cause = previousSignal ? requestedCause ?? pendingConfigCause.current ?? 'the active configuration' : null;
        pendingConfigCause.current = null;
        activeRequest.current?.abort();
        const controller = new AbortController();
        activeRequest.current = controller;
        setLoading(true);
        setError(null);
        setUpdateCause(cause);
        setUpdateSummary(null);
        if (cause) setLastUpdateCause(cause);
        try {
            const query = new URLSearchParams({
                market: config.market,
                mode: config.mode,
                enableSocial: String(config.enableSocial),
            });
            if (forceRefresh) query.set('refresh', 'true');
            const response = await fetch('/api/signals/v2?' + query.toString(), {
                cache: 'no-store',
                signal: controller.signal,
            });
            const body = await response.json();
            if (!response.ok || !body.success) throw new Error(body.error || 'Failed to fetch signal');
            if (requestId !== requestSequence.current) return;
            const nextSignal = body.data as MarketSignal;
            setSignal(nextSignal);
            signalRef.current = nextSignal;
            setSignalEnableSocial(config.enableSocial);
            setLastSuccessfulAt(new Date());
            if (previousSignal && cause) {
                setUpdateSummary(`${describeMarketConfiguration(config.market, config.mode, config.enableSocial)}. ${summarizeMarketUpdate(previousSignal, nextSignal)}`);
            }
        } catch (requestError) {
            if (controller.signal.aborted || requestId !== requestSequence.current) return;
            setError(requestError instanceof Error ? requestError.message : 'Connection error. Please try again.');
        } finally {
            if (requestId === requestSequence.current) {
                setLastAttemptedAt(new Date());
                setLoading(false);
                setUpdateCause(null);
                activeRequest.current = null;
            }
        }
    }, [config.enableSocial, config.market, config.mode]);

    const changeConfiguration = useCallback((change: Parameters<typeof updateConfig>[0], cause: string) => {
        pendingConfigCause.current = cause;
        updateConfig(change);
    }, [updateConfig]);

    useEffect(() => {
        if (isLoaded) void fetchSignal();
        return () => {
            requestSequence.current += 1;
            activeRequest.current?.abort();
            activeRequest.current = null;
        };
    }, [fetchSignal, isLoaded]);

    useEffect(() => {
        trackProductAnalyticsEvent({
            name: 'workspace_viewed',
            surface: 'market',
            workspace: 'market_conditions',
        });
        if (currentProductAnalyticsWorkflowSource() === 'today') {
            trackProductAnalyticsEvent({
                name: 'workflow_source_opened',
                surface: 'market',
                workspace: 'market_conditions',
                source: 'today',
            });
        }
    }, []);

    useEffect(() => {
        if (!returnsToToday) return;
        writeTodayContinuation(createTodayMarketContinuation(new Date().toISOString()));
    }, [returnsToToday]);

    const atmosphere = theme === 'light'
        ? 'bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.11),_transparent_28%),radial-gradient(circle_at_80%_10%,_rgba(14,165,233,0.08),_transparent_20%)]'
        : 'bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_24%),radial-gradient(circle_at_80%_10%,_rgba(52,211,153,0.1),_transparent_18%)]';
    const grid = theme === 'light'
        ? 'bg-[linear-gradient(rgba(16,185,129,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.06)_1px,transparent_1px)] opacity-45'
        : 'bg-[linear-gradient(rgba(16,185,129,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.035)_1px,transparent_1px)] opacity-55';
    const updating = loading && signal !== null;
    const briefingStatus: BriefingStatus = !signal && loading
        ? 'loading'
        : signal && loading
            ? 'updating'
            : signal && error
                ? 'refresh-failed'
                : signal
                    ? 'available'
                    : 'unavailable';
    const marketCommands: readonly AppCommandV6[] = [
        { id: 'market-us', label: 'Use US market', group: 'Market', keywords: ['region'], run: () => changeConfiguration({ market: 'US' }, 'US market') },
        { id: 'market-my', label: 'Use Malaysia market', group: 'Market', keywords: ['region my'], run: () => changeConfiguration({ market: 'MY' }, 'Malaysia market') },
        { id: 'mode-momentum', label: 'Use Momentum mode', group: 'Market', keywords: ['standard'], run: () => changeConfiguration({ mode: 'standard' }, 'Momentum interpretation') },
        { id: 'mode-contrarian', label: 'Use Contrarian mode', group: 'Market', run: () => changeConfiguration({ mode: 'contrarian' }, 'Contrarian interpretation') },
        { id: 'source-toggle', label: config.enableSocial ? 'Exclude sentiment source' : 'Include sentiment source', group: 'Market', keywords: ['social news'], run: () => changeConfiguration({ enableSocial: !config.enableSocial }, config.enableSocial ? 'excluding the sentiment source' : 'including the sentiment source') },
        { id: 'refresh-market', label: 'Refresh market conditions', group: 'Market', keywords: ['reload'], run: () => void fetchSignal(true, 'manual refresh') },
    ];

    if (presentation === 'v7') {
        return (
            <V7Shell
                active="market"
                commands={marketCommands}
                controls={
                    <div className={liveStyles.marketControls}>
                        <MarketCommandBarV6
                            market={config.market}
                            mode={config.mode}
                            enableSocial={config.enableSocial}
                            onMarketChange={(market) => changeConfiguration({ market }, market === 'US' ? 'US market' : 'Malaysia market')}
                            onModeChange={(mode) => changeConfiguration({ mode }, mode === 'contrarian' ? 'Contrarian interpretation' : 'Momentum interpretation')}
                            onSocialToggle={(enableSocial) => changeConfiguration({ enableSocial }, enableSocial ? 'including the sentiment source' : 'excluding the sentiment source')}
                            isLoaded={isLoaded}
                            status={briefingStatus}
                            lastAttemptedAt={lastAttemptedAt}
                            lastSuccessfulAt={lastSuccessfulAt}
                            onRefresh={() => void fetchSignal(true, 'manual refresh')}
                            snapshotDate={signal?.metadata.score_delta?.snapshot_date ?? null}
                            sourceToggleImpact={signal?.metadata.counterfactuals?.source_toggle}
                            updateCause={updateCause}
                            theme={theme}
                            presentation="v7"
                        />
                    </div>
                }
                footer="Data sources · Methodology · Limitations"
                testId="market-v7"
            >
                <main className={liveStyles.marketPage}>
                    {returnsToToday ? (
                        <section data-testid="today-return-context" className={'mb-4 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between ' + themeClasses.panel}>
                            <div>
                                <p className={'text-xs font-bold uppercase tracking-[0.1em] ' + themeClasses.positive}>Opened from Today</p>
                                <p className={'mt-1 text-sm ' + themeClasses.textSecondary}>Market Conditions remains read-only context and does not change a ticker decision.</p>
                            </div>
                            <Link href="/research?workspace=today" prefetch={false} className={'inline-flex min-h-10 shrink-0 items-center justify-center rounded border px-4 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ' + themeClasses.selectedRow}>Back to Today</Link>
                        </section>
                    ) : null}
                    {!signal && loading ? <MarketSkeletonV7 /> : null}
                    {!signal && !loading ? (
                        <section className={'mt-4 rounded-lg border p-6 ' + themeClasses.panel}>
                            <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + themeClasses.risk}>Signal unavailable</p>
                            <h1 className={'mt-2 text-2xl font-bold ' + themeClasses.textPrimary}>Current market conditions are unavailable</h1>
                            <p className={'mt-2 max-w-2xl text-sm ' + themeClasses.textSecondary}>{error || 'Try another market, mode, or source configuration.'}</p>
                            <button type="button" onClick={() => void fetchSignal(true, 'retrying the failed load')} className="mt-5 min-h-10 rounded-md border border-emerald-500 px-4 text-sm font-bold text-emerald-600">Retry</button>
                        </section>
                    ) : null}
                    {signal ? <MarketBriefingV7 signal={signal} enableSocial={signalEnableSocial} theme={theme} updating={updating} refreshError={error} updateCause={updateCause} failedAction={lastUpdateCause} updateSummary={updateSummary} onRetry={() => void fetchSignal(true, 'retrying the failed update')} /> : null}
                </main>
            </V7Shell>
        );
    }

    return (
        <main className={'relative min-h-[100dvh] overflow-x-hidden transition-colors duration-300 ' + themeClasses.page}>
            <div className={'pointer-events-none absolute inset-0 transition-opacity duration-300 ' + atmosphere} />
            <div className={'pointer-events-none absolute inset-0 bg-[size:44px_44px] transition-opacity duration-300 ' + grid} />
            <div className="relative z-10">
                <AppNavV6 active="market" theme={theme} onThemeToggle={toggleTheme} commands={marketCommands}>
                    <MarketCommandBarV6
                        market={config.market}
                        mode={config.mode}
                        enableSocial={config.enableSocial}
                        onMarketChange={(market) => changeConfiguration({ market }, market === 'US' ? 'US market' : 'Malaysia market')}
                        onModeChange={(mode) => changeConfiguration({ mode }, mode === 'contrarian' ? 'Contrarian interpretation' : 'Momentum interpretation')}
                        onSocialToggle={(enableSocial) => changeConfiguration({ enableSocial }, enableSocial ? 'including the sentiment source' : 'excluding the sentiment source')}
                        isLoaded={isLoaded}
                        status={briefingStatus}
                        lastAttemptedAt={lastAttemptedAt}
                        lastSuccessfulAt={lastSuccessfulAt}
                        onRefresh={() => void fetchSignal(true, 'manual refresh')}
                        snapshotDate={signal?.metadata.score_delta?.snapshot_date ?? null}
                        sourceToggleImpact={signal?.metadata.counterfactuals?.source_toggle}
                        updateCause={updateCause}
                        theme={theme}
                    />
                </AppNavV6>
                <div className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-5 min-[700px]:px-5">
                    {returnsToToday ? (
                        <section data-testid="today-return-context" className={'mb-4 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between ' + themeClasses.panel}>
                            <div>
                                <p className={'text-xs font-bold uppercase tracking-[0.1em] ' + themeClasses.positive}>Opened from Today</p>
                                <p className={'mt-1 text-sm ' + themeClasses.textSecondary}>Market Conditions remains read-only context and does not change a ticker decision.</p>
                            </div>
                            <Link
                                href="/research?workspace=today"
                                prefetch={false}
                                className={'inline-flex min-h-10 shrink-0 items-center justify-center rounded border px-4 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ' + themeClasses.selectedRow}
                            >
                                Back to Today
                            </Link>
                        </section>
                    ) : null}
                    {!signal && loading ? <MarketSkeletonV6 theme={theme} /> : null}

                    {!signal && !loading ? (
                        <section className={'mt-4 rounded-lg border p-6 backdrop-blur-md ' + themeClasses.panel}>
                            <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + themeClasses.risk}>Signal unavailable</p>
                            <h1 className={'mt-2 text-2xl font-bold ' + themeClasses.textPrimary}>Current market conditions are unavailable</h1>
                            <p className={'mt-2 max-w-2xl text-sm ' + themeClasses.textSecondary}>{error || 'Try another market, mode, or source configuration.'}</p>
                            <button type="button" onClick={() => void fetchSignal(true, 'retrying the failed load')} className="mt-5 min-h-10 rounded-md border border-emerald-500 px-4 text-sm font-bold text-emerald-600 transition-colors hover:bg-emerald-500/10">Retry</button>
                        </section>
                    ) : null}

                    {signal ? (
                        <MarketBriefingV6
                            signal={signal}
                            enableSocial={signalEnableSocial}
                            theme={theme}
                            updating={updating}
                            refreshError={error}
                        />
                    ) : null}
                </div>
            </div>
        </main>
    );
};

export const MarketDashboardV7 = () => <MarketDashboardV6 presentation="v7" />;

const MarketSkeletonV6 = ({ theme }: { theme: ResearchThemeV6 }) => {
    const themeClasses = getThemeV6(theme);
    const block = 'motion-safe:animate-pulse rounded-lg border backdrop-blur-md ' + themeClasses.panel;
    return (
        <div className="mt-4 space-y-4" aria-label="Loading market conditions">
            <div className={'h-24 ' + block} />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[0, 1, 2, 3].map((item) => <div key={item} className={'h-28 ' + block} />)}
            </div>
            <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
                <div className={'h-80 ' + block} />
                <div className={'h-80 ' + block} />
            </div>
        </div>
    );
};

const MarketSkeletonV7 = () => (
    <div className={liveStyles.marketSkeleton} role="status" aria-label="Loading market conditions">
        <div className={liveStyles.marketSkeletonIntro}>
            <span /><span /><span />
        </div>
        <div className={liveStyles.marketSkeletonMetrics}>
            {[0, 1, 2].map((item) => <span key={item} />)}
        </div>
        <div className={liveStyles.marketSkeletonReading}>
            <span /><span /><span />
        </div>
        <span className="sr-only">Loading the first market reading and evidence handoff.</span>
    </div>
);
