'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    sourceHealthStatuses,
    summarizeSourceHealth,
    type SourceHealthEntry,
    type SourceHealthReport,
    type SourceHealthStatus,
} from '@/lib/types/source-health';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';
import { trackProductAnalyticsEvent } from '@/lib/product-analytics-client';

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const parseReport = (payload: unknown): SourceHealthReport => {
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)
        || typeof payload.data.generatedAt !== 'string' || !Array.isArray(payload.data.entries)) {
        throw new Error('Invalid source-health response.');
    }
    const entries = payload.data.entries.flatMap((value): readonly SourceHealthEntry[] => {
        if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string'
            || !sourceHealthStatuses.includes(value.status as SourceHealthStatus)
            || (value.category !== 'market' && value.category !== 'research' && value.category !== 'context' && value.category !== 'delivery' && value.category !== 'storage')
            || value.checkedAt !== null && typeof value.checkedAt !== 'string'
            || value.lastSuccessfulAt !== null && typeof value.lastSuccessfulAt !== 'string'
            || value.latencyMs !== null && typeof value.latencyMs !== 'number'
            || typeof value.cadence !== 'string' || typeof value.coverage !== 'string'
            || !Array.isArray(value.affectedFeatures) || !value.affectedFeatures.every((item) => typeof item === 'string')
            || typeof value.detail !== 'string') return [];
        return [value as SourceHealthEntry];
    });
    if (entries.length !== payload.data.entries.length) throw new Error('Invalid source-health entries.');
    return { generatedAt: payload.data.generatedAt, entries };
};

const statusLabel = (status: SourceHealthStatus) => status === 'healthy' ? 'Healthy'
    : status === 'degraded' ? 'Degraded'
        : status === 'unconfigured' ? 'Not configured' : 'Not checked here';

export const SourceHealthDashboardV6 = ({ theme }: { readonly theme: ResearchThemeV6 }) => {
    const [report, setReport] = useState<SourceHealthReport | null>(null);
    const [filter, setFilter] = useState<SourceHealthStatus | 'all'>('all');
    const [requestKey, setRequestKey] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const styles = getThemeV6(theme);

    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        const load = async () => {
            try {
                const response = await fetch('/api/source-health', { signal: controller.signal });
                const payload: unknown = await response.json();
                if (!response.ok && isRecord(payload) && typeof payload.error === 'string') throw new Error(payload.error);
                const parsed = parseReport(payload);
                if (active) {
                    setReport(parsed);
                    setError(null);
                }
            } catch (caught) {
                if (active && !(caught instanceof DOMException && caught.name === 'AbortError')) {
                    setError(caught instanceof Error ? caught.message : 'Source health is unavailable.');
                }
            } finally {
                if (active) setLoading(false);
            }
        };
        void load();
        return () => { active = false; controller.abort(); };
    }, [requestKey]);

    const summary = useMemo(() => summarizeSourceHealth(report?.entries ?? []), [report]);
    const entries = report?.entries.filter((entry) => filter === 'all' || entry.status === filter) ?? [];
    const tone = (status: SourceHealthStatus) => status === 'healthy' ? styles.positive
        : status === 'degraded' || status === 'unconfigured' ? styles.risk : styles.textSecondary;

    return (
        <section className="min-w-0 flex-1" aria-labelledby="source-health-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + styles.positive}>Data operations</p>
                    <h1 id="source-health-title" className={'mt-1 text-xl font-bold ' + styles.textPrimary}>Source health and coverage</h1>
                    <p className={'mt-1 max-w-3xl text-sm leading-6 ' + styles.textMuted}>Live bounded probes are separate from configuration checks and normal feature fetches. “Not checked here” is not treated as healthy.</p>
                </div>
                <button type="button" disabled={loading} onClick={() => {
                    setLoading(true);
                    setRequestKey((current) => current + 1);
                    trackProductAnalyticsEvent({ name: 'source_health_refreshed', surface: 'research', workspace: 'health' });
                }} className={'min-h-10 rounded border px-4 text-xs font-bold disabled:opacity-50 ' + styles.row}>{loading ? 'Checking…' : 'Check again'}</button>
            </div>

            <dl className="mt-5 grid gap-3 grid-cols-2 xl:grid-cols-4">
                {[
                    ['Healthy', summary.healthy, styles.positive],
                    ['Degraded', summary.degraded, styles.risk],
                    ['Not configured', summary.unconfigured, styles.risk],
                    ['Not checked here', summary.unchecked, styles.textSecondary],
                ].map(([label, value, color]) => (
                    <div key={String(label)} className={'rounded-lg border p-4 ' + styles.panelUtility}>
                        <dt className={'text-xs font-semibold ' + styles.textMuted}>{label}</dt>
                        <dd className={'mt-2 font-mono text-xl font-bold ' + color}>{value}</dd>
                    </div>
                ))}
            </dl>

            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Source status filter">
                {(['all', ...sourceHealthStatuses] as const).map((status) => (
                    <button key={status} type="button" aria-pressed={filter === status} onClick={() => setFilter(status)} className={'min-h-10 rounded border px-3 text-xs font-semibold ' + (filter === status ? styles.selectedRow : styles.row)}>
                        {status === 'all' ? 'All sources' : statusLabel(status)}
                    </button>
                ))}
            </div>

            {error ? <div role="alert" className={'mt-5 rounded-lg border p-5 ' + styles.panelSecondary}><p className={'text-sm font-semibold ' + styles.risk}>{error}</p><p className={'mt-1 text-xs ' + styles.textMuted}>The last successful report remains visible when available.</p></div> : null}
            {loading && !report ? <p className={'mt-5 text-sm ' + styles.textMuted}>Running bounded source checks…</p> : null}
            {report ? <p className={'mt-3 text-xs ' + styles.textMuted}>Generated {new Date(report.generatedAt).toLocaleString()} · {entries.length} source{entries.length === 1 ? '' : 's'} shown</p> : null}

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {entries.map((entry) => (
                    <article key={entry.id} className={'rounded-lg border p-4 ' + styles.panelSecondary}>
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className={'text-xs font-semibold uppercase tracking-[0.08em] ' + styles.textMuted}>{entry.category}</p>
                                <h2 className={'mt-1 text-base font-bold ' + styles.textPrimary}>{entry.name}</h2>
                            </div>
                            <span className={'text-xs font-bold ' + tone(entry.status)}>{statusLabel(entry.status)}</span>
                        </div>
                        <dl className="mt-3 grid gap-2 text-xs">
                            <div><dt className={styles.textMuted}>Coverage</dt><dd className={'mt-0.5 ' + styles.textSecondary}>{entry.coverage}</dd></div>
                            <div><dt className={styles.textMuted}>Cadence</dt><dd className={'mt-0.5 ' + styles.textSecondary}>{entry.cadence}</dd></div>
                            <div><dt className={styles.textMuted}>Affected features</dt><dd className={'mt-0.5 ' + styles.textSecondary}>{entry.affectedFeatures.join(' · ')}</dd></div>
                            <div><dt className={styles.textMuted}>Evidence</dt><dd className={'mt-0.5 leading-5 ' + styles.textSecondary}>{entry.detail}</dd></div>
                        </dl>
                        <p className={'mt-3 text-[11px] ' + styles.textMuted}>{entry.checkedAt ? `Checked ${new Date(entry.checkedAt).toLocaleString()}${entry.latencyMs === null ? '' : ` · ${entry.latencyMs}ms`}` : 'No standalone probe was run.'}</p>
                    </article>
                ))}
            </div>
            {report && entries.length === 0 ? <p className={'mt-8 text-center text-sm ' + styles.textMuted}>No sources match this status.</p> : null}
        </section>
    );
};
