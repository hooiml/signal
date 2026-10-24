'use client';

import { useEffect, useId, useState } from 'react';
import dynamic from 'next/dynamic';
import { nearestPricePoint, priceRangeChange, valuationShareCount } from '@/lib/research/reading-display';
import { formatResearchPrice, researchPriceCurrency } from '@/lib/research/price-format';
import { financialPeriodLabel, formatResearchTimestamp, netCashCurrency, researchMetricPeriodLabel } from '@/lib/research/metric-provenance';
import { cashDebtDisplay, compactFinancialAmount } from '@/lib/research/financial-display';
import { personalReviewDate, savedReviewMarkers } from '@/lib/research/review-lifecycle';
import { ResearchDataAvailability } from './ResearchDataAvailability';
import { ResearchFinancialSummary, ResearchQualityAndCushion } from './ResearchFinancialSummary';
import { HistoricalValuationV8, PositionPlanComparison } from './ResearchV8ValuationContext';
type ChartStateProps = { chartRange: string; setChartRange: (range: string) => void; chartDate: string | null; setChartDate: (date: string | null) => void };
import { checklistLabelsV6 } from '@/components/v6/research-v6';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import { date, money, number, price, researchHref, sourceHref, type ResearchTab } from './research-v8-connected-data';
import base from './market-v8.module.css';
import styles from './research-v8.module.css';
import connected from './research-v8-connected.module.css';

const ResearchTechnicals = dynamic(() => import('./ResearchTechnicals').then(module => module.ResearchTechnicals), {
    loading: () => <p role="status">Loading chart tools…</p>,
});

const planPrice = (value: number | null, currency: string | null | undefined) => value === null ? 'Unavailable' : formatResearchPrice(value, currency);

function missingValuationContext(kind: 'marketCap' | 'pe' | 'ps' | 'fcfYield', snapshot: ResearchSnapshot | null, market: ResearchMarket) {
    const shares = valuationShareCount(snapshot);
    const marketCap = snapshot?.valuation.marketCap;
    const priceMissing = snapshot?.quote.price == null || snapshot.quote.price <= 0;
    const sharesMissing = shares == null || shares <= 0;
    const marketCapReason = marketCap != null
        ? ''
        : [priceMissing ? 'a positive current price is unavailable' : '', sharesMissing ? `compatible outstanding shares are unavailable${market === 'MY' ? '; annual diluted average shares are not substituted' : ''}` : '', market === 'MY' && snapshot?.quote.currency !== 'MYR' ? 'the quote currency is not confirmed as MYR; no currency conversion is applied' : ''].filter(Boolean).join(' and ');
    if (kind === 'marketCap') return marketCap == null ? `Unavailable because ${marketCapReason || 'the required inputs were not returned'}.` : 'Current price multiplied by the returned share count; observation dates may differ.';
    if (snapshot?.valuation[kind === 'pe' ? 'priceEarnings' : kind === 'ps' ? 'priceSales' : 'freeCashFlowYieldPercent'] != null) return undefined;
    // The market-capitalization row and the availability notice already explain why it is missing; ratios only name what they need.
    const missing = [marketCap == null ? 'market capitalization' : ''];
    let note = '';
    if (kind === 'pe') {
        const income = snapshot?.fundamentals.annualNetIncome;
        if (income == null) missing.push('annual net income'); else if (income <= 0) note = 'Annual net income is zero or negative.';
    } else if (kind === 'ps') {
        const revenue = snapshot?.fundamentals.annualRevenue;
        if (revenue == null) missing.push('annual revenue'); else if (revenue <= 0) note = 'Annual revenue is not positive.';
    } else if (snapshot?.fundamentals.freeCashFlow == null) missing.push('annual free cash flow');
    const needs = missing.filter(Boolean);
    return [needs.length ? `Needs ${needs.join(' and ')}.` : '', note].filter(Boolean).join(' ') || 'A required input was not returned.';
}

const ratioMeanings = [
    ['Price / earnings', 'Price paid for each unit of reported annual profit. This uses past earnings, not an earnings forecast.'],
    ['Price / sales', 'Price paid for each unit of annual sales. Sales do not account for costs or profit margins.'],
    ['Free cash flow yield', 'Annual cash left after capital spending, expressed as a percentage of market capitalization. This is not a dividend yield or promised return.'],
] as const;

function planCurrencyNote(planCurrency: string | null | undefined, quoteCurrency: string | null | undefined) {
    const plan = researchPriceCurrency(planCurrency);
    if (!plan) return 'Saved price assumptions below do not carry a currency in the research record; confirm the security’s trading currency before comparing them.';
    const quote = researchPriceCurrency(quoteCurrency);
    if (quote && quote !== plan) return `Saved prices are in ${plan}; the latest quote is in ${quote}. No currency conversion is applied, so compare them only after converting yourself.`;
    return `Saved prices are recorded in ${plan}.`;
}

function Metrics({ rows }: { rows: readonly (readonly [string, string, string?])[] }) {
    return <dl className={`${styles.valuationInputs} ${connected.metricList}`}>{rows.map(([label, value, context]) => <div key={label}><dt>{label}{context && <small className={connected.metricContext}>{context}</small>}</dt><dd>{value}</dd></div>)}</dl>;
}

function SourceLink({ url, label }: { url: string | null; label: string }) {
    const href = sourceHref(url);
    return href ? <a className={base.textButton} href={href} target="_blank" rel="noopener noreferrer">{label} ↗</a> : <span>{label} · no usable source link</span>;
}

export function ResearchConnectedPanel({ tab, record, market, snapshot, loading, providerError = false, advanced, onBenchmarkRequest, benchmarkError, benchmarkLoading, ...chart }: { onBenchmarkRequest: () => void; benchmarkError: boolean; benchmarkLoading: boolean; advanced: boolean; tab: ResearchTab; record?: ResearchRecord; market: ResearchMarket; snapshot: ResearchSnapshot | null; loading: boolean; providerError?: boolean } & ChartStateProps) {
    const fundamentals = snapshot?.fundamentals;
    const currency = fundamentals?.history.find(period => period.reportingPeriod === fundamentals.reportingPeriod)?.currency;
    const valuation = snapshot?.valuation;
    const cashDebt = cashDebtDisplay(valuation?.netCash, netCashCurrency(fundamentals));
    const reportingPeriod = fundamentals?.reportingPeriod;
    const parsedReportingPeriod = reportingPeriod && /^\d{4}-\d{2}-\d{2}$/.test(reportingPeriod)
        ? new Date(`${reportingPeriod}T00:00:00Z`)
        : null;
    const isoReportingPeriod = parsedReportingPeriod && Number.isFinite(parsedReportingPeriod.getTime())
        && parsedReportingPeriod.toISOString().slice(0, 10) === reportingPeriod;
    const annualPeriod = isoReportingPeriod
        ? `Year ended ${date(reportingPeriod)}`
        : financialPeriodLabel(reportingPeriod);
    const quoteObservation = `Quote observed: ${formatResearchTimestamp(snapshot?.quote.observedAt)}`;
    const sharePeriod = valuation?.shareDate ? `Reported ${date(valuation.shareDate)}`
        : valuation?.shareCount === undefined && market === 'US' ? researchMetricPeriodLabel(fundamentals, 'shares') : 'Share reporting date unavailable';
    const valuationShares = valuationShareCount(snapshot);
    return <div className={connected.panelContent}>
        {tab === 'Chart & technicals' && (snapshot
            ? <ResearchTechnicals key={`${snapshot.market}:${snapshot.symbol}:${snapshot.fetchedAt}`} snapshot={snapshot} />
            : <p role="status">{loading ? 'Loading security data for the chart…' : 'Security data is unavailable. Retry provider data above to load the chart.'}</p>)}
        {tab === 'Overview' && <>
            <PriceHistory snapshot={snapshot} loading={loading} record={record} {...chart} />
            {record && (advanced || record.whyInterested || record.notes || record.acceptedEvidence.length > 0 || record.documentEvidence.citations.length > 0) && <details className={connected.evidence}><summary>Your saved notes and evidence · optional</summary>
            <span className={base.eyebrow}>User-authored · saved {date(record.updatedAt)}</span>{record.whyInterested && <p className={connected.authored}>{record.whyInterested}</p>}{record.notes && <p className={connected.authored}>{record.notes}</p>}
            <h2>The evidence file</h2><p>Accepted research preserves its original sources and mode. A saved interpretation is not an independently verified fact.</p>
            {!record.acceptedEvidence.length && !record.documentEvidence.citations.length && <p className={styles.gapNote}>No accepted evidence or document citations are saved for this security.</p>}
            {record.acceptedEvidence.map(evidence => <details className={connected.evidence} key={evidence.id}><summary>{evidence.title} · {evidence.tone}</summary><small>Saved {evidence.mode === 'ai' ? 'AI interpretation' : 'evidence'} · accepted {date(evidence.acceptedAt)}</small><p>{evidence.summary}</p>{evidence.sources.map(source => <div key={source.id}><b>{source.label}</b><p>{source.value}</p><small>{source.reportingPeriod || 'Period not supplied'} · {source.source}</small><br /><SourceLink url={source.sourceUrl} label="Original source" /></div>)}</details>)}
            {record.documentEvidence.citations.map(citation => <details className={connected.evidence} key={citation.id}><summary>{citation.title}</summary><small>{citation.captureMethod === 'manual-unverified' ? 'Manual citation · unverified' : 'Official SEC capture'} · {citation.providerLabel} · published {date(citation.publicationDate)}</small><p>{citation.excerpt}</p><p>{citation.location} · reporting period {citation.reportingPeriod || 'not supplied'}</p><SourceLink url={citation.sourceUrl} label="Source document" /></details>)}
            </details>}
        </>}
        {tab === 'Financials' && <>
            <span className={base.eyebrow}>Provider-reported data</span><h2>Business performance</h2><p>{fundamentals?.source || 'Source unavailable'} · {annualPeriod}. Revenue, profit, margins and free cash flow use this annual period. Balance and share dates are shown separately below.</p>
            <ResearchDataAvailability snapshot={snapshot} section="Financials" loading={loading} error={providerError} />
            <ResearchFinancialSummary fundamentals={fundamentals} />
            <ResearchQualityAndCushion fundamentals={fundamentals} />
            <details className={connected.evidence}><summary>More financial measures and reporting dates</summary><h3>Annual margins</h3><Metrics rows={[
                ['Gross margin', number(fundamentals?.grossMarginPercent, '%'), annualPeriod], ['Operating margin', number(fundamentals?.operatingMarginPercent, '%'), annualPeriod],
            ]} /><h3>Reported balances and shares</h3><p>Each value keeps the dates of the facts used. A newer response does not make an older reported balance current.</p><Metrics rows={[
                ['Debt', money(fundamentals?.debt, fundamentals?.metricProvenance?.debt.currency), researchMetricPeriodLabel(fundamentals, 'debt')],
                ['Cash', money(fundamentals?.cash, fundamentals?.metricProvenance?.cash.currency), researchMetricPeriodLabel(fundamentals, 'cash')],
                [fundamentals?.source === 'Yahoo Finance' ? 'Annual diluted average shares' : 'Shares outstanding', number(fundamentals?.shares), researchMetricPeriodLabel(fundamentals, 'shares')],
                ['Annual share count change', number(fundamentals?.shareChangePercent, '%'), researchMetricPeriodLabel(fundamentals, 'shareChange')],
            ]} /></details>
            <details><summary>What do these measures tell you?</summary><p>Revenue measures sales. Margins describe the share left after different costs. Free cash flow is cash remaining after capital spending; it can diverge from accounting profit. Debt, cash and changes in share count add context. These measures alone do not establish business quality; company fundamentals may be inapplicable to funds.</p></details>
            <details className={connected.evidence}><summary>Reported financial history</summary>{fundamentals?.history.length ? <div className={connected.tableScroll} tabIndex={0} role="region" aria-label="Reported financial history"><table><caption>Actual periods returned by the service · no interpolated observations</caption><thead><tr><th>Period / source</th><th>Revenue</th><th>Free cash flow</th><th>Net income</th></tr></thead><tbody>{fundamentals.history.map((period, index) => <tr key={`${period.reportingPeriod}-${index}`}><th>{date(period.reportingPeriod)}<small>{period.source}</small></th><td>{money(period.annualRevenue, period.currency)}</td><td>{money(period.freeCashFlow, period.currency)}</td><td>{money(period.annualNetIncome, period.currency)}</td></tr>)}</tbody></table></div> : <p className={styles.gapNote}>{loading ? 'Loading financial history…' : 'No comparable financial history returned. Missing values are not zero.'}</p>}</details>
        </>}
        {tab === 'Thesis' && record && <>
            <span className={base.eyebrow}>Your saved reasoning</span><h2>A thesis you can test</h2><p>These are your saved judgments, not conclusions generated from the current quote.</p><div className={styles.thesisGrid}>{([['Why interested', record.whyInterested], ['Bull case', record.bullCase], ['Bear case', record.bearCase], ['What would invalidate the thesis?', record.thesisBreak], ['Buy trigger', record.buyTrigger], ['Sell trigger', record.sellTrigger]] as const).map(([label, value]) => <div key={label}><h3>{label}</h3><p className={connected.authored}>{value || 'Not recorded.'}</p></div>)}</div>
            <details className={connected.evidence}><summary>Saved investment checklist · {Object.values(record.checklist).filter(Boolean).length}/9 marked</summary><p>Marked means you selected this check in your saved review; it does not mean the source was independently verified.</p><ul className={connected.checklist}>{Object.entries(record.checklist).map(([key, marked]) => <li key={key}><b>{marked ? 'Marked' : 'Unmarked'}</b><span>{checklistLabelsV6[key] || key}</span></li>)}</ul></details>
        </>}
        {tab === 'Valuation' && <>
            <span className={base.eyebrow}>Separate the market price from your plan</span><h2>Price, value and downside</h2><p>Signal calculates these ratios from the returned price, shares and financial statements. They help compare price with business results; they do not establish a fair value or a suitable entry price. {valuation?.source || 'Valuation source unavailable'}.</p>
            <ResearchDataAvailability snapshot={snapshot} section="Valuation" loading={loading} error={providerError} />
            <h3>Returned price and share basis</h3>
            <Metrics rows={[
                ['Latest returned price', price(snapshot?.quote.price, snapshot?.quote.currency), quoteObservation],
                ['Shares used for valuation', number(valuationShares), `${valuation?.shareBasis || 'Share basis unavailable'} · ${sharePeriod}${valuation?.shareSource ? ` · ${valuation.shareSource}` : ''}${valuationShares == null && market === 'MY' ? ' · Malaysia share-based measures need compatible outstanding shares; annual diluted average shares are not substituted.' : ''}`],
                ['Market capitalization', compactFinancialAmount(valuation?.marketCap, snapshot?.quote.currency), missingValuationContext('marketCap', snapshot, market)],
            ]} />
            {market === 'MY' && valuationShares != null && valuation?.shareDate && <p data-testid="reported-share-limitation">This is the latest reported ordinary-share count returned by the provider, not a live share register. Issuance, buybacks or splits since {date(valuation.shareDate)} may change it. Confirm the latest issuer or Bursa announcement before relying on these ratios.</p>}
            <h3>Ratios using annual financials</h3><p>{annualPeriod}{currency ? ` · ${currency}` : ' · Financial currency unavailable'}. These ratios combine that annual period with the returned price and shares above; they are not historical ratios at the financial year end.</p>
            <Metrics rows={[
                ['Price / earnings', number(valuation?.priceEarnings, '×'), missingValuationContext('pe', snapshot, market)],
                ['Price / sales', number(valuation?.priceSales, '×'), missingValuationContext('ps', snapshot, market)],
                ['Free cash flow yield', number(valuation?.freeCashFlowYieldPercent, '%'), missingValuationContext('fcfYield', snapshot, market)],
            ]} />
            <details className={connected.evidence}><summary>What the ratios mean · exact inputs</summary>
                {ratioMeanings.map(([label, meaning]) => <p key={label}><b>{label}:</b> {meaning}</p>)}
                <p>These current-price ratios combine the returned price and share count with reported annual amounts. The quote, shares and financial statements may have different observation dates; no currency conversion is applied.</p>
                <p>Market capitalization = price × shares = {price(snapshot?.quote.price, snapshot?.quote.currency)} × {number(valuationShares)} = {money(valuation?.marketCap, snapshot?.quote.currency)}.</p>
                <p>Price / earnings = market capitalization ÷ annual net income = {money(valuation?.marketCap, snapshot?.quote.currency)} ÷ {money(fundamentals?.annualNetIncome, currency)} = {number(valuation?.priceEarnings, '×')}. A non-positive or missing denominator is unavailable.</p>
                <p>Price / sales = market capitalization ÷ annual revenue = {money(valuation?.marketCap, snapshot?.quote.currency)} ÷ {money(fundamentals?.annualRevenue, currency)} = {number(valuation?.priceSales, '×')}. A non-positive or missing denominator is unavailable.</p>
                <p>Free cash flow yield = annual free cash flow ÷ market capitalization × 100 = {money(fundamentals?.freeCashFlow, currency)} ÷ {money(valuation?.marketCap, snapshot?.quote.currency)} × 100 = {number(valuation?.freeCashFlowYieldPercent, '%')}.</p>
                <p>Annual inputs: {annualPeriod} · {fundamentals?.source || 'Financial source unavailable'}. These are derived ratios, not a fair-value estimate.</p>
            </details>
            <h3>Cash less debt</h3><Metrics rows={[
                [cashDebt.label, cashDebt.amount, `Cash less debt. Cash: ${researchMetricPeriodLabel(fundamentals, 'cash')}. Debt: ${researchMetricPeriodLabel(fundamentals, 'debt')}.`],
            ]} />
            <details className={connected.evidence}><summary>Exact cash and debt inputs</summary>
                <p>Cash: {money(fundamentals?.cash, fundamentals?.metricProvenance?.cash.currency)} · {researchMetricPeriodLabel(fundamentals, 'cash')}.</p>
                <p>Debt: {money(fundamentals?.debt, fundamentals?.metricProvenance?.debt.currency)} · {researchMetricPeriodLabel(fundamentals, 'debt')}.</p>
                <p>Net cash = cash − debt = {money(valuation?.netCash, netCashCurrency(fundamentals))}. A negative result is shown above as net debt with its positive magnitude. Source: {fundamentals?.source || 'Unavailable'}.</p>
            </details>
            {advanced && record && <><h3>Your saved valuation & position plan</h3><p>{planCurrencyNote(record.positionPlan.currency, snapshot?.quote.currency)}</p><PositionPlanComparison record={record} snapshot={snapshot} /><Metrics rows={[
                ['Valuation judgment', record.valuationState], ['Target buy zone', record.targetBuyZone || 'Not recorded'], ['Position', record.positionState],
                ['Planned allocation', number(record.positionPlan.plannedAllocationPercent, '%')], ['Average cost', planPrice(record.positionPlan.averageCost, record.positionPlan.currency)], ['Planned entry', planPrice(record.positionPlan.plannedEntryPrice, record.positionPlan.currency)], ['Invalidation', planPrice(record.positionPlan.invalidationPrice, record.positionPlan.currency)],
            ]} />
            </>}
            {(snapshot?.symbol ?? record?.symbol) && <HistoricalValuationV8 symbol={(snapshot?.symbol ?? record?.symbol)!} market={market} snapshot={snapshot} />}
            <details className={connected.evidence} onToggle={event => { if (event.currentTarget.open) onBenchmarkRequest(); }}><summary>Compare past returns with the benchmark</summary>{benchmarkLoading && <p role="status">Loading optional benchmark comparison…</p>}{benchmarkError && <p>Benchmark request failed. Close and reopen this comparison to retry.</p>}{market === 'MY' || snapshot?.benchmark.status === 'not-applicable' ? <><h3>Benchmark coverage</h3><p>The existing research snapshot does not supply a comparable Malaysia benchmark. No cross-market comparison is inferred.</p></> : <><h3>Existing benchmark comparison</h3><p>{snapshot?.benchmark.baselineName || 'Vanguard S&P 500 ETF'} (VOO) · {snapshot?.benchmark.windowStart && snapshot.benchmark.windowEnd ? `${date(snapshot.benchmark.windowStart)} to ${date(snapshot.benchmark.windowEnd)} · ${snapshot.benchmark.commonSessions} common sessions` : 'Comparison window unavailable'} · {snapshot?.benchmark.returnBasis || 'Return basis unavailable'}. Status: {snapshot?.benchmark.status || 'unavailable'}.</p><Metrics rows={[
                ['Security return', number(snapshot?.benchmark.candidateReturnPercent, '%')], ['Benchmark return', number(snapshot?.benchmark.baselineReturnPercent, '%')], ['Relative return', number(snapshot?.benchmark.relativeReturnPercent, ' percentage points')],
            ]} /></>}</details>
        </>}
        {tab === 'Review' && record && <>
            <div className={`${base.sectionHeading} ${connected.reviewHeading}`}><div><span className={base.eyebrow}>User-authored · saved record</span><h2>Your working note</h2></div><a className={base.textButton} href={researchHref(record.symbol, 'review', record.market)} target="_blank" rel="noopener noreferrer">Open full research review (new tab) ↗</a></div><p className={styles.noteText}>{record.notes || 'No note has been saved for this security.'}</p><Metrics rows={[
                ['Last reviewed', date(personalReviewDate(record))], ['Next review', date(record.decisionJournal.nextReviewAt)], ['Saved decision', record.decisionJournal.decision], ['Decision confidence', record.decisionJournal.confidence], ['Prior outcome', record.decisionJournal.priorOutcome],
            ]} /><p className={connected.authored}>{record.decisionJournal.outcomeNote || 'No outcome note recorded.'}</p>
            <h3>Saved review history</h3>{record.reviewHistory.length ? [...record.reviewHistory].sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt)).map(review => <details key={review.id} className={connected.evidence}><summary>{date(review.reviewedAt)} · {review.decisionJournal.decision}</summary><p className={connected.authored}>{review.whyInterested || 'No thesis recorded.'}</p><p className={styles.noteText}>{review.notes || 'No note recorded.'}</p><small>Confidence: {review.decisionJournal.confidence} · prior outcome: {review.decisionJournal.priorOutcome}</small></details>) : <p>No earlier review snapshots are saved.</p>}
        </>}
        {advanced && record && tab !== 'Review' && <a className={`${base.textButton} ${connected.editLink}`} href={researchHref(record.symbol, tab === 'Valuation' ? 'valuation' : 'review', record.market)} target="_blank" rel="noopener noreferrer">{tab === 'Valuation' ? 'Open full valuation workspace' : 'Edit saved research'} (new tab) ↗</a>}
    </div>;
}

// Round axis ticks with one step of room above and below the closes, so the line never touches the plot edge.
function priceTicks(low: number, high: number) {
    const raw = (high - low || Math.abs(high) || 1) / 4;
    const power = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map(multiple => multiple * power).find(value => value >= raw) ?? 10 * power;
    const first = Math.max(low >= 0 ? 0 : -Infinity, (Math.ceil(low / step) - 1) * step);
    const last = (Math.floor(high / step) + 1) * step;
    const ticks: number[] = [];
    for (let value = first; value <= last + step / 2; value += step) ticks.push(Number(value.toFixed(6)));
    return ticks;
}

function PriceHistory({ snapshot, loading, record, chartRange: range, setChartRange: setRange, chartDate, setChartDate }: { snapshot: ResearchSnapshot | null; loading: boolean; record?: ResearchRecord } & ChartStateProps) {
    const [mobileChart, setMobileChart] = useState(false);
    // Axis labels are sized in SVG units; scale them against the rendered width so they stay 12px on screen.
    const [chartElement, setChartElement] = useState<SVGSVGElement | null>(null);
    const [renderedWidth, setRenderedWidth] = useState(0);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const gradientId = 'price-fill-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
    useEffect(() => {
        if (!chartElement) return;
        const observer = new ResizeObserver(([entry]) => setRenderedWidth(entry.contentRect.width));
        observer.observe(chartElement);
        return () => observer.disconnect();
    }, [chartElement]);
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
    const closeLow = Math.min(...points.map(item => item.close));
    const closeHigh = Math.max(...points.map(item => item.close));
    // The 52-week range comes from provider technicals. It widens the scale only on long ranges,
    // so 1M/3M keep their detail and show just the 52-week lines that fall in view.
    const technicals = snapshot?.technicals;
    const band = technicals && technicals.low52Week !== null && technicals.high52Week !== null && Number.isFinite(technicals.low52Week) && Number.isFinite(technicals.high52Week) && technicals.high52Week > technicals.low52Week ? { low: technicals.low52Week, high: technicals.high52Week } : null;
    const showBand = !!band && (range === '1Y' || range === 'All');
    const ticks = priceTicks(showBand && band ? Math.min(closeLow, band.low) : closeLow, showBand && band ? Math.max(closeHigh, band.high) : closeHigh);
    const low = ticks[0];
    const high = ticks[ticks.length - 1];
    const periodChange = priceRangeChange(points);
    const change = periodChange?.amount ?? null;
    const lineColor = change === null || change === 0 ? 'var(--muted)' : change > 0 ? 'var(--up)' : 'var(--down)';
    const movement = change === null ? points.length === 1 ? 'One observation; no period change available' : 'A comparable period change is unavailable' : change === 0 ? 'Unchanged over selected period' : `${change > 0 ? 'Rose' : 'Fell'} over selected period`;
    const start = points.length ? Date.parse(points[0].time) : 0;
    const markers = record ? savedReviewMarkers(record).filter(marker => Date.parse(marker.time) >= start && Date.parse(marker.time) <= end) : [];
    const chartSize = mobileChart
        ? { width: 375, height: 260, left: 58, right: 360, top: 48, bottom: 205, labelSize: 16 }
        : { width: 750, height: 225, left: 65, right: 715, top: 45, bottom: 180, labelSize: 12 };
    const labelSize = renderedWidth ? 12 * chartSize.width / renderedWidth : chartSize.labelSize;
    // Give review diamonds their own row above the range labels. Translate the whole plot so its price scale stays unchanged.
    const markerRowHeight = markers.length ? labelSize * 2 : 0;
    const chart = { ...chartSize, top: chartSize.top + markerRowHeight, bottom: chartSize.bottom + markerRowHeight, height: chartSize.height + markerRowHeight };
    const x = (time: string) => chart.left + (Date.parse(time) - start) / (end - start || 1) * (chart.right - chart.left);
    const y = (value: number) => chart.bottom - (value - low) / (high - low || 1) * (chart.bottom - chart.top);
    // 52-week lines inside the scale carry their own value: the high's label above its line, the low's below.
    const bandLines = band ? ([['52-wk high', band.high], ['52-wk low', band.low]] as const).filter(([, value]) => value >= low && value <= high) : [];
    const bandLabelY = (label: string, value: number) => label === '52-wk high' ? y(value) - 5 : y(value) + labelSize + 3;
    // Labels scale up as the chart narrows, so the date row drops below a 52-week low label instead of colliding with it.
    const lowLabelY = band && bandLines.some(([label]) => label === '52-wk low') ? bandLabelY('52-wk low', band.low) : chart.bottom;
    const dateY = Math.max(chart.height - 10, chart.bottom + labelSize * 1.5, lowLabelY + labelSize * 1.5);
    // Evenly spaced dates on the time axis: three on a phone, five on desktop.
    const dateCount = points.length < 2 ? 1 : mobileChart ? 3 : 5;
    const dateTicks = Array.from({ length: dateCount }, (_, i) => dateCount === 1 ? start : start + i * (end - start) / (dateCount - 1));
    const viewHeight = dateY + 10;
    const area = points.length > 1 ? `M${x(points[0].time)},${chart.bottom} ${points.map(item => `L${x(item.time)},${y(item.close)}`).join(' ')} L${x(points[points.length - 1].time)},${chart.bottom} Z` : '';
    const hovered = hoverIndex !== null ? points[hoverIndex] : undefined;
    const hoverChange = hovered && points[0].close ? (hovered.close - points[0].close) / points[0].close * 100 : null;
    const hoverEdge = hovered ? x(hovered.time) / chart.width < .18 ? 'start' : x(hovered.time) / chart.width > .82 ? 'end' : 'mid' : 'mid';
    const nearestAt = (event: { currentTarget: SVGSVGElement; clientX: number; clientY: number }) => {
        const matrix = event.currentTarget.getScreenCTM();
        if (!matrix) return null;
        const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
        const fraction = Math.max(0, Math.min(1, (local.x - chart.left) / (chart.right - chart.left)));
        return nearestPricePoint(points, start + fraction * (end - start));
    };
    return <section className={connected.priceHistory} aria-label="Price history">
        <div className={connected.chartHeader}><div><h3>Price history</h3>{point && <p className={connected.rangeChange} data-testid="research-range-change">{periodChange ? <><strong style={{ color: lineColor }}>{periodChange.amount > 0 ? '+' : ''}{price(periodChange.amount, snapshot?.quote.currency)}{periodChange.percentage !== null ? ` (${periodChange.percentage > 0 ? '+' : ''}${number(periodChange.percentage, '%')})` : ' · percentage unavailable: starting close is zero'}</strong> <span>{date(periodChange.start)} → {date(periodChange.end)} · returned daily closes</span></> : movement}</p>}</div><fieldset className={base.segment}><legend className={base.visuallyHidden}>Price history range</legend>{['1M', '3M', '1Y', 'All'].map(value => <button key={value} aria-pressed={range === value} onClick={() => { setRange(value); setChartDate(null); }}>{value}</button>)}</fieldset></div>
        {point ? <><output className={connected.priceReadout} aria-live="polite">{date(point.time)} · close {price(point.close, snapshot?.quote.currency)}</output><div className={connected.priceChartFrame}><svg ref={setChartElement} className={connected.priceChart} viewBox={`0 0 ${chart.width} ${viewHeight}`} role="img" onClick={event => {
            const nearest = nearestAt(event);
            if (nearest !== null) setChartDate(points[nearest].time);
        }} onPointerMove={event => { if (event.pointerType === 'mouse') setHoverIndex(nearestAt(event)); }} onPointerLeave={() => setHoverIndex(null)} aria-label={`${snapshot?.symbol} daily closing price, ${date(points[0].time)} to ${date(points[points.length - 1].time)}. Exact values are available in the history table.`}>
            <defs><linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={lineColor} stopOpacity=".2" /><stop offset="1" stopColor={lineColor} stopOpacity="0" /></linearGradient></defs>
            {showBand && band && <rect data-testid="research-52w-band" x={chart.left} width={chart.right - chart.left} y={y(band.high)} height={y(band.low) - y(band.high)} fill="var(--surface-muted)" />}
            {ticks.map(tick => <g key={tick}><line x1={chart.left} x2={chart.right} y1={y(tick)} y2={y(tick)} stroke={tick === low ? 'var(--line-strong)' : 'var(--line)'} /><text x={chart.left - 8} y={y(tick) + labelSize / 3} textAnchor="end" fill="var(--muted)" style={{ fontSize: labelSize }}>{number(tick)}</text></g>)}
            {bandLines.map(([label, value]) => <g key={label} data-testid="research-52w-line"><line x1={chart.left} x2={chart.right} y1={y(value)} y2={y(value)} stroke="var(--subtle)" strokeDasharray="2 4" /><text x={chart.left + 6} y={bandLabelY(label, value)} fill="var(--muted)" style={{ fontSize: labelSize }}>{label} {number(value)}</text></g>)}
            {area && <path d={area} fill={`url(#${gradientId})`} />}<polyline data-testid="research-price-line" fill="none" stroke={lineColor} strokeWidth="2.5" points={points.map(item => `${x(item.time)},${y(item.close)}`).join(' ')} /><line x1={x(point.time)} x2={x(point.time)} y1={chart.top - 10} y2={chart.bottom + 8} stroke="var(--muted)" strokeDasharray="4 4" /><circle cx={x(point.time)} cy={y(point.close)} r="5" fill={lineColor} />
            {markers.map(marker => <g key={`${marker.time}-${marker.label}`} data-testid="research-review-marker"><line x1={x(marker.time)} x2={x(marker.time)} y1={chart.top} y2={chart.bottom} stroke="var(--brand)" strokeOpacity=".45" /><path d={`M${x(marker.time)},${chartSize.top - 16} l6,6 l-6,6 l-6,-6 Z`} fill="var(--brand)" /><title>{date(marker.time)} · {marker.label}</title></g>)}
            {hovered && <g pointerEvents="none"><line x1={x(hovered.time)} x2={x(hovered.time)} y1={chart.top} y2={chart.bottom} stroke="var(--subtle)" /><line x1={chart.left} x2={chart.right} y1={y(hovered.close)} y2={y(hovered.close)} stroke="var(--subtle)" strokeDasharray="3 4" /><circle cx={x(hovered.time)} cy={y(hovered.close)} r="4.5" fill="var(--surface)" stroke={lineColor} strokeWidth="2.5" /></g>}
            {dateTicks.map((time, i) => <text key={time} x={chart.left + (dateCount === 1 ? 0 : i / (dateCount - 1)) * (chart.right - chart.left)} y={dateY} textAnchor={i === 0 ? 'start' : i === dateCount - 1 ? 'end' : 'middle'} fill="var(--muted)" style={{ fontSize: labelSize }}>{date(new Date(time).toISOString())}</text>)}
        </svg>{hovered && <div className={connected.priceTooltip} aria-hidden="true" data-edge={hoverEdge} style={{ left: `${x(hovered.time) / chart.width * 100}%`, top: `${y(hovered.close) / viewHeight * 100}%` }}><b>{price(hovered.close, snapshot?.quote.currency)}</b><span>{date(hovered.time)}{hoverChange !== null ? ` · ${hoverChange >= 0 ? '+' : '−'}${Math.abs(hoverChange).toFixed(2)}% vs ${date(points[0].time)}` : ''}</span></div>}</div>
        {(showBand || bandLines.length > 0 || markers.length > 0) && <div className={connected.chartLegend} aria-hidden="true"><span><i data-swatch="line" style={{ background: lineColor }} />Daily close</span>{showBand ? <span><i data-swatch="band" />52-week range</span> : bandLines.length > 0 && <span><i data-swatch="dash" />52-week high/low</span>}{markers.length > 0 && <span><i data-swatch="marker" />Your saved review</span>}</div>}
        {markers.length > 0 && <p className={connected.chartMarkers}>Your saved reviews in this range: {markers.map(marker => `${date(marker.time)} · ${marker.label}`).join('; ')}.</p>}
        <label className={connected.scrubber}>Inspect a trading date<input type="range" min="0" max={points.length - 1} value={index} disabled={points.length === 1} onChange={event => setChartDate(points[Number(event.target.value)]?.time ?? null)} aria-valuetext={`${date(point.time)}, close ${price(point.close, snapshot?.quote.currency)}`} /></label><details className={connected.chartNotes}><summary>How to read this chart</summary><p className={connected.chartInteractionHint}>Tap or click the chart, or use the date slider to inspect a returned close.</p><p>The change beside the title compares the first and last returned closes in this range. Price change only; not total return. This is separate from the quote’s daily change.</p><p data-testid="research-period-direction">{movement}. Line colour compares the first and last returned closes in this range.</p><p>{points.length} returned observations · {snapshot?.quote.currency || 'Currency unavailable'}. Lines connect returned closes; missing sessions are not filled. These are historical closes, not the latest quote.</p></details><details><summary>View exact history values</summary><div className={connected.tableScroll} tabIndex={0} role="region" aria-label="Closing price table"><table><thead><tr><th>Date</th><th>Close ({snapshot?.quote.currency || 'currency unavailable'})</th><th>Volume</th></tr></thead><tbody>{points.map(item => <tr key={item.time}><th>{date(item.time)}</th><td>{number(item.close)}</td><td>{number(item.volume)}</td></tr>)}</tbody></table></div></details></> : <p className={styles.gapNote}>{loading ? 'Loading price history…' : 'No price history returned. No illustrative line is shown.'}</p>}
    </section>;
}

