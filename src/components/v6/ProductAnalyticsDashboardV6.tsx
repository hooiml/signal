'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    PRODUCT_ANALYTICS_CHANGE_EVENT,
    clearProductAnalyticsHistory,
    readProductAnalyticsState,
    setProductAnalyticsEnabled,
} from '@/lib/product-analytics-client';
import { buildProductAnalyticsSummary } from '@/lib/product-analytics';
import type {
    ProductAnalyticsEvent,
    ProductAnalyticsState,
    ProductAnalyticsWorkspace,
} from '@/lib/types/product-analytics';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

const workspaceLabels: Readonly<Record<ProductAnalyticsWorkspace, string>> = {
    market_conditions: 'Market Conditions',
    research: 'Watchlist',
    discovery: 'Discovery',
    picker: 'Picker',
    compare: 'Compare',
    calendar: 'Calendar',
    alerts: 'Alerts',
    changes: 'Changes',
    filings: 'Filings',
    evidence: 'Evidence',
    policy: 'Policy',
    queue: 'Queue',
    portfolio: 'Portfolio',
    currency: 'Currency',
    relationships: 'Map',
    peers: 'Peers',
    outcomes: 'Outcomes',
    replay: 'Replay',
    health: 'Sources',
    packets: 'Export',
    backup: 'Backup',
    usage: 'Usage',
};

const eventLabels: Readonly<Record<ProductAnalyticsEvent['name'], string>> = {
    workspace_viewed: 'Workspace viewed',
    market_handoff_opened: 'Market handoff opened',
    review_opened: 'Research opened',
    review_saved: 'Review saved',
    packet_exported: 'Decision packet exported',
    notification_preferences_saved: 'Delivery preferences saved',
    portfolio_scenario_changed: 'Portfolio scenario changed',
    peer_set_changed: 'Peer set changed',
    outcome_breakdown_changed: 'Outcome breakdown changed',
    source_health_refreshed: 'Source health refreshed',
    replay_compared: 'Replay comparison changed',
    market_sensitivity_changed: 'Market sensitivity changed',
    backup_exported: 'Encrypted backup downloaded',
    backup_imported: 'Encrypted backup imported',
};

const labelize = (value: string): string =>
    value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');

const formatTime = (value: string): string => new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
}).format(new Date(value));

export const ProductAnalyticsDashboardV6 = ({ theme }: {
    readonly theme: ResearchThemeV6;
}) => {
    const [state, setState] = useState<ProductAnalyticsState | null>(null);
    const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);
    const [confirmClear, setConfirmClear] = useState(false);
    const styles = getThemeV6(theme);

    useEffect(() => {
        const refresh = () => setState(readProductAnalyticsState());
        const timer = window.setTimeout(refresh, 0);
        window.addEventListener(PRODUCT_ANALYTICS_CHANGE_EVENT, refresh);
        window.addEventListener('storage', refresh);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener(PRODUCT_ANALYTICS_CHANGE_EVENT, refresh);
            window.removeEventListener('storage', refresh);
        };
    }, []);

    const summary = useMemo(
        () => buildProductAnalyticsSummary(state?.events ?? [], rangeDays),
        [rangeDays, state?.events],
    );
    const maxDailyActions = Math.max(1, ...summary.daily.map((day) => day.meaningfulActions));

    return (
        <section className="min-w-0 flex-1" aria-labelledby="product-analytics-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + styles.positive}>Local product learning</p>
                    <h1 id="product-analytics-title" className={'mt-1 text-xl font-bold ' + styles.textPrimary}>Workflow analytics</h1>
                    <p className={'mt-1 max-w-3xl text-sm leading-6 ' + styles.textMuted}>Measure whether Signal&apos;s workspaces lead to completed research actions. Events stay in this browser and never include ticker symbols, notes, evidence text, URLs, or downloaded packet contents.</p>
                </div>
                <span className={'rounded border px-2.5 py-1 text-xs font-semibold ' + styles.panelUtility + ' ' + styles.textSecondary}>Local only · 180-day retention</span>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Analytics period">
                    {([7, 30, 90] as const).map((range) => (
                        <button key={range} type="button" aria-pressed={rangeDays === range} onClick={() => setRangeDays(range)} className={'min-h-10 rounded border px-3 text-xs font-semibold ' + (rangeDays === range ? styles.selectedRow : styles.row)}>
                            {range} days
                        </button>
                    ))}
                </div>
                {state ? (
                    <label className={'flex min-h-10 items-center gap-2 text-xs font-semibold ' + styles.textSecondary}>
                        <input type="checkbox" checked={state.enabled} onChange={(event) => setState(setProductAnalyticsEnabled(event.target.checked))} />
                        Record privacy-safe local events
                    </label>
                ) : null}
            </div>

            <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                {[
                    ['Active days', String(summary.activeDays), `${rangeDays}-day window`],
                    ['Sessions', String(summary.sessions), 'Browser-tab sessions'],
                    ['Meaningful actions', String(summary.meaningfulActions), 'Excludes workspace views'],
                    ['Reviews saved', String(summary.reviewSaved), `${summary.reviewOpened} guided opens`],
                    ['Open → save', summary.reviewCompletionPercent === null ? 'Unavailable' : `${summary.reviewCompletionPercent}%`, 'Same-browser workflow'],
                    ['Packet exports', String(summary.packetExports), 'Markdown and print views'],
                ].map(([label, value, note]) => (
                    <div key={label} className={'rounded-lg border p-4 ' + styles.panelUtility}>
                        <dt className={'text-xs font-semibold ' + styles.textMuted}>{label}</dt>
                        <dd className={'mt-2 font-mono text-lg font-bold tabular-nums ' + styles.textPrimary}>{value}</dd>
                        <p className={'mt-1 text-[11px] leading-4 ' + styles.textMuted}>{note}</p>
                    </div>
                ))}
            </dl>

            {summary.eventCount === 0 ? (
                <div className={'mt-5 rounded-lg border p-8 text-center ' + styles.panel}>
                    <h2 className={'text-base font-bold ' + styles.textPrimary}>No local workflow history in this period</h2>
                    <p className={'mx-auto mt-2 max-w-xl text-sm leading-6 ' + styles.textMuted}>Use Signal normally. This view will summarize workspace adoption and meaningful actions without collecting research content.</p>
                </div>
            ) : (
                <>
                    <section className={'mt-5 rounded-lg border p-4 ' + styles.panelSecondary} aria-labelledby="analytics-activity-title">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h2 id="analytics-activity-title" className={'text-sm font-bold ' + styles.textPrimary}>Meaningful activity by day</h2>
                            <span className={'text-xs ' + styles.textMuted}>{summary.guidedReviewSaved} review save{summary.guidedReviewSaved === 1 ? '' : 's'} followed a guided workspace path</span>
                        </div>
                        <div className="research-scrollbar mt-4 overflow-x-auto">
                            <div className="flex h-36 min-w-[680px] items-end gap-1" role="img" aria-label={`Meaningful actions over ${rangeDays} days`}>
                                {summary.daily.map((day) => (
                                    <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${day.date}: ${day.meaningfulActions} meaningful actions`}>
                                        <span className={'text-[9px] ' + styles.textMuted}>{day.meaningfulActions || ''}</span>
                                        <span className="w-full rounded-t bg-emerald-500/70" style={{ height: `${Math.max(day.meaningfulActions === 0 ? 2 : 8, (day.meaningfulActions / maxDailyActions) * 96)}px` }} />
                                        {rangeDays <= 30 ? <span className={'text-[8px] ' + styles.textMuted}>{day.date.slice(5)}</span> : null}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <div className="mt-5 grid gap-4 xl:grid-cols-2">
                        <section className={'min-w-0 rounded-lg border p-4 ' + styles.panelSecondary} aria-labelledby="workspace-adoption-title">
                            <h2 id="workspace-adoption-title" className={'text-sm font-bold ' + styles.textPrimary}>Workspace adoption</h2>
                            <div className="research-scrollbar mt-3 overflow-x-auto">
                                <table className="w-full min-w-[440px] text-left text-xs">
                                    <thead><tr className={styles.textMuted}><th className="pb-2">Workspace</th><th className="pb-2 text-right">Views</th><th className="pb-2 text-right">Sessions</th><th className="pb-2 text-right">Last used</th></tr></thead>
                                    <tbody>{summary.workspaces.map((row) => <tr key={row.workspace} className={'border-t ' + styles.divider}><th className={'py-2 font-semibold ' + styles.textSecondary}>{workspaceLabels[row.workspace]}</th><td className={'py-2 text-right font-mono ' + styles.textSecondary}>{row.views}</td><td className={'py-2 text-right font-mono ' + styles.textSecondary}>{row.sessions}</td><td className={'py-2 text-right ' + styles.textMuted}>{formatTime(row.lastUsedAt)}</td></tr>)}</tbody>
                                </table>
                            </div>
                        </section>

                        <section className={'min-w-0 rounded-lg border p-4 ' + styles.panelSecondary} aria-labelledby="workflow-pathways-title">
                            <h2 id="workflow-pathways-title" className={'text-sm font-bold ' + styles.textPrimary}>Review pathways</h2>
                            {summary.pathways.length === 0 ? <p className={'mt-3 text-xs ' + styles.textMuted}>No guided Research opens have been recorded yet.</p> : (
                                <div className="research-scrollbar mt-3 overflow-x-auto">
                                    <table className="w-full min-w-[380px] text-left text-xs">
                                        <thead><tr className={styles.textMuted}><th className="pb-2">Source</th><th className="pb-2 text-right">Opened</th><th className="pb-2 text-right">Saved</th><th className="pb-2 text-right">Completion</th></tr></thead>
                                        <tbody>{summary.pathways.map((row) => <tr key={row.source} className={'border-t ' + styles.divider}><th className={'py-2 font-semibold ' + styles.textSecondary}>{labelize(row.source)}</th><td className={'py-2 text-right font-mono ' + styles.textSecondary}>{row.opened}</td><td className={'py-2 text-right font-mono ' + styles.textSecondary}>{row.saved}</td><td className={'py-2 text-right font-mono ' + styles.textSecondary}>{row.completionPercent === null ? '—' : `${row.completionPercent}%`}</td></tr>)}</tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    </div>

                    <section className={'mt-5 rounded-lg border p-4 ' + styles.panelSecondary} aria-labelledby="recent-product-events-title">
                        <h2 id="recent-product-events-title" className={'text-sm font-bold ' + styles.textPrimary}>Recent privacy-safe events</h2>
                        <ol className={'mt-2 divide-y ' + styles.divider}>
                            {summary.recent.slice(0, 10).map((event) => (
                                <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                                    <span className={styles.textSecondary}>{eventLabels[event.name]} · {workspaceLabels[event.workspace]}{event.source ? ` · from ${labelize(event.source)}` : ''}</span>
                                    <time className={styles.textMuted}>{formatTime(event.occurredAt)}</time>
                                </li>
                            ))}
                        </ol>
                    </section>
                </>
            )}

            <section className={'mt-5 rounded-lg border p-4 ' + styles.panelSecondary} aria-labelledby="analytics-privacy-title">
                <h2 id="analytics-privacy-title" className={'text-sm font-bold ' + styles.textPrimary}>Privacy and controls</h2>
                <ul className={'mt-2 list-disc space-y-1 pl-5 text-xs leading-5 ' + styles.textMuted}>
                    <li>No analytics request leaves this browser.</li>
                    <li>Events contain only bounded workflow names, session IDs, and small enum values.</li>
                    <li>History is pruned after 180 days and capped at 2,000 events.</li>
                    <li>Disabling collection preserves existing history until you clear it.</li>
                </ul>
                <div className="mt-4">
                    {!confirmClear ? (
                        <button type="button" onClick={() => setConfirmClear(true)} className={'min-h-10 rounded border px-3 text-xs font-semibold ' + styles.row}>Clear local analytics history</button>
                    ) : (
                        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirm analytics history removal">
                            <span className={'text-xs ' + styles.risk}>Remove all locally recorded workflow events?</span>
                            <button type="button" onClick={() => { setState(clearProductAnalyticsHistory()); setConfirmClear(false); }} className="min-h-10 rounded bg-rose-600 px-3 text-xs font-bold text-white">Clear history</button>
                            <button type="button" onClick={() => setConfirmClear(false)} className={'min-h-10 rounded border px-3 text-xs font-semibold ' + styles.row}>Cancel</button>
                        </div>
                    )}
                </div>
            </section>
        </section>
    );
};
