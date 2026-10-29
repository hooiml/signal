import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { chromium } from 'playwright';
import { marketRequestFixture } from './harness/market-request-fixture.mjs';
import { fulfillEarningsCalendarRead } from './qa-earnings-calendar-fixture.mjs';

// Controlled local fixtures only. No provider, owner record or mutation is used.
const base = process.env.SIGNAL_QA_URL || 'http://127.0.0.1:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const output = '.tmp/market-brief';
await mkdir(output, { recursive: true });
const cache = new Map();
function load(file) {
    const absolute = path.resolve(file);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const loaded = { exports: {} }; cache.set(absolute, loaded);
    const require = id => {
        const target = id.startsWith('@/') ? path.resolve('src', id.slice(2)) : path.resolve(path.dirname(absolute), id);
        assert.ok(id.startsWith('.') || id.startsWith('@/'), `Unexpected fixture import ${id}`);
        return load(target + '.ts');
    };
    const code = ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', code)(require, loaded, loaded.exports);
    return loaded.exports;
}
const { calculateCompositeScoreV2 } = load('src/lib/sentiment-calculator-v2.ts');
const { reconcileScoreChange } = load('src/lib/signal-change.ts');
const fixture = marketRequestFixture();
const seeds = {};
for (const market of ['US', 'MY']) seeds[market] = (await (await fixture.route.GET(fixture.request(`market=${market}&mode=standard&enableSocial=true`))).json()).data;
const names = { vix: 'VIX Index', social: 'Social Sentiment', put_call: 'Put/call ratio', aaii: 'AAII Sentiment', naaim: 'Manager exposure (NAAIM)', bofa: 'BofA SSI', news: 'News Sentiment' };
function payload(market, mode, state = 'complete') {
    const keys = market === 'US' ? ['vix', 'social', 'put_call', 'aaii', 'naaim', 'bofa'] : ['vix', 'news', 'aaii'];
    const date = state === 'persistence' ? new Date().toISOString().slice(0, 10) : '2026-09-12';
    const inputs = keys.map((name, index) => ({ name, display_name: names[name], value: name === 'vix' ? 20 : 0.8, score: index % 2 ? 35 : 75,
        enabled: true, weight: 0, signal: 'neutral', last_updated: state === 'stale' && index === 0 ? '2026-08-01' : date,
        metadata: { timestamp_basis: state === 'unavailable' || (state === 'unknown' && index === 0) ? 'retrieved' : 'observed', unit: 'fixture units' } }));
    const selected = state === 'missing' ? inputs.slice(0, 1) : state === 'no-input' ? [] : inputs;
    const current = calculateCompositeScoreV2(selected, { market, mode });
    const data = { ...structuredClone(seeds[market]), ...current, metadata: { ...structuredClone(seeds[market].metadata), ...current.metadata,
        score_delta: state === 'persistence' ? null : { snapshot_date: date, previous_date: null, previous_score: null, delta: null, label: 'No comparison' },
        score_history: [], driver_changes: [], driver_changes_available: false, change_reconciliation: null } };
    if (state === 'comparison') {
        const readings = Object.values(current.components).map(item => ({ key: item.name, name: item.display_name, score: item.score, weight: item.weight,
            raw_value: item.value, last_updated: item.last_updated, timestamp_basis: item.metadata.timestamp_basis, unit: item.metadata.unit }));
        data.metadata.score_delta = { snapshot_date: date, previous_date: '2026-09-11', previous_score: current.composite_score, delta: 0, label: 'No change' };
        data.metadata.change_reconciliation = reconcileScoreChange({ current: readings, previous: readings, currentScore: current.composite_score,
            previousScore: current.composite_score, currentModelVersion: 'brief-fixture', previousModelVersion: 'brief-fixture' });
    }
    try { fixture.parseSignal({ success: true, data }, market, mode); }
    catch (error) { throw new Error(`Invalid ${market}/${mode}/${state} fixture: ${error.message}`, { cause: error }); }
    return { success: true, data };
}
const report = { base, checks: [], errors: [], requests: [], fixture: 'Real calculator and route seed; synthetic readings; browser APIs intercepted.' };
if (process.argv.includes('--fixtures-only')) {
    const { buildMarketBrief } = load('src/lib/market-brief.ts');
    for (const market of ['US', 'MY']) for (const mode of ['standard', 'contrarian']) for (const state of ['complete', 'missing', 'stale', 'unknown', 'unavailable']) {
        const actual = buildMarketBrief(payload(market, mode, state).data, '2026-09-12').status;
        const expected = state === 'unavailable' ? 'unavailable' : state === 'complete' && market === 'US' ? 'available' : 'limited';
        assert.equal(actual, expected, `${market}/${mode}/${state} fixture status`);
    }
    console.log('Fixture payloads parsed successfully.');
    process.exit(0);
}
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
async function open(market, mode, state, width, theme, intercept) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
    page.on('requestfailed', request => { if (!request.failure()?.errorText.includes('ERR_ABORTED')) report.errors.push(`${request.url()}: ${request.failure()?.errorText}`); });
    await page.route('**/api/**', async route => {
        if (await fulfillEarningsCalendarRead(route)) return;
        const req = route.request(), url = new URL(req.url());
        report.requests.push({ method: req.method(), path: url.pathname });
        assert.equal(req.method(), 'GET', `Unexpected mutation ${req.method()} ${url.pathname}`);
        if (url.pathname === '/api/signals/v2') {
            if (intercept && await intercept(route, url)) return;
            return route.fulfill({ json: payload(url.searchParams.get('market') || market, url.searchParams.get('mode') || mode, state) });
        }
        if (url.pathname === '/api/owner/session') return route.fulfill({ json: { success: true, data: { configured: false, unlocked: false } } });
        if (url.pathname === '/api/signals/replay') return route.fulfill({ json: { success: true, data: { market, mode, enableSocial: true, summaries: [] } } });
        if (url.pathname === '/api/research/watchlist') return route.fulfill({ json: { success: true, data: [], archivedSymbols: [] } });
        report.errors.push(`Unexpected API ${url.pathname}`);
        return route.fulfill({ status: 404, json: { success: false, error: `Unexpected API ${url.pathname}` } });
    });
    await page.goto(`${base}/main-v8?market=${market}&mode=${mode}`, { waitUntil: 'domcontentloaded' });
    const brief = page.getByTestId('market-brief');
    if (state === 'no-input') await page.getByText('No observations. No market call.').waitFor();
    else await brief.waitFor();
    const label = mode === 'contrarian' ? 'Contrarian' : 'Momentum';
    const modeControl = page.getByRole('button', { name: label, exact: true });
    if (await modeControl.getAttribute('aria-pressed') !== 'true') {
        await Promise.all([page.waitForResponse(response => response.url().includes('/api/signals/v2?') && new URL(response.url()).searchParams.get('mode') === mode), modeControl.click()]);
        await brief.waitFor();
        if (state !== 'unavailable') await page.waitForFunction(name => document.querySelector('[data-testid="market-brief"]')?.textContent.includes(name), label);
    }
    assert.equal(await modeControl.getAttribute('aria-pressed'), 'true', `${label} mode selected`);
    return { context, page, brief };
}
try {
    for (const market of ['US', 'MY']) for (const mode of ['standard', 'contrarian']) for (const state of ['complete', 'missing', 'stale', 'unknown', 'unavailable']) {
        const { context, page, brief } = await open(market, mode, state, 1280, 'light');
        const status = await brief.getAttribute('data-status');
        const expected = state === 'unavailable' ? 'unavailable' : state === 'complete' && market === 'US' ? 'available' : 'limited';
        assert.equal(status, expected, `${market}/${mode}/${state}`);
        if (status === 'unavailable') assert.match(await page.getByRole('heading', { level: 1 }).getAttribute('class'), /tierNeutral/, 'Unavailable heading uses neutral styling');
        assert.equal(await brief.getAttribute('aria-label'), 'Latest Market Brief');
        assert.match(await brief.innerText(), /what changed/i);
        report.checks.push({ market, mode, state, status });
        await context.close();
    }
    {
        const { context, page, brief } = await open('US', 'standard', 'no-input', 1280, 'light');
        assert.equal(await brief.count(), 0);
        assert.equal(await page.getByTestId('connected-score').count(), 0);
        assert.match(await page.locator('body').innerText(), /No usable observations returned/i);
        report.checks.push({ scenario: 'no observations abstains' });
        await context.close();
    }
    for (const theme of ['light', 'dark']) for (const width of [1280, 768, 375, 320]) {
        const { context, page, brief } = await open('US', 'standard', 'complete', width, theme);
        const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
            clipped: [...document.querySelectorAll('[data-testid="market-brief"] button, [data-testid="market-brief"] summary')].filter(element => {
                const rect = element.getBoundingClientRect(); return rect.width && (rect.left < -1 || rect.right > innerWidth + 1);
            }).map(element => element.textContent.trim()) }));
        assert.ok(geometry.scrollWidth <= width + 1, `${theme}/${width}: page overflow ${JSON.stringify(geometry)}`);
        assert.deepEqual(geometry.clipped, [], `${theme}/${width}: clipped brief controls`);
        await brief.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${output}/${theme}-${width}.png`, fullPage: true });
        report.checks.push({ theme, width, geometry });
        await context.close();
    }
    {
        const { context, page, brief } = await open('US', 'standard', 'complete', 375, 'light');
        const summary = brief.locator('summary');
        await summary.focus(); await page.keyboard.press('Enter');
        assert.equal(await summary.locator('..').getAttribute('open'), '', 'Keyboard opens qualification details');
        assert.match(await summary.locator('..').innerText(), /observation date/i);
        const evidence = brief.locator('button[data-indicator]').first();
        assert.ok(await evidence.count(), 'Fresh evidence provides an inspector button');
        await evidence.focus(); await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', { name: 'Indicator detail' });
        await dialog.waitFor({ state: 'visible' });
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        assert.equal(await evidence.evaluate(element => document.activeElement === element), true, 'Inspector restores keyboard focus');
        const watch = brief.locator('li button').first();
        await watch.focus(); await page.keyboard.press('Enter');
        await dialog.waitFor({ state: 'visible' });
        await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
        assert.equal(await watch.evaluate(element => document.activeElement === element), true, 'Watch link restores keyboard focus');
        report.checks.push({ scenario: 'keyboard evidence, watch and qualification' });
        await context.close();
    }
    {
        const { context, page, brief } = await open('US', 'standard', 'persistence', 1280, 'light');
        assert.equal(await brief.getAttribute('data-status'), 'available', 'Snapshot persistence absence alone does not invalidate current evidence');
        assert.match(await page.getByRole('region', { name: 'Market assessment' }).innerText(), /retrieved.*snapshot date unavailable/i);
        assert.match(await brief.innerText(), /comparable earlier assessment.*unavailable/i);
        assert.match(await page.getByRole('region', { name: 'Explore indicators' }).innerText(), /Retrieved .+ UTC · select an observation for details/i, 'Evidence header identifies retrieval time');
        assert.doesNotMatch(await page.getByRole('region', { name: 'Explore indicators' }).innerText(), /freshness unknown/i, 'Retrieval reference date reaches evidence rows');
        report.checks.push({ scenario: 'missing snapshot and retrieval reference' });
        await context.close();
    }
    {
        const { context, page, brief } = await open('US', 'standard', 'missing', 375, 'light');
        const watch = brief.locator('li button').first();
        await watch.focus(); await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.activeElement?.matches('[data-inspecting]'));
        assert.equal(await page.getByRole('dialog', { name: 'Indicator detail' }).isVisible(), false, 'Missing input navigates to evidence, not a fabricated inspector');
        report.checks.push({ scenario: 'keyboard missing-input watch navigates to evidence' });
        await context.close();
    }
    {
        const { context, page, brief } = await open('US', 'standard', 'comparison', 375, 'light');
        const details = brief.getByRole('button', { name: /Change details/ });
        await details.focus(); await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.activeElement?.id === 'investigation-panel');
        assert.equal(await page.getByRole('tab', { name: 'What changed', exact: true }).getAttribute('aria-selected'), 'true');
        report.checks.push({ scenario: 'keyboard change details navigates to accounting' });
        await context.close();
    }
    {
        let release, started;
        const gate = new Promise(resolve => { release = resolve; });
        const pending = new Promise(resolve => { started = resolve; });
        const { context, page, brief } = await open('US', 'standard', 'complete', 1280, 'light', async (route, url) => {
            if (url.searchParams.get('market') !== 'MY') return false;
            started(); await gate;
            await route.fulfill({ json: payload('MY', url.searchParams.get('mode') || 'standard', 'complete') });
            return true;
        });
        await page.locator('#market-select').selectOption('MY');
        await pending;
        assert.equal(await brief.count(), 0, 'Previous market brief disappears while new market loads');
        release(); await brief.waitFor();
        assert.match(await brief.innerText(), /limited/i);
        await page.getByRole('button', { name: 'Contrarian', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[data-testid="market-brief"]')?.textContent.includes('Contrarian'));
        report.checks.push({ scenario: 'market loading and mode switching' });
        await context.close();
    }
    {
        const { context, page, brief } = await open('US', 'standard', 'complete', 1280, 'light', async (route, url) => {
            if (url.searchParams.get('market') !== 'MY') return false;
            await route.fulfill({ json: { success: false, error: 'Controlled invalid response' } });
            return true;
        });
        await page.locator('#market-select').selectOption('MY');
        const alert = page.getByRole('alert').filter({ hasText: 'No replacement score' });
        await alert.waitFor();
        assert.equal(await brief.count(), 0, 'Failed replacement does not show previous market brief');
        assert.match(await alert.innerText(), /No replacement score has been inferred/i);
        report.checks.push({ scenario: 'failed replacement' });
        await context.close();
    }
    assert.deepEqual(report.errors, [], 'Browser errors');
} catch (error) {
    report.failure = error.stack || String(error);
    process.exitCode = 1;
} finally {
    await browser.close();
    await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
}
if (report.failure) console.error(report.failure); else console.log(`Market brief QA: ${report.checks.length} checks passed; ${output}/report.json`);
