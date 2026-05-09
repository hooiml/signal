'use client';

import React from 'react';
import { MarketSignal } from '@/lib/types/signal-v2';
import { CockpitTheme, formatDateLabel, formatDelta, formatNumber, getActiveSourceSummary, getAgreementLabel, getBroadMarketConfirmation, getConfidenceTone, getDecisionReliability, getDriverSummary, getEvidenceConcentration, getInvalidationSummary, getPrimaryCaveat, getReadHeadline, getSignalHorizon, getSourceFreshnessSummary, getThemeClasses, getTierLabel, getTierTone } from './cockpit-utils';

interface HeroDecisionPanelProps {
    signal: MarketSignal;
    mode: 'standard' | 'contrarian';
    isUpdating: boolean;
    error?: string | null;
    theme: CockpitTheme;
}

export const HeroDecisionPanel = ({ signal, mode, isUpdating, error, theme }: HeroDecisionPanelProps) => {
    const tone = getTierTone(signal.tier, theme);
    const themeClasses = getThemeClasses(theme);
    const quality = signal.metadata.signal_quality;
    const scoreDelta = signal.metadata.score_delta;
    const primaryCaveat = getPrimaryCaveat(signal);
    const agreementLabel = getAgreementLabel(signal);
    const driverSummary = getDriverSummary(signal);
    const readHeadline = getReadHeadline(signal.tier, mode);
    const decisionReliability = getDecisionReliability(signal);
    const signalHorizon = getSignalHorizon(signal);
    const broadMarketConfirmation = getBroadMarketConfirmation(signal);
    const evidenceConcentration = getEvidenceConcentration(signal);
    const invalidationSummary = getInvalidationSummary(signal);
    const marketRegime = quality?.market_regime || signal.metadata.interpretation_context?.regime || 'Regime unavailable';
    const activeSourceSummary = getActiveSourceSummary(signal);
    const freshnessSummary = getSourceFreshnessSummary(signal);
    const scoreHistory = signal.metadata.score_history?.slice(-5) || [];
    const scorePercent = Math.max(0, Math.min(100, signal.composite_score));

    return (
        <section className={`relative overflow-hidden rounded-3xl border p-5 sm:p-7 ${themeClasses.panelStrong} ${themeClasses.heroBackground}`}>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/30 to-transparent" />
            <div className={`absolute inset-y-6 left-0 w-1.5 rounded-r-full bg-gradient-to-b ${tone.rail}`} />
            <div className="grid gap-6 lg:grid-cols-[1.32fr_0.68fr] lg:items-start">
                <div className="space-y-5">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] ${themeClasses.panelMuted} ${themeClasses.textSecondary}`}>
                            Current signal
                        </span>
                        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${themeClasses.panelMuted} ${themeClasses.textSecondary}`}>
                            {mode === 'standard' ? 'Momentum follows the score direction.' : 'Contrarian fades sentiment extremes.'}
                        </span>
                        {isUpdating && (
                            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200">
                                Updating...
                            </span>
                        )}
                    </div>

                    <div className={`flex flex-wrap items-center gap-3 text-sm ${themeClasses.textMuted}`}>
                        <span className={`rounded-full border px-3 py-1 font-medium ${themeClasses.panelMuted} ${themeClasses.textSecondary}`}>Horizon: {signalHorizon}</span>
                        <span className={`rounded-full border px-3 py-1 font-medium ${themeClasses.panelMuted} ${themeClasses.textSecondary}`}>Weekly inputs included</span>
                        <span>{broadMarketConfirmation}</span>
                    </div>

                    <div className="space-y-3">
                        <div className={`text-3xl font-black tracking-tight sm:text-4xl ${themeClasses.textPrimary}`}>
                            {readHeadline}
                        </div>
                        <div className="flex flex-wrap items-end gap-4">
                            <div className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] ${tone.chip}`}>
                                Bucket: {getTierLabel(signal.tier)}
                            </div>
                            <div className="flex items-end gap-2">
                                <span className={`font-mono text-6xl font-semibold tracking-tight sm:text-7xl ${themeClasses.textPrimary}`}>{formatNumber(signal.composite_score)}</span>
                                <span className={`pb-2 text-sm font-medium uppercase tracking-[0.18em] ${themeClasses.textSubtle}`}>/100</span>
                            </div>
                            <div className={`rounded-2xl border px-4 py-3 ${themeClasses.panel}`}>
                                <div className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${themeClasses.textSubtle}`}>Delta</div>
                                <div className={`mt-1 text-2xl font-semibold ${themeClasses.textSecondary}`}>{formatDelta(scoreDelta?.delta)}</div>
                                <div className={`mt-1 text-sm ${themeClasses.textMuted}`}>{scoreDelta?.previous_date ? `Since ${formatDateLabel(scoreDelta.previous_date)}` : 'No previous snapshot'}</div>
                            </div>
                        </div>
                        <p className={`max-w-2xl text-base leading-7 sm:text-lg ${themeClasses.textMuted}`}>
                            {driverSummary}
                        </p>
                    </div>

                    <div className={`flex flex-wrap items-center gap-3 text-sm ${themeClasses.textSecondary}`}>
                        <Badge label={`Reliability ${decisionReliability}`} tone={decisionReliability === 'Limited' ? getConfidenceTone('low', theme) : decisionReliability === 'Moderate' ? getConfidenceTone('moderate', theme) : getConfidenceTone('high', theme)} />
                        <Badge label={`Confidence ${signal.confidence.level}`} tone={getConfidenceTone(signal.confidence.level, theme)} />
                        {quality && <Badge label={`Freshness ${quality.freshness}`} tone={`${themeClasses.panelMuted} ${themeClasses.textSecondary}`} />}
                        <Badge label={activeSourceSummary} tone={`${themeClasses.panelMuted} ${themeClasses.textSecondary}`} />
                        <span className={`text-sm ${themeClasses.textMuted}`}>{agreementLabel} agreement</span>
                    </div>

                    <div className={`flex flex-wrap items-center gap-3 text-sm ${themeClasses.textMuted}`}>
                        <span><span className={`font-semibold ${themeClasses.textSecondary}`}>System:</span> {isUpdating ? 'Updating' : 'Live'}</span>
                        <span><span className={`font-semibold ${themeClasses.textSecondary}`}>Signal freshness:</span> {quality?.freshness || 'Unknown'}</span>
                        <span><span className={`font-semibold ${themeClasses.textSecondary}`}>Fresh source:</span> {freshnessSummary.freshSource}</span>
                        <span><span className={`font-semibold ${themeClasses.textSecondary}`}>Stale source:</span> {freshnessSummary.staleSource}</span>
                    </div>

                    {primaryCaveat && (
                        <div className={`rounded-2xl border-l-4 px-4 py-3 text-sm leading-6 ${theme === 'light' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-amber-400 bg-amber-500/8 text-amber-100'}`}>
                            <div className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${theme === 'light' ? 'text-amber-700' : 'text-amber-200'}`}>Primary caveat</div>
                            <p className="mt-1 max-w-2xl">{primaryCaveat}</p>
                        </div>
                    )}

                    {error && (
                        <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-100">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-200">Refresh issue</div>
                            <p className="mt-1">{error}</p>
                        </div>
                    )}
                </div>

                <div className={`rounded-3xl border p-5 shadow-[inset_0_1px_0_rgba(148,163,184,0.06)] ${themeClasses.panel}`}>
                    <div className="flex items-start justify-between gap-4">
                        <div className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] ${tone.chip}`}>
                            {mode === 'standard' ? 'Momentum' : 'Contrarian'}
                        </div>
                        <div className="text-right">
                            <div className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${themeClasses.textSubtle}`}>Snapshot</div>
                            <div className={`mt-1 text-sm ${themeClasses.textSecondary}`}>{formatDateLabel(scoreDelta?.snapshot_date, true)}</div>
                        </div>
                    </div>

                    <div className={`mt-6 h-3 overflow-hidden rounded-full ${themeClasses.railBackground}`}>
                        <div
                            className={`h-full rounded-full bg-gradient-to-r ${tone.rail}`}
                            style={{ width: `${scorePercent}%` }}
                        />
                    </div>
                    <div className={`mt-2 flex justify-between text-[11px] uppercase tracking-[0.18em] ${themeClasses.textSubtle}`}>
                        <span>0 extreme pressure</span>
                        <span>100 extreme pressure</span>
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <Metric themeClasses={themeClasses} label="Previous score" value={formatNumber(scoreDelta?.previous_score)} detail={scoreDelta?.previous_date ? formatDateLabel(scoreDelta.previous_date) : 'No previous snapshot'} />
                        <Metric themeClasses={themeClasses} label="Read posture" value={mode === 'standard' ? 'Trend following' : 'Crowding aware'} detail={mode === 'standard' ? 'Uses the current score direction directly' : 'Treats stretched optimism and fear as risk states'} />
                        <Metric themeClasses={themeClasses} label="Agreement" value={`${signal.confidence.agreement_pct}%`} detail={isUpdating ? 'Refreshing current signal' : 'Active indicator alignment'} />
                        <Metric themeClasses={themeClasses} label="Warnings" value={`${quality?.warnings.length ?? 0}`} detail={quality?.warnings[0] || 'No active warning is currently overriding the read'} />
                    </div>

                    <div className={`mt-4 rounded-2xl border p-4 ${themeClasses.panelMuted}`}>
                        <div className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${themeClasses.textSubtle}`}>Market frame</div>
                        <div className={`mt-3 border-t ${themeClasses.divider}`}>
                            <MarketFrameRow themeClasses={themeClasses} label="Regime" value={marketRegime} />
                            <MarketFrameRow themeClasses={themeClasses} label="Breadth" value={broadMarketConfirmation} />
                            <MarketFrameRow themeClasses={themeClasses} label="Invalidation" value={invalidationSummary} />
                        </div>
                        <div className={`mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs ${themeClasses.textMuted}`}>
                            {scoreHistory.length > 1 && (
                                <span><span className={`font-semibold ${themeClasses.textSecondary}`}>Recent path:</span> {scoreHistory.map((entry) => entry.score).join(' -> ')}</span>
                            )}
                            <span><span className={`font-semibold ${themeClasses.textSecondary}`}>Confluence breadth:</span> {evidenceConcentration}</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

const Badge = ({ label, tone }: { label: string; tone: string }) => (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${tone}`}>
        {label}
    </span>
);

const Metric = ({ label, value, detail, themeClasses }: { label: string; value: string; detail: string; themeClasses: ReturnType<typeof getThemeClasses> }) => (
    <div className={`rounded-2xl border p-3 ${themeClasses.panelMuted}`}>
        <div className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${themeClasses.textSubtle}`}>{label}</div>
        <div className={`mt-2 text-lg font-semibold ${themeClasses.textSecondary}`}>{value}</div>
        <div className={`mt-1 text-sm leading-6 ${themeClasses.textMuted}`}>{detail}</div>
    </div>
);

const MarketFrameRow = ({ label, value, themeClasses }: { label: string; value: string; themeClasses: ReturnType<typeof getThemeClasses> }) => (
    <div className={`grid gap-2 border-b py-3 sm:grid-cols-[110px_1fr] sm:items-start ${themeClasses.divider}`}>
        <span className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${themeClasses.textSubtle}`}>{label}</span>
        <span className={`text-sm leading-6 ${themeClasses.textSecondary}`}>{value}</span>
    </div>
);

