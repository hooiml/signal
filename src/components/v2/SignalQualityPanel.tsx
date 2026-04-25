'use client';

import React from 'react';
import { MarketSignal } from '@/lib/types/signal-v2';

interface SignalQualityPanelProps {
    signal: MarketSignal;
}

const labelClass = 'text-[11px] font-bold uppercase tracking-widest text-slate-500';

const getBadgeClass = (value: string) => {
    if (['fresh', 'strong', 'low', 'positive'].includes(value)) {
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
    if (['mixed', 'moderate', 'flat'].includes(value)) {
        return 'bg-amber-50 text-amber-800 border-amber-200';
    }
    return 'bg-rose-50 text-rose-800 border-rose-200';
};

export const SignalQualityPanel = ({ signal }: SignalQualityPanelProps) => {
    const quality = signal.metadata.signal_quality;
    const drivers = signal.metadata.score_drivers || [];
    const indices = signal.metadata.index_trend || [];
    const trendContext = signal.metadata.trend_context;

    if (!quality) return null;

    const staleInputDetail = quality.warnings.find(warning => warning.toLowerCase().includes('stale'));
    const qualityItems = [
        { label: 'Freshness', value: quality.freshness, detail: quality.freshness === 'fresh' ? 'All active inputs are current' : (staleInputDetail || 'Some inputs need attention') },
        { label: 'Coverage', value: quality.source_coverage, detail: `${Object.keys(signal.components).length} active signal sources` },
        { label: 'Noise Level', value: quality.noise_level, detail: quality.noise_level === 'low' ? 'Clean source mix' : 'Validate social/news context' },
        { label: 'Regime', value: quality.market_regime, detail: 'Derived from score, VIX, and index trend' }
    ];

    return (
        <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <section className="xl:col-span-7 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-600">Signal Quality</h3>
                        <p className="mt-1 text-sm text-slate-500">Use this before treating the signal as market direction.</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${getBadgeClass(quality.freshness)}`}>
                        {quality.freshness}
                    </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {qualityItems.map(item => (
                        <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className={labelClass}>{item.label}</div>
                            <div className="mt-2 text-xl font-bold capitalize text-slate-950">{item.value}</div>
                            <div className="mt-1 text-sm text-slate-500">{item.detail}</div>
                        </div>
                    ))}
                </div>

                {quality.warnings.length > 0 && (
                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <div className="text-[11px] font-bold uppercase tracking-widest text-amber-800">Readiness Warnings</div>
                        <ul className="mt-2 space-y-1 text-sm text-amber-800">
                            {quality.warnings.map(warning => (
                                <li key={warning}>- {warning}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </section>

            <section className="xl:col-span-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-600">Why This Signal?</h3>
                <div className="mt-3 space-y-3">
                    {drivers.slice(0, 4).map(driver => (
                        <div key={driver.name} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div>
                                <div className="text-sm font-bold text-slate-800">{driver.name}</div>
                                <div className="text-xs text-slate-500">{driver.detail}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-xl font-bold font-mono text-slate-950">{driver.contribution}</div>
                                <div className={`text-[10px] font-bold uppercase tracking-widest ${driver.impact === 'positive' ? 'text-emerald-700' : driver.impact === 'negative' ? 'text-rose-700' : 'text-slate-500'}`}>
                                    {driver.impact}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-4 border-t border-slate-100 pt-4">
                    <div className={labelClass}>Index Trend</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {indices.length > 0 ? indices.map(index => (
                            <span key={index.symbol} className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${getBadgeClass(index.trend)}`}>
                                {index.symbol}: {index.changePercent >= 0 ? '+' : ''}{index.changePercent.toFixed(2)}%
                            </span>
                        )) : (
                            <span className="text-sm text-slate-500">Index trend unavailable.</span>
                        )}
                    </div>
                </div>

                {trendContext && (
                    <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
                        <div className="font-bold">Historical context</div>
                        <div className="mt-1">{trendContext.note}</div>
                    </div>
                )}
            </section>
        </div>
    );
};
