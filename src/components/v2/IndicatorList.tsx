'use client';

import React, { useState } from 'react';
import { IndicatorData, SignalTier } from '@/lib/types/signal-v2';

interface IndicatorListProps {
    indicators: IndicatorData[];
    mode?: 'standard' | 'contrarian';
    market?: 'US' | 'MY';
    compositeScore?: number; // Current composite score
}

// Helper to get raw signal (always high score = bullish)
const getRawSignal = (score: number): SignalTier => {
    if (score >= 85) return 'strong-buy';
    if (score >= 65) return 'buy';
    if (score >= 40) return 'neutral';
    if (score >= 20) return 'sell';
    return 'strong-sell';
};

// Calculate hypothetical score without a specific indicator
const calculateHypotheticalScore = (indicators: IndicatorData[], excludeName: string): { score: number; weights: Record<string, number> } => {
    const activeIndicators = indicators.filter(i => i.enabled && i.name !== excludeName);

    if (activeIndicators.length === 0) {
        return { score: 0, weights: {} };
    }

    // Calculate total weight and redistribute
    const totalWeight = activeIndicators.reduce((sum, ind) => sum + ind.weight, 0);
    const redistributedWeights: Record<string, number> = {};
    let weightedSum = 0;

    activeIndicators.forEach(ind => {
        const newWeight = totalWeight > 0 ? ind.weight / totalWeight : 1 / activeIndicators.length;
        redistributedWeights[ind.name] = newWeight;
        weightedSum += ind.score * newWeight;
    });

    return {
        score: Math.round(weightedSum),
        weights: redistributedWeights
    };
};

export const IndicatorList = ({ indicators, mode = 'contrarian', market = 'US', compositeScore = 0 }: IndicatorListProps) => {
    const [hoveredIndicator, setHoveredIndicator] = useState<string | null>(null);

    const getSocialTooltip = () => {
        if (market === 'MY') {
            return 'Combines sentiment from BursaBets and MalaysianPF subreddits. News sentiment from The Star and Google News Malaysia.';
        }
        return 'Combines sentiment from r/wallstreetbets, r/stocks, r/investing, and StockTwits. Weighted by post engagement and recency.';
    };

    const formatRawValue = (indicator: IndicatorData) => {
        if (indicator.name === 'social' || indicator.name === 'news') {
            return clampSentiment(indicator.value).toFixed(2);
        }

        return indicator.value.toFixed(2);
    };

    const getValueScaleLabel = (indicator: IndicatorData) => {
        if (indicator.name === 'social' || indicator.name === 'news') {
            return 'raw sentiment -1 to +1';
        }

        if (indicator.name === 'aaii') {
            return 'bullish survey %';
        }

        return market === 'MY' && indicator.name === 'vix' ? 'volatility proxy' : 'market value';
    };

    const getScoreScaleLabel = (indicator: IndicatorData) => {
        if (indicator.name === 'social' || indicator.name === 'news') {
            return 'Signal score: normalized sentiment scale';
        }

        return 'Score: 0-100 normalized';
    };

    const getSignalColor = (signal: SignalTier) => {
        if (signal === 'strong-buy') return 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm';
        if (signal === 'buy') return 'bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm';
        if (signal === 'neutral') return 'bg-slate-50 text-slate-600 border border-slate-200';
        if (signal === 'sell') return 'bg-rose-50 text-rose-500 border border-rose-100 shadow-sm';
        return 'bg-rose-50 text-rose-600 border border-rose-200 shadow-sm';
    };

    return (
        <div className="w-full space-y-3">
            {/* Header explaining the two columns */}
            <div className="flex items-center gap-2 text-[11px] text-slate-500 uppercase tracking-wider px-3">
                <span>Raw Signal = High score is bullish</span>
                <span className="text-slate-300">|</span>
                <span>Mode Signal = {mode === 'standard' ? 'Follow momentum' : 'Fade extremes'}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {indicators.map((indicator) => {
                    const rawSignal = getRawSignal(indicator.score);
                    const modeSignal = indicator.signal; // This is the mode-aware signal
                    const canToggle = indicator.name === 'social' || indicator.name === 'news';
                    const hypothetical = canToggle && indicator.enabled ? calculateHypotheticalScore(indicators, indicator.name) : null;

                    return (
                        <div
                            key={indicator.name}
                            className="relative flex flex-col p-3 rounded-lg border border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md transition-all duration-300"
                            onMouseEnter={() => canToggle && setHoveredIndicator(indicator.name)}
                            onMouseLeave={() => setHoveredIndicator(null)}
                        >
                            {/* Weight Redistribution Preview Tooltip */}
                            {canToggle && indicator.enabled && hoveredIndicator === indicator.name && hypothetical && (
                                <div className="absolute top-full left-0 mt-2 w-72 p-3 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-600 z-50 shadow-xl">
                                    <div className="font-bold text-indigo-600 mb-2">If {indicator.display_name} is disabled:</div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500">Current Score:</span>
                                            <span className="font-mono font-bold text-slate-900">{compositeScore}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500">New Score:</span>
                                            <span className="font-mono font-bold text-slate-900">
                                                {hypothetical.score}
                                                <span className={`ml-1 text-[10px] ${hypothetical.score < compositeScore ? 'text-rose-600' : hypothetical.score > compositeScore ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                    {hypothetical.score < compositeScore ? `${hypothetical.score - compositeScore}` : hypothetical.score > compositeScore ? `+${hypothetical.score - compositeScore}` : '-'}
                                                </span>
                                            </span>
                                        </div>

                                        <div className="border-t border-slate-100 pt-2 mt-2">
                                            <div className="text-slate-500 mb-1.5">Weight Changes:</div>
                                            {indicators.filter(i => i.enabled && i.name !== indicator.name).map(ind => (
                                                <div key={ind.name} className="flex justify-between items-center text-[10px]">
                                                    <span className="text-slate-600">{ind.display_name}:</span>
                                                    <span className="font-mono">
                                                        <span className="text-slate-500">{(ind.weight * 100).toFixed(0)}%</span>
                                                        <span className="text-slate-400 mx-1">to</span>
                                                        <span className="text-indigo-600">{((hypothetical.weights[ind.name] || 0) * 100).toFixed(0)}%</span>
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-bold uppercase tracking-wider text-slate-900">
                                            {indicator.display_name}
                                        </span>
                                        {(indicator.name === 'social' || indicator.name === 'combinedSentiment' || indicator.name === 'news') && (
                                            <div className="group relative">
                                                <svg className="w-3 h-3 text-slate-400 hover:text-indigo-600 cursor-help transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-white border border-slate-200 rounded-lg text-[11px] leading-relaxed text-slate-600 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl">
                                                    <div className="font-bold text-indigo-600 mb-1">Sources Included:</div>
                                                    {getSocialTooltip()}
                                                    <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-slate-500">
                                                        Mode: <span className="text-slate-700 font-medium">{mode === 'standard' ? 'Momentum' : 'Contrarian'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                        Updated: {new Date(indicator.last_updated).toLocaleDateString()}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-base font-mono tabular-nums font-semibold text-slate-900">
                                        {formatRawValue(indicator)}
                                    </span>
                                    <div className="text-[9px] uppercase tracking-wider text-slate-400">
                                        {getValueScaleLabel(indicator)}
                                    </div>
                                </div>
                            </div>

                            {/* Weight Bar */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center text-[11px] uppercase tracking-tighter text-slate-500">
                                    <span>Contribution / Weight</span>
                                    <span className="font-mono">{(indicator.weight * 100).toFixed(0)}%</span>
                                </div>
                                <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                                        style={{ width: `${indicator.weight * 100}%` }}
                                    />
                                </div>
                            </div>

                            {/* Dual Signal Display: Raw + Mode */}
                            <div className="mt-3 space-y-2">
                                {/* Score */}
                                <div className="text-[11px] font-mono tabular-nums text-slate-500 text-right">
                                    {getScoreScaleLabel(indicator)}: {indicator.score.toFixed(0)}
                                </div>

                                {/* Raw Signal */}
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Raw:</span>
                                        <span className="text-[9px] text-slate-500">High score = bullish</span>
                                    </div>
                                    <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${getSignalColor(rawSignal)}`}>
                                        {rawSignal.replace('-', ' ')}
                                    </div>
                                </div>

                                {/* Mode Signal with Reasoning */}
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                                            {mode === 'standard' ? 'Momentum:' : 'Contrarian:'}
                                        </span>
                                        <span className="text-[9px] text-slate-500">
                                            {mode === 'standard' ? 'Follow the trend' : 'Fade extremes'}
                                        </span>
                                    </div>
                                    <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${getSignalColor(modeSignal)}`}>
                                        {modeSignal.replace('-', ' ')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

function clampSentiment(value: number) {
    return Math.max(-1, Math.min(1, value));
}
