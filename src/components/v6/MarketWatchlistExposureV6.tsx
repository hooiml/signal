'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { watchlist, type ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import { createMarketResearchHandoff, buildResearchHandoffHref } from '@/lib/market-research-handoff';
import { buildMarketWatchlistExposure, type MarketExposureLevel } from '@/lib/research/market-exposure';
import { enqueueResearchWorkflowTaskClient } from '@/lib/research/workflow-queue-client';
import { parseResearchRecord, ResearchInputError } from '@/lib/research/input';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { applyResearchRecordV6, createWatchlistItemV6 } from './research-records-v6';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

const levelLabel: Readonly<Record<MarketExposureLevel, string>> = {
    higher: 'Higher connection',
    moderate: 'Moderate connection',
    lower: 'Lower connection',
    unmapped: 'Unmapped',
};

const mergeSavedWatchlist = (
    saved: ReturnType<typeof parseResearchRecord>[],
    archivedSymbols: readonly string[],
): ResearchWatchlistItem[] => {
    const seeded = watchlist
        .filter((item) => !archivedSymbols.includes(item.symbol))
        .map((item) => {
            const record = saved.find((candidate) => candidate.symbol === item.symbol);
            return record ? applyResearchRecordV6(item, record) : item;
        });
    const additions = saved
        .filter((record) => !watchlist.some((item) => item.symbol === record.symbol))
        .map((record, index) => createWatchlistItemV6(record, 100 + index));
    return [...seeded, ...additions];
};

const researchHref = (signal: MarketSignal, symbol: string) => {
    const [, query = ''] = buildResearchHandoffHref(createMarketResearchHandoff(signal)).split('?');
    const params = new URLSearchParams(query);
    params.set('ticker', symbol);
    params.set('review', 'edit');
    return `/research?${params.toString()}`;
};

export const MarketWatchlistExposureV6 = ({ signal, theme }: {
    readonly signal: MarketSignal;
    readonly theme: ResearchThemeV6;
}) => {
    const styles = getThemeV6(theme);
    const [items, setItems] = useState<ResearchWatchlistItem[]>(watchlist);
    const [loadNote, setLoadNote] = useState<string | null>(null);
    const [queueStatus, setQueueStatus] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        const load = async () => {
            try {
                const response = await fetch('/api/research/watchlist', { signal: controller.signal });
                const payload: unknown = await response.json();
                if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
                    throw new ResearchInputError('Invalid research API response.');
                }
                const body = Object.fromEntries(Object.entries(payload));
                if (!response.ok || !Array.isArray(body.data)) throw new ResearchInputError('Unable to load saved research.');
                const saved = body.data.map(parseResearchRecord);
                const archivedSymbols = Array.isArray(body.archivedSymbols)
                    ? body.archivedSymbols.filter((value): value is string => typeof value === 'string')
                    : [];
                setItems(mergeSavedWatchlist(saved, archivedSymbols));
                setLoadNote(null);
            } catch (error) {
                if (controller.signal.aborted) return;
                setLoadNote(error instanceof Error ? `${error.message} Showing the built-in watchlist.` : 'Showing the built-in watchlist.');
            }
        };
        void load();
        return () => controller.abort();
    }, []);

    const exposures = useMemo(() => buildMarketWatchlistExposure(signal, items), [items, signal]);
    const drivers = (signal.metadata.score_drivers ?? []).filter((driver) => signal.components[driver.key]?.enabled === true);
    const higherCount = exposures.filter((item) => item.highestLevel === 'higher').length;
    const ownedCount = exposures.filter((item) => item.owned).length;

    return <section data-testid="market-watchlist-exposure" aria-labelledby="market-watchlist-exposure-title" data-surface-tier="analysis" className={'rounded-lg border p-5 backdrop-blur-sm sm:p-6 ' + styles.panel}>
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
                <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + styles.positive}>Market → watchlist</p>
                <h2 id="market-watchlist-exposure-title" className={'mt-1 text-lg font-bold ' + styles.textPrimary}>Exposure map</h2>
                <p className={'mt-2 text-sm leading-6 ' + styles.textSecondary}>
                    Connect active market drivers to same-market watchlist sectors using visible rules. Connection strength is a review prompt, not estimated price sensitivity or a recommendation.
                </p>
            </div>
            <div className={'rounded border px-3 py-2 text-xs ' + styles.row}>
                <span className={'font-bold ' + styles.textPrimary}>{exposures.length} mapped names</span>
                <span className={'ml-2 ' + styles.textMuted}>{ownedCount} owned · {higherCount} higher connection</span>
            </div>
        </div>

        <div className="mt-4 flex max-w-full gap-2 overflow-x-auto pb-1">
            {drivers.length > 0 ? drivers.map((driver) => (
                <span key={driver.key} className={'shrink-0 rounded border px-2.5 py-1.5 text-xs ' + styles.row}>
                    <strong className={styles.textPrimary}>{driver.name}</strong>
                    <span className={'ml-1 ' + styles.textMuted}>· {driver.impact}</span>
                </span>
            )) : <p className={'text-sm ' + styles.textMuted}>Active score drivers are unavailable, so no connections can be inferred.</p>}
        </div>

        {loadNote ? <p role="status" className={'mt-3 text-xs ' + styles.risk}>{loadNote}</p> : null}
        {queueStatus ? <p role="status" className={'mt-3 text-xs ' + styles.positive}>{queueStatus}</p> : null}

        {exposures.length > 0 ? <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {exposures.map((item) => (
                <article key={item.symbol} className={'min-w-0 rounded border p-4 ' + styles.row}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className={'text-base font-bold ' + styles.textPrimary}>{item.symbol}</h3>
                                {item.owned ? <span className={'rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ' + styles.selectedRow}>Owned</span> : null}
                            </div>
                            <p className={'mt-1 text-xs ' + styles.textMuted}>{item.sector} · {item.industry}</p>
                        </div>
                        <span className={'rounded border px-2 py-1 text-xs font-semibold ' + (item.highestLevel === 'higher' ? styles.risk : styles.panelUtility)}>
                            {levelLabel[item.highestLevel]}
                        </span>
                    </div>
                    <div className="mt-3 space-y-2">
                        {item.connections.slice(0, 3).map((connection) => (
                            <div key={connection.driverKey} className="grid min-w-0 gap-1 text-xs sm:grid-cols-[130px_minmax(0,1fr)]">
                                <p className={'font-semibold ' + styles.textPrimary}>{connection.driverName} · {levelLabel[connection.level].replace(' connection', '')}</p>
                                <p className={'leading-5 ' + styles.textMuted}>{connection.rule}</p>
                            </div>
                        ))}
                    </div>
                    <div className={'mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 ' + styles.divider}>
                        <p className={'text-xs ' + styles.textMuted}>{item.reviewAgeDays === null ? 'Review date unavailable' : `Reviewed ${item.reviewAgeDays} days ago`}</p>
                        <div className="flex flex-wrap justify-end gap-2">
                            <button type="button" aria-label={`Queue ${item.symbol} market-context review`} onClick={() => {
                                const result = enqueueResearchWorkflowTaskClient({
                                    symbol: item.symbol,
                                    templateId: 'thesis-challenge',
                                    source: 'market-exposure',
                                    dueAt: new Date().toISOString().slice(0, 10),
                                });
                                setQueueStatus(result.created
                                    ? `${item.symbol} market-context review added to the Queue.`
                                    : `${item.symbol} already has this market-context review in the Queue.`);
                            }} className={'min-h-10 rounded border px-3 text-xs font-bold ' + styles.row}>
                                Queue context
                            </button>
                            <Link href={researchHref(signal, item.symbol)} className={'inline-flex min-h-10 items-center rounded border px-3 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ' + styles.selectedRow}>
                                Review {item.symbol}
                            </Link>
                        </div>
                    </div>
                </article>
            ))}
        </div> : <div className={'mt-5 rounded border p-6 text-center ' + styles.panelUtility}>
            <p className={'text-sm font-semibold ' + styles.textPrimary}>No {signal.metadata.market} watchlist names to map</p>
            <p className={'mt-1 text-xs ' + styles.textMuted}>Add a same-market company in Research to connect it to these drivers.</p>
        </div>}

        <p className={'mt-4 text-xs leading-5 ' + styles.textMuted}>
            Rules use only the saved market and sector classification. They do not use beta, holdings look-through, revenue geography, or company-specific factor models; unknown sectors remain explicitly unmapped.
        </p>
    </section>;
};
