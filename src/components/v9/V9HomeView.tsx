'use client';

import { useMemo } from 'react';
import type { MarketSignal } from '@/lib/types/signal-v2';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import type { PortfolioActualCurrencySummary } from '@/lib/portfolio/holdings';
import { buildMarketBrief } from '@/lib/market-brief';
import { marketReadingLabel } from '@/lib/market-display';
import { watchlistReview } from '@/lib/research/watchlist-review';
import styles from './v9-workspace.module.css';

export type SignalSlot = {
    readonly signal: MarketSignal | null;
    readonly loading: boolean;
    readonly error: string;
};

type Tone = 'up' | 'neutral' | 'down';

const toneFor = (signal: MarketSignal | null, available: boolean): Tone => {
    if (!signal || !available) return 'neutral';
    if (signal.tier === 'buy' || signal.tier === 'strong-buy') return 'up';
    if (signal.tier === 'sell' || signal.tier === 'strong-sell') return 'down';
    return 'neutral';
};

const headlineFor = (us: MarketSignal | null, my: MarketSignal | null, usOk: boolean, myOk: boolean): string => {
    if (!us && !my) return 'Checking live US and Malaysia market conditions.';
    if (!usOk && !myOk) return 'Market evidence is currently limited — review coverage before acting.';
    const scores = [usOk && us ? us.composite_score : null, myOk && my ? my.composite_score : null].filter((v): v is number => v !== null);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 50;
    if (avg >= 65) return 'Your markets are calm and constructive.';
    if (avg < 40) return 'Risk signals are elevated — stay selective and patient.';
    return 'Your markets are balanced with mixed signals.';
};

function ScoreRing({ score, tone }: { readonly score: number | null; readonly tone: Tone }) {
    const r = 26;
    const c = 2 * Math.PI * r;
    const pct = score === null ? 0 : Math.min(100, Math.max(0, score)) / 100;
    const stroke = tone === 'up' ? 'var(--up-mark)' : tone === 'down' ? 'var(--down-mark)' : 'var(--caution-mark)';
    return (
        <div className={styles.pulseRing} aria-hidden="true">
            <svg viewBox="0 0 64 64">
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

export function V9HomeView({
    us,
    my,
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
    readonly records: readonly ResearchRecord[] | null;
    readonly owner: boolean;
    readonly portfolioSummaries: readonly PortfolioActualCurrencySummary[];
    readonly onOpenMarket: (market: 'US' | 'MY') => void;
    readonly onOpenPortfolio: () => void;
    readonly onOpenDiscover: () => void;
    readonly onOpenStock: (symbol: string, market: ResearchMarket) => void;
}) {
    const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
    const usDay = us.signal?.metadata.score_delta?.snapshot_date ?? todayIso;
    const myDay = my.signal?.metadata.score_delta?.snapshot_date ?? todayIso;
    const usBrief = useMemo(() => (us.signal ? buildMarketBrief(us.signal, usDay) : null), [us.signal, usDay]);
    const myBrief = useMemo(() => (my.signal ? buildMarketBrief(my.signal, myDay) : null), [my.signal, myDay]);
    const usAvail = Boolean(usBrief && usBrief.status !== 'unavailable');
    const myAvail = Boolean(myBrief && myBrief.status !== 'unavailable');
    const usTone = toneFor(us.signal, usAvail);
    const myTone = toneFor(my.signal, myAvail);
    const leadTone: Tone = usTone === 'down' || myTone === 'down' ? 'down' : usTone === 'up' || myTone === 'up' ? 'up' : 'neutral';

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
                    body: record.notes.trim() ? record.notes.trim().slice(0, 110) : `Scheduled review for ${record.symbol} (${record.market}).`,
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
                run: () => onOpenMarket('US'),
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
                run: () => onOpenMarket('MY'),
            });
        }
        if (records && records.length === 0) {
            list.push({
                id: 'start-watchlist',
                tag: 'Get started',
                tone: 'up',
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
                tone: 'up',
                title: 'Run a volatility stress test',
                body: 'Preview how a VIX spike shifts the composite market score without changing your saved settings.',
                cta: 'Open Market Pulse →',
                run: () => onOpenMarket('US'),
            });
        }
        return list.slice(0, 3);
    }, [myBrief, onOpenDiscover, onOpenMarket, onOpenStock, owner, records, todayIso, usBrief]);

    const pulseCards: readonly {
        market: 'US' | 'MY';
        title: string;
        subtitle: string;
        slot: SignalSlot;
        avail: boolean;
        tone: Tone;
    }[] = [
        { market: 'US', title: 'United States', subtitle: 'S&P 500 · Volatility & Positioning', slot: us, avail: usAvail, tone: usTone },
        { market: 'MY', title: 'Malaysia · Bursa', subtitle: 'FBM KLCI · Regional Proxy & News', slot: my, avail: myAvail, tone: myTone },
    ];

    const primaryBrief = usBrief ?? myBrief;
    const totalCostSummary = portfolioSummaries.map(s => `${s.currency} ${fmtMoney(s.costBasis + s.cashBalance, s.currency)}`).join(' · ');

    return (
        <>
            <div className={styles.heroBrief}>
                <div>
                    <div className={styles.kicker}>
                        <span className={styles.kickerDot} data-tone={leadTone} aria-hidden="true" />
                        <span>Morning Briefing · {todayIso} · Momentum</span>
                    </div>
                    <h1 className={styles.heroTitle}>{headlineFor(us.signal, my.signal, usAvail, myAvail)}</h1>
                </div>
                <div className={styles.heroActions}>
                    <button type="button" className={styles.primaryBtn} onClick={() => onOpenMarket('US')}>Open Market Pulse →</button>
                    <button type="button" className={styles.ghostBtn} onClick={onOpenPortfolio}>
                        Portfolio{portfolioSummaries.length ? ` (${portfolioSummaries.length} ccy)` : ''}
                    </button>
                </div>
            </div>

            <section className={styles.pulseGrid} aria-label="Market pulse summary">
                {pulseCards.map(({ market, title, subtitle, slot, avail, tone }) => {
                    const delta = slot.signal?.metadata.score_delta?.delta;
                    const reading = slot.loading
                        ? 'Loading…'
                        : slot.error
                            ? 'Unavailable'
                            : !avail
                                ? 'Limited / Unavailable'
                                : slot.signal
                                    ? marketReadingLabel(slot.signal.tier)
                                    : 'Unavailable';
                    return (
                        <button
                            key={market}
                            type="button"
                            className={styles.pulseCard}
                            data-tone={tone}
                            onClick={() => onOpenMarket(market)}
                        >
                            <div className={styles.pulseInfo}>
                                <div className={styles.pulseHead}>
                                    <span className={styles.mktTag}>{market}</span>
                                    <strong>{title}</strong>
                                    <span className={styles.toneBadge} data-tone={tone}>{reading}</span>
                                </div>
                                <p className={styles.pulseSub}>{subtitle}</p>
                                <div className={styles.pulseMeta}>
                                    {slot.error ? (
                                        <span>{slot.error}</span>
                                    ) : slot.signal ? (
                                        <>
                                            <span>
                                                {typeof delta === 'number'
                                                    ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)} pts vs prior`
                                                    : 'Prior comparison unavailable'}
                                            </span>
                                            <span>· Snapshot {slot.signal.metadata.score_delta?.snapshot_date || todayIso}</span>
                                        </>
                                    ) : (
                                        <span>Fetching live signal inputs…</span>
                                    )}
                                </div>
                            </div>
                            <ScoreRing score={slot.signal ? slot.signal.composite_score : null} tone={tone} />
                        </button>
                    );
                })}
            </section>

            {primaryBrief && (
                <details className={styles.dailyStrip}>
                    <summary>
                        <span><strong>Daily Brief</strong> · {primaryBrief.conclusion}</span>
                        <span className={styles.textLink}>Expand brief ▾</span>
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
                                meta: r.notes.trim() ? r.notes.trim().slice(0, 64) : 'Saved on device · open to read live quote',
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
                                            background: idx === 0 ? 'var(--up-mark)' : 'var(--caution-mark)',
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
