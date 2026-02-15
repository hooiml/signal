
'use client';

import React from 'react';
import { MarketRegion, MarketMode } from '@/hooks/use-signal-config';

interface DashboardHeaderProps {
    market: MarketRegion;
    mode: MarketMode;
    enableSocial: boolean;
    onMarketChange: (m: MarketRegion) => void;
    onModeChange: (m: MarketMode) => void;
    onSocialToggle: (enabled: boolean) => void;
    isLoaded: boolean;
}

export const DashboardHeader = ({ market, mode, enableSocial, onMarketChange, onModeChange, onSocialToggle, isLoaded }: DashboardHeaderProps) => {
    return (
        <div className="flex flex-col md:flex-row justify-between items-center w-full mb-8 pt-4">
            <div className="mb-4 md:mb-0">
                <h1 className="text-3xl font-black tracking-tighter uppercase italic flex items-center">
                    Signal <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-600 text-[10px] font-bold not-italic tracking-widest text-white align-middle">V2.0</span>
                </h1>
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mt-1">
                    Institutional Sentiment Engine (DSS)
                </p>
            </div>

            <div className={`flex items-center space-x-6 transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
                {/* Market Toggle */}
                <div className="flex flex-col items-center md:items-end">
                    <span className="text-[9px] uppercase font-bold text-slate-500 mb-2 tracking-widest text-right">Target Market</span>
                    <div className="flex bg-white/5 rounded-full p-1 border border-white/5">
                        <button
                            onClick={() => onMarketChange('US')}
                            className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${market === 'US' ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            United States
                        </button>
                        <button
                            onClick={() => onMarketChange('MY')}
                            className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${market === 'MY' ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            Malaysia
                        </button>
                    </div>
                </div>

                {/* Social Sentiment Toggle */}
                <div className="flex flex-col items-center md:items-end">
                    <span className="text-[9px] uppercase font-bold text-slate-500 mb-2 tracking-widest text-right">Data Sources</span>
                    <label className="group relative flex items-center gap-2 px-3 py-2 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-colors">
                        <input
                            type="checkbox"
                            checked={enableSocial}
                            onChange={(e) => onSocialToggle(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 checked:bg-blue-600 checked:border-blue-600 cursor-pointer"
                        />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                            Social Sentiment
                        </span>
                        <svg className="w-3 h-3 text-slate-500 hover:text-blue-400 cursor-help transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>

                        {/* Enhanced Tooltip */}
                        <div className="absolute left-0 bottom-full mb-2 w-72 p-3 bg-slate-900 border border-white/10 rounded-lg text-[10px] text-slate-300 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-2xl pointer-events-none">
                            <div className="font-bold text-blue-400 mb-2">Why Toggle Social Sentiment?</div>

                            <div className="space-y-2 mb-3">
                                <div className="flex items-start gap-1.5">
                                    <span className="text-green-400 mt-0.5">✓</span>
                                    <span>Reduce noise from social media volatility</span>
                                </div>
                                <div className="flex items-start gap-1.5">
                                    <span className="text-green-400 mt-0.5">✓</span>
                                    <span>Focus purely on institutional indicators</span>
                                </div>
                                <div className="flex items-start gap-1.5">
                                    <span className="text-green-400 mt-0.5">✓</span>
                                    <span>Test signal strength without retail sentiment</span>
                                </div>
                            </div>

                            <div className="border-t border-white/10 pt-2">
                                <div className="font-bold text-amber-400 mb-1">📚 Important:</div>
                                <p className="text-[9px] leading-relaxed text-slate-400">
                                    Both momentum and contrarian strategies benefit from social sentiment data - they just <strong className="text-white">interpret it differently</strong>.
                                    Contrarians use sentiment as a <strong className="text-white">counter-indicator</strong> to fade extremes.
                                </p>
                            </div>
                        </div>
                    </label>
                    <span className="text-[8px] text-slate-600 mt-1">Reddit + StockTwits</span>
                </div>

                {/* Mode Toggle */}
                <div className="flex flex-col items-center md:items-end">
                    <span className="text-[9px] uppercase font-bold text-slate-500 mb-2 tracking-widest text-right">Signal Mode</span>
                    <div className="flex bg-white/5 rounded-full p-1 border border-white/5">
                        <button
                            onClick={() => onModeChange('standard')}
                            className={`group relative px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-1.5 ${mode === 'standard' ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            <span className="text-sm">📈</span>
                            Momentum
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 border border-white/10 rounded-lg text-[9px] leading-relaxed text-slate-300 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl pointer-events-none">
                                <div className="font-bold text-blue-400 mb-1">Momentum Mode</div>
                                Follow the trend. High scores = bullish, low scores = bearish. Best for trending markets.
                            </div>
                        </button>
                        <button
                            onClick={() => onModeChange('contrarian')}
                            className={`group relative px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-1.5 ${mode === 'contrarian' ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            <span className="text-sm">🔄</span>
                            Contrarian
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 border border-white/10 rounded-lg text-[9px] leading-relaxed text-slate-300 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl pointer-events-none">
                                <div className="font-bold text-blue-400 mb-1">Contrarian Mode</div>
                                Fade extremes. High scores = sell signal, low scores = buy signal. Best for range-bound markets.
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
