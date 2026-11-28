import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import { isEarningsCalendarRead } from '../qa-earnings-calendar-fixture.mjs';

// Run the actual public route and service boundaries with isolated provider responses.
const modules = new Map();
function load(file) {
    const absolute = path.resolve(file);
    if (modules.has(absolute)) return modules.get(absolute).exports;
    const compiled = { exports: {} };
    modules.set(absolute, compiled);
    const code = ts.transpileModule(readFileSync(absolute, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const require = id => {
        if (id === 'next/server') return createRequire(absolute)(id);
        assert.ok(id.startsWith('.') || id.startsWith('@/'), `Unexpected dependency: ${id}`);
        const resolved = id.startsWith('@/') ? path.resolve('src', id.slice(2)) : path.resolve(path.dirname(absolute), id);
        return load(`${resolved}.ts`);
    };
    new Function('require', 'module', 'exports', code)(require, compiled, compiled.exports);
    return compiled.exports;
}

const { buildResearchCalendar, getResearchCalendar } = load('src/lib/research/calendar.ts');
const { parseResearchCalendarInputs, parseResearchCalendarQuery } = load('src/lib/research/calendar-input.ts');
const { parseResearchCalendarResponse } = load('src/lib/research/calendar-response.ts');
const { buildResearchCalendarRequest } = load('src/lib/research/calendar-request.ts');
const { createResearchRecord } = load('src/lib/research/records.ts');
const { fetchUpcomingCatalysts } = load('src/lib/research/catalysts.ts');
const { POST } = load('src/app/api/research/calendar/route.ts');
const { parseEarningsCalendarTarget, earningsCalendarInput, nextEarningsEvent, earningsTimingLabel } = load('src/lib/research/earnings-ticket.ts');
const now = new Date('2026-10-28T12:00:00.000Z');
const identity = (symbol = 'AAPL', market = 'US') => ({
    symbol, market, nextReviewAt: null, lastReviewedAt: null, reviewAgeDays: null, earningsWithinDays: 30,
});
const catalyst = (date = '2026-10-29', timing = 'pre-market') => ({
    date, type: 'earnings', timing, fiscalQuarterEnding: 'Sep/2026', epsForecast: '1.50', source: 'Nasdaq earnings calendar',
});
const query = parseResearchCalendarQuery(new URLSearchParams('range=30&market=US&ticker=AAPL&type=earnings'));
const inputs = parseResearchCalendarInputs([identity()]);
const fixtureRequest = (body = inputs, suffix = '') => ({ url: () => `http://127.0.0.1:3113/api/research/calendar?range=30&type=earnings&market=US&ticker=AAPL${suffix}`, method: () => 'POST', postDataJSON: () => body });
assert.equal(isEarningsCalendarRead(fixtureRequest()), true);
assert.throws(() => isEarningsCalendarRead(fixtureRequest([{ ...identity(), notes: 'private' }])));
assert.throws(() => isEarningsCalendarRead(fixtureRequest([{ ...identity(), lastReviewedAt: '2026-10-20' }])));
assert.throws(() => isEarningsCalendarRead(fixtureRequest(inputs, '&extra=value')));
assert.equal(isEarningsCalendarRead({ ...fixtureRequest(), method: () => 'PATCH' }), false);
assert.deepEqual(earningsCalendarInput('AAPL', 'US'), inputs);
assert.equal(parseEarningsCalendarTarget('AAPL', 'US', '2026-02-30'), undefined);
assert.equal(parseEarningsCalendarTarget('AAPL<script>', 'US', '2026-10-29'), undefined);
assert.equal(parseEarningsCalendarTarget('AAPL', 'UK', '2026-10-29'), undefined);
assert.deepEqual(parseEarningsCalendarTarget('5347', 'MY', '2026-10-29'), { symbol: '5347', market: 'MY', date: '2026-10-29' });
assert.equal(earningsTimingLabel(undefined), 'time not supplied');
let macroCalls = 0;
let requestedSymbols;
const fetcher = async (symbols, range, date) => {
    requestedSymbols = symbols;
    assert.equal(range, 30);
    assert.equal(date, now);
    return new Map([['AAPL', catalyst()], ['MSFT', catalyst()]]);
};
const macroFetcher = async () => { macroCalls += 1; return { events: [], warnings: ['Macro fixture'] }; };
const result = await getResearchCalendar([...inputs, identity('MSFT')], query, now, fetcher, macroFetcher);
assert.deepEqual(requestedSymbols, ['AAPL'], 'An earnings ticket only requests its selected US symbol.');
assert.equal(macroCalls, 0, 'An earnings-only read skips all macro work.');
assert.deepEqual(result.events.map(event => event.symbol), ['AAPL']);
assert.equal(result.events[0].earningsTiming, 'pre-market');
assert.equal(nextEarningsEvent(result, 'AAPL', 'US', '2026-10-28').displayDate, '2026-10-29');
assert.equal(nextEarningsEvent(result, 'AAPL', 'US', '2026-10-30'), null, 'Past dates cannot become upcoming tickets.');
assert.throws(() => nextEarningsEvent(result, 'MSFT', 'US', '2026-10-28'), /selected security/);
assert.throws(() => nextEarningsEvent(result, 'AAPL', 'MY', '2026-10-28'), /selected security/);
assert.throws(() => nextEarningsEvent({ ...result, warnings: ['Unavailable'] }, 'AAPL', 'US', '2026-10-28'), /unavailable/);
assert.equal(nextEarningsEvent({ ...result, events: [{ ...result.events[0], sourceDate: '2026-12-01', displayDate: '2026-12-01' }] }, 'AAPL', 'US', '2026-10-28'), null, 'Out-of-window dates are withheld.');
assert.deepEqual(result.macroEvents, []);
assert.deepEqual(result.warnings, []);
assert.equal(inputs[0].lastReviewedAt, null, 'Reading an unsaved identity does not manufacture a review.');

await getResearchCalendar(inputs, { ...query, type: 'ALL' }, now, fetcher, macroFetcher);
assert.equal(macroCalls, 1, 'The existing ALL workflow retains macro work.');
let usCalls = 0;
const myResult = await getResearchCalendar([identity('AAPL', 'MY')], { ...query, market: 'MY' }, now,
    async () => { usCalls += 1; return new Map([['AAPL', catalyst()]]); }, macroFetcher);
assert.equal(usCalls, 0, 'Malaysia does not request US Nasdaq coverage.');
assert.deepEqual(myResult.events, []);
const joined = buildResearchCalendar({
    inputs: [identity(), identity('AAPL', 'MY'), identity('MYONLY', 'MY')],
    catalysts: [{ symbol: 'AAPL', ...catalyst() }, { symbol: 'MYONLY', ...catalyst() }],
    macroEvents: [], now, rangeDays: 30,
});
assert.deepEqual(joined.events.map(event => [event.symbol, event.market]), [['AAPL', 'US']], 'A same-symbol MY row cannot acquire US earnings.');

const response = data => ({ success: true, data });
for (const timing of ['pre-market', 'after-hours', 'time-not-supplied']) {
    const timed = structuredClone(result);
    timed.events[0].earningsTiming = timing;
    assert.equal(parseResearchCalendarResponse(response(timed)).events[0].earningsTiming, timing);
}
const legacy = structuredClone(result);
delete legacy.events[0].earningsTiming;
assert.equal(parseResearchCalendarResponse(response(legacy)).events[0].earningsTiming, undefined, 'Legacy timing stays unknown.');
for (const timing of [null, '', 'confirmed', 'before-open', 1]) {
    const invalid = structuredClone(result);
    invalid.events[0].earningsTiming = timing;
    assert.throws(() => parseResearchCalendarResponse(response(invalid)), /Invalid earnings timing/);
}
const invalidReview = structuredClone(result);
invalidReview.events[0].type = 'review';
assert.throws(() => parseResearchCalendarResponse(response(invalidReview)), /Invalid earnings timing/);

const originalFetch = globalThis.fetch;
const originalTimeout = AbortSignal.timeout;
const calls = [];
const providerFetch = handler => {
    calls.length = 0;
    globalThis.fetch = async (url, options) => {
        const parsed = new URL(url);
        assert.equal(parsed.origin, 'https://api.nasdaq.com', 'The public earnings route cannot request another provider.');
        assert.equal(parsed.pathname, '/api/calendar/earnings');
        assert.ok(options.signal instanceof AbortSignal);
        calls.push({ date: parsed.searchParams.get('date'), signal: options.signal });
        return handler(parsed.searchParams.get('date'), options);
    };
};
const json = data => ({ ok: true, json: async () => data });
const row = (symbol, time = 'time-after-hours') => ({ symbol, time, fiscalQuarterEnding: null, epsForecast: null });
try {
    providerFetch(() => { throw new Error('No request expected'); });
    assert.equal((await fetchUpcomingCatalysts([], 90, now)).size, 0);
    assert.equal(calls.length, 0, 'An empty symbol set does no upstream work.');

    providerFetch(async date => {
        // Later calendar dates finish first; the earliest date must still win.
        await new Promise(resolve => setTimeout(resolve, 7 - Number(date.slice(-2)) % 7));
        return json({ data: { rows: [row('AAPL'), row('IGNORED')] } });
    });
    const earliest = await fetchUpcomingCatalysts(['AAPL'], 90, now);
    assert.equal(earliest.get('AAPL').date, '2026-10-28');
    assert.equal(earliest.get('AAPL').timing, 'after-hours');
    assert.equal(earliest.has('IGNORED'), false);
    assert.equal(calls.length, 7, 'A complete first batch stops the 91-day scan.');
    assert.equal(new Set(calls.map(call => call.signal)).size, 1, 'The entire scan shares one deadline.');

    providerFetch(date => json({ data: { rows: date < '2026-11-04' ? [row('AAPL')] : [row('AAPL'), row('MSFT', 'unknown-provider-time')] } }));
    const secondBatch = await fetchUpcomingCatalysts(['AAPL', 'MSFT'], 90, now);
    assert.equal(calls.length, 14, 'The scan stops after the complete chronological batch that finds every symbol.');
    assert.equal(secondBatch.get('AAPL').date, '2026-10-28');
    assert.equal(secondBatch.get('MSFT').date, '2026-11-04');
    assert.equal(secondBatch.get('MSFT').timing, 'time-not-supplied');

    providerFetch(() => json({ data: { rows: null } }));
    assert.equal((await fetchUpcomingCatalysts(['MISSING'], 30, now)).size, 0);
    assert.equal(calls.length, 31, 'A legitimate empty calendar checks the whole requested range.');

    for (const malformed of [null, {}, { data: null }, { data: {} }, { data: { rows: {} } }, { data: { rows: [null] } }, { data: { rows: [row('')] } }, { data: { rows: [{ ...row('AAPL'), epsForecast: 123 }] } }]) {
        providerFetch(() => json(malformed));
        await assert.rejects(fetchUpcomingCatalysts(['AAPL'], 30, now), /invalid/);
    }
    for (const handler of [
        () => ({ ok: false, status: 503 }),
        () => { throw new Error('Network fixture failure'); },
        () => ({ ok: true, json: async () => { throw new Error('Invalid JSON fixture'); } }),
        () => json({ data: {} }),
    ]) {
        providerFetch(handler);
        const degraded = await getResearchCalendar(inputs, query, now);
        assert.deepEqual(degraded.events, []);
        assert.deepEqual(degraded.warnings, ['Upcoming earnings coverage is temporarily unavailable.'], 'Provider failure cannot become a successful no-event result.');
    }

    let timeoutMs;
    AbortSignal.timeout = milliseconds => { timeoutMs = milliseconds; return originalTimeout(10); };
    providerFetch((_date, options) => new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
        // Keep the process alive while exercising AbortSignal's unreferenced timer.
        const keepAlive = setTimeout(() => resolve(json({ data: { rows: [] } })), 100);
        options.signal.addEventListener('abort', () => clearTimeout(keepAlive), { once: true });
    }));
    await assert.rejects(fetchUpcomingCatalysts(['AAPL'], 90, now), /timeout/i);
    assert.equal(timeoutMs, 8_000, 'The upstream scan has a bounded eight-second wait.');
    AbortSignal.timeout = originalTimeout;

    providerFetch(() => json({ data: { rows: [row('AAPL')] } }));
    const routeResponse = await POST(new Request('http://localhost/api/research/calendar?range=30&market=US&ticker=AAPL&type=earnings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([identity()]),
    }));
    assert.equal(routeResponse.status, 200, 'One unsaved identity can use the existing public POST route.');
    const routeResult = parseResearchCalendarResponse(await routeResponse.json());
    assert.equal(routeResult.events.length, 1);
    assert.equal(routeResult.events[0].symbol, 'AAPL');
    assert.equal(routeResult.events[0].earningsTiming, 'after-hours');
    assert.deepEqual(routeResult.macroEvents, []);
    assert.equal(calls.length, 7, 'The public ticket route only reads the bounded Nasdaq batch.');
    assert.deepEqual(routeResult.warnings, []);

    const today = new Date();
    const dateOffset = offset => {
        const date = new Date(today);
        date.setUTCDate(date.getUTCDate() + offset);
        return date.toISOString().slice(0, 10);
    };
    const reviewDate = dateOffset(3);
    const savedListing = (market, reviewAgeDays, earningsWithinDays) => {
        const record = createResearchRecord({ market, symbol: 'AAPL', companyName: `Fixture AAPL ${market}` });
        return {
            ...record,
            decisionJournal: { ...record.decisionJournal, nextReviewAt: reviewDate },
            lastReviewedAt: dateOffset(-reviewAgeDays - 2),
            monitoringRules: { ...record.monitoringRules, reviewAgeDays, earningsWithinDays },
        };
    };
    const savedInputs = buildResearchCalendarRequest([savedListing('US', 10, 5), savedListing('MY', 15, 12)]);
    const postCalendar = (body, queryString = 'range=30') => POST(new Request(`http://localhost/api/research/calendar?${queryString}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }));
    const providerHosts = [];
    globalThis.fetch = async url => {
        const provider = new URL(url).hostname;
        providerHosts.push(provider);
        if (provider === 'api.nasdaq.com') return json({ data: { rows: [row('AAPL')] } });
        if (provider === 'www.federalreserve.gov') return new Response('');
        if (provider === 'www.bls.gov') return new Response(`BEGIN:VEVENT\nSUMMARY:Consumer Price Index\nDTSTART:${reviewDate.replaceAll('-', '')}\nEND:VEVENT`);
        if (provider === 'api.data.gov.my') return Response.json([{ publication_type: 'cpi', title_en: 'Malaysia CPI fixture', release_date: reviewDate }]);
        throw new Error(`Unexpected calendar provider: ${provider}`);
    };
    const savedResponse = await postCalendar(savedInputs);
    assert.equal(savedResponse.status, 200, 'The real Calendar route accepts the same saved ticker in both markets.');
    const savedCalendar = parseResearchCalendarResponse(await savedResponse.json());
    assert.deepEqual(savedCalendar.events.map(({ type, market, sourceDate }) => [type, market, sourceDate]), [
        ['stale', 'MY', dateOffset(-2)], ['stale', 'US', dateOffset(-2)], ['earnings', 'US', dateOffset(0)],
        ['review', 'MY', reviewDate], ['review', 'US', reviewDate],
    ]);
    assert.equal(new Set(savedCalendar.events.map(event => event.id)).size, 5, 'Same-date reviews and stale reminders have distinct event IDs.');
    for (const event of savedCalendar.events) {
        const target = new URL(event.targetHref, 'http://localhost');
        assert.equal(target.searchParams.get('market'), event.market);
        assert.equal(target.searchParams.get('ticker'), event.symbol);
    }
    assert.deepEqual(savedCalendar.macroEvents.filter(event => event.date === reviewDate && event.category === 'inflation')
        .map(event => [event.market, event.trackedSymbols]), [['MY', ['AAPL']], ['US', ['AAPL']]]);
    assert.equal(providerHosts.filter(host => host === 'api.nasdaq.com').length, 7);

    providerHosts.length = 0;
    const marketResponse = await postCalendar(savedInputs, 'range=30&market=MY&ticker=aapl');
    assert.equal(marketResponse.status, 200);
    const marketCalendar = parseResearchCalendarResponse(await marketResponse.json());
    assert.deepEqual(marketCalendar.events.map(({ type, market }) => [type, market]), [['stale', 'MY'], ['review', 'MY']]);
    assert.equal(providerHosts.includes('api.nasdaq.com'), false, 'A MY-only Calendar filter skips the Nasdaq scan even with a matching US listing in the body.');

    providerHosts.length = 0;
    const duplicateResponse = await postCalendar([...savedInputs, { ...savedInputs[0], symbol: ' aapl ' }]);
    assert.equal(duplicateResponse.status, 400, 'Case and whitespace variants of the same listing are rejected.');
    assert.match((await duplicateResponse.json()).error, /listings must be unique/);
    assert.deepEqual(providerHosts, [], 'Duplicate identities are rejected before any provider reads.');
} finally {
    globalThis.fetch = originalFetch;
    AbortSignal.timeout = originalTimeout;
}

console.log('Calendar contracts passed: distinct saved US/MY events, duplicate rejection, public unsaved reads, scoped US earnings, timing, failures and bounded provider work.');
