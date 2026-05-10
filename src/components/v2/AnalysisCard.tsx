'use client';

import React from 'react';
import { ConfidenceMetrics, MarketSignal, SignalTier } from '@/lib/types/signal-v2';
import { CockpitTheme, getThemeClasses } from './cockpit-utils';

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
    theme: CockpitTheme;
}

export const AnalysisCard = ({ tier, market, warnings, metadata, confidence, mode = 'contrarian', reasoning, theme }: AnalysisCardProps) => {
    const themeClasses = getThemeClasses(theme);
    const compositeScore = typeof metadata?.composite_score === 'number' ? metadata.composite_score : null;
    const analysis = compositeScore !== null
        ? buildEvidenceBasedAnalysis(compositeScore, market, mode, metadata, confidence)
        : (reasoning || getFallbackInterpretation(tier, market));

    return (
        <section className={`rounded-3xl border p-5 ${themeClasses.panel}`}>
            <div className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${themeClasses.textSubtle}`}>Analyst note</div>
            <p className={`mt-4 text-base leading-7 ${themeClasses.textSecondary}`}>
                {analysis}
            </p>
            {warnings.length > 0 && (
                <p className="mt-4 text-sm leading-6 text-amber-600">
                    Additional caution: {warnings[0]}
                </p>
            )}
        </section>
    );
};

function getFallbackInterpretation(tier: SignalTier, market: 'US' | 'MY') {
    if (tier === 'strong-buy') return market === 'US'
        ? 'Conditions remain deeply risk-off, so the current read favors watching for stabilization rather than assuming immediate relief.'
        : 'Bursa sentiment remains heavily depressed, so the current read favors patience until confirmation improves.';
    if (tier === 'buy') return 'Risk appetite is improving, but confirmation still matters before treating the setup as broad-based.';
    if (tier === 'neutral') return 'The current read is balanced, so the setup does not show a clear directional edge yet.';
    if (tier === 'sell') return 'Optimism is building, so the current read favors tighter risk controls rather than aggressive chasing.';
    return 'Sentiment is stretched across the current evidence layers, so the read stays cautious until pressure eases.';
}

function buildEvidenceBasedAnalysis(
    score: number,
    market: 'US' | 'MY',
    mode: 'standard' | 'contrarian',
    metadata: AnalysisCardProps['metadata'],
    confidence?: ConfidenceMetrics
) {
    const drivers = [...(metadata.score_drivers ?? [])]
        .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
        .slice(0, 2);
    const strongestDriver = drivers.find((driver) => driver.impact === 'positive') || null;
    const largestDriver = drivers[0];
    const disagreement = metadata.interpretation_context?.disagreement_note || metadata.signal_quality?.warnings?.[0] || null;
    const alignmentText = confidence
        ? `Signal alignment is ${confidence.level} because ${confidence.agreement_pct}% of active indicators align with the current read.`
        : 'Signal alignment reflects current indicator agreement rather than forecast probability.';

    const stance = getStance(score, mode, market);
    const support = strongestDriver
        ? `${strongestDriver.name} is the strongest supporting evidence right now: ${strongestDriver.detail}.`
        : largestDriver
            ? `${largestDriver.name} is the largest weighted input, but it is not currently tagged as supporting evidence.`
        : 'The read is based on the current active indicator mix.';
    const caveat = disagreement
        ? `The main caveat is ${trimSentence(disagreement.toLowerCase())}`
        : 'The main caveat is that the signal should still be read as a decision aid rather than a certainty.';

    return `${stance} ${support} ${caveat} ${alignmentText}`;
}

function getStance(score: number, mode: 'standard' | 'contrarian', market: 'US' | 'MY') {
    if (mode === 'contrarian') {
        if (score >= 85) return market === 'MY'
            ? 'The contrarian read is cautious because sentiment is stretched across the current Bursa inputs.'
            : 'The contrarian read is cautious because sentiment is stretched across the current US inputs.';
        if (score >= 65) return 'The contrarian read sees optimism building, so the setup is no longer cheap enough to ignore.';
        if (score >= 40) return 'The contrarian read is balanced because fear and optimism are still offsetting one another.';
        if (score >= 20) return 'The contrarian read is starting to favor selective accumulation because fear is becoming more visible.';
        return 'The contrarian read is alert to extreme fear, but still requires evidence that pressure is stabilizing.';
    }

    if (score >= 85) return 'The momentum read remains strong, though the setup is moving toward an optimistic extreme.';
    if (score >= 65) return 'The momentum read is leaning positive because several active inputs still support the current direction.';
    if (score >= 40) return 'The momentum read is mixed, so the setup does not yet show clean follow-through.';
    if (score >= 20) return 'The momentum read is leaning negative because bearish pressure still outweighs confirmation.';
    return 'The momentum read is strongly negative because current pressure is still broad and severe.';
}

function trimSentence(value: string) {
    return value.endsWith('.') ? value : `${value}.`;
}

