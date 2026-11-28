'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { parseResearchQuoteBatchResponse } from '@/lib/research/snapshot-input';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import type { ResearchQuoteBatchResult } from '@/lib/types/research-quote';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';

const MAX_BATCH_ITEMS = 50;

export type V9QuoteBatchStatus = 'idle' | 'loading' | 'ready' | 'error';

export type V9QuoteBatchState = {
    readonly quotes: ReadonlyMap<string, ResearchSnapshot['quote']>;
    readonly results: readonly ResearchQuoteBatchResult[];
    readonly status: V9QuoteBatchStatus;
    readonly error: string;
    readonly fetchedAt: string | null;
    readonly retry: () => void;
};

/**
 * Shared bounded quote hydration for V9 Portfolio and Watchlist views.
 * Requests quotes strictly for saved watchlist records (capped at 50) without exposing local holdings.
 */
export function useV9QuoteBatch(
    records: readonly ResearchRecord[] | null,
    enabled: boolean,
): V9QuoteBatchState {
    const [attempt, setAttempt] = useState(0);
    const [result, setResult] = useState<{
        readonly key: string;
        readonly results: readonly ResearchQuoteBatchResult[];
        readonly fetchedAt: string | null;
        readonly error: string;
    } | null>(null);

    const requestBody = useMemo(() => {
        if (!records?.length) return '';
        const unique = new Map<string, { readonly symbol: string; readonly market: ResearchMarket }>();
        for (const record of records) {
            const symbol = record.symbol.trim().toUpperCase();
            const key = `${record.market}:${symbol}`;
            if (!unique.has(key)) unique.set(key, { symbol, market: record.market });
        }
        const targets = [...unique.values()]
            .sort((left, right) => left.market.localeCompare(right.market) || left.symbol.localeCompare(right.symbol))
            .slice(0, MAX_BATCH_ITEMS);
        return targets.length ? JSON.stringify(targets) : '';
    }, [records]);

    const activeKey = enabled && requestBody ? `${requestBody}:${attempt}` : '';

    useEffect(() => {
        if (!activeKey || !requestBody) return;
        const controller = new AbortController();
        fetch('/api/research/quotes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: requestBody,
            signal: controller.signal,
        })
            .then(async response => {
                if (!response.ok) throw new Error('Live quotes are temporarily unavailable.');
                const payload: unknown = await response.json();
                const results = parseResearchQuoteBatchResponse(payload);
                const data = payload && typeof payload === 'object' ? (payload as { data?: { fetchedAt?: unknown } }).data : undefined;
                const fetchedAt = typeof data?.fetchedAt === 'string' ? data.fetchedAt : null;
                return { results, fetchedAt };
            })
            .then(({ results, fetchedAt }) => {
                if (!controller.signal.aborted) {
                    setResult({ key: activeKey, results, fetchedAt, error: '' });
                }
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setResult({ key: activeKey, results: [], fetchedAt: null, error: 'Live quotes are temporarily unavailable.' });
                }
            });
        return () => controller.abort();
    }, [activeKey, requestBody]);

    const current = activeKey && result?.key === activeKey ? result : null;
    const status: V9QuoteBatchStatus = !activeKey
        ? 'idle'
        : !current
            ? 'loading'
            : current.error
                ? 'error'
                : 'ready';

    const quotes = useMemo(() => {
        const map = new Map<string, ResearchSnapshot['quote']>();
        for (const item of current?.results ?? []) {
            if (item.success) {
                map.set(`${item.data.market}:${item.data.symbol}`, item.data.quote);
            }
        }
        return map;
    }, [current]);

    const retry = useCallback(() => setAttempt(value => value + 1), []);

    return {
        quotes,
        results: current?.results ?? [],
        status,
        error: current?.error ?? '',
        fetchedAt: current?.fetchedAt ?? null,
        retry,
    };
}
