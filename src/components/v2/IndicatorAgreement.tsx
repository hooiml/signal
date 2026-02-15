'use client';

import React from 'react';
import { IndicatorData, SignalTier } from '@/lib/types/signal-v2';

interface IndicatorAgreementProps {
    indicators: IndicatorData[];
    compositeTier: SignalTier;
    mode?: 'standard' | 'contrarian';
}

export const IndicatorAgreement = ({ indicators, compositeTier, mode = 'contrarian' }: IndicatorAgreementProps) => {
    // Calculate majority signal
    const signalCounts: Record<string, number> = {};
    const activeIndicators = indicators.filter(i => i.enabled);

    activeIndicators.forEach(ind => {
        const signal = ind.signal;
        signalCounts[signal] = (signalCounts[signal] || 0) + 1;
    });

    const majoritySignal = Object.entries(signalCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] as SignalTier || 'neutral';

    const majorityCount = signalCounts[majoritySignal] || 0;
    const agreementPercent = activeIndicators.length > 0
        ? Math.round((majorityCount / activeIndicators.length) * 100)
        : 0;

    const hasConflict = compositeTier !== majoritySignal;

    const getSignalColor = (signal: SignalTier) => {
        if (signal === 'strong-buy') return 'text-emerald-400';
        if (signal === 'buy') return 'text-emerald-300';
        if (signal === 'neutral') return 'text-slate-400';
        if (signal === 'sell') return 'text-amber-300';
        return 'text-rose-400';
    };

    const getSignalDot = (signal: SignalTier) => {
        if (signal === 'strong-buy') return 'bg-emerald-500';
        if (signal === 'buy') return 'bg-emerald-400';
        if (signal === 'neutral') return 'bg-slate-500';
        if (signal === 'sell') return 'bg-amber-400';
        return 'bg-rose-500';
    };

    return (
        <div className="w-full p-4 rounded-lg border border-white/5 bg-white/[0.02]">
            <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-3">
                Indicator Agreement
            </div>

            <div className="space-y-2">
                {/* Individual Indicators */}
                {activeIndicators.map(indicator => (
                    <div key={indicator.name} className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2 flex-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${getSignalDot(indicator.signal)}`} />
                            <span className="text-slate-400 uppercase tracking-wide">{indicator.display_name}:</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`font-bold uppercase tracking-wider ${getSignalColor(indicator.signal)}`}>
                                {indicator.signal.replace('-', ' ')}
                            </span>
                            <span className="text-slate-600 font-mono text-[9px]">
                                {(indicator.weight * 100).toFixed(0)}%
                            </span>
                        </div>
                    </div>
                ))}

                {/* Divider */}
                <div className="border-t border-white/5 my-3" />

                {/* Majority Signal */}
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Majority Signal:</span>
                    <div className="flex items-center gap-2">
                        <span className={`font-bold uppercase tracking-wider text-[11px] ${getSignalColor(majoritySignal)}`}>
                            {majoritySignal.replace('-', ' ')}
                        </span>
                        <span className="text-slate-600 font-mono text-[9px]">
                            ({agreementPercent}% agreement)
                        </span>
                    </div>
                </div>

                {/* Conflict Warning */}
                {hasConflict && (
                    <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                        <div className="flex items-start gap-2">
                            <span className="text-amber-400 text-[10px]">⚠️</span>
                            <div className="flex-1">
                                <div className="text-[10px] text-amber-300 font-bold">Signal Conflict Detected</div>
                                <div className="text-[9px] text-amber-400/80 mt-0.5">
                                    Composite signal ({compositeTier.replace('-', ' ')}) differs from majority ({majoritySignal.replace('-', ' ')}).
                                    {mode === 'contrarian' ? ' This is expected in contrarian mode.' : ' Review individual indicators for context.'}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
