'use client';

import { useEffect, useState } from 'react';
import type { SignalConfig } from '@/lib/signal-config';
import type { SignalIntradayEntry, SignalIntradayResponse } from '@/lib/types/signal-intraday';
import { readData, readPolicies } from '@/components/v8/read-data';

type Scope = 'summary' | 'timeline';
type Result = { key: string; data: SignalIntradayResponse | null };
type PageRequest = { key: string; cursor: string; failed: boolean };
type Driver = NonNullable<SignalIntradayEntry['accounting']>['drivers'][number];

export type V9MarketTodayState =
    | { status: 'loading'; day: string }
    | { status: 'error'; day: string; retry: () => void }
    | { status: 'ready'; day: string; data: SignalIntradayResponse; loadingOlder: boolean; olderError: boolean; loadOlder: () => void };

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const optionalNumber = (value: unknown) => value === null || finite(value);
const score = (value: unknown) => finite(value) && value >= 0 && value <= 100;

async function readToday(config: SignalConfig, day: string, scope: Scope, signal: AbortSignal, cursor?: string) {
    const { market, mode, enableSocial } = config;
    const query = new URLSearchParams({ market, mode, enableSocial: String(enableSocial) });
    if (scope === 'summary') query.set('limit', '1');
    if (cursor) {
        query.set('before', cursor);
        query.set('day', day);
    }
    const payload = await readData(`/api/signals/intraday?${query}`, signal, readPolicies.archive) as { success?: boolean; data?: SignalIntradayResponse } | null;
    const data = payload?.data;
    if (!payload?.success || !data || data.day !== day || data.market !== market || data.mode !== mode
        || data.enableSocial !== enableSocial || typeof data.hasEarlierCaptures !== 'boolean' || !Array.isArray(data.entries)) {
        throw new Error('The intraday response does not match the current market settings or UTC day.');
    }
    const valid = data.entries.every((entry: SignalIntradayEntry) => {
        if (!entry || typeof entry.id !== 'string' || !entry.id || typeof entry.capturedAt !== 'string') return false;
        const time = Date.parse(entry.capturedAt);
        if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== day || !score(entry.score)
            || (entry.previousScore !== null && !score(entry.previousScore)) || !optionalNumber(entry.delta)
            || !['baseline', 'changed', 'unchanged', 'unavailable'].includes(entry.status)
            || typeof entry.reason?.text !== 'string') return false;
        const accounting = entry.accounting;
        return accounting === null || (accounting && finite(accounting.componentDelta) && finite(accounting.neutralDelta)
            && finite(accounting.roundingResidual) && Array.isArray(accounting.drivers) && accounting.drivers.every((driver: Driver) => driver
                && typeof driver.key === 'string' && typeof driver.name === 'string' && finite(driver.delta)
                && optionalNumber(driver.beforeValue) && optionalNumber(driver.afterValue)
                && optionalNumber(driver.beforeWeight) && optionalNumber(driver.afterWeight)
                && optionalNumber(driver.scoreEffect) && optionalNumber(driver.weightEffect)));
    });
    if (!valid || (data.hasEarlierCaptures && data.entries.length === 0) || new Set(data.entries.map(entry => entry.id)).size !== data.entries.length) {
        throw new Error('The intraday response contains invalid captures.');
    }
    return data;
}

/** Reuse a full timeline for the Home summary and isolate responses by UTC day and live read. */
export function useV9MarketToday({ market, mode, enableSocial }: SignalConfig, day: string, scope: Scope | null, signalVersion: string | null): V9MarketTodayState {
    const [summary, setSummary] = useState<Result | null>(null);
    const [timeline, setTimeline] = useState<Result | null>(null);
    const [page, setPage] = useState<PageRequest | null>(null);
    const key = signalVersion === null ? null : `${day}:${market}:${mode}:${enableSocial}:${signalVersion}`;
    const result = timeline?.key === key && (scope === 'timeline' || timeline.data) ? timeline : summary?.key === key && scope === 'summary' ? summary : null;
    const activePage = page?.key === key && scope === 'timeline' ? page : null;

    useEffect(() => {
        if (!key || !scope || result) return;
        const controller = new AbortController();
        const setResult = scope === 'summary' ? setSummary : setTimeline;
        readToday({ market, mode, enableSocial }, day, scope, controller.signal)
            .then(data => { if (!controller.signal.aborted) setResult({ key, data }); })
            .catch(() => { if (!controller.signal.aborted) setResult({ key, data: null }); });
        return () => controller.abort();
    }, [day, enableSocial, key, market, mode, result, scope]);

    useEffect(() => {
        if (!activePage || activePage.failed) return;
        const controller = new AbortController();
        readToday({ market, mode, enableSocial }, day, 'timeline', controller.signal, activePage.cursor)
            .then(older => {
                if (controller.signal.aborted) return;
                setTimeline(current => {
                    if (!current?.data || current.key !== activePage.key || current.data.entries.at(-1)?.id !== activePage.cursor) return current;
                    const ids = new Set(current.data.entries.map(entry => entry.id));
                    const next = older.entries.filter(entry => !ids.has(entry.id));
                    return { key: current.key, data: { ...current.data, entries: [...current.data.entries, ...next], hasEarlierCaptures: next.length > 0 && older.hasEarlierCaptures } };
                });
                setPage(null);
            })
            .catch(() => {
                if (!controller.signal.aborted) setPage({ ...activePage, failed: true });
            });
        return () => controller.abort();
    }, [activePage, day, enableSocial, market, mode]);

    if (!result) return { status: 'loading', day };
    if (!result.data) return { status: 'error', day, retry: () => (scope === 'timeline' ? setTimeline : setSummary)(null) };
    const { data } = result;
    return {
        status: 'ready', day, data,
        loadingOlder: !!activePage && !activePage.failed,
        olderError: !!activePage?.failed,
        loadOlder: () => {
            const cursor = data.entries.at(-1)?.id;
            if (key && scope === 'timeline' && data.hasEarlierCaptures && cursor) {
                setPage(current => current?.key === key && current.cursor === cursor && !current.failed ? current : { key, cursor, failed: false });
            }
        },
    };
}
