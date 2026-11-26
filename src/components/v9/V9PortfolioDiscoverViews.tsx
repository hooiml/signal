'use client';

import { useContext, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { OwnerAccessNotice } from '@/components/OwnerAccessNotice';
import { PortfolioCoveredAttributionV6 } from '@/components/v6/PortfolioCoveredAttributionV6';
import { PortfolioHoldingsImportV6 } from '@/components/v6/PortfolioHoldingsImportV6';
import { PortfolioTransactionImportV6 } from '@/components/v6/PortfolioTransactionImportV6';
import { PortfolioTransactionReconciliationV6 } from '@/components/v6/PortfolioTransactionReconciliationV6';
import { createWatchlistItemV6 } from '@/components/v6/research-records-v6';
import { applyResearchQuoteV6 } from '@/components/v6/research-snapshot-v6';
import type { ResearchThemeV6 } from '@/components/v6/research-v6';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import type { ResearchQuoteBatchResult } from '@/lib/types/research-quote';
import type { PortfolioActualCurrencySummary } from '@/lib/portfolio/holdings';
import { parseEarningsCalendarTarget } from '@/lib/research/earnings-ticket';
import { parseResearchQuoteBatchResponse } from '@/lib/research/snapshot-input';
import { ResearchHoldingsV8 } from '@/components/v8/ResearchHoldingsV8';
import { ResearchDiscoverV8 } from '@/components/v8/ResearchDiscoverV8';
import { parseDiscoverView } from '@/components/v8/discover-view';
import { V9Navigation } from './v9-navigation';
import { useV9OwnerResearch } from './useV9OwnerResearch';
import { V9FactorExposureView } from './V9FactorExposureView';
import styles from './v9-workspace.module.css';

const PortfolioRiskCockpit = dynamic(() => import('@/components/v6/PortfolioRiskCockpitV6').then(module => module.PortfolioRiskCockpitV6));
const fmtMoney = (value: number, currency: string) =>
    new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

function PortfolioManagement({ records, workspace, theme, onOpenStock, onSavedOwner }: {
    readonly records: readonly ResearchRecord[];
    readonly workspace: 'guest' | 'owner';
    readonly theme: ResearchThemeV6;
    readonly onOpenStock: (symbol: string, market: ResearchMarket) => void;
    readonly onSavedOwner: (record: ResearchRecord) => void;
}) {
    const owner = workspace === 'owner';
    const writer = useV9OwnerResearch(owner, onSavedOwner);
    const [quoteResult, setQuoteResult] = useState<{ request: string; results: readonly ResearchQuoteBatchResult[]; error: string } | null>(null);
    const quoteRequest = owner && records.length > 0 ? JSON.stringify(records.slice(0, 50).map(({ symbol, market }) => ({ symbol, market }))) : '';

    useEffect(() => {
        if (!quoteRequest) return;
        const controller = new AbortController();
        fetch('/api/research/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: quoteRequest, signal: controller.signal })
            .then(async response => {
                if (!response.ok) throw new Error('Live quotes are temporarily unavailable.');
                return parseResearchQuoteBatchResponse(await response.json());
            })
            .then(results => { if (!controller.signal.aborted) setQuoteResult({ request: quoteRequest, results, error: '' }); })
            .catch(() => { if (!controller.signal.aborted) setQuoteResult({ request: quoteRequest, results: [], error: 'Live quotes are temporarily unavailable.' }); });
        return () => controller.abort();
    }, [quoteRequest]);

    const currentQuotes = quoteResult?.request === quoteRequest ? quoteResult : null;
    const items = useMemo(() => {
        const quotes = new Map((currentQuotes?.results ?? []).flatMap(result => result.success ? [[`${result.data.market}:${result.data.symbol}`, result.data.quote] as const] : []));
        return records.map((record, index) => {
            const item = createWatchlistItemV6(record, index);
            const quote = quotes.get(`${record.market}:${record.symbol}`);
            return quote ? applyResearchQuoteV6(item, quote) : item;
        });
    }, [currentQuotes, records]);

    if (owner) return <div className={styles.card}>
        {currentQuotes?.error && <p role="status">{currentQuotes.error}</p>}
        {writer.accessIssue && <OwnerAccessNotice issue={writer.accessIssue} resource="Saved research" preserveDraft />}
        <PortfolioRiskCockpit records={records} items={items} theme={theme} saving={writer.saving} saveError={writer.error}
            onSave={writer.save} onOpen={onOpenStock} />
    </div>;

    return <div className={styles.card}>
        <PortfolioHoldingsImportV6 records={records} items={items} theme={theme} onOpen={onOpenStock} />
        <PortfolioTransactionImportV6 theme={theme} />
        <PortfolioTransactionReconciliationV6 items={items} theme={theme} />
        <PortfolioCoveredAttributionV6 items={items} theme={theme} />
    </div>;
}

export function V9PortfolioView({
    records,
    summaries,
    workspace,
    theme,
    onOpenStock,
    onSavedOwner,
}: {
    readonly records: readonly ResearchRecord[] | null;
    readonly summaries: readonly PortfolioActualCurrencySummary[];
    readonly workspace: 'checking' | 'guest' | 'owner';
    readonly theme: ResearchThemeV6;
    readonly onOpenStock: (symbol: string, market: ResearchMarket) => void;
    readonly onSavedOwner: (record: ResearchRecord) => void;
}) {
    const v9Href = useContext(V9Navigation)!;
    const searchParams = useSearchParams();
    const rawTab = searchParams.get('tab');
    const activeTab = rawTab === 'manage' ? 'manage' : rawTab === 'factors' ? 'factors' : 'holdings';
    return (
        <div style={{ display: 'grid', gap: 18 }}>
            <div className={styles.heroBrief}>
                <div>
                    <h1 className={styles.heroTitle}>Portfolio & Sleeves</h1>
                    <p className={styles.pageSub}>Local holdings snapshot · Private on this device</p>
                </div>
            </div>

            <nav className={styles.segWrap} aria-label="Portfolio views">
                <Link className={styles.segLink} href={v9Href('portfolio')} aria-current={activeTab === 'holdings' ? 'page' : undefined}>Holdings</Link>
                <Link className={styles.segLink} href={v9Href('portfolio', { tab: 'factors' })} aria-current={activeTab === 'factors' ? 'page' : undefined}>Factor exposure</Link>
                <Link className={styles.segLink} href={v9Href('portfolio', { tab: 'manage' })} aria-current={activeTab === 'manage' ? 'page' : undefined}>Manage portfolio</Link>
            </nav>

            {activeTab === 'holdings' && summaries.length > 0 && (
                <section className={styles.card} aria-label="Currency totals">
                    <div className={styles.metricGrid} data-cols="2" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
                        {summaries.map(summary => (
                            <div key={summary.currency} className={styles.metricTile}>
                                <small>{summary.currency} Cost Basis + Cash</small>
                                <strong>{fmtMoney(summary.costBasis + summary.cashBalance, summary.currency)}</strong>
                                <span>
                                    Cost {fmtMoney(summary.costBasis, summary.currency)} · Cash {fmtMoney(summary.cashBalance, summary.currency)}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {activeTab === 'factors' && (
                <V9FactorExposureView
                    records={records}
                    manageHref={v9Href('portfolio', { tab: 'manage' })}
                    onOpenStock={onOpenStock}
                />
            )}

            {activeTab === 'manage' && (workspace !== 'checking' && records
                ? <PortfolioManagement records={records} workspace={workspace} theme={theme} onSavedOwner={onSavedOwner} onOpenStock={onOpenStock} />
                : <div className={styles.card} role="status">Loading saved research…</div>)}
            {activeTab === 'holdings' && <div className={styles.card}>
                <ResearchHoldingsV8 records={records} onOpen={onOpenStock} />
            </div>}
        </div>
    );
}

export function V9DiscoverView({
    records,
    workspace,
    onOpenStock,
}: {
    readonly records: readonly ResearchRecord[] | null;
    readonly workspace: 'checking' | 'guest' | 'owner';
    readonly onOpenStock: (symbol: string, market: ResearchMarket) => void;
}) {
    const v9Href = useContext(V9Navigation)!;
    const router = useRouter();
    const searchParams = useSearchParams();
    const view = parseDiscoverView(searchParams.get('discover')) ?? 'trending';
    const calendarTarget = view === 'calendar' ? parseEarningsCalendarTarget(
        searchParams.get('ticker')?.trim().toUpperCase(), searchParams.get('market') ?? undefined, searchParams.get('calendarDate') ?? undefined,
    ) : undefined;
    return (
        <div style={{ display: 'grid', gap: 18 }}>
            <div className={styles.heroBrief}>
                <div>
                    <h1 className={styles.heroTitle}>Discover Ideas</h1>
                    <p className={styles.pageSub}>US universe · Trend discovery, Stock Picker &amp; Earnings calendar</p>
                </div>
            </div>

            <div className={styles.card}>
                <ResearchDiscoverV8
                    defaultOpen
                    embedded
                    activeView={view}
                    onViewChange={next => { if (next !== view) router.push(v9Href('discover', { discover: next }), { scroll: false }); }}
                    calendarTarget={calendarTarget}
                    records={records}
                    workspace={workspace}
                    onSelect={onOpenStock}
                />
            </div>
        </div>
    );
}
