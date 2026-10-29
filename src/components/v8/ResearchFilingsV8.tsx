'use client';

import { useEffect, useState } from 'react';
import type { SecDiscoveryFiling } from '@/lib/research/sec-filings';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import { date, researchHref } from './research-v8-connected-data';
import styles from './research-v8-modules.module.css';
import { researchPanelCoverage } from '@/lib/research/reading-display';

type Discovery = { status: 'loading' } | { status: 'ready'; issuer: string; filings: readonly SecDiscoveryFiling[] } | { status: 'degraded'; message: string; retryable: boolean };

const isFiling = (value: unknown): value is SecDiscoveryFiling => !!value && typeof value === 'object'
    && ['accessionNumber', 'form', 'filingDate', 'title', 'sourceUrl'].every(key => typeof (value as Record<string, unknown>)[key] === 'string')
    && /^https:\/\/www\.sec\.gov\//.test((value as Record<string, string>).sourceUrl);

function readDiscovery(payload: unknown): Discovery {
    const body = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    if (body.success !== true) return { status: 'degraded', message: typeof body.error === 'string' ? body.error : 'SEC filing discovery is temporarily unavailable.', retryable: body.reason !== 'configuration' };
    const data = body.data && typeof body.data === 'object' ? body.data as Record<string, unknown> : {};
    if (!Array.isArray(data.filings)) return { status: 'degraded', message: 'SEC filing discovery returned an invalid response.', retryable: true };
    return { status: 'ready', issuer: typeof data.issuer === 'string' ? data.issuer : '', filings: data.filings.filter(isFiling) };
}

// Recent official filings for the open security, plus excerpts the owner has already cited from them.
export function ResearchFilingsV8({ symbol, market, record }: { symbol: string; market: ResearchMarket; record?: ResearchRecord }) {
    const [discovery, setDiscovery] = useState<Discovery>({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (!researchPanelCoverage(market).secFilings) return;
        const controller = new AbortController();
        fetch(`/api/research/filings/${encodeURIComponent(symbol)}`, { signal: controller.signal })
            .then(response => response.json())
            .then(payload => setDiscovery(readDiscovery(payload)))
            .catch(() => { if (!controller.signal.aborted) setDiscovery({ status: 'degraded', message: 'SEC filing discovery is temporarily unavailable.', retryable: true }); });
        return () => controller.abort();
    }, [symbol, market, attempt]);
    const citations = record?.documentEvidence.citations ?? [];
    return <section className={styles.module} aria-labelledby="filings-title" data-testid="research-filings">
        <div className={styles.heading}><div><span className={styles.eyebrow}>Primary documents</span><h2 id="filings-title">Filings and cited excerpts</h2></div>{market === 'US' && discovery.status === 'ready' && <span className={styles.tag}>{discovery.filings.length} recent filings</span>}</div>
        {!researchPanelCoverage(market).secFilings ? <p className={styles.meta}>Read company announcements on <a href="https://www.bursamalaysia.com/market_information/announcements/company_announcement" target="_blank" rel="noopener noreferrer">Bursa Malaysia ↗</a>.</p>
            : discovery.status === 'loading' ? <p role="status">Loading recent SEC filings…</p>
                : discovery.status === 'degraded' ? <p role="alert">{discovery.message} {discovery.retryable && <button className={styles.secondary} onClick={() => { setDiscovery({ status: 'loading' }); setAttempt(value => value + 1); }}>Retry</button>}</p>
                    : discovery.filings.length === 0 ? <p className={styles.meta}>No recent annual, quarterly or current reports were found for {symbol}.</p>
                        : <>
                            <p className={styles.meta}>Recent reports{discovery.issuer ? ` filed by ${discovery.issuer}` : ''}, straight from SEC EDGAR. Open a filing to read it at the source.</p>
                            <ul className={styles.rows}>{discovery.filings.map(filing => <li key={filing.accessionNumber}>
                                <span className={styles.badge}>{filing.form}</span>
                                <span><a href={filing.sourceUrl} target="_blank" rel="noopener noreferrer">{filing.title} ↗</a><small>Filed {date(filing.filingDate)}{filing.reportingPeriod ? ` · period ${date(filing.reportingPeriod)}` : ''}</small></span>
                            </li>)}</ul>
                        </>}
        <h3>Your cited excerpts</h3>
        {!record ? <p className={styles.meta}>Excerpts you capture from filings are kept with saved owner research. {market === 'US' ? 'Unlock the owner workspace and save this security to cite filings.' : ''}</p>
            : citations.length === 0 ? <p className={styles.meta}>No excerpts cited yet. <a href={researchHref(symbol, 'evidence', market)} target="_blank" rel="noopener noreferrer">Capture an excerpt (new tab) ↗</a></p>
                : <>
                    <ul className={styles.citations}>{citations.map(citation => <li key={citation.id}>
                        <blockquote>{citation.excerpt}</blockquote>
                        <small><a href={citation.sourceUrl} target="_blank" rel="noopener noreferrer">{citation.title} ↗</a> · {citation.location || 'location not recorded'} · published {date(citation.publicationDate)} · {citation.captureMethod === 'sec-official' ? 'SEC metadata' : 'manually captured'}</small>
                    </li>)}</ul>
                    <a href={researchHref(symbol, 'evidence', market)} target="_blank" rel="noopener noreferrer">Add or edit excerpts (new tab) ↗</a>
                </>}
    </section>;
}
