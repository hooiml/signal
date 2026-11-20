'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { MarketSignal } from '@/lib/types/signal-v2';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import { buildPortfolioActualSummary, reconcilePortfolioHoldings } from '@/lib/portfolio/holdings';
import { loadPortfolioHoldingsSnapshot, PORTFOLIO_HOLDINGS_CHANGE_EVENT } from '@/lib/portfolio/holdings-client';
import { GUEST_WORKSPACE_CLEARED_EVENT, readGuestRecords } from '@/lib/research/guest-workspace';
import { createTodayMarketContinuation } from '@/lib/research/since-last-visit';
import { writeTodayContinuation } from '@/lib/research/since-last-visit-client';
import { readSignalConfig } from '@/lib/signal-config';
import { marketRouteConfig } from '@/lib/legacy-routes';
import { parseConnectedSignal } from '@/components/v8/MarketV8ConnectedData';
import { parseWatchlist } from '@/components/v8/research-v8-connected-data';
import { readData, readPolicies } from '@/components/v8/read-data';
import { V8Settings } from '@/components/v8/V8Settings';
import { V8CommandPalette } from '@/components/v8/V8CommandPalette';
import { setV8ThemeChoice } from '@/components/v8/V8ThemeControl';
import type { Market, Mode } from '@/components/v8/market-v8-fixtures';
import { V9HomeView, type SignalSlot } from './V9HomeView';
import { V9MarketView } from './V9MarketView';
import { V9ResearchView } from './V9ResearchView';
import { V9DiscoverView, V9PortfolioView } from './V9PortfolioDiscoverViews';
import base from '@/components/v8/market-v8.module.css';
import styles from './v9-workspace.module.css';

export type V9View = 'home' | 'market' | 'portfolio' | 'discover' | 'research';

const validViews = new Set<V9View>(['home', 'market', 'portfolio', 'discover', 'research']);
const errorText = (cause: unknown) => (cause instanceof Error ? cause.message : 'Data could not be loaded.');

const navIcons: Record<V9View, ReactNode> = {
    home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /></>,
    market: <path d="M3 12h4l3-7 4 14 3-7h4" />,
    portfolio: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M8 6V4h8v2" /></>,
    discover: <><circle cx="12" cy="12" r="9" /><path d="m14.8 9.2-1.8 5.6-5.6 1.8 1.8-5.6 5.6-1.8Z" /></>,
    research: <><path d="M4 19V5" /><path d="M4 19h16" /><path d="m8 15 3-4 3 2 5-6" /></>,
};

export function V9Workspace({
    initialView = 'home',
    initialMarket,
    initialTicker,
}: {
    readonly initialView?: V9View;
    readonly initialMarket?: Market;
    readonly initialTicker?: string;
}) {
    const searchParams = useSearchParams();
    const returnsToToday = searchParams.get('returnTo') === 'today';

    const [view, setViewState] = useState<V9View>(() => {
        if (initialTicker) return 'research';
        return validViews.has(initialView) ? initialView : 'home';
    });
    const [collapsed, setCollapsed] = useState(false);
    const [market, setMarket] = useState<Market>(initialMarket ?? 'US');
    const [mode, setMode] = useState<Mode>('standard');
    const [social, setSocial] = useState(true);
    const [revision, setRevision] = useState(0);
    const [ticker, setTicker] = useState(initialTicker?.toUpperCase() || 'AAPL');
    const [tickerMarket, setTickerMarket] = useState<ResearchMarket>(initialMarket ?? 'US');
    const [isDark, setIsDark] = useState(false);

    const [usSlot, setUsSlot] = useState<SignalSlot>({ signal: null, loading: true, error: '' });
    const [mySlot, setMySlot] = useState<SignalSlot>({ signal: null, loading: true, error: '' });
    const [records, setRecords] = useState<ResearchRecord[] | null>(null);
    const [workspace, setWorkspace] = useState<'checking' | 'guest' | 'owner'>('checking');
    const [holdingsTick, setHoldingsTick] = useState(0);
    const [guestTick, setGuestTick] = useState(0);

    // Sync initial user defaults & Today continuation
    useEffect(() => {
        if (returnsToToday) writeTodayContinuation(createTodayMarketContinuation(new Date().toISOString()));
    }, [returnsToToday]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            const saved = readSignalConfig().config;
            const routeCfg = marketRouteConfig(searchParams);
            const merged = { ...saved, ...routeCfg };
            if (!initialMarket) setMarket(merged.market);
            setMode(merged.mode);
            setSocial(merged.enableSocial);
        }, 0);
        return () => window.clearTimeout(timer);
    }, [initialMarket, searchParams]);

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
        const controller = new AbortController();
        const loadMarket = (target: Market, setter: (slot: SignalSlot) => void) => {
            setter({ signal: null, loading: true, error: '' });
            const url = `/api/signals/v2?market=${target}&mode=${mode}&enableSocial=${social}`;
            readData(url, controller.signal, readPolicies.score)
                .then(payload => parseConnectedSignal(payload, target, mode))
                .then((signal: MarketSignal) => setter({ signal, loading: false, error: '' }))
                .catch(cause => {
                    if (!controller.signal.aborted) setter({ signal: null, loading: false, error: errorText(cause) });
                });
        };
        loadMarket('US', setUsSlot);
        loadMarket('MY', setMySlot);
        return () => controller.abort();
    }, [mode, social, revision]);

    // Load guest or owner watchlist records without unrequested writes
    useEffect(() => {
        const controller = new AbortController();
        const loadGuest = () => {
            try {
                setRecords([...readGuestRecords()]);
            } catch {
                setRecords([]);
            }
            setWorkspace('guest');
        };
        fetch('/api/owner/session', { signal: controller.signal })
            .then(res => (res.ok ? res.json() : null))
            .then(async payload => {
                if (controller.signal.aborted) return;
                if (payload?.success && payload.data?.unlocked) {
                    const list = parseWatchlist(await readData('/api/research/watchlist', controller.signal, readPolicies.watchlist));
                    if (!controller.signal.aborted) {
                        setRecords([...list]);
                        setWorkspace('owner');
                    }
                    return;
                }
                loadGuest();
            })
            .catch(() => {
                if (!controller.signal.aborted) loadGuest();
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
        if (typeof window === 'undefined') return { count: 0, summaries: [] };
        const loaded = loadPortfolioHoldingsSnapshot();
        if (loaded.status !== 'ready') return { count: 0, summaries: [] };
        const reconciled = reconcilePortfolioHoldings(loaded.snapshot, records ?? [], new Map());
        const summaries = buildPortfolioActualSummary(loaded.snapshot, reconciled);
        return { count: loaded.snapshot.holdings.length, summaries };
    }, [holdingsTick, records]);

    const syncUrl = useCallback((nextView: V9View, extra?: { market?: Market; ticker?: string }) => {
        if (typeof window === 'undefined') return;
        const url = new URL(window.location.href);
        url.pathname = '/v9';
        if (nextView === 'home') url.searchParams.delete('view');
        else url.searchParams.set('view', nextView);
        if (extra?.market) url.searchParams.set('market', extra.market);
        if (extra?.ticker) url.searchParams.set('ticker', extra.ticker);
        else if (nextView !== 'research') url.searchParams.delete('ticker');
        window.history.replaceState(null, '', url);
    }, []);

    const switchView = useCallback((next: V9View) => {
        setViewState(next);
        syncUrl(next);
    }, [syncUrl]);

    const openMarket = useCallback((nextMarket: Market) => {
        setMarket(nextMarket);
        setViewState('market');
        syncUrl('market', { market: nextMarket });
    }, [syncUrl]);

    const openStock = useCallback((sym: string, mkt: ResearchMarket) => {
        const clean = sym.trim().toUpperCase();
        setTicker(clean);
        setTickerMarket(mkt);
        setViewState('research');
        syncUrl('research', { market: mkt, ticker: clean });
    }, [syncUrl]);

    const activeSlot = market === 'MY' ? mySlot : usSlot;
    const navItems: readonly { id: V9View; label: string; shortLabel: string; badge?: string }[] = [
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
                    <Link className={styles.sideFootLink} href="/learn">Learn & Glossary</Link>
                    <Link className={styles.sideFootLink} href="/main-v8">Classic V8 Market</Link>
                    <Link className={styles.sideFootLink} href="/research-v8">Classic V8 Research</Link>
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
                    {returnsToToday && (
                        <div className={styles.todayBanner}>
                            <span>Opened from your Today briefing.</span>
                            <Link className={styles.ghostBtn} href="/research?workspace=today">Back to Today</Link>
                        </div>
                    )}

                    {view === 'home' && (
                        <V9HomeView
                            us={usSlot}
                            my={mySlot}
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
                            mode={mode}
                            social={social}
                            signal={activeSlot.signal}
                            loading={activeSlot.loading}
                            error={activeSlot.error}
                            onMarketChange={next => { setMarket(next); syncUrl('market', { market: next }); }}
                            onModeChange={setMode}
                            onSocialChange={setSocial}
                            onReload={() => setRevision(v => v + 1)}
                        />
                    )}

                    {view === 'portfolio' && (
                        <V9PortfolioView
                            records={records}
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
                            symbol={ticker}
                            market={tickerMarket}
                            records={records}
                            owner={workspace === 'owner'}
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
    );
}
