'use client';

import { useEffect, useMemo, useState } from 'react';
import { parseResearchRecord } from '@/lib/research/input';
import { readGuestWorkspace } from '@/lib/research/guest-workspace';
import { buildMarketWatchlistExposure, normalizeExposureSector, type MarketExposureLevel, type MarketExposureWatchlistItem } from '@/lib/research/market-exposure';
import { personalReviewDate } from '@/lib/research/review-lifecycle';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { readData, readPolicies } from './read-data';
import styles from './market-v8-outcomes.module.css';
import { MarketMobileSection } from './MarketMobileSection';
import { MetricGlossary } from './MetricGlossary';
import { metricForIndicator } from '@/lib/learn/metric-links';

const levelLabel: Record<MarketExposureLevel, string> = { higher: 'Higher connection', moderate: 'Moderate connection', lower: 'Lower connection', unmapped: 'Unmapped' };
const maximumClassified = 20;

// Drivers that share a rule read as one line instead of repeating the same sentence.
const groupByRule = (connections: readonly { driverName: string; rule: string }[]) => [...connections.reduce((groups, connection) => groups.set(connection.rule, [...(groups.get(connection.rule) ?? []), connection.driverName]), new Map<string, string[]>())].map(([rule, drivers]) => ({ rule, drivers }));
type Classification = { sector: string; industry: string; unavailable?: boolean };

// Saved securities from whichever workspace this browser uses; guest records never touch owner routes.
async function readSavedRecords(signal: AbortSignal): Promise<{ records: ResearchRecord[]; workspace: 'guest' | 'owner' }> {
    const session = await readData('/api/owner/session', signal, { attemptMs: 3000, budgetMs: 6500 }).catch(() => null);
    const owner = !!session && typeof session === 'object' && 'data' in session && !!session.data && typeof session.data === 'object' && 'unlocked' in session.data && session.data.unlocked === true;
    if (!owner) return { records: readGuestWorkspace().records, workspace: 'guest' };
    const payload = await readData('/api/research/watchlist', signal, readPolicies.watchlist);
    const body = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    const archived = Array.isArray(body.archivedSymbols) ? body.archivedSymbols : [];
    return { records: (Array.isArray(body.data) ? body.data.map(parseResearchRecord) : []).filter(record => !archived.includes(record.symbol)), workspace: 'owner' };
}

// Sector and industry by exact provider symbol through the public security search.
async function classify(symbol: string, market: ResearchMarket, signal: AbortSignal): Promise<Classification> {
    const response = await fetch(`/api/research/search?q=${encodeURIComponent(symbol)}&market=${market}`, { signal });
    if (!response.ok) throw new Error('Classification unavailable');
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object' || !('data' in payload) || !Array.isArray(payload.data)) throw new Error('Classification unavailable');
    const rows = payload.data as Record<string, unknown>[];
    const canonical = market === 'MY' && !symbol.endsWith('.KL') ? `${symbol}.KL` : symbol;
    const match = rows.find(row => row.symbol === canonical || row.symbol === symbol);
    const instrumentType = match?.instrumentType === 'ETF' ? 'ETF' : 'EQUITY';
    return { sector: normalizeExposureSector(typeof match?.sector === 'string' ? match.sector : null, match ? instrumentType : null), industry: typeof match?.industry === 'string' ? match.industry : 'Unknown' };
}

export function MarketV8Exposure({ signal }: { signal: MarketSignal }) {
    const market = signal.metadata.market;
    const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; records: ResearchRecord[]; workspace: 'guest' | 'owner' }>({ status: 'loading', records: [], workspace: 'guest' });
    const [classes, setClasses] = useState<Record<string, Classification>>({});
    useEffect(() => {
        const controller = new AbortController();
        readSavedRecords(controller.signal)
            .then(result => setState({ status: 'ready', ...result }))
            .catch(() => { if (!controller.signal.aborted) setState(current => ({ ...current, status: 'error' })); });
        return () => controller.abort();
    }, []);
    const sameMarket = useMemo(() => state.records.filter(record => record.market === market).slice(0, maximumClassified), [state.records, market]);
    const pending = sameMarket.filter(record => !classes[`${record.market}:${record.symbol}`]).map(record => `${record.market}:${record.symbol}`).join('|');
    useEffect(() => {
        if (!pending) return;
        const controller = new AbortController();
        Promise.all(pending.split('|').map(async key => {
            const [recordMarket, symbol] = key.split(':') as [ResearchMarket, string];
            return [key, await classify(symbol, recordMarket, controller.signal).catch(() => ({ sector: 'Unknown', industry: 'Unknown', unavailable: true }))] as const;
        })).then(entries => { if (!controller.signal.aborted) setClasses(current => ({ ...current, ...Object.fromEntries(entries) })); });
        return () => controller.abort();
    }, [pending]);
    const items: MarketExposureWatchlistItem[] = sameMarket.map(record => {
        const classification = classes[`${record.market}:${record.symbol}`];
        return { symbol: record.symbol, market: record.market, sector: classification?.sector ?? 'Unknown', industry: classification?.industry ?? 'Unknown', positionState: record.positionState === 'owned' ? 'owned' : 'not-owned', lastReviewedAt: state.workspace === 'owner' ? personalReviewDate(record) : null };
    });
    const exposures = buildMarketWatchlistExposure(signal, items);
    const drivers = (signal.metadata.score_drivers ?? []).filter(driver => signal.components[driver.key]?.enabled === true);
    const classifying = !!pending;
    // With nothing saved, the card is only a pointer to Research; driver chips and rules add no information.
    const empty = state.status === 'ready' && exposures.length === 0;
    const savedCount = state.records.filter(record => record.market === market).length;
    const mappedCount = exposures.filter(item => item.highestLevel !== 'unmapped').length;
    const unavailableCount = sameMarket.filter(record => classes[`${record.market}:${record.symbol}`]?.unavailable).length;
    const summary = state.status === 'loading' ? 'Loading saved stocks…' : state.status === 'error' ? 'Saved research unavailable'
        : empty ? `No saved ${market} stocks to map`
            : `${exposures.length}${savedCount > maximumClassified ? ` of ${savedCount}` : ''} saved ${market} ${savedCount === 1 ? 'stock' : 'stocks'} · ${classifying ? 'classifying…' : `${mappedCount} mapped${unavailableCount ? ` · ${unavailableCount} classification unavailable` : ''}`}`;
    return <MarketMobileSection name="exposure" title="Exposure map" summary={summary} className={styles.card}>
        <div data-testid="market-watchlist-exposure">
        <div className={styles.heading}>
            <div><span className={styles.eyebrow}>Market → your saved stocks</span><h2 id="market-exposure-title">Exposure map</h2></div>
            {exposures.length > 0 && <span className={styles.tag}>{classifying ? 'Classifying…' : `${mappedCount} mapped · ${exposures.filter(item => item.highestLevel === 'higher').length} higher`}</span>}
        </div>
        {!empty && <p className={styles.meta}>Connects today’s active score drivers to your saved {market} stocks by sector, using visible rules. A prompt to review, not a measured price sensitivity.</p>}
        {!empty && drivers.length > 0 && <ul className={styles.drivers} aria-label="Active score drivers">{drivers.map(driver => <li key={driver.key} data-impact={driver.impact}><b><MetricGlossary metric={metricForIndicator(driver.key)}>{driver.name}</MetricGlossary></b> · {driver.impact}</li>)}</ul>}
        {state.status === 'loading' ? <p role="status">Loading saved securities…</p>
            : state.status === 'error' ? <p role="alert">Saved research could not be read. The market reading above is unaffected.</p>
                : exposures.length === 0 ? <p className={styles.empty}>No saved {market} stocks to map. <a href={`/research-v8?market=${market}`}>Save a security in Research</a> to see how today’s drivers connect to it.</p>
                    : <ul className={styles.exposures}>{exposures.map(item => <li key={item.symbol}>
                        <div className={styles.exposureHead}>
                            <a href={`/research-v8?ticker=${encodeURIComponent(item.symbol)}&market=${market}`}><b>{item.symbol}</b></a>
                            <small>{classes[`${market}:${item.symbol}`]?.unavailable ? 'Classification unavailable' : classifying && item.sector === 'Unknown' ? 'Classifying…' : `${item.sector} · ${item.industry}`}{item.owned ? ' · Owned' : ''}</small>
                            <span className={styles.level} data-level={item.highestLevel}>{classes[`${market}:${item.symbol}`]?.unavailable ? 'Unavailable' : levelLabel[item.highestLevel]}</span>
                        </div>
                        {item.highestLevel !== 'unmapped' && <ul className={styles.connections}>{groupByRule(item.connections).map(group => <li key={group.rule}><b>{group.drivers.map((name, index) => { const driver = drivers.find(item => item.name === name); return <span key={name}><MetricGlossary metric={metricForIndicator(driver?.key ?? '')}>{name}</MetricGlossary>{index < group.drivers.length - 1 ? ', ' : ''}</span>; })}</b><span>{group.rule}</span></li>)}</ul>}
                        {state.workspace === 'owner' && <small>{item.reviewStatus === 'not-reviewed' ? 'Not reviewed yet' : item.reviewAgeDays === null ? 'Review date unavailable' : `Reviewed ${item.reviewAgeDays} days ago`}</small>}
                    </li>)}</ul>}
        {state.records.filter(record => record.market === market).length > maximumClassified && <p className={styles.meta}>Showing the first {maximumClassified} saved {market} stocks.</p>}
        {unavailableCount > 0 && <p className={styles.meta}>Reload the page to retry unavailable classifications.</p>}
        {!empty && <details className={styles.sample}><summary>How connections are mapped</summary><p>Rules use only market and sector. They do not use beta, fund look-through, revenue geography or factor models; unknown sectors stay unmapped.</p></details>}
        </div>
    </MarketMobileSection>;
}
