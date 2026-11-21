'use client';

import { useEffect, useState } from 'react';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { getIndicatorDisplayName } from '@/lib/indicator-registry';
import { fullDate } from './MarketV8ConnectedData';
import { MARKET_VISITS_STORAGE_KEY, parseMarketVisits, recordMarketVisit, visitChanges, visitFromSignal, type MarketVisit } from './market-last-visit';
import layout from './market-v8-connected.module.css';

const signedPoints = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)}`;

/** A tag on the score line comparing today's reading with the last different snapshot seen in this browser; hidden when nothing moved. */
export function MarketSinceLastVisit({ signal, snapshotDate, sourceEnabled, modelVersion }: {
    signal: MarketSignal; snapshotDate: string | null | undefined; sourceEnabled?: boolean; modelVersion?: string;
}) {
    const [visit, setVisit] = useState<{ baseline: MarketVisit; current: MarketVisit; key: string } | null>(null);
    const inV9 = sourceEnabled !== undefined;
    const key = `${signal.metadata.market}:${signal.mode}${inV9 ? sourceEnabled ? ':source-on' : ':source-off' : ''}${modelVersion ? `:${modelVersion}` : ''}`;
    useEffect(() => {
        if (!snapshotDate) return;
        const current = visitFromSignal(signal, snapshotDate);
        let baseline: MarketVisit | null = null;
        try {
            const result = recordMarketVisit(parseMarketVisits(window.localStorage.getItem(MARKET_VISITS_STORAGE_KEY)), key, current);
            window.localStorage.setItem(MARKET_VISITS_STORAGE_KEY, JSON.stringify(result.store));
            baseline = result.baseline;
        } catch { /* Storage unavailable: no comparison is shown. */ }
        // Reading browser storage is an external sync; the comparison is shown after hydration.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setVisit(baseline ? { baseline, current, key } : null);
    }, [signal, snapshotDate, key]);
    if (!visit || (inV9 && (visit.key !== key || visit.current.snapshotDate !== snapshotDate))) return null;
    const { baseline, current } = visit;
    const delta = Math.round(current.score) - Math.round(baseline.score);
    const changes = visitChanges(baseline, current);
    // The score line already reports "No change"; an unchanged visit adds nothing.
    if (delta === 0 && changes.length === 0) return null;
    const name = (input: string) => signal.components[input]?.display_name ?? getIndicatorDisplayName(input);
    const movers = changes.map(change => `${name(change.key)} ${signedPoints(change.delta)}`).join(' · ');
    return <span className={layout.lastVisit} data-testid="market-last-visit" data-direction={delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'} role="status"
        title={`${inV9 ? 'Compared with the previously viewed snapshot from' : 'Since your visit on'} ${fullDate(baseline.snapshotDate)}: ${Math.round(baseline.score)} → ${Math.round(current.score)}. Input changes are in score points. Stored in this browser only.`}>
        <b>{delta !== 0 ? `${delta > 0 ? '+' : '−'}${Math.abs(delta)}${inV9 ? ' points' : ''}` : 'Inputs shifted'}</b> {inV9 ? 'since last visit · viewed snapshot from' : 'since your visit on'} {fullDate(baseline.snapshotDate)}{movers ? <span> · {movers}</span> : null}
    </span>;
}
