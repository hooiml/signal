'use client';

import { useEffect, useMemo, useState } from 'react';
import { parseMarketAlertRules, type MarketAlertRule } from '@/lib/market-alerts';
import type { ResearchRecord } from '@/lib/types/research';
import {
    parseResearchNotificationSettings,
    type ResearchNotificationDeliveryHistory,
    type ResearchNotificationSettings,
} from '@/lib/types/research-notification-settings';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';
import { trackProductAnalyticsEvent } from '@/lib/product-analytics-client';

const marketAlertStorageKey = 'signal-market-alerts-v6';

type NotificationCenterData = {
    readonly settings: ResearchNotificationSettings;
    readonly configured: boolean;
    readonly history: readonly ResearchNotificationDeliveryHistory[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const parseCenterData = (payload: unknown): NotificationCenterData => {
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) throw new Error('Invalid notification-center response.');
    const data = payload.data;
    if (typeof data.configured !== 'boolean' || !Array.isArray(data.history)) throw new Error('Invalid notification-center data.');
    const history = data.history.flatMap((value): readonly ResearchNotificationDeliveryHistory[] => {
        if (!isRecord(value) || typeof value.digestKey !== 'string' || typeof value.itemCount !== 'number'
            || (value.status !== 'delivered' && value.status !== 'failed' && value.status !== 'duplicate')
            || typeof value.createdAt !== 'string' || value.detail !== null && typeof value.detail !== 'string') return [];
        return [{
            digestKey: value.digestKey,
            itemCount: value.itemCount,
            status: value.status,
            detail: value.detail,
            createdAt: value.createdAt,
        }];
    });
    if (history.length !== data.history.length) throw new Error('Invalid notification history.');
    return {
        settings: parseResearchNotificationSettings(data.settings),
        configured: data.configured,
        history,
    };
};

const enabledResearchRuleCount = (records: readonly ResearchRecord[]) => records.reduce((sum, record) => {
    const rules = record.monitoringRules;
    return sum + Number(rules.buyZone) + Number(rules.belowMa200)
        + Number(rules.rsiBelow !== null) + Number(rules.rsiAbove !== null)
        + Number(rules.earningsWithinDays !== null) + Number(rules.reviewAgeDays !== null);
}, 0);

const historyTone = (status: ResearchNotificationDeliveryHistory['status'], styles: ReturnType<typeof getThemeV6>) =>
    status === 'delivered' ? styles.positive : status === 'failed' ? styles.risk : styles.textSecondary;

export const ResearchNotificationCenterV6 = ({ records, theme }: {
    readonly records: readonly ResearchRecord[];
    readonly theme: ResearchThemeV6;
}) => {
    const [center, setCenter] = useState<NotificationCenterData | null>(null);
    const [draft, setDraft] = useState<ResearchNotificationSettings | null>(null);
    const [marketRules, setMarketRules] = useState<readonly MarketAlertRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const styles = getThemeV6(theme);
    const field = theme === 'light'
        ? 'border-slate-300 bg-white text-slate-950'
        : 'border-[#334354] bg-[#0b1118] text-[#eef2f7]';
    const researchRuleCount = useMemo(() => enabledResearchRuleCount(records), [records]);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                try {
                    const stored = window.localStorage.getItem(marketAlertStorageKey);
                    setMarketRules(stored ? parseMarketAlertRules(JSON.parse(stored)) : []);
                } catch {
                    setMarketRules([]);
                }
                const response = await fetch('/api/research/notifications/settings');
                const payload: unknown = await response.json();
                if (!response.ok && isRecord(payload) && typeof payload.error === 'string') throw new Error(payload.error);
                const parsed = parseCenterData(payload);
                if (active) {
                    setCenter(parsed);
                    setDraft(parsed.settings);
                }
            } catch (caught) {
                if (active) setError(caught instanceof Error ? caught.message : 'Persistent delivery settings are unavailable.');
            } finally {
                if (active) setLoading(false);
            }
        };
        void load();
        return () => { active = false; };
    }, []);

    const save = async () => {
        if (!draft) return;
        setSaving(true);
        setError(null);
        setMessage(null);
        try {
            const response = await fetch('/api/research/notifications/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(draft),
            });
            const payload: unknown = await response.json();
            if (!response.ok && isRecord(payload) && typeof payload.error === 'string') throw new Error(payload.error);
            const parsed = parseCenterData(payload);
            setCenter(parsed);
            setDraft(parsed.settings);
            setMessage('Persistent delivery preferences saved.');
            trackProductAnalyticsEvent({
                name: 'notification_preferences_saved',
                surface: 'research',
                workspace: 'alerts',
                attributes: { mode: parsed.settings.mode, result: 'success' },
            });
        } catch (caught) {
            trackProductAnalyticsEvent({
                name: 'notification_preferences_saved',
                surface: 'research',
                workspace: 'alerts',
                attributes: { mode: draft.mode, result: 'failure' },
            });
            setError(caught instanceof Error ? caught.message : 'Delivery preferences could not be saved.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className={'mt-6 border-t pt-6 ' + styles.divider} aria-labelledby="persistent-alert-center-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + styles.positive}>Persistent delivery</p>
                    <h2 id="persistent-alert-center-title" className={'mt-1 text-lg font-bold ' + styles.textPrimary}>Alert center preferences and history</h2>
                    <p className={'mt-1 max-w-3xl text-xs leading-5 ' + styles.textMuted}>Research monitoring rules are saved with each ticker. Delivery credentials remain server-only. Market-condition rules are still device-local and are counted here without exposing their thresholds to the server.</p>
                </div>
                {center ? <span className={'text-xs font-semibold ' + (center.configured ? styles.positive : styles.risk)}>{center.configured ? 'Webhook configured' : 'Webhook not configured'}</span> : null}
            </div>

            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                    ['Research rules', String(researchRuleCount), 'Server-persisted ticker monitoring conditions'],
                    ['Market rules', String(marketRules.length), 'Saved only in this browser'],
                    ['Delivery attempts', String(center?.history.length ?? 0), 'Most recent retained server events'],
                ].map(([label, value, note]) => (
                    <div key={label} className={'rounded-lg border p-4 ' + styles.panelUtility}>
                        <dt className={'text-xs font-semibold ' + styles.textMuted}>{label}</dt>
                        <dd className={'mt-2 font-mono text-lg font-bold ' + styles.textPrimary}>{value}</dd>
                        <p className={'mt-1 text-[11px] leading-4 ' + styles.textMuted}>{note}</p>
                    </div>
                ))}
            </dl>

            {loading ? <p className={'mt-4 text-sm ' + styles.textMuted}>Loading persistent delivery settings…</p> : null}
            {!loading && draft ? (
                <div className={'mt-4 rounded-lg border p-4 ' + styles.panelSecondary}>
                    <div className="grid gap-3 min-[700px]:grid-cols-2 xl:grid-cols-4">
                        <label className={'flex min-h-10 items-center gap-2 text-xs font-semibold ' + styles.textSecondary}>
                            <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft((current) => current ? { ...current, enabled: event.target.checked } : current)} />
                            Enable scheduled delivery
                        </label>
                        <label className={'text-xs font-semibold ' + styles.textMuted}>Delivery mode
                            <select value={draft.mode} onChange={(event) => setDraft((current) => current ? { ...current, mode: event.target.value === 'urgent-only' ? 'urgent-only' : 'daily' } : current)} className={'mt-1 min-h-10 w-full rounded border px-3 ' + field}>
                                <option value="daily">Daily digest</option>
                                <option value="urgent-only">Urgent only</option>
                            </select>
                        </label>
                        <label className={'flex min-h-10 items-center gap-2 text-xs font-semibold ' + styles.textSecondary}>
                            <input type="checkbox" checked={draft.quietHoursEnabled} onChange={(event) => setDraft((current) => current ? { ...current, quietHoursEnabled: event.target.checked } : current)} />
                            Apply UTC quiet hours
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <label className={'text-xs font-semibold ' + styles.textMuted}>Start UTC
                                <input type="number" min="0" max="23" value={draft.quietHoursStartUtc} disabled={!draft.quietHoursEnabled} onChange={(event) => setDraft((current) => current ? { ...current, quietHoursStartUtc: Number(event.target.value) } : current)} className={'mt-1 min-h-10 w-full rounded border px-2 font-mono disabled:opacity-45 ' + field} />
                            </label>
                            <label className={'text-xs font-semibold ' + styles.textMuted}>End UTC
                                <input type="number" min="0" max="23" value={draft.quietHoursEndUtc} disabled={!draft.quietHoursEnabled} onChange={(event) => setDraft((current) => current ? { ...current, quietHoursEndUtc: Number(event.target.value) } : current)} className={'mt-1 min-h-10 w-full rounded border px-2 font-mono disabled:opacity-45 ' + field} />
                            </label>
                        </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button type="button" disabled={saving} onClick={() => void save()} className="min-h-10 rounded bg-emerald-600 px-4 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save delivery preferences'}</button>
                        {message ? <p role="status" className={'text-xs ' + styles.positive}>{message}</p> : null}
                    </div>
                </div>
            ) : null}
            {error ? <p role="status" className={'mt-3 text-xs ' + styles.risk}>{error} Active in-app research alerts remain available.</p> : null}

            <section className={'mt-4 rounded-lg border p-4 ' + styles.panelSecondary} aria-labelledby="delivery-history-title">
                <div className="flex items-center justify-between gap-3">
                    <h3 id="delivery-history-title" className={'text-sm font-bold ' + styles.textPrimary}>Delivery history</h3>
                    <span className={'text-xs ' + styles.textMuted}>Delivered, failed, and deduplicated digests</span>
                </div>
                {!center || center.history.length === 0 ? <p className={'mt-3 text-xs ' + styles.textMuted}>No retained delivery attempts yet.</p> : (
                    <ol className={'mt-2 divide-y ' + styles.divider}>
                        {center.history.map((entry) => (
                            <li key={`${entry.digestKey}-${entry.createdAt}`} className="grid gap-1 py-3 min-[700px]:grid-cols-[120px_minmax(0,1fr)_auto] min-[700px]:items-center">
                                <span className={'text-xs font-bold uppercase ' + historyTone(entry.status, styles)}>{entry.status}</span>
                                <div>
                                    <p className={'text-xs ' + styles.textSecondary}>{entry.itemCount} item{entry.itemCount === 1 ? '' : 's'} · delivery ID {entry.digestKey.slice(0, 10)}…</p>
                                    {entry.detail ? <p className={'mt-1 text-[11px] ' + styles.textMuted}>{entry.detail}</p> : null}
                                </div>
                                <time className={'text-xs ' + styles.textMuted}>{new Date(entry.createdAt).toLocaleString()}</time>
                            </li>
                        ))}
                    </ol>
                )}
            </section>
        </section>
    );
};
