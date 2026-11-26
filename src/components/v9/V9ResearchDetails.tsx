'use client';

import Link from 'next/link';
import { ResearchConnectedPanel } from '@/components/v8/ResearchV8ConnectedPanels';
import connected from '@/components/v8/research-v8-connected.module.css';
import v8 from '@/components/v8/research-v8.module.css';
import { financialPeriodLabel, formatResearchTimestamp } from '@/lib/research/metric-provenance';
import { researchCoverageNote } from '@/lib/research/reading-display';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import { useV9ResearchBenchmark } from './useV9ResearchBenchmark';
import { ResearchValuationReasoningV9 } from './ResearchValuationReasoningV9';
import styles from './v9-workspace.module.css';

const labels = {
    technicals: 'Chart & technicals',
    financials: 'Financials',
    valuation: 'Valuation',
    sources: 'Sources & coverage',
} as const;

export type V9ResearchDetail = keyof typeof labels;

function SourceCoverage({ snapshot }: { snapshot: ResearchSnapshot }) {
    const periods = snapshot.fundamentals.history.length;
    const points = snapshot.chart.points.length;
    return <div className={connected.panelContent}>
        <dl className={`${v8.valuationInputs} ${connected.metricList}`}>
            <div><dt>Provider sources</dt><dd>{snapshot.sources.join(', ') || 'Source not supplied'}</dd></div>
            <div><dt>Quote observed</dt><dd>{formatResearchTimestamp(snapshot.quote.observedAt)}</dd></div>
            <div><dt>Provider response retrieved</dt><dd>{formatResearchTimestamp(snapshot.fetchedAt)}</dd></div>
            <div><dt>Financial reporting</dt><dd>{snapshot.fundamentals.source ?? 'Source not supplied'} · {financialPeriodLabel(snapshot.fundamentals.reportingPeriod)}</dd></div>
            <div><dt>Financial history</dt><dd>{periods ? `${periods} annual ${periods === 1 ? 'period' : 'periods'} returned` : 'Not supplied'}</dd></div>
            <div><dt>Snapshot price history</dt><dd>{points ? `${points} daily ${points === 1 ? 'close' : 'closes'} returned` : 'Not supplied'}</dd></div>
        </dl>
        <p>Retrieval time records when Signal received the response. Quote and financial observations keep their own dates.</p>
        {snapshot.warnings.length > 0 && <details className={connected.evidence}>
            <summary>Source notices and limitations</summary>
            <ul>{snapshot.warnings.map((warning, index) => <li key={`${index}:${warning}`}>{warning}</li>)}</ul>
        </details>}
    </div>;
}

export function V9ResearchDetails({ detail, symbol, market, snapshot, ownerRecord, loading, error, href, onRetry }: {
    readonly detail: V9ResearchDetail;
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly snapshot: ResearchSnapshot | null;
    readonly ownerRecord: ResearchRecord | null;
    readonly loading: boolean;
    readonly error: string;
    readonly href: (panel: V9ResearchDetail | 'overview' | 'review') => string;
    readonly onRetry: () => void;
}) {
    const benchmark = useV9ResearchBenchmark(snapshot);
    const financial = detail === 'financials' || detail === 'valuation';
    const coverageNote = detail === 'sources' ? researchCoverageNote(market) : null;
    return <section className={`${styles.card} ${financial ? connected.app : ''}`} aria-label={financial ? 'Financials & valuation' : labels[detail]}>
        <div className={styles.sectionHead}>
            <div><h2>{financial ? 'Financials & valuation' : labels[detail]}</h2><p>{symbol} · {market}</p></div>
            {detail === 'sources' && <Link className={styles.textLink} href={href('overview')}>Back to overview</Link>}
        </div>
        {financial && <nav className={styles.quickPills} aria-label="Financials and valuation views">
            {(['financials', 'valuation'] as const).map(item => <Link key={item} href={href(item)} className={item === detail ? styles.primaryBtn : styles.quickPill} aria-current={item === detail ? 'page' : undefined}>{labels[item]}</Link>)}
        </nav>}
        {coverageNote && <p>{coverageNote}</p>}
        {loading && <p role="status">Loading provider data for {symbol} ({market})…</p>}
        {error && <div role="alert"><p>{error}</p><button type="button" className={styles.ghostBtn} onClick={onRetry}>Retry provider data</button></div>}
        {snapshot && detail === 'sources' && <SourceCoverage snapshot={snapshot} />}
        {snapshot && detail !== 'sources' && <ResearchConnectedPanel
            tab={labels[detail]} market={market} snapshot={benchmark.snapshot} loading={loading} providerError={!!error}
            advanced={detail === 'valuation' && !!ownerRecord} record={ownerRecord ?? undefined} editHref={href('review')}
            onBenchmarkRequest={benchmark.request} benchmarkError={benchmark.error} benchmarkLoading={benchmark.loading}
        />}
        {snapshot && detail === 'valuation' && <ResearchValuationReasoningV9 key={`${market}:${symbol}:${ownerRecord ? 'owner' : 'local'}`} ticker={symbol} snapshot={snapshot} localOnly={!ownerRecord} />}
    </section>;
}
