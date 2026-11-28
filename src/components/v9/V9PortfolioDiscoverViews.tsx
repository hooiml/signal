'use client';

import { useContext, useMemo } from 'react';
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
import { parseEarningsCalendarTarget } from '@/lib/research/earnings-ticket';
import { ResearchHoldingsV8 } from '@/components/v8/ResearchHoldingsV8';
import { ResearchDiscoverV8 } from '@/components/v8/ResearchDiscoverV8';
import { parseDiscoverView } from '@/components/v8/discover-view';
import { V9Navigation } from './v9-navigation';
import { useV9OwnerResearch } from './useV9OwnerResearch';
import type { V9QuoteBatchState } from './useV9QuoteBatch';
import { V9FactorExposureView } from './V9FactorExposureView';
import styles from './v9-workspace.module.css';

const PortfolioRiskCockpit = dynamic(() => import('@/components/v6/PortfolioRiskCockpitV6').then(module => module.PortfolioRiskCockpitV6));

function PortfolioManagement({ records, workspace, theme, quoteBatch, onOpenStock, onSavedOwner }: {
    readonly records: readonly ResearchRecord[];
    readonly workspace: 'guest' | 'owner';
    readonly theme: ResearchThemeV6;
    readonly quoteBatch: V9QuoteBatchState;
    readonly onOpenStock: (symbol: string, market: ResearchMarket) => void;
    readonly onSavedOwner: (record: ResearchRecord) => void;
}) {
    const owner = workspace === 'owner';
    const writer = useV9OwnerResearch(owner, onSavedOwner);

    const items = useMemo(() => records.map((record, index) => {
        const item = createWatchlistItemV6(record, index);
        const quote = quoteBatch.quotes.get(`${record.market}:${record.symbol}`);
        return quote ? applyResearchQuoteV6(item, quote) : item;
    }), [quoteBatch.quotes, records]);

    if (owner) return <div className={styles.card}>
        {quoteBatch.status === 'error' && quoteBatch.error && <p role="status">{quoteBatch.error}</p>}
        {writer.accessIssue && <OwnerAccessNotice issue={writer.accessIssue} resource="Saved research" preserveDraft />}
        <PortfolioRiskCockpit records={records} items={items} theme={theme} saving={writer.saving} saveError={writer.error}
            onSave={writer.save} onOpen={onOpenStock} />
    </div>;

    return <div className={styles.card}>
        {quoteBatch.status === 'error' && quoteBatch.error && <p role="status">{quoteBatch.error}</p>}
        <PortfolioHoldingsImportV6 records={records} items={items} theme={theme} onOpen={onOpenStock} />
        <PortfolioTransactionImportV6 theme={theme} />
        <PortfolioTransactionReconciliationV6 items={items} theme={theme} />
        <PortfolioCoveredAttributionV6 items={items} theme={theme} />
    </div>;
}

export function V9PortfolioView({
    records,
    workspace,
    theme,
    quoteBatch,
    onOpenStock,
    onSavedOwner,
}: {
    readonly records: readonly ResearchRecord[] | null;
    readonly workspace: 'checking' | 'guest' | 'owner';
    readonly theme: ResearchThemeV6;
    readonly quoteBatch: V9QuoteBatchState;
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

            {activeTab === 'factors' && (
                <V9FactorExposureView
                    records={records}
                    quotes={quoteBatch.quotes}
                    quoteStatus={quoteBatch.status}
                    manageHref={v9Href('portfolio', { tab: 'manage' })}
                    onOpenStock={onOpenStock}
                />
            )}

            {activeTab === 'manage' && (workspace !== 'checking' && records
                ? <PortfolioManagement records={records} workspace={workspace} theme={theme} quoteBatch={quoteBatch} onSavedOwner={onSavedOwner} onOpenStock={onOpenStock} />
                : <div className={styles.card} role="status">Loading saved research…</div>)}
            {activeTab === 'holdings' && <div className={styles.card}>
                <ResearchHoldingsV8
                    records={records}
                    quotes={quoteBatch.quotes}
                    quoteStatus={quoteBatch.status}
                    quoteError={quoteBatch.error}
                    quotesFetchedAt={quoteBatch.fetchedAt}
                    onOpen={onOpenStock}
                />
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
