'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { parseResearchSnapshotResponse } from '@/lib/research/snapshot-input';
import { readData, readPolicies } from './read-data';
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
    const [tab, setTab] = useState<ResearchTab>('Overview');
    const [chartRange, setChartRange] = useState('3M');
    const [reload, setReload] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const lastRead = useRef(0);
    const [panel, setPanel] = useState<'saved' | 'tools' | null>(null);
    const panelRef = useRef<HTMLDialogElement>(null);
    const panelTrigger = useRef<HTMLButtonElement | null>(null);
    useEffect(() => {
        if (!panel) return;
        panelRef.current?.showModal();
        if (panel === 'saved') panelRef.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = overflow; };
    }, [panel]);
    function openPanel(value: 'saved' | 'tools', trigger: HTMLButtonElement) {
        panelTrigger.current = trigger;
        setPanel(value);
    }
    function chooseSecurity(symbol: string) {
        navigate(symbol);
        panelRef.current?.close();
    }
    function navigate(symbol: string, nextTab = tab, push = true) {
        const url = new URL(window.location.href);
        url.searchParams.set('ticker', symbol);
        url.searchParams.set('tab', nextTab.toLowerCase());
        if (url.href !== window.location.href) window.history[push ? 'pushState' : 'replaceState'](null, '', url);
        setSelected(symbol); setTab(nextTab);
    }
    useEffect(() => {
        const restore = () => {
            const params = new URLSearchParams(window.location.search);
            setSelected(params.get('ticker') ?? '');
            setTab(researchTabs.find(value => value.toLowerCase() === params.get('tab')?.toLowerCase()) ?? 'Overview');
        };
        restore(); window.addEventListener('popstate', restore);
        const revalidate = () => {
            if (document.visibilityState === 'hidden' || Date.now() - lastRead.current < 5000) return;
            lastRead.current = Date.now(); setLoading(true); setError(false); setReload(value => value + 1);
        };
        window.addEventListener('focus', revalidate);
        document.addEventListener('visibilitychange', revalidate);
        return () => { window.removeEventListener('popstate', restore); window.removeEventListener('focus', revalidate); document.removeEventListener('visibilitychange', revalidate); };
    }, []);
    const [query, setQuery] = useState('');
    const [market, setMarket] = useState('All');
    useEffect(() => {
        lastRead.current = Date.now();
        const controller = new AbortController();
        let active = true;
        readData('/api/research/watchlist', controller.signal, readPolicies.watchlist)
            .then(parseWatchlist)
            .then(next => { if (active) {
                setRecords(next);
                const url = new URL(window.location.href);
                if (!url.searchParams.get('ticker') && next[0]) {
                    url.searchParams.set('ticker', next[0].symbol);
                    window.history.replaceState(null, '', url);
                    setSelected(next[0].symbol);
                }
            } })
            .catch(() => { if (active) setError(true); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; controller.abort(); };
    }, [reload]);
    const matches = (records ?? []).filter(record => (market === 'All' || record.market === market) && `${record.symbol} ${record.companyName}`.toLowerCase().includes(query.trim().toLowerCase()));
    const record = records?.find(item => item.symbol === selected);
    const selectedIndex = matches.findIndex(item => item.symbol === selected);
    return <div className={`${base.app} ${styles.app} ${connected.app}`}>
        <a className={base.skip} href="#v8-content">Skip to content</a>
        <header className={base.header}><a className={base.logo} href="/main-v8">∿ Signal<span>V8</span></a><nav aria-label="Primary"><a href="/main-v8">Market</a><a href="/research-v8" aria-current="page">Research</a></nav><span className={base.headerNote}>Connected to Signal</span></header>
        <main id="v8-content" tabIndex={-1} className={base.canvas}>
            <section className={connected.selectedHeader} aria-label="Selected research security">
                <div>{record ? <><span>{record.market} · {record.symbol}</span><h1>{record.companyName || record.symbol}</h1></> : <h1>Research</h1>}</div>
                <div className={connected.headerActions}>
                    <button className={connected.actionButton} aria-haspopup="dialog" aria-expanded={panel === 'saved'} onClick={event => openPanel('saved', event.currentTarget)}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 4h14v17l-7-4-7 4Z" /></svg>Saved securities · {records?.length ?? '…'}<span aria-hidden="true">⌄</span></button>
                    <button className={connected.actionButton} aria-haspopup="dialog" aria-expanded={panel === 'tools'} disabled={!record} onClick={event => openPanel('tools', event.currentTarget)}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 8h16v12H4zM9 8V4h6v4M4 13h16M10 13v3h4v-3" /></svg>Tools<span aria-hidden="true">⌄</span></button>
                    {record && <a className={base.textButton} href={researchHref(record.symbol, 'review')} target="_blank" rel="noopener noreferrer">Edit research ↗</a>}
                </div>
            </section>
            <div role="status">{loading && <p>Refreshing saved research…</p>}{error && <p className={connected.warning}>Saved research could not be refreshed. {records ? 'The previously loaded records remain visible.' : 'No example records have been substituted.'} Retry with Reload saved research.</p>}</div>
            <dialog ref={panelRef} className={connected.utilityPanel} aria-labelledby="research-utility-title" onClose={() => { setPanel(null); panelTrigger.current?.focus(); }} onKeyDownCapture={event => { if (event.key === 'Escape') { event.preventDefault(); event.currentTarget.close(); } }} onClick={event => {
                const bounds = event.currentTarget.getBoundingClientRect();
                if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) event.currentTarget.close();
            }}>
                <div className={connected.utilityHeading}><h2 id="research-utility-title">{panel === 'tools' ? 'Research tools' : 'Saved securities'}</h2><button className={base.textButton} onClick={() => panelRef.current?.close()} aria-label="Close research panel">Close ×</button></div>
                {panel === 'saved' && <div className={connected.savedSelector}>
            <div role="status">{loading && <p>Refreshing saved research…</p>}{error && <p className={connected.warning}>Saved research could not be refreshed. Use Reload saved research to retry.</p>}{records?.length === 0 && <p>No active securities are saved. <a href="/research?workspace=research">Open watchlist ↗</a></p>}</div>
            <div className={`${styles.toolbar} ${connected.toolbar}`}><label className={styles.search}><span>Find a saved security</span><span className={styles.searchField}><input type="search" placeholder="Apple, MSFT, Maybank…" value={query} onChange={event => setQuery(event.target.value)} /></span></label><label className={styles.stateControl}>Market<select value={market} onChange={event => setMarket(event.target.value)}><option>All</option><option>US</option><option>MY</option></select></label><button className={base.textButton} disabled={loading} onClick={() => { setLoading(true); setError(false); setReload(value => value + 1); }}>Reload saved research</button></div>
            <p className={styles.fixtureNotice}>Your existing saved watchlist · provider data loads for the selected security. Editing opens the existing research workspace.</p>
            {records && records.length > 0 && <section className={styles.companySection} aria-label="Saved watchlist"><div className={styles.sectionLabel}><span>Your watchlist <b>{matches.length} of {records.length}</b></span><a className={base.textButton} href="/research?workspace=research">Manage watchlist ↗</a></div><div className={`${styles.companyList} ${connected.watchlist}`}>{matches.map(item => <button className={styles.companyButton} key={item.symbol} aria-pressed={selected === item.symbol} onClick={() => chooseSecurity(item.symbol)}><span className={styles.monogram} aria-hidden="true">{item.symbol[0]}</span><span><b>{item.symbol}</b><small>{item.companyName || item.symbol}</small><small>{item.market} · {item.positionState} · {item.status}</small></span><span className={styles.companyArrow} aria-hidden="true">↗</span></button>)}</div>{!matches.length && <p className={styles.searchEmpty}>No saved securities match these filters. <button className={base.textButton} onClick={() => { setQuery(''); setMarket('All'); }}>Clear filters</button></p>}{record && !matches.includes(record) && <p className={styles.searchHint}>{record.symbol} remains open below and is outside the current filter.</p>}</section>}
            {!!matches.length && <div className={connected.mobilePicker}><label>Selected saved security<select value={selected} onChange={event => chooseSecurity(event.target.value)}>{selectedIndex < 0 && <option value={selected}>{selected} · outside filter</option>}{matches.map(item => <option key={item.symbol} value={item.symbol}>{item.symbol} · {item.companyName}</option>)}</select></label><div><button disabled={selectedIndex <= 0} onClick={() => chooseSecurity(matches[selectedIndex - 1].symbol)}>← Previous</button><span>{selectedIndex < 0 ? '—' : selectedIndex + 1} / {matches.length}</span><button disabled={selectedIndex >= matches.length - 1} onClick={() => chooseSecurity(matches[selectedIndex + 1].symbol)}>Next →</button></div></div>}
                </div>}
                {panel === 'tools' && record && <div className={connected.tools}><p>Open a workspace for {record.symbol} in a new tab.</p><div>{researchWorkspaceGroups.map(group => <section key={group.id}><h3>{group.label}</h3>{group.items.map(item => <a key={item.id} href={researchHref(record.symbol, item.id)} target="_blank" rel="noopener noreferrer">{item.label} ↗</a>)}</section>)}</div></div>}
            </dialog>
            {records && records.length === 0 && <section className={styles.emptyWorkspace}><h1>Your research starts here.</h1><p>No active securities are saved. Add a stock or fund using the existing watchlist.</p><a className={base.primaryButton} href="/research?workspace=research">Open watchlist →</a></section>}
            {records && selected && !record && <p role="alert">No saved research found for {selected}. Choose a security using Saved securities.</p>}
            {record && <ConnectedCase key={`${record.market}:${record.symbol}`} record={record} tab={tab} setTab={value => navigate(record.symbol, value, false)} chartRange={chartRange} setChartRange={setChartRange} />}
            <footer className={styles.footer}><span>Connected Research V8 · existing Signal records</span><details><summary>Data scope & limitations</summary><p>Saved research is user-authored. Quotes, history and fundamentals come from the existing research service; unavailable values stay unavailable. Retrieval time is not an exchange quote timestamp. Editing, monitoring evaluation and advanced tools open the existing workspace; V8 does not write research records. Saved research refreshes when you return from editing; you can also reload it manually.</p><a href="/research-v8?demo=1">Open the labelled representative demo →</a></details></footer>
        </main>
    </div>;
}

function ConnectedCase({ record, tab, setTab, chartRange, setChartRange }: { record: ResearchRecord; tab: ResearchTab; setTab: (tab: ResearchTab) => void; chartRange: string; setChartRange: (range: string) => void }) {
    const [chartDate, setChartDate] = useState<string | null>(null);
    const [snapshot, setSnapshot] = useState<ResearchSnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [refresh, setRefresh] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        readData(`/api/research/symbol/${encodeURIComponent(record.symbol)}?market=${record.market}`, controller.signal, readPolicies.provider)
            .then(parseResearchSnapshotResponse)
            .then(next => { if (next.symbol !== record.symbol || next.market !== record.market) throw new Error('Security mismatch'); if (active) setSnapshot(next); })
            .catch(() => { if (active) setError(true); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; controller.abort(); };
    }, [record.symbol, record.market, refresh]);
    const readiness = buildResearchReadiness({ record, sector: '', policyAssessment: null });
    const [allChecks, setAllChecks] = useState(false);
    const remaining = readiness.items.filter(item => item.tone !== 'ready' && item.label !== readiness.nextGap.label);
    const visibleChecks = allChecks ? [...readiness.items].sort((a, b) => Number(a.tone === 'ready') - Number(b.tone === 'ready')) : remaining.slice(0, 2);
    function tabKeys(event: KeyboardEvent<HTMLDivElement>) {
        const index = researchTabs.indexOf(tab);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? researchTabs.length - 1 : event.key === 'ArrowRight' ? (index + 1) % researchTabs.length : event.key === 'ArrowLeft' ? (index + researchTabs.length - 1) % researchTabs.length : null;
        if (next === null) return;
        event.preventDefault(); setTab(researchTabs[next]); document.getElementById(`connected-tab-${researchTabs[next]}`)?.focus();
    }
    return <>
        <div className={styles.workspace}>
            <article className={styles.case} aria-label={`${record.symbol} research`}>
                <section className={`${styles.reading} ${connected.summary}`} aria-label="Research status"><div className={styles.decision}><small>Saved decision</small><strong>{record.decisionJournal.decision}</strong><span>User-authored · {date(record.lastReviewedAt)}</span><span>Watchlist status: {record.status}</span></div><div><small>Latest returned price</small><b data-testid="research-price">{loading && !snapshot ? 'Loading…' : money(snapshot?.quote.price, snapshot?.quote.currency)}</b><span>Daily change {number(snapshot?.quote.dailyChangePercent, '%')}</span></div><div><small>Saved valuation</small><b>{record.valuationState}</b><span>Thesis confidence: {record.thesisStrength}</span></div></section>
                <section className={connected.dataStatus} aria-label="Provider data status"><div role="status">{loading ? snapshot ? `Refreshing… Retrieved ${retrievedAt(snapshot.fetchedAt)}. Previous values remain visible.` : 'Loading provider data… Your saved research is available below.' : error ? `Provider refresh failed. ${snapshot ? `Previous values retrieved ${retrievedAt(snapshot.fetchedAt)} remain visible.` : 'Your saved research is still available.'}` : `Retrieved ${retrievedAt(snapshot?.fetchedAt)} · ${snapshot?.sources.join(', ') || 'Source not supplied'}`}</div><button className={base.textButton} disabled={loading} onClick={() => { setLoading(true); setError(false); setRefresh(value => value + 1); }}>{error ? 'Retry provider data' : 'Refresh provider data'}</button>{!!snapshot?.warnings.length && <p className={connected.warning}>Provider coverage limited: {snapshot.warnings[0]}</p>}{!!snapshot?.warnings.length && <details className={connected.warning}><summary>Provider limitations ({snapshot.warnings.length})</summary><ul>{snapshot.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}</section>
                <section className={connected.nextAction} aria-label="Next research gap"><div><span className={base.eyebrow}>NEXT RESEARCH ACTION</span><h2>{readiness.nextGap.label}</h2><p>{readiness.nextGap.destination === 'policy' ? 'Requires assessment in the Research workspace. This view cannot assess your policy.' : readiness.nextGap.detail}</p>{readiness.nextGap.label !== 'Thesis and checklist' && <small>Checklist: {Object.values(record.checklist).filter(Boolean).length}/9 marked · user assessment</small>}</div><a className={base.primaryButton} href={researchHref(record.symbol, readiness.nextGap.destination)} target="_blank" rel="noopener noreferrer">{readiness.nextGap.destination === 'policy' ? 'Continue assessment ↗' : 'Continue research ↗'}</a></section>

                <section className={styles.investigation} aria-label="Company investigation"><div className={`${base.tabs} ${styles.tabs}`} role="tablist" aria-label="Research investigation" onKeyDown={tabKeys}>{researchTabs.map(value => <button id={`connected-tab-${value}`} role="tab" aria-selected={tab === value} aria-controls="connected-panel" tabIndex={tab === value ? 0 : -1} key={value} onClick={() => setTab(value)}>{value}</button>)}</div><div id="connected-panel" role="tabpanel" aria-labelledby={`connected-tab-${tab}`} tabIndex={0} className={`${base.panel} ${styles.panel}`}><ResearchConnectedPanel tab={tab} record={record} snapshot={snapshot} loading={loading} chartRange={chartRange} setChartRange={setChartRange} chartDate={chartDate} setChartDate={setChartDate} /></div></section>
            </article>
            <aside className={`${base.rail} ${connected.rail}`} aria-label="Research direction"><span className={base.eyebrow}>RESEARCH CHECKS</span><h2>Also needs attention</h2><p>Based on your saved record, not independent verification.</p>{!allChecks && !remaining.length && <p>No additional saved-state gaps.</p>}{visibleChecks.map(item => <details key={item.id} className={connected.readiness}><summary><b>{item.label}</b><span>{item.id === 'policy' ? 'Assessment required in Research workspace' : item.status}</span></summary><p>{item.id === 'policy' ? 'Policy assessment is available in the Research workspace. No compliance result is inferred here.' : item.detail}</p><a className={base.textButton} href={researchHref(record.symbol, item.destination)} target="_blank" rel="noopener noreferrer">Open {item.label.toLowerCase()} ↗</a></details>)}<button className={base.textButton} aria-expanded={allChecks} onClick={() => setAllChecks(value => !value)}>{allChecks ? 'Show fewer checks' : `View all ${readiness.items.length} checks`}</button><a className={styles.marketLink} href="/main-v8"><small>Market conditions are separate from this company’s research.</small><b>Open Market ↗</b></a></aside>
        </div>
    </>;
}
