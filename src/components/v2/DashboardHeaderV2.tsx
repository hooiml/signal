'use client';

import React from 'react';
import { MarketRegion, MarketMode } from '@/hooks/use-signal-config';
import { MarketSignal } from '@/lib/types/signal-v2';
import { CockpitTheme, getThemeClasses, formatDateLabel } from './cockpit-utils';
import { ThemeModeSwitchV2 } from '@/components/ThemeModeSwitchV2';

interface DashboardHeaderProps {
    market: MarketRegion;
    mode: MarketMode;
    enableSocial: boolean;
    onMarketChange: (m: MarketRegion) => void;
    onModeChange: (m: MarketMode) => void;
    onSocialToggle: (enabled: boolean) => void;
    isLoaded: boolean;
    isUpdating?: boolean;
    lastCheckedAt?: Date | null;
    onRefresh?: () => void;
    snapshotDate?: string | null;
    sourceToggleImpact?: NonNullable<MarketSignal['metadata']['counterfactuals']>['source_toggle'];
    theme: CockpitTheme;
    onThemeToggle: () => void;
}

export const DashboardHeaderV2 = ({
    market,
    mode,
    enableSocial,
    onMarketChange,
    onModeChange,
    onSocialToggle,
    isLoaded,
    isUpdating = false,
    lastCheckedAt = null,
    onRefresh,
    snapshotDate,
    sourceToggleImpact,
    theme,
    onThemeToggle,
}: DashboardHeaderProps) => {
    const themeClasses = getThemeClasses(theme);

    const editableShell = `rounded-xl border px-2 py-2 transition-all sm:rounded-2xl sm:px-3 ${themeClasses.commandGroup}`;
    const metaShell = theme === 'light'
        ? 'rounded-xl border border-slate-200 bg-slate-50/90 px-2.5 py-2 transition-all sm:px-3'
        : 'rounded-xl border border-slate-800 bg-slate-900/45 px-2.5 py-2 transition-all sm:px-3';

    const segmentClass = (active: boolean) => {
        if (active) {
            return theme === 'light'
                ? 'rounded-xl border border-sky-400 bg-sky-100 px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition-all active:scale-95 duration-100 sm:px-3 sm:text-[11px] sm:tracking-[0.16em]'
                : 'rounded-xl border border-sky-400/40 bg-sky-500/18 px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all active:scale-95 duration-100 sm:px-3 sm:text-[11px] sm:tracking-[0.16em]';
        }

        return theme === 'light'
            ? 'rounded-xl border border-transparent px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all active:scale-95 duration-100 sm:px-3 sm:text-[11px] sm:tracking-[0.16em]'
            : 'rounded-xl border border-transparent px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition-all active:scale-95 duration-100 sm:px-3 sm:text-[11px] sm:tracking-[0.16em]';
    };

    const sourceImpactText = sourceToggleImpact
        ? (sourceToggleImpact.with_source_score !== null && sourceToggleImpact.without_source_score !== null
            ? `Without ${sourceToggleImpact.source_label.toLowerCase()}: ${sourceToggleImpact.without_source_score} (${sourceToggleImpact.delta_without_source === null ? 'n/a' : `${sourceToggleImpact.delta_without_source > 0 ? '+' : ''}${sourceToggleImpact.delta_without_source}`})`
            : sourceToggleImpact.summary)
        : null;
    const sourceToggleLabel = sourceToggleImpact?.source_label || (market === 'MY' ? 'News Sentiment' : 'Social Sentiment');
    const compactSourceLabel = sourceToggleLabel.replace(/\s+sentiment$/i, '');
    const lastCheckedLabel = lastCheckedAt
        ? lastCheckedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })
        : 'Not checked yet';
    const refreshShell = theme === 'light'
        ? 'border-slate-200 bg-slate-50/90 text-slate-700 hover:border-emerald-400 hover:bg-emerald-50 focus-visible:outline-emerald-500'
        : 'border-slate-800 bg-slate-900/45 text-slate-200 hover:border-emerald-400/60 hover:bg-emerald-500/10 focus-visible:outline-emerald-400';

    return (
        <div className={`relative z-20 mb-5 rounded-2xl border px-3 py-2 backdrop-blur transition-all duration-300 sm:px-4 sm:py-3 ${themeClasses.commandStrip} ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <div className={editableShell} role="group" aria-label="Market">
                            <div className={`px-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${themeClasses.textSubtle}`}>Market</div>
                            <div className="mt-2 flex items-center gap-1">
                                <button type="button" aria-pressed={market === 'US'} onClick={() => onMarketChange('US')} className={segmentClass(market === 'US')}>US</button>
                                <button type="button" aria-pressed={market === 'MY'} onClick={() => onMarketChange('MY')} className={segmentClass(market === 'MY')}>MY</button>
                            </div>
                        </div>

                        <div className={editableShell} role="group" aria-label="Interpretation mode">
                            <div className={`px-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${themeClasses.textSubtle}`}>Mode</div>
                            <div className="mt-2 flex items-center gap-1">
                                <button type="button" aria-pressed={mode === 'standard'} onClick={() => onModeChange('standard')} className={segmentClass(mode === 'standard')}>Momentum</button>
                                <button type="button" aria-pressed={mode === 'contrarian'} onClick={() => onModeChange('contrarian')} className={segmentClass(mode === 'contrarian')}>Contrarian</button>
                            </div>
                        </div>
                    </div>

                    <div className={`flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 transition-all sm:gap-3 sm:rounded-2xl sm:px-3 ${themeClasses.commandGroup}`}>
                        <span className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${themeClasses.textSubtle}`}>Source</span>
                        <span className={`text-sm font-semibold ${themeClasses.textSecondary}`}>{compactSourceLabel} {enableSocial ? 'on' : 'off'}</span>
                        <label className="relative inline-flex h-5 w-10 items-center cursor-pointer select-none active:scale-95 duration-100 transition-all">
                            <input
                                type="checkbox"
                                checked={enableSocial}
                                onChange={(event) => onSocialToggle(event.target.checked)}
                                aria-label={'Toggle ' + sourceToggleLabel}
                                className="peer sr-only"
                            />
                            <span className={`absolute inset-0 rounded-full transition-all duration-300 ${enableSocial ? 'bg-emerald-500' : theme === 'light' ? 'bg-slate-300' : 'bg-slate-700'}`} />
                            <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-300 ${enableSocial ? 'translate-x-5' : 'translate-x-0'}`} />
                        </label>
                        {sourceImpactText && (
                            <span title={sourceImpactText} className={`min-w-0 flex-1 truncate text-xs sm:text-sm ${themeClasses.textMuted}`}>- {sourceImpactText}</span>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                    <div className={metaShell}>
                        <div className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${themeClasses.textSubtle}`}>Snapshot</div>
                        <div className={`mt-1 text-sm font-semibold ${themeClasses.textSecondary}`}>{snapshotDate ? formatDateLabel(snapshotDate, true) : 'Waiting for snapshot'}</div>
                    </div>
                    <div className={metaShell}>
                        <div className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${themeClasses.textSubtle}`}>Status</div>
                        <div aria-live="polite" className={`mt-1 flex items-center gap-2 text-sm font-semibold ${themeClasses.textSecondary}`}>
                            <span className={`h-2 w-2 rounded-full ${isUpdating ? 'bg-sky-400 animate-pulse' : 'bg-emerald-500'}`} />
                            {isUpdating ? 'Updating' : 'Live'}
                        </div>
                    </div>
                    {onRefresh ? (
                        <button
                            type="button"
                            onClick={onRefresh}
                            disabled={!isLoaded || isUpdating}
                            className={`min-h-14 min-w-[132px] rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-55 ${refreshShell}`}
                        >
                            <span className="block text-[10px] font-semibold uppercase tracking-[0.22em]">Refresh</span>
                            <span className="mt-1 block whitespace-nowrap text-sm font-semibold">{isUpdating ? 'Checking...' : lastCheckedLabel}</span>
                        </button>
                    ) : null}
                    <ThemeModeSwitchV2 theme={theme} tone={theme} onToggle={onThemeToggle} className="self-stretch" />
                </div>
            </div>
        </div>
    );
};
