'use client';

import { useEffect, useState } from 'react';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import type { ResearchAlert, ResearchAlertsResponse } from '@/lib/types/research-alert';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type ResearchAlertsV6Props = {
    readonly items: readonly ResearchWatchlistItem[];
    readonly theme: ResearchThemeV6;
    readonly onOpen: (symbol: string) => void;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const isAlert = (value: unknown): value is ResearchAlert => {
    if (!isRecord(value)) return false;
    return typeof value.symbol === 'string' && typeof value.title === 'string' && typeof value.detail === 'string'
        && (value.severity === 'opportunity' || value.severity === 'watch' || value.severity === 'risk');
};

const parseResponse = (payload: unknown): ResearchAlertsResponse => {
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) throw new Error('Invalid research alerts response.');
    const data = payload.data;
    if (typeof data.generatedAt !== 'string' || typeof data.monitoredCount !== 'number'
        || !Array.isArray(data.alerts) || !data.alerts.every(isAlert)
        || !Array.isArray(data.warnings) || !data.warnings.every((warning) => typeof warning === 'string')) {
        throw new Error('Invalid research alerts data.');
    }
    return { generatedAt: data.generatedAt, monitoredCount: data.monitoredCount, alerts: data.alerts, warnings: data.warnings };
};

const severityLabel = (severity: ResearchAlert['severity']) => severity === 'opportunity' ? 'Opportunity' : severity === 'risk' ? 'Risk' : 'Watch';

export const ResearchAlertsV6 = ({ items, theme, onOpen }: ResearchAlertsV6Props) => {
    const [data, setData] = useState<ResearchAlertsResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const styles = getThemeV6(theme);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const response = await fetch('/api/research/alerts', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(items.map((item) => ({ symbol: item.symbol, market: item.market, targetBuyZone: item.targetBuyZone }))),
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
    }, [items]);

    if (items.length === 0) return <section className={'min-h-72 flex-1 p-4 text-sm ' + styles.textMuted}>Add a ticker to begin monitoring.</section>;
    if (error) return <section className={'min-h-72 flex-1 p-4 text-sm ' + styles.risk}>{error}</section>;
    if (!data) return <section className={'min-h-72 flex-1 p-4 text-sm ' + styles.textMuted}>Checking buy zones and trend conditions...</section>;

    const counts = {
        risk: data.alerts.filter((alert) => alert.severity === 'risk').length,
        opportunity: data.alerts.filter((alert) => alert.severity === 'opportunity').length,
        watch: data.alerts.filter((alert) => alert.severity === 'watch').length,
    };
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
            {data.alerts.length === 0 ? (
                <div className={'py-16 text-center text-sm ' + styles.textMuted}>No active conditions. Monitoring remains current.</div>
            ) : (
                <ol>
                    {data.alerts.map((alert) => (
                        <li key={`${alert.symbol}-${alert.title}`} className={'grid grid-cols-[80px_minmax(0,1fr)] gap-3 border-b py-4 min-[700px]:grid-cols-[90px_120px_minmax(0,1fr)] ' + styles.divider}>
                            <button type="button" onClick={() => onOpen(alert.symbol)} className={'flex min-h-10 items-start rounded pt-0.5 text-left font-mono text-sm font-bold leading-5 ' + styles.textPrimary}>{alert.symbol}</button>
                            <span className={'text-xs font-semibold ' + tone(alert.severity)}>{severityLabel(alert.severity)}</span>
                            <div className="col-span-2 min-w-0 min-[700px]:col-span-1">
                                <p className={'text-sm font-semibold ' + styles.textPrimary}>{alert.title}</p>
                                <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>{alert.detail}</p>
                            </div>
                        </li>
                    ))}
                </ol>
            )}
            {data.warnings.map((warning) => <p key={warning} className={'mt-3 text-xs ' + styles.textMuted}>{warning}</p>)}
        </section>
    );
};
