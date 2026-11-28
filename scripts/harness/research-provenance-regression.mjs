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
const moduleOverrides = new Map();
function load(file) {
    const absolute = path.resolve(file);
    if (moduleOverrides.has(absolute)) return moduleOverrides.get(absolute);
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

const oldBookmark = { ...record, lastReviewedAt: '2020-01-01' };
const { InvestmentPolicyGuardrailsV6 } = load('src/components/v6/InvestmentPolicyGuardrailsV6.tsx');
const policyMarkup = renderToStaticMarkup(React.createElement(InvestmentPolicyGuardrailsV6, {
    records: [oldBookmark], items: [item], theme: 'light', onOpen: noop,
}));
assert.match(policyMarkup, /Not reviewed/);
assert.match(policyMarkup, /1 record needs a dated personal review/);
assert.doesNotMatch(policyMarkup, /Reviewed \d+ days ago|null days|NaN days|>Within policy<\/span>|>0 violations<\/span>/);

const { ResearchMarketContextV6 } = load('src/components/v6/MarketResearchHandoffV6.tsx');
const handoff = { market: 'US', mode: 'standard', score: 60, tier: 'buy', freshness: 'fresh', coverage: 'strong', conflicts: [], snapshotAt: new Date().toISOString() };
const contextMarkup = records => renderToStaticMarkup(React.createElement(ResearchMarketContextV6, {
    handoff, items: [createWatchlistItemV6(records[0], 0)], records, theme: 'light', onOpen: noop,
}));
assert.match(contextMarkup([oldBookmark]), /0 owned or stale reviews/, 'The Market handoff does not count an old bookmark as a stale personal review.');
assert.match(contextMarkup([{ ...oldBookmark, decisionJournal: { ...oldBookmark.decisionJournal, decision: 'Watch' } }]), /1 owned or stale review/, 'Legacy authored decisions keep their stale-review priority.');

const { watchlist } = load('src/components/research/ResearchDashboardV2.tsx');
const { mergeSavedMarketExposureWatchlist } = load('src/components/v6/MarketWatchlistExposureV6.tsx');
const { buildMarketWatchlistExposure } = load('src/lib/research/market-exposure.ts');
const seededSymbol = watchlist.find(candidate => candidate.market === 'US').symbol;
const savedExposureRecords = [{ ...oldBookmark, symbol: seededSymbol }, { ...oldBookmark, symbol: 'BOOK' }];
const mappedExposure = mergeSavedMarketExposureWatchlist(savedExposureRecords, []);
const exposures = buildMarketWatchlistExposure({ metadata: { market: 'US', score_drivers: [] }, components: {} }, mappedExposure);
for (const symbol of [seededSymbol, 'BOOK']) {
    assert.equal(mappedExposure.find(candidate => candidate.symbol === symbol).lastReviewedAt, null, 'Both seeded replacements and added bookmarks retain missing authorship in the Exposure mapper.');
    assert.equal(exposures.find(candidate => candidate.symbol === symbol).reviewAgeDays, null);
    assert.equal(exposures.find(candidate => candidate.symbol === symbol).reviewStatus, 'not-reviewed');
}

// Exercise the real request parsers and evaluators; replace only provider/SQL enrichment boundaries.
const snapshotRequests = [];
const catalystRequests = [];
const dualEarningsDate = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
moduleOverrides.set(path.resolve('src/lib/research/snapshot.ts'), { getResearchSnapshot: async (symbol, market) => {
    snapshotRequests.push([market, symbol]);
    const snapshot = structuredClone(researchSnapshotFixture.data);
    if (symbol !== 'DUAL') return snapshot;
    const observedAt = new Date().toISOString();
    return {
        ...snapshot, symbol, market, fetchedAt: observedAt,
        quote: { ...snapshot.quote, observedAt, currency: market === 'MY' ? 'MYR' : 'USD', price: market === 'MY' ? 12 : 24 },
    };
} });
moduleOverrides.set(path.resolve('src/lib/research/catalysts.ts'), { fetchUpcomingCatalysts: async (symbols) => {
    catalystRequests.push(symbols);
    return symbols.includes('DUAL') ? new Map([['DUAL', {
        date: dualEarningsDate, type: 'earnings', timing: 'after-hours', fiscalQuarterEnding: null,
        epsForecast: null, source: 'Nasdaq earnings calendar',
    }]]) : new Map();
} });
moduleOverrides.set(path.resolve('src/lib/research/macro-calendar.ts'), { fetchResearchMacroCalendar: async () => ({ events: [], warnings: [] }) });
moduleOverrides.set(path.resolve('src/lib/research/research-attention.ts'), { enrichResearchInboxWithAttention: async inbox => inbox });
const { buildResearchAlertRequest, monitoredAlertRecords } = load('src/lib/research/alert-request.ts');
const { buildResearchCalendarRequest } = load('src/lib/research/calendar-request.ts');
const monitoredBookmark = {
    ...oldBookmark,
    decisionJournal: { ...oldBookmark.decisionJournal, nextReviewAt: '2026-07-01' },
    monitoringRules: { ...oldBookmark.monitoringRules, earningsWithinDays: null, structuredTriggers: { version: 1, migrationState: 'current', rules: [
        { id: 'age', enabled: true, purpose: 'scheduled-evidence-review', metric: 'research-age-days', operator: 'above', threshold: 30 },
    ] } },
};
const alertBody = buildResearchAlertRequest([createWatchlistItemV6(monitoredBookmark, 0)], [monitoredBookmark]);
const alertsRoute = load('src/app/api/research/alerts/route.ts');
const inboxRoute = load('src/app/api/research/inbox/route.ts');
const calendarRoute = load('src/app/api/research/calendar/route.ts');
const ownerAccess = load('src/lib/owner-access.ts');
const originalOwnerSecret = process.env.OWNER_ACCESS_SECRET;
process.env.OWNER_ACCESS_SECRET = 'provenance-fixture-secret-0123456789abcdef';
try {
    const cookie = `${ownerAccess.ownerAccessCookieName}=${await ownerAccess.issueOwnerAccessToken(process.env.OWNER_ACCESS_SECRET)}`;
    const post = (route, body, authenticated = false) => new Request(`http://localhost/api/research/${route}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { cookie } : {}) }, body: JSON.stringify(body),
    });
    const alerts = await alertsRoute.POST(post('alerts', alertBody));
    assert.equal(alerts.status, 200, 'The Alerts route accepts null as a missing authored-review date.');
    const coverage = (await alerts.json()).data.triggerCoverage;
    assert.equal(coverage[0].status, 'unavailable');
    assert.equal(coverage[0].market, 'US');
    assert.equal(coverage[0].observed, null);
    assert.match(coverage[0].detail, /no personal review is recorded/);

    const dualRecord = (market, threshold, lastReviewedAt) => {
        const saved = createResearchRecord({ symbol: 'DUAL', market, companyName: `Fixture ${market}` });
        return {
            ...saved, lastReviewedAt,
            monitoringRules: { ...saved.monitoringRules, reviewAgeDays: null, earningsWithinDays: market === 'US' ? 21 : null,
                structuredTriggers: { version: 1, migrationState: 'current', rules: [
                    { id: 'price', enabled: true, purpose: 'opportunity-review', metric: 'price', operator: 'above', threshold },
                    { id: 'earnings', enabled: true, purpose: 'scheduled-evidence-review', metric: 'earnings-within-days', operator: 'within', threshold: 7 },
                ] },
            },
        };
    };
    const us = dualRecord('US', 30, '2026-07-01');
    const my = dualRecord('MY', 10, '2026-07-02');
    const { parseWatchlist } = load('src/components/v8/research-v8-connected-data.ts');
    const savedListings = parseWatchlist({ success: true, data: [us, my] });
    assert.deepEqual(savedListings.map(({ market, symbol }) => [market, symbol]), [['US', 'DUAL'], ['MY', 'DUAL']]);
    assert.throws(() => parseWatchlist({ success: true, data: [us, my, us] }), /Duplicate saved securities/);
    const monitored = monitoredAlertRecords([...savedListings, { ...us, symbol: ' dual ' }]);
    const dualBody = buildResearchAlertRequest(monitored, [my, us]);
    assert.deepEqual(
        dualBody.map(input => [input.market, input.symbol, input.lastReviewedAt, input.monitoringRules.structuredTriggers.rules[0].threshold]),
        [['US', 'DUAL', '2026-07-01', 30], ['MY', 'DUAL', '2026-07-02', 10]],
    );
    snapshotRequests.length = 0;
    catalystRequests.length = 0;
    const duplicate = await alertsRoute.POST(post('alerts', [dualBody[0], { ...dualBody[0], symbol: ' dual ' }]));
    assert.equal(duplicate.status, 400);
    assert.match((await duplicate.json()).error, /listings must be unique/i);
    assert.equal(snapshotRequests.length, 0, 'Reject a duplicate before reaching the snapshot provider.');
    assert.equal(catalystRequests.length, 0, 'Reject a duplicate before reaching the calendar provider.');

    const dualAlerts = await alertsRoute.POST(post('alerts', [{ ...dualBody[0], symbol: ' dual ' }, dualBody[1]]));
    assert.equal(dualAlerts.status, 200);
    const dualData = (await dualAlerts.json()).data;
    assert.equal(dualData.monitoredCount, 2);
    assert.deepEqual(snapshotRequests.splice(0), [['US', 'DUAL'], ['MY', 'DUAL']]);
    assert.deepEqual(catalystRequests.splice(0), [['DUAL']], 'Only the listed US security can use the earnings feed.');
    assert.deepEqual(
        dualData.triggerCoverage.map(entry => [entry.market, entry.symbol, entry.rule.id, entry.status]),
        [
            ['US', 'DUAL', 'price', 'not-matched'], ['US', 'DUAL', 'earnings', 'not-matched'],
            ['MY', 'DUAL', 'price', 'matched'], ['MY', 'DUAL', 'earnings', 'unavailable'],
        ],
    );
    assert.equal(dualData.triggerCoverage[0].observed.value, 24);
    assert.equal(dualData.triggerCoverage[1].observed.observedAt, dualEarningsDate);
    assert.equal(dualData.triggerCoverage[2].observed.value, 12);
    assert.equal(dualData.triggerCoverage[3].observed, null);
    assert.deepEqual(dualData.alerts.map(entry => [entry.market, entry.symbol, entry.kind]), [['MY', 'DUAL', 'structured-trigger']]);
    assert.deepEqual(dualData.alerts[0].structuredTrigger, dualData.triggerCoverage[2]);
    const { parseResearchAlertsResponse } = load('src/components/v6/ResearchAlertsV6.tsx');
    const parseAlerts = data => parseResearchAlertsResponse({ success: true, data });
    assert.deepEqual(parseAlerts(dualData), dualData);
    const [matched] = dualData.alerts;
    assert.throws(() => parseAlerts({ ...dualData, alerts: [{ ...matched, market: undefined }] }), /Invalid research alerts data/);
    assert.throws(() => parseAlerts({ ...dualData, alerts: [{ ...matched, market: 'US' }] }), /Invalid research alerts data/);
    assert.throws(() => parseAlerts({ ...dualData, triggerCoverage: [{ ...dualData.triggerCoverage[0], market: 'unknown' }] }), /Invalid research alerts data/);

    const bothMatch = dualBody.map(input => ({
        ...input, targetBuyZone: '10 - 30',
        monitoringRules: { ...input.monitoringRules, structuredTriggers: {
            ...input.monitoringRules.structuredTriggers, rules: [{ ...input.monitoringRules.structuredTriggers.rules[0], threshold: 10 }],
        } },
    }));
    const bothResponse = await alertsRoute.POST(post('alerts', bothMatch));
    assert.equal(bothResponse.status, 200);
    const matching = (await bothResponse.json()).data.alerts;
    assert.deepEqual(matching.map(entry => `${entry.market}:${entry.kind}`).sort(), [
        'MY:market-condition', 'MY:structured-trigger', 'US:market-condition', 'US:structured-trigger',
    ]);
    assert.equal(new Set(matching.map(entry => entry.id)).size, 4, 'Same-symbol alerts have different IDs when the market differs.');

    assert.equal((await inboxRoute.POST(post('inbox', alertBody))).status, 401, 'Nullable dates do not bypass the real Inbox owner boundary.');
    const inbox = await inboxRoute.POST(post('inbox', alertBody, true));
    assert.equal(inbox.status, 200, 'The authenticated Inbox route accepts the nullable authored date.');
    assert.equal((await inbox.json()).data.items.some(entry => entry.kind === 'stale'), false, 'No legacy or structured stale-review item is fabricated for the bookmark.');
    const dualInbox = await inboxRoute.POST(post('inbox', [{ ...dualBody[0], targetBuyZone: '20 - 30' }, dualBody[1]], true));
    assert.equal(dualInbox.status, 200);
    const inboxEntries = (await dualInbox.json()).data.items;
    assert.deepEqual(inboxEntries.map(entry => entry.title), ['Inside buy zone', 'Opportunity review', 'Earnings approaching']);
    assert.match(inboxEntries[0].detail, /Price 24\.00/);
    assert.equal(inboxEntries[2].eventDate, dualEarningsDate);
    for (const invalidDate of ['2026-02-30', undefined]) {
        const invalid = [{ ...alertBody[0], lastReviewedAt: invalidDate }];
        assert.equal((await alertsRoute.POST(post('alerts', invalid))).status, 400);
        assert.equal((await inboxRoute.POST(post('inbox', invalid, true))).status, 400);
    }
    const calendar = await calendarRoute.POST(post('calendar', buildResearchCalendarRequest([monitoredBookmark])));
    assert.equal(calendar.status, 200, 'The Calendar route accepts the nullable personal date.');
    const events = (await calendar.json()).data.events;
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'review');
    assert.equal(events[0].sourceDate, '2026-07-01', 'The explicit first-review schedule survives the request boundary unchanged.');
} finally {
    if (originalOwnerSecret === undefined) delete process.env.OWNER_ACCESS_SECRET;
    else process.env.OWNER_ACCESS_SECRET = originalOwnerSecret;
}

const { ResearchConnectedPanel } = load('src/components/v8/ResearchV8ConnectedPanels.tsx');
const panel = (tab, snapshot) => renderToStaticMarkup(React.createElement(ResearchConnectedPanel, {
    tab, market: snapshot.market, snapshot, loading: false, advanced: false,
    onBenchmarkRequest: noop, benchmarkError: false, benchmarkLoading: false, chartRange: '1Y', setChartRange: noop, chartDate: null, setChartDate: noop,
}));
assert.match(panel('Financials', payload.data), /Components reported 2026-03-31 and 2026-06-30; dates differ/);
assert.match(panel('Financials', legacy.data), /Reporting date unavailable/);
assert.match(panel('Valuation', payload.data), /not historical ratios at the financial year end/);
assert.match(panel('Valuation', my), /Share reporting date unavailable/);
console.log('Research provenance regression passed: balance periods, quote provenance, authored reviews, nullable route boundaries, and cross-market Alerts and Inbox evaluation.');
