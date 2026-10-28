'use client';

import { useState } from 'react';
import type { ResearchRecord } from '@/lib/types/research';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import { dueReviewReasons, reviewHighDistance, savedReviewContext } from '@/lib/research/due-review';
import { V8Card, V8FreshnessLine } from './V8Primitives';
import { date, price, researchHref, retrievedAt } from './research-v8-connected-data';
import base from './market-v8.module.css';
import styles from './research-due-review.module.css';

/** Owner-only saved records enter here. Dismissal lives only in the mounted stock visit. */
export function ResearchDueReview({ record, snapshot, loading, error }: {
    record: ResearchRecord;
    snapshot: ResearchSnapshot | null;
    loading: boolean;
    error: boolean;
}) {
    const today = new Date().toISOString().slice(0, 10);
    const reasons = dueReviewReasons(record, today);
    const visitRevision = `${record.revision}:${reasons.map(reason => `${reason.kind}:${reason.date}`).join(',')}`;
    const [dismissed, setDismissed] = useState<string | null>(null);
    if (!reasons.length || dismissed === visitRevision) return null;
    const previous = savedReviewContext(record);
    const current = snapshot?.symbol === record.symbol && snapshot.market === record.market ? snapshot : null;
    const rows = [
        ['Price', previous?.journal.observedPrice == null ? 'Not recorded' : price(previous.journal.observedPrice, previous.journal.observedCurrency), price(current?.quote.price, current?.quote.currency)],
        ['Distance from 52-week high', 'Not recorded', reviewHighDistance(current?.quote.price, current?.technicals.high52Week)],
        ['Market score', 'Not recorded', 'Unavailable'],
    ];
    return <V8Card className={styles.card} aria-label="Due review" data-testid="research-due-review">
        <header className={styles.heading}>
            <div><span className={base.eyebrow}>{record.symbol} · {record.market} · Review {reasons.some(reason => reason.date < today) ? 'overdue' : 'due today'}</span><h2>Then vs now</h2></div>
            <div className={styles.actions}><a className={base.primaryButton} href={researchHref(record.symbol, 'review', record.market)} target="_blank" rel="noopener noreferrer">Start review (new tab) ↗</a><button className={base.textButton} onClick={() => setDismissed(visitRevision)}>Later</button></div>
        </header>
        <p className={styles.dates}>{reasons.map(reason => reason.kind === 'scheduled' ? `Scheduled review: ${date(reason.date)} (UTC).` : `Review age deadline passed: ${date(reason.date)} (UTC).`).join(' ')}</p>
        <table className={styles.comparison}>
            <caption className={styles.caption}>{previous ? `Latest saved review: ${date(previous.reviewedAt)}.` : 'No personal review recorded.'} {loading ? 'Provider reading is loading.' : error ? 'Provider refresh failed.' : 'Latest returned provider reading.'}</caption>
            <thead><tr><th scope="col">Context</th><th scope="col">Then · saved review</th><th scope="col">Now · latest reading</th></tr></thead>
            <tbody>{rows.map(([label, then, now]) => <tr key={label}><th scope="row">{label}</th><td>{then}</td><td>{now}</td></tr>)}</tbody>
        </table>
        <div className={styles.thesis}><div><h3>Your thesis · then</h3><ThesisLine text={previous?.thesis} /></div><div><h3>Your thesis · currently saved</h3><ThesisLine text={record.whyInterested} /></div></div>
        <p className={styles.note}>Historical high-distance and market score were not stored with reviews. This stock reading does not include a market score.</p>
        <V8FreshnessLine as="small" label={error || loading ? 'Last available quote observed' : 'Quote observed'} value={current?.quote.observedAt ? retrievedAt(current.quote.observedAt) : 'Unavailable'} />
    </V8Card>;
}

function ThesisLine({ text }: { text?: string }) {
    if (!text || text.length <= 160) return <p>{text || 'Not recorded'}</p>;
    return <details><summary>{text.slice(0, 160)}… <span className={styles.expand}>Read full thesis</span></summary><p>{text}</p></details>;
}
