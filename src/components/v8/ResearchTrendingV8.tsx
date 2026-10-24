'use client';

import type { DiscoveryContender, InstitutionalOwnershipEvidence, QualityDiscoveryResult } from '@/lib/types/research-discovery';
import type { DiscoveryScan } from './ResearchDiscoverV8';
import { retrievedAt } from './research-v8-connected-data';
import styles from './research-discover-v8.module.css';

type Row = QualityDiscoveryResult | DiscoveryContender;

export const signedPercent = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)}%`;
export const direction = (value: number) => value > 0 ? 'up' : value < 0 ? 'down' : 'flat';

// Quarterly holder filings: a delayed disclosure balance, never described as current buying.
const holderLabel = (ownership: InstitutionalOwnershipEvidence | null) => ownership === null ? 'Holder filings unavailable'
    : `Holder filings: ${ownership.activity === 'increases-led' ? 'increases led' : ownership.activity === 'decreases-led' ? 'decreases led' : 'mixed'}${ownership.institutionalOwnershipPercent === null ? '' : ` · ${ownership.institutionalOwnershipPercent.toFixed(0)}% institutional`}`;

export function ScanStatus({ scan }: { scan: DiscoveryScan }) {
    if (scan.error) return <p role="alert">{scan.error} <button className={styles.secondary} onClick={scan.retry}>Retry scan</button></p>;
    return <p role="status">Scanning liquid US trend candidates… The first scan of the hour can take up to a minute.</p>;
}

// Top 20 of the existing Trend Discovery scan: 10 Leaders + 10 Contenders.
export function ResearchTrendingV8({ scan, onSelect }: { scan: DiscoveryScan; onSelect: (symbol: string) => void }) {
    const { data } = scan;
    if (!data) return <ScanStatus scan={scan} />;
    const rows: { row: Row; rank: number; group: 'Leader' | 'Contender' }[] = [
        ...data.candidates.slice(0, 10).map((row, index) => ({ row, rank: index + 1, group: 'Leader' as const })),
        ...data.contenders.slice(0, 10).map((row, index) => ({ row, rank: Math.min(data.candidates.length, 10) + index + 1, group: 'Contender' as const })),
    ];
    return <>
        <p className={styles.meta}>{data.scannedCount} of {data.universeSize} stocks scanned · {retrievedAt(data.generatedAt)}. Ranked by sustained 3- and 6-month momentum and SEC-confirmed business quality. A research shortlist, not a buy recommendation or a forecast. High-risk and fundamentally unsupported names are excluded. Holder filings are delayed quarterly 13F disclosures, not evidence of current buying.</p>
        {rows.length === 0 ? <p>No candidates passed the current eligibility checks.</p> : <ol className={styles.list} data-testid="research-trending">
            <li className={styles.head} aria-hidden="true"><span>#</span><span>Stock</span><span>Score</span><span>3M</span><span>6M</span><span>Risk</span><span>Category</span></li>
            {rows.map(({ row, rank, group }) => <li key={row.symbol} data-group={group}>
                <button onClick={() => onSelect(row.symbol)} aria-label={`Read ${row.symbol}, ${row.name}, rank ${rank}`}>
                    <span className={styles.rank}>{String(rank).padStart(2, '0')}</span>
                    <span className={styles.name}><b>{row.symbol}</b><small>{row.name} · ${row.price.toFixed(2)}</small></span>
                    <span className={styles.score}><b>{row.discoveryScore}</b><small>trend {row.trendScore} · quality {row.qualityScore ?? '—'}</small></span>
                    <span className={styles.move} data-direction={direction(row.momentum3MonthPercent)}><small>3M </small>{signedPercent(row.momentum3MonthPercent)}</span>
                    <span className={styles.move} data-direction={direction(row.momentum6MonthPercent)}><small>6M </small>{signedPercent(row.momentum6MonthPercent)}</span>
                    <span className={styles.risk} data-risk={row.risk}>{row.risk} risk</span>
                    <span className={styles.category}>{row.category}<small>{'contenderReason' in row ? `Contender · ${row.contenderReason}` : row.catalyst ? `Earnings ${row.catalyst.date}` : ''}</small><small className={styles.holders} data-activity={row.ownership?.activity ?? 'unavailable'} title={row.ownership?.reportPeriod ? `Latest listed holder report ${row.ownership.reportPeriod}` : undefined}>{holderLabel(row.ownership)}</small></span>
                </button>
            </li>)}
        </ol>}
        {data.warnings.map(warning => <p key={warning} className={styles.meta}>{warning}</p>)}
    </>;
}
