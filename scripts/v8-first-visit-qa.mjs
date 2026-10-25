import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { marketRequestFixture } from './harness/market-request-fixture.mjs';
import { researchReadFixture, researchSnapshotFixture } from './harness/research-read-fixture.mjs';

// Fixture-only acceptance suite for G5/E21. It owns one Chromium process and never
// starts a server: point SIGNAL_QA_URL at the already-built local production server.
const base = (process.env.SIGNAL_QA_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const output = path.resolve(process.env.SIGNAL_FIRST_VISIT_OUTPUT ?? '.tmp/v8-first-visit');
const progressKey = 'signal-v8-first-visit-v1';
const selected = process.argv.find(value => value.startsWith('--scenario='))?.slice('--scenario='.length);
const viewports = [
    { name: 'desktop', width: 1280, height: 900 }, { name: 'tablet', width: 768, height: 900 },
    { name: 'mobile', width: 375, height: 812 }, { name: 'narrow', width: 320, height: 812 },
];

assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'First-visit fixture QA requires an owned local server.');
await mkdir(output, { recursive: true });
const report = { command: 'node scripts/v8-first-visit-qa.mjs', base, fixtureOnly: true, scenarios: [], fatalError: null };
const ownerRecord = { ...(await (await researchReadFixture().route.GET()).json()).data[0], symbol: 'AAPL', market: 'US', companyName: 'Fixture Apple' };

function item(name) { const value = { name, status: 'failed', checks: [], issues: [], screenshots: [] }; report.scenarios.push(value); return value; }
function check(test, name, condition, detail = '') { test.checks.push({ name, status: condition ? 'passed' : 'failed', detail }); assert.ok(condition, `${name}${detail ? `: ${detail}` : ''}`); }
const progress = (stage, revision = 0) => ({ version: 1, stage, revision });
const savedProgress = (stage, revision = 0) => JSON.stringify(progress(stage, revision));
const visibleTour = page => page.getByRole('region', { name: 'First visit to V8', exact: true });
const stageHeading = (page, name) => visibleTour(page).getByRole('heading', { name, exact: true });
const noOverflow = page => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1);
const stored = page => page.evaluate(key => localStorage.getItem(key), progressKey);
const parsed = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), progressKey);

function snapshot(symbol = 'AAPL', market = 'US', { quote = 200, returnedSymbol = symbol } = {}) {
    const value = structuredClone(researchSnapshotFixture);
    value.data.symbol = returnedSymbol; value.data.market = market;
    value.data.quote = { ...value.data.quote, name: `Fixture ${symbol}`, price: quote, currency: market === 'MY' ? 'MYR' : 'USD', observedAt: '2026-10-24T20:00:00.000Z' };
    return value;
}

async function installFixtures(context, observations, state) {
    await context.route('**/api/**', async route => {
        const request = route.request(); const url = new URL(request.url());
        observations.requests.push({ method: request.method(), path: `${url.pathname}${url.search}` });
        if (request.method() !== 'GET') observations.mutations.push({ method: request.method(), path: url.pathname });
        if (url.pathname === '/api/signals/v2') {
            if (state.marketUnavailable) return route.fulfill({ status: 503, json: { success: false, error: 'Fixture score unavailable' } });
            if (state.marketInvalid) return route.fulfill({ json: { success: false, error: 'Fixture score malformed' } });
            const fixture = marketRequestFixture(); const response = await fixture.route.GET(fixture.request(url.search.slice(1)));
            return route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
        }
        if (url.pathname === '/api/signals/replay') return route.fulfill({ json: { success: true, data: { market: url.searchParams.get('market') ?? 'US', mode: url.searchParams.get('mode') ?? 'standard', enableSocial: url.searchParams.get('enableSocial') !== 'false', summaries: [] } } });
        if (url.pathname === '/api/research/discovery') return route.fulfill({ json: { success: true, data: { generatedAt: '2026-10-25T00:00:00.000Z', universeSize: 0, scannedCount: 0, candidates: [], contenders: [], emergingCandidates: [], performance: [], historySnapshotCount: 0, warnings: [] } } });
        if (url.pathname === '/api/owner/session') return route.fulfill({ json: { success: true, data: { configured: true, unlocked: state.owner } } });
        if (url.pathname === '/api/research/watchlist') {
            if (!state.owner) return route.fulfill({ status: 401, json: { success: false, error: 'Guest fixture' } });
            if (request.method() === 'POST') {
                if (state.saveHold) await new Promise(resolve => { state.releaseSave = resolve; });
                if (state.saveFails) return route.fulfill({ status: 500, json: { success: false, error: 'Fixture save failed' } });
                const body = request.postDataJSON(); observations.savePayloads.push(body); state.ownerRecords = [{ ...ownerRecord, symbol: body.symbol, market: body.market, companyName: body.companyName }];
                return route.fulfill({ status: 201, json: { success: true, data: state.ownerRecords[0] } });
            }
            return route.fulfill({ json: { success: true, data: state.ownerRecords, archivedSymbols: [] } });
        }
        if (url.pathname.startsWith('/api/research/symbol/')) {
            const symbol = decodeURIComponent(url.pathname.split('/').at(-1));
            return route.fulfill({ json: snapshot(symbol, url.searchParams.get('market') ?? 'US', { quote: state.noQuote ? null : 200, returnedSymbol: state.mismatch ? 'MSFT' : symbol }) });
        }
        observations.unexpectedApis.push({ method: request.method(), path: url.pathname });
        return route.fulfill({ status: 503, json: { success: false, error: 'Unexpected fixture request' } });
    });
}

async function setup(browser, test, options = {}) {
    const state = { owner: false, ownerRecords: [], saveFails: false, saveHold: false, releaseSave: null, marketUnavailable: false, marketInvalid: false, noQuote: false, mismatch: false, ...options.state };
    const context = await browser.newContext({ viewport: options.viewport ?? viewports[0], serviceWorkers: 'block' });
    if (options.seed !== undefined || options.init) await context.addInitScript(({ seed, init }) => {
        // addInitScript runs before every navigation and every tab. Seed exactly once per
        // fixture context so reloads and cross-tab updates test real persisted state.
        if (seed !== undefined && !localStorage.getItem('__signal_first_visit_seeded')) {
            localStorage.setItem('signal-v8-first-visit-v1', seed);
            localStorage.setItem('__signal_first_visit_seeded', '1');
        }
        if (init?.guest) localStorage.setItem('signal.guest-research.v1', init.guest);
        if (init?.theme) localStorage.setItem('signal-v8-theme-v1', init.theme);
        if (init?.blockRead) { const get = Storage.prototype.getItem; Storage.prototype.getItem = function(key) { if (key === 'signal-v8-first-visit-v1') throw new DOMException('blocked', 'SecurityError'); return get.call(this, key); }; }
        if (init?.blockWrite) { const set = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'signal-v8-first-visit-v1' && !window.__signalAllowTourWrite) throw new DOMException('blocked', 'QuotaExceededError'); return set.call(this, key, value); }; }
        if (init?.noLocks) Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    }, { seed: options.seed, init: options.init });
    const observations = { requests: [], mutations: [], savePayloads: [], unexpectedApis: [] };
    context.on('request', request => {
        const url = new URL(request.url());
        if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
            observations.externalRequests ??= [];
            observations.externalRequests.push({ method: request.method(), url: request.url() });
        }
    });
    test.fixtureObservations ??= []; test.fixtureObservations.push(observations);
    await installFixtures(context, observations, state);
    const page = await context.newPage();
    test.page = page;
    page.on('pageerror', error => test.issues.push({ type: 'page-error', message: error.message }));
    page.on('console', message => { if (message.type() === 'error' && !/status of (401|503)/.test(message.text()) && !(test.allowConsole500 && /status of 500/.test(message.text()))) test.issues.push({ type: 'console-error', message: message.text() }); });
    page.on('requestfailed', request => { if (!/ERR_ABORTED/.test(request.failure()?.errorText ?? '')) test.issues.push({ type: 'request-failed', message: request.url() }); });
    return { context, page, state, observations };
}

async function waitReact(page, locator) {
    await locator.waitFor();
    const handle = await locator.elementHandle();
    try { await page.waitForFunction(element => !!element && Object.keys(element).some(key => key.startsWith('__reactProps') || key.startsWith('__reactFiber')), handle); }
    finally { await handle?.dispose(); }
}
async function marketReady(page, suffix = '') { await page.goto(`${base}/main-v8${suffix}`, { waitUntil: 'domcontentloaded' }); await page.getByTestId('connected-score').waitFor(); }
async function researchReady(page, suffix = '?ticker=AAPL&market=US') { await page.goto(`${base}/research-v8${suffix}`, { waitUntil: 'domcontentloaded' }); await page.getByTestId('research-price').waitFor(); }
async function waitStoredStage(page, stage) { await page.waitForFunction(({ key, stage: expected }) => { try { const raw = localStorage.getItem(key); return raw !== null && JSON.parse(raw)?.stage === expected; } catch { return false; } }, { key: progressKey, stage }); return parsed(page); }
async function advanceMarket(page) { const button = visibleTour(page).getByRole('button', { name: 'I understand', exact: true }); await waitReact(page, button); await button.click(); return waitStoredStage(page, 'stock'); }
async function openSettings(page) { await page.getByRole('button', { name: 'Settings', exact: true }).click(); const dialog = page.getByRole('dialog', { name: 'Settings', exact: true }); await dialog.waitFor(); return dialog; }
async function researchShell(page) { await page.goto(`${base}/research-v8`, { waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: 'Settings', exact: true }).waitFor(); }

async function run(name, body) {
    if (selected && name !== selected) return;
    const test = item(name);
    console.log(`[v8-first-visit] start ${name}`);
    try {
        await body(test);
        const observations = test.fixtureObservations ?? [];
        check(test, 'no unexpected fixture API calls occurred', observations.every(value => value.unexpectedApis.length === 0), JSON.stringify(observations.flatMap(value => value.unexpectedApis)));
        check(test, 'tour does not create external network requests', observations.every(value => (value.externalRequests ?? []).length === 0), JSON.stringify(observations.flatMap(value => value.externalRequests ?? [])));
        check(test, 'tour adds no unapproved API mutations', JSON.stringify(observations.flatMap(value => value.mutations)) === JSON.stringify(test.expectedMutations ?? []), JSON.stringify(observations.flatMap(value => value.mutations)));
        check(test, 'browser has no unhandled console, page or request errors', test.issues.length === 0, JSON.stringify(test.issues));
        test.status = 'passed'; console.log(`[v8-first-visit] passed ${name}`);
    } catch (error) {
        await test.page?.screenshot({ path: path.join(output, `${name}-failure.png`), fullPage: true, timeout: 5000 }).catch(() => {});
        test.issues.push({ type: 'blocking', message: error instanceof Error ? error.message : String(error) });
        console.log(`[v8-first-visit] failed ${name}: ${test.issues.at(-1).message}`);
    }
}

const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--no-sandbox'] });
try {
    await run('first-entry', async test => {
        const { context, page } = await setup(browser, test);
        try { await marketReady(page); await stageHeading(page, 'Understand the Market score').waitFor(); check(test, 'missing progress starts in memory at market', await stored(page) === null); check(test, 'first-entry tour exposes Skip tour', await visibleTour(page).getByRole('button', { name: 'Skip tour', exact: true }).count() === 1); } finally { await context.close(); }
    });
    await run('market-readiness-gates-acknowledgement', async test => {
        const unavailable = await setup(browser, test, { state: { marketInvalid: true } });
        const retained = await setup(browser, test);
        try {
            console.log('[v8-first-visit] market gate: unavailable load');
            await unavailable.page.goto(`${base}/main-v8`, { waitUntil: 'domcontentloaded' });
            const unavailableButton = visibleTour(unavailable.page).getByRole('button', { name: 'I understand', exact: true });
            await unavailableButton.waitFor(); check(test, 'Market acknowledgement is disabled while the current score fails', await unavailableButton.isDisabled());
            console.log('[v8-first-visit] market gate: retained load');
            await marketReady(retained.page); const retainedButton = visibleTour(retained.page).getByRole('button', { name: 'I understand', exact: true });
            check(test, 'Market acknowledgement enables after a successful current score', !(await retainedButton.isDisabled()));
            console.log('[v8-first-visit] market gate: reload failure');
            retained.state.marketInvalid = true; await retained.page.getByRole('button', { name: /Reload.*data/i }).click();
            await retained.page.getByText('The signal service did not return a usable response.', { exact: true }).waitFor();
            check(test, 'retained prior score does not enable acknowledgement after a failed reload', await retainedButton.isDisabled());
        } finally { await unavailable.context.close(); await retained.context.close(); }
    });
    await run('tour-request-boundary', async test => {
        const active = await setup(browser, test); const dismissed = await setup(browser, test, { seed: savedProgress('skipped', 9) });
        try {
            await marketReady(active.page); await stageHeading(active.page, 'Understand the Market score').waitFor();
            await marketReady(dismissed.page); await dismissed.page.getByTestId('connected-score').waitFor();
            await active.page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await dismissed.page.evaluate(() => scrollTo(0, document.body.scrollHeight));
            await Promise.all([active.page.waitForLoadState('networkidle', { timeout: 1500 }).catch(() => {}), dismissed.page.waitForLoadState('networkidle', { timeout: 1500 }).catch(() => {})]);
            const paths = observations => observations.requests.filter(value => value.method === 'GET').map(value => value.path).sort();
            const activePaths = paths(active.observations), dismissedPaths = paths(dismissed.observations);
            check(test, 'active first-visit callout adds no API request beyond the matched skipped Market baseline', activePaths.every(value => dismissedPaths.includes(value)), JSON.stringify({ active: activePaths, dismissed: dismissedPaths }));
        } finally { await active.context.close(); await dismissed.context.close(); }
    });
    await run('skip-and-reload', async test => {
        const { context, page } = await setup(browser, test);
        try { await marketReady(page); await visibleTour(page).getByRole('button', { name: 'Skip tour', exact: true }).click(); const skipped = await waitStoredStage(page, 'skipped'); await visibleTour(page).waitFor({ state: 'hidden' }); check(test, 'first missing-state write uses a fresh safe revision', Number.isSafeInteger(skipped.revision) && skipped.revision >= 2 ** 40); await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByTestId('connected-score').waitFor(); check(test, 'skipped tour stays dismissed on reload without seed overwrite', await visibleTour(page).count() === 0 && (await parsed(page)).revision === skipped.revision); } finally { await context.close(); }
    });
    await run('market-to-stock-resume', async test => {
        const { context, page } = await setup(browser, test);
        try { await marketReady(page); const stock = await advanceMarket(page); check(test, 'market acknowledgement writes stock with a fresh safe revision', Number.isSafeInteger(stock.revision) && stock.revision >= 2 ** 40); await researchShell(page); await stageHeading(page, 'Open a stock').waitFor(); await page.screenshot({ path: path.join(output, 'research-stage2.png'), fullPage: true }); check(test, 'no-selection Research resumes stock stage without a quote auto-advance', (await parsed(page)).revision === stock.revision); } finally { await context.close(); }
    });
    await run('handoff-links-match-stage-and-page', async test => {
        for (const testCase of [
            { stage: 'stock', page: 'market', link: 'Open Research' }, { stage: 'save', page: 'market', link: 'Open Research' },
            { stage: 'market', page: 'research', link: 'Open Market (new tab)' },
        ]) {
            const { context, page } = await setup(browser, test, { seed: savedProgress(testCase.stage, 1) });
            try {
                if (testCase.page === 'market') await marketReady(page); else await researchReady(page);
                const link = visibleTour(page).getByRole('link', { name: testCase.link, exact: true });
                await link.waitFor();
                check(test, `${testCase.stage} on ${testCase.page} exposes its explicit handoff`, await link.count() === 1);
                if (testCase.stage === 'market') check(test, 'Market handoff opens a separate tab', await link.getAttribute('target') === '_blank');
            } finally { await context.close(); }
        }
    });
    await run('full-three-step-guest-save', async test => {
        const { context, page } = await setup(browser, test);
        try { await marketReady(page); const stock = await advanceMarket(page); await researchReady(page); const save = await waitStoredStage(page, 'save'); check(test, 'positive current quote advances stock exactly once', save.revision === stock.revision + 1); await stageHeading(page, 'Save a stock').waitFor(); await page.screenshot({ path: path.join(output, 'research-stage3.png'), fullPage: true }); const button = page.getByRole('button', { name: 'Save stock', exact: true }); await waitReact(page, button); await button.click(); const complete = await waitStoredStage(page, 'complete'); await page.getByRole('heading', { name: 'Your note', exact: true }).waitFor(); check(test, 'guest save completes only after existing Save stock persists', complete.revision === save.revision + 1); } finally { await context.close(); }
    });
    await run('full-three-step-owner-save', async test => {
        const { context, page, observations } = await setup(browser, test, { state: { owner: true } });
        try { await marketReady(page); await advanceMarket(page); await researchReady(page); const save = await waitStoredStage(page, 'save'); test.expectedMutations = [{ method: 'POST', path: '/api/research/watchlist' }]; await page.getByRole('button', { name: 'Save stock', exact: true }).click(); const complete = await waitStoredStage(page, 'complete'); await visibleTour(page).waitFor({ state: 'hidden' }); check(test, 'owner save completes tour after matched owner record', complete.revision === save.revision + 1); check(test, 'owner Save stock sends only the established synthetic save payload', JSON.stringify(observations.savePayloads) === JSON.stringify([{ symbol: 'AAPL', market: 'US', companyName: 'Fixture AAPL', saveOnly: true }]), JSON.stringify(observations.savePayloads)); } finally { await context.close(); }
    });
    await run('failed-save-retains-stage', async test => {
        const { context, page, state } = await setup(browser, test, { seed: savedProgress('save', 2), state: { owner: true, saveFails: true } });
        try { await researchReady(page); const before = await parsed(page); test.allowConsole500 = true; test.expectedMutations = [{ method: 'POST', path: '/api/research/watchlist' }, { method: 'POST', path: '/api/research/watchlist' }]; await page.getByRole('button', { name: 'Save stock', exact: true }).click(); await page.getByText('The stock could not be saved. Your reading remains available.', { exact: true }).waitFor(); check(test, 'failed existing save leaves save stage intact', await parsed(page).then(value => value.stage === 'save' && value.revision === before.revision)); state.saveFails = false; await page.getByRole('button', { name: 'Save stock', exact: true }).click(); const complete = await waitStoredStage(page, 'complete'); await visibleTour(page).waitFor({ state: 'hidden' }); check(test, 'owner retry completes after the underlying save succeeds', complete.revision === before.revision + 1); } finally { await context.close(); }
    });
    await run('stock-save-survives-tour-write-failure', async test => {
        for (const owner of [false, true]) {
            const { context, page } = await setup(browser, test, { seed: savedProgress('save', 12), init: { blockWrite: true }, state: { owner } });
            try {
                await researchReady(page); if (owner) test.expectedMutations = [...(test.expectedMutations ?? []), { method: 'POST', path: '/api/research/watchlist' }];
                await page.getByRole('button', { name: 'Save stock', exact: true }).click();
                if (owner) await page.getByLabel('Saved user-authored decision', { exact: true }).waitFor(); else await page.getByRole('heading', { name: 'Your note', exact: true }).waitFor();
                await visibleTour(page).getByText('Tour progress was not saved', { exact: false }).waitFor();
                check(test, `${owner ? 'owner' : 'guest'} stock save succeeds despite the separate tour write failure`, (await parsed(page)).stage === 'save');
                await page.evaluate(() => { window.__signalAllowTourWrite = true; });
                const finish = visibleTour(page).getByRole('button', { name: 'Finish with this saved stock', exact: true }); await waitReact(page, finish); await finish.click(); await waitStoredStage(page, 'complete');
                check(test, `${owner ? 'owner' : 'guest'} explicit acknowledgement finishes after storage recovers`, (await parsed(page)).stage === 'complete');
            } finally { await context.close(); }
        }
    });
    await run('external-restart-clears-prior-tour-write-error', async test => {
        const { context, page } = await setup(browser, test, { seed: savedProgress('save', 18), init: { blockWrite: true } });
        try {
            await researchReady(page); await page.getByRole('button', { name: 'Save stock', exact: true }).click();
            await visibleTour(page).getByText('Tour progress was not saved', { exact: false }).waitFor();
            const second = await context.newPage(); await second.goto(`${base}/main-v8`, { waitUntil: 'domcontentloaded' });
            await second.evaluate(({ key }) => { window.__signalAllowTourWrite = true; localStorage.setItem(key, JSON.stringify({ version: 1, stage: 'market', revision: 19 })); }, { key: progressKey });
            await page.waitForFunction(() => !document.body.textContent.includes('Tour progress was not saved'));
            check(test, 'native external restart clears the old transient tour write error', await visibleTour(page).getByRole('alert').count() === 0);
            await second.close();
        } finally { await context.close(); }
    });
    await run('already-saved-requires-explicit-finish', async test => {
        const { context, page } = await setup(browser, test, { seed: savedProgress('save', 2), state: { owner: true, ownerRecords: [ownerRecord] } });
        try { await researchReady(page); const finish = visibleTour(page).getByRole('button', { name: 'Finish with this saved stock', exact: true }); await waitReact(page, finish); const before = await parsed(page); check(test, 'existing saved record does not passively dismiss tour', before.stage === 'save'); await finish.click(); const complete = await waitStoredStage(page, 'complete'); check(test, 'explicit finish completes saved state', complete.revision === before.revision + 1); } finally { await context.close(); }
    });
    await run('already-saved-finish-does-not-require-current-quote', async test => {
        const { context, page } = await setup(browser, test, { seed: savedProgress('save', 32), state: { owner: true, ownerRecords: [ownerRecord], noQuote: true } });
        try { await researchReady(page); const finish = visibleTour(page).getByRole('button', { name: 'Finish with this saved stock', exact: true }); await finish.waitFor(); check(test, 'already-saved explicit finish remains enabled when the current refresh has no quote', !(await finish.isDisabled())); await finish.click(); await waitStoredStage(page, 'complete'); } finally { await context.close(); }
    });
    await run('unavailable-and-mismatched-stock-does-not-advance', async test => {
        for (const state of [{ noQuote: true }, { mismatch: true }]) {
            const { context, page } = await setup(browser, test, { seed: savedProgress('stock', 1), state });
            try { await researchReady(page); await stageHeading(page, 'Open a stock').waitFor(); const before = await parsed(page); await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).stage === 'stock', progressKey); check(test, `stock stage remains when ${state.noQuote ? 'quote is missing' : 'response identity mismatches'}`, await parsed(page).then(value => value.stage === 'stock' && value.revision === before.revision)); } finally { await context.close(); }
        }
    });
    await run('corrupt-and-blocked-storage-report-errors', async test => {
        for (const options of [{ seed: '{broken' }, { init: { blockRead: true } }, { init: { blockWrite: true } }, { init: { noLocks: true } }]) {
            const { context, page } = await setup(browser, test, options);
            try {
                await marketReady(page);
                if (options.init?.blockWrite || options.init?.noLocks) {
                    await visibleTour(page).getByRole('button', { name: 'Skip tour', exact: true }).click();
                    await visibleTour(page).getByText('Tour progress was not saved', { exact: false }).waitFor();
                } else await visibleTour(page).getByText('Tour progress could not be read', { exact: false }).waitFor();
            } finally { await context.close(); }
        }
    });
    await run('settings-restart-preserves-dirty-guest-draft-and-url', async test => {
        const { context, page } = await setup(browser, test, { seed: savedProgress('complete', 4) });
        try { await researchReady(page, '?ticker=AAPL&market=US&tab=financials'); await page.getByRole('button', { name: 'Save stock', exact: true }).click(); await page.getByLabel('Personal note for AAPL', { exact: true }).fill('draft retained'); const before = page.url(); const settings = await openSettings(page); const section = settings.getByRole('region', { name: 'First visit', exact: true }); await section.getByRole('button', { name: 'Restart tour', exact: true }).click(); await section.getByRole('status').getByText(/restart/i).waitFor(); check(test, 'restart does not change research URL', page.url() === before, `${page.url()} !== ${before}`); check(test, 'restart retains dirty guest note', await page.getByLabel('Personal note for AAPL', { exact: true }).inputValue() === 'draft retained'); check(test, 'restart writes market with a valid safe revision', await parsed(page).then(value => value.stage === 'market' && Number.isSafeInteger(value.revision) && value.revision >= 0)); } finally { await context.close(); }
    });
    await run('settings-recovers-corrupt-progress', async test => {
        const { context, page } = await setup(browser, test, { seed: '{corrupt' });
        try {
            await marketReady(page); await visibleTour(page).getByText('Tour progress could not be read', { exact: false }).waitFor();
            const settings = await openSettings(page); const section = settings.getByRole('region', { name: 'First visit', exact: true });
            await section.getByRole('button', { name: 'Restart tour', exact: true }).click(); await section.getByRole('status').waitFor();
            check(test, 'explicit Settings restart replaces corrupt bytes with a fresh high safe revision', await parsed(page).then(value => value.stage === 'market' && Number.isSafeInteger(value.revision) && value.revision >= 2 ** 40));
        } finally { await context.close(); }
    });
    await run('restart-wins-delayed-owner-save', async test => {
        const { context, page, state } = await setup(browser, test, { seed: savedProgress('save', 41), state: { owner: true, saveHold: true } });
        try {
            await researchReady(page); const before = await parsed(page); test.expectedMutations = [{ method: 'POST', path: '/api/research/watchlist' }];
            await page.getByRole('button', { name: 'Save stock', exact: true }).click(); await page.getByRole('button', { name: 'Saving…', exact: true }).waitFor();
            const settings = await openSettings(page); const section = settings.getByRole('region', { name: 'First visit', exact: true });
            await section.getByRole('button', { name: 'Restart tour', exact: true }).click(); await section.getByRole('status').waitFor(); const restarted = await parsed(page);
            state.releaseSave(); await page.getByRole('button', { name: 'Saving…', exact: true }).waitFor({ state: 'hidden' });
            check(test, 'late Save callback cannot revive a tour restarted during the pending save', await parsed(page).then(value => value.stage === 'market' && value.revision === restarted.revision && value.revision === before.revision + 1));
        } finally { state.releaseSave?.(); await context.close(); }
    });
    await run('cross-tab-and-demo-exclusion', async test => {
        const { context, page } = await setup(browser, test);
        try { await marketReady(page); const second = await context.newPage(); await second.goto(`${base}/main-v8`, { waitUntil: 'domcontentloaded' }); await second.getByTestId('connected-score').waitFor(); await second.evaluate(([key, value]) => localStorage.setItem(key, value), [progressKey, savedProgress('skipped', 7)]); await page.waitForFunction(() => !document.querySelector('[aria-label="First visit to V8"]')); check(test, 'native cross-tab storage update dismisses active tour', await visibleTour(page).count() === 0); await page.goto(`${base}/main-v8?demo=1`, { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => document.readyState === 'complete'); check(test, 'Market demo never renders or writes first-visit tour', await visibleTour(page).count() === 0 && await stored(page) === savedProgress('skipped', 7)); await page.goto(`${base}/research-v8?demo=1`, { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => document.readyState === 'complete'); check(test, 'Research demo never renders or writes first-visit tour', await visibleTour(page).count() === 0 && await stored(page) === savedProgress('skipped', 7)); await second.close(); } finally { await context.close(); }
    });
    await run('responsive-theme-keyboard-geometry', async test => {
        for (const viewport of viewports) for (const theme of ['light', 'dark']) {
            const { context, page } = await setup(browser, test, { viewport, init: { theme } });
            try { await marketReady(page); const tour = visibleTour(page); await stageHeading(page, 'Understand the Market score').waitFor(); await page.waitForFunction(expected => document.documentElement.dataset.v8Theme === expected, theme); await tour.getByRole('button', { name: 'Skip tour', exact: true }).focus(); await page.keyboard.press('Tab'); check(test, `${viewport.name}/${theme} tour does not trap keyboard focus`, await tour.evaluate(node => !node.contains(document.activeElement))); const boxes = await tour.locator('a,button,h2,p').evaluateAll(nodes => nodes.filter(node => node.getClientRects().length).map(node => { const box = node.getBoundingClientRect(); return { left: box.left, right: box.right, height: box.height }; })); check(test, `${viewport.name}/${theme} controls are contained and touch-sized`, boxes.every(box => box.left >= -1 && box.right <= viewport.width + 1) && (await tour.getByRole('button').evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().height >= 44))), JSON.stringify(boxes)); check(test, `${viewport.name}/${theme} has no horizontal overflow`, await noOverflow(page)); const file = `first-visit-market-${viewport.width}-${theme}.png`; await page.screenshot({ path: path.join(output, file), fullPage: true }); test.screenshots.push(file);
                const stock = await advanceMarket(page); await researchReady(page); const save = await waitStoredStage(page, 'save'); const researchTour = visibleTour(page); await stageHeading(page, 'Save a stock').waitFor(); const researchBoxes = await researchTour.locator('a,button,h2,p').evaluateAll(nodes => nodes.filter(node => node.getClientRects().length).map(node => { const box = node.getBoundingClientRect(); return { left: box.left, right: box.right, height: box.height }; })); const saveButton = page.getByRole('button', { name: 'Save stock', exact: true }); check(test, `${viewport.name}/${theme} Research save stage follows the positive reading once`, save.revision === stock.revision + 1); check(test, `${viewport.name}/${theme} Research save and tour controls are contained and touch-sized`, researchBoxes.every(box => box.left >= -1 && box.right <= viewport.width + 1) && await saveButton.evaluate(node => node.getBoundingClientRect().height >= 44) && await researchTour.getByRole('button', { name: 'Skip tour', exact: true }).evaluate(node => node.getBoundingClientRect().height >= 44), JSON.stringify(researchBoxes)); check(test, `${viewport.name}/${theme} Research has no horizontal overflow`, await noOverflow(page)); const researchFile = `first-visit-research-${viewport.width}-${theme}.png`; await page.screenshot({ path: path.join(output, researchFile), fullPage: true }); test.screenshots.push(researchFile); } finally { await context.close(); }
        }
    });
} catch (error) { report.fatalError = error instanceof Error ? error.stack ?? error.message : String(error); }
finally { await browser.close(); report.status = !report.fatalError && report.scenarios.every(value => value.status === 'passed') ? 'passed' : 'failed'; await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ status: report.status, fixtureOnly: true, output, scenarios: report.scenarios.map(({ name, status, checks, issues }) => ({ name, status, checks: checks.length, issues })) }, null, 2));
if (report.status !== 'passed') process.exitCode = 1;
