'use client';

import type { QualityDiscoveryResult } from '@/lib/types/research-discovery';
import type { DiscoveryScan } from './ResearchDiscoverV8';
import { direction, ScanStatus, signedPercent } from './ResearchTrendingV8';
import { retrievedAt } from './research-v8-connected-data';
import styles from './research-discover-v8.module.css';

const stageLabel = (row: QualityDiscoveryResult) => row.earlyTrendStage === 'emerging' ? 'Emerging' : 'Confirmed';

// Controlled moves from the same scan that have not yet become extended; emerging stages rank first.
export function ResearchEarlyTrendsV8({ scan, onSelect }: { scan: DiscoveryScan; onSelect: (symbol: string) => void }) {
    const { data } = scan;
    if (!data) return <ScanStatus scan={scan} />;
    const top20 = new Set([...data.candidates.slice(0, 10), ...data.contenders.slice(0, 10)].map(row => row.symbol));
    const rows = data.emergingCandidates;
    return <>
        <p className={styles.meta}>Trends that are starting, before the move is extended · {retrievedAt(data.generatedAt)}</p>
        <details className={styles.method}>
            <summary>How early trends are found</summary>
            <p>Same liquid US universe and risk rules as Trending. <b>Emerging</b>: price above its 200-day average, a positive six-month trend, at least 5% over three months, and between 2% below and 6% above its 50-day average. <b>Confirmed</b>: up to 12% above the 50-day average with at least 8% over three months. Moves above 35% in three months or more than 12% above the 50-day average are extended and left out. A research shortlist, not a buy recommendation or a forecast.</p>
        </details>
        {rows.length === 0 ? <p>No early trends passed the current checks.</p> : <ol className={styles.list} data-testid="research-early-trends">
            <li className={`${styles.head} ${styles.earlyRow}`} aria-hidden="true"><span>#</span><span>Stock</span><span>Stage</span><span>Score</span><span className={styles.num}>3M</span><span className={styles.num}>6M</span><span>Risk</span></li>
            {rows.map((row, index) => <li key={row.symbol} data-stage={row.earlyTrendStage}>
                <button className={styles.earlyRow} onClick={() => onSelect(row.symbol)} aria-label={`Read ${row.symbol}, ${row.name}, ${stageLabel(row).toLowerCase()} trend`}>
                    <span className={styles.rank}>{index + 1}</span>
                    <span className={styles.name}><b>{row.symbol}</b><small>{row.name} · ${row.price.toFixed(2)}</small></span>
                    <span className={styles.stage} data-stage={row.earlyTrendStage}>{stageLabel(row)}<small>{signedPercent(row.distanceFromMa50Percent)} vs 50-day avg{top20.has(row.symbol) ? ' · also in Trending' : ''}</small></span>
                    <span className={styles.score}><b>{row.discoveryScore}</b><small>trend {row.trendScore} · quality {row.qualityScore ?? '—'}</small></span>
                    <span className={styles.move} data-direction={direction(row.momentum3MonthPercent)}><small>3M </small>{signedPercent(row.momentum3MonthPercent)}</span>
                    <span className={styles.move} data-direction={direction(row.momentum6MonthPercent)}><small>6M </small>{signedPercent(row.momentum6MonthPercent)}</span>
                    <span className={styles.risk} data-risk={row.risk}>{row.risk} risk</span>
                </button>
            </li>)}
        </ol>}
    </>;
}
