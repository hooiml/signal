import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { researchSnapshotFixture } from './research-read-fixture.mjs';
import { isolatedSnapshot } from './research-improvements-regression.mjs';

// Exercise actual parsing, adapters and presentation with isolated providers; no SQL/network.
const modules = new Map();
function load(file) {
    const absolute = path.resolve(file);
    if (modules.has(absolute)) return modules.get(absolute).exports;
    const compiled = { exports: {} };
    modules.set(absolute, compiled);
    const require = id => {
        if (id.endsWith('.module.css')) return {};
        if (id === 'next/cache') return { unstable_cache: fn => fn };
        if (['./OverviewPanelV6', './ResearchPanelsV6', './ResearchChartV6'].includes(id)) return { [id.slice(2)]: () => null };
        if (id === './ResearchReadinessStripV6') return { ResearchReadinessStripV6: () => null, useResearchReadinessV6: () => ({ nextGap: { destination: 'review', label: 'Review research' } }) };
        if (!id.startsWith('.') && !id.startsWith('@/')) return createRequire(absolute)(id);
        const resolved = id.startsWith('@/') ? path.resolve('src', id.slice(2)) : path.resolve(path.dirname(absolute), id);
        return load(existsSync(`${resolved}.ts`) ? `${resolved}.ts` : `${resolved}.tsx`);
    };
    const code = ts.transpileModule(readFileSync(absolute, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: absolute,
    }).outputText;
    new Function('require', 'module', 'exports', code)(require, compiled, compiled.exports);
    return compiled.exports;
}

const { parseSecCompanyFacts } = load('src/lib/research/sec-edgar.ts');
const fact = (val, end, annual = false) => ({ val, end, filed: '2026-08-01', form: annual ? '10-K' : '10-Q', fp: annual ? 'FY' : 'Q2', ...(annual ? { start: `${end.slice(0, 4)}-01-01` } : {}) });
const usd = (...entries) => ({ units: { USD: entries } });
const fundamentals = parseSecCompanyFacts({ facts: { 'us-gaap': {
    Revenues: usd(fact(1200, '2025-12-31', true), fact(1000, '2024-12-31', true)),
    NetIncomeLoss: usd(fact(90, '2024-12-31', true)),
    NetCashProvidedByUsedInOperatingActivities: usd(fact(100, '2025-12-31', true)),
    PaymentsToAcquirePropertyPlantAndEquipment: usd(fact(40, '2025-12-31', true)),
    LongTermDebtCurrent: usd(fact(20, '2026-06-30')),
    LongTermDebtNoncurrent: usd(fact(80, '2026-03-31')),
    CashAndCashEquivalentsAtCarryingValue: usd(fact(0, '2026-06-30'), fact(70, '2025-12-31', true)),
    CommonStockSharesOutstanding: { units: { shares: [fact(115, '2026-06-30'), fact(110, '2025-12-31', true), fact(100, '2024-12-31', true)] } },
} } });
assert.equal(fundamentals.annualRevenue, 1200);
assert.equal(fundamentals.annualNetIncome, null, 'An older annual value is never carried into the aligned current annual summary.');
assert.equal(fundamentals.freeCashFlow, 60);
assert.equal(fundamentals.debt, 100, 'Keep the existing debt calculation while revealing its component dates.');
assert.deepEqual(fundamentals.metricProvenance.debt, { reportingPeriods: ['2026-03-31', '2026-06-30'], currency: 'USD' });
assert.equal(fundamentals.cash, 0);
assert.deepEqual(fundamentals.metricProvenance.cash.reportingPeriods, ['2026-06-30']);
assert.equal(fundamentals.shares, 115);
assert.deepEqual(fundamentals.metricProvenance.shares.reportingPeriods, ['2026-06-30']);
assert.equal(fundamentals.shareChangePercent, 10);
assert.deepEqual(fundamentals.metricProvenance.shareChange.reportingPeriods, ['2024-12-31', '2025-12-31']);

const { parseResearchSnapshotResponse, parseResearchQuoteResponse } = load('src/lib/research/snapshot-input.ts');
const payload = structuredClone(researchSnapshotFixture);
payload.data.fundamentals = fundamentals;
payload.data.quote = { ...payload.data.quote, observedAt: '2026-10-20T20:00:00.000Z' };
assert.deepEqual(parseResearchSnapshotResponse(payload).fundamentals.metricProvenance, fundamentals.metricProvenance);
for (const corrupt of [
    metric => { metric.reportingPeriods = ['2026-02-30']; },
    metric => { metric.reportingPeriods = ['2026-06-30', '2026-06-30']; },
    metric => { metric.reportingPeriods = '2026-06-30'; },
    metric => { metric.currency = 'unknown currency'; },
]) {
    const invalid = structuredClone(payload);
    corrupt(invalid.data.fundamentals.metricProvenance.debt);
    assert.throws(() => parseResearchSnapshotResponse(invalid));
}
const legacy = structuredClone(payload);
delete legacy.data.fundamentals.metricProvenance;
assert.doesNotThrow(() => parseResearchSnapshotResponse(legacy), 'Older snapshots remain readable without invented provenance.');
assert.throws(() => parseResearchQuoteResponse({ data: { quote: { ...payload.data.quote, observedAt: 'unknown' } } }));
const { researchMetricPeriodLabel, formatResearchTimestamp } = load('src/lib/research/metric-provenance.ts');
assert.equal(researchMetricPeriodLabel(legacy.data.fundamentals, 'debt'), 'Reporting date unavailable');
assert.match(researchMetricPeriodLabel(fundamentals, 'debt'), /2026-03-31 and 2026-06-30; dates differ/);
assert.equal(formatResearchTimestamp(null), 'Unavailable');
assert.match(formatResearchTimestamp(payload.data.quote.observedAt), /20 Oct 2026.*20:00 UTC/);

const priorFetch = globalThis.fetch;
let providerReturnedAt = 0;
try {
    globalThis.fetch = async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        providerReturnedAt = Date.now();
        return new Response(JSON.stringify({ chart: { result: [{
            meta: { regularMarketPrice: 10.02, regularMarketTime: Date.parse(payload.data.quote.observedAt) / 1000, currency: 'GBp' },
            timestamp: [], indicators: { quote: [{ close: [], volume: [] }] },
        }] } }));
    };
    const returned = await load('src/lib/research/quote.ts').getResearchQuote('AAPL', 'US');
    assert.equal(returned.quote.observedAt, payload.data.quote.observedAt, 'Batch quote path retains the provider observation timestamp.');
    assert.equal(returned.quote.currency, 'GBp');
    assert.ok(Date.parse(returned.fetchedAt) >= providerReturnedAt, 'Retrieval time is recorded after the provider response, not before the request.');
} finally {
    globalThis.fetch = priorFetch;
}

const my = await isolatedSnapshot().snapshot().getResearchSnapshot('5347', 'MY', undefined, false);
assert.deepEqual(my.fundamentals.metricProvenance.shares.reportingPeriods, ['2025-12-31']);
assert.equal(my.valuation.marketCap, null, 'Annual diluted-average shares are still never substituted for quote outstanding shares.');

const { createResearchRecord } = load('src/lib/research/records.ts');
const { createWatchlistItemV6 } = load('src/components/v6/research-records-v6.ts');
const { applyResearchQuoteV6, applyResearchSnapshotV6 } = load('src/components/v6/research-snapshot-v6.ts');
const { formatPriceV6 } = load('src/components/v6/research-v6.ts');
const record = createResearchRecord({ symbol: 'AAPL', market: 'US', companyName: 'Fixture', saveOnly: true });
const item = createWatchlistItemV6(record, 0);
const quote = { name: 'Fixture', price: 10.02, currency: 'MYR', dailyChangePercent: null, observedAt: '2026-10-20T20:00:00.000Z' };
assert.equal(formatPriceV6(applyResearchQuoteV6(item, quote)), '10.02 MYR', 'Provider currency is used even when different from the saved market.');
assert.equal(formatPriceV6(applyResearchQuoteV6(item, { ...quote, currency: 'GBp' })), '10.02 GBp');
assert.equal(formatPriceV6(applyResearchQuoteV6(item, { ...quote, currency: null })), '10.02 (currency not recorded)');
assert.equal(applyResearchQuoteV6(item, quote).dailyChange, undefined);
assert.equal(applyResearchQuoteV6(item, { ...quote, dailyChangePercent: 0 }).dailyChange, 0);
assert.match(applyResearchSnapshotV6(item, payload.data).debtLevel, /2026-03-31 and 2026-06-30/);

const { ResearchDetailV6 } = load('src/components/v6/ResearchDetailV6.tsx');
const noop = () => {};
const detail = recordOverride => renderToStaticMarkup(React.createElement(ResearchDetailV6, {
    ticker: item, records: [recordOverride], items: [item], record: recordOverride, theme: 'light', liveQuote: quote,
    liveQuoteRetrievedAt: '2026-10-21T10:00:00.000Z', activeTab: 'overview', startReview: false,
    stagedEvidence: null, workflowTemplateId: null, saving: false, saveError: null,
    onTabChange: noop, onReadinessNavigate: noop, onSave: noop, onReviewChange: noop, onSnapshot: noop, onSnapshotState: noop, onDelete: noop, presentation: 'v7',
}));
const bookmarked = detail(record);
assert.match(bookmarked, /Your saved decision · Not recorded/);
assert.match(bookmarked, /no personal review recorded/);
assert.match(bookmarked, /Daily change unavailable/);
assert.doesNotMatch(bookmarked, /\+0\.00%|Research reviewed|Decision · Watch/);
assert.match(bookmarked, /Quote observed.*20 Oct 2026.*20:00 UTC/);
assert.match(bookmarked, /Quote response retrieved.*21 Oct 2026.*10:00 UTC/);
const reviewed = detail({ ...record, decisionJournal: { ...record.decisionJournal, decision: 'Avoid' } });
assert.match(reviewed, /Your saved decision · Avoid/);
assert.match(reviewed, /Calculated checklist status: Watch/);

const { ResearchConnectedPanel } = load('src/components/v8/ResearchV8ConnectedPanels.tsx');
const panel = (tab, snapshot) => renderToStaticMarkup(React.createElement(ResearchConnectedPanel, {
    tab, market: snapshot.market, snapshot, loading: false, advanced: false,
    onBenchmarkRequest: noop, benchmarkError: false, benchmarkLoading: false, chartRange: '1Y', setChartRange: noop, chartDate: null, setChartDate: noop,
}));
assert.match(panel('Financials', payload.data), /Components reported 2026-03-31 and 2026-06-30; dates differ/);
assert.match(panel('Financials', legacy.data), /Reporting date unavailable/);
assert.match(panel('Valuation', payload.data), /not historical ratios at the financial year end/);
assert.match(panel('Valuation', my), /Share reporting date unavailable/);
console.log('Research provenance regression passed: exact balance dates, aligned annual values, unknown legacy provenance, quote units/timestamps and authored-review semantics.');
