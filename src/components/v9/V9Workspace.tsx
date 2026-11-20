'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import type { MarketSignal } from '@/lib/types/signal-v2';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import { buildPortfolioActualSummary, reconcilePortfolioHoldings } from '@/lib/portfolio/holdings';
import { loadPortfolioHoldingsSnapshot, PORTFOLIO_HOLDINGS_CHANGE_EVENT } from '@/lib/portfolio/holdings-client';
import { GUEST_WORKSPACE_CLEARED_EVENT, readGuestRecords } from '@/lib/research/guest-workspace';
import { createTodayMarketContinuation } from '@/lib/research/since-last-visit';
import { writeTodayContinuation } from '@/lib/research/since-last-visit-client';
import { useReviewDay } from '@/lib/research/use-review-day';
import { DEFAULT_SIGNAL_CONFIG, readSignalConfig, type SignalConfig } from '@/lib/signal-config';
import { parseLearnMetric } from '@/lib/learn/metric-links';
import { marketRouteConfig } from '@/lib/legacy-routes';
import { parseConnectedSignal } from '@/components/v8/MarketV8ConnectedData';
import { parseWatchlist } from '@/components/v8/research-v8-connected-data';
import { readData, readPolicies } from '@/components/v8/read-data';
import { V8Settings } from '@/components/v8/V8Settings';
import { V8CommandPalette } from '@/components/v8/V8CommandPalette';
import { setV8ThemeChoice } from '@/components/v8/V8ThemeControl';
import type { Market } from '@/components/v8/market-v8-fixtures';
import { V9Navigation, workspaceHref, type V9View, type V9Href } from './v9-navigation';
import { V9HomeView, type SignalSlot } from './V9HomeView';
import { V9MarketView } from './V9MarketView';
import { V9ResearchView } from './V9ResearchView';
import { V9DiscoverView, V9PortfolioView } from './V9PortfolioDiscoverViews';
import { useV9MarketToday } from './useV9MarketToday';
import base from '@/components/v8/market-v8.module.css';
import styles from './v9-workspace.module.css';

const LearnDashboard = dynamic(() => import('@/components/learn/LearnDashboardV1').then(module => module.LearnDashboardV1));
const validViews = new Set<V9View>(['home', 'market', 'portfolio', 'discover', 'research', 'learn']);
const errorText = (cause: unknown) => (cause instanceof Error ? cause.message : 'Data could not be loaded.');
const loadingSlot: SignalSlot = { signal: null, loading: true, error: '' };
type RequestedSignal = SignalSlot & { requestKey: string };

const navIcons: Record<Exclude<V9View, 'learn'>, ReactNode> = {
    home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /></>,
    market: <path d="M3 12h4l3-7 4 14 3-7h4" />,
    portfolio: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M8 6V4h8v2" /></>,
    discover: <><circle cx="12" cy="12" r="9" /><path d="m14.8 9.2-1.8 5.6-5.6 1.8 1.8-5.6 5.6-1.8Z" /></>,
    research: <><path d="M4 19V5" /><path d="M4 19h16" /><path d="m8 15 3-4 3 2 5-6" /></>,
};

export function V9Workspace() {
    const searchParams = useSearchParams();
    const returnsToToday = searchParams.get('returnTo') === 'today';

    const requestedView = searchParams.get('view') as V9View | null;
    const requestedTicker = searchParams.get('ticker')?.trim().toUpperCase();
    const view = requestedView && validViews.has(requestedView) ? requestedView : requestedTicker ? 'research' : 'home';
    const [defaults, setDefaults] = useState<SignalConfig | null>(null);
    const { market, mode, enableSocial: social } = { ...(defaults ?? DEFAULT_SIGNAL_CONFIG), ...marketRouteConfig(searchParams) };
    const [collapsed, setCollapsed] = useState(false);
    const [revision, setRevision] = useState(0);
    const [lastStock, setLastStock] = useState<{symbol: string; market: ResearchMarket} | null>(null);
    const tickerMarket = market;
    const ticker = requestedTicker || (lastStock?.market === market ? lastStock.symbol : market === 'MY' ? '1155' : 'AAPL');
    const [isDark, setIsDark] = useState(false);

    const requestKey = `${mode}:${social}:${revision}`;
    const [usResult, setUsResult] = useState<RequestedSignal | null>(null);
    const [myResult, setMyResult] = useState<RequestedSignal | null>(null);
    const usSlot = usResult?.requestKey === requestKey ? usResult : loadingSlot;
    const mySlot = myResult?.requestKey === requestKey ? myResult : loadingSlot;
    const [{ records, workspace }, setWatchlist] = useState<{
        records: ResearchRecord[] | null;
        workspace: 'checking' | 'guest' | 'owner';
    }>({ records: null, workspace: 'checking' });
    const [workspaceError, setWorkspaceError] = useState('');
    const [holdingsTick, setHoldingsTick] = useState(0);
    const [guestTick, setGuestTick] = useState(0);

    // Sync initial user defaults & Today continuation
    useEffect(() => {
        if (returnsToToday) writeTodayContinuation(createTodayMarketContinuation(new Date().toISOString()));
    }, [returnsToToday]);

    useEffect(() => {
        const timer = window.setTimeout(() => setDefaults(readSignalConfig().config), 0);
        return () => window.clearTimeout(timer);
    }, []);

    // Track resolved light/dark theme attribute on <html>
    useEffect(() => {
        const sync = () => setIsDark(document.documentElement.getAttribute('data-v8-theme') === 'dark');
        sync();
        const observer = new MutationObserver(sync);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-v8-theme'] });
        return () => observer.disconnect();
    }, []);

    // Fetch live US and MY signals in parallel
    useEffect(() => {
        if (!defaults) return;
        const controller = new AbortController();
        const loadMarket = (target: Market, setter: (slot: RequestedSignal) => void) => {
            setter({ ...loadingSlot, requestKey });
            const url = `/api/signals/v2?market=${target}&mode=${mode}&enableSocial=${social}`;
            readData(url, controller.signal, readPolicies.score)
                .then(payload => parseConnectedSignal(payload, target, mode))
                .then((signal: MarketSignal) => {
                    if (!controller.signal.aborted) setter({ requestKey, signal, loading: false, error: '', receivedAt: new Date().toISOString() });
                })
                .catch(cause => {
                    if (!controller.signal.aborted) setter({ requestKey, signal: null, loading: false, error: errorText(cause) });
                });
        };
        loadMarket('US', setUsResult);
        loadMarket('MY', setMyResult);
        return () => controller.abort();
    }, [mode, social, requestKey, defaults]);

    // Load guest or owner watchlist records without unrequested writes
    useEffect(() => {
        const controller = new AbortController();
        const loadGuest = () => {
            try {
                setWatchlist({ workspace: 'guest', records: [...readGuestRecords()] });
            } catch {
                setWatchlist({ workspace: 'guest', records: [] });
            }
            setWorkspaceError('');
        };
        fetch('/api/owner/session', { signal: controller.signal })
            .then(res => {
                if (!res.ok) throw new Error('Workspace status could not be loaded.');
                return res.json();
            })
            .then(async payload => {
                if (controller.signal.aborted) return;
                if (!payload?.success || typeof payload.data?.unlocked !== 'boolean') throw new Error('Workspace status is unavailable.');
                if (payload.data.unlocked) {
                    const list = parseWatchlist(await readData('/api/research/watchlist', controller.signal, readPolicies.watchlist));
                    if (!controller.signal.aborted) {
                        setWatchlist({ workspace: 'owner', records: list });
                        setWorkspaceError('');
                    }
                    return;
                }
                loadGuest();
            })
            .catch(cause => {
                if (!controller.signal.aborted) {
                    setWatchlist({ workspace: 'checking', records: null });
                    setWorkspaceError(errorText(cause));
                }
            });
        return () => controller.abort();
    }, [guestTick]);

    useEffect(() => {
        const onHoldings = () => setHoldingsTick(v => v + 1);
        const onGuestClear = () => setGuestTick(v => v + 1);
        window.addEventListener('storage', onHoldings);
        window.addEventListener(PORTFOLIO_HOLDINGS_CHANGE_EVENT, onHoldings);
        window.addEventListener(GUEST_WORKSPACE_CLEARED_EVENT, onGuestClear);
        return () => {
            window.removeEventListener('storage', onHoldings);
            window.removeEventListener(PORTFOLIO_HOLDINGS_CHANGE_EVENT, onHoldings);
            window.removeEventListener(GUEST_WORKSPACE_CLEARED_EVENT, onGuestClear);
        };
    }, []);

    const portfolio = useMemo(() => {
        void holdingsTick;
        if (!defaults) return { count: 0, summaries: [] };
        const loaded = loadPortfolioHoldingsSnapshot();
        if (loaded.status !== 'ready') return { count: 0, summaries: [] };
        const reconciled = reconcilePortfolioHoldings(loaded.snapshot, records ?? [], new Map());
        const summaries = buildPortfolioActualSummary(loaded.snapshot, reconciled);
        return { count: loaded.snapshot.holdings.length, summaries };
    }, [holdingsTick, records, defaults]);

    const href = useCallback<V9Href>((next, params) =>
        workspaceHref(next, { market, mode, enableSocial: social }, {
            ...(returnsToToday ? { returnTo: 'today' } : {}),
            ...(searchParams.get('tour') === '1' && (next === 'market' || next === 'research') ? { tour: '1' } : {}),
            ...params,
        }), [market, mode, social, returnsToToday, searchParams]);

    const switchView = useCallback((next: V9View) => {
        const target = next === 'research' ? href(next, { ticker, market: tickerMarket }) : href(next);
        window.history.pushState(null, '', target);
        window.scrollTo(0, 0);
    }, [href, ticker, tickerMarket]);

    const openMarket = useCallback((nextMarket: Market, tab?: 'evidence' | 'scenarios') => {
        window.history.pushState(null, '', href('market', { market: nextMarket, ...(tab ? { tab } : {}) }));
        window.scrollTo(0, 0);
    }, [href]);

    const openStock = useCallback((sym: string, mkt: ResearchMarket) => {
        const clean = sym.trim().toUpperCase();
        setLastStock({ symbol: clean, market: mkt });
        window.history.pushState(null, '', href('research', { market: mkt, ticker: clean }));
        window.scrollTo(0, 0);
    }, [href]);

    const updateMarketPreference = (key: 'market' | 'mode' | 'enableSocial', value: string) => {
        const current = { market, mode, enableSocial: String(social) };
        if (current[key] === value) return;
        const url = new URL(window.location.href);
        url.searchParams.set(key, value);
        if (url.searchParams.get('tab') !== 'today') {
            url.searchParams.delete('tab');
            url.searchParams.delete('investigation');
        }
        url.searchParams.delete('advanced');
        window.history.replaceState(null, '', url);
    };

    const activeSlot = market === 'MY' ? mySlot : usSlot;
    const utcDay = useReviewDay();
    const todayVisible = view === 'market' && (searchParams.get('tab') === 'today'
        || (!activeSlot.loading && (!activeSlot.signal || Object.keys(activeSlot.signal.components).length === 0)));
    const usToday = useV9MarketToday({ market: 'US', mode, enableSocial: social }, utcDay,
        view === 'home' ? 'summary' : todayVisible && market === 'US' ? 'timeline' : null,
        usSlot.loading ? null : `${requestKey}:${usSlot.receivedAt ?? 'error'}`);
    const myToday = useV9MarketToday({ market: 'MY', mode, enableSocial: social }, utcDay,
        view === 'home' ? 'summary' : todayVisible && market === 'MY' ? 'timeline' : null,
        mySlot.loading ? null : `${requestKey}:${mySlot.receivedAt ?? 'error'}`);
    const mergeSavedOwner = useCallback((saved: ResearchRecord) => {
        setWatchlist(current => {
            if (current.workspace !== 'owner' || !current.records) return current;
            const previous = current.records.find(item => item.market === saved.market && item.symbol === saved.symbol);
            if (previous && previous.revision >= saved.revision) return current;
            const records = previous
                ? current.records.map(item => item === previous ? saved : item)
                : [...current.records, saved].sort((left, right) => left.symbol.localeCompare(right.symbol));
            return { ...current, records };
        });
    }, []);
    const navItems: readonly { id: keyof typeof navIcons; label: string; shortLabel: string; badge?: string }[] = [
        { id: 'home', label: 'Home', shortLabel: 'Home' },
        { id: 'market', label: 'Market Pulse', shortLabel: 'Market', badge: activeSlot.signal ? activeSlot.signal.composite_score.toFixed(0) : undefined },
        { id: 'portfolio', label: 'Portfolio', shortLabel: 'Portfolio', badge: portfolio.count ? String(portfolio.count) : undefined },
        { id: 'discover', label: 'Discover', shortLabel: 'Discover' },
        { id: 'research', label: 'Stock Research', shortLabel: 'Research', badge: ticker },
    ];

    const sideWatch = (records && records.length > 0
        ? records.slice(0, 6).map(r => ({ symbol: r.symbol, market: r.market, name: r.companyName || r.symbol }))
        : [
            { symbol: 'AAPL', market: 'US' as const, name: 'Apple Inc.' },
            { symbol: 'MSFT', market: 'US' as const, name: 'Microsoft Corp.' },
            { symbol: '1155', market: 'MY' as const, name: 'Maybank' },
            { symbol: '5347', market: 'MY' as const, name: 'Tenaga Nasional' },
        ]);

    return (
        <V9Navigation.Provider value={href}>
        <div className={`${base.tokens} ${styles.shell}`} data-collapsed={collapsed} data-testid="v9-workspace">
            <aside className={styles.sidebar} aria-label="Workspace sidebar">
                <div className={styles.brandRow}>
                    <button type="button" className={styles.brandBtn} onClick={() => switchView('home')}>
                        <span className={styles.brandMark} aria-hidden="true">
                            <svg viewBox="0 0 28 24"><path d="M2 12c3.5-8 7.5-8 12 0s8.5 8 12 0" /></svg>
                        </span>
                        <span className={styles.brandTitle}>
                            <strong>Signal <span className={styles.versionTag}>v9.0.1</span></strong>
                            <small>Calm Investing Workspace</small>
                        </span>
                    </button>
                    <button
                        type="button"
                        className={styles.collapseBtn}
                        onClick={() => setCollapsed(v => !v)}
                        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {collapsed ? '›' : '‹'}
                    </button>
                </div>

                <nav className={styles.navList} aria-label="Primary navigation">
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            type="button"
                            className={styles.navBtn}
                            aria-current={view === item.id ? 'page' : undefined}
                            onClick={() => switchView(item.id)}
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">{navIcons[item.id]}</svg>
                            <span className={styles.navText}>{item.label}</span>
                            {item.badge && <span className={styles.navBadge}>{item.badge}</span>}
                        </button>
                    ))}
                </nav>

                <div className={styles.sideSection}>
                    <div className={styles.sideSectionHead}>
                        <span>{records?.length ? `Watchlist (${records.length})` : 'Quick Stocks'}</span>
                        <button type="button" onClick={() => switchView('research')} style={{ fontSize: 11, color: 'var(--muted)' }}>Open</button>
                    </div>
                    {sideWatch.map(item => (
                        <button
                            key={`${item.market}:${item.symbol}`}
                            type="button"
                            className={styles.sideWatchRow}
                            onClick={() => openStock(item.symbol, item.market)}
                        >
                            <span className={styles.sideWatchLeft}>
                                <span className={styles.tickerAvatar} aria-hidden="true">{item.symbol.slice(0, 2)}</span>
                                <span className={styles.sideWatchMeta}>
                                    <b>{item.symbol}</b>
                                    <small>{item.name}</small>
                                </span>
                            </span>
                            <span className={styles.mktTag}>{item.market}</span>
                        </button>
                    ))}
                </div>

                <div className={styles.sideFooter}>
                    <Link className={styles.sideFootLink} aria-current={view === 'learn' ? 'page' : undefined} href={href('learn')}>Learn & Glossary</Link>
                </div>
            </aside>

            <div className={styles.mainCol}>
                <header className={styles.topbar}>
                    <button type="button" className={styles.mobileBrand} onClick={() => switchView('home')}>
                        <span className={styles.brandMark} aria-hidden="true" style={{ width: 28, height: 28 }}>
                            <svg viewBox="0 0 28 24" style={{ width: 15, height: 15 }}><path d="M2 12c3.5-8 7.5-8 12 0s8.5 8 12 0" /></svg>
                        </span>
                        <span>Signal</span>
                    </button>

                    <div className={styles.topActions} style={{ flex: 1, justifyContent: 'flex-end' }}>
                        <V8CommandPalette market={market} />
                        <button
                            type="button"
                            className={styles.themeToggle}
                            onClick={() => setV8ThemeChoice(isDark ? 'light' : 'dark')}
                            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                {isDark
                                    ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>
                                    : <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />}
                            </svg>
                            <span>{isDark ? 'Light' : 'Dark'}</span>
                        </button>
                        <V8Settings />
                    </div>
                </header>

                <main className={styles.pageContent}>
                    {workspaceError && <div className={styles.card} role="alert">
                        {workspaceError}{' '}
                        <button type="button" className={styles.textLink} onClick={() => { setWorkspaceError(''); setGuestTick(value => value + 1); }}>Retry workspace</button>
                    </div>}
                    {returnsToToday && (
                        <div className={styles.todayBanner}>
                            <span>Opened from your Today briefing.</span>
                            <Link className={styles.ghostBtn} href="/research?workspace=today">Back to Today</Link>
                        </div>
                    )}

                    {view === 'learn' && <LearnDashboard key={searchParams.get('concept')} embedded initialConcept={parseLearnMetric(searchParams.get('concept') ?? undefined)} />}
                    {view === 'home' && (
                        <V9HomeView
                            selectedMarket={market}
                            us={usSlot}
                            my={mySlot}
                            usToday={usToday}
                            myToday={myToday}
                            todayHref={target => href('market', { market: target, tab: 'today' })}
                            mode={mode}
                            records={records}
                            owner={workspace === 'owner'}
                            portfolioSummaries={portfolio.summaries}
                            onOpenMarket={openMarket}
                            onOpenPortfolio={() => switchView('portfolio')}
                            onOpenDiscover={() => switchView('discover')}
                            onOpenStock={openStock}
                        />
                    )}

                    {view === 'market' && (
                        <V9MarketView
                            market={market}
                            today={market === 'MY' ? myToday : usToday}
                            mode={mode}
                            social={social}
                            signal={activeSlot.signal}
                            loading={activeSlot.loading}
                            error={activeSlot.error}
                            isDark={isDark}
                            receivedAt={activeSlot.receivedAt}
                            exposureWorkspace={{ status: workspaceError ? 'error' : records ? 'ready' : 'loading', records: records ?? [], workspace: workspace === 'owner' ? 'owner' : 'guest' }}
                            onMarketChange={next => updateMarketPreference('market', next)}
                            onModeChange={next => updateMarketPreference('mode', next)}
                            onSocialChange={next => updateMarketPreference('enableSocial', String(next))}
                            onReload={() => setRevision(v => v + 1)}
                        />
                    )}

                    {view === 'portfolio' && (
                        <V9PortfolioView
                            records={records}
                            workspace={workspace}
                            theme={isDark ? 'dark' : 'light'}
                            onSavedOwner={mergeSavedOwner}
                            summaries={portfolio.summaries}
                            onOpenStock={openStock}
                        />
                    )}

                    {view === 'discover' && (
                        <V9DiscoverView
                            records={records}
                            workspace={workspace}
                            onOpenStock={openStock}
                        />
                    )}

                    {view === 'research' && (
                        <V9ResearchView
                            key={`${tickerMarket}:${ticker}`}
                            symbol={ticker}
                            market={tickerMarket}
                            records={records}
                            workspace={workspace}
                            theme={isDark ? 'dark' : 'light'}
                            onSavedOwner={mergeSavedOwner}
                            onSelectStock={openStock}
                            onSavedGuest={() => setGuestTick(v => v + 1)}
                        />
                    )}
                </main>
            </div>

            <nav className={styles.mobileNav} aria-label="Mobile navigation">
                {navItems.map(item => (
                    <button
                        key={item.id}
                        type="button"
                        className={styles.mobileNavBtn}
                        aria-current={view === item.id ? 'page' : undefined}
                        onClick={() => switchView(item.id)}
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">{navIcons[item.id]}</svg>
                        <span>{item.shortLabel}</span>
                    </button>
                ))}
            </nav>
        </div>
        </V9Navigation.Provider>
    );
}
