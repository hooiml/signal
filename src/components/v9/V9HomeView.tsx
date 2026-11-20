'use client';

import { useMemo } from 'react';
import type { MarketSignal } from '@/lib/types/signal-v2';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import type { PortfolioActualCurrencySummary } from '@/lib/portfolio/holdings';
import { buildMarketBrief } from '@/lib/market-brief';
import { marketReadingLabel, marketTimestampLabel } from '@/lib/market-display';
import { marketEvidenceDay } from '@/lib/market-evidence-coverage';
import { watchlistReview } from '@/lib/research/watchlist-review';
import { useReviewDay } from '@/lib/research/use-review-day';
import styles from './v9-workspace.module.css';

export type SignalSlot = {
    readonly signal: MarketSignal | null;
    readonly loading: boolean;
    readonly error: string;
    readonly receivedAt?: string;
};

type Tone = 'up' | 'neutral' | 'down';

const toneFor = (signal: MarketSignal | null, available: boolean): Tone => {
    if (!signal || !available) return 'neutral';
    if (signal.tier === 'buy' || signal.tier === 'strong-buy') return 'up';
    if (signal.tier === 'sell' || signal.tier === 'strong-sell') return 'down';
    return 'neutral';
};

const readingFor = (slot: SignalSlot, brief: ReturnType<typeof buildMarketBrief> | null): string => {
    if (slot.loading) return 'Loading';
    if (slot.error || !slot.signal || !brief || brief.status === 'unavailable') return 'Assessment unavailable';
    return `${marketReadingLabel(slot.signal.tier)}${brief.status === 'limited' ? ' (limited evidence)' : ''}`;
};

function ScoreRing({ score }: { readonly score: number | null }) {
    const r = 26;
    const c = 2 * Math.PI * r;
    const pct = score === null ? 0 : Math.min(100, Math.max(0, score)) / 100;
    return (
        <div className={styles.pulseRing} role="img" aria-label={score === null ? 'Score unavailable' : `Score ${score.toFixed(0)} out of 100`}>
            <svg viewBox="0 0 64 64" aria-hidden="true">
                <circle cx="32" cy="32" r={r} fill="none" stroke="var(--surface-muted)" strokeWidth="5.5" />
                <circle
                    cx="32"
                    cy="32"
                    r={r}
                    fill="none"
                    stroke="var(--score-mark)"
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

export function V9HomeView({
    us,
    my,
    mode,
    selectedMarket,
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
    readonly mode: MarketSignal['mode'];
    readonly selectedMarket: 'US' | 'MY';
    readonly records: readonly ResearchRecord[] | null;
    readonly owner: boolean;
    readonly portfolioSummaries: readonly PortfolioActualCurrencySummary[];
    readonly onOpenMarket: (market: 'US' | 'MY', tab?: 'scenarios' | 'evidence') => void;
    readonly onOpenPortfolio: () => void;
    readonly onOpenDiscover: () => void;
    readonly onOpenStock: (symbol: string, market: ResearchMarket) => void;
}) {
    const todayIso = useReviewDay();
    const usSignal = us.signal?.mode === mode ? us.signal : null;
    const mySignal = my.signal?.mode === mode ? my.signal : null;
    const usReference = usSignal?.metadata.score_delta?.snapshot_date ?? us.receivedAt;
    const myReference = mySignal?.metadata.score_delta?.snapshot_date ?? my.receivedAt;
    const usBrief = useMemo(() => (usSignal ? buildMarketBrief(usSignal, usReference) : null), [usSignal, usReference]);
    const myBrief = useMemo(() => (mySignal ? buildMarketBrief(mySignal, myReference) : null), [mySignal, myReference]);

    const focusItems = useMemo(() => {
        const list: { id: string; tag: string; tone: Tone; title: string; body: string; cta: string; run: () => void }[] = [];
        if (owner && records?.length) {
            const due = records
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
        if (usBrief && usBrief.status !== 'available' && usBrief.reasons[0]) {
            list.push({
                id: 'us-evidence',
                tag: 'US Market evidence',
                tone: 'neutral',
                title: usBrief.status === 'unavailable' ? 'US assessment unavailable' : 'US assessment has evidence limits',
                body: usBrief.reasons[0].text,
                cta: 'Inspect Market →',
                run: () => onOpenMarket('US', 'evidence'),
            });
        }
        if (myBrief && myBrief.status !== 'available' && myBrief.reasons[0]) {
            list.push({
                id: 'my-evidence',
                tag: 'Malaysia evidence',
                tone: 'neutral',
                title: myBrief.status === 'unavailable' ? 'Malaysia assessment unavailable' : 'Malaysia assessment has evidence limits',
                body: myBrief.reasons[0].text,
                cta: 'Inspect Bursa →',
                run: () => onOpenMarket('MY', 'evidence'),
            });
        }
        if (records && records.length === 0) {
            list.push({
                id: 'start-watchlist',
                tag: 'Get started',
                tone: 'neutral',
                title: 'Build your calm watchlist',
                body: 'Search any US or Bursa Malaysia stock or browse Discover to save your first thesis note locally.',
                cta: 'Open Discover →',
                run: onOpenDiscover,
            });
        } else if (records && records.length > 0 && list.length < 3) {
            const withoutNote = records.find(r => !r.notes.trim());
            if (withoutNote) {
                list.push({
                    id: `note-${withoutNote.symbol}`,
                    tag: 'Thesis note',
                    tone: 'neutral',
                    title: `Add a calm thesis for ${withoutNote.symbol}`,
                    body: `You saved ${withoutNote.companyName || withoutNote.symbol} (${withoutNote.market}) without a note yet.`,
                    cta: 'Write note →',
                    run: () => onOpenStock(withoutNote.symbol, withoutNote.market),
                });
            }
        }
        if (list.length < 2) {
            list.push({
                id: 'stress-check',
                tag: 'Risk check',
                tone: 'neutral',
                title: 'Run a volatility stress test',
                body: 'Preview how a VIX spike shifts the composite market score without changing your saved settings.',
                cta: 'Open Market Pulse →',
                run: () => onOpenMarket('US', 'scenarios'),
            });
        }
        return list.slice(0, 3);
    }, [myBrief, onOpenDiscover, onOpenMarket, onOpenStock, owner, records, todayIso, usBrief]);

    const pulseCards: readonly {
        market: 'US' | 'MY';
        title: string;
        subtitle: string;
        slot: SignalSlot;
        brief: ReturnType<typeof buildMarketBrief> | null;
    }[] = [
        { market: 'US', title: 'United States', subtitle: 'S&P 500 · Volatility & Positioning', slot: { ...us, signal: usSignal, loading: us.loading || usSignal !== us.signal }, brief: usBrief },
        { market: 'MY', title: 'Malaysia · Bursa', subtitle: 'FBM KLCI · Regional Proxy & News', slot: { ...my, signal: mySignal, loading: my.loading || mySignal !== my.signal }, brief: myBrief },
    ];

    const briefCard = pulseCards.find(({ market }) => market === selectedMarket);
    const primaryBrief = briefCard?.brief;
    const briefTitle = `Daily Brief · ${selectedMarket === 'US' ? 'US' : 'Malaysia'}`;
    const totalCostSummary = portfolioSummaries.map(s => `${s.currency} ${fmtMoney(s.costBasis + s.cashBalance, s.currency)}`).join(' · ');

    return (
        <>
            <div className={styles.heroBrief}>
                <div>
                    <div className={styles.kicker}>
                        <span>Market Briefing · {marketTimestampLabel(todayIso)} · {mode === 'contrarian' ? 'Contrarian' : 'Momentum'}</span>
                    </div>
                    <h1 className={`${styles.heroTitle} ${styles.homeTitle}`}>
                        {pulseCards.map(({ market, slot, brief }) => (
                            <span key={market}>{market === 'US' ? 'US' : 'Malaysia'}: {readingFor(slot, brief).toLowerCase()}</span>
                        ))}
                    </h1>
                </div>
                <div className={styles.heroActions}>
                    <button type="button" className={styles.primaryBtn} onClick={() => onOpenMarket(selectedMarket)}>Open Market Pulse →</button>
                    <button type="button" className={styles.ghostBtn} onClick={onOpenPortfolio}>
                        Portfolio{portfolioSummaries.length ? ` (${portfolioSummaries.length} ccy)` : ''}
                    </button>
                </div>
            </div>

            <section className={styles.pulseGrid} aria-label="Market pulse summary">
                {pulseCards.map(({ market, title, subtitle, slot, brief }) => {
                    const delta = slot.signal?.metadata.score_delta?.delta;
                    const snapshotDay = marketEvidenceDay(slot.signal?.metadata.score_delta?.snapshot_date);
                    const tone = toneFor(slot.signal, Boolean(brief && brief.status !== 'unavailable'));
                    return (
                        <button
                            key={market}
                            type="button"
                            className={styles.pulseCard}
                            onClick={() => onOpenMarket(market)}
                        >
                            <div className={styles.pulseInfo}>
                                <div className={styles.pulseHead}>
                                    <span className={styles.mktTag}>{market}</span>
                                    <strong>{title}</strong>
                                    <span className={styles.toneBadge} data-tone={tone}>{readingFor(slot, brief)}</span>
                                </div>
                                <p className={styles.pulseSub}>{subtitle}</p>
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
                            <ScoreRing score={slot.signal?.composite_score ?? null} />
                        </button>
                    );
                })}
            </section>

            {primaryBrief ? (
                <details className={styles.dailyStrip}>
                    <summary>
                        <span><strong>{briefTitle}</strong> <span className={styles.dailyConclusion}>{primaryBrief.conclusion}</span></span>
                        <span className={`${styles.textLink} ${styles.briefToggle}`} aria-hidden="true">
                            <span className={styles.briefExpand}>Expand brief ▾</span>
                            <span className={styles.briefCollapse}>Collapse brief ▴</span>
                        </span>
                    </summary>
                    <div className={styles.dailyStripBody}>
                        <div>
                            <b>What changed</b>
                            <span>{primaryBrief.change.text}</span>
                        </div>
                        <div>
                            <b>Leading evidence</b>
                            <span>
                                {primaryBrief.supportKey
                                    ? `Support: ${primaryBrief.supportKey.toUpperCase()}`
                                    : 'No fresh aligned support'}
                                {' · '}
                                {primaryBrief.conflictKey
                                    ? `Conflict: ${primaryBrief.conflictKey.toUpperCase()}`
                                    : 'No fresh conflict'}
                            </span>
                        </div>
                        <div>
                            <b>What to watch</b>
                            <span>{primaryBrief.watch[0]?.text ?? 'Monitor input freshness and regime shifts.'}</span>
                        </div>
                    </div>
                </details>
            ) : (
                <div className={styles.dailyStrip} role="status">
                    <p className={styles.dailyStatus}>
                        <strong>{briefTitle}</strong>
                        <span className={styles.dailyConclusion}>
                            {briefCard?.slot.loading ? 'Loading the current brief…' : briefCard?.slot.error ? 'The current brief could not be loaded.' : 'The current brief is unavailable.'}
                        </span>
                    </p>
                </div>
            )}

            <div className={styles.homeColumns}>
                <section className={styles.card} aria-label="Today's Focus">
                    <div className={styles.sectionHead}>
                        <div>
                            <h2>Today’s Focus</h2>
                            <p>Calm actions grounded in your live signals and workspace</p>
                        </div>
                        <span className={styles.toneBadge}>{focusItems.length} items</span>
                    </div>
                    <div className={styles.focusList}>
                        {focusItems.map(item => (
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
                                {records === null
                                    ? 'Loading saved workspace…'
                                    : records.length
                                        ? 'Click any saved security to open full stock research'
                                        : 'No saved stocks yet — jump into a popular US or MY company'}
                            </p>
                        </div>
                        <button type="button" className={styles.textLink} onClick={onOpenDiscover}>Discover →</button>
                    </div>
                    <div className={styles.watchList}>
                        {(records && records.length > 0
                            ? records.slice(0, 6).map(r => ({
                                symbol: r.symbol,
                                market: r.market,
                                name: r.companyName || r.symbol,
                                meta: r.notes.trim() || 'Open to read the latest quote',
                            }))
                            : [
                                { symbol: 'AAPL', market: 'US' as const, name: 'Apple Inc.', meta: 'US · Consumer Tech · quick preview' },
                                { symbol: 'MSFT', market: 'US' as const, name: 'Microsoft Corp.', meta: 'US · Cloud & Software · quick preview' },
                                { symbol: '1155', market: 'MY' as const, name: 'Maybank', meta: 'MY · Bursa Banking · quick preview' },
                                { symbol: '5347', market: 'MY' as const, name: 'Tenaga Nasional', meta: 'MY · Bursa Utilities · quick preview' },
                            ]
                        ).map(item => (
                            <button
                                key={`${item.market}:${item.symbol}`}
                                type="button"
                                className={styles.watchRow}
                                onClick={() => onOpenStock(item.symbol, item.market)}
                            >
                                <div className={styles.watchLeft}>
                                    <span className={styles.tickerAvatar} aria-hidden="true">{item.symbol.slice(0, 2)}</span>
                                    <div className={styles.watchMeta}>
                                        <b>{item.name} <span className={styles.mktTag}>{item.market}</span></b>
                                        <small>{item.symbol} · {item.meta}</small>
                                    </div>
                                </div>
                                <span className={styles.textLink}>Inspect →</span>
                            </button>
                        ))}
                    </div>

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
