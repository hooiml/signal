'use client';

import { useEffect, useRef, useState } from 'react';
import { buildComparisonMetrics, type ComparisonMetrics } from '@/lib/research/comparison';
import { buildPeerBenchmark } from '@/lib/research/peer-benchmark';
import { parseResearchSnapshotResponse } from '@/lib/research/snapshot-input';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import { readData, readPolicies } from './read-data';
import styles from './research-v8-modules.module.css';

const maximumPeers = 5;
const tickerPattern = /^[A-Z0-9.-]{1,15}$/;
const value = (number: number | null, suffix: string) => number === null ? '—' : `${number.toFixed(suffix === '%' ? 1 : 2)}${suffix}`;
const trendRows: readonly (readonly [keyof ComparisonMetrics, string])[] = [['price', 'Price'], ['dailyChange', 'Daily change'], ['rsi', 'RSI (14)'], ['versusMa50', 'vs 50-day average'], ['versusMa200', 'vs 200-day average']];

type Loaded = Record<string, ResearchSnapshot | 'loading' | 'error'>;

// Peer benchmarking and side-by-side comparison for the open security; peers are any same-market tickers.
export function ResearchPeersV8({ symbol, market, snapshot, saved, onOpen }: { symbol: string; market: ResearchMarket; snapshot: ResearchSnapshot | null; saved: readonly ResearchRecord[]; onOpen: (symbol: string, market: ResearchMarket) => void }) {
    const suggestions = saved.filter(record => record.market === market && record.symbol !== symbol).map(record => record.symbol);
    // Until the user edits the set, the first saved same-market securities are the default peers (records can load after mount).
    const [chosen, setPeers] = useState<string[] | null>(null);
    const peers = chosen ?? suggestions.slice(0, 3);
    const [loaded, setLoaded] = useState<Loaded>({});
    const [input, setInput] = useState('');
    const [inputError, setInputError] = useState('');
    const missing = peers.filter(peer => !loaded[peer]).join('|');
    // One controller per mounted panel: marking a peer as loading must not cancel its own request.
    const requests = useRef<AbortController | null>(null);
    useEffect(() => () => requests.current?.abort(), []);
    useEffect(() => {
        if (!missing) return;
        if (!requests.current || requests.current.signal.aborted) requests.current = new AbortController();
        const signal = requests.current.signal;
        const symbols = missing.split('|');
        const timer = window.setTimeout(() => setLoaded(current => ({ ...current, ...Object.fromEntries(symbols.map(peer => [peer, 'loading' as const])) })), 0);
        for (const peer of symbols) {
            readData(`/api/research/symbol/${encodeURIComponent(peer)}?market=${market}&benchmark=defer`, signal, readPolicies.provider)
                .then(parseResearchSnapshotResponse)
                .then(next => setLoaded(current => ({ ...current, [peer]: next })))
                .catch(() => { if (!signal.aborted) setLoaded(current => ({ ...current, [peer]: 'error' })); });
        }
        return () => window.clearTimeout(timer);
    }, [missing, market]);
    function add(raw: string) {
        const next = raw.trim().toUpperCase();
        if (!tickerPattern.test(next)) { setInputError('Enter a ticker such as MSFT.'); return; }
        if (next === symbol || peers.includes(next)) { setInputError(`${next} is already in the comparison.`); return; }
        if (peers.length >= maximumPeers) { setInputError(`Up to ${maximumPeers} peers. Remove one first.`); return; }
        setPeers([...peers, next]); setInput(''); setInputError('');
    }
    function remove(peer: string) {
        setPeers(peers.filter(item => item !== peer));
        // A failed peer is retried if it is added again.
        if (loaded[peer] === 'error') setLoaded(current => { const next = { ...current }; delete next[peer]; return next; });
    }
    const peerSnapshots = peers.flatMap(peer => { const item = loaded[peer]; return item && item !== 'loading' && item !== 'error' ? [item] : []; });
    const benchmark = snapshot ? buildPeerBenchmark(snapshot, peerSnapshots) : null;
    const columns = peerSnapshots.map(peer => ({ symbol: peer.symbol, metrics: buildPeerBenchmark(peer, []).metrics, trend: buildComparisonMetrics(peer) }));
    const subjectTrend = snapshot ? buildComparisonMetrics(snapshot) : null;
    const hasFundamentals = !!benchmark?.metrics.some((metric, index) => metric.subjectValue !== null || columns.some(column => column.metrics[index]?.subjectValue != null));
    const failed = peers.filter(peer => loaded[peer] === 'error');
    const loading = peers.some(peer => loaded[peer] === 'loading' || !loaded[peer]);
    return <section className={styles.module} aria-labelledby="peers-title" data-testid="research-peers">
        <div className={styles.heading}><div><span className={styles.eyebrow}>Relative evidence</span><h2 id="peers-title">{symbol} versus peers</h2></div><span className={styles.tag}>{peers.length}/{maximumPeers} peers</span></div>
        <p className={styles.meta}>Pick up to {maximumPeers} {market} companies to compare. Suggestions come from your saved securities. Reporting periods and currencies can differ; peers never change your saved decision.</p>
        <div className={styles.chips} aria-label="Selected peers">
            {peers.map(peer => <span key={peer} className={styles.chip} data-state={loaded[peer] === 'error' ? 'error' : 'selected'}><b>{peer}</b>{loaded[peer] === 'error' && <small>unavailable</small>}<button aria-label={`Remove ${peer}`} onClick={() => remove(peer)}>×</button></span>)}
            {suggestions.filter(item => !peers.includes(item)).slice(0, 8).map(item => <button key={item} className={styles.suggestion} disabled={peers.length >= maximumPeers} onClick={() => add(item)}>+ {item}</button>)}
        </div>
        <form className={styles.addRow} onSubmit={event => { event.preventDefault(); add(input); }}>
            <label>Add a ticker<input value={input} onChange={event => { setInput(event.target.value); setInputError(''); }} placeholder={market === 'US' ? 'MSFT' : '1155'} maxLength={15} autoCapitalize="characters" /></label>
            <button className={styles.secondary} disabled={!input.trim() || peers.length >= maximumPeers}>Add peer</button>
            {inputError && <p role="alert">{inputError}</p>}
        </form>
        {!snapshot ? <p role="status">Loading {symbol} data…</p>
            : peers.length === 0 ? <p className={styles.empty}>Add a peer to compare growth, margins, balance sheet, valuation and trend.</p>
                : <>
                    {loading && <p role="status" className={styles.meta}>Loading peer data…</p>}
                    {failed.length > 0 && <p role="status" className={styles.meta}>No data for {failed.join(', ')}. Check the ticker and market.</p>}
                    <div className={styles.tableScroll}><table className={styles.table}>
                        <thead><tr><th scope="col">Metric</th><th scope="col">{symbol}</th><th scope="col">Peer median</th><th scope="col" title="Share of peers the company is at least as favourable as">Rank vs peers</th>{columns.map(column => <th scope="col" key={column.symbol}><button className={styles.link} onClick={() => onOpen(column.symbol, market)}>{column.symbol}</button></th>)}</tr></thead>
                        <tbody>
                            {!hasFundamentals && <tr><td colSpan={4 + columns.length} className={styles.note}>No growth, margin, balance-sheet or valuation figures were returned for {symbol} or its peers{loading ? ' yet' : ''}. Price and trend still compare below.</td></tr>}
                            {hasFundamentals && benchmark?.metrics.map((metric, index) => <tr key={metric.key}>
                                <th scope="row">{metric.label}<small>{metric.higherIsBetter ? 'higher is better' : 'lower is better'}</small></th>
                                <td className={styles.subject}>{value(metric.subjectValue, metric.suffix)}</td>
                                <td>{value(metric.peerMedian, metric.suffix)}</td>
                                <td>{metric.percentile === null ? '—' : <span className={styles.rank} data-tone={metric.percentile >= 67 ? 'good' : metric.percentile <= 33 ? 'weak' : 'mid'}>{metric.percentile}%</span>}</td>
                                {columns.map(column => <td key={column.symbol}>{value(column.metrics[index]?.subjectValue ?? null, metric.suffix)}</td>)}
                            </tr>)}
                            <tr className={styles.group}><th scope="rowgroup" colSpan={4 + columns.length}>Price and trend</th></tr>
                            {subjectTrend && trendRows.map(([key, label]) => <tr key={key}><th scope="row">{label}</th><td className={styles.subject}>{subjectTrend[key]}</td><td>—</td><td>—</td>{columns.map(column => <td key={column.symbol}>{column.trend[key]}</td>)}</tr>)}
                        </tbody>
                    </table></div>
                    <p className={styles.meta}>Rank vs peers is the share of loaded peers {symbol} matches or beats on that metric. Coverage varies; “—” means the provider returned no value.</p>
                </>}
    </section>;
}
