'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import type { ResearchChartPoint, ResearchSnapshot } from '@/lib/types/research-snapshot';
import { parseResearchSnapshotResponse } from '@/lib/research/snapshot-input';
import { saveGuestSecurity, updateGuestNote } from '@/lib/research/guest-workspace';
import { readData, readPolicies } from '@/components/v8/read-data';
import styles from './v9-workspace.module.css';

type ChartRange = '1M' | '3M' | '1Y' | '5Y';

const defaultTickers: readonly { symbol: string; market: ResearchMarket }[] = [
    { symbol: 'AAPL', market: 'US' },
    { symbol: 'MSFT', market: 'US' },
    { symbol: 'NVDA', market: 'US' },
    { symbol: '1155', market: 'MY' },
    { symbol: '1295', market: 'MY' },
    { symbol: '5347', market: 'MY' },
];

const inferMarket = (raw: string): ResearchMarket => (/^\d{4}(\.KL)?$/i.test(raw.trim()) || raw.trim().toUpperCase().endsWith('.KL') ? 'MY' : 'US');

const fmtCompact = (value: number | null, currency?: string | null): string => {
    if (value === null || !Number.isFinite(value)) return 'Unavailable';
    const abs = Math.abs(value);
    const sign = value < 0 ? '−' : '';
    const prefix = currency ? `${currency} ` : '';
    if (abs >= 1e12) return `${sign}${prefix}${(abs / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `${sign}${prefix}${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}${prefix}${(abs / 1e6).toFixed(1)}M`;
    return `${sign}${prefix}${abs.toFixed(2)}`;
};

const fmtPrice = (value: number | null, currency: string | null): string => {
    if (value === null || !Number.isFinite(value)) return 'Unavailable';
    return `${currency ? `${currency} ` : ''}${value.toFixed(2)}`;
};

function PriceChart({
    points,
    currency,
    range,
    onRangeChange,
}: {
    readonly points: readonly ResearchChartPoint[];
    readonly currency: string | null;
    readonly range: ChartRange;
    readonly onRangeChange: (next: ChartRange) => void;
}) {
    const gradId = `v9-price-grad-${useId().replace(/:/g, '')}`;
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);

    const sliced = useMemo(() => {
        if (!points.length) return [];
        const counts: Record<ChartRange, number> = { '1M': 22, '3M': 66, '1Y': 252, '5Y': 1260 };
        return points.slice(-counts[range]);
    }, [points, range]);

    const bounds = useMemo(() => {
        if (!sliced.length) return { min: 0, max: 1 };
        const closes = sliced.map(p => p.close);
        const min = Math.min(...closes);
        const max = Math.max(...closes);
        return { min, max: max === min ? min + 1 : max };
    }, [sliced]);

    const activeIdx = hoverIndex !== null && hoverIndex < sliced.length ? hoverIndex : sliced.length - 1;
    const active = sliced[activeIdx] ?? null;
    const first = sliced[0] ?? null;
    const periodPct = active && first && first.close > 0 ? ((active.close - first.close) / first.close) * 100 : null;
    const isUp = (periodPct ?? 0) >= 0;
    const stroke = isUp ? 'var(--up-mark)' : 'var(--down-mark)';

    const coords = useMemo(() => {
        if (!sliced.length) return [];
        const w = 640;
        const h = 190;
        const padY = 14;
        return sliced.map((point, index) => {
            const x = sliced.length === 1 ? w / 2 : (index / (sliced.length - 1)) * w;
            const y = padY + ((bounds.max - point.close) / (bounds.max - bounds.min)) * (h - padY * 2);
            return { x, y, point };
        });
    }, [bounds.max, bounds.min, sliced]);

    const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
    const areaPath = coords.length > 1 ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} 200 L ${coords[0].x.toFixed(1)} 200 Z` : '';
    const activeCoord = coords[activeIdx] ?? null;

    return (
        <div className={styles.chartBox}>
            <div className={styles.chartControls}>
                <div className={styles.segWrap} role="group" aria-label="Chart range">
                    {(['1M', '3M', '1Y', '5Y'] as const).map(item => (
                        <button
                            key={item}
                            type="button"
                            className={styles.segBtn}
                            aria-pressed={range === item}
                            onClick={() => { setHoverIndex(null); onRangeChange(item); }}
                        >
                            {item}
                        </button>
                    ))}
                </div>
                <span className={styles.chartMeta}>
                    {active ? (
                        <>
                            <strong>{fmtPrice(active.close, currency)}</strong> · {active.time.slice(0, 10)}
                            {periodPct !== null && ` (${periodPct >= 0 ? '+' : ''}${periodPct.toFixed(2)}% over ${range})`}
                        </>
                    ) : (
                        'Price series unavailable'
                    )}
                </span>
            </div>

            {coords.length > 1 ? (
                <svg
                    className={styles.chartSvg}
                    viewBox="0 0 640 200"
                    role="img"
                    aria-label={`Price history over ${range}`}
                    onPointerMove={event => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        if (!rect.width || !coords.length) return;
                        const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
                        setHoverIndex(Math.round(ratio * (coords.length - 1)));
                    }}
                    onPointerLeave={() => setHoverIndex(null)}
                >
                    <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={stroke} stopOpacity="0.24" />
                            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <path d={areaPath} fill={`url(#${gradId})`} />
                    <path d={linePath} fill="none" stroke={stroke} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
                    {activeCoord && (
                        <>
                            <line x1={activeCoord.x.toFixed(1)} y1="10" x2={activeCoord.x.toFixed(1)} y2="196" stroke="var(--line-strong)" strokeDasharray="3 4" />
                            <circle cx={activeCoord.x.toFixed(1)} cy={activeCoord.y.toFixed(1)} r="8" fill={stroke} opacity="0.2" />
                            <circle cx={activeCoord.x.toFixed(1)} cy={activeCoord.y.toFixed(1)} r="4.5" fill="var(--surface)" stroke={stroke} strokeWidth="2.5" />
                        </>
                    )}
                </svg>
            ) : (
                <p style={{ margin: '12px 0', color: 'var(--muted)', fontSize: 13 }}>Historical price closes were not returned for this security.</p>
            )}
        </div>
    );
}

export function V9ResearchView({
    symbol,
    market,
    records,
    owner,
    onSelectStock,
    onSavedGuest,
}: {
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly records: readonly ResearchRecord[] | null;
    readonly owner: boolean;
    readonly onSelectStock: (symbol: string, market: ResearchMarket) => void;
    readonly onSavedGuest: () => void;
}) {
    const [input, setInput] = useState('');
    const [range, setRange] = useState<ChartRange>('3M');
    const [snapshot, setSnapshot] = useState<ResearchSnapshot | null>(null);
    const [extendedPoints, setExtendedPoints] = useState<readonly ResearchChartPoint[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [targetPrice, setTargetPrice] = useState<number | null>(null);
    const [noteDraft, setNoteDraft] = useState('');
    const [saveStatus, setSaveStatus] = useState('');
    const [saveError, setSaveError] = useState('');
    const [saving, setSaving] = useState(false);

    const savedRecord = useMemo(
        () => (records ?? []).find(r => r.symbol.toUpperCase() === symbol.toUpperCase() && r.market === market) ?? null,
        [market, records, symbol],
    );

    useEffect(() => {
        setNoteDraft(savedRecord?.notes ?? '');
        setSaveStatus('');
        setSaveError('');
    }, [savedRecord, symbol, market]);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError('');
        setExtendedPoints(null);
        setTargetPrice(null);
        readData(`/api/research/symbol/${encodeURIComponent(symbol)}?market=${market}`, controller.signal, readPolicies.provider)
            .then(payload => parseResearchSnapshotResponse(payload))
            .then(result => {
                setSnapshot(result);
                if (typeof result.quote.price === 'number') {
                    setTargetPrice(Number((result.quote.price * 0.9).toFixed(2)));
                }
            })
            .catch(cause => {
                if (!controller.signal.aborted) {
                    setSnapshot(null);
                    setError(cause instanceof Error ? cause.message : 'Security research could not be loaded.');
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [symbol, market]);

    useEffect(() => {
        if (range !== '5Y' || extendedPoints !== null || !snapshot) return;
        const controller = new AbortController();
        fetch(`/api/research/chart/${encodeURIComponent(symbol)}?market=${market}`, { signal: controller.signal })
            .then(r => (r.ok ? r.json() : null))
            .then(payload => {
                if (payload?.success && Array.isArray(payload.data?.chart)) {
                    setExtendedPoints(payload.data.chart as ResearchChartPoint[]);
                }
            })
            .catch(() => { /* Keep default snapshot chart points when 5Y fetch fails. */ });
        return () => controller.abort();
    }, [extendedPoints, market, range, snapshot, symbol]);

    const pills = useMemo(() => {
        const seen = new Set<string>();
        const list: { symbol: string; market: ResearchMarket }[] = [];
        for (const r of records ?? []) {
            const key = `${r.market}:${r.symbol.toUpperCase()}`;
            if (!seen.has(key)) { seen.add(key); list.push({ symbol: r.symbol.toUpperCase(), market: r.market }); }
        }
        for (const item of defaultTickers) {
            const key = `${item.market}:${item.symbol}`;
            if (!seen.has(key) && list.length < 8) { seen.add(key); list.push(item); }
        }
        return list;
    }, [records]);

    const livePrice = snapshot?.quote.price ?? null;
    const low52 = snapshot?.technicals.low52Week ?? (livePrice ? Number((livePrice * 0.72).toFixed(2)) : null);
    const high52 = snapshot?.technicals.high52Week ?? (livePrice ? Number((livePrice * 1.28).toFixed(2)) : null);
    const gapPct = livePrice && targetPrice && targetPrice > 0 ? ((livePrice - targetPrice) / targetPrice) * 100 : null;
    const annuals = useMemo(() => (snapshot?.fundamentals.history ?? []).slice(-5), [snapshot]);
    const maxAnnualVal = useMemo(() => {
        const vals = annuals.flatMap(a => [a.annualRevenue ?? 0, Math.max(0, a.freeCashFlow ?? 0)]);
        return Math.max(1, ...vals);
    }, [annuals]);

    async function handleSaveNote() {
        if (owner || saving) return;
        setSaving(true);
        setSaveError('');
        setSaveStatus('');
        try {
            const existing = savedRecord ?? await saveGuestSecurity(symbol, market, snapshot?.quote.name || symbol);
            if (noteDraft !== existing.notes) {
                await updateGuestNote(symbol, market, noteDraft, existing.notes);
            }
            onSavedGuest();
            setSaveStatus('Saved locally in this browser.');
        } catch (cause) {
            setSaveError(cause instanceof Error ? cause.message : 'Could not save guest note.');
        } finally {
            setSaving(false);
        }
    }

    const deepDiveHref = `/research-v8?ticker=${encodeURIComponent(symbol)}&market=${market}`;

    return (
        <>
            <div className={styles.researchBar}>
                <form
                    className={styles.tickerInputForm}
                    onSubmit={event => {
                        event.preventDefault();
                        const cleaned = input.trim().toUpperCase().replace(/\.KL$/i, '');
                        if (!cleaned) return;
                        onSelectStock(cleaned, inferMarket(input));
                        setInput('');
                    }}
                >
                    <input
                        type="text"
                        className={styles.tickerInput}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Open ticker (e.g. AAPL, MSFT, 1155, 5347)…"
                        aria-label="Open stock ticker"
                    />
                    <button type="submit" className={styles.primaryBtn}>Open</button>
                </form>

                <div className={styles.quickPills} role="group" aria-label="Quick tickers">
                    {pills.map(item => (
                        <button
                            key={`${item.market}:${item.symbol}`}
                            type="button"
                            className={styles.quickPill}
                            aria-pressed={item.symbol === symbol.toUpperCase() && item.market === market}
                            onClick={() => onSelectStock(item.symbol, item.market)}
                        >
                            {item.market} {item.symbol}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className={styles.card} role="alert">
                    <strong>Could not load {symbol} ({market})</strong>
                    <p style={{ margin: '6px 0 12px', color: 'var(--muted)' }}>{error}</p>
                    <Link className={styles.ghostBtn} href={deepDiveHref}>Open in V8 Research →</Link>
                </div>
            )}

            {loading && !snapshot && (
                <div className={styles.card} role="status">
                    Loading live quote and fundamentals for {symbol} ({market})…
                </div>
            )}

            {snapshot && (
                <div className={styles.researchLayout}>
                    <div className={styles.researchStack}>
                        <section className={styles.card} aria-label="Security price and key metrics">
                            <div className={styles.quoteHead}>
                                <div className={styles.quoteTitle}>
                                    <h1>{snapshot.quote.name || snapshot.symbol}</h1>
                                    <p>
                                        {snapshot.market} · {snapshot.symbol}
                                        {snapshot.quote.classification?.sector ? ` · ${snapshot.quote.classification.sector}` : ''}
                                        {snapshot.valuation.marketCap ? ` · Mkt Cap ${fmtCompact(snapshot.valuation.marketCap, snapshot.quote.currency)}` : ''}
                                    </p>
                                </div>
                                <div className={styles.quotePrice}>
                                    <strong>{fmtPrice(snapshot.quote.price, snapshot.quote.currency)}</strong>
                                    {typeof snapshot.quote.dailyChangePercent === 'number' && (
                                        <span
                                            className={styles.toneBadge}
                                            data-tone={snapshot.quote.dailyChangePercent >= 0 ? 'up' : 'down'}
                                        >
                                            {snapshot.quote.dailyChangePercent >= 0 ? '+' : ''}
                                            {snapshot.quote.dailyChangePercent.toFixed(2)}% today
                                        </span>
                                    )}
                                    <small style={{ display: 'block', marginTop: 4 }}>
                                        Observed {snapshot.quote.observedAt ? snapshot.quote.observedAt.slice(0, 10) : snapshot.fetchedAt.slice(0, 10)}
                                    </small>
                                </div>
                            </div>

                            <PriceChart
                                points={range === '5Y' && extendedPoints ? extendedPoints : snapshot.chart.points}
                                currency={snapshot.quote.currency}
                                range={range}
                                onRangeChange={setRange}
                            />

                            <div className={styles.metricGrid}>
                                <div className={styles.metricTile}>
                                    <small>P/E Ratio</small>
                                    <strong>{snapshot.valuation.priceEarnings !== null ? `${snapshot.valuation.priceEarnings.toFixed(1)}×` : 'N/A'}</strong>
                                    <span>{snapshot.valuation.reportingPeriod ?? 'Reported'}</span>
                                </div>
                                <div className={styles.metricTile}>
                                    <small>FCF Yield</small>
                                    <strong>{snapshot.valuation.freeCashFlowYieldPercent !== null ? `${snapshot.valuation.freeCashFlowYieldPercent.toFixed(2)}%` : 'N/A'}</strong>
                                    <span>Annual cash flow</span>
                                </div>
                                <div className={styles.metricTile}>
                                    <small>Operating Margin</small>
                                    <strong>{snapshot.fundamentals.operatingMarginPercent !== null ? `${snapshot.fundamentals.operatingMarginPercent.toFixed(1)}%` : 'N/A'}</strong>
                                    <span>{snapshot.fundamentals.reportingPeriod ?? 'Latest fiscal'}</span>
                                </div>
                                <div className={styles.metricTile}>
                                    <small>Revenue Growth</small>
                                    <strong>{snapshot.fundamentals.revenueGrowthPercent !== null ? `${snapshot.fundamentals.revenueGrowthPercent >= 0 ? '+' : ''}${snapshot.fundamentals.revenueGrowthPercent.toFixed(1)}%` : 'N/A'}</strong>
                                    <span>Year over year</span>
                                </div>
                            </div>
                        </section>

                        <section className={styles.card} aria-label="Annual financials">
                            <div className={styles.sectionHead}>
                                <div>
                                    <h2>Annual Financials</h2>
                                    <p>Revenue vs Free Cash Flow ({snapshot.fundamentals.source ?? 'Provider statements'})</p>
                                </div>
                                <Link className={styles.textLink} href={deepDiveHref}>Full V8 filings & peers →</Link>
                            </div>
                            {annuals.length > 0 ? (
                                <div className={styles.finBars}>
                                    {annuals.map(period => {
                                        const revH = Math.max(8, Math.round(((period.annualRevenue ?? 0) / maxAnnualVal) * 106));
                                        const fcfH = Math.max(6, Math.round((Math.max(0, period.freeCashFlow ?? 0) / maxAnnualVal) * 106));
                                        return (
                                            <div key={period.reportingPeriod} className={styles.finCol} title={`Rev: ${fmtCompact(period.annualRevenue, period.currency)} · FCF: ${fmtCompact(period.freeCashFlow, period.currency)}`}>
                                                <div className={styles.finPair}>
                                                    <span className={styles.finBarRev} style={{ height: revH }} />
                                                    <span className={styles.finBarFcf} style={{ height: fcfH }} />
                                                </div>
                                                <small>{period.reportingPeriod.slice(0, 4)}</small>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
                                    Multi-year financial history was not returned for this listing.
                                </p>
                            )}
                        </section>
                    </div>

                    <div className={styles.researchStack}>
                        {livePrice !== null && low52 !== null && high52 !== null && targetPrice !== null && (
                            <section className={styles.card} aria-label="Target entry guardrail">
                                <div className={styles.sectionHead}>
                                    <div>
                                        <h2>Target Entry Guardrail</h2>
                                        <p>Local planning slider · saves nothing</p>
                                    </div>
                                    {gapPct !== null && (
                                        <span className={styles.toneBadge} data-tone={gapPct <= 0 ? 'up' : 'neutral'}>
                                            {gapPct >= 0 ? `${gapPct.toFixed(1)}% above` : `${Math.abs(gapPct).toFixed(1)}% below`} target
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)' }}>
                                    <span>Your Calm Entry Target</span>
                                    <strong style={{ color: 'var(--ink)' }}>{fmtPrice(targetPrice, snapshot.quote.currency)}</strong>
                                </div>
                                <input
                                    type="range"
                                    className={styles.guardrailSlider}
                                    min={low52}
                                    max={high52}
                                    step={Math.max(0.01, Number(((high52 - low52) / 100).toFixed(2)))}
                                    value={targetPrice}
                                    onChange={e => setTargetPrice(Number(e.target.value))}
                                    aria-label="Target entry price"
                                />
                                <div className={styles.guardrailRange}>
                                    <span>52W Low {fmtPrice(low52, snapshot.quote.currency)}</span>
                                    <span>Now {fmtPrice(livePrice, snapshot.quote.currency)}</span>
                                    <span>52W High {fmtPrice(high52, snapshot.quote.currency)}</span>
                                </div>
                            </section>
                        )}

                        <section className={styles.card} aria-label="Thesis and note">
                            <div className={styles.sectionHead}>
                                <div>
                                    <h2>Your Thesis & Note</h2>
                                    <p>{owner ? 'Owner workspace record' : 'Saved locally in this browser'}</p>
                                </div>
                                {savedRecord && <span className={styles.toneBadge} data-tone="up">Saved</span>}
                            </div>
                            {owner ? (
                                <div style={{ display: 'grid', gap: 12 }}>
                                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
                                        {savedRecord?.notes?.trim() || 'No thesis note written yet for this stock.'}
                                    </p>
                                    <Link className={styles.primaryBtn} href={deepDiveHref}>Edit in Owner Research →</Link>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gap: 10 }}>
                                    <textarea
                                        rows={5}
                                        value={noteDraft}
                                        onChange={e => setNoteDraft(e.target.value)}
                                        placeholder={`Write your calm investment thesis for ${snapshot.symbol}…`}
                                        style={{
                                            width: '100%',
                                            padding: 12,
                                            borderRadius: 10,
                                            border: '1px solid var(--line)',
                                            background: 'var(--surface-subtle)',
                                            color: 'var(--ink)',
                                            font: 'inherit',
                                            resize: 'vertical',
                                        }}
                                    />
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 12, color: saveError ? 'var(--down)' : 'var(--muted)' }}>
                                            {saveError || saveStatus || `${noteDraft.length}/5000`}
                                        </span>
                                        <button type="button" className={styles.primaryBtn} disabled={saving} onClick={handleSaveNote}>
                                            {saving ? 'Saving…' : savedRecord ? 'Update note' : 'Save to watchlist'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            )}
        </>
    );
}
