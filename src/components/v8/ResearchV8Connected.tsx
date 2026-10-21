'use client';

import { useEffect, useEffectEvent, useRef, useState, type KeyboardEvent } from 'react';
import { VersionSwitcher } from '@/components/navigation/VersionSwitcher';
import { parseResearchSnapshotResponse } from '@/lib/research/snapshot-input';
import { readData, readFailure, readOwnerAccessIssue, readPolicies } from './read-data';
import { ownerAccessMessage, ownerUnlockHref, type OwnerAccessIssue } from '@/lib/owner-access-client';
import { ResearchSavedState } from './ResearchSavedState';
import { buildResearchReadiness } from '@/lib/research/readiness';
import { personalReviewDate } from '@/lib/research/review-lifecycle';
import { researchWorkspaceGroups } from '@/lib/research/workspace-navigation';
import { parseResearchRecord } from '@/lib/research/input';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import { researchIdentityName, type ProviderResearchIdentity } from '@/lib/research/reading-display';
import { ResearchSecurityLookup } from './ResearchSecurityLookup';
import { ResearchCurrentAssessment } from './ResearchCurrentAssessment';
import { assessCurrentResearch } from '@/lib/research/current-assessment';
import { ResearchConnectedPanel } from './ResearchV8ConnectedPanels';
import { ResearchPriceContext } from './ResearchPriceContext';
import { date, money, number, parseWatchlist, researchHref, researchTabs, retrievedAt, type ResearchTab } from './research-v8-connected-data';
import base from './market-v8.module.css';
import styles from './research-v8.module.css';
import connected from './research-v8-connected.module.css';

export function ResearchV8Connected({ initialTicker = '', initialMarket }: { initialTicker?: string; initialMarket?: ResearchMarket }) {
    const [providerIdentity, setProviderIdentity] = useState<ProviderResearchIdentity | null>(null);
    const [records, setRecords] = useState<ResearchRecord[] | null>(null);
    const [selected, setSelected] = useState(initialTicker);
    const [selectedMarket, setSelectedMarket] = useState<ResearchMarket | undefined>(initialMarket);
    const [tab, setTab] = useState<ResearchTab>('Overview');
    const [advanced, setAdvanced] = useState(false);
    const [chartRange, setChartRange] = useState('3M');
    const [returnPath, setReturnPath] = useState('/research-v8');
    const [reload, setReload] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [accessIssue, setAccessIssue] = useState<OwnerAccessIssue | null>(null);
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
    function navigate(symbol: string, nextTab = tab, push = true, nextMarket = selectedMarket, nextAdvanced = advanced) {
        const url = new URL(window.location.href);
        url.searchParams.set('ticker', symbol);
        if (nextMarket) url.searchParams.set('market', nextMarket); else url.searchParams.delete('market');
        url.searchParams.set('tab', nextTab.toLowerCase());
        if (nextAdvanced) url.searchParams.set('advanced', '1'); else url.searchParams.delete('advanced');
        if (url.href !== window.location.href) window.history[push ? 'pushState' : 'replaceState'](null, '', url);
        setReturnPath(url.pathname + url.search + url.hash);
        setSelected(symbol); setSelectedMarket(nextMarket); setTab(nextTab); setAdvanced(nextAdvanced);
    }
    const restoreUrlState = useEffectEvent(() => {
            const url = new URL(window.location.href);
            const params = url.searchParams;
            const ticker = (params.get('ticker') ?? '').trim().toUpperCase();
            const explicitMarket = params.get('market') === 'MY' ? 'MY' : params.get('market') === 'US' ? 'US' : undefined;
            const restoredMarket = explicitMarket ?? records?.find(item => item.symbol === ticker)?.market;
            // A legacy Back/Forward entry is normalized while restoring state, so
            // its market survives a later owner-access failure that clears records.
            if (!explicitMarket && restoredMarket) {
                params.set('market', restoredMarket);
                window.history.replaceState(null, '', url);
            }
            setReturnPath(url.pathname + url.search + url.hash);
            setSelected(ticker);
            setSelectedMarket(restoredMarket);
            const restoredTab = researchTabs.find(value => value.toLowerCase() === params.get('tab')?.toLowerCase()) ?? 'Overview';
            setTab(restoredTab);
            setAdvanced(params.get('advanced') === '1' || restoredTab === 'Thesis' || restoredTab === 'Review');
    });
    useEffect(() => {
        const restore = () => restoreUrlState();
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
        setReturnPath(url.pathname + url.search + url.hash);
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
                setAccessIssue(null); setError(false);
                setRecords(next);
                const url = new URL(window.location.href);
                const ticker = url.searchParams.get('ticker')?.trim().toUpperCase();
                const linkedMarket = url.searchParams.get('market');
                const marketPreference = linkedMarket === 'MY' || linkedMarket === 'US' ? linkedMarket : undefined;
                const savedSelection = ticker ? next.find(item => item.symbol === ticker) : marketPreference ? next.find(item => item.market === marketPreference) : next[0];
                // Resolve the current URL, not the selection when this read began.
                // An explicit market always wins over a saved record with the same ticker.
                if (ticker && (linkedMarket === 'MY' || linkedMarket === 'US')) {
                    setSelected(ticker);
                    setSelectedMarket(linkedMarket);
                } else if (savedSelection) {
                    url.searchParams.set('ticker', savedSelection.symbol);
                    url.searchParams.set('market', savedSelection.market);
                    window.history.replaceState(null, '', url);
                    setReturnPath(url.pathname + url.search + url.hash);
                    setSelected(savedSelection.symbol);
                    setSelectedMarket(savedSelection.market);
                } else if (!ticker && marketPreference) {
                    // Preserve the requested lookup market even when its saved list is empty.
                    setSelected('');
                    setSelectedMarket(marketPreference);
                }
            } })
            .catch(failure => { if (active && version === savedRevision.current) {
                const issue = readOwnerAccessIssue(failure);
                setError(true); setAccessIssue(issue);
                if (issue) setRecords(null);
            } })
            .finally(() => { if (active && version === savedRevision.current) setLoading(false); });
        return () => { active = false; controller.abort(); };
    }, [reload]);
    const matches = (records ?? []).filter(record => (market === 'All' || record.market === market) && `${record.symbol} ${record.companyName}`.toLowerCase().includes(query.trim().toLowerCase()));
    const record = records?.find(item => item.symbol === selected && (!selectedMarket || item.market === selectedMarket));
    const readingMarket = selectedMarket ?? record?.market ?? (/^[0-9]+(?:\.KL)?$/.test(selected) || ['MAYBANK', 'KLCI'].includes(selected) || selected.endsWith('.KL') ? 'MY' : undefined);
    const validSelection = /^[A-Z0-9.-]{1,15}$/.test(selected);
    const remember = (saved: ResearchRecord) => {
        savedRevision.current += 1;
        setAccessIssue(null); setError(false); setLoading(false);
        setRecords(previous => [...(previous ?? []).filter(item => item.symbol !== saved.symbol), saved]);
    };
    const denySavedAccess = (issue: OwnerAccessIssue) => {
        // A Save response is newer evidence than an earlier watchlist request.
        savedRevision.current += 1;
        setAccessIssue(issue); setError(true); setLoading(false); setRecords(null);
    };
    const selectedIndex = matches.findIndex(item => item.symbol === selected);
    const returnUrl = new URL(returnPath, 'https://signal.invalid');
    if (record && !['US', 'MY'].includes(returnUrl.searchParams.get('market') ?? '')) returnUrl.searchParams.set('market', record.market);
    const unlockHref = ownerUnlockHref(returnUrl.pathname + returnUrl.search + returnUrl.hash);
    const retrySaved = () => { setLoading(true); setError(false); setReload(value => value + 1); };
    const savedState = <ResearchSavedState loading={loading} error={error} issue={accessIssue} hasRecords={records !== null} unlockHref={unlockHref} onRetry={retrySaved} />;
    return <div className={`${base.app} ${styles.app} ${connected.app}`}>
        <a className={base.skip} href="#v8-content">Skip to content</a>
        <header className={base.header}><a className={base.logo} href="/main-v8">∿ Signal<span>V8</span></a><nav aria-label="Primary"><a href={readingMarket ? `/main-v8?market=${readingMarket}` : '/main-v8'}>Market</a><a href="/research-v8" aria-current="page">Research</a></nav></header>
        <main id="v8-content" tabIndex={-1} className={base.canvas}>
            <section className={connected.selectedHeader} aria-label="Selected research security">
                <div data-testid="selected-security-identity" data-symbol={selected} data-market={readingMarket}>
                    <span>{selected ? `${readingMarket ?? 'Market unresolved'} · ${selected}` : 'Current evidence'}</span>
                    <h1>{record?.companyName || researchIdentityName(providerIdentity, selected, readingMarket) || selected || 'Research'}</h1>
                </div>
                <div className={connected.headerActions}>
                    <button className={connected.actionButton} aria-haspopup="dialog" aria-expanded={panel === 'saved'} onClick={event => openPanel('saved', event.currentTarget)}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 4h14v17l-7-4-7 4Z" /></svg>Saved securities · {records?.length ?? (loading ? 'Loading…' : accessIssue === 'locked' ? 'Locked' : 'Unavailable')}<span aria-hidden="true">⌄</span></button>
                    <button className={connected.actionButton} aria-haspopup="dialog" aria-expanded={panel === 'tools'} onClick={event => openPanel('tools', event.currentTarget)}>Saved research<span aria-hidden="true">⌄</span></button>
                </div>
            </section>
            {validSelection ? <details className={connected.lookupDisclosure}><summary>Change security</summary><ResearchSecurityLookup initialMarket={initialMarket ?? 'US'} onSelect={(symbol, market) => navigate(symbol, 'Overview', true, market)} /></details> : <ResearchSecurityLookup initialMarket={initialMarket ?? 'US'} onSelect={(symbol, market) => navigate(symbol, 'Overview', true, market)} />}
            {savedState}
            <dialog ref={panelRef} className={connected.utilityPanel} aria-labelledby="research-utility-title" onClose={() => { setPanel(null); panelTrigger.current?.focus(); }} onKeyDownCapture={event => { if (event.key === 'Escape') { event.preventDefault(); event.currentTarget.close(); } }} onClick={event => {
                const bounds = event.currentTarget.getBoundingClientRect();
                if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) event.currentTarget.close();
            }}>
                <div className={connected.utilityHeading}><h2 id="research-utility-title">{panel === 'tools' ? 'Saved research' : 'Saved securities'}</h2><button className={base.textButton} onClick={() => panelRef.current?.close()} aria-label="Close research panel">Close ×</button></div>
                {panel === 'saved' && <div className={connected.savedSelector}>
            {savedState}{records?.length === 0 && <p>No active securities are saved. <a href="/research?workspace=research">Open watchlist →</a></p>}
            <div className={`${styles.toolbar} ${connected.toolbar}`}><label className={styles.search}><span>Find a saved security</span><span className={styles.searchField}><input type="search" placeholder="Apple, MSFT, Maybank…" value={query} onChange={event => setQuery(event.target.value)} /></span></label><label className={styles.stateControl}>Market<select value={market} onChange={event => setMarket(event.target.value)}><option>All</option><option>US</option><option>MY</option></select></label><button className={base.textButton} disabled={loading} onClick={() => { setLoading(true); setError(false); setReload(value => value + 1); }}>Reload saved research</button></div>
            <p className={styles.fixtureNotice}>Choose a saved security to read its current data. No research form is required.</p>
            {records && records.length > 0 && <section className={styles.companySection} aria-label="Saved watchlist"><div className={styles.sectionLabel}><span>Your watchlist <b>{matches.length} of {records.length}</b></span><a className={base.textButton} href="/research?workspace=research">Manage watchlist ↗</a></div><div className={`${styles.companyList} ${connected.watchlist}`}>{matches.map(item => <button className={styles.companyButton} key={item.symbol} aria-pressed={selected === item.symbol} onClick={() => chooseSecurity(item.symbol)}><span className={styles.monogram} aria-hidden="true">{item.symbol[0]}</span><span><b>{item.symbol}</b><small>{item.companyName || item.symbol}</small><small>{item.market}{advanced ? ` · ${item.positionState} · ${item.status}` : ''}</small></span><span className={styles.companyArrow} aria-hidden="true">↗</span></button>)}</div>{!matches.length && <p className={styles.searchEmpty}>No saved securities match these filters. <button className={base.textButton} onClick={() => { setQuery(''); setMarket('All'); }}>Clear filters</button></p>}{record && !matches.includes(record) && <p className={styles.searchHint}>{record.symbol} remains open below and is outside the current filter.</p>}</section>}
            {!!matches.length && <div className={connected.mobilePicker}><label>Selected saved security<select value={selected} onChange={event => chooseSecurity(event.target.value)}>{selectedIndex < 0 && <option value={selected}>{selected} · outside filter</option>}{matches.map(item => <option key={item.symbol} value={item.symbol}>{item.symbol} · {item.companyName}</option>)}</select></label><div><button disabled={selectedIndex <= 0} onClick={() => chooseSecurity(matches[selectedIndex - 1].symbol)}>← Previous</button><span>{selectedIndex < 0 ? '—' : selectedIndex + 1} / {matches.length}</span><button disabled={selectedIndex >= matches.length - 1} onClick={() => chooseSecurity(matches[selectedIndex + 1].symbol)}>Next →</button></div></div>}
                </div>}
                {panel === 'tools' && <div className={connected.tools}>
                    <p>{record ? `Your saved research for ${record.symbol}. These are your records, not provider conclusions.` : 'No saved record is open. Reading financial and price information does not require saving or writing notes.'}</p>
                    {record && <div className={connected.savedReadingActions}>{(['Thesis', 'Review'] as const).map(destination => <button key={destination} className={connected.actionButton} onClick={() => { navigate(selected, destination, true, readingMarket, true); panelRef.current?.close(); }}>Read saved {destination.toLowerCase()}</button>)}<a className={base.textButton} href={researchHref(record.symbol, 'review', record.market)} target="_blank" rel="noopener noreferrer">Edit saved research (new tab) ↗</a></div>}
                    <button className={connected.actionButton} aria-pressed={advanced} onClick={() => { changeDepth(); panelRef.current?.close(); }}>{advanced ? 'Back to basic view' : 'Advanced tools'}</button>
                    <p>Advanced view exposes additional reading tabs and chart links. It does not change provider data.</p>
                    {record && <details><summary>All research workspaces</summary><p>Open a workspace for {record.symbol} in a new tab.</p><div>{researchWorkspaceGroups.map(group => <section key={group.id}><h3>{group.label}</h3>{group.items.map(item => <a key={item.id} href={researchHref(record.symbol, item.id, record.market)} target="_blank" rel="noopener noreferrer">{item.label} ↗</a>)}</section>)}</div></details>}
                </div>}
            </dialog>
            {!selected && <section className={styles.emptyWorkspace}><h2>Read a security without saving it.</h2><p>Enter a ticker and market above, or choose a saved security. Notes and decisions are optional.</p></section>}
            {selected && !validSelection && <p role="alert">Invalid security ticker. Enter a valid ticker above.</p>}
            {validSelection && !readingMarket && <section className={styles.emptyWorkspace} aria-label="Resolve security market">
                <h2>{loading ? 'Resolving saved security market…' : 'Choose this security’s market'}</h2>
                <p>{loading ? 'This link does not specify a market. Checking saved research before requesting provider data.' : 'The market could not be resolved from saved research. Choose the correct market to read this ticker, or find its listing above.'}</p>
                <button className={base.textButton} onClick={() => navigate(selected, tab, false, 'US')}>Read {selected} in US</button>{' '}
                <button className={base.textButton} onClick={() => navigate(selected, tab, false, 'MY')}>Read {selected} in Malaysia</button>
            </section>}
            {validSelection && readingMarket && <ConnectedCase key={`${readingMarket}:${selected}`} symbol={selected} market={readingMarket} record={record} onSaved={remember} unlockHref={unlockHref} onAccessDenied={denySavedAccess} onIdentity={setProviderIdentity} advanced={advanced} tab={tab} setTab={value => navigate(selected, value, false, readingMarket)} chartRange={chartRange} setChartRange={setChartRange} />}
            <footer className={styles.footer}><span>Research · provider facts and saved records remain separate</span><details><summary>Data scope & limitations</summary><p>Saved research is user-authored. Quotes, history and fundamentals come from the existing research service; unavailable values stay unavailable. Retrieval time is not an exchange quote timestamp. Editing, monitoring evaluation and advanced tools open the existing workspace. Saving a security requires the explicit Save security action. It does not record an investment decision or personal review. Saved research refreshes when you return from editing; you can also reload it manually.</p><a href="/research-v8?demo=1">Open the labelled representative demo →</a></details><VersionSwitcher placement="footer" /></footer>
        </main>
    </div>;
}

function ConnectedCase({ symbol, market, record, onSaved, unlockHref, onAccessDenied, onIdentity, advanced, tab, setTab, chartRange, setChartRange }: { symbol: string; market: ResearchMarket; record?: ResearchRecord; onSaved: (record: ResearchRecord) => void; unlockHref: string; onAccessDenied: (issue: OwnerAccessIssue) => void; onIdentity: (identity: ProviderResearchIdentity) => void; advanced: boolean; tab: ResearchTab; setTab: (tab: ResearchTab) => void; chartRange: string; setChartRange: (range: string) => void }) {
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveAccessIssue, setSaveAccessIssue] = useState<OwnerAccessIssue | null>(null);
    const savePending = useRef(false);
    async function saveSecurity() {
        if (savePending.current || record) return;
        savePending.current = true; setSaving(true); setSaveError(''); setSaveAccessIssue(null);
        try {
            const response = await fetch('/api/research/watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol, market, companyName: snapshot?.quote.name || symbol, saveOnly: true }) });
            if (!response.ok) {
                const failure = await readFailure(response);
                const issue = readOwnerAccessIssue(failure);
                if (issue) {
                    setSaveAccessIssue(issue); onAccessDenied(issue);
                    throw new Error(issue === 'locked' ? 'Unlock to save this security. Your current reading remains available.' : ownerAccessMessage(issue));
                }
                throw new Error(response.status === 409 ? 'This ticker is already saved. Reload saved research to check its market.' : 'The security could not be saved. Your reading remains available.');
            }
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
    const [optionalBenchmark, setOptionalBenchmark] = useState<ResearchSnapshot['benchmark'] | null>(null);
    const snapshot = readings.current && optionalBenchmark ? { ...readings.current, benchmark: optionalBenchmark } : readings.current;
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [refresh, setRefresh] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        readData(`/api/research/symbol/${encodeURIComponent(symbol)}?market=${market}&benchmark=defer`, controller.signal, readPolicies.provider)
            .then(parseResearchSnapshotResponse)
            .then(next => { if (next.symbol !== symbol || next.market !== market) throw new Error('Security mismatch'); if (active) { setReadings(previous => ({ current: next, previous: previous.current })); onIdentity({ symbol, market, name: next.quote.name }); setAssessmentTime(Date.now()); } })
            .catch(() => { if (active) setError(true); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; controller.abort(); };
    }, [symbol, market, refresh, onIdentity]);
    const [benchmarkRequested, setBenchmarkRequested] = useState(0);
    const [benchmarkError, setBenchmarkError] = useState(false);
    const [benchmarkLoading, setBenchmarkLoading] = useState(false);
    useEffect(() => {
        if (!benchmarkRequested || market !== 'US') return;
        const controller = new AbortController();
        setBenchmarkError(false); setBenchmarkLoading(true);
        readData(`/api/research/benchmark/${encodeURIComponent(symbol)}?market=${market}`, controller.signal, readPolicies.provider)
            .then(value => { if (!value || typeof value !== 'object' || !('data' in value)) throw new Error('Invalid benchmark'); return parseResearchSnapshotResponse({ success: true, data: { ...readings.current, benchmark: value.data } }); })
            .then(next => { if (!controller.signal.aborted) setOptionalBenchmark(next.benchmark); })
            .catch(() => { if (!controller.signal.aborted) setBenchmarkError(true); })
            .finally(() => { if (!controller.signal.aborted) setBenchmarkLoading(false); });
        return () => controller.abort();
    // Benchmark is optional and must not rerun on assessment/quote updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [benchmarkRequested, symbol, market, refresh]);
    const compactFinancialAssessment = snapshot ? (() => { const assessment = assessCurrentResearch(snapshot, assessmentTime); return assessment.status === 'unsupported' || assessment.coverage === 0; })() : false;
    const lastPersonalReview = record ? personalReviewDate(record) : null;
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
        <div className={`${styles.workspace} ${connected.focusedWorkspace}`}>
            <article className={styles.case} aria-label={`${symbol} research`}>
                <section className={`${styles.reading} ${connected.summary} ${snapshot?.fundamentals.reportingPeriod || snapshot?.fundamentals.source ? '' : connected.summarySingle}`} aria-label="Current provider quote">
                    <div><small>Latest returned price</small><strong data-testid="research-price">{loading && !snapshot ? 'Loading…' : money(snapshot?.quote.price, snapshot?.quote.currency)}</strong><span>Quote observed: {snapshot?.quote.observedAt ? retrievedAt(snapshot.quote.observedAt) : 'Observation time unavailable'}</span><span>Provider response retrieved: {retrievedAt(snapshot?.fetchedAt)}</span><span>Daily change {number(snapshot?.quote.dailyChangePercent, '%')}</span></div>
                    {snapshot && (snapshot.fundamentals.reportingPeriod || snapshot.fundamentals.source) && <div><small>Financial reporting period</small><b>{date(snapshot.fundamentals.reportingPeriod)}</b><span>{snapshot.fundamentals.source || 'Financial source unavailable'}</span></div>}
                    {record && <div className={connected.savedDecision} aria-label="Saved user-authored decision"><span className={base.eyebrow}>USER-AUTHORED · SAVED</span><strong>{record.decisionJournal.decision}</strong><span>{lastPersonalReview ? `Last reviewed ${date(lastPersonalReview)}.` : 'No personal review recorded.'}</span><a className={base.textButton} href={researchHref(record.symbol, 'review', record.market)} target="_blank" rel="noopener noreferrer">Open saved review (new tab) ↗</a></div>}
                </section>
                <ResearchPriceContext snapshot={snapshot} />
                {!record && <div className={connected.dataStatus}><span>Reading without a saved record</span><button className={base.textButton} disabled={saving || !snapshot} onClick={saveSecurity}>{saving ? 'Saving…' : 'Save security'}</button></div>}
                {saveError && <p role="alert">{saveError}{saveAccessIssue === 'locked' && <> <a className={base.textButton} href={unlockHref}>Unlock to save</a></>}</p>}
                <ResearchCurrentAssessment snapshot={snapshot} previous={readings.previous} loading={loading} error={error} now={assessmentTime} compact />
                <section className={connected.dataStatus} aria-label="Provider data status"><div role="status">{loading ? snapshot ? `Refreshing provider data. Previous values retrieved ${retrievedAt(snapshot.fetchedAt)} remain visible.` : 'Loading provider data… You can browse while it loads.' : error ? `Provider refresh failed. ${snapshot ? `Previous values retrieved ${retrievedAt(snapshot.fetchedAt)} remain visible.` : 'No current assessment is available.'}` : `Provider sources: ${snapshot?.sources.join(', ') || 'Source not supplied'}`}</div><button className={base.textButton} disabled={loading} onClick={() => { setLoading(true); setError(false); setRefresh(value => value + 1); }}>{error ? 'Retry provider data' : 'Refresh provider data'}</button>{!!snapshot?.warnings.length && !compactFinancialAssessment && <details className={connected.warning}><summary>Some provider data is unavailable. The assessment may be incomplete. <span>View {snapshot.warnings.length} source notice{snapshot.warnings.length === 1 ? '' : 's'}</span></summary><p>Unavailable inputs are not estimated. Refresh to retry, or inspect these source notices.</p><ul>{snapshot.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}</section>

                <section className={styles.investigation} aria-label="Company investigation"><div className={`${base.tabs} ${styles.tabs}`} role="tablist" aria-label="Research investigation" onKeyDown={tabKeys}>{visibleTabs.map(value => <button id={`connected-tab-${value}`} role="tab" aria-selected={activeTab === value} aria-controls="connected-panel" tabIndex={activeTab === value ? 0 : -1} key={value} onClick={() => setTab(value)}>{value}</button>)}</div><div id="connected-panel" role="tabpanel" aria-labelledby={`connected-tab-${activeTab}`} tabIndex={0} className={`${base.panel} ${styles.panel}`}>{activeTab === 'Overview' && <ResearchCurrentAssessment snapshot={snapshot} previous={readings.previous} loading={loading} error={error} now={assessmentTime} />}<ResearchConnectedPanel providerError={error} onBenchmarkRequest={() => setBenchmarkRequested(value => value + 1)} benchmarkError={benchmarkError} benchmarkLoading={benchmarkLoading} advanced={advanced} tab={activeTab} record={record} market={market} snapshot={snapshot} loading={loading} chartRange={chartRange} setChartRange={setChartRange} chartDate={chartDate} setChartDate={setChartDate} /></div></section>

                {advanced && record && <details className={connected.researchChecks}>
                    <summary><b>Optional research tools <span aria-hidden="true">⌄</span></b><span>Thesis, evidence, planning and reminders</span></summary>
                    <p>These tools use your saved research. Unused tools are not missing market evidence and do not require completion.</p>
                    <div className={connected.checkGrid}>{visibleChecks.map(item => <details key={item.id} className={connected.readiness}><summary><b>{item.label}</b><span>{item.id === 'policy' ? 'Assessment required in Research workspace' : item.status}</span></summary><p>{item.id === 'policy' ? 'Policy assessment is available in the Research workspace. No compliance result is inferred here.' : item.detail}</p><a className={base.textButton} href={researchHref(symbol, item.destination, market)} target="_blank" rel="noopener noreferrer">Open {item.label.toLowerCase()} (new tab) ↗</a></details>)}</div>
                </details>}
            </article>

        </div>
    </>;
}
