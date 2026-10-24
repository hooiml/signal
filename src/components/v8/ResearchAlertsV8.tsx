'use client';

import { useEffect, useMemo, useState } from 'react';
import { parseResearchAlertsResponse } from '@/components/v6/ResearchAlertsV6';
import { buildResearchAlertRequest } from '@/lib/research/alert-request';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import type { ResearchAlert, ResearchAlertsResponse } from '@/lib/types/research-alert';
import { researchHref, retrievedAt } from './research-v8-connected-data';
import styles from './research-discover-v8.module.css';

const severityLabel: Record<ResearchAlert['severity'], string> = { risk: 'Risk', watch: 'Watch', opportunity: 'Opportunity' };
const severityOrder: Record<ResearchAlert['severity'], number> = { risk: 0, watch: 1, opportunity: 2 };
const maximumMonitored = 50;

// Current market conditions and explicit review triggers across saved securities. Review prompts, not trade signals.
export function ResearchAlertsV8({ records, workspace, onSelect }: { records: readonly ResearchRecord[] | null; workspace: 'checking' | 'guest' | 'owner'; onSelect: (symbol: string, market: ResearchMarket) => void }) {
    const body = useMemo(() => {
        const monitored = [...new Map((records ?? []).map(record => [record.symbol, record])).values()].slice(0, maximumMonitored);
        return JSON.stringify(buildResearchAlertRequest(monitored.map(record => ({ symbol: record.symbol, market: record.market, targetBuyZone: record.targetBuyZone, lastReviewedAt: null })), monitored));
    }, [records]);
    const [result, setResult] = useState<{ body: string; data: ResearchAlertsResponse | null; error: string } | null>(null);
    const [attempt, setAttempt] = useState(0);
    const hasRecords = !!records?.length;
    useEffect(() => {
        if (!hasRecords) return;
        const controller = new AbortController();
        fetch('/api/research/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: controller.signal })
            .then(async response => parseResearchAlertsResponse(await response.json()))
            .then(data => setResult({ body, data, error: '' }))
            .catch(cause => { if (!controller.signal.aborted) setResult({ body, data: null, error: cause instanceof Error ? cause.message : 'Alerts are unavailable.' }); });
        return () => controller.abort();
    }, [hasRecords, body, attempt]);
    const current = result?.body === body ? result : null;
    const marketBySymbol = new Map((records ?? []).map(record => [record.symbol, record.market]));
    const alerts = [...(current?.data?.alerts ?? [])].sort((left, right) => severityOrder[left.severity] - severityOrder[right.severity] || left.symbol.localeCompare(right.symbol));
    const triggers = current?.data?.triggerCoverage ?? [];
    return <div className={styles.alerts}>
        <p className={styles.meta}>Checks your saved securities for price, trend and earnings conditions{workspace === 'owner' ? ' and the numeric review triggers you set' : ''}. These are prompts to review, not buy or sell signals.</p>
        {!records ? <p role="status">Loading saved securities…</p>
            : !hasRecords ? <p className={styles.meta}>Save a security to start monitoring it here.</p>
                : !current ? <p role="status">Checking {Math.min(records.length, maximumMonitored)} saved securities… This reads current market data and can take a little while.</p>
                    : current.error ? <p role="alert">{current.error} <button className={styles.secondary} onClick={() => { setResult(null); setAttempt(value => value + 1); }}>Retry</button></p>
                        : current.data && <>
                            <div className={styles.resultHead}><p className={styles.meta}>{current.data.monitoredCount} monitored · {alerts.filter(alert => alert.severity === 'risk').length} risk · {alerts.filter(alert => alert.severity === 'watch').length} watch · {alerts.filter(alert => alert.severity === 'opportunity').length} opportunity · checked {retrievedAt(current.data.generatedAt)}</p></div>
                            {alerts.length === 0 ? <p className={styles.meta}>No active conditions right now.</p>
                                : <ul className={styles.alertList}>{alerts.map(alert => <li key={alert.id} data-severity={alert.severity}>
                                    <span className={styles.badge} data-type={alert.severity}>{severityLabel[alert.severity]}</span>
                                    <button className={styles.link} onClick={() => onSelect(alert.symbol, marketBySymbol.get(alert.symbol) ?? 'US')}>{alert.symbol}</button>
                                    <span><b>{alert.title}</b><small>{alert.detail}</small></span>
                                </li>)}</ul>}
                            {workspace === 'owner' && <details className={styles.small}><summary>Your review triggers · {triggers.filter(trigger => trigger.status === 'matched').length} matched of {triggers.length}</summary>
                                {triggers.length === 0 ? <p className={styles.meta}>No numeric review triggers set. Add up to 10 per security in its monitoring rules.</p>
                                    : <ul>{triggers.map(trigger => <li key={`${trigger.symbol}-${trigger.rule.id}`}><b>{trigger.symbol}</b> · {trigger.title} · <i>{trigger.status === 'matched' ? 'matched' : trigger.status === 'not-matched' ? 'active' : trigger.status}</i></li>)}</ul>}
                                {records[0] && <a href={researchHref(records[0].symbol, 'alerts', records[0].market)} target="_blank" rel="noopener noreferrer">Manage triggers in the Research workspace (new tab) ↗</a>}
                            </details>}
                            {current.data.warnings.map(warning => <p key={warning} className={styles.meta}>{warning}</p>)}
                        </>}
        {!!records && records.length > maximumMonitored && <p className={styles.meta}>Monitoring the first {maximumMonitored} saved securities.</p>}
    </div>;
}
