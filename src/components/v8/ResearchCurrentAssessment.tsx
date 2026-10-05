'use client';

import { assessCurrentResearch, compareResearchEvidence } from '@/lib/research/current-assessment';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
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
        <p className={styles.assessmentLimit}><strong>Reading limits:</strong> {['partial', 'outdated', 'insufficient'].includes(assessment.status) ? `${assessment.gaps[0]} ` : ''}These checks do not assess fair value, debt safety or investment suitability.{snapshot.warnings.length > 0 ? ' Provider notices are present; check the source details below.' : ''}</p>
        {comparison && <p className={styles.assessmentChange} role="status">{comparison}</p>}
        <div className={styles.assessmentGrid}>
            <div><h3>What supports the picture</h3>{assessment.supporting.length ? <ul>{assessment.supporting.map(item => <li key={item}>{item}</li>)}</ul> : <p>No supporting financial conclusion is available from the returned data.</p>}</div>
            <div><h3>What needs care</h3>{assessment.concerns.length ? <ul>{assessment.concerns.map(item => <li key={item}>{item}</li>)}</ul> : <p>{!assessment.applicable ? 'The company assessment does not apply. This is not a positive or negative finding.' : assessment.coverage === 0 ? 'There is not enough financial evidence to assess business risks.' : 'No adverse finding in the available summary inputs. This does not establish that the investment is low risk.'}</p>}</div>
        </div>
        <p><strong>What to watch next:</strong> {assessment.watchNext}</p>
        <details className={styles.assessmentDetails}><summary>Evidence, limitations and how this is assessed</summary><ul>{assessment.gaps.map(item => <li key={item}>{item}</li>)}</ul><p>Revenue growth is compared with zero; annual profit and free cash flow are checked for positive, zero or negative values. All three require a named financial source and a valid reporting period. No sector thresholds, forecasts, valuation targets or personal checklist answers are used. The 18-month reporting and two-day retrieval limits are display freshness rules, not investment signals.</p></details>
        </>}
    </section>;
}
