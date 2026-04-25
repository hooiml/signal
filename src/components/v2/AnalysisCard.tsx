'use client';

import React from 'react';
import { ConfidenceMetrics, MarketSignal, SignalTier } from '@/lib/types/signal-v2';

interface AnalysisCardProps {
    tier: SignalTier;
    market: 'US' | 'MY';
    warnings: string[];
    metadata: MarketSignal['metadata'] & {
        regime?: string;
        composite_score?: number;
    };
    confidence?: ConfidenceMetrics;
    mode?: 'standard' | 'contrarian';
    reasoning?: string;
}

export const AnalysisCard = ({ tier, market, warnings, metadata, confidence, mode = 'contrarian', reasoning }: AnalysisCardProps) => {
    const getInterpretation = (t: SignalTier, m: 'US' | 'MY') => {
        if (t === 'strong-buy') return m === 'US'
            ? 'Extreme conditions suggest a high-probability reversal setup if liquidity stabilizes.'
            : 'Bursa sentiment is heavily depressed; opportunistic positioning may improve if confirmation appears.';
        if (t === 'buy') return 'Positive divergence detected. Risk/reward is improving as panic recedes.';
        if (t === 'neutral') return 'Market is in equilibrium. Sentiment alone does not show a strong edge.';
        if (t === 'sell') return 'Optimism is elevated. Consider tightening risk controls and reviewing exposure.';
        if (t === 'strong-sell') return 'Extreme euphoria detected across signal layers, which often precedes weaker forward risk/reward.';
        return 'Analyzing market pulse.';
    };

    const compositeScore = typeof metadata?.composite_score === 'number' ? metadata.composite_score : null;
    const analysis = compositeScore !== null
        ? buildEvidenceBasedAnalysis(compositeScore, market, mode, metadata, confidence)
        : (reasoning || getInterpretation(tier, market));
    const context = metadata.interpretation_context;

    return (
        <div className="w-full space-y-4">
            <div className="relative overflow-hidden p-5 rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="absolute inset-y-0 left-0 w-1 bg-indigo-600" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-700 mb-2">Analyst Note</h3>
                <p className="text-base leading-relaxed text-slate-800 font-medium">
                    {analysis}
                </p>

                {context && (
                    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-sm text-slate-700">
                        <div className="grid grid-cols-1 gap-3">
                            <FactLine label="Regime" value={context.regime} />
                            <FactLine label="Agreement" value={context.agreeing_signals.length > 0 ? context.agreeing_signals.join(', ') : 'No strong agreement'} />
                            <FactLine label="Disagreement" value={context.disagreement_note || 'No major disagreement detected'} />
                            <FactLine label="Caveat" value={context.limitation} />
                        </div>
                        {context.aaii_note && (
                            <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs leading-relaxed text-indigo-900">
                                {context.aaii_note}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {warnings.length > 0 && (
                <div className="space-y-2">
                    {warnings.map((w, i) => (
                        <div key={i} className="flex items-center p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-700 shadow-sm">
                            <span className="mr-2 font-bold">!</span>
                            {w}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const FactLine = ({ label, value }: { label: string; value: string }) => (
    <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
        <div className="mt-1 text-sm leading-snug text-slate-800">{value}</div>
    </div>
);

function buildEvidenceBasedAnalysis(
    score: number,
    market: 'US' | 'MY',
    mode: 'standard' | 'contrarian',
    metadata: AnalysisCardProps['metadata'],
    confidence?: ConfidenceMetrics
) {
    const stance = getStance(score, mode, market);
    const drivers = [...(metadata.score_drivers ?? [])]
        .sort((a, b) => b.contribution - a.contribution)
        .slice(0, 3);
    const driverText = drivers.length > 0
        ? drivers.map(driver => `${driver.name} (${driver.detail})`).join(', ')
        : 'available signal components';
    const breadth = getIndexBreadth(metadata.index_trend);
    const context = metadata.interpretation_context;
    const confidenceText = confidence
        ? `${confidence.level} agreement across ${confidence.agreement_pct}% of active indicators`
        : null;
    const qualityWarnings = metadata.signal_quality?.warnings ?? [];
    const caution = qualityWarnings[0] ?? confidence?.warning ?? null;

    const parts = [
        `${context?.regime ? `${context.regime}: ` : ''}${stance} The score is ${score}, led by ${driverText}.`,
        context?.breadth_note ?? breadth,
        context?.disagreement_note ? `Disagreement: ${context.disagreement_note}` : null,
        confidenceText ? `Read quality is ${confidenceText}.` : null,
        caution ? `Caution: ${trimSentence(caution)}` : null,
    ].filter(Boolean);

    return parts.join(' ');
}

function getStance(score: number, mode: 'standard' | 'contrarian', market: 'US' | 'MY') {
    if (mode === 'contrarian') {
        if (score >= 85) return market === 'MY'
            ? 'Bursa sentiment is stretched, so the contrarian read favors reducing chase risk.'
            : 'Sentiment is extremely bullish, so the contrarian read favors tighter risk controls.';
        if (score >= 65) return 'Bullish sentiment is elevated, so the contrarian read is cautious rather than chase-oriented.';
        if (score >= 40) return 'Sentiment is balanced, so the contrarian read has no strong edge yet.';
        if (score >= 20) return 'Fear is building, so the contrarian read is beginning to favor selective accumulation.';
        return 'Fear is extreme, so the contrarian read favors looking for long-term entries only with volatility controls.';
    }

    if (score >= 85) return 'Momentum is very strong, but the setup is near an optimistic extreme.';
    if (score >= 65) return 'Momentum is bullish and currently supported by multiple signal layers.';
    if (score >= 40) return 'Momentum is mixed and does not show a clean directional edge.';
    if (score >= 20) return 'Momentum is bearish and defensive positioning is still favored.';
    return 'Momentum is deeply bearish, so capital preservation should dominate.';
}

function getIndexBreadth(indexTrend: MarketSignal['metadata']['index_trend']) {
    if (!indexTrend || indexTrend.length === 0) {
        return null;
    }

    const positive = indexTrend.filter(index => index.trend === 'positive').length;
    const negative = indexTrend.filter(index => index.trend === 'negative').length;
    const flat = indexTrend.length - positive - negative;

    if (positive > negative) {
        return `Index breadth supports the signal, with ${positive} of ${indexTrend.length} tracked indexes positive.`;
    }

    if (negative > positive) {
        return `Index breadth conflicts with the signal, with ${negative} of ${indexTrend.length} tracked indexes negative.`;
    }

    return `Index breadth is mixed: ${positive} positive, ${negative} negative, ${flat} flat.`;
}

function trimSentence(value: string) {
    return value.endsWith('.') ? value : `${value}.`;
}
