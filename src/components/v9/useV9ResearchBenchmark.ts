'use client';

import { useEffect, useState } from 'react';
import { readData, readPolicies } from '@/components/v8/read-data';
import { parseResearchSnapshotResponse } from '@/lib/research/snapshot-input';
import type { ResearchBenchmark, ResearchSnapshot } from '@/lib/types/research-snapshot';

type Result = { snapshot: ResearchSnapshot; attempt: number; benchmark: ResearchBenchmark | null };

/** The standalone benchmark service supplies US return comparisons. Chart comparisons load separately. */
export function useV9ResearchBenchmark(snapshot: ResearchSnapshot | null, loadForReview = false) {
    const [attempt, setAttempt] = useState(loadForReview ? 1 : 0);
    const [result, setResult] = useState<Result | null>(null);
    const requested = attempt > 0 && snapshot?.market === 'US' && snapshot.benchmark.status === 'unavailable'
        && (!loadForReview || snapshot.symbol !== 'VOO') ? snapshot : null;
    const current = result?.snapshot === requested && result.attempt === attempt ? result : null;

    useEffect(() => {
        if (!requested) return;
        const controller = new AbortController();
        readData(`/api/research/benchmark/${encodeURIComponent(requested.symbol)}?market=US`, controller.signal, readPolicies.provider)
            .then(payload => {
                if (!payload || typeof payload !== 'object' || !('success' in payload) || payload.success !== true || !('data' in payload)) {
                    throw new Error('Invalid benchmark response.');
                }
                return parseResearchSnapshotResponse({ success: true, data: { ...requested, benchmark: payload.data } }).benchmark;
            })
            .then(benchmark => { if (!controller.signal.aborted) setResult({ snapshot: requested, attempt, benchmark }); })
            .catch(() => { if (!controller.signal.aborted) setResult({ snapshot: requested, attempt, benchmark: null }); });
        return () => controller.abort();
    }, [attempt, requested]);

    return {
        snapshot: snapshot && current?.benchmark ? { ...snapshot, benchmark: current.benchmark } : snapshot,
        loading: !!requested && !current,
        error: !!current && !current.benchmark,
        request: () => {
            if (!attempt || (current && !current.benchmark)) setAttempt(value => value + 1);
        },
    };
}
