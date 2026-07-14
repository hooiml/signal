'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ThemeModeSwitchV2 } from '@/components/ThemeModeSwitchV2';
import type { Market } from '@/components/research/ResearchDashboardV2';
import type { ResearchActionV6, ResearchThemeV6 } from './research-v6';

export type ResearchMarketFilterV6 = 'ALL' | Market;
export type ResearchActionFilterV6 = 'ALL' | ResearchActionV6;

type ResearchHeaderV6Props = {
    theme: ResearchThemeV6;
    query: string;
    market: ResearchMarketFilterV6;
    action: ResearchActionFilterV6;
    snapshotLabel: string;
    resultCount: number;
    showResearchControls: boolean;
    onQueryChange: (query: string) => void;
    onMarketChange: (market: ResearchMarketFilterV6) => void;
    onActionChange: (action: ResearchActionFilterV6) => void;
    onThemeToggle: () => void;
};

const actionOptions: Array<{ value: ResearchActionFilterV6; label: string }> = [
    { value: 'ALL', label: 'All decisions' },
    { value: 'Ready', label: 'Ready' },
    { value: 'DCA', label: 'DCA' },
    { value: 'Wait for price', label: 'Wait for price' },
    { value: 'Watch', label: 'Watch' },
    { value: 'Avoid', label: 'Avoid' },
];

export const ResearchHeaderV6 = ({
    theme,
    query,
    market,
    action,
    snapshotLabel,
    resultCount,
    showResearchControls,
    onQueryChange,
    onMarketChange,
    onActionChange,
    onThemeToggle,
}: ResearchHeaderV6Props) => {
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const isLight = theme === 'light';
    const activeFilterCount = Number(market !== 'ALL') + Number(action !== 'ALL');
    const textPrimary = isLight ? 'text-slate-950' : 'text-[#eef2f7]';
    const textSecondary = isLight ? 'text-slate-700' : 'text-[#c8d2dd]';
    const textSubtle = isLight ? 'text-slate-500' : 'text-[#8090a2]';
    const navShell = isLight
        ? 'border-slate-300 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.06)]'
        : 'border-[#2a3948] bg-[#111a23] shadow-[0_12px_30px_rgba(0,0,0,0.2)]';
    const commandStrip = isLight
        ? 'border-slate-300 bg-white/88 shadow-[0_18px_45px_rgba(15,23,42,0.07)]'
        : 'border-[#2a3948] bg-[#111a23]/88 shadow-[0_18px_45px_rgba(0,0,0,0.24)]';
    const commandGroup = isLight
        ? 'border-slate-300 bg-white/75'
        : 'border-[#334354] bg-[#0f1720]/72';
    const fieldClass = isLight
        ? 'border-slate-300 bg-slate-50 text-slate-950 placeholder:text-slate-400 focus:border-sky-500'
        : 'border-[#334354] bg-[#0b1118] text-[#eef2f7] placeholder:text-[#718096] focus:border-sky-400';

    const segmentClass = (active: boolean) => {
        if (active) {
            return isLight
                ? 'border-sky-400 bg-sky-100 text-sky-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]'
                : 'border-sky-400/40 bg-sky-500/18 text-sky-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]';
        }
        return isLight
            ? 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            : 'border-transparent text-slate-400 hover:bg-slate-800/40 hover:text-slate-200';
    };

    return (
        <header className="relative z-20 mx-auto w-full max-w-[1280px] px-4 pt-3 min-[700px]:px-5">
            <nav className="flex min-h-12 items-center justify-between gap-4" aria-label="Primary">
                <Link href="/main-v6" className={'inline-flex min-h-10 items-center text-sm font-bold uppercase tracking-[0.18em] ' + textPrimary}>
                    Signal V6
                </Link>
                <div className={'flex items-center gap-1 rounded-lg border p-1 ' + navShell}>
                    <Link
                        href="/main-v6"
                        className={'inline-flex min-h-10 items-center rounded-md px-3 py-2 text-xs font-semibold transition-colors ' + textSecondary + (isLight ? ' hover:bg-slate-100' : ' hover:bg-slate-800/50')}
                    >
                        Market V6
                    </Link>
                    <Link
                        href="/research-v6"
                        aria-current="page"
                        className={'inline-flex min-h-10 items-center rounded-md px-3 py-2 text-xs font-semibold ' + (isLight ? 'bg-slate-950 text-white' : 'bg-emerald-300 text-slate-950')}
                    >
                        Research V6
                    </Link>
                </div>
            </nav>

            {showResearchControls ? <div className={'mt-3 rounded-2xl border p-2 backdrop-blur transition-colors min-[700px]:hidden ' + commandStrip}>
                <div className="flex gap-2">
                    <label className="min-w-0 flex-1">
                        <span className="sr-only">Ticker search</span>
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => onQueryChange(event.target.value)}
                            placeholder="Search ticker or company"
                            className={'h-10 w-full rounded-xl border px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-sky-300 dark:focus-visible:ring-offset-slate-950 ' + fieldClass}
                        />
                    </label>
                    <button
                        type="button"
                        aria-controls="research-mobile-filters"
                        aria-expanded={mobileFiltersOpen}
                        onClick={() => setMobileFiltersOpen((current) => !current)}
                        className={'min-h-10 rounded-xl border px-3 text-xs font-bold transition-colors ' + segmentClass(mobileFiltersOpen)}
                    >
                        Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
                    </button>
                </div>

                {mobileFiltersOpen ? <div id="research-mobile-filters" className={'mt-2 grid gap-2 rounded-xl border p-3 ' + commandGroup}>
                    <div>
                        <div className={'text-[10px] font-semibold uppercase tracking-[0.22em] ' + textSubtle}>Market</div>
                        <div className="mt-2 flex gap-1">
                            {(['ALL', 'US', 'MY'] as const).map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => onMarketChange(option)}
                                    aria-pressed={market === option}
                                    className={'min-h-10 rounded-xl border px-3 text-[11px] font-bold uppercase tracking-[0.16em] transition-all active:scale-95 ' + segmentClass(market === option)}
                                >
                                    {option === 'ALL' ? 'All' : option}
                                </button>
                            ))}
                        </div>
                    </div>
                    <label>
                        <span className={'text-[10px] font-semibold uppercase tracking-[0.22em] ' + textSubtle}>Decision</span>
                        <select
                            value={action}
                            onChange={(event) => onActionChange(event.target.value as ResearchActionFilterV6)}
                            className={'mt-2 h-10 w-full rounded-xl border px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sky-400/40 ' + fieldClass}
                        >
                            {actionOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                </div> : null}

                <div className="mt-2 flex items-stretch gap-2">
                    <div className={'min-w-0 flex-1 rounded-xl border px-3 py-2 ' + commandGroup}>
                        <div className={'truncate text-[11px] font-semibold ' + textSecondary}>{snapshotLabel}</div>
                        <div className={'mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ' + textSubtle}>{resultCount} ticker{resultCount === 1 ? '' : 's'}</div>
                    </div>
                    <ThemeModeSwitchV2 theme={theme} tone={theme} onToggle={onThemeToggle} className="shrink-0" />
                </div>
            </div> : <div className="mt-3 flex justify-end">
                <ThemeModeSwitchV2 theme={theme} tone={theme} onToggle={onThemeToggle} />
            </div>}

            {showResearchControls ? <div className={'mt-3 hidden rounded-2xl border px-4 py-3 backdrop-blur transition-colors min-[700px]:block ' + commandStrip}>
                <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                    <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
                        <label className={'min-w-[220px] flex-1 rounded-2xl border px-3 py-2 ' + commandGroup}>
                            <span className={'px-1 text-[10px] font-semibold uppercase tracking-[0.22em] ' + textSubtle}>Ticker search</span>
                            <input
                                type="search"
                                value={query}
                                onChange={(event) => onQueryChange(event.target.value)}
                                placeholder="Search symbol or company"
                                className={'mt-2 h-10 w-full rounded-xl border px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sky-400/40 ' + fieldClass}
                            />
                        </label>

                        <div className={'rounded-2xl border px-3 py-2 ' + commandGroup}>
                            <div className={'px-1 text-[10px] font-semibold uppercase tracking-[0.22em] ' + textSubtle}>Market</div>
                            <div className="mt-2 flex items-center gap-1">
                                {(['ALL', 'US', 'MY'] as const).map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() => onMarketChange(option)}
                                        aria-pressed={market === option}
                                        className={'min-h-10 rounded-xl border px-3 text-[11px] font-bold uppercase tracking-[0.16em] transition-all active:scale-95 ' + segmentClass(market === option)}
                                    >
                                        {option === 'ALL' ? 'All' : option}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <label className={'rounded-2xl border px-3 py-2 ' + commandGroup}>
                            <span className={'px-1 text-[10px] font-semibold uppercase tracking-[0.22em] ' + textSubtle}>Decision</span>
                            <select
                                value={action}
                                onChange={(event) => onActionChange(event.target.value as ResearchActionFilterV6)}
                                className={'mt-2 h-10 min-w-[150px] rounded-xl border px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sky-400/40 ' + fieldClass}
                            >
                                {actionOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="flex flex-wrap items-stretch gap-2">
                        <div className={'rounded-xl border px-3 py-2 ' + commandGroup}>
                            <div className={'text-[10px] font-semibold uppercase tracking-[0.22em] ' + textSubtle}>Snapshot</div>
                            <div className={'mt-1 text-sm font-semibold ' + textSecondary}>{snapshotLabel}</div>
                        </div>
                        <div className={'rounded-xl border px-3 py-2 ' + commandGroup}>
                            <div className={'text-[10px] font-semibold uppercase tracking-[0.22em] ' + textSubtle}>Results</div>
                            <div className={'mt-1 text-sm font-semibold ' + textSecondary}>{resultCount} ticker{resultCount === 1 ? '' : 's'}</div>
                        </div>
                        <ThemeModeSwitchV2 theme={theme} tone={theme} onToggle={onThemeToggle} className="self-stretch" />
                    </div>
                </div>
            </div> : null}
        </header>
    );
};
