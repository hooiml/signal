'use client';

import { useState } from 'react';
import type { Market } from '@/components/research/ResearchDashboardV2';
import type { ResearchActionV6, ResearchThemeV6 } from './research-v6';
import { AppNavV6 } from './AppNavV6';

export type ResearchMarketFilterV6 = 'ALL' | Market;
export type ResearchActionFilterV6 = 'ALL' | ResearchActionV6;

type ResearchHeaderV6Props = {
    theme: ResearchThemeV6;
    query: string;
    market: ResearchMarketFilterV6;
    action: ResearchActionFilterV6;
    reviewedLabel: string;
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
    reviewedLabel,
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
    const textSecondary = isLight ? 'text-slate-700' : 'text-[#c8d2dd]';
    const textSubtle = isLight ? 'text-slate-500' : 'text-[#8090a2]';
    const filterPanel = isLight
        ? 'bg-slate-50/80'
        : 'bg-[#0f1720]/62';
    const commandDivider = isLight
        ? 'xl:border-l xl:border-slate-200 xl:pl-6'
        : 'xl:border-l xl:border-[#263444] xl:pl-6';
    const headerDivider = isLight ? 'border-slate-200' : 'border-[#263444]';
    const fieldClass = isLight
        ? 'border-slate-300 bg-slate-50 text-slate-950 placeholder:text-slate-400 focus:border-emerald-500'
        : 'border-[#334354] bg-[#0b1118] text-[#eef2f7] placeholder:text-[#718096] focus:border-emerald-400';
    const focusClass = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500';

    const segmentClass = (active: boolean) => {
        if (active) {
            return isLight
                ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]'
                : 'border-emerald-400/40 bg-emerald-500/12 text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]';
        }
        return isLight
            ? 'border-transparent text-slate-500 hover:bg-emerald-50/70 hover:text-slate-900'
            : 'border-transparent text-slate-400 hover:bg-emerald-900/20 hover:text-slate-200';
    };
    const regionSegmentClass = (active: boolean) => `min-h-8 rounded-[6px] px-3 text-sm font-semibold transition-colors active:scale-[0.98] ${focusClass} ${active ? 'bg-[var(--fill-success)] text-[var(--on-success)]' : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--border)] hover:text-[var(--text-primary)]'}`;

    return (
        <AppNavV6 active="research" theme={theme} onThemeToggle={onThemeToggle}>
            {showResearchControls ? <div aria-label="Research controls">
            <div className="min-[1024px]:hidden">
                <div className="flex gap-2">
                    <label className="min-w-0 flex-1">
                        <span className="sr-only">Ticker search</span>
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => onQueryChange(event.target.value)}
                            placeholder="Search ticker or company"
                            className={'h-10 w-full rounded-xl border px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-emerald-300 dark:focus-visible:ring-offset-slate-950 ' + fieldClass}
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

                {mobileFiltersOpen ? <div id="research-mobile-filters" className={'mt-2 grid gap-2 rounded-xl border p-3 ' + headerDivider + ' ' + filterPanel}>
                    <div>
                        <div className={'text-xs font-semibold uppercase tracking-[0.16em] ' + textSubtle}>Region</div>
                        <div className="mt-2 flex min-h-9 w-fit items-center rounded-[var(--radius)] border-[0.5px] border-[var(--border)] p-0.5" role="group" aria-label="Region">
                            {(['ALL', 'US', 'MY'] as const).map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => onMarketChange(option)}
                                    aria-pressed={market === option}
                                    className={regionSegmentClass(market === option)}
                                >
                                    {option === 'ALL' ? 'All' : option}
                                </button>
                            ))}
                        </div>
                    </div>
                    <label>
                        <span className={'text-xs font-semibold uppercase tracking-[0.16em] ' + textSubtle}>Decision</span>
                        <select
                            value={action}
                            onChange={(event) => onActionChange(event.target.value as ResearchActionFilterV6)}
                            className={'mt-2 h-10 w-full rounded-xl border px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400/40 ' + fieldClass}
                        >
                            {actionOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                </div> : null}

                <div className="mt-2 flex items-stretch gap-2">
                    <div className={'min-w-0 flex-1 border-t px-3 py-2 ' + headerDivider}>
                        <div className={'truncate text-xs font-semibold uppercase tracking-[0.12em] ' + textSubtle}>Research reviewed</div>
                        <div className={'mt-0.5 truncate text-xs font-semibold ' + textSecondary}>{reviewedLabel} (UTC)</div>
                        <div className={'mt-0.5 text-xs font-semibold uppercase tracking-[0.12em] ' + textSubtle}>{resultCount} ticker{resultCount === 1 ? '' : 's'}</div>
                    </div>
                </div>
            </div>

            <div className="hidden min-[1024px]:block">
                <div className="flex flex-col gap-2 xl:flex-row xl:flex-nowrap xl:items-stretch">
                    <label className="flex min-h-16 min-w-[240px] flex-1 flex-col px-0 py-1.5">
                            <span className={'px-1 text-xs font-semibold uppercase tracking-[0.16em] ' + textSubtle}>Ticker search</span>
                            <input
                                type="search"
                                value={query}
                                onChange={(event) => onQueryChange(event.target.value)}
                                placeholder="Search symbol or company"
                                className={'mt-1.5 h-10 w-full rounded-xl border px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400/40 ' + fieldClass}
                            />
                    </label>
                    <div className={'min-h-16 shrink-0 px-3 py-1.5 ' + commandDivider}>
                        <div className={'px-1 text-xs font-semibold uppercase tracking-[0.16em] ' + textSubtle}>Region</div>
                        <div className="mt-1.5 flex min-h-9 items-center rounded-[var(--radius)] border-[0.5px] border-[var(--border)] p-0.5" role="group" aria-label="Region">
                            {(['ALL', 'US', 'MY'] as const).map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => onMarketChange(option)}
                                    aria-pressed={market === option}
                                    className={regionSegmentClass(market === option)}
                                >
                                    {option === 'ALL' ? 'All' : option}
                                </button>
                            ))}
                        </div>
                    </div>

                    <label className={'flex min-h-16 shrink-0 flex-col px-3 py-1.5 ' + commandDivider}>
                        <span className={'px-1 text-xs font-semibold uppercase tracking-[0.16em] ' + textSubtle}>Decision</span>
                        <select
                            value={action}
                            onChange={(event) => onActionChange(event.target.value as ResearchActionFilterV6)}
                            className={'mt-1.5 h-10 min-w-[150px] rounded-xl border px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400/40 ' + fieldClass}
                        >
                            {actionOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>

                    <div className={'flex min-h-16 shrink-0 items-center gap-5 px-3 py-2 ' + commandDivider}>
                        <div className="min-w-[112px]">
                            <div className={'text-xs font-semibold uppercase tracking-[0.16em] ' + textSubtle}>Research reviewed</div>
                            <div className={'mt-1 text-sm font-semibold ' + textSecondary}>{reviewedLabel} (UTC)</div>
                        </div>
                        <div className="min-w-[68px]">
                            <div className={'text-xs font-semibold uppercase tracking-[0.16em] ' + textSubtle}>Results</div>
                            <div className={'mt-1 text-sm font-semibold ' + textSecondary}>{resultCount} ticker{resultCount === 1 ? '' : 's'}</div>
                        </div>
                    </div>
                </div>
            </div>
            </div> : null}
        </AppNavV6>
    );
};
