'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSignalConfig } from '@/hooks/use-signal-config';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { DashboardHeaderV2 } from '@/components/v2/DashboardHeaderV2';
import { AppNavV6 } from './AppNavV6';
import { MarketBriefingV6 } from './MarketBriefingV6';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';
import { useThemeV6 } from './ThemeProviderV6';

export const MarketDashboardV6 = () => {
    const { config, updateConfig, isLoaded } = useSignalConfig();
    const [signal, setSignal] = useState<MarketSignal | null>(null);
    const [signalEnableSocial, setSignalEnableSocial] = useState(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
    const requestSequence = useRef(0);
    const activeRequest = useRef<AbortController | null>(null);
    const { theme, toggleTheme } = useThemeV6();
    const themeClasses = getThemeV6(theme);

    const fetchSignal = useCallback(async () => {
        const requestId = ++requestSequence.current;
        activeRequest.current?.abort();
        const controller = new AbortController();
        activeRequest.current = controller;
        setLoading(true);
        setError(null);
        try {
            const query = new URLSearchParams({
                market: config.market,
                mode: config.mode,
                enableSocial: String(config.enableSocial),
            });
            const response = await fetch('/api/signals/v2?' + query.toString(), {
                cache: 'no-store',
                signal: controller.signal,
            });
            const body = await response.json();
            if (!response.ok || !body.success) throw new Error(body.error || 'Failed to fetch signal');
            if (requestId !== requestSequence.current) return;
            setSignal(body.data);
            setSignalEnableSocial(config.enableSocial);
            setLastCheckedAt(new Date());
        } catch (requestError) {
            if (controller.signal.aborted || requestId !== requestSequence.current) return;
            setError(requestError instanceof Error ? requestError.message : 'Connection error. Please try again.');
        } finally {
            if (requestId === requestSequence.current) {
                setLoading(false);
                activeRequest.current = null;
            }
        }
    }, [config.enableSocial, config.market, config.mode]);

    useEffect(() => {
        if (isLoaded) void fetchSignal();
        return () => {
            requestSequence.current += 1;
            activeRequest.current?.abort();
            activeRequest.current = null;
        };
    }, [fetchSignal, isLoaded]);

    const atmosphere = theme === 'light'
        ? 'bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.11),_transparent_28%),radial-gradient(circle_at_80%_10%,_rgba(14,165,233,0.08),_transparent_20%)]'
        : 'bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_24%),radial-gradient(circle_at_80%_10%,_rgba(52,211,153,0.1),_transparent_18%)]';
    const grid = theme === 'light'
        ? 'bg-[linear-gradient(rgba(16,185,129,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.06)_1px,transparent_1px)] opacity-45'
        : 'bg-[linear-gradient(rgba(16,185,129,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.035)_1px,transparent_1px)] opacity-55';
    const updating = loading && signal !== null;

    return (
        <main className={'relative min-h-[100dvh] overflow-x-hidden transition-colors duration-300 ' + themeClasses.page}>
            <div className={'pointer-events-none absolute inset-0 transition-opacity duration-300 ' + atmosphere} />
            <div className={'pointer-events-none absolute inset-0 bg-[size:44px_44px] transition-opacity duration-300 ' + grid} />
            <div className="relative z-10">
                <AppNavV6 active="market" theme={theme} />
                <div className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-5 min-[700px]:px-5">
                    <DashboardHeaderV2
                        market={config.market}
                        mode={config.mode}
                        enableSocial={config.enableSocial}
                        onMarketChange={(market) => updateConfig({ market })}
                        onModeChange={(mode) => updateConfig({ mode })}
                        onSocialToggle={(enableSocial) => updateConfig({ enableSocial })}
                        isLoaded={isLoaded}
                        isUpdating={loading}
                        lastCheckedAt={lastCheckedAt}
                        onRefresh={() => void fetchSignal()}
                        snapshotDate={signal?.metadata.score_delta?.snapshot_date ?? null}
                        sourceToggleImpact={signal?.metadata.counterfactuals?.source_toggle}
                        theme={theme}
                        onThemeToggle={toggleTheme}
                    />

                    {!signal && loading ? <MarketSkeletonV6 theme={theme} /> : null}

                    {!signal && !loading ? (
                        <section className={'mt-4 rounded-lg border p-6 backdrop-blur-md ' + themeClasses.panel}>
                            <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + themeClasses.risk}>Signal unavailable</p>
                            <h1 className={'mt-2 text-2xl font-bold ' + themeClasses.textPrimary}>No current market briefing is available</h1>
                            <p className={'mt-2 max-w-2xl text-sm ' + themeClasses.textSecondary}>{error || 'Try another market, mode, or source configuration.'}</p>
                            <button type="button" onClick={() => void fetchSignal()} className="mt-5 min-h-10 rounded-md border border-emerald-500 px-4 text-sm font-bold text-emerald-600 transition-colors hover:bg-emerald-500/10">Retry</button>
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

const MarketSkeletonV6 = ({ theme }: { theme: ResearchThemeV6 }) => {
    const themeClasses = getThemeV6(theme);
    const block = 'animate-pulse rounded-lg border backdrop-blur-md ' + themeClasses.panel;
    return (
        <div className="mt-4 space-y-4" aria-label="Loading market briefing">
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
