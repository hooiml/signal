import type { MarketSignal } from '@/lib/types/signal-v2';
import { formatCompactDateV6, formatSignedV6 } from './market-v6';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type ChangeAttributionV6Props = {
    readonly changes: NonNullable<MarketSignal['metadata']['driver_changes']>;
    readonly previousDate: string | null;
    readonly available: boolean;
    readonly theme: ResearchThemeV6;
};

export const ChangeAttributionV6 = ({ changes, previousDate, available, theme }: ChangeAttributionV6Props) => {
    const t = getThemeV6(theme);
    const leadingChanges = changes.slice(0, 3);

    return (
        <div className={'border-t p-5 ' + t.divider}>
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + t.textMuted}>Why it changed</p>
                    <h3 className={'mt-1 text-base font-bold ' + t.textPrimary}>Contribution shifts</h3>
                </div>
                {previousDate ? <p className={'text-xs ' + t.textMuted}>Compared with {formatCompactDateV6(previousDate)}</p> : null}
            </div>

            {leadingChanges.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {leadingChanges.map((change) => (
                        <article key={change.key} className={'min-w-0 border-l-2 pl-3 ' + changeBorder(change.delta, theme)}>
                            <div className="flex items-start justify-between gap-3">
                                <p className={'min-w-0 text-sm font-bold ' + t.textPrimary}>{change.name}</p>
                                <span className={'shrink-0 text-sm font-bold tabular-nums ' + changeTone(change.delta, theme)}>
                                    {formatSignedV6(change.delta, 1)} pts
                                </span>
                            </div>
                            <p className={'mt-1 text-xs leading-5 ' + t.textSecondary}>
                                {change.previous_contribution.toFixed(1)} to {change.current_contribution.toFixed(1)} weighted points
                            </p>
                        </article>
                    ))}
                </div>
            ) : (
                <p className={'mt-3 text-sm ' + t.textMuted}>
                    {!available && previousDate
                        ? 'Prior driver details are unavailable for this comparison.'
                        : previousDate
                        ? 'Driver contributions were unchanged from the prior snapshot.'
                        : 'Attribution will appear after a prior daily snapshot is available.'}
                </p>
            )}
        </div>
    );
};

const changeTone = (delta: number, theme: ResearchThemeV6) => {
    if (delta > 0) return theme === 'light' ? 'text-emerald-700' : 'text-emerald-300';
    return theme === 'light' ? 'text-rose-700' : 'text-rose-300';
};

const changeBorder = (delta: number, theme: ResearchThemeV6) => {
    if (delta > 0) return theme === 'light' ? 'border-emerald-300' : 'border-emerald-400/45';
    return theme === 'light' ? 'border-rose-300' : 'border-rose-400/45';
};
