'use client';

import type { MarketMode, MarketRegion } from '@/hooks/use-signal-config';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { formatDateLabel } from '@/components/v2/cockpit-utils';
import type { ResearchThemeV6 } from './research-v6';

type SourceToggleImpact = NonNullable<MarketSignal['metadata']['counterfactuals']>['source_toggle'];

type MarketCommandBarV6Props = {
    market: MarketRegion;
    mode: MarketMode;
    enableSocial: boolean;
    onMarketChange: (market: MarketRegion) => void;
    onModeChange: (mode: MarketMode) => void;
    onSocialToggle: (enabled: boolean) => void;
    isLoaded: boolean;
    isUpdating?: boolean;
    lastCheckedAt?: Date | null;
    onRefresh?: () => void;
    snapshotDate?: string | null;
    sourceToggleImpact?: SourceToggleImpact;
    theme: ResearchThemeV6;
};

export const MarketCommandBarV6 = ({
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
}: MarketCommandBarV6Props) => {
    const isLight = theme === 'light';
    const tone = isLight
        ? {
            secondary: 'text-[var(--text-secondary)]',
            muted: 'text-[var(--text-muted)]',
            switchOff: 'bg-slate-300',
        }
        : {
            secondary: 'text-[var(--text-secondary)]',
            muted: 'text-[var(--text-muted)]',
            switchOff: 'bg-slate-700',
        };
    const focusClass = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500';
    const sourceToggleLabel = sourceToggleImpact?.source_label || (market === 'MY' ? 'News Sentiment' : 'Social Sentiment');
    const compactSourceLabel = sourceToggleLabel.replace(/\s+sentiment$/i, '');
    const sourceImpactText = sourceToggleImpact
        ? (sourceToggleImpact.with_source_score !== null && sourceToggleImpact.without_source_score !== null
            ? `Without ${sourceToggleImpact.source_label.toLowerCase()}: ${sourceToggleImpact.without_source_score} (${sourceToggleImpact.delta_without_source === null ? 'n/a' : `${sourceToggleImpact.delta_without_source > 0 ? '+' : ''}${sourceToggleImpact.delta_without_source}`})`
            : sourceToggleImpact.summary)
        : (enableSocial ? `${compactSourceLabel} is included in this briefing.` : `${compactSourceLabel} is excluded from this briefing.`);
    const sourceImpactLabel = sourceToggleImpact
        ? (sourceToggleImpact.with_source_score !== null && sourceToggleImpact.without_source_score !== null ? sourceImpactText : 'No comparison data')
        : 'No comparison data';
    const lastCheckedLabel = lastCheckedAt
        ? lastCheckedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })
        : 'Not checked yet';
    const segmentClass = (active: boolean) => `min-h-9 rounded-[var(--radius)] px-3 text-sm font-semibold transition-colors ${focusClass} ${active ? 'bg-[var(--fill-success)] text-[var(--on-success)]' : 'border-[0.5px] border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`;

    return (
        <div className={`research-scrollbar overflow-x-auto transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-80'}`} aria-label="Market briefing controls">
            <div className="flex min-w-max items-center gap-4 whitespace-nowrap min-[1200px]:min-w-0 min-[1200px]:justify-between">
                <div className="flex items-center gap-2" role="group" aria-label="Market">
                    <span className={`text-xs font-semibold uppercase tracking-[0.12em] ${tone.muted}`}>Market</span>
                    <div className="flex min-h-10 items-center gap-1.5">
                        <button type="button" aria-pressed={market === 'US'} onClick={() => onMarketChange('US')} className={segmentClass(market === 'US')}>US</button>
                        <button type="button" aria-pressed={market === 'MY'} onClick={() => onMarketChange('MY')} className={segmentClass(market === 'MY')}>MY</button>
                    </div>
                </div>

                <SignalHeaderDivider />

                <div className="flex items-center gap-2" role="group" aria-label="Interpretation mode">
                    <span className={`text-xs font-semibold uppercase tracking-[0.12em] ${tone.muted}`}>Mode</span>
                    <div className="flex min-h-10 items-center gap-1.5">
                        <button type="button" aria-pressed={mode === 'standard'} onClick={() => onModeChange('standard')} className={segmentClass(mode === 'standard')}>Momentum</button>
                        <button type="button" aria-pressed={mode === 'contrarian'} onClick={() => onModeChange('contrarian')} className={segmentClass(mode === 'contrarian')}>Contrarian</button>
                    </div>
                </div>

                <SignalHeaderDivider />

                <div role="group" aria-label="Data source" className="flex min-w-0 items-center gap-x-2.5">
                    <SignalHeaderIcon name="source" />
                    <span className={`text-sm font-semibold ${tone.secondary}`}>{compactSourceLabel}</span>
                    <label className="inline-flex min-h-10 cursor-pointer select-none items-center gap-2 rounded-md focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-emerald-500">
                        <input
                            type="checkbox"
                            checked={enableSocial}
                            onChange={(event) => onSocialToggle(event.target.checked)}
                            aria-label={'Toggle ' + sourceToggleLabel}
                            aria-describedby="market-source-description"
                            className="peer sr-only"
                        />
                        <span aria-hidden="true" className={`relative h-5 w-9 rounded-full transition-colors ${enableSocial ? 'bg-[var(--fill-success)]' : tone.switchOff}`}>
                            <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${enableSocial ? 'translate-x-4' : ''}`} />
                        </span>
                    </label>
                    <span id="market-source-description" className="sr-only">{sourceImpactText}</span>
                    <span title={sourceImpactText} className={`text-[13px] italic leading-5 ${tone.muted}`}>{sourceImpactLabel}</span>
                </div>

                    <SignalHeaderDivider />

                    <MetaItemV6 label="Snapshot" value={snapshotDate ? formatDateLabel(snapshotDate, true) : 'Waiting for snapshot'} tone={tone} icon="clock" />

                    <SignalHeaderDivider />

                    <div className="flex min-h-10 items-center gap-2">
                        <MetaItemV6 label="Status" value={isUpdating ? 'Updating' : isLoaded ? 'Live' : 'Loading'} tone={tone} status={isUpdating ? 'updating' : 'live'} secondary={lastCheckedLabel} />
                        {onRefresh ? (
                            <button
                                type="button"
                                onClick={onRefresh}
                                disabled={!isLoaded || isUpdating}
                                aria-label={isUpdating ? 'Refreshing market briefing' : `Refresh market briefing, last checked ${lastCheckedLabel}`}
                                className={`grid h-8 w-8 place-items-center rounded-full border-[0.5px] border-[var(--border)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] ${focusClass} disabled:cursor-not-allowed disabled:opacity-55`}
                            >
                                <SignalHeaderIcon name="refresh" />
                            </button>
                        ) : null}
                    </div>
                </div>
        </div>
    );
};

type CommandTone = {
    secondary: string;
    muted: string;
};

const MetaItemV6 = ({ label, value, tone, status, icon, secondary }: { label: string; value: string; tone: CommandTone; status?: 'live' | 'updating'; icon?: 'clock'; secondary?: string }) => (
    <div className="flex min-h-10 items-center gap-2">
        {icon ? <SignalHeaderIcon name={icon} /> : null}
        <p aria-live={label === 'Status' ? 'polite' : undefined} className={`flex items-center gap-2 text-sm font-semibold ${tone.secondary}`}>
            {status ? <span aria-hidden="true" className={`h-2 w-2 rounded-full ${status === 'updating' ? 'animate-pulse bg-sky-400' : 'bg-emerald-500'}`} /> : null}
            {value}
            {secondary ? <span className={`text-[13px] font-medium ${tone.muted}`}>{secondary}</span> : null}
        </p>
    </div>
);

const SignalHeaderDivider = () => <span aria-hidden="true" className="h-5 w-px shrink-0 bg-[var(--border)]" />;

const SignalHeaderIcon = ({ name }: { name: 'source' | 'clock' | 'refresh' }) => {
    const path = {
        source: (
            <>
                <path d="M4 19a8 8 0 0 1 8 -8" />
                <path d="M4 13a4 4 0 0 1 4 -4" />
                <path d="M5 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
                <path d="M12 19h7" />
                <path d="M16 15l3 4l-3 4" />
            </>
        ),
        clock: (
            <>
                <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
                <path d="M12 7v5l3 3" />
            </>
        ),
        refresh: (
            <>
                <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" />
                <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
            </>
        ),
    }[name];

    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[15px] w-[15px] shrink-0 text-[var(--text-muted)]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {path}
        </svg>
    );
};
