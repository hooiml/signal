'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSignalConfig } from '@/hooks/use-signal-config';
import type { MarketSignal } from '@/lib/types/signal-v2';
import {
    TopAppBarV5,
    ShellV5,
    isMarketSignal,
    formatSignedV5,
    formatSnapshotTimeV5,
    ChevronIcon,
} from './v5-shared';
import { Sparkline } from './Sparkline';
import { EvidenceTable } from './EvidenceTable';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const getSafeArticleUrlV5 = (value?: string | null): string | null => {
    if (!value) return null;
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
    } catch {
        return null;
    }
};

export const MarketDashboardV5 = () => {
    const { config, updateConfig, isLoaded } = useSignalConfig();
    const [signalData, setSignalData] = useState<MarketSignal | null>(null);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const lastFetchAt = useRef<number>(0);

    // Collapsible Settings Accordion State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Progressive Disclosure Tab State
    const [activeTab, setActiveTab] = useState<'summary' | 'evidence' | 'news'>('summary');

    const fetchSignal = useCallback(async ({ background = false } = {}) => {
        if (!isLoaded) return;
        if (background) {
            setIsRefreshing(true);
        } else {
            setLoading(true);
        }
        setError(null);

        try {
            const url = `/api/signals/v2?market=${config.market}&mode=${config.mode}&enableSocial=${config.enableSocial}`;
            const res = await fetch(url);
            const json = await res.json();

            if (json.success) {
                const fetchedData = json.data;
                if (isMarketSignal(fetchedData)) {
                    setSignalData(fetchedData);
                    lastFetchAt.current = Date.now();
                } else {
                    setError('Signal engine returned invalid data structure.');
                }
            } else {
                setError(json.error || 'Failed to retrieve signal.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error fetching signal.');
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [config, isLoaded]);

    useEffect(() => {
        if (isLoaded) {
            fetchSignal();
        }
    }, [fetchSignal, isLoaded]);

    useEffect(() => {
        if (!isLoaded) return;

        const intervalId = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                fetchSignal({ background: true });
            }
        }, REFRESH_INTERVAL_MS);

        const handleFocus = () => {
            const timeSinceLastFetch = Date.now() - lastFetchAt.current;
            if (timeSinceLastFetch > REFRESH_INTERVAL_MS) {
                fetchSignal({ background: true });
            }
        };

        window.addEventListener('focus', handleFocus);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
        };
    }, [fetchSignal, isLoaded]);

    // Extract information for rendering
    const snapshotDate = signalData?.metadata.score_delta?.snapshot_date ?? null;
    const score = signalData ? Math.round(signalData.composite_score) : 0;
    const delta = signalData?.metadata.score_delta?.delta ?? null;
    const agreement = signalData?.confidence.agreement_pct ?? 0;
    const coverage = signalData?.metadata.signal_quality?.source_coverage ?? 'limited';
    const regime = signalData?.metadata.signal_quality?.market_regime ?? 'Unknown';
    const warnings = signalData?.metadata.signal_quality?.warnings ?? [];
    const feed = signalData?.metadata.articles ?? [];

    const indexTrends = useMemo(() => {
        if (!signalData) return [];
        return signalData.metadata.index_trend
            ? signalData.metadata.index_trend.map((t) => ({ symbol: t.symbol, changePercent: t.changePercent }))
            : signalData.metadata.stocks
                ? signalData.metadata.stocks.map((s) => ({ symbol: s.symbol, changePercent: s.changePercent }))
                : [];
    }, [signalData]);

    // Get top 3 drivers (by absolute contribution) without type assertions
    const topDrivers = useMemo(() => {
        if (!signalData) return [];
        const drivers = signalData.metadata.score_drivers || [];
        return [...drivers]
            .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
            .slice(0, 3);
    }, [signalData]);

    const maxTopDriverContribution = useMemo(
        () => Math.max(1, ...topDrivers.map((driver) => Math.abs(driver.contribution))),
        [topDrivers],
    );

    // Get lowest driver for risk evaluation
    const lowestDriver = useMemo(() => {
        if (!signalData) return null;
        const drivers = signalData.metadata.score_drivers || [];
        if (drivers.length === 0) return null;
        return [...drivers].sort((a, b) => a.score - b.score)[0];
    }, [signalData]);

    // Get highest driver for counterfactual trigger evaluation
    const highestDriver = useMemo(() => {
        if (!signalData) return null;
        const drivers = signalData.metadata.score_drivers || [];
        if (drivers.length === 0) return null;
        return [...drivers].sort((a, b) => b.score - a.score)[0];
    }, [signalData]);

    const getPostureTheme = (sc: number) => {
        if (sc >= 65) return { bg: 'bg-[#17745a]/10', text: 'text-[#17745a]', border: 'border-[#17745a]/20', rail: 'bg-[#17745a]' };
        if (sc >= 40) return { bg: 'bg-[#b86e00]/10', text: 'text-[#b86e00]', border: 'border-[#b86e00]/20', rail: 'bg-[#b86e00]' };
        return { bg: 'bg-[#c73c35]/10', text: 'text-[#c73c35]', border: 'border-[#c73c35]/20', rail: 'bg-[#c73c35]' };
    };

    const postureColors = getPostureTheme(score);

    return (
        <ShellV5>
            <TopAppBarV5
                snapshotDate={snapshotDate}
                onRefresh={() => fetchSignal({ background: true })}
                isRefreshing={isRefreshing}
                showRefresh={true}
                showSnapshot={true}
            />

            {/* Centered Maximum Width Workspace */}
            <div className="flex-grow flex flex-col w-full max-w-[1180px] mx-auto px-4 py-6 space-y-6">
                
                {/* Collapsible View Settings Accodion */}
                <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-sm">
                    <button
                        type="button"
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        aria-expanded={isSettingsOpen}
                        className="w-full flex items-center justify-between px-5 py-3.5 bg-zinc-50/50 hover:bg-zinc-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17745a] focus-visible:ring-inset"
                    >
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-zinc-600 font-sans">
                            <span className="font-semibold text-zinc-800 uppercase tracking-wider text-[11px] font-mono">Desk Settings</span>
                            <span className="text-zinc-300">|</span>
                            <span>Active: <strong className="text-zinc-900">{config.market} Market</strong></span>
                            <span>•</span>
                            <span>Mode: <strong className="text-zinc-900">{config.mode === 'standard' ? 'Momentum' : 'Contrarian'}</strong></span>
                            <span>•</span>
                            <span>Social context: <strong className="text-zinc-900">{config.enableSocial ? 'ON' : 'OFF'}</strong></span>
                            {loading && signalData && (
                                <span className="font-semibold text-[#b96b00]" role="status" aria-live="polite">Updating signal...</span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 text-zinc-500">
                            <span className="text-xs">{isSettingsOpen ? 'Hide' : 'Configure'}</span>
                            <ChevronIcon className="h-4 w-4" direction={isSettingsOpen ? 'up' : 'down'} />
                        </div>
                    </button>

                    {isSettingsOpen && (
                        <div className="px-5 py-4 border-t border-zinc-200 bg-white grid grid-cols-1 sm:grid-cols-3 gap-6  text-xs">
                            {/* Market Selector */}
                            <div className="space-y-1.5">
                                <span className="font-semibold text-zinc-500 uppercase tracking-wide text-[11px] block">Market Region</span>
                                <div className="flex rounded-md border border-zinc-300 overflow-hidden bg-zinc-50 w-fit">
                                    <button
                                        type="button"
                                        onClick={() => updateConfig({ market: 'US' })}
                                        className={`px-4 py-1.5 font-bold transition-all ${
                                            config.market === 'US' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900'
                                        }`}
                                    >
                                        US
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => updateConfig({ market: 'MY' })}
                                        className={`px-4 py-1.5 font-bold transition-all ${
                                            config.market === 'MY' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900'
                                        }`}
                                    >
                                        MY
                                    </button>
                                </div>
                            </div>

                            {/* Mode Selector */}
                            <div className="space-y-1.5">
                                <span className="font-semibold text-zinc-500 uppercase tracking-wide text-[11px] block">Analysis Mode</span>
                                <div className="flex rounded-md border border-zinc-300 overflow-hidden bg-zinc-50 w-fit">
                                    <button
                                        type="button"
                                        onClick={() => updateConfig({ mode: 'standard' })}
                                        className={`px-4 py-1.5 font-bold transition-all ${
                                            config.mode === 'standard' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900'
                                        }`}
                                    >
                                        Momentum
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => updateConfig({ mode: 'contrarian' })}
                                        className={`px-4 py-1.5 font-bold transition-all ${
                                            config.mode === 'contrarian' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900'
                                        }`}
                                    >
                                        Contrarian
                                    </button>
                                </div>
                            </div>

                            {/* Social Selector */}
                            <div className="space-y-1.5">
                                <span className="font-semibold text-zinc-500 uppercase tracking-wide text-[11px] block">Social Context</span>
                                <button
                                    type="button"
                                    onClick={() => updateConfig({ enableSocial: !config.enableSocial })}
                                    className={`px-4 py-2 border rounded-md font-bold transition-all ${
                                        config.enableSocial
                                            ? 'bg-[#2f62d5] text-white border-[#2f62d5]'
                                            : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
                                    }`}
                                >
                                    Social context is {config.enableSocial ? 'Active' : 'Disabled'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {loading && !signalData ? (
                    <div className="flex-1 flex flex-col justify-center items-center py-20 font-sans text-sm text-zinc-500">
                        <span>LOADING MARKET BRIEFING...</span>
                    </div>
                ) : error ? (
                    <div className="border border-red-200 bg-red-50 p-6 text-center rounded-lg max-w-md mx-auto my-10 shadow-sm">
                        <div className="text-[#c73c35] font-sans font-bold mb-2">SYSTEM ERROR</div>
                        <p className="text-zinc-700 text-xs font-mono">{error}</p>
                        <button
                            type="button"
                            onClick={() => fetchSignal()}
                            className="mt-4 px-4 py-2 border border-zinc-300 bg-white text-zinc-800 text-xs hover:bg-zinc-50 transition-colors rounded-md"
                        >
                            Retry Loading
                        </button>
                    </div>
                ) : signalData ? (
                    <div
                        className={`space-y-6 flex-grow flex flex-col transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}
                        aria-busy={loading}
                    >
                        
                        {/* Segmented Content Switch Tabs */}
                        <div className="border-b border-zinc-200 flex">
                            <nav role="tablist" className="flex space-x-6 h-10" aria-label="Progressive disclosure tabs">
                                {(['summary', 'evidence', 'news'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        type="button"
                                        role="tab"
                                        onClick={() => setActiveTab(tab)}
                                        aria-selected={activeTab === tab}
                                        className={`h-full border-b-2 px-1 text-sm font-semibold capitalize transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17745a] focus-visible:ring-offset-2 ${
                                            activeTab === tab
                                                ? 'border-[#17745a] text-[#17745a]'
                                                : 'border-transparent text-zinc-600 hover:text-zinc-900'
                                        }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </nav>
                        </div>

                        {/* TAB 1: SUMMARY (The 5-Second First-Look Core View) */}
                        {activeTab === 'summary' && (
                            <div className="space-y-6 ">
                                
                                {/* 1 & 2: Signal cockpit with one dominant visual anchor */}
                                <section className="relative overflow-hidden rounded-[10px] bg-[#151916] text-white shadow-[0_22px_55px_rgba(21,25,22,0.22)]">
                                    <div className={`absolute inset-x-0 top-0 h-1.5 ${postureColors.rail}`} aria-hidden="true" />
                                    <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:32px_32px]" aria-hidden="true" />
                                    <div className="relative grid gap-8 p-5 md:p-8 lg:grid-cols-[215px_minmax(0,1fr)_220px] lg:gap-8">
                                        <div className="flex items-center gap-5 border-b border-white/10 pb-7 lg:flex-col lg:items-start lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
                                            <div
                                                className="relative flex h-36 w-36 shrink-0 items-center justify-center rounded-full"
                                                style={{ background: `conic-gradient(#b8f14b ${Math.max(0, Math.min(100, score)) * 3.6}deg, rgba(255,255,255,0.12) 0deg)` }}
                                                aria-label={`Market score ${score} out of 100`}
                                            >
                                                <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-[#151916]">
                                                    <strong className="text-5xl font-black leading-none text-white">{score}</strong>
                                                    <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-zinc-500">Signal / 100</span>
                                                </div>
                                            </div>
                                            <div className="min-w-0 lg:mt-auto">
                                                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Current posture</span>
                                                <p className="mt-2 text-xl font-black leading-tight text-[#b8f14b]">{signalData.interpretation.action}</p>
                                                <p className="mt-2 font-mono text-[10px] uppercase text-zinc-500">{regime} regime</p>
                                            </div>
                                        </div>

                                        <div className="flex min-w-0 flex-col justify-between gap-8">
                                            <div className="space-y-5">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <span className="inline-flex items-center gap-2 rounded bg-[#b8f14b] px-2.5 py-1 text-[10px] font-black uppercase text-[#151916]">Decision brief</span>
                                                    <span className="font-mono text-[11px] uppercase text-zinc-400">{coverage} coverage</span>
                                                </div>
                                                <h1 className="max-w-2xl text-2xl font-black leading-[1.1] text-white md:text-4xl">{signalData.interpretation.reasoning}</h1>
                                                <div className="flex flex-wrap items-center gap-4">
                                                    {delta !== null && (
                                                        <span className="font-mono text-xs text-zinc-400">
                                                            Session move <strong className={delta > 0 ? 'text-[#8fe3c2]' : delta < 0 ? 'text-[#ff8c84]' : 'text-zinc-200'}>{formatSignedV5(delta)} pts</strong>
                                                        </span>
                                                    )}
                                                    <span className="font-mono text-xs text-zinc-500">Updated {formatSnapshotTimeV5(snapshotDate)}</span>
                                                </div>
                                            </div>

                                            <div className="space-y-3" aria-label={`Market score ${score} out of 100`}>
                                                <div className="relative h-2 overflow-visible rounded-full bg-white/10">
                                                    <div className="absolute inset-y-0 left-0 w-[40%] rounded-l-full bg-[#ff6e66]/55" />
                                                    <div className="absolute inset-y-0 left-[40%] w-[25%] bg-[#f4b84d]/55" />
                                                    <div className="absolute inset-y-0 left-[65%] right-0 rounded-r-full bg-[#63d6ab]/60" />
                                                    <span className="absolute top-1/2 h-5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_3px_rgba(255,255,255,0.16)]" style={{ left: `${Math.max(2, Math.min(98, score))}%` }} />
                                                </div>
                                                <div className="flex justify-between font-mono text-[9px] uppercase text-zinc-500"><span>Risk-off</span><span>Balanced</span><span>Risk-on</span></div>
                                            </div>
                                        </div>

                                        <aside className="flex flex-col justify-between gap-5 border-t border-white/10 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                                            <div>
                                                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Signal history</span>
                                                <div className="mt-5 min-h-10"><Sparkline history={signalData.metadata.score_history} width={190} height={56} tone="dark" /></div>
                                            </div>
                                            <div className="space-y-3 border-t border-white/10 pt-4 text-xs">
                                                <div className="flex items-center justify-between gap-4"><span className="font-mono text-[9px] uppercase text-zinc-500">Agreement</span><strong className="text-lg text-white">{agreement}%</strong></div>
                                                <div className="h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#b8f14b]" style={{ width: `${agreement}%` }} /></div>
                                            </div>
                                            <div className="border-t border-white/10 pt-4 font-mono text-[10px] leading-relaxed text-zinc-500">The score weighs trend, breadth, valuation, and risk context.</div>
                                        </aside>
                                    </div>
                                    {indexTrends.length > 0 && (
                                        <div className="relative flex gap-5 overflow-x-auto border-t border-white/10 bg-black/15 px-6 py-3 font-mono text-[10px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                            {indexTrends.map((idx) => {
                                                const isPositive = idx.changePercent >= 0;
                                                return <span key={idx.symbol} className="flex shrink-0 items-center gap-2"><strong className="text-zinc-300">{idx.symbol}</strong><span className={isPositive ? 'text-[#8fe3c2]' : 'text-[#ff8c84]'}>{isPositive ? '▲' : '▼'} {Math.abs(idx.changePercent).toFixed(2)}%</span></span>;
                                            })}
                                        </div>
                                    )}
                                </section>
                                {/* 3: Ranked evidence cards */}
                                <section className="space-y-4">
                                    <div className="flex items-end justify-between gap-4">
                                        <div>
                                            <span className="font-mono text-[10px] uppercase text-zinc-500">Evidence stack</span>
                                            <h3 className="mt-1 text-base font-black uppercase text-zinc-900">What is moving the signal</h3>
                                        </div>
                                        <span className="hidden text-xs text-zinc-500 sm:block">Ranked by contribution</span>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-3">
                                        {topDrivers.map((driver, index) => {
                                            const isPos = driver.contribution > 0;
                                            const impactWidth = Math.max(8, Math.round((Math.abs(driver.contribution) / maxTopDriverContribution) * 100));
                                            return (
                                                <article key={driver.key} className="relative overflow-hidden rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md">
                                                    <div className={`absolute inset-x-0 top-0 h-1 ${isPos ? 'bg-[#17745a]' : 'bg-[#c73c35]'}`} />
                                                    <div className="flex items-start justify-between gap-4">
                                                        <span className="font-mono text-[10px] uppercase text-zinc-400">Signal 0{index + 1}</span>
                                                        <strong className={`font-mono text-xl ${isPos ? 'text-[#17745a]' : 'text-[#c73c35]'}`}>{formatSignedV5(driver.contribution)}</strong>
                                                    </div>
                                                    <h4 className="mt-5 text-base font-black text-zinc-900">{driver.name}</h4>
                                                    <p className="mt-1 min-h-10 text-xs leading-relaxed text-zinc-500">{driver.detail}</p>
                                                    <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                                                        <div className={`h-full rounded-full ${isPos ? 'bg-[#17745a]' : 'bg-[#c73c35]'}`} style={{ width: `${impactWidth}%` }} />
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                </section>

                                {/* 4 & 5: Risk & What would change this view */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Risk to know */}
                                    <div className="bg-[#fff8f7] border border-[#c73c35]/20 rounded-lg p-6 shadow-sm space-y-3">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#c73c35] flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 bg-[#c73c35] rounded-full" /> Main Risk Factors
                                        </h4>
                                        <div className="text-xs space-y-2 text-zinc-700 leading-relaxed font-sans">
                                            {warnings.length > 0 ? (
                                                warnings.map((w, idx) => <p key={idx}>• {w}</p>)
                                            ) : lowestDriver ? (
                                                <p>• The lowest-scoring factor is <strong className="text-zinc-900">{lowestDriver.name}</strong>, which scores {lowestDriver.score}/100 and pulls the composite score down by {Math.abs(lowestDriver.contribution)} points.</p>
                                            ) : (
                                                <p>• No severe configuration warnings or system imbalances are currently flagged.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* What would change this view */}
                                    <div className="bg-[#fffaf0] border border-[#b86e00]/20 rounded-lg p-6 shadow-sm space-y-3">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#b86e00] flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 bg-[#b86e00] rounded-full" /> What would change this view?
                                        </h4>
                                        <div className="text-xs text-zinc-700 leading-relaxed font-sans">
                                            {score >= 65 ? (
                                                <p>
                                                    A negative reversal in <strong className="text-zinc-900">{highestDriver?.name || 'leading indicators'}</strong> or key momentum structures falling below support thresholds would trigger a drop to a Neutral posture.
                                                </p>
                                            ) : score <= 40 ? (
                                                <p>
                                                    A major positive breakout in <strong className="text-zinc-900">{lowestDriver?.name || 'macro filters'}</strong> or relief on technical selling bounds would raise the composite score toward Neutral.
                                                </p>
                                            ) : (
                                                <p>
                                                    A unified breakout where indicators align (either in positive momentum or negative trend breaches) would resolve this Neutral posture into a directional Buy or Sell.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: EVIDENCE (Detailed EvidenceTable and Advanced Metrics) */}
                        {activeTab === 'evidence' && (
                            <div className="space-y-6 ">
                                {/* Advanced Score overview */}
                                <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
                                    <div className="space-y-1 flex-1">
                                        <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest block">Desk Slider Scale</span>
                                        <div className="h-1.5 bg-zinc-200 relative w-full rounded-full">
                                            <div
                                                className="absolute -top-1 w-3.5 h-3.5 rounded-full bg-zinc-900 border border-white flex items-center justify-center -translate-x-1/2 transition-all duration-300"
                                                style={{ left: `${score}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[11px] font-mono text-zinc-400 uppercase pt-1">
                                            <span>Sell (0)</span>
                                            <span>Neutral (50)</span>
                                            <span>Buy (100)</span>
                                        </div>
                                    </div>
                                    <div className="shrink-0 flex items-center justify-center border border-zinc-200 p-2 bg-zinc-50">
                                        <Sparkline history={signalData.metadata.score_history} />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">All Scored Evidence</h3>
                                    <EvidenceTable signal={signalData} />
                                </div>
                            </div>
                        )}

                        {/* TAB 3: NEWS (Wires & Index Tape Context) */}
                        {activeTab === 'news' && (
                            <div className="space-y-6 ">
                                {/* Index Trends tape (horizontal ribbon in News tab) */}
                                {indexTrends.length > 0 && (
                                    <div className="bg-white border border-zinc-200 p-4 rounded-lg shadow-sm">
                                        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block mb-2">Briefing Tape</span>
                                        <div className="flex flex-wrap gap-4 text-xs font-mono">
                                            {indexTrends.map((idx) => {
                                                const change = idx.changePercent;
                                                const isPos = change > 0;
                                                return (
                                                    <div key={idx.symbol} className="inline-flex items-center gap-2 border border-zinc-200 px-3 py-1 bg-zinc-50/50 rounded-md">
                                                        <span className="text-zinc-800 font-bold">{idx.symbol}</span>
                                                        <span className={isPos ? 'text-[#17745a]' : 'text-[#c73c35]'}>
                                                            {isPos ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* News Wire context */}
                                <div className="bg-white border border-zinc-200 p-6 rounded-lg shadow-sm space-y-4">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-700 border-b border-zinc-100 pb-2">Context news wire (Unscored)</h3>
                                    <div className="divide-y divide-zinc-200 font-sans">
                                        {feed.length > 0 ? (
                                            feed.map((article, idx) => {
                                                const safeArticleUrl = getSafeArticleUrlV5(article.url);
                                                const isBull = article.sentiment === 'bullish';
                                                const isBear = article.sentiment === 'bearish';
                                                return (
                                                    <div key={idx} className="py-4 space-y-1.5 first:pt-0 last:pb-0">
                                                        <div className="flex items-start gap-3">
                                                            <span className="text-xs font-mono font-bold text-zinc-400 bg-zinc-100 border border-zinc-200 w-5 h-5 flex items-center justify-center shrink-0 rounded-md">
                                                                {idx + 1}
                                                            </span>
                                                            <div className="space-y-1 flex-1 min-w-0">
                                                                {safeArticleUrl ? (
                                                                    <a
                                                                        href={safeArticleUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-sm font-semibold text-[#2f62d5] hover:underline block leading-snug"
                                                                    >
                                                                        {article.title}
                                                                    </a>
                                                                ) : (
                                                                    <span className="text-sm font-semibold text-zinc-800 block leading-snug">
                                                                        {article.title}
                                                                    </span>
                                                                )}
                                                                <div className="flex items-center justify-between text-xs text-zinc-500">
                                                                    <span>{article.source}</span>
                                                                    <span className={isBull ? 'text-[#17745a] font-bold' : isBear ? 'text-[#c73c35] font-bold' : 'text-zinc-500'}>
                                                                        {article.sentiment ? article.sentiment.toUpperCase() : 'NEUTRAL'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="text-zinc-500 text-xs text-center py-6">
                                                No news wires currently recorded on desk.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        </ShellV5>
    );
};
