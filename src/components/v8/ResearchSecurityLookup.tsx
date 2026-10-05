'use client';

import { useEffect, useRef, useState } from 'react';
import type { ResearchMarket } from '@/lib/types/research';
import { parseSecuritySearchResponse, validSecurityQuery, type SecuritySearchResult } from '@/lib/research/security-search';
import base from './market-v8.module.css';
import styles from './research-v8.module.css';
import connected from './research-v8-connected.module.css';

type SearchState = { status: 'idle' | 'loading' | 'success' | 'error'; results: SecuritySearchResult[]; error?: string };

export function ResearchSecurityLookup({ initialMarket, onSelect }: {
    initialMarket: ResearchMarket;
    onSelect: (symbol: string, market: ResearchMarket) => void;
}) {
    const [query, setQuery] = useState('');
    const [market, setMarket] = useState(initialMarket);
    const [state, setState] = useState<SearchState>({ status: 'idle', results: [] });
    const request = useRef<AbortController | null>(null);
    const version = useRef(0);
    const input = useRef<HTMLInputElement>(null);
    useEffect(() => () => { version.current += 1; request.current?.abort(); }, []);
    function reset() {
        version.current += 1;
        request.current?.abort();
        setState({ status: 'idle', results: [] });
    }
    function select(symbol: string, selectedMarket: ResearchMarket) {
        reset();
        onSelect(symbol, selectedMarket);
        input.current?.focus();
    }
    async function search() {
        reset();
        if (!validSecurityQuery(query)) {
            setState({ status: 'error', results: [], error: 'Enter a company name or ticker (up to 80 characters).' });
            return;
        }
        const currentVersion = version.current;
        const controller = new AbortController();
        request.current = controller;
        setState({ status: 'loading', results: [] });
        const timeout = setTimeout(() => controller.abort(), 12_000);
        try {
            const params = new URLSearchParams({ q: query.trim(), market });
            const response = await fetch(`/api/research/search?${params}`, { signal: controller.signal, cache: 'no-store' });
            if (!response.ok) throw new Error('Search unavailable');
            const results = parseSecuritySearchResponse(await response.json(), market);
            if (version.current !== currentVersion || controller.signal.aborted) return;
            setState({ status: 'success', results });
        } catch {
            if (version.current !== currentVersion) return;
            setState({ status: 'error', results: [], error: 'Security search is unavailable. Retry, or read a known ticker directly.' });
        } finally { clearTimeout(timeout); }
    }
    const ticker = query.trim().toUpperCase();
    const direct = /^[A-Z0-9.-]{1,15}$/.test(ticker);
    return <section aria-label="Find a security" className={connected.lookup}>
        <form className={`${styles.toolbar} ${connected.toolbar}`} aria-label="Security lookup" onSubmit={event => { event.preventDefault(); void search(); }}>
            <label className={styles.search}><span>Company or ticker</span><span className={styles.searchField}><input ref={input} type="search" maxLength={80} placeholder="Apple, Tenaga, AAPL, 5347…" value={query} onChange={event => { reset(); setQuery(event.target.value); }} /></span></label>
            <label className={styles.stateControl}>Lookup market<select aria-label="Lookup market" value={market} onChange={event => { reset(); setMarket(event.target.value as ResearchMarket); }}><option value="US">US</option><option value="MY">Malaysia</option></select></label>
            <button className={base.primaryButton} type="submit" disabled={state.status === 'loading'}>{state.status === 'loading' ? 'Searching…' : 'Find security'}</button>
            {direct && <button className={base.textButton} type="button" onClick={() => select(ticker, market)}>Read ticker directly</button>}
        </form>
        <div role="status" aria-live="polite">
            {state.status === 'loading' && <p>Searching {market === 'MY' ? 'Malaysia' : 'US'} securities…</p>}
            {state.status === 'success' && <p>{state.results.length ? `${state.results.length} matches from Yahoo Finance. Choose the correct listing.` : 'No supported listings found in this market. Try another name or market, or read a known ticker directly.'}</p>}
        </div>
        {state.status === 'error' && <p role="alert" className={connected.warning}>{state.error}</p>}
        {!!state.results.length && <div className={connected.lookupResults}>
            <h2 className={connected.lookupHeading}>Search results</h2>
            <ul aria-label="Security search results">{state.results.map(item => <li key={`${item.market}:${item.symbol}`}><button onClick={() => select(item.symbol, item.market)}>
                <strong>{item.name}</strong><span>{item.symbol} · {item.market} · {item.exchange} · {item.instrumentType === 'ETF' ? 'ETF' : 'Equity'}</span>
            </button></li>)}</ul>
        </div>}
    </section>;
}
