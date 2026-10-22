'use client';

import { assessCurrentResearch, compareResearchEvidence } from '@/lib/research/current-assessment';
import { annualAmountComparison, compactFinancialAmount, type AnnualAmount } from '@/lib/research/financial-display';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import { toYahooSymbol } from '@/lib/research/yahoo-research';
import { date, money, retrievedAt } from './research-v8-connected-data';
import base from './market-v8.module.css';
import styles from './research-v8-connected.module.css';
import dataStyles from './research-v8.module.css';

export function ResearchCurrentAssessment({ snapshot, previous = null, loading, error, now, compact = false }: { snapshot: ResearchSnapshot | null; previous?: ResearchSnapshot | null; loading: boolean; error: boolean; now: number; compact?: boolean }) {
    const assessment = assessCurrentResearch(snapshot, now);
    const labels = { available: '3 of 3 financial inputs', partial: 'Partial evidence', outdated: 'Data needs updating', insufficient: 'Insufficient evidence', unsupported: 'Assessment unsupported' };
    const comparison = !loading && !error ? compareResearchEvidence(previous, snapshot, now) : null;
    if (compact) {
        const status = error ? 'Refresh failed' : loading ? snapshot ? 'Refreshing previous reading' : 'Reading evidence' : labels[assessment.status];
        const limitation = !snapshot
            ? error ? 'No current assessment is available. Retry provider data to refresh this reading.' : 'Provider evidence is still loading; no assessment has been inferred.'
            : assessment.status === 'unsupported'
                ? assessment.summary
                : assessment.coverage === 0
                    ? assessment.gaps[0] || 'No required financial inputs are available.'
                    : `${assessment.coverage}/3 annual inputs available. A limited financial snapshot, not an overall company rating.`;
        return <section className={`${styles.assessment} ${styles.assessmentCompact}`} aria-label="Financial assessment status" aria-busy={loading}>
            <div className={styles.assessmentHeading}><span className={base.eyebrow}>Financial snapshot · revenue, profit and cash flow</span><span className={styles.assessmentBadge} data-state={error ? 'error' : loading ? 'loading' : assessment.status}>{status}</span></div>
            <p>{error && snapshot ? `Refresh failed; previous values remain visible. ${limitation}` : limitation}</p>
        </section>;
    }
    // Keep unavailable assessments inspectable without pushing the returned price history down the page.
    if (snapshot && (assessment.status === 'unsupported' || assessment.coverage === 0)) {
        return <section className={`${styles.assessment} ${styles.assessmentCompact}`} aria-label="Current research assessment" aria-busy={loading}>
            <AssessmentFacts snapshot={snapshot} />
            <details className={styles.assessmentDetails}>
                <summary>Assessment evidence and limitations · {labels[assessment.status]} · {assessment.coverage}/3 inputs</summary>
                <p>{error ? 'Provider refresh failed. The previous response remains visible with its original dates.' : assessment.summary}</p>
                {comparison && <p className={styles.assessmentChange} role="status">{comparison}</p>}
                <p>Financial source: {snapshot.fundamentals.source || 'Unavailable'} · reporting period {date(snapshot.fundamentals.reportingPeriod)} · retrieved {retrievedAt(snapshot.fetchedAt)}.</p>
                <ul>{assessment.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul>
                {!!snapshot.warnings.length && <><h3>Provider source notices</h3><ul>{snapshot.warnings.map((notice, index) => <li key={index}>{notice}</li>)}</ul></>}
                <p>{assessment.watchNext}</p>
            </details>
        </section>;
    }
    // The compact status above the tabs already names this snapshot, its status and the first load.
    if (loading && !snapshot && !error) return null;
    return <section className={styles.assessment} aria-label="Current research assessment" aria-busy={loading}>
        <h2>{error ?'Provider refresh failed · assessment limited' : assessment.headline}</h2>
        <p>{error ? snapshot ? 'The previous response remains below. Its dates still apply.' : 'No replacement assessment has been invented. Retry provider data below.' : assessment.summary}</p>
        {snapshot && <>
        <p className={styles.assessmentSource}>Financial source: {snapshot.fundamentals.source || 'Unavailable'} · annual period ended {date(snapshot.fundamentals.reportingPeriod)} · {assessment.coverage}/3 summary inputs available<br />Provider response retrieved {retrievedAt(snapshot.fetchedAt)}. Retrieval does not change the reporting period.</p>
        <p className={styles.assessmentSource}>Classification: {snapshot.quote.classification ? `${snapshot.quote.classification.sector || 'Sector unavailable'} · ${snapshot.quote.classification.industry || 'Industry unavailable'} · ${snapshot.quote.classification.source} · retrieved ${retrievedAt(snapshot.quote.classification.retrievedAt)}` : 'Unavailable; company assessment withheld.'}</p>
        <p className={styles.assessmentLimit}><strong>Reading limits:</strong> {['partial', 'outdated', 'insufficient'].includes(assessment.status) ? `${assessment.gaps[0]} ` : ''}These checks do not assess fair value, debt safety or investment suitability.{snapshot.warnings.length > 0 ? ' Provider notices are present; check the source details below.' : ''}</p>
        {comparison && <p className={styles.assessmentChange} role="status">{comparison}</p>}
        <div className={styles.assessmentFactsBlock}><h3>Reported facts</h3><AssessmentFacts snapshot={snapshot} /></div>
        <p><strong>What to watch next:</strong> {assessment.watchNext}</p>
        <details className={styles.assessmentDetails}><summary>Evidence, limitations and how this is assessed</summary><ul>{assessment.gaps.map(item => <li key={item}>{item}</li>)}</ul><p>Revenue growth is compared with zero; annual profit and free cash flow are checked for positive, zero or negative values. All three require a named financial source and a valid reporting period. Eligibility requires matching equity identification and current provider sector/industry metadata. Financial Services, REITs, unknown sectors and classification older than two days are excluded. No sector-specific financial thresholds, forecasts, valuation targets or personal checklist answers are used. The 18-month reporting and two-day retrieval limits are display freshness rules, not investment signals.</p></details>
        </>}
    </section>;
}

function AssessmentFacts({ snapshot }: { snapshot: ResearchSnapshot }) {
    const fundamentals = snapshot.fundamentals;
    const period = fundamentals.history.find(row => row.reportingPeriod === fundamentals.reportingPeriod);
    const rows: readonly [string, AnnualAmount][] = [['Annual revenue', 'annualRevenue'], ['Annual net income', 'annualNetIncome'], ['Annual free cash flow', 'freeCashFlow']];
    return <dl className={`${dataStyles.valuationInputs} ${styles.assessmentFacts}`}>
        {rows.map(([label, key]) => {
            const value = fundamentals[key];
            const comparison = annualAmountComparison(fundamentals, key);
            const delta = comparison?.percentage !== null && comparison?.percentage !== undefined
                ? `${comparison.percentage < 0 ? 'down ' : comparison.percentage > 0 ? 'up ' : ''}${Math.abs(comparison.percentage).toFixed(1)}%`
                : comparison ? `${comparison.delta < 0 ? 'down ' : comparison.delta > 0 ? 'up ' : ''}${compactFinancialAmount(Math.abs(comparison.delta), period?.currency)}` : null;
            const currentSign = value == null || !Number.isFinite(value) ? 'Unavailable' : value > 0 ? 'Positive' : value < 0 ? 'Negative' : 'Zero';
            const suppliedUrl = period?.sourceUrl;
            const verifiedSecUrl = suppliedUrl && /^https:\/\/(www\.)?sec\.gov\//i.test(suppliedUrl) ? suppliedUrl : null;
            const providerUrl = fundamentals.source === 'Yahoo Finance' ? `https://finance.yahoo.com/quote/${encodeURIComponent(toYahooSymbol(snapshot.symbol, snapshot.market))}/financials/` : null;
            return <div key={key}>
                <dt>{label}</dt>
                <dd>{compactFinancialAmount(value, period?.currency)}</dd>
                <dd className={styles.assessmentFactChange}>Current amount: {currentSign}</dd>
                <dd className={styles.assessmentFactChange}>
                    {comparison && delta ? `${delta} vs year ended ${date(comparison.previous.reportingPeriod)}` : 'Annual change unavailable'}
                </dd>
                <dd><details className={styles.assessmentDetails}>
                    <summary>Exact amount, comparison and source</summary>
                    <p>{label}: {money(value, period?.currency)} · annual period ended {date(fundamentals.reportingPeriod)} · {fundamentals.source || 'Source unavailable'}.</p>
                    {comparison
                        ? <p>Comparable annual endpoints: {date(comparison.previous.reportingPeriod)} {money(comparison.previous[key], comparison.previous.currency)} → {date(fundamentals.reportingPeriod)} {money(value, period?.currency)}. Amount change: {money(comparison.delta, period?.currency)}. {comparison.percentage === null ? 'Percentage change is withheld because the prior amount is zero or negative.' : `Percentage change = (current − prior) ÷ prior × 100 = ${comparison.percentage.toFixed(1)}%.`} Both endpoints use the same source and currency.</p>
                        : <p>A comparable prior annual amount with the same source and currency is unavailable. No year-over-year change is inferred.</p>}
                    {key === 'annualRevenue' && fundamentals.revenueGrowthPercent != null && Number.isFinite(fundamentals.revenueGrowthPercent) && <p>Provider-reported revenue growth: {fundamentals.revenueGrowthPercent.toFixed(1)}%. This is separate from the comparable endpoint change above.</p>}
                    {verifiedSecUrl ? <a href={verifiedSecUrl} target="_blank" rel="noopener noreferrer">Supplied SEC source document ↗</a> : providerUrl ? <a href={providerUrl} target="_blank" rel="noopener noreferrer">Yahoo Finance financials page · provider, not issuer filing ↗</a> : <p>No verified source-document link was supplied. Check the issuer report separately.</p>}
                </details></dd>
            </div>;
        })}
    </dl>;
}
