'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseResearchAlertsResponse } from '@/components/v6/ResearchAlertsV6';
import { buildResearchAlertRequest, monitoredAlertRecords } from '@/lib/research/alert-request';
import { researchListingKey } from '@/lib/research/listing-identity';
import type { ResearchStructuredTriggerEvaluation } from '@/lib/research/structured-triggers';
import type { ResearchRecord } from '@/lib/types/research';
import type { ResearchAlert, ResearchAlertsResponse } from '@/lib/types/research-alert';

export type V9AlertsScanStatus = 'idle' | 'loading' | 'ready' | 'error';

export type V9AlertsScanState = {
    readonly status: V9AlertsScanStatus;
    readonly data: ResearchAlertsResponse | null;
    readonly error: string;
    readonly monitoredCount: number;
    readonly matchedListings: ReadonlySet<string>;
    readonly sortedAlerts: readonly ResearchAlert[];
    readonly matchedTriggers: readonly ResearchStructuredTriggerEvaluation[];
    readonly scan: () => void;
};

const severityOrder: Record<ResearchAlert['severity'], number> = { risk: 0, watch: 1, opportunity: 2 };

/**
 * On-demand /api/research/alerts scanner shared by the V9 Topbar Attention Popover
 * and Watchlist "Triggered rules" filter. Never fires unsolicited background polls.
 */
export function useV9AlertsScan(records: readonly ResearchRecord[] | null): V9AlertsScanState {
    const controllerRef = useRef<AbortController | null>(null);
    const [result, setResult] = useState<{
        readonly key: string;
        readonly status: 'loading' | 'ready' | 'error';
        readonly data: ResearchAlertsResponse | null;
        readonly error: string;
    } | null>(null);

    const monitored = useMemo(
        () => monitoredAlertRecords(records ?? []),
        [records],
    );

    const recordsKey = useMemo(
        () => monitored.map(record => `${record.market}:${record.symbol}:${record.revision}:${record.updatedAt}`).join('|'),
        [monitored],
    );

    const requestBody = useMemo(() => {
        if (!monitored.length) return '';
        return JSON.stringify(buildResearchAlertRequest(monitored, monitored));
    }, [monitored]);

    useEffect(() => () => controllerRef.current?.abort(), []);

    const scan = useCallback(() => {
        if (!requestBody || !recordsKey) return;
        controllerRef.current?.abort();
        const controller = new AbortController();
        controllerRef.current = controller;
        setResult({ key: recordsKey, status: 'loading', data: null, error: '' });
        fetch('/api/research/alerts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: requestBody,
            signal: controller.signal,
        })
            .then(async response => {
                const payload: unknown = await response.json();
                return parseResearchAlertsResponse(payload);
            })
            .then(data => {
                if (!controller.signal.aborted) {
                    setResult({ key: recordsKey, status: 'ready', data, error: '' });
                }
            })
            .catch(cause => {
                if (!controller.signal.aborted) {
                    setResult({
                        key: recordsKey,
                        status: 'error',
                        data: null,
                        error: cause instanceof Error ? cause.message : 'Alerts are unavailable.',
                    });
                }
            });
    }, [recordsKey, requestBody]);

    const active = recordsKey && result?.key === recordsKey ? result : null;
    const status: V9AlertsScanStatus = !monitored.length || !active ? 'idle' : active.status;
    const data = status === 'ready' ? active?.data ?? null : null;

    const sortedAlerts = useMemo(
        () => [...(data?.alerts ?? [])].sort(
            (left, right) => severityOrder[left.severity] - severityOrder[right.severity] || left.symbol.localeCompare(right.symbol),
        ),
        [data],
    );

    const matchedTriggers = useMemo(
        () => (data?.triggerCoverage ?? []).filter(trigger => trigger.status === 'matched'),
        [data],
    );

    const matchedListings = useMemo(
        () => new Set([...sortedAlerts, ...matchedTriggers].map(({ market, symbol }) => researchListingKey(market, symbol))),
        [matchedTriggers, sortedAlerts],
    );

    return {
        status,
        data,
        error: status === 'error' ? active?.error ?? 'Alerts are unavailable.' : '',
        monitoredCount: monitored.length,
        matchedListings,
        sortedAlerts,
        matchedTriggers,
        scan,
    };
}
