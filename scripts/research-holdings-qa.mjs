import { fulfillEarningsCalendarRead } from './qa-earnings-calendar-fixture.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import ts from 'typescript';
import { researchReadFixture } from './harness/research-read-fixture.mjs';

const args = process.argv.slice(2);
const argument = (name, fallback = null) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] ?? fallback : fallback;
};
const baseUrl = argument('--base-url', process.env.SIGNAL_QA_URL ?? 'http://127.0.0.1:3000');
const origin = new URL(baseUrl).origin;
assert.ok(['localhost', '127.0.0.1'].includes(new URL(baseUrl).hostname), 'Holdings QA only permits a local fixture server.');
const before = args.includes('--before');
const timeout = Number(argument('--timeout', '15000'));
const evidenceRoot = path.resolve('.tmp', 'research-holdings', before ? 'before' : 'after');
const holdingsKey = 'signal-portfolio-holdings-v1';
const holdingsEvent = 'signal:portfolio-holdings-change';
const fixtureTime = '2026-10-25T02:30:00.000Z';
const money = (amount, currency) => new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
const fixtureDisplayTime = new Date(fixtureTime).toLocaleString();
const ownerFixture = researchReadFixture();
const ownerResponse = await ownerFixture.route.GET();
assert.equal(ownerResponse.status, 200, 'owner fixture must provide validated saved records');
const ownerRecords = (await ownerResponse.json()).data;
const views = [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'tablet', width: 768, height: 900 },
    { name: 'phone', width: 375, height: 812 },
    { name: 'narrow', width: 320, height: 812 },
];

// The guest-workspace QA fixtures deliberately use the persisted record's compact form;
// the production parser supplies the saved-record defaults.
const record = (symbol, market, companyName) => ({ symbol, market, companyName, notes: symbol === 'AAPL' ? 'Private fixture note must not be displayed in Holdings.' : '' });

const mixedSnapshot = {
    version: 1, updatedAt: fixtureTime,
    holdings: [
        { accountLabel: 'Brokerage USD', symbol: 'AAPL', market: 'US', quantity: 2, averageCost: 100, currency: 'USD', importedAt: fixtureTime, provenanceLabel: 'Fixture import 25 Oct' },
        { accountLabel: 'Brokerage USD', symbol: 'UNMATCHED', market: 'US', quantity: 3, averageCost: 20, currency: 'USD', importedAt: fixtureTime, provenanceLabel: 'Fixture import 25 Oct' },
        { accountLabel: 'Malaysia cash account', symbol: '1155.KL', market: 'MY', quantity: 10, averageCost: 8, currency: 'MYR', importedAt: fixtureTime, provenanceLabel: 'Fixture import 25 Oct' },
    ],
    cashBalances: [
        { accountLabel: 'Brokerage USD', currency: 'USD', balance: 50, importedAt: fixtureTime, provenanceLabel: 'Fixture import 25 Oct' },
        { accountLabel: 'Malaysia cash account', currency: 'MYR', balance: 25, importedAt: fixtureTime, provenanceLabel: 'Fixture import 25 Oct' },
    ],
};
const usdSnapshot = {
    version: 1, updatedAt: fixtureTime,
    holdings: [{ accountLabel: 'USD only', symbol: 'AAPL', market: 'US', quantity: 4, averageCost: 125, currency: 'USD', importedAt: fixtureTime, provenanceLabel: 'USD fixture' }],
    cashBalances: [],
};
const cashSnapshot = {
    version: 1, updatedAt: fixtureTime, holdings: [],
    cashBalances: [
        { accountLabel: 'USD cash', currency: 'USD', balance: 120, importedAt: fixtureTime, provenanceLabel: 'Cash fixture' },
        { accountLabel: 'MYR cash', currency: 'MYR', balance: 80, importedAt: fixtureTime, provenanceLabel: 'Cash fixture' },
    ],
};

// Use the real import/merge contract: a holdings-only update retains older cash rows.
function loadPortfolioModule(file) {
    const absolute = path.resolve(file);
    const compiled = { exports: {} };
    const code = ts.transpileModule(readFileSync(absolute, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        fileName: absolute,
    }).outputText;
    new Function('require', 'module', 'exports', code)(
        id => loadPortfolioModule(path.resolve(path.dirname(absolute), `${id}.ts`)), compiled, compiled.exports,
    );
    return compiled.exports;
}
const { createPortfolioImportSnapshot, mergePortfolioHoldingsSnapshots } = loadPortfolioModule('src/lib/portfolio/holdings.ts');
const retainedCashTime = '2026-10-01T02:30:00.000Z';
const createRetainedCashSnapshot = (cashBalances, provenanceLabel) => mergePortfolioHoldingsSnapshots(
    createPortfolioImportSnapshot({ holdings: [], cashBalances }, provenanceLabel, retainedCashTime),
    createPortfolioImportSnapshot({ holdings: usdSnapshot.holdings, cashBalances: [] }, 'USD fixture', fixtureTime),
    'add-only',
);
const retainedCash = { accountLabel: 'Retained cash account', currency: 'USD', balance: 2500 };
const retainedCashSnapshot = createRetainedCashSnapshot([retainedCash], 'Retained cash import');
const retainedSameLabelSnapshot = createRetainedCashSnapshot([{ ...retainedCash, balance: 0 }], 'USD fixture');
const retainedCurrenciesSnapshot = createRetainedCashSnapshot([
    retainedCash, { ...retainedCash, currency: 'MYR', balance: 80 },
], 'Retained cash import');

const report = { fixtureOnly: true, baseUrl, before, fixtureTime, scenarios: [], startedAt: new Date().toISOString() };
const screenshot = async (page, result, label) => {
    const file = path.join(evidenceRoot, `${result.name.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase()}-${label}.png`);
    await page.screenshot({ path: file, fullPage: true });
    result.screenshots.push(file);
};
const geometry = async page => page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    holdingsPanel: document.querySelector('#home-panel-holdings')?.getBoundingClientRect().toJSON() ?? null,
    table: document.querySelector('#home-panel-holdings table')?.getBoundingClientRect().toJSON() ?? null,
}));
const assertNoOverflow = async (page, result) => {
    const value = await geometry(page);
    result.geometry.push(value);
    assert.ok(value.documentWidth <= value.viewport.width + 1, `unexpected horizontal document overflow: ${JSON.stringify(value)}`);
};

async function installFixtures(context, scenario) {
    await context.addInitScript(({ snapshot, mode, storageFault, appOrigin, theme, guestRecords }) => {
        if (window.location.origin !== appOrigin) return;
        if (!sessionStorage.getItem('signal-holdings-qa-fixture-seeded')) {
            localStorage.setItem('signal-v8-theme-v1', theme);
            if (snapshot !== undefined) localStorage.setItem('signal-portfolio-holdings-v1', JSON.stringify(snapshot));
            if (mode === 'guest') localStorage.setItem('signal.guest-research.v1', JSON.stringify({ version: 1, guestId: 'd197b5a7-6cd4-4dac-9926-0c44bda2cb39', records: guestRecords }));
            sessionStorage.setItem('signal-holdings-qa-fixture-seeded', '1');
        }
        if (storageFault) {
            const original = Storage.prototype.getItem;
            Storage.prototype.getItem = function getItem(key) {
                if (key === 'signal-portfolio-holdings-v1') throw new DOMException('Fixture storage unavailable', 'SecurityError');
                return original.call(this, key);
            };
        }
        const recordWrite = () => sessionStorage.setItem('signal-holdings-qa-write-count', String(Number(sessionStorage.getItem('signal-holdings-qa-write-count') ?? '0') + 1));
        const setItem = Storage.prototype.setItem, removeItem = Storage.prototype.removeItem, clear = Storage.prototype.clear;
        Storage.prototype.setItem = function trackedSetItem(key, value) { if (key === 'signal-portfolio-holdings-v1') recordWrite(); return setItem.call(this, key, value); };
        Storage.prototype.removeItem = function trackedRemoveItem(key) { if (key === 'signal-portfolio-holdings-v1') recordWrite(); return removeItem.call(this, key); };
        Storage.prototype.clear = function trackedClear() { recordWrite(); return clear.call(this); };
    }, { snapshot: scenario.snapshot, mode: scenario.mode ?? 'guest', storageFault: scenario.storageFault, appOrigin: origin, theme: scenario.theme,
        guestRecords: scenario.records ?? [record('AAPL', 'US', 'Fixture Apple'), record('MAYBANK', 'MY', 'Fixture Maybank')] });
    await context.route('**/api/**', async route => {
        if (await fulfillEarningsCalendarRead(route)) return;
        const request = route.request();
        const url = new URL(request.url());
        scenario.requests.push({ method: request.method(), path: url.pathname, query: url.search });
        if (request.method() !== 'GET') {
            scenario.failures.push(`unexpected mutation request: ${request.method()} ${url.pathname}`);
            return route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Holdings QA forbids writes.' }) });
        }
        if (url.pathname === '/api/owner/session') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: { configured: true, unlocked: scenario.mode === 'owner' } }) });
        if (url.pathname === '/api/research/watchlist') {
            if (scenario.watchlistFailure) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Fixture watchlist failed.' }) });
            if (scenario.watchlistGate) await scenario.watchlistGate;
            return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: scenario.records ?? ownerRecords, archivedSymbols: [] }) });
        }
        if (url.pathname.startsWith('/api/research/')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
    });
}

async function openHoldings(page, result) {
    await page.goto(`${baseUrl}/research-v8`, { waitUntil: 'domcontentloaded', timeout });
    const home = page.getByRole('tablist', { name: 'Research home' });
    await home.waitFor({ state: 'visible', timeout });
    await page.waitForFunction(mode => document.body.innerText.includes(mode === 'owner' ? 'Owner workspace' : 'Guest workspace'), result.mode ?? 'guest', { timeout });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve())));
    const tab = home.getByRole('tab', { name: /^Holdings$/ });
    await tab.waitFor({ state: 'visible', timeout });
    const requestStart = result.requests.length;
    await tab.click();
    const panel = page.locator('#home-panel-holdings');
    await panel.waitFor({ state: 'visible', timeout });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve())));
    result.holdingsRequests = result.requests.slice(requestStart);
    return { home, tab, panel };
}

async function verifyHomeTabs(page, home, holdingsTab, panel) {
    const text = (await home.getByRole('tab').allTextContents()).map(value => value.replace(/\s+/g, ' ').trim());
    assert.ok(/^Watchlist (?:\d+|…)$/.test(text[0] ?? '') && text[1] === 'Discover' && text[2] === 'Holdings', 'fresh home exposes Watchlist, Discover and Holdings in order');
    assert.equal(await holdingsTab.getAttribute('id'), 'home-tab-holdings');
    assert.equal(await holdingsTab.getAttribute('aria-controls'), 'home-panel-holdings');
    assert.equal(await panel.getAttribute('role'), 'tabpanel');
    assert.equal(await panel.getAttribute('aria-labelledby'), 'home-tab-holdings');
    await holdingsTab.focus();
    await page.keyboard.press('Home');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'home-tab-watchlist', 'Home moves focus to Watchlist');
    await page.keyboard.press('End');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'home-tab-holdings', 'End moves focus to Holdings');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'home-tab-watchlist', 'Right wraps focus to Watchlist');
    assert.equal(await home.locator('#home-tab-watchlist').getAttribute('aria-selected'), 'true', 'Arrow navigation automatically selects');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'home-tab-holdings', 'Left wraps focus to Holdings');
    assert.equal(await holdingsTab.getAttribute('aria-selected'), 'true');
}

function assertCostOnly(result) {
    const requests = (result.holdingsRequests ?? []).map(request => `${request.method} ${request.path}${request.query}`).join('\n');
    assert.ok(!/quote|symbol\//.test(requests), `Holdings requested a market price/provider endpoint: ${requests}`);
    assert.equal(result.failures.length, 0, result.failures.join(' | '));
}
function assertNoPrivateHoldingsLeak(result) {
    const outgoing = (result.outgoing ?? []).map(request => `${request.method} ${request.url} ${request.body}`).join('\n');
    const privateValues = new Set([
        'Brokerage USD', 'Malaysia cash account', 'Fixture import 25 Oct', 'USD only', 'Cash fixture',
        ...[...(result.snapshot?.holdings ?? []), ...(result.snapshot?.cashBalances ?? [])]
            .flatMap(row => [row.accountLabel, row.provenanceLabel]),
    ]);
    for (const privateValue of privateValues) {
        assert.ok(!outgoing.includes(privateValue), `private holdings field leaked in outgoing URL or body: ${privateValue}`);
    }
}

async function verifyRetainedCash({ page, panel, result }) {
    const snapshot = result.snapshot;
    const verify = async currentPanel => {
        await currentPanel.getByText(`Snapshot updated ${fixtureDisplayTime} · Saved on this device · Prices not loaded`, { exact: true }).waitFor({ timeout });
        const cashList = currentPanel.getByRole('heading', { name: 'Cash by account', exact: true }).locator('..');
        await cashList.waitFor({ timeout });
        assert.equal(await cashList.getByRole('listitem').count(), snapshot.cashBalances.length);
        assert.equal(await currentPanel.getByRole('heading', { name: /^(USD|MYR) totals$/ }).count(), snapshot.cashBalances.length);
        for (const cash of snapshot.cashBalances) {
            const row = cashList.getByRole('listitem').filter({ has: cashList.page().getByText(`${cash.accountLabel} · ${cash.currency}`, { exact: true }) });
            await row.getByText(money(cash.balance, cash.currency), { exact: true }).waitFor({ timeout });
            await row.getByText(`${cash.provenanceLabel} · ${new Date(cash.importedAt).toLocaleString()}`, { exact: true }).waitFor({ timeout });
            const summary = currentPanel.getByRole('heading', { name: `${cash.currency} totals`, exact: true }).locator('..');
            const cashTotal = summary.locator('p').filter({ has: summary.page().getByText('Cash', { exact: true }) });
            await cashTotal.getByText(money(cash.balance, cash.currency), { exact: true }).waitFor({ timeout });
        }
        const usd = currentPanel.getByRole('heading', { name: 'USD totals', exact: true }).locator('..');
        await usd.getByText(money(500, 'USD'), { exact: true }).waitFor({ timeout });
    };
    await verify(panel);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), holdingsKey), JSON.stringify(snapshot));
    await screenshot(page, result, 'retained-cash');
    await page.reload({ waitUntil: 'domcontentloaded', timeout });
    const { panel: reloaded } = await openHoldings(page, result);
    await verify(reloaded);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), holdingsKey), JSON.stringify(snapshot));
    result.checks.push('older cash source, import time and account remain visible after holdings-only import and reload; exact per-currency amounts and stored bytes are unchanged');
}

async function runScenario(browser, definition) {
    const result = { ...definition, name: definition.name, status: 'running', checks: [], failures: [], requests: [], outgoing: [], console: [], screenshots: [], geometry: [] };
    report.scenarios.push(result);
    const context = await browser.newContext({ viewport: definition.viewport ?? views[0], colorScheme: definition.theme, serviceWorkers: 'block', reducedMotion: 'reduce' });
    await installFixtures(context, result);
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);
    page.on('pageerror', error => result.failures.push(`pageerror: ${error.message}`));
    page.on('console', message => {
        if (message.type() === 'warning' && message.text() === 'Service Worker registration blocked by Playwright') return;
        if (definition.watchlistFailure && message.type() === 'error' && /Failed to load resource/.test(message.text())) {
            result.console.push(`expected fixture 500: ${message.text()}`); return;
        }
        if (message.type() === 'error') result.failures.push(`console: ${message.text()}`);
        if (['error', 'warning'].includes(message.type())) result.console.push(`${message.type()}: ${message.text()}`);
    });
    page.on('request', request => result.outgoing.push({ method: request.method(), url: request.url(), body: request.postData() ?? '' }));
    page.on('response', response => {
        const url = new URL(response.url());
        if (url.origin !== origin || response.status() < 400) return;
        if (definition.watchlistFailure && response.status() === 500 && url.pathname === '/api/research/watchlist') return;
        result.failures.push(`HTTP ${response.status()} ${url.pathname}`);
    });
    page.on('requestfailed', request => {
        if (!(request.failure()?.errorText ?? '').includes('ERR_ABORTED')) result.failures.push(`requestfailed: ${request.method()} ${request.url()}`);
    });
    try {
        const { home, tab, panel } = await openHoldings(page, result);
        await verifyHomeTabs(page, home, tab, panel);
        result.checks.push('Research home tab association and keyboard Home/End navigation');
        await definition.verify({ page, panel, result, tab });
        const holdingWrites = await page.evaluate(() => Number(sessionStorage.getItem('signal-holdings-qa-write-count') ?? '0'));
        assert.equal(holdingWrites, definition.expectedHoldingStorageWrites ?? 0,
            `Holdings view wrote browser snapshot ${holdingWrites} time(s)`);
        assertCostOnly(result);
        assertNoPrivateHoldingsLeak(result);
        await assertNoOverflow(page, result);
        result.checks.push('no overflow, provider requests, writes, console errors, or failed requests');
        await screenshot(page, result, 'final');
        result.status = 'pass';
    } catch (error) {
        result.status = 'fail'; result.failures.push(String(error));
        await screenshot(page, result, 'failure').catch(() => {});
        const dom = await page.locator('body').innerText().catch(() => 'DOM unavailable');
        result.diagnosticDom = dom.slice(0, 6000);
    } finally {
        await context.close();
    }
    if (result.status !== 'pass') throw new Error(`${result.name}: ${result.failures.join(' | ')}`);
}

async function baseline(browser) {
    for (const viewport of [views[0], views[2]]) {
        const result = { name: `baseline-${viewport.name}`, status: 'running', checks: [], failures: [], requests: [], console: [], screenshots: [], geometry: [] };
        report.scenarios.push(result);
        const context = await browser.newContext({ viewport, serviceWorkers: 'block', reducedMotion: 'reduce' });
        await installFixtures(context, { ...result, snapshot: mixedSnapshot, theme: 'light', mode: 'guest' });
        const page = await context.newPage(); page.setDefaultTimeout(timeout);
        try {
            await page.goto(`${baseUrl}/research-v8`, { waitUntil: 'domcontentloaded', timeout });
            await page.getByRole('tablist', { name: 'Research home' }).waitFor({ state: 'visible', timeout });
            await screenshot(page, result, 'research-home-before');
            result.status = 'pass'; result.checks.push('pre-E18 Research home captured');
        } catch (error) { result.status = 'fail'; result.failures.push(String(error)); await screenshot(page, result, 'failure').catch(() => {}); }
        finally { await context.close(); }
        if (result.status !== 'pass') throw new Error(`${result.name}: ${result.failures.join(' | ')}`);
    }
}

await mkdir(evidenceRoot, { recursive: true });
let browser;
try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--no-sandbox'] });
    if (before) await baseline(browser);
    else {
        for (const viewport of views) for (const theme of ['light', 'dark']) await runScenario(browser, {
            name: `matched-no-quote-mixed-${theme}-${viewport.name}`, viewport, theme, snapshot: mixedSnapshot, mode: viewport.width === 768 ? 'owner' : 'guest',
            async verify({ page, panel, result }) {
                await panel.getByRole('heading', { name: 'Holdings', exact: true }).waitFor({ timeout });
                const usd = panel.getByRole('heading', { name: 'USD totals', exact: true }).locator('..');
                const myr = panel.getByRole('heading', { name: 'MYR totals', exact: true }).locator('..');
                await usd.waitFor({ timeout }); await myr.waitFor({ timeout });
                assert.equal(await panel.getByRole('heading', { name: /^(USD|MYR) totals$/ }).count(), 2, 'exactly two per-currency summary sections are rendered');
                await usd.getByText(money(260, 'USD'), { exact: true }).waitFor({ timeout }); await usd.getByText(money(50, 'USD'), { exact: true }).waitFor({ timeout });
                await myr.getByText(money(80, 'MYR'), { exact: true }).waitFor({ timeout }); await myr.getByText(money(25, 'MYR'), { exact: true }).waitFor({ timeout });
                await usd.getByText('Holdings without current price').waitFor({ timeout });
                assert.equal(await usd.getByText('2', { exact: true }).count(), 1, 'USD summary counts two holdings without prices');
                assert.equal(await myr.getByText('1', { exact: true }).count(), 1, 'MYR summary counts one holding without a price');
                const table = panel.getByRole('region', { name: 'Imported holdings table' });
                assert.deepEqual(await table.locator('thead th').allInnerTexts(), ['Account', 'Stock', 'Quantity', 'Average cost', 'Cost basis'], 'cost-only table shows no price-derived or always-empty columns');
                assert.equal(await panel.getByText('—', { exact: true }).count(), 0, 'no column of placeholder dashes stands in for unloaded prices');
                const unmatched = table.getByRole('row', { name: /UNMATCHED/ });
                await unmatched.getByText('No saved match', { exact: true }).waitFor({ timeout });
                assert.equal(await unmatched.getByRole('button').count(), 0, 'unmatched holding stays display-only');
                await panel.getByText(`Snapshot updated ${fixtureDisplayTime} · Fixture import 25 Oct · Saved on this device`, { exact: false }).waitFor({ timeout });
                assert.equal(await panel.getByText(/Fixture import 25 Oct/).count(), 1, 'one shared import source is stated once in the provenance line');
                await panel.getByText(/Saved on this device · Prices not loaded/).waitFor({ timeout });
                const cashList = panel.getByRole('heading', { name: 'Cash by account', exact: true }).locator('..');
                await cashList.getByText('Brokerage USD · USD', { exact: true }).waitFor({ timeout }); await cashList.getByText('Malaysia cash account · MYR', { exact: true }).waitFor({ timeout });
                await panel.getByText(new RegExp(`Snapshot updated ${fixtureDisplayTime.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)).waitFor({ timeout });
                await panel.getByRole('link', { name: 'Import or update holdings' }).evaluate(anchor => ({ href: anchor.href, target: anchor.target })).then(link => {
                    assert.equal(new URL(link.href).pathname + new URL(link.href).search, '/research?workspace=portfolio'); assert.equal(link.target, '_blank');
                });
                assert.equal(await panel.getByText('Private fixture note must not be displayed in Holdings.').count(), 0);
                assertCostOnly(result);
                assertNoPrivateHoldingsLeak(result);
                if (result.viewport.width <= 375) {
                    await table.scrollIntoViewIfNeeded();
                    const width = await table.evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth, left: element.scrollLeft }));
                    assert.ok(width.scroll > width.client, `phone table must expose horizontal scrolling: ${JSON.stringify(width)}`);
                    await table.focus(); await page.keyboard.press('ArrowRight');
                    await page.waitForFunction(previous => {
                        const element = document.querySelector('[role="region"][aria-label="Imported holdings table"]');
                        return element instanceof HTMLElement && element.scrollLeft > previous;
                    }, width.left, { timeout });
                    const tableFile = path.join(evidenceRoot, `${result.name}-phone-table.png`);
                    await table.screenshot({ path: tableFile }); result.screenshots.push(tableFile);
                    const cash = panel.getByRole('heading', { name: 'Cash by account', exact: true }).locator('..');
                    await cash.scrollIntoViewIfNeeded();
                    const cashFile = path.join(evidenceRoot, `${result.name}-phone-cash.png`);
                    await cash.screenshot({ path: cashFile }); result.screenshots.push(cashFile);
                    result.checks.push('phone table is keyboard-scrollable and lower table/cash evidence is captured');
                }
                await screenshot(page, result, 'holdings-before-stock-open');
                await assertNoOverflow(page, result);
                await panel.getByRole('button', { name: 'AAPL', exact: true }).click();
                await page.waitForURL(url => new URL(url).searchParams.get('ticker') === 'AAPL' && new URL(url).searchParams.get('market') === 'US', { timeout });
                await page.goBack({ waitUntil: 'domcontentloaded', timeout });
                await openHoldings(page, result);
                result.checks.push('cost totals match fixture arithmetic; all price-derived values are unavailable; exact saved match opens V8 stock route');
            },
        });
        await runScenario(browser, { name: 'empty-light-desktop', viewport: views[0], theme: 'light', snapshot: undefined, mode: 'guest', async verify({ panel, result }) {
            await panel.getByText('No holdings have been imported in this browser.').waitFor({ timeout }); result.checks.push('empty browser storage explains import path');
        } });
        await runScenario(browser, { name: 'malformed-dark-desktop', viewport: views[0], theme: 'dark', snapshot: { version: 99 }, mode: 'guest', async verify({ panel, result }) {
            await panel.getByRole('alert').getByText(/Saved portfolio data is invalid/).waitFor({ timeout }); result.checks.push('malformed snapshot is rejected without a write');
        } });
        await runScenario(browser, { name: 'storage-unavailable-light-desktop', viewport: views[0], theme: 'light', snapshot: undefined, storageFault: true, mode: 'guest', async verify({ panel, result }) {
            await panel.getByRole('alert').getByText(/Browser storage is unavailable/).waitFor({ timeout }); result.checks.push('storage failure remains an explicit non-writing state');
        } });
        await runScenario(browser, { name: 'usd-only-light-desktop', viewport: views[0], theme: 'light', snapshot: usdSnapshot, mode: 'guest', async verify({ panel, result }) {
            const usd = panel.getByRole('heading', { name: 'USD totals', exact: true }).locator('..'); await usd.waitFor({ timeout }); assert.equal(await panel.getByText('MYR totals').count(), 0); await usd.getByText(money(500, 'USD'), { exact: true }).waitFor({ timeout }); assert.equal(await panel.getByText('Cash by account').count(), 0, 'no cash accounts means no cash list'); result.checks.push('USD-only summary has exact cost total');
        } });
        await runScenario(browser, { name: 'cash-mixed-dark-desktop', viewport: views[0], theme: 'dark', snapshot: cashSnapshot, mode: 'guest', async verify({ panel, result }) {
            await panel.getByText('Cash by account').waitFor({ timeout }); const cash = panel.getByRole('heading', { name: 'Cash by account', exact: true }).locator('..'); await cash.getByText(money(120, 'USD'), { exact: true }).waitFor({ timeout }); await cash.getByText(money(80, 'MYR'), { exact: true }).waitFor({ timeout }); result.checks.push('USD and MYR cash remain per-currency and per-account');
        } });
        await runScenario(browser, { name: 'unmatched-light-desktop', viewport: views[0], theme: 'light', snapshot: { ...usdSnapshot, holdings: [{ ...usdSnapshot.holdings[0], symbol: 'NOLOOKUP' }] }, records: [], mode: 'guest', async verify({ panel, result }) {
            await panel.getByText('No saved match', { exact: true }).waitFor({ timeout }); assert.equal(await panel.getByRole('button', { name: 'NOLOOKUP', exact: true }).count(), 0); result.checks.push('unmatched symbol stays display-only and never guesses a lookup');
        } });
        await runScenario(browser, { name: 'mixed-sources-light-desktop', viewport: views[0], theme: 'light', mode: 'guest', snapshot: {
            ...usdSnapshot,
            holdings: [...usdSnapshot.holdings, { ...usdSnapshot.holdings[0], symbol: 'MSFT', provenanceLabel: 'Second import' }],
            cashBalances: [{ accountLabel: 'USD only', currency: 'USD', balance: 10, importedAt: fixtureTime, provenanceLabel: 'USD fixture' }],
        }, async verify({ panel, result }) {
            const table = panel.getByRole('region', { name: 'Imported holdings table' });
            await table.getByRole('columnheader', { name: 'Source', exact: true }).waitFor({ timeout });
            await table.getByRole('row', { name: /MSFT/ }).getByText(/Second import/).waitFor({ timeout });
            await table.getByRole('row', { name: /AAPL/ }).getByText(/USD fixture/).waitFor({ timeout });
            const cashList = panel.getByRole('heading', { name: 'Cash by account', exact: true }).locator('..');
            await cashList.getByText(`USD fixture · ${fixtureDisplayTime}`, { exact: true }).waitFor({ timeout });
            result.checks.push('mixed import sources stay attributed per row, including one cash account when the header has no shared source');
        } });
        await runScenario(browser, { name: 'shared-source-single-cash-light-desktop', viewport: views[0], theme: 'light', mode: 'guest', snapshot: {
            ...usdSnapshot,
            cashBalances: [{ accountLabel: 'USD only', currency: 'USD', balance: 10, importedAt: fixtureTime, provenanceLabel: 'USD fixture' }],
        }, async verify({ panel, result }) {
            await panel.getByText(`Snapshot updated ${fixtureDisplayTime} · USD fixture · Saved on this device · Prices not loaded`, { exact: true }).waitFor({ timeout });
            assert.equal(await panel.getByText('Cash by account').count(), 0, 'one cash account stays compact when the header states its exact source and import time');
            result.checks.push('single-source holdings and cash retain the compact shared provenance line');
        } });
        for (const [viewport, theme] of [[views[0], 'light'], [views[2], 'dark']]) await runScenario(browser, {
            name: `retained-cash-distinct-source-${theme}-${viewport.name}`, viewport, theme, mode: 'guest',
            snapshot: retainedCashSnapshot, verify: verifyRetainedCash,
        });
        await runScenario(browser, { name: 'retained-cash-same-label-zero-light-tablet', viewport: views[1], theme: 'light', mode: 'guest', snapshot: retainedSameLabelSnapshot, verify: verifyRetainedCash });
        await runScenario(browser, { name: 'retained-cash-two-currencies-dark-narrow', viewport: views[3], theme: 'dark', mode: 'guest', snapshot: retainedCurrenciesSnapshot, verify: verifyRetainedCash });
        let releaseLoading;
        const loadingGate = new Promise(resolve => { releaseLoading = resolve; });
        const loadingRun = runScenario(browser, { name: 'records-loading-light-desktop', viewport: views[0], theme: 'light', snapshot: usdSnapshot, mode: 'owner', watchlistGate: loadingGate, async verify({ panel, result }) {
            await panel.getByText('Research matches are unavailable until the watchlist is loaded.', { exact: true }).waitFor({ timeout }); assert.equal(await panel.getByText('No saved match', { exact: true }).count(), 0, 'unresolved records never claim a missing match'); releaseLoading(); await panel.getByRole('button', { name: 'AAPL', exact: true }).waitFor({ timeout }); result.checks.push('records loading remains separate from local holdings');
        } });
        await loadingRun;
        await runScenario(browser, { name: 'records-failure-dark-desktop', viewport: views[0], theme: 'dark', snapshot: usdSnapshot, mode: 'owner', watchlistFailure: true, async verify({ panel, result }) {
            await panel.getByText('Research matches are unavailable until the watchlist is loaded.', { exact: true }).waitFor({ timeout }); assert.equal(await panel.getByText('No saved match', { exact: true }).count(), 0, 'unresolved records never claim a missing match'); await panel.getByRole('button', { name: 'Retry saved research', exact: true }).waitFor({ timeout }); assert.equal(await panel.getByRole('button', { name: 'AAPL', exact: true }).count(), 0); result.checks.push('failed records read stays unresolved, exposes the existing retry, and does not make an optimistic match');
        } });
        await runScenario(browser, { name: 'storage-events-light-desktop', viewport: views[0], theme: 'light', snapshot: usdSnapshot, mode: 'guest', expectedHoldingStorageWrites: 1, async verify({ page, panel, result }) {
            const original = await page.evaluate(key => localStorage.getItem(key), holdingsKey);
            await page.evaluate(({ key, event, snapshot }) => { localStorage.setItem(key, JSON.stringify(snapshot)); window.dispatchEvent(new CustomEvent(event)); }, { key: holdingsKey, event: holdingsEvent, snapshot: cashSnapshot });
            await panel.getByText('Cash by account').waitFor({ timeout }); await page.reload({ waitUntil: 'domcontentloaded', timeout }); const { panel: reloaded } = await openHoldings(page, result); await reloaded.getByText('Cash by account').waitFor({ timeout });
            assert.equal(await page.evaluate(key => localStorage.getItem(key), holdingsKey), JSON.stringify(cashSnapshot));
            assert.notEqual(original, JSON.stringify(cashSnapshot)); result.checks.push('custom storage event and reload reflect external snapshot without component writes');
        } });
    }
} finally {
    report.completedAt = new Date().toISOString();
    await writeFile(path.join(evidenceRoot, 'report.json'), JSON.stringify(report, null, 2));
    await browser?.close();
}

const failures = report.scenarios.filter(scenario => scenario.status !== 'pass');
console.log(JSON.stringify({ status: failures.length ? 'fail' : 'pass', scenarios: report.scenarios.map(scenario => ({ name: scenario.name, status: scenario.status, checks: scenario.checks.length, screenshots: scenario.screenshots.length })), evidenceRoot }, null, 2));
if (failures.length) process.exitCode = 1;
