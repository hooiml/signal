'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { watchlist } from '@/components/research/ResearchDashboardV2';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import { parseResearchRecord, ResearchInputError } from '@/lib/research/input';
import { parseResearchQuoteBatchResponse } from '@/lib/research/snapshot-input';
import type { AcceptedResearchEvidence, ResearchCreateInput, ResearchRecord, ResearchUpdateMode } from '@/lib/types/research';
import { ResearchDetailV6 } from './ResearchDetailV6';
import {
    ResearchHeaderV6,
    type ResearchActionFilterV6,
    type ResearchMarketFilterV6,
} from './ResearchHeaderV6';
import { ResearchWatchlistV6 } from './ResearchWatchlistV6';
import { ResearchInboxV6, type ResearchInboxSummaryV6 } from './ResearchInboxV6';
import { isResearchWorkspaceV6, ResearchWorkspaceTabsV6, type ResearchWorkspaceV6 } from './ResearchWorkspaceTabsV6';
import type { ResearchReadinessDestination } from '@/lib/research/readiness';
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
import { ResearchLayoutControlsV6 } from './ResearchLayoutControlsV6';
import { ResearchWorkspaceBoundaryV6 } from './ResearchWorkspaceBoundaryV6';
import type { AppCommandV6, AppLocalSearchV6 } from './CommandPaletteV6';
import type { ResearchLayoutDensity, SavedResearchLayout } from '@/lib/research/saved-layouts';
import type { ResearchWorkflowTemplateId } from '@/lib/research/workflow-queue';
import {
    buildLocalResearchSearchIndex,
    type LocalResearchSearchResult,
} from '@/lib/research/local-search';
import {
    readResearchWorkflowTaskState,
    RESEARCH_WORKFLOW_QUEUE_CHANGE_EVENT,
    RESEARCH_WORKFLOW_QUEUE_STORAGE_KEY,
    type ResearchWorkflowTaskReadResult,
} from '@/lib/research/workflow-queue-client';
import {
    buildResearchRelativeUrl,
    mergeResearchSearchParams,
    parseResearchUrlDecision,
    parseResearchUrlDensity,
    parseResearchUrlMarket,
    parseResearchUrlQuery,
    resolveVisibleResearchSymbol,
    type ResearchUrlChanges,
} from '@/lib/research/url-state';
import {
    clearProductAnalyticsWorkflowSource,
    currentProductAnalyticsWorkflowSource,
    setProductAnalyticsWorkflowSource,
    trackProductAnalyticsEvent,
} from '@/lib/product-analytics-client';
import type { ProductAnalyticsSource } from '@/lib/types/product-analytics';
import { SinceLastVisitBriefingV6 } from './SinceLastVisitBriefingV6';
import { createTodayResearchContinuation } from '@/lib/research/since-last-visit';
import { writeTodayContinuation } from '@/lib/research/since-last-visit-client';
import { FirstRunSetupV6 } from './FirstRunSetupV6';
import { researchWorkspaceGroups } from '@/lib/research/workspace-navigation';
import { V7Shell } from '@/components/v7/foundation/V7Foundation';
import { ResearchControlsV7 } from '@/components/v7/ResearchControlsV7';
import liveStyles from '@/components/v7/v7-live.module.css';

const workspaceLoading = (label: string) => function ResearchWorkspaceLoadingV6() {
    return (
        <section role="status" className="grid min-h-72 flex-1 content-start gap-4 px-3 py-5" aria-label={`Loading ${label}`}>
            <div className="h-7 w-44 motion-safe:animate-pulse rounded bg-emerald-400/20" />
            <div className="h-14 w-full motion-safe:animate-pulse rounded bg-emerald-400/15" />
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="h-40 motion-safe:animate-pulse rounded bg-emerald-400/10" />
                <div className="h-40 motion-safe:animate-pulse rounded bg-emerald-400/10" />
            </div>
            <span className="sr-only">Loading {label}…</span>
        </section>
    );
};

const TrendDiscoveryV6 = dynamic(
    () => import('./TrendDiscoveryV6').then((module) => module.TrendDiscoveryV6),
    { loading: workspaceLoading('Discovery'), ssr: false },
);
const ResearchPickerV6 = dynamic(
    () => import('./ResearchPickerV6').then((module) => module.ResearchPickerV6),
    { loading: workspaceLoading('Picker'), ssr: false },
);
const ResearchAlertsV6 = dynamic(
    () => import('./ResearchAlertsV6').then((module) => module.ResearchAlertsV6),
    { loading: workspaceLoading('Alerts'), ssr: false },
);
const ResearchComparisonV6 = dynamic(
    () => import('./ResearchComparisonV6').then((module) => module.ResearchComparisonV6),
    { loading: workspaceLoading('Comparison'), ssr: false },
);
const ResearchCalendarV6 = dynamic(
    () => import('./ResearchCalendarV6').then((module) => module.ResearchCalendarV6),
    { loading: workspaceLoading('Calendar'), ssr: false },
);
const ResearchOutcomeAnalyticsV6 = dynamic(
    () => import('./ResearchOutcomeAnalyticsV6').then((module) => module.ResearchOutcomeAnalyticsV6),
    { loading: workspaceLoading('Outcomes'), ssr: false },
);
const PortfolioRiskCockpitV6 = dynamic(
    () => import('./PortfolioRiskCockpitV6').then((module) => module.PortfolioRiskCockpitV6),
    { loading: workspaceLoading('Portfolio'), ssr: false },
);
const ResearchPeerBenchmarkV6 = dynamic(
    () => import('./ResearchPeerBenchmarkV6').then((module) => module.ResearchPeerBenchmarkV6),
    { loading: workspaceLoading('Peers'), ssr: false },
);
const SourceHealthDashboardV6 = dynamic(
    () => import('./SourceHealthDashboardV6').then((module) => module.SourceHealthDashboardV6),
    { loading: workspaceLoading('Sources'), ssr: false },
);
const EvidenceCoverageDashboardV6 = dynamic(
    () => import('./EvidenceCoverageDashboardV6').then((module) => module.EvidenceCoverageDashboardV6),
    { loading: workspaceLoading('Evidence'), ssr: false },
);
const InvestmentPolicyGuardrailsV6 = dynamic(
    () => import('./InvestmentPolicyGuardrailsV6').then((module) => module.InvestmentPolicyGuardrailsV6),
    { loading: workspaceLoading('Policy'), ssr: false },
);
const CurrencyPerformanceV6 = dynamic(
    () => import('./CurrencyPerformanceV6').then((module) => module.CurrencyPerformanceV6),
    { loading: workspaceLoading('Currency'), ssr: false },
);
const EvidenceDocumentDiffV6 = dynamic(
    () => import('./EvidenceDocumentDiffV6').then((module) => module.EvidenceDocumentDiffV6),
    { loading: workspaceLoading('Filings'), ssr: false },
);
const ResearchRelationshipGraphV6 = dynamic(
    () => import('./ResearchRelationshipGraphV6').then((module) => module.ResearchRelationshipGraphV6),
    { loading: workspaceLoading('Map'), ssr: false },
);
const HistoricalDecisionReplayV6 = dynamic(
    () => import('./HistoricalDecisionReplayV6').then((module) => module.HistoricalDecisionReplayV6),
    { loading: workspaceLoading('Replay'), ssr: false },
);
const ResearchDecisionPacketV6 = dynamic(
    () => import('./ResearchDecisionPacketV6').then((module) => module.ResearchDecisionPacketV6),
    { loading: workspaceLoading('Export'), ssr: false },
);
const ProductAnalyticsDashboardV6 = dynamic(
    () => import('./ProductAnalyticsDashboardV6').then((module) => module.ProductAnalyticsDashboardV6),
    { loading: workspaceLoading('Usage'), ssr: false },
);
const ThesisChangeInboxV6 = dynamic(
    () => import('./ThesisChangeInboxV6').then((module) => module.ThesisChangeInboxV6),
    { loading: workspaceLoading('Changes'), ssr: false },
);
const ResearchWorkflowQueueV6 = dynamic(
    () => import('./ResearchWorkflowQueueV6').then((module) => module.ResearchWorkflowQueueV6),
    { loading: workspaceLoading('Queue'), ssr: false },
);
const ResearchTodayV6 = dynamic(
    () => import('./ResearchTodayV6').then((module) => module.ResearchTodayV6),
    { loading: workspaceLoading('Today'), ssr: false },
);
const EncryptedResearchBackupV6 = dynamic(
    () => import('./EncryptedResearchBackupV6').then((module) => module.EncryptedResearchBackupV6),
    { loading: workspaceLoading('Backup'), ssr: false },
);

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

export const ResearchDashboardV6 = ({ presentation = 'v6' }: { readonly presentation?: 'v6' | 'v7' }) => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const requestedTicker = searchParams.get('ticker')?.trim().toUpperCase();
    const searchString = searchParams.toString();
    const validRequestedTicker = Boolean(requestedTicker && /^[A-Z0-9.-]{1,20}$/.test(requestedTicker));
    const requestedSymbol = validRequestedTicker && requestedTicker ? requestedTicker : 'MSFT';
    const requestedWorkspace = searchParams.get('workspace');
    const requestedDetailTab = searchParams.get('tab');
    const requestedReview = searchParams.get('review');
    const requestedQuery = parseResearchUrlQuery(searchParams.get('query'));
    const requestedMarket = parseResearchUrlMarket(searchParams.get('market'));
    const requestedAction = parseResearchUrlDecision(searchParams.get('decision'));
    const requestedDensity = parseResearchUrlDensity(searchParams.get('density'));
    const requestedSetup = searchParams.get('setup') === '1';
    const rawRequestedQueueTask = searchParams.get('queueTask');
    const requestedQueueTask = rawRequestedQueueTask && /^[a-f0-9-]{36}$/i.test(rawRequestedQueueTask)
        ? rawRequestedQueueTask
        : null;
    const returnsToToday = searchParams.get('returnTo') === 'today';
    const marketHandoff = useMemo(() => parseMarketResearchHandoff(searchParams), [searchParams]);
    const initialSymbol = requestedSymbol;
    const initialTab: ResearchTabV6 = isResearchTabV6(requestedDetailTab) ? requestedDetailTab : 'overview';
    const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol);
    const [activeDetailTab, setActiveDetailTab] = useState<ResearchTabV6>(initialTab);
    const { theme, toggleTheme } = useThemeV6();
    const [query, setQuery] = useState(requestedQuery);
    const [market, setMarket] = useState<ResearchMarketFilterV6>(requestedMarket);
    const [action, setAction] = useState<ResearchActionFilterV6>(requestedAction);
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
    const [density, setDensity] = useState<ResearchLayoutDensity>(requestedDensity ?? 'comfortable');
    const [quoteStatus, setQuoteStatus] = useState<string | null>(null);
    const [savedLayouts, setSavedLayouts] = useState<readonly SavedResearchLayout[]>([]);
    const [queueSearchState, setQueueSearchState] = useState<ResearchWorkflowTaskReadResult | null>(null);
    const [watchlistAddRequest, setWatchlistAddRequest] = useState(0);
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

    const changeQuery = useCallback((nextQuery: string) => {
        const parsed = parseResearchUrlQuery(nextQuery);
        setQuery(parsed);
        updateUrl({ query: parsed || null });
    }, [updateUrl]);

    const changeMarketFilter = useCallback((nextMarket: ResearchMarketFilterV6) => {
        setMarket(nextMarket);
        updateUrl({ market: nextMarket === 'ALL' ? null : nextMarket });
    }, [updateUrl]);

    const changeActionFilter = useCallback((nextAction: ResearchActionFilterV6) => {
        setAction(nextAction);
        updateUrl({ decision: nextAction === 'ALL' ? null : nextAction });
    }, [updateUrl]);

    const changeDensity = useCallback((nextDensity: ResearchLayoutDensity) => {
        setDensity(nextDensity);
        updateUrl({ density: nextDensity });
    }, [updateUrl]);

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
        setQuery((current) => current === requestedQuery ? current : requestedQuery);
    }, [requestedQuery]);

    useEffect(() => {
        setMarket((current) => current === requestedMarket ? current : requestedMarket);
    }, [requestedMarket]);

    useEffect(() => {
        setAction((current) => current === requestedAction ? current : requestedAction);
    }, [requestedAction]);

    useEffect(() => {
        if (requestedDensity) setDensity((current) => current === requestedDensity ? current : requestedDensity);
    }, [requestedDensity]);

    useEffect(() => {
        trackProductAnalyticsEvent({
            name: 'workspace_viewed',
            surface: 'research',
            workspace,
        });
        if (workspace !== 'today' && currentProductAnalyticsWorkflowSource() === 'today') {
            trackProductAnalyticsEvent({
                name: 'workflow_source_opened',
                surface: 'research',
                workspace,
                source: 'today',
            });
        }
    }, [workspace]);

    useEffect(() => {
        if (!returnsToToday || workspace === 'today') return;
        writeTodayContinuation(createTodayResearchContinuation({
            workspace,
            symbol: validRequestedTicker && requestedTicker ? requestedTicker : null,
            tab: activeDetailTab,
            review: reviewRequested,
            updatedAt: new Date().toISOString(),
        }));
    }, [activeDetailTab, requestedTicker, returnsToToday, reviewRequested, validRequestedTicker, workspace]);

    const changeWorkspace = (nextWorkspace: ResearchWorkspaceV6) => {
        setWorkspace(nextWorkspace);
        updateUrl({ workspace: nextWorkspace, queueTask: null }, 'push');
    };

    const openReadinessDestination = (destination: ResearchReadinessDestination) => {
        if (destination === 'review' || destination === 'valuation') {
            const tab = destination === 'valuation' ? 'valuation' : 'overview';
            setWorkspace('research');
            setActiveDetailTab(tab);
            setReviewRequested(destination === 'review');
            updateUrl({ workspace: 'research', ticker: selectedSymbol, tab, review: destination === 'review' ? 'edit' : null }, 'push');
            return;
        }
        changeWorkspace(destination);
    };

    const filteredItems = useMemo(() => filterResearchItems(items, query, market, action), [action, items, market, query]);

    useEffect(() => {
        if (urlSearchRef.current !== searchString) return;
        const nextSymbol = resolveVisibleResearchSymbol(items, requestedSymbol);
        setSelectedSymbol((current) => current === (nextSymbol ?? '') ? current : nextSymbol ?? '');
        if (nextSymbol === requestedSymbol && (validRequestedTicker || !requestedTicker)) return;
        if (nextSymbol) updateUrl({ ticker: nextSymbol });
        else updateUrl({ ticker: null, tab: null, review: null });
    }, [items, requestedSymbol, requestedTicker, searchString, updateUrl, validRequestedTicker]);

    const selected = useMemo(
        () => items.find((item) => item.symbol === selectedSymbol) ?? null,
        [items, selectedSymbol],
    );
    const selectedHidden = Boolean(selected && !filteredItems.some((item) => item.symbol === selected.symbol));
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
        liveQuotes.current.set(symbol, snapshot.quote);
        setItems((current) => current.map((item) => {
            if (item.symbol !== symbol) return item;
            return applyResearchSnapshotV6(item, snapshot);
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
        const refresh = () => setQueueSearchState(readResearchWorkflowTaskState());
        const refreshFromStorage = (event: StorageEvent) => {
            if (event.key === RESEARCH_WORKFLOW_QUEUE_STORAGE_KEY) refresh();
        };
        refresh();
        window.addEventListener(RESEARCH_WORKFLOW_QUEUE_CHANGE_EVENT, refresh);
        window.addEventListener('storage', refreshFromStorage);
        return () => {
            window.removeEventListener(RESEARCH_WORKFLOW_QUEUE_CHANGE_EVENT, refresh);
            window.removeEventListener('storage', refreshFromStorage);
        };
    }, []);

    useEffect(() => {
        quoteItems.current = items;
    }, [items]);

    useEffect(() => {
        if (recordsLoadState !== 'ready') return;
        const itemsToQuote = quoteItems.current.filter((item) =>
            item.symbol !== selectedSymbol && !liveQuotes.current.has(item.symbol));
        if (itemsToQuote.length === 0) {
            setQuoteStatus(null);
            return;
        }
        setQuoteStatus(null);
        const controller = new AbortController();
        const loadQuotes = async () => {
            try {
                const response = await fetch('/api/research/quotes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(itemsToQuote.map((item) => ({ symbol: item.symbol, market: item.market }))),
                    signal: controller.signal,
                });
                const payload: unknown = await response.json();
                if (!response.ok) throw new ResearchInputError('Live quotes unavailable.');
                const results = parseResearchQuoteBatchResponse(payload);
                if (controller.signal.aborted) return;
                const quotes = new Map<string, ResearchSnapshot['quote']>();
                const failedSymbols: string[] = [];
                for (const result of results) {
                    if (result.success) {
                        quotes.set(result.data.symbol, result.data.quote);
                        liveQuotes.current.set(result.data.symbol, result.data.quote);
                    } else failedSymbols.push(result.symbol);
                }
                if (failedSymbols.length > 0) setQuoteStatus(`Live quotes are unavailable for ${failedSymbols.join(', ')}. Saved research remains visible.`);
                if (quotes.size === 0) return;
                setItems((current) => current.map((item) => {
                    const quote = quotes.get(item.symbol);
                    return quote ? applyResearchQuoteV6(item, quote) : item;
                }));
            } catch {
                if (controller.signal.aborted) return;
                setQuoteStatus('Live watchlist quotes are unavailable. Saved research remains visible.');
            }
        };
        void loadQuotes();
        return () => controller.abort();
    }, [quoteTargetKey, recordsLoadState, selectedSymbol]);

    const selectTicker = (symbol: string, focusDetail = false, tab: ResearchTabV6 = 'overview', startReview = false, historyMode: 'push' | 'replace' = 'push') => {
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
            queueTask: null,
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
            query: layout.query || null,
            market: layout.market === 'ALL' ? null : layout.market,
            decision: layout.action === 'ALL' ? null : layout.action,
            density: layout.density,
            ticker: layout.ticker,
            tab: layout.tab === 'overview' ? null : layout.tab,
            review: null,
            queueTask: null,
        }, 'push');
    };

    const clearFilters = useCallback(() => {
        setQuery('');
        setMarket('ALL');
        setAction('ALL');
        updateUrl({ query: null, market: null, decision: null });
    }, [updateUrl]);

    const showSelectedSecurity = useCallback(() => {
        if (!selected) return;
        setQuery(selected.symbol);
        setMarket(selected.market);
        setAction('ALL');
        updateUrl({ query: selected.symbol, market: selected.market, decision: null });
    }, [selected, updateUrl]);

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

    const openLocalSearchResult = (result: LocalResearchSearchResult) => {
        const destination = result.destination;
        if (destination.workspace === 'research') {
            selectTicker(destination.symbol, true, destination.tab, false, 'push');
            return;
        }
        setQuery('');
        setMarket('ALL');
        setAction('ALL');
        setWorkspace(destination.workspace);
        setSelectedSymbol(destination.symbol);
        setReviewRequested(false);
        updateUrl({
            workspace: destination.workspace,
            ticker: destination.symbol,
            tab: null,
            review: null,
            queueTask: destination.workspace === 'queue' ? destination.taskId : null,
        }, 'push');
    };

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
            const nextSymbol = resolveVisibleResearchSymbol(remainingItems, '');
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
        research: 'Watchlist', today: 'Today', discovery: 'Discovery', picker: 'Picker', compare: 'Compare', calendar: 'Calendar',
        alerts: 'Alerts', changes: 'Changes', filings: 'Filings', evidence: 'Evidence', policy: 'Policy', queue: 'Queue', portfolio: 'Portfolio', currency: 'Currency', relationships: 'Map',
        peers: 'Peers', outcomes: 'Outcomes', replay: 'Replay', health: 'Sources',
        packets: 'Export', backup: 'Backup', usage: 'Usage',
    };
    const researchCommands: readonly AppCommandV6[] = [
        {
            id: 'first-run-setup',
            label: 'Open setup and demo',
            group: 'Setup',
            keywords: ['first run onboarding restart'],
            run: () => updateUrl({ setup: '1' }, 'push'),
        },
        {
            id: 'guided-demo',
            label: 'Open read-only guided demo',
            group: 'Setup',
            keywords: ['example market research portfolio'],
            run: () => router.push('/demo'),
        },
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
    const localSearchEntries = useMemo(
        () => buildLocalResearchSearchIndex(
            recordsLoadState === 'ready' ? records : [],
            queueSearchState?.status === 'ready' ? queueSearchState.tasks : [],
        ),
        [queueSearchState, records, recordsLoadState],
    );
    const localSearch: AppLocalSearchV6 = {
        status: recordsLoadState === 'ready' && queueSearchState?.status === 'ready'
            ? 'ready'
            : recordsLoadState === 'error' && queueSearchState?.status === 'unavailable'
                ? 'error'
                : recordsLoadState === 'loading' || queueSearchState === null
                    ? 'loading'
                    : 'degraded',
        entries: localSearchEntries,
        message: recordsLoadState === 'loading'
            ? 'Saved research is still loading. Valid local Queue matches remain available.'
            : recordsLoadState === 'error' && queueSearchState?.status === 'unavailable'
                ? 'Saved research and local Queue storage are unavailable. Command navigation remains usable.'
                : recordsLoadState === 'error'
                    ? 'Saved research is unavailable. Valid local Queue matches remain searchable.'
                    : queueSearchState === null
                        ? 'Local Queue state is still loading. Saved research matches remain available.'
                        : queueSearchState.status === 'unavailable'
                            ? 'Local Queue storage is unavailable. Saved research matches remain searchable.'
                            : null,
        onSelect: openLocalSearchResult,
    };
    const activeFilterLabels = [
        query ? `query “${query}”` : null,
        market !== 'ALL' ? `market ${market}` : null,
        action !== 'ALL' ? `decision ${action}` : null,
    ].filter((value): value is string => Boolean(value));
    const filterSummary = activeFilterLabels.length > 0
        ? `Active filters: ${activeFilterLabels.join(' · ')}.${selectedHidden && selected ? ` ${selected.symbol} remains open.` : ''}`
        : 'No active watchlist filters.';
    const watchlistOwner = (
        <ResearchWatchlistV6
            key={`research-watchlist-${watchlistAddRequest}`}
            items={filteredItems}
            selectedSymbol={selected?.symbol ?? ''}
            theme={theme}
            onSelect={selectTicker}
            onAdd={addRecord}
            adding={adding || recordsLoadState !== 'ready'}
            initiallyOpen={watchlistAddRequest > 0}
            presentation={presentation}
            selectedHidden={selectedHidden}
            filterSummary={filterSummary}
            quoteStatus={quoteStatus}
            onShowSelected={showSelectedSecurity}
            onClearFilters={clearFilters}
        />
    );

    const atmosphere = theme === 'light'
        ? 'bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.11),_transparent_28%),radial-gradient(circle_at_80%_10%,_rgba(100,116,139,0.1),_transparent_20%)]'
        : 'bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_24%),radial-gradient(circle_at_80%_10%,_rgba(52,211,153,0.1),_transparent_18%)]';
    const grid = theme === 'light'
        ? 'bg-[linear-gradient(rgba(16,185,129,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.06)_1px,transparent_1px)] opacity-45'
        : 'bg-[linear-gradient(rgba(16,185,129,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.035)_1px,transparent_1px)] opacity-55';

    const dashboardBody = (
        <>
            <div className="relative z-10">
                <FirstRunSetupV6
                    records={records}
                    recordsReady={recordsLoadState === 'ready'}
                    queueReady={queueSearchState !== null}
                    queueTaskCount={queueSearchState?.tasks.length ?? 0}
                    theme={theme}
                    forceOpen={requestedSetup}
                    onStartAdd={() => {
                        setWorkspace('research');
                        setWatchlistAddRequest((current) => current + 1);
                        updateUrl({ workspace: 'research', setup: '1', queueTask: null }, 'push');
                    }}
                    onOpenWorkspace={(nextWorkspace) => {
                        setWorkspace(nextWorkspace);
                        updateUrl({ workspace: nextWorkspace, setup: '1', queueTask: null }, 'push');
                    }}
                    onOpenReview={(symbol) => selectTicker(symbol, true, 'overview', true, 'push')}
                    onCloseRequested={() => updateUrl({ setup: null })}
                />
            </div>
            <div className={'relative z-10 mx-auto w-full max-w-[1280px] px-4 pb-5 pt-4 min-[700px]:px-5 ' + (presentation === 'v7' ? liveStyles.researchContentV7 : '')}>
                <ResearchWorkspaceTabsV6 active={workspace} theme={theme} onChange={changeWorkspace} />
                <ResearchLayoutControlsV6
                    current={{ workspace, query, market, action, ticker: selected?.symbol ?? null, tab: activeDetailTab }}
                    density={density}
                    theme={theme}
                    onApply={applySavedLayout}
                    onDensityChange={changeDensity}
                    onLayoutsChange={setSavedLayouts}
                    restoreDensityFromStorage={requestedDensity === null}
                />
                {returnsToToday && workspace !== 'today' ? (
                    <section data-testid="today-return-context" className={'mb-3 flex flex-col gap-3 rounded-[10px] border p-3 sm:flex-row sm:items-center sm:justify-between ' + themeClasses.panelUtility}>
                        <div>
                            <p className={'text-xs font-bold uppercase tracking-[0.1em] ' + themeClasses.positive}>Opened from Today</p>
                            <p className={'mt-1 text-sm ' + themeClasses.textSecondary}>This workspace still owns its data and actions. Return without changing or acknowledging anything automatically.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setWorkspace('today');
                                updateUrl({ workspace: 'today', returnTo: null, tab: null, review: null }, 'push');
                            }}
                            className={'min-h-10 shrink-0 rounded border px-4 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ' + themeClasses.selectedRow}
                        >
                            Back to Today
                        </button>
                    </section>
                ) : null}
                {marketHandoff ? <ResearchMarketContextV6 handoff={marketHandoff} items={items} theme={theme} onOpen={openResearchFrom('market')} /> : null}
                {workspace === 'research' ? <div className={presentation === 'v7' ? liveStyles.researchUtilitiesV7 : undefined}>
                    <h1 className="sr-only">Research workspace</h1>
                    {recordsLoadState === 'ready' ? (
                        <SinceLastVisitBriefingV6
                            records={inboxRecords}
                            items={items}
                            inboxSummary={inboxSummary}
                            theme={theme}
                            onOpenAction={(briefingAction) => {
                                if (briefingAction.kind === 'market') {
                                    router.push('/');
                                    return;
                                }
                                changeWorkspace(briefingAction.workspace);
                            }}
                        />
                    ) : null}
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
                            }} onSave={saveRecord} saveError={saveError} onSummaryChange={updateInboxSummary} />
                            <PositionPlanOverviewV6 records={records} items={items} theme={theme} />
                        </div>
                    </details>
                </div> : null}
                <main id={`research-workspace-${workspace}`} data-surface-tier="primary" data-density={density} className={'flex flex-col rounded-[10px] border backdrop-blur min-[700px]:flex-row ' + (presentation === 'v7' ? liveStyles.researchWorkspaceV7 + ' ' : '') + (density === 'compact' ? 'gap-2 p-2 min-[700px]:p-3 ' : 'gap-4 p-3 min-[700px]:p-4 ') + themeClasses.panelPrimary}>
                    <ResearchWorkspaceBoundaryV6 workspace={workspace}>
                    {workspace === 'today' ? recordsLoadState === 'loading' ? (
                        <section role="status" className="flex min-h-72 flex-1 items-center justify-center px-6 text-center">
                            <p className={'text-sm font-semibold ' + themeClasses.textMuted}>Loading Today…</p>
                        </section>
                    ) : (
                        <div className="min-w-0 flex-1">
                            {recordsLoadState === 'error' ? (
                                <div role="alert" className={'mb-3 rounded-lg border p-4 ' + themeClasses.panelUtility}>
                                    <p className={'text-sm font-semibold ' + themeClasses.risk}>Saved research is unavailable. Today will keep Calendar-dependent research state unavailable while checking Alerts, Queue, Sources, and local planning independently.</p>
                                </div>
                            ) : null}
                            <ResearchTodayV6
                                records={recordsLoadState === 'ready' ? inboxRecords : []}
                                items={items}
                                inboxSummary={inboxSummary}
                                theme={theme}
                                onOpenAction={(briefingAction) => {
                                    setProductAnalyticsWorkflowSource('today');
                                    trackProductAnalyticsEvent({
                                        name: 'workflow_opened',
                                        surface: 'research',
                                        workspace: 'today',
                                        source: 'today',
                                    });
                                    if (briefingAction.href) {
                                        router.push(briefingAction.href, { scroll: false });
                                        return;
                                    }
                                    if (briefingAction.kind === 'market') {
                                        router.push('/?returnTo=today', { scroll: false });
                                        return;
                                    }
                                    updateUrl({
                                        workspace: briefingAction.workspace,
                                        ticker: briefingAction.symbol,
                                        tab: null,
                                        review: null,
                                        returnTo: 'today',
                                    }, 'push');
                                }}
                            />
                        </div>
                    ) : workspace === 'alerts' ? (
                        <ResearchAlertsV6 items={items} records={records} theme={theme} onOpen={openResearchFrom('alerts')} />
                    ) : workspace === 'changes' ? (
                        <ThesisChangeInboxV6 records={inboxRecords} theme={theme} onStage={stageThesisChange} />
                    ) : workspace === 'filings' ? (
                        <EvidenceDocumentDiffV6 key={selectedSymbol} records={inboxRecords} initialSymbol={selectedSymbol} theme={theme} saving={saving} saveError={saveError} onSave={saveRecord} onOpen={openResearchFrom('filings')} />
                    ) : workspace === 'evidence' ? (
                        <EvidenceCoverageDashboardV6 records={inboxRecords} initialSymbol={selectedSymbol} theme={theme} onOpen={openResearchFrom('evidence')} />
                    ) : workspace === 'policy' ? (
                        <InvestmentPolicyGuardrailsV6 records={inboxRecords} items={items} initialSymbol={selectedSymbol} theme={theme} onOpen={openResearchFrom('policy')} />
                    ) : workspace === 'queue' ? (
                        <ResearchWorkflowQueueV6
                            records={inboxRecords}
                            selectedTaskId={requestedQueueTask}
                            theme={theme}
                            onStart={startWorkflowReview}
                            onOpenSource={(destination) => {
                                if (destination.kind === 'market') {
                                    router.push(destination.pathname);
                                    return;
                                }
                                changeWorkspace(destination.workspace);
                            }}
                        />
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
                        <PortfolioRiskCockpitV6 records={inboxRecords} items={items} theme={theme} saving={saving} saveError={saveError} onSave={saveRecord} onOpen={openResearchFrom('portfolio')} />
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
                    {presentation === 'v6' ? watchlistOwner : null}
                    {selected && selectedRecord ? (
                        <ResearchDetailV6 key={selected.symbol + (stagedEvidence?.id ?? '') + (workflowTemplateId ?? '')} ticker={selected} records={inboxRecords} items={items} theme={theme} record={selectedRecord} liveQuote={liveQuotes.current.get(selected.symbol) ?? null} activeTab={activeDetailTab} startReview={reviewRequested} stagedEvidence={stagedEvidence?.id.startsWith(selected.symbol + ':') ? stagedEvidence : null} workflowTemplateId={workflowTemplateId} saving={saving || recordsLoadState !== 'ready'} saveError={saveError} onTabChange={changeDetailTab} onReadinessNavigate={openReadinessDestination} onSave={saveRecord} onReviewChange={changeReviewMode} onSnapshot={updateLiveSnapshot} onDelete={deleteRecord} watchlistSlot={presentation === 'v7' ? watchlistOwner : undefined} presentation={presentation} />
                    ) : (
                        <section className="flex min-h-72 flex-1 items-center justify-center px-6 text-center">
                            <div>
                                <h2 className={'text-lg font-bold ' + themeClasses.textPrimary}>No research matches</h2>
                                <p className={'mt-2 text-sm ' + themeClasses.textMuted}>Add a saved security to begin Research.</p>
                            </div>
                        </section>
                    )}
                    </>)}
                    </ResearchWorkspaceBoundaryV6>
                </main>
            </div>
        </>
    );

    if (presentation === 'v7') {
        return (
            <V7Shell
                active="research"
                commands={researchCommands}
                localSearch={localSearch}
                controls={
                    <ResearchControlsV7
                        query={query}
                        market={market}
                        action={action}
                        reviewedLabel={formatSnapshotLabel(latestReviewedAt)}
                        resultCount={filteredItems.length}
                        showResearchControls={workspace === 'research'}
                        onQueryChange={changeQuery}
                        onMarketChange={changeMarketFilter}
                        onActionChange={changeActionFilter}
                    />
                }
                footer="Live Research V7 · Existing review, evidence, persistence, queue, portfolio, backup, notification, and URL-state contracts"
                testId="research-v7"
            >
                <div className={liveStyles.researchPage}>
                    <div className={liveStyles.researchIdentity}>
                        <p>Investment research</p>
                        <h1>{workspace === 'research' ? 'Selected security' : researchWorkspaceGroups.find((group) => group.items.some((item) => item.id === workspace))?.items.find((item) => item.id === workspace)?.label ?? 'Research workspace'}</h1>
                        <span>{workspace === 'research' ? 'The saved decision, qualifying evidence, next gap, and owning review workflow stay together.' : 'This workspace retains its existing identifier, deep link, data owner, and mutation boundary.'}</span>
                    </div>
                    {dashboardBody}
                </div>
            </V7Shell>
        );
    }

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
                onQueryChange={changeQuery}
                onMarketChange={changeMarketFilter}
                onActionChange={changeActionFilter}
                onThemeToggle={toggleTheme}
                commands={researchCommands}
                localSearch={localSearch}
            />
            {dashboardBody}
        </div>
    );
};

export const ResearchDashboardV7 = () => <ResearchDashboardV6 presentation="v7" />;
