'use client';

import { useContext, useMemo, useState } from 'react';
import Link from 'next/link';
import type { MarketSignal } from '@/lib/types/signal-v2';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import type { PortfolioActualCurrencySummary } from '@/lib/portfolio/holdings';
import { buildMarketBrief } from '@/lib/market-brief';
import { formatHeadlineAge, getHomeSessionContext } from '@/lib/home-schedule';
import { marketReadingLabel, marketTimestampLabel } from '@/lib/market-display';
import { marketEvidenceDay } from '@/lib/market-evidence-coverage';
import { watchlistReview } from '@/lib/research/watchlist-review';
import { indexName } from '@/components/v8/MarketV8ContextSummary';
import { signed } from '@/components/v8/market-v8-fixtures';
import { V9MarketTodaySummary } from './V9MarketToday';
import type { V9MarketTodayState } from './useV9MarketToday';
import { V9Navigation } from './v9-navigation';
import styles from './v9-workspace.module.css';

export type SignalSlot = {
    readonly signal: MarketSignal | null;
    readonly loading: boolean;
    readonly error: string;
    readonly receivedAt?: string;
};

type Tone = 'up' | 'neutral' | 'down';
type FocusChoice = 'auto' | 'US' | 'MY';

const toneFor = (signal: MarketSignal | null, available: boolean): Tone => {
    if (!signal || !available) return 'neutral';
    if (signal.tier === 'buy' || signal.tier === 'strong-buy') return 'up';
    if (signal.tier === 'sell' || signal.tier === 'strong-sell') return 'down';
    return 'neutral';
};

const readingFor = (slot: SignalSlot, brief: ReturnType<typeof buildMarketBrief> | null): string => {
    if (slot.loading) return 'Loading';
    if (slot.error || !slot.signal || !brief || brief.status === 'unavailable') return 'Assessment unavailable';
    return marketReadingLabel(slot.signal.tier);
};

const safeExternalUrl = (value: string | undefined): string | null => {
    if (!value) return null;
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
    } catch {
        return null;
    }
};

function ScoreRing({ score, tone }: { readonly score: number | null; readonly tone: Tone }) {
    const r = 26;
    const c = 2 * Math.PI * r;
    const pct = score === null ? 0 : Math.min(100, Math.max(0, score)) / 100;
    const stroke = tone === 'up' ? 'var(--up-mark)' : tone === 'down' ? 'var(--down-mark)' : 'var(--caution-mark)';
    return (
        <div className={styles.pulseRing} role="img" aria-label={score === null ? 'Score unavailable' : `Score ${score.toFixed(0)} out of 100`}>
            <svg viewBox="0 0 64 64" aria-hidden="true">
                <circle cx="32" cy="32" r={r} fill="none" stroke="var(--surface-muted)" strokeWidth="5.5" />
                <circle
                    cx="32"
                    cy="32"
                    r={r}
                    fill="none"
                    stroke={stroke}
                    strokeWidth="5.5"
                    strokeLinecap="round"
                    strokeDasharray={c.toFixed(1)}
                    strokeDashoffset={(c * (1 - pct)).toFixed(1)}
                />
            </svg>
            <span className={styles.pulseRingVal}>{score === null ? '—' : score.toFixed(0)}</span>
        </div>
    );
}

const fmtMoney = (value: number, currency: string) =>
    new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);

type FocusActionItem = {
    readonly id: string;
    readonly tag: string;
    readonly tone: Tone;
    readonly title: string;
    readonly body: string;
    readonly cta: string;
    readonly href?: string;
    readonly run?: () => void;
};

export function V9HomeView({
    us,
    my,
    usToday,
    myToday,
    todayHref,
    mode,
    selectedMarket,
    explicitMarket = null,
    records,
    owner,
    portfolioSummaries,
    onOpenMarket,
    onOpenPortfolio,
    onOpenDiscover,
    onOpenStock,
}: {
    readonly us: SignalSlot;
    readonly my: SignalSlot;
    readonly usToday: V9MarketTodayState;
    readonly myToday: V9MarketTodayState;
    readonly todayHref: (market: 'US' | 'MY') => string;
    readonly mode: MarketSignal['mode'];
    readonly selectedMarket: 'US' | 'MY';
    readonly explicitMarket?: 'US' | 'MY' | null;
    readonly records: readonly ResearchRecord[] | null;
    readonly owner: boolean;
    readonly portfolioSummaries: readonly PortfolioActualCurrencySummary[];
    readonly onOpenMarket: (market: 'US' | 'MY', tab?: 'scenarios' | 'evidence') => void;
    readonly onOpenPortfolio: () => void;
    readonly onOpenDiscover: () => void;
    readonly onOpenStock: (symbol: string, market: ResearchMarket) => void;
}) {
    const href = useContext(V9Navigation)!;
    const todayIso = usToday.day;
    const [focusOverride, setFocusOverride] = useState<FocusChoice | null>(null);
    const focusChoice: FocusChoice = focusOverride ?? (explicitMarket ?? 'auto');
    const sessionContext = useMemo(() => getHomeSessionContext(), []);

    const activePrimary: 'US' | 'MY' = focusChoice === 'auto'
        ? (sessionContext.isWeekend ? selectedMarket : sessionContext.primaryMarket)
        : focusChoice;
    const activeSecondary: 'US' | 'MY' = activePrimary === 'US' ? 'MY' : 'US';

    const usSignal = us.signal?.mode === mode ? us.signal : null;
    const mySignal = my.signal?.mode === mode ? my.signal : null;
    const usReference = usSignal?.metadata.score_delta?.snapshot_date ?? us.receivedAt;
    const myReference = mySignal?.metadata.score_delta?.snapshot_date ?? my.receivedAt;
    const usBrief = useMemo(() => (usSignal ? buildMarketBrief(usSignal, usReference) : null), [usSignal, usReference]);
    const myBrief = useMemo(() => (mySignal ? buildMarketBrief(mySignal, myReference) : null), [mySignal, myReference]);

    const cardByMarket = {
        US: {
            market: 'US' as const,
            title: 'United States',
            subtitle: 'S&P 500 · Volatility & Positioning',
            slot: { ...us, signal: usSignal, loading: us.loading || usSignal !== us.signal },
            brief: usBrief,
            today: usToday,
        },
        MY: {
            market: 'MY' as const,
            title: 'Malaysia · Bursa',
            subtitle: 'FBM KLCI · Trend, Breadth & FX',
            slot: { ...my, signal: mySignal, loading: my.loading || mySignal !== my.signal },
            brief: myBrief,
            today: myToday,
        },
    };

    const primaryCard = cardByMarket[activePrimary];
    const secondaryCard = cardByMarket[activeSecondary];
    const orderedCards = [
        { ...primaryCard, role: 'primary' as const, roleLabel: focusChoice === 'auto' ? sessionContext.sessionLabel : 'Focused view' },
        {
            ...secondaryCard,
            role: 'secondary' as const,
            roleLabel: focusChoice === 'auto'
                ? sessionContext.secondaryLabel
                : activeSecondary === 'US' ? 'US snapshot' : 'Bursa snapshot',
        },
    ];
    const visibleCards = focusChoice === 'auto' ? orderedCards : [orderedCards[0]];

    const primarySignal = activePrimary === 'US' ? usSignal : mySignal;

    const visibleRecords = useMemo(
        () => (!records ? null : focusChoice === 'auto' ? records : records.filter(record => record.market === activePrimary)),
        [records, focusChoice, activePrimary],
    );

    const focusItems = useMemo<FocusActionItem[]>(() => {
        const list: FocusActionItem[] = [];

        // 1. Personal due/overdue watchlist reviews come first when signed in.
        if (owner && records?.length) {
            const scoped = focusChoice === 'auto'
                ? records
                : records.filter(record => record.market === activePrimary);
            const due = scoped
                .map(record => ({ record, review: watchlistReview(record, todayIso) }))
                .filter(item => item.review.dueThisWeek)
                .slice(0, 2);
            for (const { record, review } of due) {
                list.push({
                    id: `review-${record.market}-${record.symbol}`,
                    tag: review.status === 'overdue' ? 'Review overdue' : 'Due this week',
                    tone: review.status === 'overdue' ? 'down' : 'neutral',
                    title: `Re-check ${record.companyName || record.symbol} thesis`,
                    body: record.notes.trim() || `Scheduled review for ${record.symbol} (${record.market}).`,
                    cta: 'Open research →',
                    run: () => onOpenStock(record.symbol, record.market),
                });
            }
        }

        // 2. Curated fresh headlines from the primary market (context-only, decoupled from scoring).
        const articles = (primarySignal?.metadata.articles ?? []).slice(0, 4);
        for (const [index, article] of articles.entries()) {
            const safeUrl = safeExternalUrl(article.url);
            const age = formatHeadlineAge(article.pubDate);
            list.push({
                id: `news-${activePrimary}-${index}`,
                tag: `${article.source} · Context`,
                tone: 'neutral',
                title: article.title,
                body: `${age ? `${age} · ` : ''}${activePrimary === 'US' ? 'US' : 'Malaysia'} market headline (not scored).`,
                cta: safeUrl ? 'Read →' : 'Market →',
                ...(safeUrl ? { href: safeUrl } : { run: () => onOpenMarket(activePrimary) }),
            });
        }

        // 3. Helpful fallback only if neither personal reviews nor headlines are available.
        if (list.length < 2 && records && records.length === 0) {
            list.push({
                id: 'start-watchlist',
                tag: 'Get started',
                tone: 'neutral',
                title: 'Build your calm watchlist',
                body: 'Search any US or Bursa Malaysia stock or browse Discover to save your first thesis note locally.',
                cta: 'Open Discover →',
                run: onOpenDiscover,
            });
        }
        if (list.length < 2) {
            list.push({
                id: 'stress-check',
                tag: 'Risk check',
                tone: 'neutral',
                title: 'Run a volatility stress test',
                body: 'Preview how a VIX move shifts the composite market score without changing your saved settings.',
                cta: 'Open Market Pulse →',
                run: () => onOpenMarket('US', 'scenarios'),
            });
        }

        return list.slice(0, 4);
    }, [activePrimary, focusChoice, onOpenDiscover, onOpenMarket, onOpenStock, owner, primarySignal, records, todayIso]);

    const totalCostSummary = portfolioSummaries.map(s => `${s.currency} ${fmtMoney(s.costBasis + s.cashBalance, s.currency)}`).join(' · ');

    return (
        <>
            <div className={styles.heroBrief}>
                <div>
                    <div className={styles.kicker}>
                        <span>
                            {focusChoice === 'auto'
                                ? `MYT · ${marketTimestampLabel(todayIso)} UTC · ${mode === 'contrarian' ? 'Contrarian' : 'Momentum'}`
                                : `${sessionContext.sessionLabel} · ${marketTimestampLabel(todayIso)} UTC · ${mode === 'contrarian' ? 'Contrarian' : 'Momentum'}`}
                        </span>
                    </div>
                    <h1 className={`${styles.heroTitle} ${styles.homeTitle}`}>
                        <span>{focusChoice === 'auto' ? sessionContext.sessionLabel : primaryCard.title}</span>
                    </h1>
                </div>
                <div className={styles.heroActions}>
                    <div className={styles.segWrap} role="group" aria-label="Home market focus">
                        <button type="button" className={styles.segBtn} aria-pressed={focusChoice === 'auto'} onClick={() => setFocusOverride('auto')}>Auto (MYT)</button>
                        <button type="button" className={styles.segBtn} aria-pressed={focusChoice === 'US'} onClick={() => setFocusOverride('US')}>US</button>
                        <button type="button" className={styles.segBtn} aria-pressed={focusChoice === 'MY'} onClick={() => setFocusOverride('MY')}>Malaysia</button>
                    </div>
                    <button type="button" className={styles.primaryBtn} onClick={() => onOpenMarket(activePrimary)}>Open Market Pulse →</button>
                </div>
            </div>

            <section
                className={styles.pulseGrid}
                data-layout={focusChoice !== 'auto' ? 'single' : sessionContext.isWeekend ? 'balanced' : 'focused'}
                aria-label="Market pulse summary"
            >
                {visibleCards.map(({ market, title, subtitle, slot, brief, today, role, roleLabel }) => {
                    const delta = slot.signal?.metadata.score_delta?.delta;
                    const snapshotDay = marketEvidenceDay(slot.signal?.metadata.score_delta?.snapshot_date);
                    const tone = toneFor(slot.signal, Boolean(brief && brief.status !== 'unavailable'));
                    const indices = (slot.signal?.metadata.index_trend ?? [])
                        .filter(item => Number.isFinite(item.changePercent))
                        .slice(0, role === 'primary' ? 4 : 1);
                    return (
                        <article key={market} className={styles.pulseCard} data-tone={tone} data-role={role}>
                            <button type="button" className={styles.pulseBody} onClick={() => onOpenMarket(market)}>
                                <div className={styles.pulseInfo}>
                                    <div className={styles.pulseHead}>
                                        <span className={styles.mktTag}>{market}</span>
                                        <strong>{title}</strong>
                                        <span className={styles.toneBadge} data-tone={tone}>{readingFor(slot, brief)}</span>
                                    </div>
                                    <p className={styles.pulseSub}>{roleLabel} · {subtitle}</p>
                                    {role === 'primary' && brief && brief.status !== 'unavailable' && (
                                        <p className={styles.pulseTakeaway}>{brief.conclusion}</p>
                                    )}
                                    {indices.length > 0 && (
                                        <div className={styles.indexTape}>
                                            {indices.map(item => (
                                                <span key={item.symbol} data-direction={item.changePercent > 0 ? 'up' : item.changePercent < 0 ? 'down' : undefined}>
                                                    {indexName(item.symbol)} <b>{signed(item.changePercent)}%</b>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <div className={styles.pulseMeta}>
                                        {slot.error ? (
                                            <span>{slot.error}</span>
                                        ) : slot.signal ? (
                                            <>
                                                <span data-direction={typeof delta === 'number' && delta !== 0 ? (delta > 0 ? 'up' : 'down') : undefined}>
                                                    {typeof delta === 'number'
                                                        ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)} pts vs prior`
                                                        : 'Prior comparison unavailable'}
                                                </span>
                                                <span>{snapshotDay ? `Snapshot ${marketTimestampLabel(snapshotDay)}` : 'Snapshot date unavailable'}</span>
                                            </>
                                        ) : (
                                            <span>Fetching live signal inputs…</span>
                                        )}
                                    </div>
                                </div>
                                <ScoreRing score={slot.signal?.composite_score ?? null} tone={tone} />
                            </button>
                            <V9MarketTodaySummary market={market} href={todayHref(market)} state={today} />
                        </article>
                    );
                })}
            </section>

            <div className={styles.homeColumns}>
                <section className={styles.card} aria-label="Today's Focus">
                    <div className={styles.sectionHead}>
                        <div>
                            <h2>Today’s Focus</h2>
                            <p>Fresh headlines and due reviews for {primaryCard.title}</p>
                        </div>
                        <span className={styles.toneBadge}>{focusItems.length} items</span>
                    </div>
                    <div className={styles.focusList}>
                        {focusItems.map(item => item.href ? (
                            <a key={item.id} href={item.href} target="_blank" rel="noreferrer" className={styles.focusRow}>
                                <div>
                                    <span className={styles.toneBadge} data-tone={item.tone}>{item.tag}</span>
                                    <b>{item.title}</b>
                                    <p>{item.body}</p>
                                </div>
                                <span className={styles.textLink}>{item.cta}</span>
                            </a>
                        ) : (
                            <button key={item.id} type="button" className={styles.focusRow} onClick={item.run}>
                                <div>
                                    <span className={styles.toneBadge} data-tone={item.tone}>{item.tag}</span>
                                    <b>{item.title}</b>
                                    <p>{item.body}</p>
                                </div>
                                <span className={styles.textLink}>{item.cta}</span>
                            </button>
                        ))}
                    </div>
                </section>

                <section className={styles.card} aria-label="Watchlist Pulse">
                    <div className={styles.sectionHead}>
                        <div>
                            <h2>Watchlist Pulse</h2>
                            <p>
                                {visibleRecords === null
                                    ? 'Loading saved workspace…'
                                    : records?.length === 0
                                        ? 'Save stocks to track reviews and thesis notes here'
                                        : focusChoice === 'auto'
                                            ? 'Your saved US and Bursa Malaysia thesis notes'
                                            : activePrimary === 'MY'
                                                ? 'Your saved Bursa Malaysia thesis notes'
                                                : 'Your saved US thesis notes'}
                            </p>
                        </div>
                        <div className={styles.heroActions}>
                            <Link className={`${styles.textLink} ${styles.watchlistLink}`} href={href('research', { tab: 'watchlist' })} prefetch={false}>View all →</Link>
                            <button type="button" className={styles.textLink} onClick={onOpenDiscover}>Discover →</button>
                        </div>
                    </div>
                    {visibleRecords && visibleRecords.length > 0 ? (
                        <div className={styles.watchList}>
                            {visibleRecords.slice(0, 6).map(r => (
                                <button
                                    key={`${r.market}:${r.symbol}`}
                                    type="button"
                                    className={styles.watchRow}
                                    onClick={() => onOpenStock(r.symbol, r.market)}
                                >
                                    <div className={styles.watchLeft}>
                                        <span className={styles.tickerAvatar} data-market={r.market} aria-hidden="true">{r.symbol.slice(0, 2)}</span>
                                        <div className={styles.watchMeta}>
                                            <b>{r.companyName || r.symbol} <span className={styles.mktTag}>{r.market}</span></b>
                                            <small>{r.symbol} · {r.notes.trim() || 'Open to read the latest quote'}</small>
                                        </div>
                                    </div>
                                    <span className={styles.textLink}>Inspect →</span>
                                </button>
                            ))}
                        </div>
                    ) : records && records.length > 0 ? (
                        <div className={styles.watchEmpty}>
                            <p>No saved {activePrimary === 'MY' ? 'Bursa Malaysia' : 'US'} stocks in your watchlist yet.</p>
                            <div className={styles.heroActions}>
                                <Link className={styles.primaryBtn} href={href('research', { tab: 'watchlist' })} prefetch={false}>
                                    View all saved stocks →
                                </Link>
                                <button type="button" className={styles.ghostBtn} onClick={() => setFocusOverride('auto')}>
                                    Show all markets
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.watchEmpty}>
                            <p>No saved stocks yet. Pick a ticker from Quick Stocks in the sidebar or search any US / Bursa symbol to start tracking.</p>
                            <div className={styles.heroActions}>
                                <button type="button" className={styles.primaryBtn} onClick={onOpenDiscover}>Browse Discover →</button>
                                <button type="button" className={styles.ghostBtn} onClick={() => onOpenStock(activePrimary === 'MY' ? '1155' : 'AAPL', activePrimary)}>
                                    Inspect {activePrimary === 'MY' ? 'Maybank (1155)' : 'Apple (AAPL)'} →
                                </button>
                            </div>
                        </div>
                    )}

                    <div className={styles.sleeveBar}>
                        <div className={styles.sleeveHead}>
                            <b>Saved Portfolio Snapshot</b>
                            <span>{totalCostSummary || 'No local CSV holdings imported yet'}</span>
                        </div>
                        {portfolioSummaries.length > 0 ? (
                            <div className={styles.sleeveTrack} aria-hidden="true">
                                {portfolioSummaries.map((summary, idx) => (
                                    <span
                                        key={summary.currency}
                                        style={{
                                            flex: Math.max(1, summary.costBasis + summary.cashBalance),
                                            background: idx === 0 ? 'var(--brand)' : 'var(--score-mark)',
                                        }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <button type="button" className={styles.textLink} onClick={onOpenPortfolio}>
                                Import or view holdings →
                            </button>
                        )}
                    </div>
                </section>
            </div>
        </>
    );
}
