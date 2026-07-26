'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import type { ResearchAlert, ResearchAlertsResponse } from '@/lib/types/research-alert';
import type { ResearchStructuredTriggerEvaluation } from '@/lib/research/structured-triggers';
import { enqueueResearchWorkflowTaskClient } from '@/lib/research/workflow-queue-client';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';
import { defaultResearchMonitoringRules, type ResearchRecord } from '@/lib/types/research';
import { ResearchNotificationCenterV6 } from './ResearchNotificationCenterV6';

type ResearchAlertsV6Props = {
    readonly items: readonly ResearchWatchlistItem[];
    readonly records: readonly ResearchRecord[];
    readonly theme: ResearchThemeV6;
    readonly onOpen: (symbol: string) => void;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const isTriggerRule = (value: unknown) => isRecord(value)
    && typeof value.id === 'string'
    && typeof value.enabled === 'boolean'
    && (value.purpose === 'thesis-invalidation' || value.purpose === 'opportunity-review' || value.purpose === 'scheduled-evidence-review')
    && typeof value.metric === 'string'
    && (value.operator === 'above' || value.operator === 'below' || value.operator === 'within')
    && typeof value.threshold === 'number' && Number.isFinite(value.threshold);

const isTriggerEvaluation = (value: unknown): value is ResearchStructuredTriggerEvaluation => {
    if (!isRecord(value) || typeof value.symbol !== 'string' || !/^[A-Z0-9.-]{1,20}$/.test(value.symbol) || !isTriggerRule(value.rule)
        || (value.status !== 'matched' && value.status !== 'not-matched' && value.status !== 'unavailable' && value.status !== 'disabled')
        || (value.severity !== 'opportunity' && value.severity !== 'watch' && value.severity !== 'risk')
        || typeof value.title !== 'string' || typeof value.detail !== 'string') return false;
    if (value.observed === null) return true;
    return isRecord(value.observed)
        && (value.observed.value === null || typeof value.observed.value === 'number' && Number.isFinite(value.observed.value))
        && typeof value.observed.label === 'string'
        && (value.observed.observedAt === null || typeof value.observed.observedAt === 'string')
        && typeof value.observed.source === 'string'
        && typeof value.observed.freshness === 'string';
};

const isAlert = (value: unknown): value is ResearchAlert => {
    if (!isRecord(value)) return false;
    return typeof value.id === 'string'
        && typeof value.symbol === 'string' && /^[A-Z0-9.-]{1,20}$/.test(value.symbol)
        && (value.kind === 'market-condition' || value.kind === 'structured-trigger')
        && typeof value.title === 'string' && value.title.length > 0 && value.title.length <= 160
        && typeof value.detail === 'string' && value.detail.length <= 700
        && (value.severity === 'opportunity' || value.severity === 'watch' || value.severity === 'risk')
        && (value.structuredTrigger === null || isTriggerEvaluation(value.structuredTrigger));
};

const parseResponse = (payload: unknown): ResearchAlertsResponse => {
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) throw new Error('Invalid research alerts response.');
    const data = payload.data;
    if (typeof data.generatedAt !== 'string' || typeof data.monitoredCount !== 'number'
        || !Array.isArray(data.alerts) || data.alerts.length > 300 || !data.alerts.every(isAlert)
        || !Array.isArray(data.triggerCoverage) || data.triggerCoverage.length > 500 || !data.triggerCoverage.every(isTriggerEvaluation)
        || !Array.isArray(data.warnings) || !data.warnings.every((warning) => typeof warning === 'string')) {
        throw new Error('Invalid research alerts data.');
    }
    return {
        generatedAt: data.generatedAt,
        monitoredCount: data.monitoredCount,
        alerts: data.alerts,
        triggerCoverage: data.triggerCoverage,
        warnings: data.warnings,
    };
};

const severityLabel = (severity: ResearchAlert['severity']) => severity === 'opportunity' ? 'Opportunity' : severity === 'risk' ? 'Risk' : 'Watch';

const queueTemplate = (alert: ResearchAlert) => {
    const purpose = alert.structuredTrigger?.rule.purpose;
    if (purpose === 'thesis-invalidation') return 'thesis-challenge' as const;
    if (purpose === 'opportunity-review') return 'valuation-refresh' as const;
    if (purpose === 'scheduled-evidence-review') return 'post-event' as const;
    return alert.severity === 'opportunity' ? 'valuation-refresh' as const : alert.severity === 'watch' ? 'post-event' as const : 'thesis-challenge' as const;
};

const coverageLabel = (status: ResearchStructuredTriggerEvaluation['status']) =>
    status === 'matched' ? 'Matched' : status === 'not-matched' ? 'Active' : status === 'unavailable' ? 'Unavailable' : 'Disabled';

export const ResearchAlertsV6 = ({ items, records, theme, onOpen }: ResearchAlertsV6Props) => {
    const [data, setData] = useState<ResearchAlertsResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [queueStatus, setQueueStatus] = useState<string | null>(null);
    const styles = getThemeV6(theme);
    const recordsBySymbol = useMemo(() => new Map(records.map((record) => [record.symbol, record])), [records]);
    const requestBody = useMemo(() => JSON.stringify(items.map((item) => {
        const record = recordsBySymbol.get(item.symbol);
        return {
            symbol: item.symbol,
            market: item.market,
            targetBuyZone: item.targetBuyZone,
            lastReviewedAt: record?.lastReviewedAt ?? item.lastReviewedAt,
            acceptedEvidence: record?.acceptedEvidence ?? [],
            monitoringRules: record?.monitoringRules ?? defaultResearchMonitoringRules,
        };
    })), [items, recordsBySymbol]);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                setError(null);
                const response = await fetch('/api/research/alerts', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: requestBody,
                });
                const payload: unknown = await response.json();
                if (!response.ok && isRecord(payload) && typeof payload.error === 'string') throw new Error(payload.error);
                const parsed = parseResponse(payload);
                if (active) setData(parsed);
            } catch (caught) {
                if (active) setError(caught instanceof Error ? caught.message : 'Research alerts are unavailable.');
            }
        };
        if (items.length > 0) void load();
        return () => { active = false; };
    }, [items.length, requestBody]);

    if (items.length === 0) return <section className="min-w-0 flex-1"><p className={'p-4 text-sm ' + styles.textMuted}>Add a ticker to begin monitoring.</p><ResearchNotificationCenterV6 records={records} alerts={[]} theme={theme} /></section>;
    if (error) return <section className="min-w-0 flex-1"><p className={'p-4 text-sm ' + styles.risk}>{error}</p><ResearchNotificationCenterV6 records={records} alerts={[]} theme={theme} /></section>;
    if (!data) return <section className="min-w-0 flex-1"><p className={'p-4 text-sm ' + styles.textMuted}>Checking market conditions and structured review triggers...</p><ResearchNotificationCenterV6 records={records} alerts={[]} theme={theme} /></section>;

    const counts = {
        risk: data.alerts.filter((alert) => alert.severity === 'risk').length,
        opportunity: data.alerts.filter((alert) => alert.severity === 'opportunity').length,
        watch: data.alerts.filter((alert) => alert.severity === 'watch').length,
    };
    const triggerCounts = {
        matched: data.triggerCoverage.filter((trigger) => trigger.status === 'matched').length,
        active: data.triggerCoverage.filter((trigger) => trigger.status === 'not-matched').length,
        unavailable: data.triggerCoverage.filter((trigger) => trigger.status === 'unavailable').length,
        disabled: data.triggerCoverage.filter((trigger) => trigger.status === 'disabled').length,
    };
    const invalidRecords = records.filter((record) => record.monitoringRules.structuredTriggers.migrationState === 'invalid-recovered');
    const tone = (severity: ResearchAlert['severity']) => severity === 'risk' ? styles.risk : severity === 'opportunity' ? styles.positive : styles.textSecondary;

    return (
        <section className="min-w-0 flex-1">
            <header className={'border-b pb-4 ' + styles.divider}>
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className={'text-xl font-bold ' + styles.textPrimary}>Alerts</h1>
                        <p className={'mt-1 text-xs ' + styles.textMuted}>{data.monitoredCount} tickers monitored · {counts.risk} risk · {counts.opportunity} opportunity · {counts.watch} watch</p>
                    </div>
                    <p className={'text-xs ' + styles.textMuted}>Updated {new Date(data.generatedAt).toLocaleString()}</p>
                </div>
            </header>

            <section data-testid="structured-trigger-coverage" className={'mt-4 rounded-lg border p-4 ' + styles.panelUtility} aria-labelledby="structured-trigger-coverage-title">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 id="structured-trigger-coverage-title" className={'text-sm font-bold ' + styles.textPrimary}>Structured thesis-trigger coverage</h2>
                        <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Explicit numeric review prompts only. Signal does not infer rules from thesis text, recommend a trade, or change a saved decision or checklist.</p>
                    </div>
                    <p className={'text-xs ' + styles.textMuted}>{triggerCounts.matched} matched · {triggerCounts.active} active · {triggerCounts.unavailable} unavailable · {triggerCounts.disabled} disabled</p>
                </div>
                {invalidRecords.length > 0 ? <p role="alert" className={'mt-3 text-xs font-semibold ' + styles.risk}>
                    {invalidRecords.length} record{invalidRecords.length === 1 ? '' : 's'} contained malformed legacy trigger data. Signal recovered an empty rule set; review and save new rules explicitly.
                </p> : null}
                {data.triggerCoverage.length === 0 ? <p className={'mt-3 text-sm ' + styles.textMuted}>No structured triggers are configured. Add up to 10 from a ticker&apos;s Monitoring rules editor.</p> : (
                    <ol className={'mt-3 divide-y border-y ' + styles.divider}>
                        {data.triggerCoverage.map((trigger) => (
                            <li key={`${trigger.symbol}-${trigger.rule.id}`} className="grid gap-1 py-3 min-[760px]:grid-cols-[120px_minmax(0,1fr)]">
                                <span className={'text-xs font-bold ' + (trigger.status === 'matched' ? tone(trigger.severity) : trigger.status === 'unavailable' ? styles.risk : styles.textMuted)}>{coverageLabel(trigger.status)}</span>
                                <div className="min-w-0">
                                    <p className={'text-xs font-semibold ' + styles.textPrimary}>{trigger.symbol} · {trigger.title}</p>
                                    <p className={'mt-1 break-words text-xs leading-5 ' + styles.textMuted}>{trigger.detail}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                )}
            </section>

            {queueStatus ? <p role="status" className={'mt-3 text-xs ' + styles.positive}>{queueStatus}</p> : null}
            {data.alerts.length === 0 ? (
                <div className={'py-16 text-center text-sm ' + styles.textMuted}>No active conditions. Monitoring remains current.</div>
            ) : (
                <ol>
                    {data.alerts.map((alert) => (
                        <li key={alert.id} className={'grid grid-cols-[80px_minmax(0,1fr)] gap-3 border-b py-4 min-[700px]:grid-cols-[90px_120px_minmax(0,1fr)] ' + styles.divider}>
                            <button type="button" onClick={() => onOpen(alert.symbol)} className={'flex min-h-10 items-start rounded pt-0.5 text-left font-mono text-sm font-bold leading-5 ' + styles.textPrimary}>{alert.symbol}</button>
                            <span className={'text-xs font-semibold ' + tone(alert.severity)}>{severityLabel(alert.severity)}</span>
                            <div className="col-span-2 min-w-0 min-[700px]:col-span-1">
                                <p className={'text-sm font-semibold ' + styles.textPrimary}>{alert.title}</p>
                                <p className={'mt-1 break-words text-xs leading-5 ' + styles.textMuted}>{alert.detail}</p>
                                <button type="button" aria-label={`Queue ${alert.symbol} ${severityLabel(alert.severity)} review`} onClick={() => {
                                    const ruleId = alert.structuredTrigger?.rule.id;
                                    const result = enqueueResearchWorkflowTaskClient({
                                        symbol: alert.symbol,
                                        templateId: queueTemplate(alert),
                                        source: ruleId ? 'structured-trigger' : 'alert',
                                        dedupeKey: ruleId ? `structured-trigger:${alert.symbol}:${ruleId}` : undefined,
                                        dueAt: new Date().toISOString().slice(0, 10),
                                    });
                                    setQueueStatus(result.created
                                        ? `${alert.symbol} ${alert.title.toLowerCase()} added to the Queue.`
                                        : `${alert.symbol} already has this review prompt in the Queue.`);
                                }} className={'mt-2 min-h-10 rounded border px-3 text-xs font-semibold ' + styles.row}>
                                    Queue review
                                </button>
                            </div>
                        </li>
                    ))}
                </ol>
            )}
            {data.warnings.map((warning) => <p key={warning} className={'mt-3 text-xs ' + styles.textMuted}>{warning}</p>)}
            <ResearchNotificationCenterV6 records={records} alerts={data.alerts} theme={theme} />
        </section>
    );
};
