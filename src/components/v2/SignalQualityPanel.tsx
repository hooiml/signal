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
    const interpretationContext = signal.metadata.interpretation_context;
    const sourceToggleImpact = signal.metadata.counterfactuals?.source_toggle;

    if (!quality) return null;

    const staleInputDetail = quality.warnings.find(warning => warning.toLowerCase().includes('stale'));
    const aaiiDriver = drivers.find(driver => driver.key === 'aaii');
    const qualityItems = [
        { label: 'Freshness', value: quality.freshness, detail: quality.freshness === 'fresh' ? 'All active inputs are current' : (staleInputDetail || 'Some inputs need attention') },
        { label: 'Coverage', value: quality.source_coverage, detail: `${Object.keys(signal.components).length} active signal sources${signal.confidence.cap_reason ? ' · confidence capped' : ''}` },
        { label: 'Noise Level', value: quality.noise_level, detail: quality.noise_level === 'low' ? 'Clean source mix' : 'Informational; does not affect composite score' },
        { label: 'Regime', value: quality.market_regime, detail: 'Derived from score, VIX, and index trend' }
    ];

    return (
        <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <section className="xl:col-span-7 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-600">Signal Quality</h3>
                        <p className="mt-1 text-sm text-slate-500">Read quality first; it explains how much trust to place in the score below.</p>
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

                <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-blue-800">Confidence Meaning</div>
                    <p className="mt-1">{quality.confidence_explanation || 'Confidence measures indicator agreement, not forecast accuracy.'}</p>
                </div>

                {sourceToggleImpact && (
                    <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
                        <div className="text-[11px] font-bold uppercase tracking-widest text-indigo-800">Source Toggle Impact</div>
                        <p className="mt-1">{sourceToggleImpact.summary}</p>
                    </div>
                )}

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
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-600">Score Decomposition</h3>
                        <p className="mt-1 text-sm text-slate-500">Weighted contribution - what built the composite score.</p>
                        {sourceToggleImpact && !sourceToggleImpact.active && (
                            <p className="mt-1 text-xs text-amber-700">
                                Weights redistributed across active sources because {sourceToggleImpact.source_label} is disabled.
                            </p>
                        )}
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        auditable
                    </span>
                </div>
                <div className="mt-3 space-y-3">
                    {drivers.slice(0, 4).map(driver => (
                        <div key={driver.name} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-sm font-bold text-slate-800">{driver.name}</div>
                                    <div className="text-xs text-slate-500">
                                        {formatScoreLabel(driver)} x weight {(driver.weight * 100).toFixed(0)}%
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xl font-bold font-mono text-slate-950">{driver.contribution}</div>
                                    <div className={`text-[10px] font-bold uppercase tracking-widest ${driver.impact === 'positive' ? 'text-emerald-700' : driver.impact === 'negative' ? 'text-rose-700' : 'text-slate-500'}`}>
                                        {driver.impact}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                                <div
                                    className={`h-full rounded-full ${driver.impact === 'negative' ? 'bg-rose-500' : driver.impact === 'neutral' ? 'bg-slate-400' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.max(4, Math.min(100, Math.abs(driver.contribution)))}%` }}
                                />
                            </div>
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                                <span>{formatRawLabel(driver)}</span>
                                <span>Updated: {formatUpdatedAt(driver.last_updated)}</span>
                            </div>
                            {driver.mode_note && (
                                <div className="mt-2 rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1.5 text-xs leading-relaxed text-indigo-900">
                                    {driver.mode_note}
                                </div>
                            )}
                        </div>
                    ))}
                    {sourceToggleImpact && !sourceToggleImpact.active && (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 opacity-80">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-sm font-bold text-slate-500">{sourceToggleImpact.source_label}</div>
                                    <div className="text-xs text-slate-500">Disabled - toggle on to include this source in the composite.</div>
                                </div>
                                <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                    off
                                </span>
                            </div>
                            <div className="mt-2 text-xs leading-relaxed text-slate-500">
                                {sourceToggleImpact.with_source_score !== null && sourceToggleImpact.without_source_score !== null
                                    ? `Current comparison: ${sourceToggleImpact.with_source_score} with source vs ${sourceToggleImpact.without_source_score} without.`
                                    : sourceToggleImpact.summary}
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-4 border-t border-slate-100 pt-4">
                    <div className={labelClass}>Index Trend</div>
                    <div className="mt-1 text-xs text-slate-500">Tracked indexes used as breadth context, not separate score components.</div>
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

                {interpretationContext?.article_feed_role && (
                    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                        <span className="font-bold text-slate-800">Feed role: </span>
                        {interpretationContext.article_feed_role}
                    </div>
                )}

                {aaiiDriver && (
                    <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-900">
                        <div className="font-bold">AAII cadence</div>
                        <div className="mt-1">
                            Weekly survey. Latest survey date: {formatUpdatedAt(aaiiDriver.last_updated)}. A few days of age is normal until the next weekly release.
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
};

function formatScoreLabel(driver: NonNullable<MarketSignal['metadata']['score_drivers']>[number]) {
    if (driver.key === 'social' || driver.key === 'news') {
        return `Signal score ${driver.score.toFixed(0)} on 0-100 scale`;
    }

    return `Score ${driver.score.toFixed(0)}`;
}

function formatRawLabel(driver: NonNullable<MarketSignal['metadata']['score_drivers']>[number]) {
    if (driver.key === 'social' || driver.key === 'news') {
        return `Raw sentiment: ${clampSentiment(driver.raw_value).toFixed(2)} (-1 to +1)`;
    }

    if (driver.key === 'aaii') {
        return `Bullish: ${driver.raw_value.toFixed(1)}%`;
    }

    return `Raw: ${driver.raw_value.toFixed(1)}`;
}

function clampSentiment(value: number) {
    return Math.max(-1, Math.min(1, value));
}

function formatUpdatedAt(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}
