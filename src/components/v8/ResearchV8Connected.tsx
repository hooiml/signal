'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { WorkspaceNavigation } from '@/components/navigation/WorkspaceNavigation';
import { parseResearchSnapshotResponse } from '@/lib/research/snapshot-input';
import { readData, readFailure, readOwnerAccessIssue, readPolicies } from './read-data';
import { ownerAccessMessage, ownerUnlockHref, type OwnerAccessIssue } from '@/lib/owner-access-client';
import { ResearchSavedState } from './ResearchSavedState';
import { GUEST_WORKSPACE_CLEARED_EVENT, readGuestRecords, readGuestWorkspace, saveGuestSecurity } from '@/lib/research/guest-workspace';
import { discardGuestDraftBackup, readGuestDraftRecovery, restoreGuestDraftBackup, writeGuestDraftBackup, type GuestDraftBackup } from '@/lib/research/guest-workspace';
import { GuestResearchNote, type GuestNoteDraft, type GuestNoteSave } from './GuestResearchNote';
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
import { ResearchDueReview } from './ResearchDueReview';
import { ResearchFilingsV8 } from './ResearchFilingsV8';
import { ResearchPeersV8 } from './ResearchPeersV8';
import { ResearchDiscoverV8 } from './ResearchDiscoverV8';
import { ResearchHomeV8 } from './ResearchHomeV8';
import { V8Card, V8Disclosure, V8FreshnessLine } from './V8Primitives';
import { ResearchInvestigationTabs, researchTabId } from './ResearchInvestigationTabs';
import type { DiscoverView } from './discover-view';
import { date, parseWatchlist, price, researchHref, researchTabs, retrievedAt, type ResearchTab } from './research-v8-connected-data';
import base from './market-v8.module.css';
import { V8Settings } from './V8Settings';
import { FirstVisitCallout, V8FirstVisit, useFirstVisit } from './V8FirstVisit';
import styles from './research-v8.module.css';
import connected from './research-v8-connected.module.css';

export function ResearchV8Connected({ initialTicker = '', initialMarket, initialDiscover }: { initialTicker?: string; initialMarket?: ResearchMarket; initialDiscover?: DiscoverView }) {
    const [providerIdentity, setProviderIdentity] = useState<ProviderResearchIdentity | null>(null);
    const [records, setRecords] = useState<ResearchRecord[] | null>(null);
    const [selected, setSelected] = useState(initialTicker);
    const [selectedMarket, setSelectedMarket] = useState<ResearchMarket | undefined>(initialMarket);
    const [discoverLinkUsed, setDiscoverLinkUsed] = useState(false);
    const [tab, setTab] = useState<ResearchTab>('Overview');
    const [advanced, setAdvanced] = useState(false);
    const [chartRange, setChartRange] = useState('3M');
    const [returnPath, setReturnPath] = useState('/research-v8');
    const [reload, setReload] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [accessIssue, setAccessIssue] = useState<OwnerAccessIssue | null>(null);
    const [workspace, setWorkspace] = useState<'checking' | 'guest' | 'owner'>('checking');
    const workspaceRef = useRef(workspace);
    const [guestDrafts, setGuestDrafts] = useState<Record<string, GuestNoteDraft>>({});
    const draftsRef = useRef<Record<string, GuestNoteDraft>>({});
    const backupVersions = useRef<Record<string, GuestDraftBackup>>({});
    const [recoverableDrafts, setRecoverableDrafts] = useState<GuestDraftBackup[]>([]);
    const [recoveryError, setRecoveryError] = useState('');
    const [recovering, setRecovering] = useState(false);
    const [guestIdentity, setGuestIdentity] = useState<string | null>(null);
    const guestIdentityRef = useRef<string | null>(null);
    function replaceDrafts(next: Record<string, GuestNoteDraft>) {
        draftsRef.current = next;
        setGuestDrafts(next);
    }
    function refreshRecovery() {
        try {
            const activeIds = new Set(Object.entries(backupVersions.current).filter(([key]) => draftsRef.current[key]).map(([, item]) => item.id));
            const recovery = readGuestDraftRecovery();
            setRecoverableDrafts(recovery.drafts.filter(item => !activeIds.has(item.id)));
            setRecoveryError(recovery.unreadableCount ? `${recovery.unreadableCount} draft backup(s) could not be read and were left untouched. Other drafts and saved notes remain available.` : '');
        } catch (cause) { setRecoveryError(cause instanceof Error ? cause.message : 'Draft recovery is unavailable.'); }
    }
    function changeGuestDraft(symbol: string, market: ResearchMarket, identity: string | null, draft: GuestNoteDraft | null, submitted?: GuestNoteSave) {
        if (workspaceRef.current !== 'guest' || !identity || guestIdentityRef.current !== identity) return;
        const key = `${market}:${symbol}`;
        const current = draftsRef.current[key];
        let nextDraft = draft;
        // Preserve edits made while an explicit Save waited for the browser lock.
        if (submitted && current && current.text !== submitted.text && current.expectedNote === submitted.expectedNote) nextDraft = { text: current.text, expectedNote: submitted.savedNote };
        else if (submitted && current && current.expectedNote !== submitted.expectedNote) return;
        if (nextDraft?.text === nextDraft?.expectedNote) nextDraft = null;
        const next = { ...draftsRef.current };
        if (nextDraft) next[key] = nextDraft; else delete next[key];
        replaceDrafts(next);
        const existing = backupVersions.current[key];
        try {
            if (nextDraft && nextDraft.text !== nextDraft.expectedNote) {
                const id = existing?.id ?? crypto.randomUUID();
                const backup = { id, symbol, market, ...nextDraft, updatedAt: new Date().toISOString() };
                backupVersions.current[key] = backup;
                void writeGuestDraftBackup(identity, backup)
                    .then(() => { if (workspaceRef.current === 'guest' && guestIdentityRef.current === identity) refreshRecovery(); })
                    .catch(cause => { if (workspaceRef.current === 'guest' && guestIdentityRef.current === identity) setRecoveryError(cause instanceof Error ? cause.message : 'Draft recovery is unavailable. Save or copy your note.'); });
            } else if (existing) {
                void discardGuestDraftBackup(identity, existing.id, existing).then(() => {
                    if (workspaceRef.current !== 'guest' || guestIdentityRef.current !== identity) return;
                    if (backupVersions.current[key] === existing) delete backupVersions.current[key];
                    refreshRecovery();
                })
                    .catch(() => { if (workspaceRef.current === 'guest' && guestIdentityRef.current === identity) setRecoveryError('Could not remove the old draft backup. Retry device storage.'); });
            }
        } catch { setRecoveryError('Draft recovery is unavailable. Keep this page open and save or copy your note.'); }
    }
    function retryDraftRecovery() {
        refreshRecovery();
        for (const item of records ?? []) {
            const draft = draftsRef.current[`${item.market}:${item.symbol}`];
            if (draft) changeGuestDraft(item.symbol, item.market, guestIdentity, draft);
        }
    }
    async function recoverDraft(backup: GuestDraftBackup, discard = false) {
        const identity = guestIdentityRef.current;
        if (!identity || workspaceRef.current !== 'guest' || recovering) return;
        if (discard && !window.confirm(`Discard this recoverable ${backup.symbol} draft? Saved notes will not change.`)) return;
        setRecovering(true);
        try {
            if (!discard) {
                const key = `${backup.market}:${backup.symbol}`;
                if (draftsRef.current[key]?.text !== undefined) throw new Error('Save or discard the open draft for this security before restoring another version.');
                // Fork the backup: another open tab can continue editing its own version.
                const restored = await restoreGuestDraftBackup(identity, backup, crypto.randomUUID());
                if (workspaceRef.current !== 'guest' || guestIdentityRef.current !== identity) return;
                if (draftsRef.current[key]) throw new Error('The open note changed while recovery was waiting. Your current draft was kept; retry draft recovery to review the backup.');
                backupVersions.current[key] = restored;
                replaceDrafts({ ...draftsRef.current, [key]: { text: backup.text, expectedNote: backup.expectedNote } });
                navigate(backup.symbol, 'Overview', true, backup.market);
            } else await discardGuestDraftBackup(identity, backup.id, backup);
            if (workspaceRef.current === 'guest' && guestIdentityRef.current === identity) refreshRecovery();
        } catch (cause) { setRecoveryError(cause instanceof Error ? cause.message : 'Could not recover this draft.'); }
        finally { setRecovering(false); }
    }
    useEffect(() => {
        if (workspace !== 'guest' || !Object.values(guestDrafts).some(draft => draft.text !== draft.expectedNote)) return;
        const warnBeforeLeaving = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', warnBeforeLeaving);
        return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
    }, [workspace, guestDrafts]);
    const [guestError, setGuestError] = useState('');
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
    function chooseSecurity(value: string) {
        const item = records?.find(item => `${item.market}:${item.symbol}` === value);
        if (!item) return;
        navigate(item.symbol, tab, true, item.market);
        panelRef.current?.close();
    }
    function navigate(symbol: string, nextTab = tab, push = true, nextMarket = selectedMarket, nextAdvanced = advanced) {
        const url = new URL(window.location.href);
        url.searchParams.set('ticker', symbol);
        if (nextMarket) url.searchParams.set('market', nextMarket); else url.searchParams.delete('market');
        url.searchParams.set('tab', nextTab === 'Chart & technicals' ? 'chart' : nextTab.toLowerCase());
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
            const matchingRecords = records?.filter(item => item.symbol === ticker) ?? [];
            const restoredMarket = explicitMarket ?? (matchingRecords.length === 1 ? matchingRecords[0].market : undefined);
            // A legacy Back/Forward entry is normalized while restoring state, so
            // its market survives a later owner-access failure that clears records.
            if (!explicitMarket && restoredMarket) {
                params.set('market', restoredMarket);
                window.history.replaceState(null, '', url);
            }
            setReturnPath(url.pathname + url.search + url.hash);
            setSelected(ticker);
            setSelectedMarket(restoredMarket);
            const restoredTab = params.get('tab')?.toLowerCase() === 'chart' ? 'Chart & technicals' : researchTabs.find(value => value.toLowerCase() === params.get('tab')?.toLowerCase()) ?? 'Overview';
            setTab(restoredTab);
            setAdvanced(params.get('advanced') === '1' || restoredTab === 'Thesis' || restoredTab === 'Review');
    });
    const refreshRecoveryOnStorage = useEffectEvent(() => {
        if (workspaceRef.current === 'guest') refreshRecovery();
    });
    const guestWorkspaceCleared = useEffectEvent(() => {
        if (workspaceRef.current !== 'guest') return;
        savedRevision.current += 1;
        setRecords([]); replaceDrafts({}); backupVersions.current = {};
        setRecoverableDrafts([]); setRecoveryError(''); setGuestError('');
        guestIdentityRef.current = null; setGuestIdentity(null);
        setLoading(false);
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
        const storageChanged = (event: StorageEvent) => {
            if (event.key === 'signal.guest-research.v1' || event.key === null) setReload(value => value + 1);
            else if (event.key.startsWith('signal.guest-research.v1.draft.')) refreshRecoveryOnStorage();
        };
        const cleared = () => guestWorkspaceCleared();
        window.addEventListener(GUEST_WORKSPACE_CLEARED_EVENT, cleared);
        window.addEventListener('storage', storageChanged);
        return () => { window.removeEventListener('popstate', restore); window.removeEventListener('focus', revalidate); document.removeEventListener('visibilitychange', revalidate); window.removeEventListener('storage', storageChanged); window.removeEventListener(GUEST_WORKSPACE_CLEARED_EVENT, cleared); };
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
        async function loadWorkspace() {
            // A public status check chooses the store. Guest records never enter owner CRUD.
            const session = await readData('/api/owner/session', controller.signal, { attemptMs: 3000, budgetMs: 6500 }).catch(() => null);
            if (!active || version !== savedRevision.current) return [];
            const owner = !!session && typeof session === 'object' && 'data' in session && !!session.data && typeof session.data === 'object' && 'unlocked' in session.data && session.data.unlocked === true;
            const nextWorkspace = owner ? 'owner' : 'guest';
            if (workspaceRef.current !== nextWorkspace) { setRecords(null); replaceDrafts({}); backupVersions.current = {}; setRecoverableDrafts([]); setRecoveryError(''); }
            workspaceRef.current = nextWorkspace;
            setWorkspace(nextWorkspace); setGuestError('');
            if (owner) return parseWatchlist(await readData('/api/research/watchlist', controller.signal, readPolicies.watchlist));
            const guest = readGuestWorkspace();
            const identityChanged = guestIdentityRef.current !== null && guestIdentityRef.current !== guest.guestId;
            guestIdentityRef.current = guest.guestId;
            setGuestIdentity(guest.guestId);
            replaceDrafts(identityChanged ? {} : Object.fromEntries(Object.entries(draftsRef.current).filter(([key]) => guest.records.some(item => `${item.market}:${item.symbol}` === key))));
            if (identityChanged) backupVersions.current = {};
            refreshRecovery();
            return guest.records;
        }
        loadWorkspace()
            .then(next => { if (active && version === savedRevision.current) {
                setAccessIssue(null); setError(false);
                setRecords(next);
                const url = new URL(window.location.href);
                const ticker = url.searchParams.get('ticker')?.trim().toUpperCase();
                const linkedMarket = url.searchParams.get('market');
                const marketPreference = linkedMarket === 'MY' || linkedMarket === 'US' ? linkedMarket : undefined;
                const matchingRecords = next.filter(item => item.symbol === ticker);
                // Without a ticker the Research home lists the watchlist instead of opening its first stock.
                const savedSelection = ticker && matchingRecords.length === 1 ? matchingRecords[0] : undefined;
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
                if (workspaceRef.current === 'guest') {
                    setGuestError(failure instanceof Error ? failure.message : 'Device storage is unavailable. You can still read research.');
                    return;
                }
                const issue = readOwnerAccessIssue(failure);
                setError(true); setAccessIssue(issue);
                if (issue) setRecords(null);
            } })
            .finally(() => { if (active && version === savedRevision.current) setLoading(false); });
        return () => { active = false; controller.abort(); };
    }, [reload]);
    const matches = (records ?? []).filter(record => (market === 'All' || record.market === market) && `${record.symbol} ${record.companyName}`.toLowerCase().includes(query.trim().toLowerCase()));
    const matchingRecords = records?.filter(item => item.symbol === selected) ?? [];
    const record = selectedMarket ? matchingRecords.find(item => item.market === selectedMarket) : matchingRecords.length === 1 ? matchingRecords[0] : undefined;
    const readingMarket = selectedMarket ?? record?.market ?? (matchingRecords.length > 1 ? undefined : /^[0-9]+(?:\.KL)?$/.test(selected) || ['MAYBANK', 'KLCI'].includes(selected) || selected.endsWith('.KL') ? 'MY' : undefined);
    const validSelection = /^[A-Z0-9.-]{1,15}$/.test(selected);
    const remember = (saved: ResearchRecord) => {
        if (workspaceRef.current !== workspace) return;
        savedRevision.current += 1;
        setAccessIssue(null); setError(false); setLoading(false);
        if (workspace === 'guest') {
            // Read the current store so a late completion cannot revive cleared/removed records.
            const guest = readGuestWorkspace();
            if (guestIdentityRef.current !== null && guestIdentityRef.current !== guest.guestId) { replaceDrafts({}); backupVersions.current = {}; setRecoverableDrafts([]); }
            guestIdentityRef.current = guest.guestId;
            setGuestIdentity(guest.guestId);
            setRecords(guest.records);
        } else setRecords(previous => [...(previous ?? []).filter(item => item.symbol !== saved.symbol || item.market !== saved.market), saved]);
    };
    const denySavedAccess = (issue: OwnerAccessIssue) => {
        // A Save response is newer evidence than an earlier watchlist request.
        savedRevision.current += 1;
        setAccessIssue(issue); setError(true); setLoading(false); setRecords(null);
    };
    const selectedIndex = matches.findIndex(item => item.symbol === selected && item.market === readingMarket);
    const hasUnsavedDraft = (item: ResearchRecord) => {
        const draft = guestDrafts[`${item.market}:${item.symbol}`];
        return workspace === 'guest' && !!draft && draft.text !== draft.expectedNote;
    };
    const unsavedRecords = (records ?? []).filter(hasUnsavedDraft);
    const hiddenDraft = unsavedRecords.find(item => item.market !== readingMarket || item.symbol !== selected);
    const returnUrl = new URL(returnPath, 'https://signal.invalid');
    if (record && !['US', 'MY'].includes(returnUrl.searchParams.get('market') ?? '')) returnUrl.searchParams.set('market', record.market);
    const unlockHref = ownerUnlockHref(returnUrl.pathname + returnUrl.search + returnUrl.hash);
    const retrySaved = () => { setLoading(true); setError(false); setReload(value => value + 1); };
    async function useGuestWorkspace() {
        try {
            const response = await fetch('/api/owner/session', { method: 'DELETE' });
            if (!response.ok) throw new Error('Could not close the owner session. Try again.');
            savedRevision.current += 1;
            workspaceRef.current = 'guest'; setWorkspace('guest'); setRecords(null); setAccessIssue(null); retrySaved();
            panelRef.current?.close();
        } catch { setError(true); }
    }
    const savedState = workspace === 'owner' ? <ResearchSavedState loading={loading} error={error} issue={accessIssue} hasRecords={records !== null} unlockHref={unlockHref} onRetry={retrySaved} /> : guestError ? <p role="alert">{guestError} {records && 'Showing the last loaded guest records. Saving is unavailable until storage recovers.'} <button className={base.textButton} onClick={retrySaved}>Retry device storage</button></p> : null;
    // Picking a stock from the home's Discover tab mounts the reading view's own Discover; the deep link is spent, so it starts closed.
    const openFromDiscover = (symbol: string, nextMarket: ResearchMarket) => { setDiscoverLinkUsed(true); navigate(symbol, 'Overview', true, nextMarket); window.scrollTo({ top: 0 }); };
    const workspaceStatus = <div className={connected.dataStatus} aria-label="Research workspace">
                <span>{workspace === 'checking' ? 'Welcome to Signal. Explore company data while your workspace loads.' : workspace === 'guest' ? 'Welcome to Signal · Guest workspace. Your watchlist and notes are saved on this device.' : 'Owner workspace · Your private saved research'}</span>
                {!selected && <span>Search a company or ticker, or open one from your watchlist or Discover. Reading saves nothing.</span>}
            </div>;
    const discover = <ResearchDiscoverV8 initialView={discoverLinkUsed ? undefined : initialDiscover} defaultOpen={false} records={records} workspace={workspace} onSelect={openFromDiscover} />;
    const homeDiscover = <ResearchDiscoverV8 initialView={initialDiscover} defaultOpen embedded records={records} workspace={workspace} onSelect={openFromDiscover} />;
    return <div className={`${base.app} ${styles.app} ${connected.app}`}>
        <a className={base.skip} href="#v8-content">Skip to content</a>
        <header className={base.header}><a className={base.logo} href="/main-v8">∿ Signal</a><nav aria-label="Primary"><a href={readingMarket ? `/main-v8?market=${readingMarket}` : '/main-v8'}>Market</a><a href="/research-v8" aria-current="page">Research</a></nav><V8Settings hasUnsavedGuestNotes={workspace === 'guest' && unsavedRecords.length > 0} /></header>
        <main id="v8-content" tabIndex={-1} className={base.canvas}>
            <section className={connected.selectedHeader} aria-label="Selected research security">
                <div data-testid="selected-security-identity" data-symbol={selected} data-market={readingMarket}>
                    <span>{selected ? `${readingMarket ?? 'Market unresolved'} · ${selected}` : 'Current evidence'}</span>
                    <h1>{record?.companyName || researchIdentityName(providerIdentity, selected, readingMarket) || selected || 'Research'}</h1>
                </div>
                <div className={connected.headerActions}>
                    {/* On the home view the Watchlist tab replaces this quick switcher. */}
                    {!!selected && <button className={connected.actionButton} aria-haspopup="dialog" aria-expanded={panel === 'saved'} onClick={event => openPanel('saved', event.currentTarget)}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 4h14v17l-7-4-7 4Z" /></svg><span>Watchlist · {records?.length ?? (loading ? 'Loading…' : accessIssue === 'locked' ? 'Locked' : 'Unavailable')}</span><span aria-hidden="true">⌄</span></button>}
                    <button className={connected.actionButton} aria-haspopup="dialog" aria-expanded={panel === 'tools'} onClick={event => openPanel('tools', event.currentTarget)}>Workspace<span aria-hidden="true">⌄</span></button>
                </div>
            </section>
            {!validSelection && workspaceStatus}
            {(!validSelection || !readingMarket) && <V8FirstVisit surface="research" />}
            {workspace === 'guest' && unsavedRecords.length > 0 && <nav className={connected.guestNavigation} aria-label="Guest research navigation">
                {unsavedRecords.length > 0 && <p role="status">{unsavedRecords.length} unsaved {unsavedRecords.length === 1 ? 'note' : 'notes'}. Save each note before leaving Research.{hiddenDraft && <> <button className={base.textButton} onClick={() => navigate(hiddenDraft.symbol, 'Overview', true, hiddenDraft.market)}>Return to {hiddenDraft.symbol} · {hiddenDraft.market} draft</button></>}</p>}
            </nav>}
            {/* While reading, Change stock and Discover share one row of closed toggles; an opened one takes the full width. */}
            {validSelection ? <div className={connected.toolRow}><details className={connected.lookupDisclosure}><summary>Change stock</summary><ResearchSecurityLookup key={readingMarket ?? initialMarket ?? 'US'} initialMarket={readingMarket ?? initialMarket ?? 'US'} onSelect={(symbol, market) => navigate(symbol, 'Overview', true, market)} /></details>{discover}{workspaceStatus}</div> : <><ResearchSecurityLookup key={readingMarket ?? initialMarket ?? 'US'} initialMarket={readingMarket ?? initialMarket ?? 'US'} onSelect={(symbol, market) => navigate(symbol, 'Overview', true, market)} /><ResearchHomeV8 records={records} status={savedState} preferDiscover={!!initialDiscover} discover={homeDiscover} isUnsaved={hasUnsavedDraft} onOpen={(symbol, market) => navigate(symbol, 'Overview', true, market)} /></>}
            {validSelection && savedState}
            {workspace === 'guest' && <>
                {recoveryError && <p role="alert">{recoveryError} <button className={base.textButton} onClick={retryDraftRecovery}>Retry draft recovery</button></p>}
                {recoverableDrafts.length > 0 && <section className={connected.dataStatus} aria-label="Recover unsaved guest notes"><div><h2>Recover unsaved notes</h2><p>Draft backups from this browser, including other tabs. Restore to edit, then Save note to update your saved research.</p>{recoverableDrafts.map(backup => <div key={backup.id}><b>{backup.symbol} · {backup.market}</b><p>Draft backed up {retrievedAt(backup.updatedAt)}</p><details><summary>Preview draft</summary><p>{backup.text || '(Empty note)'}</p></details><div className={connected.savedReadingActions}><button className={connected.actionButton} disabled={recovering || !!guestDrafts[`${backup.market}:${backup.symbol}`]} onClick={() => recoverDraft(backup)}>Restore {backup.symbol} draft</button><button className={connected.actionButton} disabled={recovering} onClick={() => recoverDraft(backup, true)}>Discard {backup.symbol} draft</button></div></div>)}</div></section>}
            </>}
            <dialog ref={panelRef} className={connected.utilityPanel} aria-labelledby="research-utility-title" onClose={() => { setPanel(null); panelTrigger.current?.focus(); }} onKeyDownCapture={event => { if (event.key === 'Escape') { event.preventDefault(); event.currentTarget.close(); } }} onClick={event => {
                const bounds = event.currentTarget.getBoundingClientRect();
                if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) event.currentTarget.close();
            }}>
                <div className={connected.utilityHeading}><h2 id="research-utility-title">{panel === 'tools' ? 'Workspace' : 'Watchlist'}</h2><button className={base.textButton} onClick={() => panelRef.current?.close()} aria-label="Close research panel">Close ×</button></div>
                {panel === 'saved' && <div className={connected.savedSelector}>
            {savedState}{records?.length === 0 && <p>Your watchlist is empty. Search for a company, then choose Save stock.</p>}
            <div className={`${styles.toolbar} ${connected.toolbar}`}><label className={styles.search}><span>Find in watchlist</span><span className={styles.searchField}><input type="search" placeholder="Apple, MSFT, Maybank…" value={query} onChange={event => setQuery(event.target.value)} /></span></label><label className={styles.stateControl}>Market<select value={market} onChange={event => setMarket(event.target.value)}><option>All</option><option>US</option><option>MY</option></select></label><button className={base.textButton} disabled={loading} onClick={() => { setLoading(true); setError(false); setReload(value => value + 1); }}>Reload watchlist</button></div>
            <p className={styles.fixtureNotice}>Choose a stock to read its current data. No research form is required.</p>
            {records && records.length > 0 && <section className={styles.companySection} aria-label="Saved watchlist"><div className={styles.sectionLabel}><span>Your watchlist <b>{matches.length} of {records.length}</b></span>{workspace === 'owner' && <a className={base.textButton} href="/research?workspace=research">Manage watchlist ↗</a>}</div><div className={`${styles.companyList} ${connected.watchlist}`}>{matches.map(item => <button className={styles.companyButton} key={`${item.market}:${item.symbol}`} aria-pressed={selected === item.symbol && readingMarket === item.market} onClick={() => { navigate(item.symbol, tab, true, item.market); panelRef.current?.close(); }}><span className={styles.monogram} aria-hidden="true">{item.symbol[0]}</span><span><b>{item.symbol}</b><small>{item.companyName || item.symbol}</small><small>{item.market}{hasUnsavedDraft(item) ? ' · Unsaved' : ''}{advanced && workspace === 'owner' ? ` · ${item.positionState} · ${item.status}` : ''}</small></span><span className={styles.companyArrow} aria-hidden="true">↗</span></button>)}</div>{!matches.length && <p className={styles.searchEmpty}>No watchlist stocks match these filters. <button className={base.textButton} onClick={() => { setQuery(''); setMarket('All'); }}>Clear filters</button></p>}{record && !matches.includes(record) && <p className={styles.searchHint}>{record.symbol} remains open below and is outside the current filter.</p>}</section>}
            {!!matches.length && <div className={connected.mobilePicker}><label>Selected watchlist stock<select value={`${readingMarket}:${selected}`} onChange={event => chooseSecurity(event.target.value)}>{selectedIndex < 0 && <option value={`${readingMarket}:${selected}`}>{selected} · outside filter</option>}{matches.map(item => <option key={`${item.market}:${item.symbol}`} value={`${item.market}:${item.symbol}`}>{item.symbol} · {item.market}{hasUnsavedDraft(item) ? ' · Unsaved' : ''} · {item.companyName}</option>)}</select></label><div><button disabled={selectedIndex <= 0} onClick={() => chooseSecurity(`${matches[selectedIndex - 1].market}:${matches[selectedIndex - 1].symbol}`)}>← Previous</button><span>{selectedIndex < 0 ? '—' : selectedIndex + 1} / {matches.length}</span><button disabled={selectedIndex >= matches.length - 1} onClick={() => chooseSecurity(`${matches[selectedIndex + 1].market}:${matches[selectedIndex + 1].symbol}`)}>Next →</button></div></div>}
                </div>}
                {panel === 'tools' && <div className={connected.tools}>
                    {workspace === 'guest' && <button className={connected.actionButton} aria-pressed={advanced} onClick={() => { changeDepth(); panelRef.current?.close(); }}>Detailed view</button>}
                    {workspace === 'owner' && <>
                    <button className={connected.actionButton} onClick={useGuestWorkspace}>Lock owner workspace and use guest mode</button>
                    <p>{record ? `Your saved research for ${record.symbol}. These are your records, not provider conclusions.` : 'No saved record is open. Reading financial and price information does not require saving or writing notes.'}</p>
                    {record && <div className={connected.savedReadingActions}>{(['Thesis', 'Review'] as const).map(destination => <button key={destination} className={connected.actionButton} onClick={() => { navigate(selected, destination, true, readingMarket, true); panelRef.current?.close(); }}>Read saved {destination.toLowerCase()}</button>)}<a className={base.textButton} href={researchHref(record.symbol, 'review', record.market)} target="_blank" rel="noopener noreferrer">Edit saved research (new tab) ↗</a></div>}
                    <button className={connected.actionButton} aria-pressed={advanced} onClick={() => { changeDepth(); panelRef.current?.close(); }}>Detailed view</button>
                    <p>Advanced view exposes additional reading tabs and chart links. It does not change provider data.</p>
                    {record && <details><summary>All research workspaces</summary><p>Open a workspace for {record.symbol} in a new tab.</p><div>{researchWorkspaceGroups.map(group => <section key={group.id}><h3>{group.label}</h3>{group.items.map(item => <a key={item.id} href={researchHref(record.symbol, item.id, record.market)} target="_blank" rel="noopener noreferrer">{item.label} ↗</a>)}</section>)}</div></details>}
                    </>}
                </div>}
            </dialog>
            {selected && !validSelection && <p role="alert">Invalid security ticker. Enter a valid ticker above.</p>}
            {validSelection && !readingMarket && <section className={styles.emptyWorkspace} aria-label="Resolve security market">
                <h2>{loading ? 'Resolving saved security market…' : 'Choose this security’s market'}</h2>
                <p>{loading ? 'This link does not specify a market. Checking saved research before requesting provider data.' : 'The market could not be resolved from saved research. Choose the correct market to read this ticker, or find its listing above.'}</p>
                <button className={base.textButton} onClick={() => navigate(selected, tab, false, 'US')}>Read {selected} in US</button>{' '}
                <button className={base.textButton} onClick={() => navigate(selected, tab, false, 'MY')}>Read {selected} in Malaysia</button>
            </section>}
            {validSelection && readingMarket && <ConnectedCase key={`${readingMarket}:${selected}`} workspace={workspace} guestUnavailable={!!guestError} guestIdentity={guestIdentity} guestDraft={guestDrafts[`${readingMarket}:${selected}`]} onDraftChange={(draft, submitted) => changeGuestDraft(selected, readingMarket, guestIdentity, draft, submitted)} symbol={selected} market={readingMarket} record={record} savedRecords={records ?? []} onOpenSecurity={(symbol, nextMarket) => { navigate(symbol, 'Overview', true, nextMarket); window.scrollTo({ top: 0 }); }} onSaved={remember} onGuestRemoved={() => { savedRevision.current += 1; setRecords(readGuestRecords()); refreshRecovery(); }} unlockHref={unlockHref} onAccessDenied={denySavedAccess} onIdentity={setProviderIdentity} advanced={advanced} tab={tab} setTab={value => navigate(selected, value, false, readingMarket)} chartRange={chartRange} setChartRange={setChartRange} />}
            {/* The optional install offer docks here instead of floating over the page. */}<div id="signal-install-slot" /><footer className={styles.footer}><span>Research · provider facts and saved records remain separate</span><details><summary>Data scope & limitations</summary><p>Saved research is user-authored. Quotes, history and fundamentals come from the existing research service; unavailable values stay unavailable. Retrieval time is not an exchange quote timestamp. Editing, monitoring evaluation and advanced tools open the existing workspace. Adding a stock to the watchlist requires the explicit Save stock action. It does not record an investment decision or personal review. Saved research refreshes when you return from editing; you can also reload it manually.</p><a href="/research-v8?demo=1">Open the labelled representative demo →</a></details><WorkspaceNavigation placement="footer" /></footer>
        </main>
    </div>;
}

function ConnectedCase({ workspace, guestUnavailable, guestIdentity, guestDraft, onDraftChange, symbol, market, record: savedRecord, savedRecords, onOpenSecurity, onSaved, onGuestRemoved, unlockHref, onAccessDenied, onIdentity, advanced, tab, setTab, chartRange, setChartRange }: { workspace: 'checking' | 'guest' | 'owner'; guestUnavailable: boolean; guestIdentity: string | null; guestDraft?: GuestNoteDraft; onDraftChange: (draft: GuestNoteDraft | null, submitted?: GuestNoteSave) => void; symbol: string; market: ResearchMarket; record?: ResearchRecord; savedRecords: readonly ResearchRecord[]; onOpenSecurity: (symbol: string, market: ResearchMarket) => void; onSaved: (record: ResearchRecord) => void; onGuestRemoved: () => void; unlockHref: string; onAccessDenied: (issue: OwnerAccessIssue) => void; onIdentity: (identity: ProviderResearchIdentity) => void; advanced: boolean; tab: ResearchTab; setTab: (tab: ResearchTab) => void; chartRange: string; setChartRange: (range: string) => void }) {
    // Owner-only reviews and advanced tools never receive guest bookmarks.
    const record = workspace === 'owner' ? savedRecord : undefined;
    const tour = useFirstVisit();
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveAccessIssue, setSaveAccessIssue] = useState<OwnerAccessIssue | null>(null);
    const savePending = useRef(false);
    async function saveSecurity() {
        if (savePending.current || savedRecord || workspace === 'checking') return;
        savePending.current = true; setSaving(true); setSaveError(''); setSaveAccessIssue(null);
        const tourAtSave = !loading && !error && snapshot?.quote.price != null && snapshot.quote.price > 0 ? tour.progress?.state : null;
        try {
            if (workspace === 'guest') {
                onSaved(await saveGuestSecurity(symbol, market, snapshot?.quote.name || symbol));
                if (tourAtSave?.stage === 'save') await tour.advance(tourAtSave, 'complete');
                return;
            }
            const response = await fetch('/api/research/watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol, market, companyName: snapshot?.quote.name || symbol, saveOnly: true }) });
            if (!response.ok) {
                const failure = await readFailure(response);
                const issue = readOwnerAccessIssue(failure);
                if (issue) {
                    setSaveAccessIssue(issue); onAccessDenied(issue);
                    throw new Error(issue === 'locked' ? 'Unlock to save this security. Your current reading remains available.' : ownerAccessMessage(issue));
                }
                throw new Error(response.status === 409 ? 'This ticker is already in your watchlist. Reload the watchlist to check its market.' : 'The stock could not be saved. Your reading remains available.');
            }
            const body = await response.json();
            const saved = parseResearchRecord(body.data);
            if (saved.symbol !== symbol || saved.market !== market) throw new Error('Saved security did not match the request.');
            onSaved(saved);
            if (tourAtSave?.stage === 'save') await tour.advance(tourAtSave, 'complete');
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
    return <>
        <FirstVisitCallout tour={tour} surface="research" ready={!loading && !error && snapshot?.quote.price != null && Number.isFinite(snapshot.quote.price) && snapshot.quote.price > 0} saved={!!savedRecord} />
        <div className={`${styles.workspace} ${connected.focusedWorkspace}`}>
            <article className={styles.case} aria-label={`${symbol} research`}>
                {/* One quote band: the price and Save on the left, price context beside it. */}
                <div className={connected.quoteBand}>
                <div className={connected.quoteMain}>
                <section className={`${styles.reading} ${connected.summary} ${snapshot?.fundamentals.reportingPeriod || snapshot?.fundamentals.source ? '' : connected.summarySingle}`} aria-label="Current provider quote">
                    <div><small>Latest returned price</small><span className={connected.priceLine}><strong data-testid="research-price">{loading && !snapshot ? 'Loading…' : price(snapshot?.quote.price, snapshot?.quote.currency)}</strong>{snapshot && <DailyChange value={snapshot.quote.dailyChangePercent} observedAt={snapshot.quote.observedAt} />}</span><V8FreshnessLine label="Quote observed" value={snapshot?.quote.observedAt ? retrievedAt(snapshot.quote.observedAt) : 'Observation time unavailable'} /><V8FreshnessLine label="Provider response retrieved" value={retrievedAt(snapshot?.fetchedAt)} /></div>
                    {snapshot && (snapshot.fundamentals.reportingPeriod || snapshot.fundamentals.source) && <div><small>Financial reporting period</small><b>{date(snapshot.fundamentals.reportingPeriod)}</b><span>{snapshot.fundamentals.source || 'Financial source unavailable'}</span></div>}
                    {record && <div className={connected.savedDecision} aria-label="Saved user-authored decision"><span className={base.eyebrow}>User-authored · saved</span><strong>{record.decisionJournal.decision}</strong><span>{lastPersonalReview ? `Last reviewed ${date(lastPersonalReview)}.` : 'No personal review recorded.'}</span><a className={base.textButton} href={researchHref(record.symbol, 'review', record.market)} target="_blank" rel="noopener noreferrer">Open saved review (new tab) ↗</a></div>}
                </section>
                {!savedRecord && <div className={connected.saveAction}><button className={base.primaryButton} disabled={saving || !snapshot || workspace === 'checking' || (workspace === 'guest' && guestUnavailable)} onClick={saveSecurity}>{saving ? 'Saving…' : 'Save stock'}</button><span>{workspace === 'guest' ? 'Save this stock to your watchlist to add your own note.' : 'Reading without a saved record'}</span></div>}
                </div>
                <ResearchPriceContext snapshot={snapshot} />
                </div>
                {record && <ResearchDueReview record={record} snapshot={snapshot} loading={loading} error={error} />}
                {workspace === 'guest' && savedRecord && <GuestResearchNote key={guestIdentity} draftState={guestDraft} onDraftChange={onDraftChange} disabled={guestUnavailable} record={savedRecord} onSaved={onSaved} onRemoved={onGuestRemoved} />}
                {saveError && <p role="alert">{saveError}{saveAccessIssue === 'locked' && <> <a className={base.textButton} href={unlockHref}>Unlock to save</a></>}</p>}
                <ResearchCurrentAssessment snapshot={snapshot} previous={readings.previous} loading={loading} error={error} now={assessmentTime} compact />
                <section className={connected.dataStatus} aria-label="Provider data status"><div role="status">{loading ? snapshot ? `Refreshing provider data. Previous values retrieved ${retrievedAt(snapshot.fetchedAt)} remain visible.` : 'Loading provider data… You can browse while it loads.' : error ? `Provider refresh failed. ${snapshot ? `Previous values retrieved ${retrievedAt(snapshot.fetchedAt)} remain visible.` : 'No current assessment is available.'}` : `Provider sources: ${snapshot?.sources.join(', ') || 'Source not supplied'}`}</div><button className={base.textButton} disabled={loading} onClick={() => { setLoading(true); setError(false); setRefresh(value => value + 1); }}>{error ? 'Retry provider data' : 'Refresh provider data'}</button>{!!snapshot?.warnings.length && !compactFinancialAssessment && <V8Disclosure className={connected.warning} summary={<>Source notices and limitations <span>View {snapshot.warnings.length} source notice{snapshot.warnings.length === 1 ? '' : 's'}</span></>}><p>These notices describe missing data or limits on how the returned values can be used. Unavailable inputs are not estimated; refreshing does not necessarily resolve a reporting limitation.</p><ul>{snapshot.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></V8Disclosure>}</section>

                <section className={styles.investigation} aria-label="Company investigation"><ResearchInvestigationTabs tabs={visibleTabs} activeTab={activeTab} onChange={setTab} /><V8Card as="div" id="connected-panel" role="tabpanel" aria-labelledby={researchTabId(activeTab)} tabIndex={0} className={styles.panel}>{activeTab === 'Overview' && <ResearchCurrentAssessment snapshot={snapshot} previous={readings.previous} loading={loading} error={error} now={assessmentTime} />}<ResearchConnectedPanel providerError={error} onBenchmarkRequest={() => setBenchmarkRequested(value => value + 1)} benchmarkError={benchmarkError} benchmarkLoading={benchmarkLoading} advanced={advanced} tab={activeTab} record={record} market={market} snapshot={snapshot} loading={loading} chartRange={chartRange} setChartRange={setChartRange} chartDate={chartDate} setChartDate={setChartDate} />{activeTab === 'Peers' && <ResearchPeersV8 symbol={symbol} market={market} snapshot={snapshot} saved={savedRecords} onOpen={onOpenSecurity} />}{activeTab === 'Filings' && <ResearchFilingsV8 symbol={symbol} market={market} record={record} />}</V8Card></section>

                {advanced && record && <details className={connected.researchChecks}>
                    <summary><b>Optional research tools <span aria-hidden="true">⌄</span></b><span>Thesis, evidence, planning and reminders</span></summary>
                    <p>These tools use your saved research. Unused tools are not missing market evidence and do not require completion.</p>
                    <div className={connected.checkGrid}>{visibleChecks.map(item => <details key={item.id} className={connected.readiness}><summary><b>{item.label}</b><span>{item.id === 'policy' ? 'Assessment required in Research workspace' : item.status}</span></summary><p>{item.id === 'policy' ? 'Policy assessment is available in the Research workspace. No compliance result is inferred here.' : item.detail}</p><a className={base.textButton} href={researchHref(symbol, item.destination, market)} target="_blank" rel="noopener noreferrer">Open {item.label.toLowerCase()} (new tab) ↗</a></details>)}</div>
                </details>}
            </article>

        </div>
    </>;
}

// Signed daily move beside the price; the arrow keeps direction readable without colour.
function DailyChange({ value, observedAt }: { value: number | null | undefined; observedAt?: string | null }) {
    if (value == null || !Number.isFinite(value)) return <span className={connected.dailyChange} data-direction="none">Daily change unavailable</span>;
    const direction = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
    const sign = value > 0 ? '+' : value < 0 ? '−' : '';
    const session = observedAt && Number.isFinite(Date.parse(observedAt)) ? `session ${date(observedAt)}` : 'session date unavailable';
    return <span className={connected.dailyChange} data-direction={direction}><span className={base.visuallyHidden}>Daily change </span><span aria-hidden="true">{direction === 'up' ? '▲' : direction === 'down' ? '▼' : '–'}</span> {sign}{Math.abs(value).toFixed(2)}%<span className={connected.dailyChangeLabel}> · {session}</span></span>;
}
