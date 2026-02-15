
'use client';

import React from 'react';
import { SignalTier } from '@/lib/types/signal-v2';

interface AnalysisCardProps {
    tier: SignalTier;
    market: 'US' | 'MY';
    warnings: string[];
    metadata: {
        regime?: string;
        [key: string]: any; // Allow any type including arrays
    };
    mode?: 'standard' | 'contrarian';
    reasoning?: string;
}


export const AnalysisCard = ({ tier, market, warnings, metadata, mode = 'contrarian', reasoning }: AnalysisCardProps) => {
    // Enhanced interpretation based on score ranges
    const getScoreBasedAnalysis = (score: number, t: SignalTier, m: 'US' | 'MY', currentMode: 'standard' | 'contrarian') => {
        // Extract score from metadata if available
        const compositeScore = score || 50;

        if (currentMode === 'contrarian') {
            // Contrarian mode interpretations
            if (compositeScore >= 85) {
                return m === 'US'
                    ? "🔄 Extreme bullish sentiment detected. Contrarian signal: Market may be overextended. Consider profit-taking or defensive positioning."
                    : "🔄 Bursa sentiment extremely bullish. Historical patterns suggest a cooling period may follow. Exercise caution on new positions.";
            }
            if (compositeScore >= 70) {
                return "🔄 Strong bullish sentiment. Contrarian approach suggests monitoring for signs of exhaustion. Risk/reward becoming less favorable.";
            }
            if (compositeScore >= 55) {
                return "⚖️ Moderately bullish sentiment. Market in balanced state. No strong contrarian signal - wait for clearer extremes.";
            }
            if (compositeScore >= 40) {
                return "⚖️ Neutral zone. Sentiment indicators show no clear edge. Patience recommended until conviction builds.";
            }
            if (compositeScore >= 25) {
                return "🔄 Moderately bearish sentiment. Contrarian signal emerging - early signs of opportunity as fear builds.";
            }
            if (compositeScore >= 15) {
                return "🔄 Strong bearish sentiment. Contrarian opportunity developing. Smart money may start accumulating as panic spreads.";
            }
            return m === 'US'
                ? "🔄 Extreme fear detected. Strong contrarian buy signal. Historical data shows high-probability reversal zones. Risk/reward highly favorable."
                : "🔄 Bursa sentiment extremely bearish. Contrarian signal: Local bottom may be forming. Opportunistic positioning recommended.";
        } else {
            // Standard/Momentum mode interpretations
            if (compositeScore >= 85) {
                return "📈 Extreme bullish momentum. Trend is strong - ride the wave but maintain trailing stops as volatility increases.";
            }
            if (compositeScore >= 70) {
                return "📈 Strong bullish momentum confirmed. Multiple indicators aligned. Trend following strategies favored.";
            }
            if (compositeScore >= 55) {
                return "📈 Moderate bullish bias. Momentum building but not confirmed. Consider scaling into positions.";
            }
            if (compositeScore >= 40) {
                return "⚖️ Neutral momentum. No clear directional bias. Range-bound strategies may be appropriate.";
            }
            if (compositeScore >= 25) {
                return "📉 Moderate bearish momentum. Downtrend developing. Consider defensive positioning or short exposure.";
            }
            if (compositeScore >= 15) {
                return "📉 Strong bearish momentum confirmed. Trend is down - avoid catching falling knives. Wait for stabilization.";
            }
            return "📉 Extreme bearish momentum. Downtrend accelerating. Preserve capital and wait for trend reversal signals.";
        }
    };

    const getInterpretation = (t: SignalTier, m: 'US' | 'MY') => {
        if (t === 'strong-buy') {
            return m === 'US'
                ? "Extreme conditions suggest a high-probability reversal. Liquidity and volatility favor positioning for a rebound."
                : "Bursa sentiment is heavily depressed. Historical data suggests local opportunistic buying is likely.";
        }
        if (t === 'buy') {
            return "Positive divergence detected. Risk/reward ratio is improving as panic recedes.";
        }
        if (t === 'neutral') {
            return "Market is in an equilibrium state. No significant edge detected from sentiment indicators alone.";
        }
        if (t === 'sell') {
            return "Greed is infiltrating the market. Consider tightening stop-losses as distributions may start.";
        }
        if (t === 'strong-sell') {
            return "Extreme euphoria detected across social and institutional layers. Historically indicates a local top.";
        }
        return "Analyzing market pulse...";
    };

    // Use score-based analysis if composite_score is available in metadata
    const compositeScore = typeof metadata?.composite_score === 'number' ? metadata.composite_score : null;
    const analysis = compositeScore !== null
        ? getScoreBasedAnalysis(compositeScore, tier, market, mode)
        : (reasoning || getInterpretation(tier, market));

    return (
        <div className="w-full space-y-4">
            <div className="p-4 rounded-xl border border-white/5 bg-white/[0.03] backdrop-blur-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Techno-Fundamental Analysis</h3>
                <p className="text-sm leading-relaxed text-slate-300 italic font-medium">
                    &quot;{analysis}&quot;
                </p>

                {metadata?.regime && (
                    <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-rose-500 flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-2 animate-pulse" />
                            Regime: {metadata.regime === 'high-volatility' ? 'High Vol' : 'Normal'}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center">
                            Mode: {mode === 'standard' ? 'Momentum' : 'Contrarian'}
                        </span>
                    </div>
                )}
            </div>

            {warnings.length > 0 && (
                <div className="space-y-2">
                    {warnings.map((w, i) => (
                        <div key={i} className="flex items-center p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-200">
                            <svg className="w-3 h-3 mr-2 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            {w}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
