'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { parseResearchSnapshotResponse } from '@/lib/research/snapshot-input';
import { readData, readPolicies } from './read-data';
import { buildResearchReadiness } from '@/lib/research/readiness';
import { researchWorkspaceGroups } from '@/lib/research/workspace-navigation';
import { parseResearchRecord } from '@/lib/research/input';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import { ResearchCurrentAssessment } from './ResearchCurrentAssessment';
import { ResearchConnectedPanel } from './ResearchV8ConnectedPanels';
import { date, money, number, parseWatchlist, researchHref, researchTabs, retrievedAt, type ResearchTab } from './research-v8-connected-data';
import base from './market-v8.module.css';
import styles from './research-v8.module.css';
import connected from './research-v8-connected.module.css';

export function ResearchV8Connected({ initialTicker = '', initialMarket }: { initialTicker?: string; initialMarket?: ResearchMarket }) {
    const [records, setRecords] = useState<ResearchRecord[] | null>(null);
    const [selected, setSelected] = useState(initialTicker);
    const [selectedMarket, setSelectedMarket] = useState<ResearchMarket | undefined>(initialMarket);
    const [lookup, setLookup] = useState('');
    const [lookupMarket, setLookupMarket] = useState<ResearchMarket>(initialMarket ?? 'US');
    const [lookupError, setLookupError] = useState('');
    const [tab, setTab] = useState<ResearchTab>('Overview');
    const [advanced, setAdvanced] = useState(false);
    const [chartRange, setChartRange] = useState('3M');
    const [reload, setReload] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const lastRead = useRef(0);
    const savedRevision = useRef(0);
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
        navigate(symbol, tab, true, records?.find(item => item.symbol === symbol)?.market);
        panelRef.current?.close();
    }
    function navigate(symbol: string, nextTab = tab, push = true, nextMarket = selectedMarket) {
        const url = new URL(window.location.href);
        url.searchParams.set('ticker', symbol);
        if (nextMarket) url.searchParams.set('market', nextMarket); else url.searchParams.delete('market');
        url.searchParams.set('tab', nextTab.toLowerCase());
        if (advanced) url.searchParams.set('advanced', '1'); else url.searchParams.delete('advanced');
        if (url.href !== window.location.href) window.history[push ? 'pushState' : 'replaceState'](null, '', url);
        setSelected(symbol); setSelectedMarket(nextMarket); setTab(nextTab);
    }
    useEffect(() => {
        const restore = () => {
            const params = new URLSearchParams(window.location.search);
            setSelected((params.get('ticker') ?? '').trim().toUpperCase());
            setSelectedMarket(params.get('market') === 'MY' ? 'MY' : params.get('market') === 'US' ? 'US' : undefined);
            const restoredTab = researchTabs.find(value => value.toLowerCase() === params.get('tab')?.toLowerCase()) ?? 'Overview';
            setTab(restoredTab);
            setAdvanced(params.get('advanced') === '1' || restoredTab === 'Thesis' || restoredTab === 'Review');
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
    function changeDepth() {
        const next = !advanced;
        const url = new URL(window.location.href);
        if (next) url.searchParams.set('advanced', '1'); else url.searchParams.delete('advanced');
        if (!next && (tab === 'Thesis' || tab === 'Review')) { url.searchParams.set('tab', 'overview'); setTab('Overview'); }
        window.history.pushState(null, '', url);
        setAdvanced(next);
    }
    const [query, setQuery] = useState('');
    const [market, setMarket] = useState('All');
    useEffect(() => {
        lastRead.current = Date.now();
        const controller = new AbortController();
        let active = true;
        const version = savedRevision.current;
        readData('/api/research/watchlist', controller.signal, readPolicies.watchlist)
            .then(parseWatchlist)
            .then(next => { if (active && version === savedRevision.current) {
                setRecords(next);
                const url = new URL(window.location.href);
                if (!url.searchParams.get('ticker') && next[0]) {
                    url.searchParams.set('ticker', next[0].symbol);
                    window.history.replaceState(null, '', url);
                    setSelected(next[0].symbol);
                    setSelectedMarket(next[0].market);
                }
            } })
            .catch(() => { if (active) setError(true); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; controller.abort(); };
    }, [reload]);
    const matches = (records ?? []).filter(record => (market === 'All' || record.market === market) && `${record.symbol} ${record.companyName}`.toLowerCase().includes(query.trim().toLowerCase()));
    const record = records?.find(item => item.symbol === selected && (!selectedMarket || item.market === selectedMarket));
    const readingMarket: ResearchMarket = selectedMarket ?? record?.market ?? (/^[0-9]+(?:\.KL)?$/.test(selected) || ['MAYBANK', 'KLCI'].includes(selected) || selected.endsWith('.KL') ? 'MY' : 'US');
    const validSelection = /^[A-Z0-9.-]{1,15}$/.test(selected);
    const remember = (saved: ResearchRecord) => {
        savedRevision.current += 1;
        setRecords(previous => [...(previous ?? []).filter(item => item.symbol !== saved.symbol), saved]);
    };
    const selectedIndex = matches.findIndex(item => item.symbol === selected);
    return <div className={`${base.app} ${styles.app} ${connected.app}`}>
        <a className={base.skip} href="#v8-content">Skip to content</a>
        <header className={base.header}><a className={base.logo} href="/main-v8">∿ Signal<span>V8</span></a><nav aria-label="Primary"><a href="/main-v8">Market</a><a href="/research-v8" aria-current="page">Research</a></nav><span className={base.headerNote}>Connected to Signal</span></header>
        <main id="v8-content" tabIndex={-1} className={base.canvas}>
            <section className={connected.selectedHeader} aria-label="Selected research security">
                <div>{record ? <><span>{record.market} · {record.symbol}</span><h1>{record.companyName || record.symbol}</h1></> : <><span>{selected ? `${readingMarket} · ${selected}` : 'Current evidence'}</span><h1>{selected || 'Research'}</h1></>}</div>
                <div className={connected.headerActions}>
                    <button className={connected.actionButton} aria-haspopup="dialog" aria-expanded={panel === 'saved'} onClick={event => openPanel('saved', event.currentTarget)}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 4h14v17l-7-4-7 4Z" /></svg>Saved securities · {records?.length ?? '…'}<span aria-hidden="true">⌄</span></button>
                    <button className={connected.actionButton} aria-pressed={advanced} onClick={changeDepth}>{advanced ? 'Back to basic view' : 'Advanced tools'}</button>
                    {advanced && <button className={connected.actionButton} aria-haspopup="dialog" aria-expanded={panel === 'tools'} disabled={!record} onClick={event => openPanel('tools', event.currentTarget)}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 8h16v12H4zM9 8V4h6v4M4 13h16M10 13v3h4v-3" /></svg>Workspaces<span aria-hidden="true">⌄</span></button>}
                </div>
            </section>
            <form className={`${styles.toolbar} ${connected.toolbar}`} aria-label="Security lookup" onSubmit={event => {
                event.preventDefault();
                const symbol = lookup.trim().toUpperCase();
                if (!/^[A-Z0-9.-]{1,15}$/.test(symbol)) { setLookupError('Enter a ticker using letters, numbers, dots or hyphens (up to 15 characters).'); return; }
                setLookupError(''); navigate(symbol, 'Overview', true, lookupMarket);
            }}>
                <label className={styles.search}><span>Security ticker</span><span className={styles.searchField}><input type="search" placeholder="AAPL, 5347, MAYBANK…" value={lookup} onChange={event => setLookup(event.target.value)} /></span></label>
                <label className={styles.stateControl}>Lookup market<select aria-label="Lookup market" value={lookupMarket} onChange={event => setLookupMarket(event.target.value as ResearchMarket)}><option value="US">US</option><option value="MY">Malaysia</option></select></label>
                <button className={base.primaryButton} type="submit">Read security</button>
            </form>
            {lookupError && <p role="alert">{lookupError}</p>}
            <div role="status">{loading && <p>Refreshing saved research…</p>}{error && <p className={connected.warning}>Saved research could not be refreshed. {records ? 'The previously loaded records remain visible.' : 'No example records have been substituted.'} Retry with Reload saved research.</p>}</div>
            <dialog ref={panelRef} className={connected.utilityPanel} aria-labelledby="research-utility-title" onClose={() => { setPanel(null); panelTrigger.current?.focus(); }} onKeyDownCapture={event => { if (event.key === 'Escape') { event.preventDefault(); event.currentTarget.close(); } }} onClick={event => {
                const bounds = event.currentTarget.getBoundingClientRect();
                if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) event.currentTarget.close();
            }}>
                <div className={connected.utilityHeading}><h2 id="research-utility-title">{panel === 'tools' ? 'Research tools' : 'Saved securities'}</h2><button className={base.textButton} onClick={() => panelRef.current?.close()} aria-label="Close research panel">Close ×</button></div>
                {panel === 'saved' && <div className={connected.savedSelector}>
            <div role="status">{loading && <p>Refreshing saved research…</p>}{error && <p className={connected.warning}>Saved research could not be refreshed. Use Reload saved research to retry.</p>}{records?.length === 0 && <p>No active securities are saved. <a href="/research?workspace=research">Open watchlist ↗</a></p>}</div>
            <div className={`${styles.toolbar} ${connected.toolbar}`}><label className={styles.search}><span>Find a saved security</span><span className={styles.searchField}><input type="search" placeholder="Apple, MSFT, Maybank…" value={query} onChange={event => setQuery(event.target.value)} /></span></label><label className={styles.stateControl}>Market<select value={market} onChange={event => setMarket(event.target.value)}><option>All</option><option>US</option><option>MY</option></select></label><button className={base.textButton} disabled={loading} onClick={() => { setLoading(true); setError(false); setReload(value => value + 1); }}>Reload saved research</button></div>
            <p className={styles.fixtureNotice}>Choose a saved security to read its current data. No research form is required.</p>
            {records && records.length > 0 && <section className={styles.companySection} aria-label="Saved watchlist"><div className={styles.sectionLabel}><span>Your watchlist <b>{matches.length} of {records.length}</b></span><a className={base.textButton} href="/research?workspace=research">Manage watchlist ↗</a></div><div className={`${styles.companyList} ${connected.watchlist}`}>{matches.map(item => <button className={styles.companyButton} key={item.symbol} aria-pressed={selected === item.symbol} onClick={() => chooseSecurity(item.symbol)}><span className={styles.monogram} aria-hidden="true">{item.symbol[0]}</span><span><b>{item.symbol}</b><small>{item.companyName || item.symbol}</small><small>{item.market}{advanced ? ` · ${item.positionState} · ${item.status}` : ''}</small></span><span className={styles.companyArrow} aria-hidden="true">↗</span></button>)}</div>{!matches.length && <p className={styles.searchEmpty}>No saved securities match these filters. <button className={base.textButton} onClick={() => { setQuery(''); setMarket('All'); }}>Clear filters</button></p>}{record && !matches.includes(record) && <p className={styles.searchHint}>{record.symbol} remains open below and is outside the current filter.</p>}</section>}
            {!!matches.length && <div className={connected.mobilePicker}><label>Selected saved security<select value={selected} onChange={event => chooseSecurity(event.target.value)}>{selectedIndex < 0 && <option value={selected}>{selected} · outside filter</option>}{matches.map(item => <option key={item.symbol} value={item.symbol}>{item.symbol} · {item.companyName}</option>)}</select></label><div><button disabled={selectedIndex <= 0} onClick={() => chooseSecurity(matches[selectedIndex - 1].symbol)}>← Previous</button><span>{selectedIndex < 0 ? '—' : selectedIndex + 1} / {matches.length}</span><button disabled={selectedIndex >= matches.length - 1} onClick={() => chooseSecurity(matches[selectedIndex + 1].symbol)}>Next →</button></div></div>}
                </div>}
                {panel === 'tools' && record && <div className={connected.tools}><p>Open a workspace for {record.symbol} in a new tab.</p><div>{researchWorkspaceGroups.map(group => <section key={group.id}><h3>{group.label}</h3>{group.items.map(item => <a key={item.id} href={researchHref(record.symbol, item.id)} target="_blank" rel="noopener noreferrer">{item.label} ↗</a>)}</section>)}</div></div>}
            </dialog>
            {!selected && <section className={styles.emptyWorkspace}><h2>Read a security without saving it.</h2><p>Enter a ticker and market above, or choose a saved security. Notes and decisions are optional.</p></section>}
            {selected && !validSelection && <p role="alert">Invalid security ticker. Enter a valid ticker above.</p>}
            {validSelection && <ConnectedCase key={`${readingMarket}:${selected}`} symbol={selected} market={readingMarket} record={record} onSaved={remember} advanced={advanced} tab={tab} setTab={value => navigate(selected, value, false, readingMarket)} chartRange={chartRange} setChartRange={setChartRange} />}
            <footer className={styles.footer}><span>Connected Research V8 · existing Signal records</span><details><summary>Data scope & limitations</summary><p>Saved research is user-authored. Quotes, history and fundamentals come from the existing research service; unavailable values stay unavailable. Retrieval time is not an exchange quote timestamp. Editing, monitoring evaluation and advanced tools open the existing workspace. Saving a security requires the explicit Save security action. It does not record an investment decision or personal review. Saved research refreshes when you return from editing; you can also reload it manually.</p><a href="/research-v8?demo=1">Open the labelled representative demo →</a></details></footer>
        </main>
    </div>;
}

function ConnectedCase({ symbol, market, record, onSaved, advanced, tab, setTab, chartRange, setChartRange }: { symbol: string; market: ResearchMarket; record?: ResearchRecord; onSaved: (record: ResearchRecord) => void; advanced: boolean; tab: ResearchTab; setTab: (tab: ResearchTab) => void; chartRange: string; setChartRange: (range: string) => void }) {
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const savePending = useRef(false);
    async function saveSecurity() {
        if (savePending.current || record) return;
        savePending.current = true; setSaving(true); setSaveError('');
        try {
            const response = await fetch('/api/research/watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol, market, companyName: snapshot?.quote.name || symbol, saveOnly: true }) });
            if (!response.ok) throw new Error(response.status === 409 ? 'This ticker is already saved. Reload saved research to check its market.' : 'The security could not be saved. Your reading remains available.');
            const body = await response.json();
            const saved = parseResearchRecord(body.data);
            if (saved.symbol !== symbol || saved.market !== market) throw new Error('Saved security did not match the request.');
            onSaved(saved);
        } catch (error) { setSaveError(error instanceof Error ? error.message : 'Saving failed.'); }
        finally { savePending.current = false; setSaving(false); }
    }
    const [assessmentTime, setAssessmentTime] = useState(() => Date.now());
    const [chartDate, setChartDate] = useState<string | null>(null);
    const [readings, setReadings] = useState<{ current: ResearchSnapshot | null; previous: ResearchSnapshot | null }>({ current: null, previous: null });
    const snapshot = readings.current;
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [refresh, setRefresh] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        readData(`/api/research/symbol/${encodeURIComponent(symbol)}?market=${market}`, controller.signal, readPolicies.provider)
            .then(parseResearchSnapshotResponse)
            .then(next => { if (next.symbol !== symbol || next.market !== market) throw new Error('Security mismatch'); if (active) { setReadings(previous => ({ current: next, previous: previous.current })); setAssessmentTime(Date.now()); } })
            .catch(() => { if (active) setError(true); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; controller.abort(); };
    }, [symbol, market, refresh]);
    const visibleTabs = researchTabs.filter(value => (advanced && record) || (value !== 'Thesis' && value !== 'Review'));
    const readiness = record ? buildResearchReadiness({ record, sector: '', policyAssessment: null }) : null;
    const visibleChecks = [...(readiness?.items ?? [])].sort((a, b) => Number(a.tone === 'ready') - Number(b.tone === 'ready'));
    const activeTab = visibleTabs.includes(tab) ? tab : 'Overview';
    function tabKeys(event: KeyboardEvent<HTMLDivElement>) {
        const index = visibleTabs.indexOf(activeTab);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? visibleTabs.length - 1 : event.key === 'ArrowRight' ? (index + 1) % visibleTabs.length : event.key === 'ArrowLeft' ? (index + visibleTabs.length - 1) % visibleTabs.length : null;
        if (next === null) return;
        event.preventDefault(); setTab(visibleTabs[next]); document.getElementById(`connected-tab-${visibleTabs[next]}`)?.focus();
    }
    return <>
        <div className={connected.dataStatus}><span>{record ? 'Saved security' : 'Reading without a saved record'} · {snapshot?.quote.name || symbol}</span>{!record && <button className={base.textButton} disabled={saving || !snapshot} onClick={saveSecurity}>{saving ? 'Saving…' : 'Save security'}</button>}</div>
        {saveError && <p role="alert">{saveError}</p>}
        <div className={`${styles.workspace} ${connected.focusedWorkspace}`}>
            <article className={styles.case} aria-label={`${symbol} research`}>
                <section className={`${styles.reading} ${connected.summary} ${!advanced ? connected.basicSummary : ''}`} aria-label="Research status"><div><small>Latest returned price</small><strong data-testid="research-price">{loading && !snapshot ? 'Loading…' : money(snapshot?.quote.price, snapshot?.quote.currency)}</strong><span>Quote observed: {snapshot?.quote.observedAt ? retrievedAt(snapshot.quote.observedAt) : 'Observation time unavailable'}</span><span>Daily change {number(snapshot?.quote.dailyChangePercent, '%')}</span></div><div><small>Financial reporting period</small><b>{date(snapshot?.fundamentals.reportingPeriod)}</b><span>{snapshot?.fundamentals.source || 'Financial source unavailable'}</span></div>{advanced && record && <div><small>Your saved decision · separate from current data</small><b>{record.decisionJournal.decision}</b><span>{record.decisionJournal.decision === 'Not recorded' ? 'Saved for later · no personal review' : `User-authored · ${date(record.lastReviewedAt)}`}</span><span>Saved valuation: {record.valuationState} · thesis: {record.thesisStrength}</span></div>}</section>
                <ResearchCurrentAssessment snapshot={snapshot} previous={readings.previous} loading={loading} error={error} now={assessmentTime} />
                <section className={connected.dataStatus} aria-label="Provider data status"><div role="status">{loading ? snapshot ? `Refreshing… Retrieved ${retrievedAt(snapshot.fetchedAt)}. Previous values remain visible.` : 'Loading provider data… You can browse while it loads.' : error ? `Provider refresh failed. ${snapshot ? `Previous values retrieved ${retrievedAt(snapshot.fetchedAt)} remain visible.` : 'No current assessment is available.'}` : `Retrieved ${retrievedAt(snapshot?.fetchedAt)} · ${snapshot?.sources.join(', ') || 'Source not supplied'}`}</div><button className={base.textButton} disabled={loading} onClick={() => { setLoading(true); setError(false); setRefresh(value => value + 1); }}>{error ? 'Retry provider data' : 'Refresh provider data'}</button>{!!snapshot?.warnings.length && <details className={connected.warning}><summary>Some provider data is unavailable. The assessment may be incomplete. <span>View {snapshot.warnings.length} source notice{snapshot.warnings.length === 1 ? '' : 's'}</span></summary><p>Unavailable inputs are not estimated. Refresh to retry, or inspect these source notices.</p><ul>{snapshot.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}</section>
                {advanced && record && <>
                <section className={connected.nextAction} aria-label="Next research gap"><div><span className={base.eyebrow}>OPTIONAL RESEARCH WORKSPACE</span><h2>Build your own research</h2><p>Write a thesis, record a decision or schedule a review when useful to you.</p></div><a className={base.primaryButton} href={researchHref(symbol, 'review')} target="_blank" rel="noopener noreferrer">Open full research review ↗</a></section>

                <details className={connected.researchChecks}>
                    <summary><b>Optional research tools <span aria-hidden="true">⌄</span></b><span>Thesis, evidence, planning and reminders</span></summary>
                    <p>These tools use your saved research. Unused tools are not missing market evidence and do not require completion.</p>
                    <div className={connected.checkGrid}>{visibleChecks.map(item => <details key={item.id} className={connected.readiness}><summary><b>{item.label}</b><span>{item.id === 'policy' ? 'Assessment required in Research workspace' : item.status}</span></summary><p>{item.id === 'policy' ? 'Policy assessment is available in the Research workspace. No compliance result is inferred here.' : item.detail}</p><a className={base.textButton} href={researchHref(symbol, item.destination)} target="_blank" rel="noopener noreferrer">Open {item.label.toLowerCase()} ↗</a></details>)}</div>
                </details>

                </>}

                <section className={styles.investigation} aria-label="Company investigation"><div className={`${base.tabs} ${styles.tabs}`} role="tablist" aria-label="Research investigation" onKeyDown={tabKeys}>{visibleTabs.map(value => <button id={`connected-tab-${value}`} role="tab" aria-selected={activeTab === value} aria-controls="connected-panel" tabIndex={activeTab === value ? 0 : -1} key={value} onClick={() => setTab(value)}>{value}</button>)}</div><div id="connected-panel" role="tabpanel" aria-labelledby={`connected-tab-${activeTab}`} tabIndex={0} className={`${base.panel} ${styles.panel}`}><ResearchConnectedPanel advanced={advanced} tab={activeTab} record={record} market={market} snapshot={snapshot} loading={loading} chartRange={chartRange} setChartRange={setChartRange} chartDate={chartDate} setChartDate={setChartDate} /></div></section>
            </article>

        </div>
    </>;
}
