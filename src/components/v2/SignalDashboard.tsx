'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSignalConfig } from '@/hooks/use-signal-config';
import { DashboardHeader } from './DashboardHeader';
import { HeroDecisionPanel } from './HeroDecisionPanel';
import { TrustChangeBand } from './TrustChangeBand';
import { EvidenceMatrix } from './EvidenceMatrix';
import { AnalysisCard } from './AnalysisCard';
import { ArticleList } from './ArticleList';
import { SupportingContext } from './SupportingContext';
import { MarketSignal } from '@/lib/types/signal-v2';
import { CockpitTheme, getThemeClasses } from './cockpit-utils';

const THEME_STORAGE_KEY = 'signal-dashboard-theme';

export const SignalDashboard = () => {
    const { config, updateConfig, isLoaded } = useSignalConfig();
    const [signalData, setSignalData] = useState<MarketSignal | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [theme, setTheme] = useState<CockpitTheme>('dark');

    const fetchSignal = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/signals/v2?market=${config.market}&mode=${config.mode}&enableSocial=${config.enableSocial}`);
            const json = await res.json();

            if (json.success) {
                setSignalData(json.data);
            } else {
                setError(json.error || 'Failed to fetch signal');
            }
        } catch {
            setError('Connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [config.market, config.mode, config.enableSocial]);

    useEffect(() => {
        if (isLoaded) {
            fetchSignal();
        }
    }, [isLoaded, fetchSignal]);

    useEffect(() => {
        const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (storedTheme === 'light' || storedTheme === 'dark') {
            setTheme(storedTheme);
        }
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute('data-cockpit-theme', theme);
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }, [theme]);

    if (!isLoaded) {
        return <CockpitSkeleton />;
    }

    const isUpdating = loading && Boolean(signalData);
    const themeClasses = getThemeClasses(theme);

    return (
        <div className={`cockpit-theme-scope mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8 ${themeClasses.pageText}`}>
            <DashboardHeader
                market={config.market}
                mode={config.mode}
                enableSocial={config.enableSocial}
                onMarketChange={(market) => updateConfig({ market })}
                onModeChange={(mode) => updateConfig({ mode })}
                onSocialToggle={(enableSocial) => updateConfig({ enableSocial })}
                isLoaded={isLoaded}
                isUpdating={isUpdating}
                snapshotDate={signalData?.metadata.score_delta?.snapshot_date || null}
                sourceToggleImpact={signalData?.metadata.counterfactuals?.source_toggle}
                theme={theme}
                onThemeToggle={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
            />

            {!signalData && loading && <CockpitSkeleton compact />}

            {!signalData && !loading && (
                <section className="rounded-3xl border border-rose-500/25 bg-rose-500/10 p-8 text-slate-100 shadow-[0_20px_60px_rgba(2,6,23,0.25)]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-200">Signal unavailable</div>
                    <h2 className="mt-3 text-3xl font-semibold text-white">No signal is available right now</h2>
                    <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
                        {error || 'The current market, mode, or source combination did not return a signal. Try refreshing or change the current settings.'}
                    </p>
                </section>
            )}

            {signalData && (
                <div className="space-y-6">
                    <HeroDecisionPanel
                        signal={signalData}
                        mode={config.mode}
                        isUpdating={isUpdating}
                        error={error && !loading ? `Showing the last available signal while refresh failed. ${error}` : null}
                        theme={theme}
                    />

                    <TrustChangeBand signal={signalData} theme={theme} />

                    <EvidenceMatrix signal={signalData} market={config.market} theme={theme} />

                    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                        <AnalysisCard
                            tier={signalData.tier}
                            mode={config.mode}
                            market={config.market}
                            reasoning={signalData.interpretation.reasoning}
                            confidence={signalData.confidence}
                            warnings={signalData.confidence.warning ? [signalData.confidence.warning] : []}
                            metadata={{
                                ...signalData.metadata,
                                composite_score: signalData.composite_score,
                            }}
                            theme={theme}
                        />

                        {signalData.metadata.articles && signalData.metadata.articles.length > 0 ? (
                            <ArticleList
                                articles={signalData.metadata.articles}
                                market={config.market}
                                compositeTier={signalData.tier}
                                theme={theme}
                            />
                        ) : null}
                    </div>

                    <SupportingContext signal={signalData} market={config.market} theme={theme} hasDevelopments={Boolean(signalData.metadata.articles && signalData.metadata.articles.length > 0)} />
                </div>
            )}
        </div>
    );
};

const CockpitSkeleton = ({ compact = false }: { compact?: boolean }) => (
    <div className={compact ? 'space-y-6' : 'mx-auto max-w-7xl space-y-6 px-4 pb-20 pt-6 sm:px-6 lg:px-8'}>
        <div className="h-24 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/70" />
        <div className="h-80 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/70" />
        <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-64 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/70" />
            <div className="h-64 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/70" />
        </div>
        <div className="h-96 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/70" />
    </div>
);

