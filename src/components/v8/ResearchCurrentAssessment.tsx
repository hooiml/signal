'use client';

import { assessCurrentResearch } from '@/lib/research/current-assessment';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import { date } from './research-v8-connected-data';
import base from './market-v8.module.css';
import styles from './research-v8-connected.module.css';

export function ResearchCurrentAssessment({ snapshot, loading, error, now }: { snapshot: ResearchSnapshot | null; loading: boolean; error: boolean; now: number }) {
    const assessment = assessCurrentResearch(snapshot, now);
    return <section className={styles.assessment} aria-label="Current research assessment">
        <span className={base.eyebrow}>CURRENT DATA ASSESSMENT · AUTOMATIC</span>
        <h2>{loading && !snapshot ? 'Reading the available evidence…' : error ? 'Provider refresh failed · assessment limited' : assessment.headline}</h2>
        <p>{error ? snapshot ? 'The previous response remains below. Its dates still apply.' : 'No replacement assessment has been invented. Retry provider data below.' : assessment.summary}</p>
        {snapshot && <p className={styles.assessmentSource}>Financial source: {snapshot.fundamentals.source || 'Unavailable'} · annual period ended {date(snapshot.fundamentals.reportingPeriod)} · {assessment.coverage}/3 summary inputs available</p>}
        <div className={styles.assessmentGrid}>
            <div><h3>What supports the picture</h3>{assessment.supporting.length ? <ul>{assessment.supporting.map(item => <li key={item}>{item}</li>)}</ul> : <p>No supporting financial conclusion is available from the returned data.</p>}</div>
            <div><h3>What needs care</h3>{assessment.concerns.length ? <ul>{assessment.concerns.map(item => <li key={item}>{item}</li>)}</ul> : <p>{assessment.coverage === 0 ? 'There is not enough financial evidence to assess business risks.' : 'No adverse finding in the available summary inputs. This does not establish that the investment is low risk.'}</p>}</div>
        </div>
        <p><strong>What to watch next:</strong> {assessment.watchNext}</p>
        <details className={styles.assessmentDetails}><summary>Evidence, limitations and how this is assessed</summary><ul>{assessment.gaps.map(item => <li key={item}>{item}</li>)}</ul><p>Revenue growth is compared with zero; annual profit and free cash flow are checked for positive, zero or negative values. All three require a named financial source and a valid reporting period. No sector thresholds, forecasts, valuation targets or personal checklist answers are used. The 18-month reporting and two-day retrieval limits are display freshness rules, not investment signals.</p></details>
    </section>;
}
