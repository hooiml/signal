'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import { buildResearchAlertRequest } from '@/lib/research/alert-request';
import { assessInvestmentPolicy } from '@/lib/research/investment-policy';
import { upcomingDividendCashFlowDigestEvents } from '@/lib/portfolio/dividend-cashflow';
import { loadDividendCashFlowSnapshot } from '@/lib/portfolio/dividend-cashflow-client';
import { readInvestmentPolicy } from '@/lib/research/investment-policy-client';
import { parseResearchCalendarResponse } from '@/lib/research/calendar-response';
import {
    buildResearchVisitSnapshot,
    buildSinceLastVisitBriefing,
    buildSinceLastVisitChanges,
    buildTodayOwnerSummaries,
    todayContinuationAction,
    type ResearchVisitMarketSnapshot,
    type ResearchVisitSnapshot,
    type SinceLastVisitAction,
    type SinceLastVisitBriefing,
    type SinceLastVisitChanges,
    type TodayContinuation,
    type TodaySummaryAvailability,
} from '@/lib/research/since-last-visit';
import {
    readResearchVisitSnapshot,
    readTodayContinuation,
    writeResearchVisitSnapshot,
} from '@/lib/research/since-last-visit-client';
import { parseResearchWorkflowTasks, type ResearchWorkflowTask } from '@/lib/research/workflow-queue';
import { RESEARCH_WORKFLOW_QUEUE_STORAGE_KEY } from '@/lib/research/workflow-queue-client';
import {
    parseSinceLastVisitAlerts,
    parseSinceLastVisitMarket,
    parseSinceLastVisitSourceIssues,
} from '@/lib/research/since-last-visit-input';
import type { ResearchRecord } from '@/lib/types/research';
import type { ResearchInboxSummaryV6 } from './ResearchInboxV6';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type BriefingState = {
    readonly capturedAt: string;
    readonly previous: ResearchVisitSnapshot | null;
    readonly changes: SinceLastVisitChanges;
    readonly briefing: SinceLastVisitBriefing;
    readonly markets: readonly ResearchVisitMarketSnapshot[];
    readonly availability: TodaySummaryAvailability;
    readonly warnings: readonly string[];
};

type QueueProjection = {
    readonly status: 'ready' | 'empty' | 'unavailable';
    readonly tasks: readonly ResearchWorkflowTask[];
};

const responsePayload = async (response: Response, fallback: string): Promise<unknown> => {
    const payload: unknown = await response.json();
    if (!response.ok) {
        if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
            const error = Object.fromEntries(Object.entries(payload)).error;
            if (typeof error === 'string') throw new Error(error);
        }
        throw new Error(fallback);
    }
    return payload;
};

const boundedSignal = (signal: AbortSignal): AbortSignal =>
    AbortSignal.any([signal, AbortSignal.timeout(12_000)]);

const readQueueProjection = (): QueueProjection => {
    try {
        const stored = window.localStorage.getItem(RESEARCH_WORKFLOW_QUEUE_STORAGE_KEY);
        if (stored === null) return { status: 'empty', tasks: [] };
        const tasks = parseResearchWorkflowTasks(JSON.parse(stored));
        return { status: tasks.length === 0 ? 'empty' : 'ready', tasks };
    } catch {
        return { status: 'unavailable', tasks: [] };
    }
};

const changeLabel = (changes: SinceLastVisitChanges) => {
    if (changes.state === 'baseline') return 'No prior checkpoint yet';
    const total = new Set([
        ...changes.newSymbols,
        ...changes.revisedSymbols,
        ...changes.evidenceChangedSymbols,
    ]).size;
    return `${total} changed record${total === 1 ? '' : 's'} since checkpoint`;
};

export const SinceLastVisitBriefingV6 = ({
    records,
    items,
    inboxSummary,
    theme,
    onOpenAction,
    variant = 'briefing',
}: {
    readonly records: readonly ResearchRecord[];
    readonly items: readonly ResearchWatchlistItem[];
    readonly inboxSummary: ResearchInboxSummaryV6 | null;
    readonly theme: ResearchThemeV6;
    readonly onOpenAction: (action: SinceLastVisitAction) => void;
    readonly variant?: 'briefing' | 'today';
}) => {
    const styles = getThemeV6(theme);
    const [state, setState] = useState<BriefingState | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [checkpointMessage, setCheckpointMessage] = useState<string | null>(null);
    const [continuation, setContinuation] = useState<TodayContinuation | null>(null);
    const requested = useRef(false);
    const activeRequest = useRef<AbortController | null>(null);
    const sectors = useMemo(() => new Map(items.map((item) => [item.symbol, item.sector])), [items]);

    const load = useCallback(async () => {
        activeRequest.current?.abort();
        const controller = new AbortController();
        activeRequest.current = controller;
        setLoading(true);
        setError(null);
        setCheckpointMessage(null);
        const previous = readResearchVisitSnapshot();
        const capturedAt = new Date().toISOString();
        const changes = buildSinceLastVisitChanges(records, previous, capturedAt);
        const warnings: string[] = [];

        const marketResultsPromise = Promise.allSettled((['US', 'MY'] as const).map(async (market) => {
            const response = await fetch(`/api/signals/v2?market=${market}&mode=standard&enableSocial=true`, {
                cache: 'no-store',
                signal: boundedSignal(controller.signal),
            });
            return parseSinceLastVisitMarket(
                await responsePayload(response, `${market} market posture is unavailable.`),
                market,
                capturedAt,
            );
        }));

        const calendarPromise = records.length === 0
            ? Promise.resolve([])
            : (async () => {
                const response = await fetch('/api/research/calendar?range=30', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(records.map((record) => ({
                        symbol: record.symbol,
                        market: record.market,
                        nextReviewAt: record.decisionJournal.nextReviewAt,
                        lastReviewedAt: record.lastReviewedAt,
                        reviewAgeDays: record.monitoringRules.reviewAgeDays,
                        earningsWithinDays: record.monitoringRules.earningsWithinDays,
                    }))),
                    signal: boundedSignal(controller.signal),
                });
                const calendar = parseResearchCalendarResponse(await responsePayload(response, 'Research calendar is unavailable.'));
                return calendar.events.map((event) => ({
                    symbol: event.symbol,
                    type: event.type,
                    date: event.sourceDate,
                }));
            })();
        const alertsPromise = items.length === 0
            ? Promise.resolve([])
            : (async () => {
                const response = await fetch('/api/research/alerts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(buildResearchAlertRequest(items, records)),
                    signal: boundedSignal(controller.signal),
                });
                return parseSinceLastVisitAlerts(await responsePayload(response, 'Research alerts are unavailable.'));
            })();
        const sourcePromise = (async () => {
            const response = await fetch('/api/source-health', { signal: boundedSignal(controller.signal) });
            return parseSinceLastVisitSourceIssues(await responsePayload(response, 'Source health is unavailable.'));
        })();
        const [marketResults, [calendarResult, alertsResult, sourceResult]] = await Promise.all([
            marketResultsPromise,
            Promise.allSettled([calendarPromise, alertsPromise, sourcePromise] as const),
        ]);
        if (controller.signal.aborted) return;
        const markets = marketResults.flatMap((result, index): ResearchVisitMarketSnapshot[] => {
            if (result.status === 'fulfilled') return [result.value];
            warnings.push(`${index === 0 ? 'US' : 'MY'} market posture unavailable.`);
            return [];
        });
        const researchEvents = calendarResult.status === 'fulfilled' ? calendarResult.value : [];
        const localPlanning = loadDividendCashFlowSnapshot();
        const planningEvents = localPlanning.snapshot
            ? upcomingDividendCashFlowDigestEvents(localPlanning.snapshot, new Date(capturedAt), 30)
            : [];
        if (!localPlanning.snapshot) warnings.push(localPlanning.message);
        const events = [...researchEvents, ...planningEvents];
        const alerts = alertsResult.status === 'fulfilled' ? alertsResult.value : [];
        const sourceIssues = sourceResult.status === 'fulfilled' ? sourceResult.value : [];
        if (calendarResult.status === 'rejected') warnings.push('Research calendar unavailable.');
        if (alertsResult.status === 'rejected') warnings.push('Research alerts unavailable.');
        if (sourceResult.status === 'rejected') warnings.push('Source health unavailable.');

        const policyViolations = assessInvestmentPolicy(
            records.map((record) => ({ record, sector: sectors.get(record.symbol) ?? 'Unclassified' })),
            readInvestmentPolicy(),
        ).filter((assessment) => !assessment.compliant).map((assessment) => ({
            symbol: assessment.symbol,
            count: assessment.violations.length,
        }));
        const today = capturedAt.slice(0, 10);
        const queueProjection = readQueueProjection();
        if (queueProjection.status === 'unavailable') warnings.push('Browser-local Queue storage unavailable.');
        const queueTasks = queueProjection.tasks
            .filter((task) => task.completedAt === null)
            .map((task) => ({
                id: task.id,
                symbol: task.symbol,
                dueAt: task.dueAt,
                isDue: task.dueAt !== null && task.dueAt <= today,
            }));
        const calendarAvailable = calendarResult.status === 'fulfilled';
        const planningAvailable = localPlanning.status === 'empty' || localPlanning.status === 'ready';
        const calendarStatus = !calendarAvailable && !planningAvailable
            ? 'unavailable'
            : !calendarAvailable || !planningAvailable
                ? 'partial'
                : events.length === 0 ? 'empty' : 'ready';
        const availability: TodaySummaryAvailability = {
            overdueReviews: changes.overdueReviewSymbols.length === 0 ? 'empty' : 'ready',
            calendar: calendarStatus,
            alerts: alertsResult.status === 'rejected'
                ? 'unavailable'
                : alerts.length === 0 ? 'empty' : 'ready',
            queue: queueProjection.status,
            sources: sourceResult.status === 'rejected'
                ? 'unavailable'
                : sourceIssues.length === 0 ? 'empty' : 'ready',
        };
        const allConnectedChecksFailed = marketResults.every((result) => result.status === 'rejected')
            && calendarResult.status === 'rejected'
            && alertsResult.status === 'rejected'
            && sourceResult.status === 'rejected';
        setState({
            capturedAt,
            previous,
            changes,
            markets,
            availability,
            warnings,
            briefing: buildSinceLastVisitBriefing({
                changes,
                previous,
                currentMarkets: markets,
                events,
                alerts,
                policyViolations,
                sourceIssues,
                queueTasks,
                attentionCount: inboxSummary?.attentionCount ?? 0,
                unreadCount: inboxSummary?.unreadCount ?? 0,
            }),
        });
        if (allConnectedChecksFailed) {
            setError('Connected Today checks are unavailable. Local workflow summaries remain read-only and can still be opened.');
        }
        setLoading(false);
        activeRequest.current = null;
    }, [inboxSummary?.attentionCount, inboxSummary?.unreadCount, items, records, sectors]);

    useEffect(() => () => activeRequest.current?.abort(), []);

    useEffect(() => {
        if (variant !== 'today') return;
        const timer = window.setTimeout(() => setContinuation(readTodayContinuation()), 0);
        return () => window.clearTimeout(timer);
    }, [variant]);

    const retry = () => {
        requested.current = true;
        void load().catch((caught) => {
            setError(caught instanceof Error ? caught.message : 'Unable to build the briefing.');
            setLoading(false);
        });
    };

    useEffect(() => {
        if (variant !== 'today' || requested.current) return;
        const timer = window.setTimeout(() => {
            if (requested.current) return;
            requested.current = true;
            void load().catch((caught) => {
                setError(caught instanceof Error ? caught.message : 'Unable to build Today.');
                setLoading(false);
            });
        }, 0);
        return () => window.clearTimeout(timer);
    }, [load, variant]);

    const markCaughtUp = () => {
        if (!state) return;
        writeResearchVisitSnapshot(buildResearchVisitSnapshot(records, new Date().toISOString(), state.markets));
        setCheckpointMessage('Checkpoint saved. Future briefings will compare against this moment.');
    };
    const todaySummaries = state && variant === 'today' ? buildTodayOwnerSummaries({
        briefing: state.briefing,
        changes: state.changes,
        availability: state.availability,
        today: state.capturedAt.slice(0, 10),
    }) : [];
    const continuationAction = continuation ? todayContinuationAction(continuation) : null;

    return (
        <details
            data-testid={variant === 'today' ? 'research-today' : 'since-last-visit'}
            data-surface-tier={variant === 'today' ? 'primary' : 'utility'}
            open={variant === 'today' ? true : undefined}
            onToggle={(event) => {
                if (variant === 'briefing' && event.currentTarget.open && !requested.current) retry();
            }}
            className={'group mb-3 rounded-[10px] border ' + styles.panelSolid}
        >
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-[10px] px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 [&::-webkit-details-marker]:hidden">
                <span>
                    <span className={'block text-sm font-bold ' + styles.textPrimary}>{variant === 'today' ? 'Today' : 'Since last visit'}</span>
                    <span className={'block text-xs ' + styles.textMuted}>
                        {state
                            ? variant === 'today'
                                ? `${state.briefing.topActions.length} immediate action${state.briefing.topActions.length === 1 ? '' : 's'} · ${state.briefing.upcomingEvents.length} upcoming`
                                : changeLabel(state.changes)
                            : variant === 'today'
                                ? 'Preparing today’s priorities from your saved research'
                                : 'Open a concise briefing across research, events, alerts, and source health'}
                    </span>
                </span>
                <span aria-hidden="true" className={'text-lg transition-transform group-open:rotate-180 ' + styles.textMuted}>⌄</span>
            </summary>
            <div className={'border-t p-3 min-[700px]:p-4 ' + styles.divider}>
                {loading && !state ? (
                    <div role="status" data-testid={variant === 'today' ? 'today-loading-state' : undefined}>
                        <p className={'text-sm font-semibold ' + styles.textPrimary}>{variant === 'today' ? 'Building today’s action home…' : 'Building your briefing…'}</p>
                        {variant === 'today' ? <p className={'mt-1 text-xs ' + styles.textMuted}>Calendar, Alerts, Queue, and Sources resolve independently.</p> : null}
                    </div>
                ) : null}
                {error ? (
                    <div role="alert" className={'rounded-lg border p-4 ' + styles.panelUtility}>
                        <p className={'text-sm font-semibold ' + styles.risk}>{error}</p>
                        <button type="button" onClick={retry} className={'mt-3 min-h-10 rounded border px-3 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ' + styles.row}>Retry {variant === 'today' ? 'Today' : 'briefing'}</button>
                    </div>
                ) : null}
                {state ? (
                    <div data-testid="since-last-visit-content">
                        {variant === 'today' ? (
                            <div className={'mb-4 flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between ' + styles.divider}>
                                <div>
                                    <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + styles.positive}>Today’s research priorities</p>
                                    <p className={'mt-1 text-sm leading-6 ' + styles.textSecondary}>Review priorities from your saved research. Signal never recommends a trade or changes your research, alerts, Queue tasks, or checkpoints automatically.</p>
                                </div>
                                {continuationAction ? (
                                    <button type="button" data-testid="today-continue" onClick={() => onOpenAction(continuationAction)} className={'min-h-11 shrink-0 rounded border px-4 text-left text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ' + styles.selectedRow}>
                                        Continue where you left off
                                        <span className={'mt-1 block font-normal ' + styles.textMuted}>{continuationAction.detail}</span>
                                    </button>
                                ) : null}
                            </div>
                        ) : null}

                        {variant !== 'today' ? (
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                <BriefingMetric label="Market posture" value={state.briefing.marketChanges.length === 0
                                    ? 'Unavailable'
                                    : state.briefing.marketChanges.map((market) => `${market.market} ${market.direction}`).join(' · ')} theme={theme} />
                                <BriefingMetric label="Research changes" value={changeLabel(state.changes)} theme={theme} />
                                <BriefingMetric label="Upcoming events" value={`${state.briefing.upcomingEvents.length} in the next 30 days`} theme={theme} />
                                <BriefingMetric label="Attention" value={`${state.briefing.alerts.filter((alert) => alert.severity === 'risk').length} risk · ${state.briefing.policyViolations.length} policy · ${state.briefing.unreadCount} unread`} theme={theme} />
                            </div>
                        ) : null}

                        <div className={(variant === 'today' ? '' : 'mt-4 ') + 'grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]'}>
                            <section aria-labelledby="briefing-priorities">
                                <h2 id="briefing-priorities" className={'text-xs font-bold uppercase tracking-[0.1em] ' + styles.textMuted}>Top 3 priority actions</h2>
                                {state.briefing.topActions.length === 0 ? <p className={'mt-2 text-sm ' + styles.textSecondary}>No urgent actions surfaced in the available checks.</p> : (
                                    <ol className="mt-2 space-y-2">
                                        {state.briefing.topActions.map((action, index) => (
                                            <li key={action.id} className={'flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ' + styles.panelUtility}>
                                                <div className="min-w-0">
                                                    <p className={'text-sm font-semibold ' + styles.textPrimary}>{index + 1}. {action.label}</p>
                                                    <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>{action.detail}</p>
                                                    <p className={'mt-1 text-[11px] font-semibold uppercase tracking-[0.06em] ' + styles.textMuted}>Source: {action.kind.replaceAll('-', ' ')} · Opens {action.workspace}</p>
                                                </div>
                                                <button type="button" onClick={() => onOpenAction(action)} className={variant === 'today' && index === 0 ? 'min-h-11 shrink-0 rounded bg-emerald-500 px-4 text-xs font-bold text-slate-950' : 'min-h-10 shrink-0 rounded border px-3 text-xs font-bold ' + styles.row}>{variant === 'today' && index === 0 ? 'Open priority' : 'Open'}</button>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </section>
                            <section aria-labelledby="briefing-checkpoint">
                                <h2 id="briefing-checkpoint" className={'text-xs font-bold uppercase tracking-[0.1em] ' + styles.textMuted}>Checkpoint</h2>
                                <p className={'mt-2 text-sm leading-6 ' + styles.textSecondary}>{state.previous ? `Compared with ${new Date(state.previous.capturedAt).toLocaleString()}.` : 'Save a first checkpoint to start measuring changes across visits.'}</p>
                                <p className={'mt-1 text-xs leading-5 ' + (state.briefing.sourceIssues.length > 0 ? styles.risk : styles.textMuted)}>{state.briefing.sourceIssues.length > 0 ? `${state.briefing.sourceIssues.map((source) => source.name).join(', ')} degraded.` : 'No degraded sources reported by the available source check.'}</p>
                                {state.warnings.length > 0 ? <p className={'mt-1 text-xs leading-5 ' + styles.risk}>Partial briefing: {state.warnings.join(' ')}</p> : null}
                                <button type="button" onClick={markCaughtUp} className="mt-3 min-h-10 rounded bg-emerald-500 px-3 text-xs font-bold text-slate-950">{state.previous ? 'Mark caught up' : 'Start tracking'}</button>
                                {checkpointMessage ? <p role="status" className={'mt-2 text-xs ' + styles.positive}>{checkpointMessage}</p> : null}
                            </section>
                        </div>
                        {variant === 'today' ? (
                            <section className={'mt-5 border-t pt-4 ' + styles.divider} aria-labelledby="today-owner-summaries">
                                <h2 id="today-owner-summaries" className={'text-xs font-bold uppercase tracking-[0.1em] ' + styles.textMuted}>Research health</h2>
                                <div data-testid="today-health-list" role="list" className={'mt-2 divide-y overflow-hidden rounded-lg border ' + styles.divider}>
                                    {todaySummaries.map((summary) => {
                                        const unavailable = summary.status === 'unavailable';
                                        const quiet = !unavailable && summary.status !== 'partial' && summary.count === 0;
                                        const countLabel = unavailable
                                            ? 'Unavailable'
                                            : summary.id === 'overdue'
                                                ? `${summary.count} overdue`
                                                : summary.id === 'upcoming'
                                                    ? `${summary.count} upcoming`
                                                    : summary.id === 'alerts'
                                                        ? `${summary.count} active`
                                                        : summary.id === 'queue'
                                                            ? `${summary.count} incomplete`
                                                            : `${summary.count} degraded`;
                                        const kind: SinceLastVisitAction['kind'] = summary.id === 'sources' ? 'source' : summary.id === 'queue' ? 'queue' : summary.id === 'alerts' ? 'risk-alert' : summary.id === 'upcoming' ? 'earnings' : 'overdue-review';
                                        return (
                                            <article key={summary.id} role="listitem" data-testid={`today-summary-${summary.id}`} data-status={summary.status} data-quiet={quiet ? 'true' : 'false'} className="flex min-h-12 min-w-0 items-center gap-3 px-3 py-2">
                                                <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
                                                    <div className="flex min-w-0 items-center gap-2 sm:w-1/2">
                                                        <h3 className={(quiet ? styles.textMuted : styles.textPrimary) + ' truncate text-xs font-bold'}>{summary.label}</h3>
                                                        {summary.status === 'partial' || unavailable ? <span className={'text-[10px] font-bold uppercase tracking-[0.06em] ' + styles.risk}>{summary.status}</span> : null}
                                                    </div>
                                                    <p className={'mt-0.5 text-xs font-semibold sm:mt-0 ' + (quiet ? styles.textMuted : styles.textPrimary)}>{countLabel}</p>
                                                </div>
                                                <button type="button" onClick={() => onOpenAction({
                                                    id: `summary:${summary.id}`,
                                                    kind,
                                                    symbol: summary.symbol,
                                                    label: `Open ${summary.label.toLowerCase()}`,
                                                    detail: `${summary.label} is owned by ${summary.workspace}.`,
                                                    workspace: summary.workspace,
                                                    priority: 0,
                                                })} className={'min-h-11 shrink-0 rounded border px-3 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ' + styles.row}>Open {summary.workspace === 'health' ? 'Sources' : summary.workspace[0].toUpperCase() + summary.workspace.slice(1)}</button>
                                            </article>
                                        );
                                    })}
                                </div>
                            </section>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </details>
    );
};

const BriefingMetric = ({
    label,
    value,
    theme,
}: {
    readonly label: string;
    readonly value: string;
    readonly theme: ResearchThemeV6;
}) => {
    const styles = getThemeV6(theme);
    return (
        <div className={'min-w-0 rounded-lg border p-3 ' + styles.panelUtility}>
            <p className={'text-[11px] font-semibold uppercase tracking-[0.08em] ' + styles.textMuted}>{label}</p>
            <p className={'mt-1 break-words text-sm font-semibold ' + styles.textPrimary}>{value}</p>
        </div>
    );
};
