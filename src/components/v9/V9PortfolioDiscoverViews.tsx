'use client';

import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import type { PortfolioActualCurrencySummary } from '@/lib/portfolio/holdings';
import { ResearchHoldingsV8 } from '@/components/v8/ResearchHoldingsV8';
import { ResearchDiscoverV8 } from '@/components/v8/ResearchDiscoverV8';
import base from '@/components/v8/market-v8.module.css';
import styles from './v9-workspace.module.css';

const fmtMoney = (value: number, currency: string) =>
    new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

export function V9PortfolioView({
    records,
    summaries,
    onOpenStock,
}: {
    readonly records: readonly ResearchRecord[] | null;
    readonly summaries: readonly PortfolioActualCurrencySummary[];
    readonly onOpenStock: (symbol: string, market: ResearchMarket) => void;
}) {
    return (
        <div className={base.tokens} style={{ display: 'grid', gap: 18 }}>
            <div className={styles.heroBrief}>
                <div>
                    <div className={styles.kicker}><span>Local Holdings Snapshot · Private on this device</span></div>
                    <h1 className={styles.heroTitle}>Portfolio & Sleeves</h1>
                </div>
            </div>

            {summaries.length > 0 && (
                <section className={styles.card} aria-label="Currency totals">
                    <div className={styles.metricGrid} style={{ marginTop: 0 }}>
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

            <div className={styles.card}>
                <ResearchHoldingsV8 records={records} onOpen={onOpenStock} />
            </div>
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
    return (
        <div className={base.tokens} style={{ display: 'grid', gap: 18 }}>
            <div className={styles.heroBrief}>
                <div>
                    <div className={styles.kicker}><span>US Trend Discovery · Stock Picker · Earnings Calendar</span></div>
                    <h1 className={styles.heroTitle}>Discover Ideas</h1>
                </div>
            </div>

            <div className={styles.card}>
                <ResearchDiscoverV8
                    defaultOpen
                    embedded
                    records={records}
                    workspace={workspace}
                    onSelect={onOpenStock}
                />
            </div>
        </div>
    );
}
