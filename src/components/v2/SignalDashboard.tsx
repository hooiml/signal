'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AppNav } from '@/components/AppNav';
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
    const [isThemeLoaded, setIsThemeLoaded] = useState(false);

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
        const timeoutId = window.setTimeout(() => {
            const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
            if (storedTheme === 'light' || storedTheme === 'dark') {
                setTheme(storedTheme);
            }
            setIsThemeLoaded(true);
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, []);

    useEffect(() => {
        if (!isThemeLoaded) return;
        document.documentElement.setAttribute('data-cockpit-theme', theme);
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }, [isThemeLoaded, theme]);

    if (!isLoaded) {
        return (
            <CockpitPageShell theme={theme}>
                <AppNav active="signal" tone={theme} />
                <CockpitSkeleton theme={theme} />
            </CockpitPageShell>
        );
    }

    const isUpdating = loading && Boolean(signalData);
    const themeClasses = getThemeClasses(theme);

    return (
        <CockpitPageShell theme={theme}>
            <AppNav active="signal" tone={theme} />

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

            {!signalData && loading && <CockpitSkeleton compact theme={theme} />}

            {!signalData && !loading && (
                <section className={`rounded-3xl border p-8 shadow-[0_20px_60px_rgba(2,6,23,0.16)] ${theme === 'light' ? 'border-rose-300 bg-rose-50 text-rose-950' : 'border-rose-500/25 bg-rose-500/10 text-slate-100'}`}>
                    <div className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${theme === 'light' ? 'text-rose-700' : 'text-rose-200'}`}>Signal unavailable</div>
                    <h2 className={`mt-3 text-3xl font-semibold ${themeClasses.textPrimary}`}>No signal is available right now</h2>
                    <p className={`mt-3 max-w-2xl text-base leading-7 ${themeClasses.textMuted}`}>
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

                    <SupportingContext signal={signalData} market={config.market} theme={theme} />
                </div>
            )}
            </div>
        </CockpitPageShell>
    );
};

const CockpitPageShell = ({ theme, children }: { theme: CockpitTheme; children: React.ReactNode }) => {
    const isLight = theme === 'light';
    const mainClass = isLight
        ? 'cockpit-page relative min-h-screen overflow-x-hidden bg-[#f8fafc] text-slate-950 selection:bg-sky-200 selection:text-slate-950'
        : 'cockpit-page relative min-h-screen overflow-x-hidden bg-[#0b1118] text-slate-100 selection:bg-emerald-300 selection:text-slate-950';
    const orbClass = isLight
        ? 'absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.11),_transparent_28%),radial-gradient(circle_at_80%_10%,_rgba(16,185,129,0.1),_transparent_20%)]'
        : 'absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_24%),radial-gradient(circle_at_80%_10%,_rgba(52,211,153,0.1),_transparent_18%)]';
    const gridClass = isLight
        ? 'absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:44px_44px] opacity-45'
        : 'absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.045)_1px,transparent_1px)] bg-[size:44px_44px] opacity-55';
    const topLineClass = isLight
        ? 'absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/60 to-transparent'
        : 'absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent';

    return (
        <main className={mainClass}>
            <div className={orbClass} />
            <div className={gridClass} />
            <div className={topLineClass} />
            <div className="relative z-10">{children}</div>
        </main>
    );
};

const CockpitSkeleton = ({ compact = false, theme }: { compact?: boolean; theme: CockpitTheme }) => {
    const blockClass = theme === 'light'
        ? 'animate-pulse rounded-3xl border border-slate-300 bg-white/85'
        : 'animate-pulse rounded-3xl border border-[#2a3948] bg-[#111a23]';

    return (
    <div className={compact ? 'space-y-6' : 'mx-auto max-w-7xl space-y-6 px-4 pb-20 pt-6 sm:px-6 lg:px-8'}>
        <div className={`h-24 ${blockClass}`} />
        <div className={`h-80 ${blockClass}`} />
        <div className="grid gap-4 lg:grid-cols-2">
            <div className={`h-64 ${blockClass}`} />
            <div className={`h-64 ${blockClass}`} />
        </div>
        <div className={`h-96 ${blockClass}`} />
    </div>
    );
};

