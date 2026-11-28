'use client';

import { useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { V9Navigation, type V9Href } from '@/components/v9/v9-navigation';
import { readRecentTickers, searchLocalResearchRecords, type RecentTicker } from '@/lib/research/command-search';
import type { ResearchRecord } from '@/lib/types/research';
import styles from './v8-command-palette.module.css';

type CommandItem = {
    id: string;
    title: string;
    subtitle: string;
    tag: string;
    href: string;
};

const V8_STATIC_ITEMS = (market: 'US' | 'MY'): readonly CommandItem[] => [
    { id: 'mkt-us', title: 'US Market Pulse', subtitle: 'Composite score, evidence coverage & brief', tag: 'Market', href: '/main-v8?market=US' },
    { id: 'mkt-my', title: 'Malaysia · Bursa Market Pulse', subtitle: 'FBM KLCI conditions, coverage & brief', tag: 'Market', href: '/main-v8?market=MY' },
    { id: 'res-home', title: 'Stock Research Home', subtitle: 'Watchlist and security lookup', tag: 'Research', href: `/research-v8?market=${market}` },
    { id: 'disc-trend', title: 'Discover · Trending Top 20', subtitle: 'US large-cap sustained momentum scan', tag: 'Discover', href: '/research-v8?market=US&discover=trending#discover' },
    { id: 'disc-pick', title: 'Discover · Stock Picker', subtitle: 'Rule-based fundamental shortlist', tag: 'Discover', href: '/research-v8?market=US&discover=picker#discover' },
    { id: 'disc-cal', title: 'Earnings Calendar', subtitle: 'Upcoming earnings announcements', tag: 'Calendar', href: `/research-v8?market=${market}&discover=calendar#discover` },
    { id: 'learn', title: 'Learn · Metrics & Methodology', subtitle: 'Plain-English lessons for market indicators', tag: 'Learn', href: '/learn' },
];

const V9_STATIC_ITEMS = (v9: V9Href): readonly CommandItem[] => [
    { id: 'mkt-us', title: 'US Market Pulse', subtitle: 'Composite score, evidence coverage & brief', tag: 'Market', href: v9('market', { market: 'US' }) },
    { id: 'mkt-my', title: 'Malaysia · Bursa Market Pulse', subtitle: 'FBM KLCI conditions, coverage & brief', tag: 'Market', href: v9('market', { market: 'MY' }) },
    { id: 'port-hold', title: 'Portfolio · Holdings', subtitle: 'Local holdings, live market values & currency sleeves', tag: 'Portfolio', href: v9('portfolio') },
    { id: 'port-factors', title: 'Portfolio · Factor exposure', subtitle: '10-factor sensitivity matrix across saved holdings', tag: 'Portfolio', href: v9('portfolio', { tab: 'factors' }) },
    { id: 'res-home', title: 'Stock Research · Watchlist', subtitle: 'Saved watchlist, review queue & security lookup', tag: 'Research', href: v9('research', { tab: 'watchlist' }) },
    { id: 'disc-trend', title: 'Discover · Trending Top 20', subtitle: 'US large-cap sustained momentum scan', tag: 'Discover', href: v9('discover', { market: 'US', discover: 'trending' }) },
    { id: 'disc-early', title: 'Discover · Early trends', subtitle: 'Emerging and confirmed momentum candidates', tag: 'Discover', href: v9('discover', { market: 'US', discover: 'early' }) },
    { id: 'disc-pick', title: 'Discover · Stock Picker', subtitle: 'Rule-based fundamental shortlist', tag: 'Discover', href: v9('discover', { market: 'US', discover: 'picker' }) },
    { id: 'disc-cal', title: 'Discover · Calendar', subtitle: 'Upcoming earnings, reviews & macro releases', tag: 'Calendar', href: v9('discover', { discover: 'calendar' }) },
    { id: 'disc-alerts', title: 'Discover · Alerts', subtitle: 'On-demand conditions & structured trigger coverage', tag: 'Alerts', href: v9('discover', { discover: 'alerts' }) },
    { id: 'learn', title: 'Learn · Metrics & Methodology', subtitle: 'Plain-English lessons for market indicators', tag: 'Learn', href: v9('learn') },
];

/** Local-only keyboard command palette (Ctrl/Cmd+K) for fast navigation without network calls. */
export function V8CommandPalette({
    market = 'US',
    records = null,
}: {
    market?: 'US' | 'MY';
    records?: readonly ResearchRecord[] | null;
}) {
    const v9 = useContext(V9Navigation);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const titleId = useId();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [recentTickers, setRecentTickers] = useState<readonly RecentTicker[]>([]);

    const openPalette = useCallback(() => {
        setQuery('');
        setActiveIndex(0);
        if (v9) setRecentTickers(readRecentTickers());
        dialogRef.current?.showModal();
        setOpen(true);
        requestAnimationFrame(() => inputRef.current?.focus());
    }, [v9]);

    function closePalette() {
        dialogRef.current?.close();
    }

    const navigateTo = useCallback((href: string) => {
        closePalette();
        if (v9) {
            window.history.pushState(null, '', href);
            window.scrollTo(0, 0);
        } else {
            window.location.assign(href);
        }
    }, [v9]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                if (dialogRef.current?.open) dialogRef.current.close();
                else openPalette();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [openPalette]);

    const items = useMemo(() => {
        const trimmed = query.trim();
        const lower = trimmed.toLowerCase();
        if (!v9) {
            const base = V8_STATIC_ITEMS(market).filter(item =>
                !lower || item.title.toLowerCase().includes(lower) || item.subtitle.toLowerCase().includes(lower) || item.tag.toLowerCase().includes(lower)
            );
            if (/^[A-Za-z0-9.-]{1,10}$/.test(trimmed)) {
                const sym = trimmed.toUpperCase();
                const isMalaysiaCode = /^\d{4}(\.KL)?$/.test(sym);
                const targetMarket: 'US' | 'MY' = isMalaysiaCode ? 'MY' : market;
                const direct: CommandItem = {
                    id: `direct-${targetMarket}-${sym}`,
                    title: `Open ${sym} in Research (${targetMarket})`,
                    subtitle: 'Jump straight to security quote, financials & notes',
                    tag: 'Ticker',
                    href: `/research-v8?ticker=${encodeURIComponent(sym)}&market=${targetMarket}`,
                };
                return [direct, ...base];
            }
            return base;
        }

        const staticRoutes = V9_STATIC_ITEMS(v9).filter(item =>
            !lower || item.title.toLowerCase().includes(lower) || item.subtitle.toLowerCase().includes(lower) || item.tag.toLowerCase().includes(lower)
        );
        const localHits: CommandItem[] = trimmed
            ? searchLocalResearchRecords(records ?? [], trimmed).map(hit => ({
                id: hit.id,
                title: hit.title,
                subtitle: hit.subtitle,
                tag: hit.tag,
                href: v9('research', { ticker: hit.symbol, market: hit.market, ...(hit.tab ? { tab: hit.tab } : {}) }),
            }))
            : [];
        const savedOverviewIds = new Set(localHits.filter(hit => hit.id.startsWith('saved:')).map(hit => hit.id.slice('saved:'.length)));
        const recentItems: CommandItem[] = recentTickers
            .filter(item => {
                if (savedOverviewIds.has(`${item.market}:${item.symbol}`)) return false;
                if (!lower) return true;
                return `${item.symbol} ${item.companyName ?? ''} ${item.market} recent`.toLowerCase().includes(lower);
            })
            .map(item => ({
                id: `recent:${item.market}:${item.symbol}`,
                title: item.companyName ? `${item.symbol} · ${item.companyName}` : `${item.symbol} (${item.market})`,
                subtitle: `Recent ${item.market} research`,
                tag: 'Recent',
                href: v9('research', { ticker: item.symbol, market: item.market }),
            }));

        const directItems: CommandItem[] = [];
        if (/^[A-Za-z0-9.-]{1,10}$/.test(trimmed)) {
            const sym = trimmed.toUpperCase();
            const isMalaysiaCode = /^\d{4}(\.KL)?$/.test(sym);
            const targetMarket: 'US' | 'MY' = isMalaysiaCode ? 'MY' : market;
            if (!savedOverviewIds.has(`${targetMarket}:${sym}`)) {
                directItems.push({
                    id: `direct-${targetMarket}-${sym}`,
                    title: `Open ${sym} in Research (${targetMarket})`,
                    subtitle: 'Jump straight to security quote, financials & notes',
                    tag: 'Ticker',
                    href: v9('research', { ticker: sym, market: targetMarket }),
                });
            }
        }

        return trimmed
            ? [...localHits, ...directItems, ...recentItems, ...staticRoutes]
            : [...recentItems, ...staticRoutes];
    }, [market, query, recentTickers, records, v9]);

    const boundedIndex = items.length ? Math.min(activeIndex, items.length - 1) : 0;

    return <>
        <button
            ref={triggerRef}
            type="button"
            className={styles.trigger}
            aria-label="Quick jump (Ctrl+K)"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={openPalette}
        >
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg>
            <span className={styles.triggerText}>Quick jump…</span>
            <kbd className={styles.kbd} aria-hidden="true">⌘K</kbd>
        </button>

        <dialog
            ref={dialogRef}
            className={styles.dialog}
            aria-labelledby={titleId}
            onClose={() => { setOpen(false); triggerRef.current?.focus({ preventScroll: true }); }}
            onClick={event => {
                const box = event.currentTarget.getBoundingClientRect();
                if (event.target === event.currentTarget && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) {
                    closePalette();
                }
            }}
        >
            <div className={styles.searchRow}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg>
                <label id={titleId} htmlFor={`${titleId}-input`} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>
                    Quick jump to market, research or ticker
                </label>
                <input
                    ref={inputRef}
                    id={`${titleId}-input`}
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    className={styles.searchInput}
                    value={query}
                    placeholder={v9 ? 'Jump to US, MY, Discover, thesis, filings, or AAPL / 1155…' : 'Jump to US, Malaysia, Discover, or type AAPL / 1155…'}
                    onChange={event => { setQuery(event.target.value); setActiveIndex(0); }}
                    onKeyDown={event => {
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            closePalette();
                        } else if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex(i => (items.length ? (i + 1) % items.length : 0)); }
                        else if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex(i => (items.length ? (i - 1 + items.length) % items.length : 0)); }
                        else if (event.key === 'Enter' && items[boundedIndex]) {
                            event.preventDefault();
                            navigateTo(items[boundedIndex].href);
                        }
                    }}
                />
                <button type="button" className={styles.closeBtn} onClick={closePalette} aria-label="Close quick jump">Esc</button>
            </div>
            <div className={styles.list} role="list">
                {items.length > 0 ? items.map((item, index) => (
                    <a
                        key={item.id}
                        href={item.href}
                        className={styles.item}
                        data-active={index === boundedIndex}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={event => {
                            if (v9 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
                                event.preventDefault();
                                navigateTo(item.href);
                            } else {
                                closePalette();
                            }
                        }}
                    >
                        <span className={styles.itemText}>
                            <b>{item.title}</b>
                            <small>{item.subtitle}</small>
                        </span>
                        <span className={styles.itemTag}>{item.tag}</span>
                    </a>
                )) : <div className={styles.empty}>No matching destinations. Try a ticker like AAPL or 1155.</div>}
            </div>
            {v9 && (
                <div className={styles.privacyNote}>
                    <span>100% browser-local search · notes &amp; citations stay on this device</span>
                    <span>↑↓ navigate · Enter open</span>
                </div>
            )}
        </dialog>
    </>;
}
