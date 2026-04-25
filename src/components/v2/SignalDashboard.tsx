
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSignalConfig } from '@/hooks/use-signal-config';
import { DashboardHeader } from './DashboardHeader';
import { SignalGauge } from './SignalGauge';
import { IndicatorList } from './IndicatorList';
import { IndicatorAgreement } from './IndicatorAgreement';
import { StrategyPresets } from './StrategyPresets';
import { StockIndicator } from './StockIndicator';
import { ArticleList } from './ArticleList';
import { AnalysisCard } from './AnalysisCard';
import { SignalQualityPanel } from './SignalQualityPanel';
import { MarketSignal } from '@/lib/types/signal-v2';

export const SignalDashboard = () => {
    const { config, updateConfig, applyPreset, isLoaded } = useSignalConfig();
    const [signalData, setSignalData] = useState<MarketSignal | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    if (!isLoaded) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
            </div>
        );
    }

    const summaryItems = signalData
        ? [
            { label: 'Composite Score', value: signalData.composite_score.toString(), detail: '0-100 signal index' },
            { label: 'Current Tier', value: signalData.tier.replace('-', ' '), detail: config.mode === 'standard' ? 'Momentum read' : 'Contrarian read' },
            { label: 'Confidence', value: signalData.confidence.level, detail: `${signalData.confidence.agreement_pct}% agreement` },
            { label: 'Market', value: config.market, detail: config.enableSocial ? 'Social enabled' : 'Institutional only' }
        ]
        : [
            { label: 'Composite Score', value: loading ? '...' : '--', detail: '0-100 signal index' },
            { label: 'Current Tier', value: loading ? '...' : '--', detail: 'Awaiting signal' },
            { label: 'Confidence', value: loading ? '...' : '--', detail: 'Agreement pending' },
            { label: 'Market', value: config.market, detail: config.enableSocial ? 'Social enabled' : 'Institutional only' }
        ];

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
            <DashboardHeader
                market={config.market}
                mode={config.mode}
                enableSocial={config.enableSocial}
                onMarketChange={(m) => updateConfig({ market: m })}
                onModeChange={(m) => updateConfig({ mode: m })}
                onSocialToggle={(enabled) => updateConfig({ enableSocial: enabled })}
                isLoaded={isLoaded}
            />

            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {summaryItems.map((item) => (
                    <div
                        key={item.label}
                        className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                    >
                        <div className="absolute inset-x-0 top-0 h-1 bg-slate-200" />
                        <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{item.label}</div>
                        <div className="mt-2 text-3xl font-bold capitalize tracking-tight text-slate-900 font-mono tabular-nums">{item.value}</div>
                        <div className="mt-1 text-sm font-medium text-slate-500">{item.detail}</div>
                    </div>
                ))}
            </div>

            {/* Strategy Presets */}
            <div className="mb-6">
                <StrategyPresets
                    currentMode={config.mode}
                    currentSocial={config.enableSocial}

                    onPresetSelect={applyPreset}
                />
            </div>

            {!loading && signalData && (
                <SignalQualityPanel signal={signalData} />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Gauge & Interpretation */}
                <div className="lg:col-span-5 space-y-5">
                    <div className="flex flex-col items-center bg-white rounded-xl border border-slate-200 p-8 relative overflow-hidden group w-full shadow-sm transition-all duration-500">
                        <div className="absolute inset-x-0 top-0 h-1.5 bg-slate-100" />
                        <div className="absolute left-6 top-6 rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                            Signal Index
                        </div>
                        <div className="absolute top-0 right-0 p-6 opacity-[0.01] group-hover:opacity-[0.02] transition-opacity duration-700 pointer-events-none">
                            <div className="text-[8rem] font-bold select-none uppercase tracking-tight leading-none text-slate-900">
                                {signalData?.metadata?.market}
                            </div>
                        </div>

                        {loading ? (
                            <div className="h-[280px] flex items-center justify-center">
                                <div className="animate-pulse text-indigo-600 font-bold uppercase tracking-widest text-xs">Synchronizing...</div>
                            </div>
                        ) : signalData ? (
                            <SignalGauge
                                score={signalData.composite_score}
                                tier={signalData.tier}
                                confidence={signalData.confidence.level === 'moderate' ? 'medium' : signalData.confidence.level}
                            />
                        ) : null}

                        {error && (
                            <div className="bg-rose-50 border border-rose-200 text-rose-600 text-[10px] p-3 rounded mt-4 w-full text-center font-medium">
                                {error}
                            </div>
                        )}
                    </div>

                    {!loading && signalData && (
                        <AnalysisCard
                            tier={signalData.tier}
                            mode={config.mode}
                            market={config.market}
                            reasoning={signalData.interpretation.reasoning}
                            confidence={signalData.confidence}
                            warnings={signalData.confidence.warning ? [signalData.confidence.warning] : []}
                            metadata={{
                                ...signalData.metadata,
                                composite_score: signalData.composite_score
                            }}
                        />
                    )}
                </div>

                {/* Right Column: Indicator Grid */}
                <div className="lg:col-span-7">
                    <div className="flex items-center justify-between mb-4 px-2">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 mr-2 shadow-sm" />
                            Signal Components
                        </h2>
                        {signalData && (
                            <span className="text-[11px] text-slate-400 font-mono">
                                Latency: {signalData.metadata?.weight_distribution ? 'Institutional Active' : 'Fallback'}
                            </span>
                        )}
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="h-24 bg-slate-100 border border-slate-200 rounded-xl animate-pulse" />
                            ))}
                        </div>
                    ) : signalData ? (
                        <>
                            <IndicatorList
                                indicators={Object.values(signalData.components)}
                                mode={config.mode}
                                market={config.market}
                                compositeScore={signalData.composite_score}
                            />

                            {/* Indicator Agreement Dashboard */}
                            <div className="mt-6">
                                <IndicatorAgreement
                                    indicators={Object.values(signalData.components)}
                                    compositeTier={signalData.tier}
                                    mode={config.mode}
                                />
                            </div>

                            {/* Stock Indicator Section */}
                            <div className="mt-6">
                                <StockIndicator
                                    stocks={signalData.metadata.stocks || []}
                                    market={config.market}
                                />
                            </div>

                            {/* Article List Section */}
                            {signalData.metadata.articles && signalData.metadata.articles.length > 0 && (
                                <ArticleList
                                    articles={signalData.metadata.articles}
                                    market={config.market}
                                />
                            )}
                        </>
                    ) : null}
                </div>
            </div>

            {/* Footer Status */}
            <div className="mt-12 pt-6 border-t border-slate-200 flex justify-between items-center text-[9px] uppercase tracking-widest font-bold text-slate-400">
                <div>Engine: Alpha-Sent-V2</div>
                <div className="flex items-center space-x-4">
                    <span className="flex items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                        Live Feeds
                    </span>
                    <span>© 2026 Signal Dashboard</span>
                </div>
            </div>
        </div>
    );
};
