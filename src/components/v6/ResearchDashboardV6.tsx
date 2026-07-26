'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { watchlist } from '@/components/research/ResearchDashboardV2';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import { parseResearchRecord, ResearchInputError } from '@/lib/research/input';
import { parseResearchQuoteResponse } from '@/lib/research/snapshot-input';
import type { AcceptedResearchEvidence, ResearchCreateInput, ResearchRecord, ResearchUpdateMode } from '@/lib/types/research';
import { ResearchDetailV6 } from './ResearchDetailV6';
import {
    ResearchHeaderV6,
    type ResearchActionFilterV6,
    type ResearchMarketFilterV6,
} from './ResearchHeaderV6';
import { ResearchWatchlistV6 } from './ResearchWatchlistV6';
import { TrendDiscoveryV6 } from './TrendDiscoveryV6';
import { ResearchPickerV6 } from './ResearchPickerV6';
import { ResearchAlertsV6 } from './ResearchAlertsV6';
import { ResearchComparisonV6 } from './ResearchComparisonV6';
import { ResearchInboxV6, type ResearchInboxSummaryV6 } from './ResearchInboxV6';
import { isResearchWorkspaceV6, ResearchWorkspaceTabsV6, type ResearchWorkspaceV6 } from './ResearchWorkspaceTabsV6';
import { ResearchMarketContextV6 } from './MarketResearchHandoffV6';
import { applyResearchRecordV6, createWatchlistItemV6, toResearchRecordV6 } from './research-records-v6';
import { applyResearchQuoteV6, applyResearchSnapshotV6 } from './research-snapshot-v6';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import {
    getResearchActionV6,
    getThemeV6,
    isResearchTabV6,
    type ResearchTabV6,
} from './research-v6';
import { useThemeV6 } from './ThemeProviderV6';
import { parseMarketResearchHandoff } from '@/lib/market-research-handoff';
import { PositionPlanOverviewV6 } from './PositionPlanOverviewV6';
import { ResearchCalendarV6 } from './ResearchCalendarV6';
import { ResearchOutcomeAnalyticsV6 } from './ResearchOutcomeAnalyticsV6';
import { PortfolioRiskCockpitV6 } from './PortfolioRiskCockpitV6';
import { ResearchPeerBenchmarkV6 } from './ResearchPeerBenchmarkV6';
import { SourceHealthDashboardV6 } from './SourceHealthDashboardV6';
import { EvidenceCoverageDashboardV6 } from './EvidenceCoverageDashboardV6';
import { InvestmentPolicyGuardrailsV6 } from './InvestmentPolicyGuardrailsV6';
import { CurrencyPerformanceV6 } from './CurrencyPerformanceV6';
import { EvidenceDocumentDiffV6 } from './EvidenceDocumentDiffV6';
import { ResearchRelationshipGraphV6 } from './ResearchRelationshipGraphV6';
import { HistoricalDecisionReplayV6 } from './HistoricalDecisionReplayV6';
import { ResearchDecisionPacketV6 } from './ResearchDecisionPacketV6';
import { ProductAnalyticsDashboardV6 } from './ProductAnalyticsDashboardV6';
import { ThesisChangeInboxV6 } from './ThesisChangeInboxV6';
import { ResearchWorkflowQueueV6 } from './ResearchWorkflowQueueV6';
import { EncryptedResearchBackupV6 } from './EncryptedResearchBackupV6';
import { ResearchLayoutControlsV6 } from './ResearchLayoutControlsV6';
import type { AppCommandV6 } from './CommandPaletteV6';
import type { ResearchLayoutDensity, SavedResearchLayout } from '@/lib/research/saved-layouts';
import type { ResearchWorkflowTemplateId } from '@/lib/research/workflow-queue';
import { buildResearchRelativeUrl, mergeResearchSearchParams, resolveVisibleResearchSymbol, type ResearchUrlChanges } from '@/lib/research/url-state';
import {
    clearProductAnalyticsWorkflowSource,
    currentProductAnalyticsWorkflowSource,
    setProductAnalyticsWorkflowSource,
    trackProductAnalyticsEvent,
} from '@/lib/product-analytics-client';
import type { ProductAnalyticsSource } from '@/lib/types/product-analytics';

const formatSnapshotLabel = (date: string) => new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
}).format(new Date(date + 'T00:00:00Z'));

const filterResearchItems = (
    items: readonly ResearchWatchlistItem[],
    query: string,
    market: ResearchMarketFilterV6,
    action: ResearchActionFilterV6,
) => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
        const matchesQuery = !normalizedQuery
            || item.symbol.toLowerCase().includes(normalizedQuery)
            || item.name.toLowerCase().includes(normalizedQuery);
        const matchesMarket = market === 'ALL' || item.market === market;
        const matchesAction = action === 'ALL' || getResearchActionV6(item) === action;
        return matchesQuery && matchesMarket && matchesAction;
    });
};

export const ResearchDashboardV6 = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const requestedTicker = searchParams.get('ticker')?.trim().toUpperCase();
    const searchString = searchParams.toString();
    const validRequestedTicker = Boolean(requestedTicker && /^[A-Z0-9.-]{1,20}$/.test(requestedTicker));
    const requestedSymbol = validRequestedTicker && requestedTicker ? requestedTicker : 'MSFT';
    const requestedWorkspace = searchParams.get('workspace');
    const requestedDetailTab = searchParams.get('tab');
    const requestedReview = searchParams.get('review');
    const marketHandoff = useMemo(() => parseMarketResearchHandoff(searchParams), [searchParams]);
    const initialSymbol = requestedSymbol;
    const initialTab: ResearchTabV6 = isResearchTabV6(requestedDetailTab) ? requestedDetailTab : 'overview';
    const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol);
    const [activeDetailTab, setActiveDetailTab] = useState<ResearchTabV6>(initialTab);
    const { theme, toggleTheme } = useThemeV6();
    const [query, setQuery] = useState('');
    const [market, setMarket] = useState<ResearchMarketFilterV6>('ALL');
    const [action, setAction] = useState<ResearchActionFilterV6>('ALL');
    const [items, setItems] = useState<ResearchWatchlistItem[]>(watchlist);
    const [records, setRecords] = useState<ResearchRecord[]>([]);
    const [recordsLoadState, setRecordsLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [saving, setSaving] = useState(false);
    const [adding, setAdding] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [inboxSummary, setInboxSummary] = useState<ResearchInboxSummaryV6 | null>(null);
    const [workspace, setWorkspace] = useState<ResearchWorkspaceV6>(isResearchWorkspaceV6(requestedWorkspace) ? requestedWorkspace : 'research');
    const [reviewRequested, setReviewRequested] = useState(requestedReview === 'edit');
    const [stagedEvidence, setStagedEvidence] = useState<AcceptedResearchEvidence | null>(null);
    const [workflowTemplateId, setWorkflowTemplateId] = useState<ResearchWorkflowTemplateId | null>(null);
    const [density, setDensity] = useState<ResearchLayoutDensity>('comfortable');
    const [savedLayouts, setSavedLayouts] = useState<readonly SavedResearchLayout[]>([]);
    const liveSnapshots = useRef(new Map<string, ResearchSnapshot>());
    const liveQuotes = useRef(new Map<string, ResearchSnapshot['quote']>());
    const quoteItems = useRef(items);
    const quoteTargetKey = useMemo(
        () => items.map((item) => `${item.symbol}:${item.market}`).join('|'),
        [items],
    );
    const urlSearchRef = useRef(searchString);

    const updateUrl = useCallback((changes: ResearchUrlChanges, mode: 'push' | 'replace' = 'replace') => {
        const nextSearchParams = mergeResearchSearchParams(new URLSearchParams(urlSearchRef.current), changes);
        const nextPath = buildResearchRelativeUrl(window.location.pathname, nextSearchParams, window.location.hash);
        const currentPath = window.location.pathname + window.location.search + window.location.hash;
        if (nextPath === currentPath) return;
        urlSearchRef.current = nextSearchParams.toString();
        if (mode === 'push') router.push(nextPath, { scroll: false });
        else router.replace(nextPath, { scroll: false });
    }, [router]);

    const normalizedWorkspace: ResearchWorkspaceV6 = isResearchWorkspaceV6(requestedWorkspace) ? requestedWorkspace : 'research';
    const normalizedDetailTab: ResearchTabV6 = isResearchTabV6(requestedDetailTab) ? requestedDetailTab : 'overview';
    const normalizedReview = requestedReview === 'edit';

    useEffect(() => {
        urlSearchRef.current = searchString;
    }, [searchString]);

    useEffect(() => {
        setWorkspace((current) => current === normalizedWorkspace ? current : normalizedWorkspace);
    }, [normalizedWorkspace]);

    useEffect(() => {
        setActiveDetailTab((current) => current === normalizedDetailTab ? current : normalizedDetailTab);
    }, [normalizedDetailTab]);

    useEffect(() => {
        setReviewRequested((current) => current === normalizedReview ? current : normalizedReview);
    }, [normalizedReview]);

    useEffect(() => {
        trackProductAnalyticsEvent({
            name: 'workspace_viewed',
            surface: 'research',
            workspace,
        });
    }, [workspace]);

    const changeWorkspace = (nextWorkspace: ResearchWorkspaceV6) => {
        setWorkspace(nextWorkspace);
        updateUrl({ workspace: nextWorkspace }, 'push');
    };

    const filteredItems = useMemo(() => filterResearchItems(items, query, market, action), [action, items, market, query]);

    useEffect(() => {
        if (urlSearchRef.current !== searchString) return;
        const nextSymbol = resolveVisibleResearchSymbol(filteredItems, requestedSymbol);
        setSelectedSymbol((current) => current === (nextSymbol ?? '') ? current : nextSymbol ?? '');
        if (nextSymbol === requestedSymbol && (validRequestedTicker || !requestedTicker)) return;
        if (nextSymbol) updateUrl({ ticker: nextSymbol });
        else updateUrl({ ticker: null, tab: null, review: null });
    }, [filteredItems, requestedSymbol, requestedTicker, searchString, updateUrl, validRequestedTicker]);

    const selected = useMemo(
        () => filteredItems.find((item) => item.symbol === selectedSymbol) ?? null,
        [filteredItems, selectedSymbol],
    );
    const latestReviewedAt = useMemo(
        () => [...items].sort((left, right) => right.lastReviewedAt.localeCompare(left.lastReviewedAt))[0]?.lastReviewedAt ?? new Date().toISOString().slice(0, 10),
        [items],
    );
    const selectedRecord = selected
        ? records.find((record) => record.symbol === selected.symbol) ?? toResearchRecordV6(selected)
        : null;
    const inboxRecords = useMemo(
        () => items.map((item) => records.find((record) => record.symbol === item.symbol) ?? toResearchRecordV6(item)),
        [items, records],
    );
    const themeClasses = getThemeV6(theme);
    const updateInboxSummary = useCallback((next: ResearchInboxSummaryV6) => {
        setInboxSummary((current) => current
            && current.status === next.status
            && current.attentionCount === next.attentionCount
            && current.unreadCount === next.unreadCount
            ? current
            : next);
    }, []);

    const updateLiveSnapshot = useCallback((symbol: string, snapshot: ResearchSnapshot) => {
        liveSnapshots.current.set(symbol, snapshot);
        const liveQuote = liveQuotes.current.get(symbol);
        setItems((current) => current.map((item) => {
            if (item.symbol !== symbol) return item;
            const withSnapshot = applyResearchSnapshotV6(item, snapshot);
            return liveQuote ? applyResearchQuoteV6(withSnapshot, liveQuote) : withSnapshot;
        }));
    }, []);

    useEffect(() => {
        let active = true;
        const loadRecords = async () => {
            try {
                const response = await fetch('/api/research/watchlist');
                const payload: unknown = await response.json();
                if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new ResearchInputError('Invalid research API response.');
                const data = Object.fromEntries(Object.entries(payload)).data;
                const archivedData = Object.fromEntries(Object.entries(payload)).archivedSymbols;
                if (!response.ok || !Array.isArray(data)) throw new ResearchInputError('Unable to load saved research.');
                const stored = data.map(parseResearchRecord);
                const archivedSymbols = Array.isArray(archivedData) ? archivedData.filter((item): item is string => typeof item === 'string') : [];
                if (!active) return;
                const seeded = watchlist.filter((item) => !archivedSymbols.includes(item.symbol)).map((item) => {
                    const record = stored.find((candidate) => candidate.symbol === item.symbol);
                    return record ? applyResearchRecordV6(item, record) : item;
                });
                const additions = stored
                    .filter((record) => !watchlist.some((item) => item.symbol === record.symbol))
                    .map((record, index) => createWatchlistItemV6(record, 100 + index));
                setRecords(stored);
                setRecordsLoadState('ready');
                setItems([...seeded, ...additions].map((item) => {
                    const snapshot = liveSnapshots.current.get(item.symbol);
                    const withSnapshot = snapshot ? applyResearchSnapshotV6(item, snapshot) : item;
                    const quote = liveQuotes.current.get(item.symbol);
                    return quote ? applyResearchQuoteV6(withSnapshot, quote) : withSnapshot;
                }));
            } catch (error) {
                if (active) {
                    setRecordsLoadState('error');
                    setSaveError(error instanceof Error ? error.message : 'Unable to load saved research.');
                }
            }
        };
        void loadRecords();
        return () => { active = false; };
    }, []);

    useEffect(() => {
        quoteItems.current = items;
    }, [items]);

    useEffect(() => {
        const itemsToQuote = quoteItems.current.filter((item) => !liveQuotes.current.has(item.symbol));
        if (itemsToQuote.length === 0) return;
        const controller = new AbortController();
        const loadQuotes = async () => {
            const results = await Promise.allSettled(itemsToQuote.map(async (item) => {
                const response = await fetch(`/api/research/quote/${encodeURIComponent(item.symbol)}?market=${item.market}`, { signal: controller.signal });
                const payload: unknown = await response.json();
                if (!response.ok) throw new ResearchInputError('Live quote unavailable.');
                return { symbol: item.symbol, quote: parseResearchQuoteResponse(payload) };
            }));
            if (controller.signal.aborted) return;
            const quotes = new Map<string, ResearchSnapshot['quote']>();
            for (const result of results) {
                if (result.status === 'fulfilled') {
                    quotes.set(result.value.symbol, result.value.quote);
                    liveQuotes.current.set(result.value.symbol, result.value.quote);
                }
            }
            if (quotes.size === 0) return;
            setItems((current) => current.map((item) => {
                const quote = quotes.get(item.symbol);
                return quote ? applyResearchQuoteV6(item, quote) : item;
            }));
        };
        void loadQuotes();
        return () => controller.abort();
    }, [quoteTargetKey]);

    const selectTicker = (symbol: string, focusDetail = false, tab: ResearchTabV6 = 'overview', startReview = false, historyMode: 'push' | 'replace' = 'replace') => {
        if (focusDetail) {
            setQuery('');
            setMarket('ALL');
            setAction('ALL');
        }
        setWorkspace('research');
        setSelectedSymbol(symbol);
        setActiveDetailTab(tab);
        setReviewRequested(startReview);
        updateUrl({
            workspace: 'research',
            ticker: symbol,
            tab: tab === 'overview' ? null : tab,
            review: startReview ? 'edit' : null,
        }, historyMode);
        if (focusDetail) {
            window.setTimeout(() => {
                const detail = document.getElementById('research-detail');
                if (!detail) return;
                detail.scrollIntoView({ behavior: 'auto', block: 'start' });
                detail.focus({ preventScroll: true });
            }, 0);
        }
    };

    const applySavedLayout = (layout: SavedResearchLayout) => {
        setWorkspace(layout.workspace);
        setQuery(layout.query);
        setMarket(layout.market);
        setAction(layout.action);
        setSelectedSymbol(layout.ticker ?? '');
        setActiveDetailTab(layout.tab);
        setReviewRequested(false);
        setDensity(layout.density);
        window.localStorage.setItem('signal-research-density-v1', layout.density);
        updateUrl({
            workspace: layout.workspace,
            ticker: layout.ticker,
            tab: layout.tab === 'overview' ? null : layout.tab,
            review: null,
        }, 'push');
    };

    const openResearchFrom = (source: ProductAnalyticsSource) => (symbol: string) => {
        setProductAnalyticsWorkflowSource(source);
        trackProductAnalyticsEvent({
            name: 'review_opened',
            surface: 'research',
            workspace,
            source,
        });
        selectTicker(symbol, true, 'overview', false, 'push');
    };
    const openResearch = openResearchFrom('direct');

    const changeDetailTab = (tab: ResearchTabV6) => {
        setActiveDetailTab(tab);
        setReviewRequested(false);
        if (!selected) return;
        updateUrl({ ticker: selected.symbol, tab: tab === 'overview' ? null : tab, review: null });
    };

    const changeReviewMode = (editing: boolean) => {
        setReviewRequested(editing);
        if (!editing) {
            setStagedEvidence(null);
            setWorkflowTemplateId(null);
        }
        updateUrl({ review: editing ? 'edit' : null });
    };

    const stageThesisChange = (symbol: string, evidence: AcceptedResearchEvidence) => {
        setStagedEvidence(evidence);
        setProductAnalyticsWorkflowSource('inbox');
        trackProductAnalyticsEvent({
            name: 'review_opened',
            surface: 'research',
            workspace: 'changes',
            source: 'inbox',
        });
        selectTicker(symbol, true, 'overview', true, 'push');
    };

    const startWorkflowReview = (symbol: string, templateId: ResearchWorkflowTemplateId) => {
        setWorkflowTemplateId(templateId);
        setStagedEvidence(null);
        setProductAnalyticsWorkflowSource('queue');
        trackProductAnalyticsEvent({
            name: 'review_opened',
            surface: 'research',
            workspace: 'queue',
            source: 'queue',
        });
        selectTicker(symbol, true, 'overview', true, 'push');
    };

    const openCalendarTarget = (targetHref: string) => {
        const target = new URL(targetHref, window.location.origin);
        const symbol = target.searchParams.get('ticker');
        const tab = target.searchParams.get('tab');
        if (!symbol || !isResearchTabV6(tab)) return;
        setProductAnalyticsWorkflowSource('calendar');
        trackProductAnalyticsEvent({
            name: 'review_opened',
            surface: 'research',
            workspace: 'calendar',
            source: 'calendar',
        });
        selectTicker(symbol, true, tab, target.searchParams.get('review') === 'edit', 'push');
    };

    const addDiscoveryCandidate = async (candidate: { readonly symbol: string; readonly name: string }) => {
        if (recordsLoadState !== 'ready') return;
        await addRecord({ symbol: candidate.symbol, market: 'US', companyName: candidate.name });
        setWorkspace('research');
    };

    const readRecordResponse = async (response: Response): Promise<ResearchRecord> => {
        const payload: unknown = await response.json();
        if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new ResearchInputError('Invalid research API response.');
        const body = Object.fromEntries(Object.entries(payload));
        if (!response.ok) throw new ResearchInputError(typeof body.error === 'string' ? body.error : 'Research request failed.');
        return parseResearchRecord(body.data);
    };

    const saveRecord = async (record: ResearchRecord, mode: ResearchUpdateMode = 'review'): Promise<boolean> => {
        if (recordsLoadState !== 'ready') {
            setSaveError('Saved research is still loading. Try again when the watchlist is ready.');
            return false;
        }
        setSaving(true);
        setSaveError(null);
        try {
            let expectedRevision = record.revision;
            if (!records.some((item) => item.symbol === record.symbol)) {
                const created = await readRecordResponse(await fetch('/api/research/watchlist', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbol: record.symbol, market: record.market, companyName: record.companyName }),
                }));
                expectedRevision = created.revision;
            }
            const saved = await readRecordResponse(await fetch('/api/research/watchlist/' + encodeURIComponent(record.symbol), {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...record, revision: expectedRevision, mode }),
            }));
            setRecords((current) => [...current.filter((item) => item.symbol !== saved.symbol), saved]);
            setItems((current) => current.map((item) => item.symbol === saved.symbol ? applyResearchRecordV6(item, saved) : item));
            if (mode === 'review') {
                const source = currentProductAnalyticsWorkflowSource();
                trackProductAnalyticsEvent({
                    name: 'review_saved',
                    surface: 'research',
                    workspace: 'research',
                    source,
                    attributes: { decision: saved.decisionJournal.decision, result: 'success' },
                });
                clearProductAnalyticsWorkflowSource();
            }
            return true;
        } catch (error) {
            if (mode === 'review') {
                trackProductAnalyticsEvent({
                    name: 'review_saved',
                    surface: 'research',
                    workspace: 'research',
                    source: currentProductAnalyticsWorkflowSource(),
                    attributes: { decision: record.decisionJournal.decision, result: 'failure' },
                });
            }
            setSaveError(error instanceof Error ? error.message : 'Unable to save research.');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const addRecord = async (input: ResearchCreateInput) => {
        if (recordsLoadState !== 'ready') {
            setSaveError('Saved research is still loading. Try again when the watchlist is ready.');
            return;
        }
        setAdding(true);
        setSaveError(null);
        try {
            const saved = await readRecordResponse(await fetch('/api/research/watchlist', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
            }));
            setRecords((current) => [...current.filter((item) => item.symbol !== saved.symbol), saved]);
            setItems((current) => current.some((item) => item.symbol === saved.symbol)
                ? current.map((item) => item.symbol === saved.symbol ? applyResearchRecordV6(item, saved) : item)
                : [...current, createWatchlistItemV6(saved, 100 + current.length)]);
            selectTicker(saved.symbol);
        } finally {
            setAdding(false);
        }
    };

    const deleteRecord = async () => {
        if (recordsLoadState !== 'ready') {
            setSaveError('Saved research is still loading. Try again when the watchlist is ready.');
            return;
        }
        if (!selected || !window.confirm(`Remove ${selected.symbol} from saved research?`)) return;
        setSaveError(null);
        try {
            const response = await fetch('/api/research/watchlist/' + encodeURIComponent(selected.symbol), { method: 'DELETE' });
            if (!response.ok) throw new ResearchInputError('Unable to remove saved research.');
            setRecords((current) => current.filter((item) => item.symbol !== selected.symbol));
            const remainingItems = items.filter((item) => item.symbol !== selected.symbol);
            const nextSymbol = resolveVisibleResearchSymbol(filterResearchItems(remainingItems, query, market, action), '');
            setItems(remainingItems);
            setSelectedSymbol(nextSymbol ?? '');
            setActiveDetailTab('overview');
            setReviewRequested(false);
            updateUrl({ ticker: nextSymbol, tab: null, review: null });
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : 'Unable to remove saved research.');
        }
    };

    const applyRestoredRecords = (restored: readonly ResearchRecord[]) => {
        if (recordsLoadState !== 'ready' || restored.length === 0) return;
        setRecords((current) => [...current.filter((record) => !restored.some((item) => item.symbol === record.symbol)), ...restored]);
        setItems((current) => {
            const next = current.map((item) => {
                const restoredRecord = restored.find((record) => record.symbol === item.symbol);
                return restoredRecord ? applyResearchRecordV6(item, restoredRecord) : item;
            });
            const known = new Set(current.map((item) => item.symbol));
            return [...next, ...restored.filter((record) => !known.has(record.symbol)).map((record, index) => createWatchlistItemV6(record, 100 + current.length + index))];
        });
    };

    const workspaceLabels: Readonly<Record<ResearchWorkspaceV6, string>> = {
        research: 'Watchlist', discovery: 'Discovery', picker: 'Picker', compare: 'Compare', calendar: 'Calendar',
        alerts: 'Alerts', changes: 'Changes', filings: 'Filings', evidence: 'Evidence', policy: 'Policy', queue: 'Queue', portfolio: 'Portfolio', currency: 'Currency', relationships: 'Map',
        peers: 'Peers', outcomes: 'Outcomes', replay: 'Replay', health: 'Sources',
        packets: 'Export', backup: 'Backup', usage: 'Usage',
    };
    const researchCommands: readonly AppCommandV6[] = [
        ...Object.entries(workspaceLabels).map(([id, label]) => ({
            id: `workspace-${id}`,
            label: `Open ${label}`,
            group: 'Workspace',
            keywords: ['research', id],
            run: () => changeWorkspace(id as ResearchWorkspaceV6),
        })),
        ...items.map((item) => ({
            id: `ticker-${item.symbol}`,
            label: `Open ${item.symbol} · ${item.name}`,
            group: 'Ticker',
            keywords: [item.symbol, item.name],
            run: () => selectTicker(item.symbol, true, 'overview', false, 'push'),
        })),
        ...savedLayouts.map((layout) => ({
            id: `layout-${layout.id}`,
            label: `Apply saved view · ${layout.name}`,
            group: 'Saved view',
            keywords: [layout.workspace, layout.market, layout.action],
            run: () => applySavedLayout(layout),
        })),
    ];

    const atmosphere = theme === 'light'
        ? 'bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.11),_transparent_28%),radial-gradient(circle_at_80%_10%,_rgba(100,116,139,0.1),_transparent_20%)]'
        : 'bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_24%),radial-gradient(circle_at_80%_10%,_rgba(52,211,153,0.1),_transparent_18%)]';
    const grid = theme === 'light'
        ? 'bg-[linear-gradient(rgba(16,185,129,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.06)_1px,transparent_1px)] opacity-45'
        : 'bg-[linear-gradient(rgba(16,185,129,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.035)_1px,transparent_1px)] opacity-55';

    return (
        <div className={'relative min-h-screen overflow-x-hidden transition-colors duration-300 ' + themeClasses.page}>
            <div className={'pointer-events-none absolute inset-0 transition-opacity duration-300 ' + atmosphere} />
            <div className={'pointer-events-none absolute inset-0 bg-[size:44px_44px] transition-opacity duration-300 ' + grid} />
            <ResearchHeaderV6
                theme={theme}
                query={query}
                market={market}
                action={action}
                reviewedLabel={formatSnapshotLabel(latestReviewedAt)}
                resultCount={filteredItems.length}
                showResearchControls={workspace === 'research'}
                onQueryChange={setQuery}
                onMarketChange={setMarket}
                onActionChange={setAction}
                onThemeToggle={toggleTheme}
                commands={researchCommands}
            />
            <div className="relative z-10 mx-auto w-full max-w-[1280px] px-4 pb-5 pt-4 min-[700px]:px-5">
                <ResearchWorkspaceTabsV6 active={workspace} theme={theme} onChange={changeWorkspace} />
                <ResearchLayoutControlsV6
                    current={{ workspace, query, market, action, ticker: selected?.symbol ?? null, tab: activeDetailTab }}
                    density={density}
                    theme={theme}
                    onApply={applySavedLayout}
                    onDensityChange={setDensity}
                    onLayoutsChange={setSavedLayouts}
                />
                {marketHandoff ? <ResearchMarketContextV6 handoff={marketHandoff} items={items} theme={theme} onOpen={openResearchFrom('market')} /> : null}
                {workspace === 'research' ? <>
                    <h1 className="sr-only">Research workspace</h1>
                    <details data-testid="research-overview" data-surface-tier="utility" className={'group mb-3 rounded-[10px] border ' + themeClasses.panelSolid}>
                        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-[10px] px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 [&::-webkit-details-marker]:hidden">
                            <span>
                                <span className={'block text-sm font-bold ' + themeClasses.textPrimary}>Research overview</span>
                                <span className={'block text-xs ' + themeClasses.textMuted}>
                                    {inboxSummary?.status === 'ready'
                                        ? `${inboxSummary.attentionCount} attention item${inboxSummary.attentionCount === 1 ? '' : 's'} · ${inboxSummary.unreadCount} unread · Position plan`
                                        : inboxSummary?.status === 'error'
                                            ? 'Attention unavailable · Position plan available'
                                            : 'Checking daily attention · Position plan available'}
                                </span>
                            </span>
                            <span aria-hidden="true" className={'text-lg transition-transform group-open:rotate-180 ' + themeClasses.textMuted}>⌄</span>
                        </summary>
                        <div className={'border-t p-3 min-[700px]:p-4 ' + themeClasses.divider}>
                            <ResearchInboxV6 items={items} records={inboxRecords} theme={theme} onOpen={(symbol, tab) => {
                                setProductAnalyticsWorkflowSource('inbox');
                                trackProductAnalyticsEvent({ name: 'review_opened', surface: 'research', workspace: 'research', source: 'inbox' });
                                selectTicker(symbol, false, tab);
                            }} onSave={saveRecord} onSummaryChange={updateInboxSummary} />
                            <PositionPlanOverviewV6 records={records} items={items} theme={theme} />
                        </div>
                    </details>
                </> : null}
                <main id={`research-workspace-${workspace}`} data-surface-tier="primary" data-density={density} className={'flex flex-col rounded-[10px] border backdrop-blur min-[700px]:flex-row ' + (density === 'compact' ? 'gap-2 p-2 min-[700px]:p-3 ' : 'gap-4 p-3 min-[700px]:p-4 ') + themeClasses.panelPrimary}>
                    {workspace === 'alerts' ? (
                        <ResearchAlertsV6 items={items} records={records} theme={theme} onOpen={openResearchFrom('alerts')} />
                    ) : workspace === 'changes' ? (
                        <ThesisChangeInboxV6 records={inboxRecords} theme={theme} onStage={stageThesisChange} />
                    ) : workspace === 'filings' ? (
                        <EvidenceDocumentDiffV6 records={inboxRecords} theme={theme} onOpen={openResearchFrom('filings')} />
                    ) : workspace === 'evidence' ? (
                        <EvidenceCoverageDashboardV6 records={inboxRecords} theme={theme} onOpen={openResearchFrom('evidence')} />
                    ) : workspace === 'policy' ? (
                        <InvestmentPolicyGuardrailsV6 records={inboxRecords} items={items} theme={theme} onOpen={openResearchFrom('policy')} />
                    ) : workspace === 'queue' ? (
                        <ResearchWorkflowQueueV6 records={inboxRecords} theme={theme} onStart={startWorkflowReview} />
                    ) : workspace === 'usage' ? (
                        <ProductAnalyticsDashboardV6 theme={theme} />
                    ) : workspace === 'backup' ? (
                        <EncryptedResearchBackupV6 records={records} recordsLoadState={recordsLoadState} theme={theme} onRestored={applyRestoredRecords} />
                    ) : workspace === 'packets' ? (
                        <ResearchDecisionPacketV6 records={records} recordsLoadState={recordsLoadState} theme={theme} />
                    ) : workspace === 'replay' ? (
                        <HistoricalDecisionReplayV6 theme={theme} />
                    ) : workspace === 'health' ? (
                        <SourceHealthDashboardV6 theme={theme} />
                    ) : workspace === 'peers' ? (
                        <ResearchPeerBenchmarkV6 items={items} theme={theme} onOpen={openResearchFrom('peers')} />
                    ) : workspace === 'portfolio' ? (
                        <PortfolioRiskCockpitV6 records={inboxRecords} items={items} theme={theme} onOpen={openResearchFrom('portfolio')} />
                    ) : workspace === 'currency' ? (
                        <CurrencyPerformanceV6 records={inboxRecords} items={items} theme={theme} onOpen={openResearchFrom('currency')} />
                    ) : workspace === 'relationships' ? (
                        <ResearchRelationshipGraphV6 records={inboxRecords} items={items} theme={theme} onOpen={openResearchFrom('relationships')} />
                    ) : workspace === 'outcomes' ? (
                        <ResearchOutcomeAnalyticsV6 records={inboxRecords} theme={theme} onOpen={openResearchFrom('outcomes')} />
                    ) : workspace === 'calendar' ? (
                        <ResearchCalendarV6 records={inboxRecords} theme={theme} onOpen={openCalendarTarget} />
                    ) : workspace === 'compare' ? (
                        <ResearchComparisonV6 items={items} theme={theme} onOpen={openResearch} />
                    ) : workspace === 'discovery' ? (
                        <TrendDiscoveryV6 theme={theme} savedSymbols={items.map((item) => item.symbol)} adding={adding || recordsLoadState !== 'ready'} onAdd={addDiscoveryCandidate} onOpen={openResearch} />
                    ) : workspace === 'picker' ? (
                        <ResearchPickerV6 theme={theme} savedSymbols={items.map((item) => item.symbol)} adding={adding || recordsLoadState !== 'ready'} onAdd={addDiscoveryCandidate} onOpen={openResearchFrom('picker')} />
                    ) : (<>
                    <ResearchWatchlistV6
                        items={filteredItems}
                        selectedSymbol={selected?.symbol ?? ''}
                        theme={theme}
                        onSelect={selectTicker}
                        onAdd={addRecord}
                        adding={adding || recordsLoadState !== 'ready'}
                    />
                    {selected && selectedRecord ? (
                        <ResearchDetailV6 key={selected.symbol + (stagedEvidence?.id ?? '') + (workflowTemplateId ?? '')} ticker={selected} theme={theme} record={selectedRecord} liveQuote={liveQuotes.current.get(selected.symbol) ?? null} activeTab={activeDetailTab} startReview={reviewRequested} stagedEvidence={stagedEvidence?.id.startsWith(selected.symbol + ':') ? stagedEvidence : null} workflowTemplateId={workflowTemplateId} saving={saving || recordsLoadState !== 'ready'} saveError={saveError} onTabChange={changeDetailTab} onSave={saveRecord} onReviewChange={changeReviewMode} onSnapshot={updateLiveSnapshot} onDelete={deleteRecord} />
                    ) : (
                        <section className="flex min-h-72 flex-1 items-center justify-center px-6 text-center">
                            <div>
                                <h2 className={'text-lg font-bold ' + themeClasses.textPrimary}>No research matches</h2>
                                <p className={'mt-2 text-sm ' + themeClasses.textMuted}>Adjust the ticker, market, or decision filter.</p>
                            </div>
                        </section>
                    )}
                    </>)}
                </main>
            </div>
        </div>
    );
};
