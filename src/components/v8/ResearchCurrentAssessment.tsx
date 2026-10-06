'use client';

import { assessCurrentResearch, compareResearchEvidence } from '@/lib/research/current-assessment';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import { toYahooSymbol } from '@/lib/research/yahoo-research';
import { date, retrievedAt } from './research-v8-connected-data';
import base from './market-v8.module.css';
import styles from './research-v8-connected.module.css';

export function ResearchCurrentAssessment({ snapshot, previous = null, loading, error, now }: { snapshot: ResearchSnapshot | null; previous?: ResearchSnapshot | null; loading: boolean; error: boolean; now: number }) {
    const assessment = assessCurrentResearch(snapshot, now);
    const labels = { available: '3 of 3 financial inputs', partial: 'Partial evidence', outdated: 'Data needs updating', insufficient: 'Insufficient evidence', unsupported: 'Assessment unsupported' };
    const comparison = !loading && !error ? compareResearchEvidence(previous, snapshot, now) : null;
    return <section className={styles.assessment} aria-label="Current research assessment" aria-busy={loading}>
        <div className={styles.assessmentHeading}><span className={base.eyebrow}>CURRENT DATA ASSESSMENT · AUTOMATIC</span><span className={styles.assessmentBadge} data-state={error ? 'error' : loading ? 'loading' : assessment.status}>{error ? 'Refresh failed' : loading ? snapshot ? 'Refreshing previous reading' : 'Reading evidence' : labels[assessment.status]}</span></div>
        <h2>{loading && !snapshot ? 'Reading the available evidence…' : error ? 'Provider refresh failed · assessment limited' : assessment.headline}</h2>
        <p>{error ? snapshot ? 'The previous response remains below. Its dates still apply.' : 'No replacement assessment has been invented. Retry provider data below.' : assessment.summary}</p>
        {snapshot && <>
        <p className={styles.assessmentSource}>Financial source: {snapshot.fundamentals.source || 'Unavailable'} · annual period ended {date(snapshot.fundamentals.reportingPeriod)} · {assessment.coverage}/3 summary inputs available<br />Provider response retrieved {retrievedAt(snapshot.fetchedAt)}. Retrieval does not change the reporting period.</p>
        <p className={styles.assessmentSource}>Classification: {snapshot.quote.classification ? `${snapshot.quote.classification.sector || 'Sector unavailable'} · ${snapshot.quote.classification.industry || 'Industry unavailable'} · ${snapshot.quote.classification.source} · retrieved ${retrievedAt(snapshot.quote.classification.retrievedAt)}` : 'Unavailable; company assessment withheld.'}</p>
        <p className={styles.assessmentLimit}><strong>Reading limits:</strong> {['partial', 'outdated', 'insufficient'].includes(assessment.status) ? `${assessment.gaps[0]} ` : ''}These checks do not assess fair value, debt safety or investment suitability.{snapshot.warnings.length > 0 ? ' Provider notices are present; check the source details below.' : ''}</p>
        {comparison && <p className={styles.assessmentChange} role="status">{comparison}</p>}
        <div className={styles.assessmentGrid}>
            <div><h3>What supports the picture</h3>{assessment.supporting.length ? <ul>{assessment.supporting.map(item => <li key={item}><ClaimEvidence claim={item} snapshot={snapshot} /></li>)}</ul> : <p>No supporting financial conclusion is available from the returned data.</p>}</div>
            <div><h3>What needs care</h3>{assessment.concerns.length ? <ul>{assessment.concerns.map(item => <li key={item}><ClaimEvidence claim={item} snapshot={snapshot} /></li>)}</ul> : <p>{!assessment.applicable ? 'The company assessment does not apply. This is not a positive or negative finding.' : assessment.coverage === 0 ? 'There is not enough financial evidence to assess business risks.' : 'No adverse finding in the available summary inputs. This does not establish that the investment is low risk.'}</p>}</div>
        </div>
        <p><strong>What to watch next:</strong> {assessment.watchNext}</p>
        <details className={styles.assessmentDetails}><summary>Evidence, limitations and how this is assessed</summary><ul>{assessment.gaps.map(item => <li key={item}>{item}</li>)}</ul><p>Revenue growth is compared with zero; annual profit and free cash flow are checked for positive, zero or negative values. All three require a named financial source and a valid reporting period. Eligibility requires matching equity identification and current provider sector/industry metadata. Financial Services, REITs, unknown sectors and classification older than two days are excluded. No sector-specific financial thresholds, forecasts, valuation targets or personal checklist answers are used. The 18-month reporting and two-day retrieval limits are display freshness rules, not investment signals.</p></details>
        </>}
    </section>;
}

function ClaimEvidence({ claim, snapshot }: { claim: string; snapshot: ResearchSnapshot }) {
    const f = snapshot.fundamentals;
    const period = f.history.find(row => row.reportingPeriod === f.reportingPeriod);
    const revenue = /revenue/.test(claim);
    const cashFlow = /cash flow/.test(claim);
    const value = revenue ? f.annualRevenue : cashFlow ? f.freeCashFlow : f.annualNetIncome;
    const currency = period?.currency;
    const amount = value === null ? 'Unavailable' : `${currency || 'Currency unavailable'} ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    const suppliedUrl = period?.sourceUrl;
    const verifiedSecUrl = suppliedUrl && /^https:\/\/(www\.)?sec\.gov\//i.test(suppliedUrl) ? suppliedUrl : null;
    const providerUrl = f.source === 'Yahoo Finance' ? `https://finance.yahoo.com/quote/${encodeURIComponent(toYahooSymbol(snapshot.symbol, snapshot.market))}/financials/` : null;
    return <details className={styles.assessmentDetails}><summary>{claim}</summary>
        <p>{revenue ? 'Annual revenue' : cashFlow ? 'Annual free cash flow' : 'Annual net income'}: {amount}. Annual period ended {date(f.reportingPeriod)} · {f.source || 'Source unavailable'}.</p>
        <p>{revenue ? period?.comparisonPeriod ? `Comparison: ${date(period.comparisonPeriod)} revenue ${currency || 'Currency unavailable'} ${period.comparisonRevenue?.toLocaleString('en-US') ?? 'Unavailable'} → ${date(f.reportingPeriod)} revenue ${value?.toLocaleString('en-US') ?? 'Unavailable'}. ${period.comparableAnnual === false ? 'Periods are not comparable annual endpoints; YoY growth is withheld.' : 'Growth = (current − prior) ÷ absolute prior × 100.'}` : 'Comparison endpoints were not supplied; the reported provider growth cannot be independently reconstructed here.' : 'Basis: latest returned annual amount compared with zero. No prior-year change or cause is inferred.'}</p>
        {verifiedSecUrl ? <a href={verifiedSecUrl} target="_blank" rel="noopener noreferrer">Supplied SEC source document ↗</a> : providerUrl ? <a href={providerUrl} target="_blank" rel="noopener noreferrer">Yahoo Finance financials page · provider, not issuer filing ↗</a> : <p>No verified source-document link was supplied. Check the issuer report separately.</p>}
    </details>;
}
