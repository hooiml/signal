'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import { assessInvestmentPolicy } from '@/lib/research/investment-policy';
import { readInvestmentPolicy } from '@/lib/research/investment-policy-client';
import { parseResearchCalendarResponse } from '@/lib/research/calendar-response';
import {
    buildResearchVisitSnapshot,
    buildSinceLastVisitBriefing,
    buildSinceLastVisitChanges,
    type ResearchVisitMarketSnapshot,
    type ResearchVisitSnapshot,
    type SinceLastVisitAction,
    type SinceLastVisitBriefing,
    type SinceLastVisitChanges,
} from '@/lib/research/since-last-visit';
import {
    readResearchVisitSnapshot,
    writeResearchVisitSnapshot,
} from '@/lib/research/since-last-visit-client';
import {
    parseSinceLastVisitAlerts,
    parseSinceLastVisitMarket,
    parseSinceLastVisitSourceIssues,
} from '@/lib/research/since-last-visit-input';
import type { ResearchRecord } from '@/lib/types/research';
import type { ResearchInboxSummaryV6 } from './ResearchInboxV6';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type BriefingState = {
    readonly previous: ResearchVisitSnapshot | null;
    readonly changes: SinceLastVisitChanges;
    readonly briefing: SinceLastVisitBriefing;
    readonly markets: readonly ResearchVisitMarketSnapshot[];
    readonly warnings: readonly string[];
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
}: {
    readonly records: readonly ResearchRecord[];
    readonly items: readonly ResearchWatchlistItem[];
    readonly inboxSummary: ResearchInboxSummaryV6 | null;
    readonly theme: ResearchThemeV6;
    readonly onOpenAction: (action: SinceLastVisitAction) => void;
}) => {
    const styles = getThemeV6(theme);
    const [state, setState] = useState<BriefingState | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [checkpointMessage, setCheckpointMessage] = useState<string | null>(null);
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

        const marketResults = await Promise.allSettled((['US', 'MY'] as const).map(async (market) => {
            const response = await fetch(`/api/signals/v2?market=${market}&mode=standard&enableSocial=true`, {
                cache: 'no-store',
                signal: controller.signal,
            });
            return parseSinceLastVisitMarket(
                await responsePayload(response, `${market} market posture is unavailable.`),
                market,
                capturedAt,
            );
        }));
        const markets = marketResults.flatMap((result, index): ResearchVisitMarketSnapshot[] => {
            if (result.status === 'fulfilled') return [result.value];
            if (!controller.signal.aborted) warnings.push(`${index === 0 ? 'US' : 'MY'} market posture unavailable.`);
            return [];
        });

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
                    signal: controller.signal,
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
                    body: JSON.stringify(items.map((item) => ({
                        symbol: item.symbol,
                        market: item.market,
                        targetBuyZone: item.targetBuyZone,
                    }))),
                    signal: controller.signal,
                });
                return parseSinceLastVisitAlerts(await responsePayload(response, 'Research alerts are unavailable.'));
            })();
        const sourcePromise = (async () => {
            const response = await fetch('/api/source-health', { signal: controller.signal });
            return parseSinceLastVisitSourceIssues(await responsePayload(response, 'Source health is unavailable.'));
        })();
        const [calendarResult, alertsResult, sourceResult] = await Promise.allSettled([
            calendarPromise,
            alertsPromise,
            sourcePromise,
        ]);
        if (controller.signal.aborted) return;
        const events = calendarResult.status === 'fulfilled' ? calendarResult.value : [];
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
        setState({
            previous,
            changes,
            markets,
            warnings,
            briefing: buildSinceLastVisitBriefing({
                changes,
                previous,
                currentMarkets: markets,
                events,
                alerts,
                policyViolations,
                sourceIssues,
                attentionCount: inboxSummary?.attentionCount ?? 0,
                unreadCount: inboxSummary?.unreadCount ?? 0,
            }),
        });
        setLoading(false);
        activeRequest.current = null;
    }, [inboxSummary?.attentionCount, inboxSummary?.unreadCount, items, records, sectors]);

    useEffect(() => () => activeRequest.current?.abort(), []);

    const retry = () => {
        requested.current = true;
        void load().catch((caught) => {
            setError(caught instanceof Error ? caught.message : 'Unable to build the briefing.');
            setLoading(false);
        });
    };

    const markCaughtUp = () => {
        if (!state) return;
        writeResearchVisitSnapshot(buildResearchVisitSnapshot(records, new Date().toISOString(), state.markets));
        setCheckpointMessage('Checkpoint saved. Future briefings will compare against this moment.');
    };

    return (
        <details
            data-testid="since-last-visit"
            data-surface-tier="utility"
            onToggle={(event) => {
                if (event.currentTarget.open && !requested.current) retry();
            }}
            className={'group mb-3 rounded-[10px] border ' + styles.panelSolid}
        >
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-[10px] px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 [&::-webkit-details-marker]:hidden">
                <span>
                    <span className={'block text-sm font-bold ' + styles.textPrimary}>Since last visit</span>
                    <span className={'block text-xs ' + styles.textMuted}>
                        {state ? changeLabel(state.changes) : 'Open a bounded briefing across research, events, alerts, and source health'}
                    </span>
                </span>
                <span aria-hidden="true" className={'text-lg transition-transform group-open:rotate-180 ' + styles.textMuted}>⌄</span>
            </summary>
            <div className={'border-t p-3 min-[700px]:p-4 ' + styles.divider}>
                {loading && !state ? <p role="status" className={'text-sm ' + styles.textMuted}>Building your briefing…</p> : null}
                {error ? (
                    <div role="alert" className={'rounded-lg border p-4 ' + styles.panelUtility}>
                        <p className={'text-sm font-semibold ' + styles.risk}>{error}</p>
                        <button type="button" onClick={retry} className={'mt-3 min-h-10 rounded border px-3 text-xs font-bold ' + styles.row}>Retry briefing</button>
                    </div>
                ) : null}
                {state ? (
                    <div data-testid="since-last-visit-content">
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                            <BriefingMetric label="Market posture" value={state.briefing.marketChanges.length === 0
                                ? 'Unavailable'
                                : state.briefing.marketChanges.map((market) => `${market.market} ${market.direction}`).join(' · ')} theme={theme} />
                            <BriefingMetric label="Research changes" value={changeLabel(state.changes)} theme={theme} />
                            <BriefingMetric label="Upcoming events" value={`${state.briefing.upcomingEvents.length} in the next 30 days`} theme={theme} />
                            <BriefingMetric label="Attention" value={`${state.briefing.alerts.filter((alert) => alert.severity === 'risk').length} risk · ${state.briefing.policyViolations.length} policy · ${state.briefing.unreadCount} unread`} theme={theme} />
                        </div>

                        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
                            <section aria-labelledby="briefing-priorities">
                                <h2 id="briefing-priorities" className={'text-xs font-bold uppercase tracking-[0.1em] ' + styles.textMuted}>Top 3 priority actions</h2>
                                {state.briefing.topActions.length === 0 ? (
                                    <p className={'mt-2 text-sm ' + styles.textSecondary}>No urgent actions surfaced in the available checks.</p>
                                ) : (
                                    <ol className="mt-2 space-y-2">
                                        {state.briefing.topActions.map((action, index) => (
                                            <li key={action.id} className={'flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ' + styles.panelUtility}>
                                                <div className="min-w-0">
                                                    <p className={'text-sm font-semibold ' + styles.textPrimary}>{index + 1}. {action.label}</p>
                                                    <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>{action.detail}</p>
                                                </div>
                                                <button type="button" onClick={() => onOpenAction(action)} className={'min-h-10 shrink-0 rounded border px-3 text-xs font-bold ' + styles.row}>Open</button>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </section>
                            <section aria-labelledby="briefing-checkpoint">
                                <h2 id="briefing-checkpoint" className={'text-xs font-bold uppercase tracking-[0.1em] ' + styles.textMuted}>Checkpoint</h2>
                                <p className={'mt-2 text-sm leading-6 ' + styles.textSecondary}>
                                    {state.previous
                                        ? `Compared with ${new Date(state.previous.capturedAt).toLocaleString()}.`
                                        : 'Save a first checkpoint to start measuring changes across visits.'}
                                </p>
                                <p className={'mt-1 text-xs leading-5 ' + (state.briefing.sourceIssues.length > 0 ? styles.risk : styles.textMuted)}>
                                    {state.briefing.sourceIssues.length > 0
                                        ? `${state.briefing.sourceIssues.map((source) => source.name).join(', ')} degraded.`
                                        : 'No degraded sources reported by the available source check.'}
                                </p>
                                {state.warnings.length > 0 ? <p className={'mt-1 text-xs leading-5 ' + styles.risk}>Partial briefing: {state.warnings.join(' ')}</p> : null}
                                <button type="button" onClick={markCaughtUp} className="mt-3 min-h-10 rounded bg-emerald-500 px-3 text-xs font-bold text-slate-950 transition-colors hover:bg-emerald-400">
                                    {state.previous ? 'Mark caught up' : 'Start tracking'}
                                </button>
                                {checkpointMessage ? <p role="status" className={'mt-2 text-xs ' + styles.positive}>{checkpointMessage}</p> : null}
                            </section>
                        </div>
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
