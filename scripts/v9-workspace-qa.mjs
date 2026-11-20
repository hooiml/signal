import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { chromium } from 'playwright';
import { marketRequestFixture } from './harness/market-request-fixture.mjs';
import { researchSnapshotFixture } from './harness/research-read-fixture.mjs';

// Local fixture only: block external requests and unexpected writes.
const base = process.env.SIGNAL_QA_URL || 'http://127.0.0.1:3000';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const output = '.tmp/v9-workspace';
await mkdir(output, { recursive: true });
const modules = new Map();
function load(file) {
    const absolute = path.resolve(file);
    if (modules.has(absolute)) return modules.get(absolute).exports;
    const mod = { exports: {} }; modules.set(absolute, mod);
    const require = id => {
        assert.ok(id.startsWith('.') || id.startsWith('@/'));
        const resolved = id.startsWith('@/') ? path.resolve('src', id.slice(2)) : path.resolve(path.dirname(absolute), id);
        return load(`${resolved}.ts`);
    };
    const code = ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', code)(require, mod, mod.exports);
    return mod.exports;
}
const { reconcileScoreChange } = load('src/lib/signal-change.ts');
const { createResearchRecord } = load('src/lib/research/records.ts');
const fixture = marketRequestFixture({ providerOverrides: { fetchVIX: () => ({ price: 30.4, change: 0, observedAt: new Date('2026-09-11T20:00:00Z') }) } });
const seeds = {};
for (const market of ['US', 'MY']) for (const mode of ['standard', 'contrarian']) for (const social of ['true', 'false']) {
    seeds[`${market}:${mode}:${social}`] = await (await fixture.route.GET(fixture.request(`market=${market}&mode=${mode}&enableSocial=${social}`))).json();
}
const us = seeds['US:standard:false'].data, vix = us.components.vix;
const current = [{ key: 'vix', name: vix.display_name, score: vix.score, weight: vix.weight, raw_value: vix.value, last_updated: vix.last_updated, timestamp_basis: 'observed', unit: 'VIX points' }];
const previous = [{ ...current[0], score: 60, weight: .35, raw_value: 20, last_updated: '2026-09-10T20:00:00Z' }];
us.metadata.change_reconciliation = reconcileScoreChange({ current, previous, currentScore: us.composite_score, previousScore: 54, currentModelVersion: 'fixture-v2', previousModelVersion: 'fixture-v2' });
us.metadata.score_delta = { snapshot_date: '2026-09-12', previous_date: '2026-09-11', previous_score: 54, delta: us.composite_score - 54, label: 'Compared with 2026-09-11' };
const report = { base, checks: [], failures: [], errors: [], requests: [] };
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
async function scenario(name, fn) {
    try { await fn(); report.checks.push(name); console.log(`PASS ${name}`); }
    catch (error) { report.failures.push({ name, error: error.stack }); console.error(`FAIL ${name}: ${error.message}`); }
}
async function setup(width, theme, owner = false) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage(); page.setDefaultTimeout(12000);
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
    page.on('requestfailed', request => { if (!request.failure()?.errorText.includes('ERR_ABORTED')) report.errors.push(`${request.url()}: ${request.failure()?.errorText}`); });
    await context.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.origin !== new URL(base).origin) return route.abort();
        if (!url.pathname.startsWith('/api/')) return route.continue();
        report.requests.push(`${req.method()} ${url.pathname}`);
        if (url.pathname === '/api/signals/v2' && req.method() === 'GET') {
            const key = `${url.searchParams.get('market') || 'US'}:${url.searchParams.get('mode') || 'standard'}:${url.searchParams.get('enableSocial') || 'true'}`;
            report.requests.push({ signal: key });
            assert.ok(seeds[key], `No signal fixture for ${key}`);
            return route.fulfill({ json: seeds[key] });
        }
        if (url.pathname === '/api/owner/session' && req.method() === 'GET') return route.fulfill({ json: { success: true, data: { configured: owner, unlocked: owner } } });
        if (url.pathname === '/api/research/watchlist' && req.method() === 'GET') return route.fulfill({ json: { success: true, data: owner ? [createResearchRecord({ symbol: 'AAPL', market: 'US', companyName: 'Fixture Apple' })] : [], archivedSymbols: [] } });
        if (url.pathname === '/api/research/discovery') return route.fulfill({ json: { success: true, data: { generatedAt: '2026-10-25T00:00:00.000Z', universeSize: 0, scannedCount: 0, candidates: [], contenders: [], emergingCandidates: [], performance: [], historySnapshotCount: 0, warnings: [] } } });
        if (url.pathname.startsWith('/api/research/filings/')) return route.fulfill({ json: { success: true, data: { symbol: 'AAPL', cik: '0000320193', issuer: 'Fixture Apple', filings: [{ accessionNumber: '0000320193-26-000105', form: '10-K', sourceKind: 'annual-report', filingDate: '2026-10-20', reportingPeriod: '2026-09-30', title: 'Fixture annual report (10-K)', sourceUrl: 'https://www.sec.gov/Archives/edgar/data/320193/fixture-10k.htm', providerLabel: 'SEC EDGAR' }] } } });
        if (url.pathname.startsWith('/api/learn/trading-replay/')) return route.fulfill({ json: { success: false, error: 'Replay omitted from this navigation fixture.' } });
        if (owner && url.pathname === '/api/research/watchlist/AAPL' && req.method() === 'PATCH') {
            const { mode, ...record } = req.postDataJSON();
            report.requests.push({ ownerWrite: { mode, symbol: record.symbol, market: record.market } });
            return route.fulfill({ json: { success: true, data: record } });
        }
        if (url.pathname.startsWith('/api/research/symbol/') && req.method() === 'GET') return route.fulfill({ json: researchSnapshotFixture });
        if (url.pathname === '/api/research/quotes' && req.method() === 'POST') return route.fulfill({ json: { success: true, data: [{ symbol: 'AAPL', success: true, data: researchSnapshotFixture.data }] } });
        if (url.pathname === '/api/signals/replay' && req.method() === 'GET') return route.fulfill({ json: { success: true, data: { market: 'US', mode: 'standard', enableSocial: false, summaries: [] } } });
        if (req.method() !== 'GET') report.failures.push({ name: 'unexpected mutation blocked', error: `${req.method()} ${url.pathname}` });
        return route.fulfill({ status: 404, json: { success: false, error: 'Not included in QA fixture.' } });
    });
    return { context, page };
}
try {
    if (process.env.SIGNAL_QA_PALETTE_REFERENCE) {
        const referenceContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        const referencePage = await referenceContext.newPage();
        await referencePage.goto(pathToFileURL(path.resolve(process.env.SIGNAL_QA_PALETTE_REFERENCE)).href);
        await referencePage.getByText('Graphite & sky').waitFor();
        await referencePage.screenshot({ path: `${output}/reference.png` });
        await referenceContext.close();
    } else report.checks.push('Palette reference screenshot skipped: SIGNAL_QA_PALETTE_REFERENCE not set.');
    for (const width of [1280, 768, 375]) for (const theme of ['light', 'dark']) {
        const { context, page } = await setup(width, theme);
        await scenario(`home ${width} ${theme}`, async () => {
            await page.goto(`${base}/v9?market=US`, { waitUntil: 'domcontentloaded' });
            await page.getByTestId('v9-workspace').filter({ visible: true }).waitFor();
            await page.getByRole('heading', { level: 1 }).waitFor();
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'document overflow');
            const mainWidth = await page.locator('main:visible').first().evaluate(node => node.getBoundingClientRect().width);
            if (width === 375 && theme === 'light') {
                const geometry = await page.evaluate(() => {
                    const shell = [...document.querySelectorAll('[data-testid="v9-workspace"]')].find(el => el.getBoundingClientRect().width > 0);
                    const main = shell?.querySelector('main');
                    return [shell, main?.parentElement, main, ...Array.from(main?.children || []).slice(0, 4)].filter(Boolean).map(el => {
                        const rect = el.getBoundingClientRect(), css = getComputedStyle(el);
                        return { className: el.className, left: rect.left, right: rect.right, width: rect.width, display: css.display, grid: css.gridTemplateColumns };
                    });
                });
                report.checks.push({ name: 'mobile geometry', viewport: await page.evaluate(() => ({ innerWidth, clientWidth: document.documentElement.clientWidth })), geometry });
            }
            assert.ok(width > 768 || mainWidth >= width * .88, `main uses only ${mainWidth}px of ${width}px viewport`);
            const palette = await page.getByTestId('v9-workspace').filter({ visible: true }).evaluate(node => {
                const css = getComputedStyle(node);
                return Object.fromEntries(['--canvas', '--surface', '--brand', '--ink', '--muted'].map(key => [key, css.getPropertyValue(key).trim()]));
            });
            report.checks.push({ name: `palette ${width} ${theme}`, palette });
            assert.equal(palette['--brand'].toLowerCase(), theme === 'dark' ? '#60a5fa' : '#1755a6');
            await page.screenshot({ path: `${output}/home-${width}-${theme}.png` });
        });
        await scenario(`market ${width} ${theme}`, async () => {
            await page.goto(`${base}/v9?market=US&view=market`, { waitUntil: 'domcontentloaded' });
            await page.getByRole('heading', { name: /market condition score/i }).waitFor();
            await page.getByRole('group', { name: 'Select market' }).waitFor();
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'document overflow');
            const mainWidth = await page.locator('main:visible').first().evaluate(node => node.getBoundingClientRect().width);
            assert.ok(width > 768 || mainWidth >= width * .88, `market main uses only ${mainWidth}px of ${width}px viewport`);
            assert.ok(await page.getByRole('slider', { name: /market condition score/i }).count(), 'score chart');
            await page.screenshot({ path: `${output}/market-${width}-${theme}.png` });
        });
        await context.close();
    }
    const { context, page } = await setup(1280, 'dark');
    await scenario('market actions remain in V9', async () => {
        await page.goto(`${base}/v9?market=US&view=market`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: /market condition score/i }).waitFor();
        await page.getByText(/VIX is above 30/).first().waitFor();
        const body = await page.locator('main:visible').innerText();
        assert.match(body, /35%/); assert.match(body, /85%/);
        for (const name of [/change details/i, /review source coverage/i, /explore market context/i]) {
            const control = page.getByRole('button', { name }).or(page.getByRole('link', { name })).first();
            if (await control.isVisible()) {
                await control.click();
                assert.equal(new URL(page.url()).pathname, '/v9', `${name} left V9`);
                await page.goto(`${base}/v9?market=US&view=market`, { waitUntil: 'domcontentloaded' });
            }
        }
        const advanced = page.getByRole('button', { name: 'Advanced Market' });
        await advanced.click();
        assert.equal(await advanced.getAttribute('aria-pressed'), 'true');
        assert.equal(new URL(page.url()).pathname, '/v9');
    });
    await scenario('market and ticker deep links survive reload', async () => {
        await page.goto(`${base}/v9?market=US&view=market&tab=history`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('tab', { name: 'History', exact: true }).waitFor();
        assert.equal(await page.getByRole('tab', { name: 'History', exact: true }).getAttribute('aria-selected'), 'true');
        await page.reload();
        await page.getByRole('tab', { name: 'History', exact: true }).waitFor();
        assert.equal(await page.getByRole('tab', { name: 'History', exact: true }).getAttribute('aria-selected'), 'true');
        await page.goto(`${base}/v9?market=US&view=research&ticker=AAPL&tab=filings`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('link', { name: 'Filings', exact: true }).waitFor();
        await page.reload();
        assert.equal(new URL(page.url()).searchParams.get('ticker'), 'AAPL');
        assert.equal(new URL(page.url()).searchParams.get('tab'), 'filings');
    });
    await scenario('Market tabs support browser Back and Forward', async () => {
        await page.goto(`${base}/v9?market=US&view=market&tab=evidence`, { waitUntil: 'domcontentloaded' });
        const evidence = page.getByRole('tab', { name: 'Evidence', exact: true });
        await evidence.waitFor();
        await page.getByRole('tab', { name: 'History', exact: true }).click();
        await page.waitForURL(url => url.searchParams.get('tab') === 'history');
        await page.goBack();
        await page.waitForURL(url => url.searchParams.get('tab') === 'evidence');
        await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() === 'Evidence');
        await page.goForward();
        await page.waitForURL(url => url.searchParams.get('tab') === 'history');
        await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() === 'History');
    });
    await scenario('MY source and lens controls request matching fixtures', async () => {
        await page.goto(`${base}/v9?market=MY&view=market&mode=standard&enableSocial=false`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'Contrarian', exact: true }).click();
        await page.waitForURL(url => url.searchParams.get('mode') === 'contrarian');
        await Promise.all([
            page.waitForResponse(response => response.url().includes('/api/signals/v2?') && new URL(response.url()).searchParams.get('market') === 'MY' && new URL(response.url()).searchParams.get('mode') === 'contrarian' && new URL(response.url()).searchParams.get('enableSocial') === 'true'),
            page.getByLabel('Include news in score').check(),
        ]);
        await page.waitForURL(url => url.searchParams.get('enableSocial') === 'true');
        assert.ok(report.requests.some(item => item.signal === 'MY:contrarian:true'));
        assert.equal(await page.getByRole('button', { name: 'Contrarian', exact: true }).getAttribute('aria-pressed'), 'true');
        assert.equal(await page.getByLabel('Include news in score').isChecked(), true);
    });
    await scenario('Home market CTA respects selected market', async () => {
        await page.goto(`${base}/v9?market=MY`, { waitUntil: 'domcontentloaded' });
        await page.getByText('Daily Brief · Malaysia', { exact: false }).waitFor();
        await page.getByRole('button', { name: /Open Market Pulse/ }).first().click();
        await page.waitForURL(url => url.searchParams.get('view') === 'market');
        assert.equal(new URL(page.url()).searchParams.get('market'), 'MY');
    });
    await scenario('Home evidence action opens the evidence tab', async () => {
        await page.goto(`${base}/v9?market=US`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: /US assessment has evidence limits/i }).click();
        await page.waitForURL(url => url.searchParams.get('view') === 'market' && url.searchParams.get('tab') === 'evidence');
        assert.equal(await page.getByRole('tab', { name: 'Evidence', exact: true }).getAttribute('aria-selected'), 'true');
    });
    await scenario('quick jump to Discover and ticker stays in V9', async () => {
        await page.goto(`${base}/v9?market=US`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { level: 1 }).waitFor();
        await page.getByLabel('Quick jump (Ctrl+K)').click();
        await page.getByRole('dialog').waitFor();
        await page.keyboard.press('Escape');
        await page.getByRole('dialog').waitFor({ state: 'hidden' });
        await page.getByLabel('Quick jump (Ctrl+K)').focus();
        await page.keyboard.press('Control+k');
        await page.locator('dialog:modal').waitFor();
        await page.getByRole('link', { name: /Discover · Stock Picker/i }).click();
        assert.equal(new URL(page.url()).pathname, '/v9');
        assert.equal(new URL(page.url()).searchParams.get('view'), 'discover');
        await page.getByLabel('Quick jump (Ctrl+K)').click();
        await page.getByPlaceholder(/Jump to US/).fill('MSFT');
        await page.getByRole('link', { name: /MSFT/i }).first().click();
        assert.equal(new URL(page.url()).pathname, '/v9');
        assert.equal(new URL(page.url()).searchParams.get('ticker'), 'MSFT');
    });
    await scenario('research filings, peers and ticker stay in V9', async () => {
        await page.goto(`${base}/v9?market=US&view=research&ticker=AAPL`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('navigation', { name: 'Company research' }).waitFor();
        for (const name of ['Filings', 'Peers']) {
            await page.getByRole('link', { name, exact: true }).click();
            await page.waitForURL(url => url.searchParams.get('tab') === name.toLowerCase());
            assert.equal(new URL(page.url()).pathname, '/v9');
            assert.equal(new URL(page.url()).searchParams.get('tab'), name.toLowerCase());
        }
        await page.getByLabel('Open stock ticker').fill('MSFT');
        await page.getByRole('button', { name: 'Open', exact: true }).last().click();
        assert.equal(new URL(page.url()).pathname, '/v9');
        assert.equal(new URL(page.url()).searchParams.get('ticker'), 'MSFT');
    });
    await scenario('guest owner boundary stays in V9', async () => {
        await page.goto(`${base}/v9?market=US&view=research&ticker=AAPL&tab=monitoring`, { waitUntil: 'domcontentloaded' });
        await page.getByText('Unlock your owner workspace to manage saved research.').waitFor();
        assert.equal(new URL(page.url()).pathname, '/v9');
    });
    await scenario('portfolio, discover and learn navigation', async () => {
        for (const view of ['home', 'market', 'portfolio', 'discover', 'research', 'learn']) {
            await page.goto(`${base}/v9?market=US&view=${view}`, { waitUntil: 'domcontentloaded' });
            await page.getByTestId('v9-workspace').filter({ visible: true }).waitFor();
            assert.equal(new URL(page.url()).pathname, '/v9');
            assert.equal(new URL(page.url()).searchParams.get('view'), view);
            const legacy = await page.locator('header:visible a, aside:visible a, nav[aria-label="Mobile navigation"]:visible a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')).filter(href => /^\/(?:main-v8|research-v8|research)(?:[?#/]|$)/.test(href || '')));
            assert.deepEqual(legacy, [], `${view} global navigation contains legacy destinations`);
        }
        await page.goto(`${base}/v9?market=US&view=portfolio`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('link', { name: 'Manage portfolio' }).click();
        await page.waitForURL(url => url.searchParams.get('tab') === 'manage');
        assert.equal(new URL(page.url()).pathname, '/v9');
        await page.getByRole('link', { name: 'Holdings', exact: true }).click();
        await page.waitForURL(url => !url.searchParams.has('tab'));
    });
    await scenario('shared command palette retains V8 fallback', async () => {
        await page.goto(`${base}/main-v8?market=US`, { waitUntil: 'domcontentloaded' });
        await page.getByLabel('Quick jump (Ctrl+K)').click();
        const link = page.getByRole('link', { name: /US Market Pulse/i });
        assert.match(await link.getAttribute('href'), /^\/main-v8\?/);
    });
    await context.close();
    const deferred = await setup(1280, 'dark');
    let releaseSignals;
    const signalGate = new Promise(resolve => { releaseSignals = resolve; });
    await deferred.context.route('**/api/signals/v2?*', async route => {
        const url = new URL(route.request().url());
        await signalGate;
        const key = `${url.searchParams.get('market') || 'US'}:${url.searchParams.get('mode') || 'standard'}:${url.searchParams.get('enableSocial') || 'true'}`;
        await route.fulfill({ json: seeds[key] });
    });
    try {
        await scenario('Home stress action opens Scenarios', async () => {
            await deferred.page.goto(`${base}/v9?market=US`, { waitUntil: 'domcontentloaded' });
            await deferred.page.getByRole('button', { name: /Run a volatility stress test/i }).click();
            await deferred.page.waitForURL(url => url.searchParams.get('view') === 'market' && url.searchParams.get('tab') === 'scenarios');
            releaseSignals();
            const tab = deferred.page.getByRole('tab', { name: 'Scenarios', exact: true });
            await tab.waitFor();
            assert.equal(await tab.getAttribute('aria-selected'), 'true');
        });
    } finally { releaseSignals(); await deferred.context.close(); }
    const owned = await setup(1280, 'dark', true);
    await owned.context.addInitScript(() => localStorage.setItem('signal-portfolio-holdings-v1', JSON.stringify({ version: 1, updatedAt: '2026-07-26T10:00:00.000Z', holdings: [{ accountLabel: 'Fixture', symbol: 'AAPL', market: 'US', quantity: 10, averageCost: 120, currency: 'USD', importedAt: '2026-07-26T10:00:00.000Z', provenanceLabel: 'QA fixture' }], cashBalances: [] })));
    await scenario('owner monitoring write uses fixture and stays in V9', async () => {
        await owned.page.goto(`${base}/v9?market=US&view=research&ticker=AAPL&tab=monitoring`, { waitUntil: 'domcontentloaded' });
        const editor = owned.page.getByTestId('structured-trigger-editor');
        await editor.waitFor();
        await editor.getByRole('button', { name: 'Add rule' }).click();
        await editor.getByRole('button', { name: 'Save structured rules' }).click();
        await editor.getByText('Structured monitoring rules saved.').waitFor();
        assert.ok(report.requests.some(item => item.ownerWrite?.mode === 'settings' && item.ownerWrite?.symbol === 'AAPL'));
        assert.equal(new URL(owned.page.url()).pathname, '/v9');
    });
    await scenario('portfolio manage exact match preserves ticker and market', async () => {
        await owned.page.goto(`${base}/v9?view=portfolio&market=MY&tab=manage`, { waitUntil: 'domcontentloaded' });
        const region = owned.page.getByRole('region', { name: 'Read-only holdings snapshot' });
        await region.getByRole('button', { name: 'Exact match' }).click();
        await owned.page.waitForURL(url => url.searchParams.get('view') === 'research');
        const url = new URL(owned.page.url());
        assert.equal(url.pathname, '/v9');
        assert.equal(url.searchParams.get('ticker'), 'AAPL');
        assert.equal(url.searchParams.get('market'), 'US');
    });
    await owned.context.close();
} finally {
    await browser.close();
    await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
}
if (report.failures.length || report.errors.length) process.exitCode = 1;
