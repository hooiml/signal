'use client';

import { useEffect, useState } from 'react';
import { nearestPricePoint, priceRangeChange } from '@/lib/research/reading-display';
import { formatResearchPrice, researchPriceCurrency } from '@/lib/research/price-format';
import { ResearchDataAvailability } from './ResearchDataAvailability';
import { ResearchFinancialSummary } from './ResearchFinancialSummary';
type ChartStateProps = { chartRange: string; setChartRange: (range: string) => void; chartDate: string | null; setChartDate: (date: string | null) => void };
import { checklistLabelsV6 } from '@/components/v6/research-v6';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import { date, money, number, researchHref, sourceHref, type ResearchTab } from './research-v8-connected-data';
import base from './market-v8.module.css';
import styles from './research-v8.module.css';
import connected from './research-v8-connected.module.css';

const planPrice = (value: number | null, currency: string | null | undefined) => value === null ? 'Unavailable' : formatResearchPrice(value, currency);

function planCurrencyNote(planCurrency: string | null | undefined, quoteCurrency: string | null | undefined) {
    const plan = researchPriceCurrency(planCurrency);
    if (!plan) return 'Saved price assumptions below do not carry a currency in the research record; confirm the security’s trading currency before comparing them.';
    const quote = researchPriceCurrency(quoteCurrency);
    if (quote && quote !== plan) return `Saved prices are in ${plan}; the latest quote is in ${quote}. No currency conversion is applied, so compare them only after converting yourself.`;
    return `Saved prices are recorded in ${plan}.`;
}

function Metrics({ rows }: { rows: readonly (readonly [string, string])[] }) {
    return <dl className={styles.valuationInputs}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

function SourceLink({ url, label }: { url: string | null; label: string }) {
    const href = sourceHref(url);
    return href ? <a className={base.textButton} href={href} target="_blank" rel="noopener noreferrer">{label} ↗</a> : <span>{label} · no usable source link</span>;
}

export function ResearchConnectedPanel({ tab, record, market, snapshot, loading, providerError = false, advanced, onBenchmarkRequest, benchmarkError, benchmarkLoading, ...chart }: { onBenchmarkRequest: () => void; benchmarkError: boolean; benchmarkLoading: boolean; advanced: boolean; tab: ResearchTab; record?: ResearchRecord; market: ResearchMarket; snapshot: ResearchSnapshot | null; loading: boolean; providerError?: boolean } & ChartStateProps) {
    const fundamentals = snapshot?.fundamentals;
    const currency = fundamentals?.history.find(period => period.reportingPeriod === fundamentals.reportingPeriod)?.currency;
    const valuation = snapshot?.valuation;
    return <div className={connected.panelContent}>
        {tab === 'Overview' && <>
            <PriceHistory snapshot={snapshot} loading={loading} advanced={advanced} {...chart} />
            {record && (advanced || record.whyInterested || record.notes || record.acceptedEvidence.length > 0 || record.documentEvidence.citations.length > 0) && <details className={connected.evidence}><summary>Your saved notes and evidence · optional</summary>
            <span className={base.eyebrow}>USER-AUTHORED · SAVED {date(record.updatedAt)}</span>{record.whyInterested && <p className={connected.authored}>{record.whyInterested}</p>}{record.notes && <p className={connected.authored}>{record.notes}</p>}
            <h2>The evidence file</h2><p>Accepted research preserves its original sources and mode. A saved interpretation is not an independently verified fact.</p>
            {!record.acceptedEvidence.length && !record.documentEvidence.citations.length && <p className={styles.gapNote}>No accepted evidence or document citations are saved for this security.</p>}
            {record.acceptedEvidence.map(evidence => <details className={connected.evidence} key={evidence.id}><summary>{evidence.title} · {evidence.tone}</summary><small>Saved {evidence.mode === 'ai' ? 'AI interpretation' : 'evidence'} · accepted {date(evidence.acceptedAt)}</small><p>{evidence.summary}</p>{evidence.sources.map(source => <div key={source.id}><b>{source.label}</b><p>{source.value}</p><small>{source.reportingPeriod || 'Period not supplied'} · {source.source}</small><br /><SourceLink url={source.sourceUrl} label="Original source" /></div>)}</details>)}
            {record.documentEvidence.citations.map(citation => <details className={connected.evidence} key={citation.id}><summary>{citation.title}</summary><small>{citation.captureMethod === 'manual-unverified' ? 'Manual citation · unverified' : 'Official SEC capture'} · {citation.providerLabel} · published {date(citation.publicationDate)}</small><p>{citation.excerpt}</p><p>{citation.location} · reporting period {citation.reportingPeriod || 'not supplied'}</p><SourceLink url={citation.sourceUrl} label="Source document" /></details>)}
            </details>}
        </>}
        {tab === 'Financials' && <>
            <span className={base.eyebrow}>PROVIDER-REPORTED DATA</span><h2>Business performance</h2><p>{fundamentals?.source || 'Source unavailable'} · reporting period {date(fundamentals?.reportingPeriod)}. Financial currency is shown only when supplied for the matching period.</p>
            <ResearchDataAvailability snapshot={snapshot} section="Financials" loading={loading} error={providerError} />
            <ResearchFinancialSummary fundamentals={fundamentals} />
            <details className={connected.evidence}><summary>More financial measures</summary><Metrics rows={[
                ['Gross margin', number(fundamentals?.grossMarginPercent, '%')], ['Operating margin', number(fundamentals?.operatingMarginPercent, '%')],
                ['Debt', money(fundamentals?.debt, currency)], ['Cash', money(fundamentals?.cash, currency)], [fundamentals?.source === 'Yahoo Finance' ? 'Annual diluted average shares' : 'Shares outstanding', number(fundamentals?.shares)], ['Share count change', number(fundamentals?.shareChangePercent, '%')],
            ]} /></details>
            <details><summary>What do these measures tell you?</summary><p>Revenue measures sales. Margins describe the share left after different costs. Free cash flow is cash remaining after capital spending; it can diverge from accounting profit. Debt, cash and changes in share count add context. These measures alone do not establish business quality; company fundamentals may be inapplicable to funds.</p></details>
            <details className={connected.evidence}><summary>Reported financial history</summary>{fundamentals?.history.length ? <div className={connected.tableScroll} tabIndex={0} role="region" aria-label="Reported financial history"><table><caption>Actual periods returned by the service · no interpolated observations</caption><thead><tr><th>Period / source</th><th>Revenue</th><th>Free cash flow</th><th>Net income</th></tr></thead><tbody>{fundamentals.history.map((period, index) => <tr key={`${period.reportingPeriod}-${index}`}><th>{date(period.reportingPeriod)}<small>{period.source}</small></th><td>{money(period.annualRevenue, period.currency)}</td><td>{money(period.freeCashFlow, period.currency)}</td><td>{money(period.annualNetIncome, period.currency)}</td></tr>)}</tbody></table></div> : <p className={styles.gapNote}>{loading ? 'Loading financial history…' : 'No comparable financial history returned. Missing values are not zero.'}</p>}</details>
        </>}
        {tab === 'Thesis' && record && <>
            <span className={base.eyebrow}>YOUR SAVED REASONING</span><h2>A thesis you can test</h2><p>These are your saved judgments, not conclusions generated from the current quote.</p><div className={styles.thesisGrid}>{([['Why interested', record.whyInterested], ['Bull case', record.bullCase], ['Bear case', record.bearCase], ['What would invalidate the thesis?', record.thesisBreak], ['Buy trigger', record.buyTrigger], ['Sell trigger', record.sellTrigger]] as const).map(([label, value]) => <div key={label}><h3>{label}</h3><p className={connected.authored}>{value || 'Not recorded.'}</p></div>)}</div>
            <details className={connected.evidence}><summary>Saved investment checklist · {Object.values(record.checklist).filter(Boolean).length}/9 marked</summary><p>Marked means you selected this check in your saved review; it does not mean the source was independently verified.</p><ul className={connected.checklist}>{Object.entries(record.checklist).map(([key, marked]) => <li key={key}><b>{marked ? 'Marked' : 'Unmarked'}</b><span>{checklistLabelsV6[key] || key}</span></li>)}</ul></details>
        </>}
        {tab === 'Valuation' && <>
            <span className={base.eyebrow}>SEPARATE THE MARKET PRICE FROM YOUR PLAN</span><h2>Price, value and downside</h2><p>Provider ratios are derived measures, not a fair-value conclusion. {valuation?.source || 'Valuation source unavailable'} · period {date(valuation?.reportingPeriod)}.</p>
            <ResearchDataAvailability snapshot={snapshot} section="Valuation" loading={loading} error={providerError} />
            <Metrics rows={[
                ['Latest returned price', money(snapshot?.quote.price, snapshot?.quote.currency)], ['Market capitalization', money(valuation?.marketCap, snapshot?.quote.currency)],
                ['Price / earnings', number(valuation?.priceEarnings, '×')], ['Price / sales', number(valuation?.priceSales, '×')], ['Free cash flow yield', number(valuation?.freeCashFlowYieldPercent, '%')], ['Net cash', money(valuation?.netCash, currency)],
            ]} />
            <p>Share basis: {valuation?.shareBasis || 'Compatible outstanding shares unavailable; share-based valuation withheld.'}. Annual financials and current market price cover different dates.</p>{advanced && record && <><h3>Your saved valuation & position plan</h3><p>{planCurrencyNote(record.positionPlan.currency, snapshot?.quote.currency)}</p><Metrics rows={[
                ['Valuation judgment', record.valuationState], ['Target buy zone', record.targetBuyZone || 'Not recorded'], ['Position', record.positionState],
                ['Planned allocation', number(record.positionPlan.plannedAllocationPercent, '%')], ['Average cost', planPrice(record.positionPlan.averageCost, record.positionPlan.currency)], ['Planned entry', planPrice(record.positionPlan.plannedEntryPrice, record.positionPlan.currency)], ['Invalidation', planPrice(record.positionPlan.invalidationPrice, record.positionPlan.currency)],
            ]} />
            </>}
            <details className={connected.evidence} onToggle={event => { if (event.currentTarget.open) onBenchmarkRequest(); }}><summary>Compare past returns with the benchmark</summary>{benchmarkLoading && <p role="status">Loading optional benchmark comparison…</p>}{benchmarkError && <p>Benchmark request failed. Close and reopen this comparison to retry.</p>}{market === 'MY' || snapshot?.benchmark.status === 'not-applicable' ? <><h3>Benchmark coverage</h3><p>The existing research snapshot does not supply a comparable Malaysia benchmark. No cross-market comparison is inferred.</p></> : <><h3>Existing benchmark comparison</h3><p>{snapshot?.benchmark.baselineName || 'Vanguard S&P 500 ETF'} (VOO) · {snapshot?.benchmark.windowStart && snapshot.benchmark.windowEnd ? `${date(snapshot.benchmark.windowStart)} to ${date(snapshot.benchmark.windowEnd)} · ${snapshot.benchmark.commonSessions} common sessions` : 'Comparison window unavailable'} · {snapshot?.benchmark.returnBasis || 'Return basis unavailable'}. Status: {snapshot?.benchmark.status || 'unavailable'}.</p><Metrics rows={[
                ['Security return', number(snapshot?.benchmark.candidateReturnPercent, '%')], ['Benchmark return', number(snapshot?.benchmark.baselineReturnPercent, '%')], ['Relative return', number(snapshot?.benchmark.relativeReturnPercent, ' percentage points')],
            ]} /></>}</details>
        </>}
        {tab === 'Review' && record && <>
            <div className={`${base.sectionHeading} ${connected.reviewHeading}`}><div><span className={base.eyebrow}>USER-AUTHORED · SAVED RECORD</span><h2>Your working note</h2></div><a className={base.textButton} href={researchHref(record.symbol, 'review')} target="_blank" rel="noopener noreferrer">Open full research review ↗</a></div><p className={styles.noteText}>{record.notes || 'No note has been saved for this security.'}</p><Metrics rows={[
                ['Last reviewed', record.decisionJournal.decision === 'Not recorded' ? 'Not recorded' : date(record.lastReviewedAt)], ['Next review', date(record.decisionJournal.nextReviewAt)], ['Saved decision', record.decisionJournal.decision], ['Decision confidence', record.decisionJournal.confidence], ['Prior outcome', record.decisionJournal.priorOutcome],
            ]} /><p className={connected.authored}>{record.decisionJournal.outcomeNote || 'No outcome note recorded.'}</p>
            <h3>Saved review history</h3>{record.reviewHistory.length ? [...record.reviewHistory].sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt)).map(review => <details key={review.id} className={connected.evidence}><summary>{date(review.reviewedAt)} · {review.decisionJournal.decision}</summary><p className={connected.authored}>{review.whyInterested || 'No thesis recorded.'}</p><p className={styles.noteText}>{review.notes || 'No note recorded.'}</p><small>Confidence: {review.decisionJournal.confidence} · prior outcome: {review.decisionJournal.priorOutcome}</small></details>) : <p>No earlier review snapshots are saved.</p>}
        </>}
        {advanced && record && tab !== 'Review' && <a className={`${base.textButton} ${connected.editLink}`} href={researchHref(record.symbol, tab === 'Valuation' ? 'valuation' : 'review')} target="_blank" rel="noopener noreferrer">{tab === 'Valuation' ? 'Open full valuation workspace' : 'Edit saved research'} ↗</a>}
    </div>;
}

function PriceHistory({ snapshot, loading, advanced, chartRange: range, setChartRange: setRange, chartDate, setChartDate }: { snapshot: ResearchSnapshot | null; loading: boolean; advanced: boolean } & ChartStateProps) {
    const [mobileChart, setMobileChart] = useState(false);
    useEffect(() => {
        const media = window.matchMedia('(max-width: 600px)');
        const update = () => setMobileChart(media.matches);
        update();
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);
    const all = snapshot?.chart.points ?? [];
    const end = all.length ? Date.parse(all[all.length - 1].time) : 0;
    const days = range === '1M' ? 30 : range === '3M' ? 90 : range === '1Y' ? 365 : Infinity;
    const points = all.filter(point => Date.parse(point.time) >= end - days * 86400000);
    const selected = points.findIndex(point => point.time === chartDate);
    const index = selected >= 0 ? selected : points.length - 1;
    const point = points[index];
    const low = Math.min(...points.map(item => item.close));
    const high = Math.max(...points.map(item => item.close));
    const periodChange = priceRangeChange(points);
    const change = periodChange?.amount ?? null;
    const lineColor = change === null || change === 0 ? '#526581' : change > 0 ? '#006344' : '#97263f';
    const movement = change === null ? points.length === 1 ? 'One observation; no period change available' : 'A comparable period change is unavailable' : change === 0 ? 'Unchanged over selected period' : `${change > 0 ? 'Rose' : 'Fell'} over selected period`;
    const start = points.length ? Date.parse(points[0].time) : 0;
    const chart = mobileChart
        ? { width: 375, height: 260, left: 58, right: 360, top: 48, bottom: 205, labelSize: 16 }
        : { width: 750, height: 225, left: 65, right: 715, top: 45, bottom: 180, labelSize: 12 };
    const x = (time: string) => chart.left + (Date.parse(time) - start) / (end - start || 1) * (chart.right - chart.left);
    const y = (value: number) => chart.bottom - (value - low) / (high - low || 1) * (chart.bottom - chart.top);
    return <section className={connected.priceHistory} aria-label="Price history">
        <div className={connected.chartHeader}><div><span className={base.eyebrow}>RETURNED DAILY CLOSES</span><h3>Price history</h3></div><fieldset className={base.segment}><legend className={base.visuallyHidden}>Price history range</legend>{['1M', '3M', '1Y', 'All'].map(value => <button key={value} aria-pressed={range === value} onClick={() => { setRange(value); setChartDate(null); }}>{value}</button>)}</fieldset></div>
        {point ? <><output className={connected.priceReadout} aria-live="polite">{date(point.time)} · close {money(point.close, snapshot?.quote.currency)}</output><svg className={connected.priceChart} viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" onClick={event => {
            const matrix = event.currentTarget.getScreenCTM();
            if (!matrix) return;
            const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
            const fraction = Math.max(0, Math.min(1, (local.x - chart.left) / (chart.right - chart.left)));
            const nearest = nearestPricePoint(points, start + fraction * (end - start));
            if (nearest !== null) setChartDate(points[nearest].time);
        }} aria-label={`${snapshot?.symbol} daily closing price, ${date(points[0].time)} to ${date(points[points.length - 1].time)}. Exact values are available in the history table.`}>
            <line x1={chart.left} x2={chart.right} y1={chart.top} y2={chart.top} stroke="#c9daef" /><line x1={chart.left} x2={chart.right} y1={chart.bottom} y2={chart.bottom} stroke="#c9daef" />
            <text x={chart.left - 8} y={chart.top + 4} textAnchor="end" style={{ fontSize: chart.labelSize }}>{number(high)}</text><text x={chart.left - 8} y={chart.bottom + 4} textAnchor="end" style={{ fontSize: chart.labelSize }}>{number(low)}</text>
            <polyline data-testid="research-price-line" fill="none" stroke={lineColor} strokeWidth="2.5" points={points.map(item => `${x(item.time)},${y(item.close)}`).join(' ')} /><line x1={x(point.time)} x2={x(point.time)} y1={chart.top - 10} y2={chart.bottom + 8} stroke="#526581" strokeDasharray="4 4" /><circle cx={x(point.time)} cy={y(point.close)} r="5" fill={lineColor} />
            <text x={chart.left} y={chart.height - 10} style={{ fontSize: chart.labelSize }}>{date(points[0].time)}</text><text x={chart.right} y={chart.height - 10} textAnchor="end" style={{ fontSize: chart.labelSize }}>{date(points[points.length - 1].time)}</text>
        </svg><p className={connected.chartInteractionHint}>Tap or click the chart, or use the date slider to inspect a returned close.</p><label className={connected.scrubber}>Inspect a trading date<input type="range" min="0" max={points.length - 1} value={index} disabled={points.length === 1} onChange={event => setChartDate(points[Number(event.target.value)]?.time ?? null)} aria-valuetext={`${date(point.time)}, close ${money(point.close, snapshot?.quote.currency)}`} /></label><div className={connected.rangeChange} data-testid="research-range-change">{periodChange ? <>
            <strong>Selected-period price change: {periodChange.amount > 0 ? '+' : ''}{money(periodChange.amount, snapshot?.quote.currency)}{periodChange.percentage !== null ? ` (${periodChange.percentage > 0 ? '+' : ''}${number(periodChange.percentage, '%')})` : ' · percentage unavailable: starting close is zero'}</strong>
            <span>{date(periodChange.start)} → {date(periodChange.end)} · first and last returned closes.</span>
            <span>Price change only; not total return. This is separate from the quote’s daily change.</span>
        </> : <p>{movement}</p>}</div><p data-testid="research-period-direction" style={{ color: lineColor }}>{movement}. Colour compares the first and last returned closes in this range.</p><p>{points.length} returned observations · {snapshot?.quote.currency || 'Currency unavailable'}. Lines connect returned closes; missing sessions are not filled. These are historical closes, not the latest quote.</p><details><summary>View exact history values</summary><div className={connected.tableScroll} tabIndex={0} role="region" aria-label="Closing price table"><table><thead><tr><th>Date</th><th>Close ({snapshot?.quote.currency || 'currency unavailable'})</th><th>Volume</th></tr></thead><tbody>{points.map(item => <tr key={item.time}><th>{date(item.time)}</th><td>{number(item.close)}</td><td>{number(item.volume)}</td></tr>)}</tbody></table></div></details></> : <p className={styles.gapNote}>{loading ? 'Loading price history…' : 'No price history returned. No illustrative line is shown.'}</p>}
        {snapshot && advanced && <a className={base.textButton} href={researchHref(snapshot.symbol, 'chart')} target="_blank" rel="noopener noreferrer">Open full chart & technicals ↗</a>}
    </section>;
}
