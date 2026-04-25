'use client';

import React from 'react';
import { MarketRegion, MarketMode } from '@/hooks/use-signal-config';
import { MarketSignal } from '@/lib/types/signal-v2';

interface DashboardHeaderProps {
    market: MarketRegion;
    mode: MarketMode;
    enableSocial: boolean;
    onMarketChange: (m: MarketRegion) => void;
    onModeChange: (m: MarketMode) => void;
    onSocialToggle: (enabled: boolean) => void;
    isLoaded: boolean;
    sourceToggleImpact?: NonNullable<MarketSignal['metadata']['counterfactuals']>['source_toggle'];
}

export const DashboardHeader = ({ market, mode, enableSocial, onMarketChange, onModeChange, onSocialToggle, isLoaded, sourceToggleImpact }: DashboardHeaderProps) => {
    const segmentClass = (active: boolean) =>
        `px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-widest transition-all ${active
            ? 'bg-white text-slate-900 border border-slate-200 shadow-sm'
            : 'text-slate-500 hover:text-slate-700 border border-transparent'
        }`;

    return (
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between w-full mb-7 pt-7">
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)] animate-pulse-slow" />
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">Market Desk</span>
                </div>
                <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 flex items-center">
                    Signal <span className="ml-3 rounded-md bg-indigo-50 border border-indigo-200 px-2 py-1 text-[11px] font-bold tracking-widest text-indigo-600 shadow-sm">V2.0</span>
                </h1>
                <p className="text-base text-slate-500 font-medium mt-2">
                    Institutional sentiment and market momentum dashboard
                </p>
            </div>

            <div className={`grid grid-cols-1 gap-3 sm:grid-cols-3 md:flex md:items-end md:gap-4 transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex flex-col">
                    <span className="text-[11px] uppercase font-bold text-slate-500 mb-2 tracking-widest">Target Market</span>
                    <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
                        <button onClick={() => onMarketChange('US')} className={segmentClass(market === 'US')}>
                            US
                        </button>
                        <button onClick={() => onMarketChange('MY')} className={segmentClass(market === 'MY')}>
                            MY
                        </button>
                    </div>
                </div>

                <div className="flex flex-col">
                    <span className="text-[11px] uppercase font-bold text-slate-500 mb-2 tracking-widest">Data Sources</span>
                    <label className="group relative flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-100 hover:border-indigo-300 hover:bg-slate-50 cursor-pointer transition-all duration-300">
                        <input
                            type="checkbox"
                            checked={enableSocial}
                            onChange={(e) => onSocialToggle(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-slate-300 bg-white checked:bg-indigo-600 checked:border-indigo-600 cursor-pointer accent-indigo-600"
                        />
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 group-hover:text-slate-900 transition-colors">
                            Social
                        </span>
                        <svg className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 cursor-help transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>

                        <div className="absolute left-0 bottom-full mb-2 w-72 p-3 bg-white border border-slate-200 rounded-lg text-[10px] text-slate-600 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl pointer-events-none">
                            <div className="font-bold text-indigo-700 mb-2">Social sentiment</div>
                            <div className="space-y-2 mb-3">
                                <div>Reduce noise from social media volatility.</div>
                                <div>Focus purely on institutional indicators.</div>
                                <div>Test signal strength without retail sentiment.</div>
                            </div>
                            {sourceToggleImpact && (
                                <div className="mb-3 rounded-md border border-indigo-100 bg-indigo-50 p-2 text-indigo-900">
                                    <div className="font-bold text-indigo-700">Current score impact</div>
                                    <div className="mt-1">
                                        {sourceToggleImpact.with_source_score !== null && sourceToggleImpact.without_source_score !== null
                                            ? `${sourceToggleImpact.with_source_score} with ${sourceToggleImpact.source_label} vs ${sourceToggleImpact.without_source_score} without`
                                            : sourceToggleImpact.summary}
                                    </div>
                                </div>
                            )}
                            <div className="border-t border-slate-100 pt-2 text-[9px] text-slate-500">
                                Momentum and contrarian strategies interpret the same signal differently.
                            </div>
                        </div>
                    </label>
                </div>

                <div className="flex flex-col">
                    <span className="text-[11px] uppercase font-bold text-slate-500 mb-2 tracking-widest">Signal Mode</span>
                    <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
                        <button onClick={() => onModeChange('standard')} className={`group relative ${segmentClass(mode === 'standard')}`}>
                            Momentum
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-white border border-slate-200 rounded-lg text-[9px] leading-relaxed text-slate-600 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl pointer-events-none">
                                <div className="font-bold text-indigo-700 mb-1">Momentum Mode</div>
                                Follow the trend. High scores = bullish, low scores = bearish.
                            </div>
                        </button>
                        <button onClick={() => onModeChange('contrarian')} className={`group relative ${segmentClass(mode === 'contrarian')}`}>
                            Contrarian
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-white border border-slate-200 rounded-lg text-[9px] leading-relaxed text-slate-600 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl pointer-events-none">
                                <div className="font-bold text-indigo-700 mb-1">Contrarian Mode</div>
                                Fade extremes. High scores = sell signal, low scores = buy signal.
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
