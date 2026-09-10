'use client';

import { useEffect, useState, type KeyboardEvent } from 'react';
import { parseResearchSnapshotResponse } from '@/lib/research/snapshot-input';
import { buildResearchReadiness } from '@/lib/research/readiness';
import { researchWorkspaceGroups } from '@/lib/research/workspace-navigation';
import type { ResearchRecord } from '@/lib/types/research';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import { ResearchConnectedPanel } from './ResearchV8ConnectedPanels';
import { date, money, number, parseWatchlist, researchHref, researchTabs, retrievedAt, type ResearchTab } from './research-v8-connected-data';
import base from './market-v8.module.css';
import styles from './research-v8.module.css';
import connected from './research-v8-connected.module.css';

export function ResearchV8Connected({ initialTicker = '' }: { initialTicker?: string }) {
    const [records, setRecords] = useState<ResearchRecord[] | null>(null);
    const [selected, setSelected] = useState(initialTicker);
    const [query, setQuery] = useState('');
    const [market, setMarket] = useState('All');
    const [reload, setReload] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        let active = true;
        fetch('/api/research/watchlist', { cache: 'no-store', signal: controller.signal })
            .then(async response => { if (!response.ok) throw new Error('Watchlist unavailable'); return parseWatchlist(await response.json()); })
            .then(next => { if (active) { setRecords(next); setSelected(current => next.some(record => record.symbol === current) ? current : next[0]?.symbol ?? ''); } })
            .catch(() => { if (active) setError(true); })
            .finally(() => { clearTimeout(timeout); if (active) setLoading(false); });
        return () => { active = false; clearTimeout(timeout); controller.abort(); };
    }, [reload]);
    const matches = (records ?? []).filter(record => (market === 'All' || record.market === market) && `${record.symbol} ${record.companyName}`.toLowerCase().includes(query.trim().toLowerCase()));
    const record = records?.find(item => item.symbol === selected);
    const selectedIndex = matches.findIndex(item => item.symbol === selected);
    return <div className={`${base.app} ${styles.app} ${connected.app}`}>
        <a className={base.skip} href="#v8-content">Skip to content</a>
        <header className={base.header}><a className={base.logo} href="/main-v8">∿ Signal<span>V8</span></a><nav aria-label="Primary"><a href="/main-v8">Market</a><a href="/research-v8" aria-current="page">Research</a></nav><span className={base.headerNote}>Connected to Signal</span></header>
        <main id="v8-content" tabIndex={-1} className={base.canvas}>
            <div className={`${styles.toolbar} ${connected.toolbar}`}><label className={styles.search}><span>Find a saved security</span><span className={styles.searchField}><input type="search" placeholder="Apple, MSFT, Maybank…" value={query} onChange={event => setQuery(event.target.value)} /></span></label><label className={styles.stateControl}>Market<select value={market} onChange={event => setMarket(event.target.value)}><option>All</option><option>US</option><option>MY</option></select></label><button className={base.textButton} disabled={loading} onClick={() => { setLoading(true); setError(false); setReload(value => value + 1); }}>Reload saved research</button></div>
            <p className={styles.fixtureNotice}>Your existing saved watchlist · provider data loads for the selected security. Editing opens the existing research workspace.</p>
            <div role="status">{loading && <p>Loading saved research…</p>}{error && <p className={connected.warning}>Saved research could not be refreshed. {records ? 'The previously loaded records remain visible.' : 'No example records have been substituted.'} Retry with Reload saved research.</p>}</div>
            {records && records.length === 0 && <section className={styles.emptyWorkspace}><h1>Your research starts here.</h1><p>No active securities are saved. Add a stock or fund using the existing watchlist.</p><a className={base.primaryButton} href="/research?workspace=research">Open watchlist →</a></section>}
            {records && records.length > 0 && <section className={styles.companySection} aria-label="Saved watchlist"><div className={styles.sectionLabel}><span>Your watchlist <b>{matches.length} of {records.length}</b></span><a className={base.textButton} href="/research?workspace=research">Manage watchlist ↗</a></div><div className={`${styles.companyList} ${connected.watchlist}`}>{matches.map(item => <button className={styles.companyButton} key={item.symbol} aria-pressed={selected === item.symbol} onClick={() => setSelected(item.symbol)}><span className={styles.monogram} aria-hidden="true">{item.symbol[0]}</span><span><b>{item.symbol}</b><small>{item.companyName || item.symbol}</small><small>{item.market} · {item.positionState} · {item.status}</small></span><span className={styles.companyArrow} aria-hidden="true">↗</span></button>)}</div>{!matches.length && <p className={styles.searchEmpty}>No saved securities match these filters. <button className={base.textButton} onClick={() => { setQuery(''); setMarket('All'); }}>Clear filters</button></p>}{record && !matches.includes(record) && <p className={styles.searchHint}>{record.symbol} remains open below and is outside the current filter.</p>}</section>}
            {!!matches.length && <div className={connected.mobilePicker}><label>Selected saved security<select value={selected} onChange={event => setSelected(event.target.value)}>{selectedIndex < 0 && <option value={selected}>{selected} · outside filter</option>}{matches.map(item => <option key={item.symbol} value={item.symbol}>{item.symbol} · {item.companyName}</option>)}</select></label><div><button disabled={selectedIndex <= 0} onClick={() => setSelected(matches[selectedIndex - 1].symbol)}>← Previous</button><span>{selectedIndex < 0 ? '—' : selectedIndex + 1} / {matches.length}</span><button disabled={selectedIndex >= matches.length - 1} onClick={() => setSelected(matches[selectedIndex + 1].symbol)}>Next →</button></div></div>}
            {record && <ConnectedCase key={`${record.market}:${record.symbol}`} record={record} />}
            <footer className={styles.footer}><span>Connected Research V8 · existing Signal records</span><details><summary>Data scope & limitations</summary><p>Saved research is user-authored. Quotes, history and fundamentals come from the existing research service; unavailable values stay unavailable. Retrieval time is not an exchange quote timestamp. Editing, monitoring evaluation and advanced tools open the existing workspace; V8 does not write research records. Reload saved research after editing.</p><a href="/research-v8?demo=1">Open the labelled representative demo →</a></details></footer>
        </main>
    </div>;
}

function ConnectedCase({ record }: { record: ResearchRecord }) {
    const [snapshot, setSnapshot] = useState<ResearchSnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [refresh, setRefresh] = useState(0);
    const [tab, setTab] = useState<ResearchTab>('Overview');
    useEffect(() => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        let active = true;
        fetch(`/api/research/symbol/${encodeURIComponent(record.symbol)}?market=${record.market}`, { cache: 'no-store', signal: controller.signal })
            .then(async response => { if (!response.ok) throw new Error('Market data unavailable'); return parseResearchSnapshotResponse(await response.json()); })
            .then(next => { if (next.symbol !== record.symbol || next.market !== record.market) throw new Error('Security mismatch'); if (active) setSnapshot(next); })
            .catch(() => { if (active) setError(true); })
            .finally(() => { clearTimeout(timeout); if (active) setLoading(false); });
        return () => { active = false; clearTimeout(timeout); controller.abort(); };
    }, [record.symbol, record.market, refresh]);
    const readiness = buildResearchReadiness({ record, sector: '', policyAssessment: null });
    function tabKeys(event: KeyboardEvent<HTMLDivElement>) {
        const index = researchTabs.indexOf(tab);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? researchTabs.length - 1 : event.key === 'ArrowRight' ? (index + 1) % researchTabs.length : event.key === 'ArrowLeft' ? (index + researchTabs.length - 1) % researchTabs.length : null;
        if (next === null) return;
        event.preventDefault(); setTab(researchTabs[next]); document.getElementById(`connected-tab-${researchTabs[next]}`)?.focus();
    }
    return <>
        <details className={connected.tools}><summary>Research tools · existing workspaces</summary><p>These tools open in a new tab with {record.symbol} selected. Changes are saved by the existing workflow.</p><div>{researchWorkspaceGroups.map(group => <section key={group.id}><h3>{group.label}</h3>{group.items.map(item => <a key={item.id} href={researchHref(record.symbol, item.id)} target="_blank" rel="noopener noreferrer">{item.label} ↗</a>)}</section>)}</div></details>
        <div className={styles.workspace}>
            <article className={styles.case} aria-label={`${record.symbol} research`}>
                <div className={base.hero}><div className={base.heroKicker}><span>{record.market} · {record.symbol}</span><span className={base.tag}>Saved research</span></div><h1>{record.companyName || snapshot?.quote.name || record.symbol}</h1><p>Understand the business. Test your thesis. Keep the gaps visible.</p></div>
                <section className={styles.reading} aria-label="Research status"><div className={styles.decision}><small>Saved decision</small><strong>{record.decisionJournal.decision}</strong><span>User-authored · {date(record.lastReviewedAt)}</span></div><div><small>Latest returned price</small><b data-testid="research-price">{loading ? 'Loading…' : money(snapshot?.quote.price, snapshot?.quote.currency)}</b><span>Daily change {number(snapshot?.quote.dailyChangePercent, '%')}</span></div><div><small>Saved valuation</small><b>{record.valuationState}</b><span>Thesis confidence: {record.thesisStrength}</span></div><div><small>Checklist</small><b>{Object.values(record.checklist).filter(Boolean).length}/9 marked</b><span>User assessment, not verification</span></div></section>
                <section className={styles.nextGap} aria-label="Next research gap"><div><span className={base.eyebrow}>NEXT RESEARCH GAP · DERIVED FROM SAVED RECORD</span><h2>{readiness.nextGap.label}</h2><p>{readiness.nextGap.detail}</p></div><a className={base.primaryButton} href={researchHref(record.symbol, readiness.nextGap.destination)} target="_blank" rel="noopener noreferrer">Continue research ↗</a></section>
                <section className={connected.dataStatus} aria-label="Provider data status"><div role="status">{loading ? 'Loading provider data… Your saved research is available below.' : error ? 'Provider data could not be loaded. Your saved research is still available.' : `Retrieved ${retrievedAt(snapshot?.fetchedAt)} · ${snapshot?.sources.join(', ') || 'Source not supplied'}`}</div><button className={base.textButton} disabled={loading} onClick={() => { setLoading(true); setError(false); setSnapshot(null); setRefresh(value => value + 1); }}>{error ? 'Retry provider data' : 'Refresh provider data'}</button>{!!snapshot?.warnings.length && <details className={connected.warning} open><summary>Provider limitations ({snapshot.warnings.length})</summary><ul>{snapshot.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}</section>
                <section className={styles.investigation} aria-label="Company investigation"><div className={`${base.tabs} ${styles.tabs}`} role="tablist" aria-label="Research investigation" onKeyDown={tabKeys}>{researchTabs.map(value => <button id={`connected-tab-${value}`} role="tab" aria-selected={tab === value} aria-controls="connected-panel" tabIndex={tab === value ? 0 : -1} key={value} onClick={() => setTab(value)}>{value}</button>)}</div><div id="connected-panel" role="tabpanel" aria-labelledby={`connected-tab-${tab}`} tabIndex={0} className={`${base.panel} ${styles.panel}`}><ResearchConnectedPanel tab={tab} record={record} snapshot={snapshot} loading={loading} /></div></section>
            </article>
            <aside className={`${base.rail} ${connected.rail}`} aria-label="Research direction"><span className={base.eyebrow}>YOUR RESEARCH RECORD</span><h2>What needs attention?</h2><p>These checks use saved research and the existing readiness rules. They do not verify your thesis or recommend a trade.</p>{readiness.items.map(item => <details key={item.id} className={connected.readiness}><summary><b>{item.label}</b><span>{item.status}</span></summary><p>{item.detail}</p><a className={base.textButton} href={researchHref(record.symbol, item.destination)} target="_blank" rel="noopener noreferrer">Open {item.label.toLowerCase()} ↗</a></details>)}<a className={styles.marketLink} href="/main-v8"><small>Market conditions are separate from this company’s research.</small><b>Open Market ↗</b></a></aside>
        </div>
    </>;
}
