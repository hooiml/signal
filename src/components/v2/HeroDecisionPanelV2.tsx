'use client';

import React from 'react';
import { MarketSignal } from '@/lib/types/signal-v2';
import { CockpitTheme, formatDateLabel, formatDelta, formatNumber, getActiveSourceSummary, getConfidenceTone, getDecisionReliability, getDriverSummary, getPrimaryCaveat, getReadHeadline, getReadStateLabel, getSignalHorizon, getThemeClasses, getTierTone } from './cockpit-utils';

interface HeroDecisionPanelProps {
    signal: MarketSignal;
    mode: 'standard' | 'contrarian';
    isUpdating: boolean;
    error?: string | null;
    theme: CockpitTheme;
}

export const HeroDecisionPanelV2 = ({ signal, mode, isUpdating, error, theme }: HeroDecisionPanelProps) => {
    const tone = getTierTone(signal.tier, theme);
    const themeClasses = getThemeClasses(theme);
    const quality = signal.metadata.signal_quality;
    const scoreDelta = signal.metadata.score_delta;
    const primaryCaveat = getPrimaryCaveat(signal);
    const driverSummary = getDriverSummary(signal);
    const readHeadline = getReadHeadline(signal.tier, mode);
    const decisionReliability = getDecisionReliability(signal);
    const signalHorizon = getSignalHorizon(signal) === 'Not model-defined' ? null : getSignalHorizon(signal);
    const activeSourceSummary = getActiveSourceSummary(signal);
    const scorePercent = Math.max(0, Math.min(100, signal.composite_score));
    const scoreMovement = getScoreMovementText(scoreDelta);
    const reliabilityTone = decisionReliability === 'Limited'
        ? getConfidenceTone('low', theme)
        : decisionReliability === 'Moderate'
            ? getConfidenceTone('moderate', theme)
            : getConfidenceTone('high', theme);
    const scoreLabel = mode === 'standard' ? 'Momentum score' : 'Crowding risk score';
    const modeBadge = mode === 'standard' ? 'Momentum read' : 'Contrarian risk read';
    const modeHelper = mode === 'standard' ? 'Follows current directional pressure.' : 'Reads high optimism as crowding risk.';
    const heroAccent = mode === 'contrarian'
        ? theme === 'light'
            ? 'bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.22),_transparent_34%),linear-gradient(160deg,_rgba(255,255,255,1),_rgba(255,251,235,0.8))]'
            : 'bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.16),_transparent_34%),linear-gradient(160deg,_rgba(15,23,42,0.98),_rgba(30,41,59,0.92))]'
        : themeClasses.heroBackground;

    return (
        <section className={`relative overflow-hidden rounded-3xl border p-5 sm:p-7 transition-all duration-300 ${themeClasses.panelStrong} ${heroAccent}`}>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/35 to-transparent" />
            <div className={`absolute inset-y-6 left-0 w-1.5 rounded-r-full bg-gradient-to-b transition-all duration-300 ${tone.rail}`} />
            <div className="grid gap-6 lg:grid-cols-[1fr_0.72fr] lg:items-start">
                <div className="space-y-5">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] transition-all ${themeClasses.panelMuted} ${themeClasses.textSecondary}`}>
                            {modeBadge}
                        </span>
                        <span className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${themeClasses.panelMuted} ${themeClasses.textSecondary}`}>
                            {modeHelper}
                        </span>
                        {isUpdating && (
                            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200 animate-pulse">
                                Updating...
                            </span>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className={`text-3xl font-black tracking-tight sm:text-4xl transition-all duration-300 ${themeClasses.textPrimary}`}>
                            {readHeadline}
                        </div>
                        <p className={`max-w-3xl text-base leading-7 sm:text-lg transition-all ${themeClasses.textMuted}`}>
                            {getReadExplainer(signal, mode)}
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] transition-all ${tone.chip}`}>
                                Read state: {getReadStateLabel(signal.tier, mode)}
                            </span>
                            {signalHorizon && (
                                <span className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${themeClasses.panelMuted} ${themeClasses.textSecondary}`}>
                                    Horizon: {signalHorizon}
                                </span>
                            )}
                        </div>
                        <p className={`max-w-2xl text-base leading-7 sm:text-lg transition-all ${themeClasses.textMuted}`}>
                            {driverSummary}
                        </p>
                    </div>

                    {primaryCaveat && (
                        <div className={`rounded-2xl border-l-4 px-4 py-3 text-sm leading-6 transition-all duration-300 ${theme === 'light' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-amber-400 bg-amber-500/8 text-amber-100'}`}>
                            <div className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${theme === 'light' ? 'text-amber-700' : 'text-amber-200'}`}>Data caveat</div>
                            <p className="mt-1 max-w-2xl">{getCompactCaveat(signal, primaryCaveat)}</p>
                        </div>
                    )}

                    {error && (
                        <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-100 transition-all">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-200">Refresh issue</div>
                            <p className="mt-1">{error}</p>
                        </div>
                    )}
                </div>

                <div className={`rounded-3xl border p-5 shadow-[inset_0_1px_0_rgba(148,163,184,0.06)] transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.15)] ${themeClasses.panel}`}>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${themeClasses.textSubtle}`}>{scoreLabel}</div>
                            <div className="mt-2 flex items-end gap-2">
                                <span className={`font-mono text-6xl font-semibold tracking-tight sm:text-7xl ${themeClasses.textPrimary}`}>{formatNumber(signal.composite_score)}</span>
                                <span className={`pb-3 text-sm font-medium uppercase tracking-[0.18em] ${themeClasses.textSubtle}`}>/100</span>
                            </div>
                        </div>
                        <div className="shrink-0 text-right">
                            <div className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${themeClasses.textSubtle}`}>Snapshot</div>
                            <div className={`mt-1 text-sm ${themeClasses.textSecondary}`}>{formatDateLabel(scoreDelta?.snapshot_date, true)}</div>
                        </div>
                    </div>

                    <div className="mt-5">
                        <ScoreZoneBar score={scorePercent} mode={mode} theme={theme} themeClasses={themeClasses} />
                    </div>

                    <div className="mt-4 grid gap-3">
                        <div className={`rounded-2xl border px-4 py-3 transition-all duration-300 ${scoreMovement.isUnchanged ? themeClasses.panelMuted : themeClasses.panelSoft}`}>
                            <div className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${themeClasses.textSubtle}`}>{scoreMovement.label}</div>
                            <div className={`mt-1 text-xl font-semibold ${scoreMovement.isUnchanged ? themeClasses.textSecondary : themeClasses.textPrimary}`}>{scoreMovement.value}</div>
                            <div className={`mt-1 text-sm ${themeClasses.textMuted}`}>{scoreMovement.detail}</div>
                        </div>
                        <div className={`rounded-2xl border px-4 py-3 transition-all duration-300 ${themeClasses.panelMuted}`}>
                            <div className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${themeClasses.textSubtle}`}>Reliability</div>
                            <div className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-semibold transition-all ${reliabilityTone}`}>
                                {decisionReliability}
                            </div>
                            <p className={`mt-2 text-sm leading-6 ${themeClasses.textMuted}`}>
                                {getReliabilitySummary(decisionReliability, activeSourceSummary, quality?.freshness)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

const ScoreZoneBar = ({ score, mode, theme, themeClasses }: { score: number; mode: 'standard' | 'contrarian'; theme: CockpitTheme; themeClasses: ReturnType<typeof getThemeClasses> }) => {
    const markerLeft = `${Math.max(2, Math.min(98, score))}%`;
    const markerTone = theme === 'light' ? 'border-slate-950 bg-white text-slate-950' : 'border-white bg-slate-950 text-white';
    const zoneText = theme === 'light' ? 'text-slate-700' : 'text-slate-300';
    const isContrarian = mode === 'contrarian';
    const helperText = isContrarian
        ? 'Higher scores indicate greater crowding risk. Model breakpoints, not validated return thresholds.'
        : 'Model breakpoints, not validated return thresholds';
    const zones = isContrarian
        ? [
            { className: 'left-0 rounded-l-full bg-emerald-500/75', style: { width: '40%' }, mobile: 'Low', desktop: 'Low risk', range: '0-39' },
            { className: 'bg-sky-500/70', style: { left: '40%', width: '25%' }, mobile: 'Elev.', desktop: 'Elevated', range: '40-64' },
            { className: 'bg-amber-500/75', style: { left: '65%', width: '20%' }, mobile: 'Caut.', desktop: 'Cautionary', range: '65-84' },
            { className: 'right-0 rounded-r-full bg-rose-500/80', style: { width: '15%' }, mobile: 'Extreme', desktop: 'Extreme risk', range: '85-100' },
        ]
        : [
            { className: 'left-0 rounded-l-full bg-rose-500/70', style: { width: '40%' }, mobile: 'Neg.', desktop: 'Negative', range: '0-39' },
            { className: 'bg-sky-500/70', style: { left: '40%', width: '25%' }, mobile: 'Mixed', desktop: 'Mixed', range: '40-64' },
            { className: 'bg-emerald-500/70', style: { left: '65%', width: '20%' }, mobile: 'Pos.', desktop: 'Positive', range: '65-84' },
            { className: 'right-0 rounded-r-full bg-lime-400/80', style: { width: '15%' }, mobile: 'Strong+', desktop: 'Strong positive', range: '85-100' },
        ];

    return (
        <div className={`rounded-2xl border px-4 py-3 transition-all ${themeClasses.panelMuted}`}>
            <div className="flex items-center justify-between gap-3">
                <div className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${themeClasses.textSubtle}`}>Score zone</div>
                <div className={`text-xs ${themeClasses.textMuted}`}>{helperText}</div>
            </div>
            <div className="relative mt-4 h-4 rounded-full bg-slate-800/40">
                {zones.map((zone) => (
                    <div key={zone.desktop} className={`absolute inset-y-0 ${zone.className}`} style={zone.style} />
                ))}
                <div
                    className={`absolute top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-[10px] font-bold shadow-lg transition-all duration-300 ${markerTone}`}
                    style={{ left: markerLeft }}
                    aria-label={`Current score ${Math.round(score)} on score zone bar`}
                >
                    {Math.round(score)}
                </div>
            </div>
            <div className={`mt-3 grid grid-cols-4 gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] ${zoneText}`}>
                {zones.map((zone) => (
                    <span key={zone.desktop}>
                        <span className="sm:hidden">{zone.mobile}</span>
                        <span className="hidden sm:inline">{zone.desktop}</span>
                        <span className={`hidden sm:inline ${themeClasses.textSubtle}`}> {zone.range}</span>
                    </span>
                ))}
            </div>
        </div>
    );
};

function getCompactCaveat(signal: MarketSignal, fallback: string) {
    const staleEntry = Object.values(signal.components)
        .filter((component) => component.enabled)
        .find((component) => fallback.toLowerCase().includes(component.name.toLowerCase()) || fallback.toLowerCase().includes(component.display_name.toLowerCase()));

    if (!staleEntry) return fallback;

    const date = new Date(staleEntry.last_updated);
    const dateLabel = Number.isNaN(date.getTime())
        ? staleEntry.last_updated
        : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    return `Stale source: ${staleEntry.display_name} - ${dateLabel}`;
}

function getReadExplainer(signal: MarketSignal, mode: 'standard' | 'contrarian') {
    if (mode === 'contrarian') {
        if (signal.composite_score >= 65) {
            return 'A high score means crowding risk is elevated, not that the market looks attractive.';
        }

        if (signal.composite_score <= 39) {
            return 'Fear may be overdone, but confirmation still matters before treating it as durable relief.';
        }

        return 'Fear and optimism are offsetting each other, so the contrarian read is not stretched enough to dominate.';
    }

    if (signal.composite_score >= 65) {
        return 'Current inputs show positive pressure, but this is market interpretation rather than a trading instruction.';
    }

    if (signal.composite_score <= 39) {
        return 'Current inputs show negative pressure, so confirmation matters before assuming conditions have stabilized.';
    }

    return 'Inputs are not aligned enough to support a clear directional read.';
}

function getReliabilitySummary(reliability: string, activeSourceSummary: string, freshness: string | undefined) {
    if (reliability === 'Limited') {
        return `${activeSourceSummary}; ${freshness || 'unknown'} freshness. Treat this read as directional only.`;
    }

    if (reliability === 'Moderate') {
        return `${activeSourceSummary}; ${freshness || 'unknown'} freshness. Details are below.`;
    }

    return `${activeSourceSummary}; ${freshness || 'unknown'} freshness. Still not a forecast probability.`;
}

function getScoreMovementText(scoreDelta: MarketSignal['metadata']['score_delta']) {
    if (!scoreDelta || scoreDelta.previous_score === null || scoreDelta.delta === null) {
        return {
            label: 'Previous snapshot',
            value: 'Unavailable',
            detail: 'No previous snapshot',
            isUnchanged: false,
        };
    }

    if (scoreDelta.delta === 0) {
        return {
            label: 'Score context',
            value: getUnchangedDuration(scoreDelta.previous_date, scoreDelta.snapshot_date),
            detail: `Previous score ${scoreDelta.previous_score}`,
            isUnchanged: true,
        };
    }

    return {
        label: 'Since previous snapshot',
        value: formatDelta(scoreDelta.delta),
        detail: scoreDelta.previous_date ? `Since ${formatDateLabel(scoreDelta.previous_date)}` : 'No previous snapshot',
        isUnchanged: false,
    };
}

function getUnchangedDuration(previousDate: string | null, snapshotDate: string) {
    if (!previousDate) return 'Unchanged';

    const previous = new Date(previousDate);
    const current = new Date(snapshotDate);
    if (Number.isNaN(previous.getTime()) || Number.isNaN(current.getTime())) {
        return 'Unchanged';
    }

    const dayCount = Math.max(1, Math.round((current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24)));
    return `Unchanged for ${dayCount} day${dayCount === 1 ? '' : 's'}`;
}
