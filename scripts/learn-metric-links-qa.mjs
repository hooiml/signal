import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { marketRequestFixture } from './harness/market-request-fixture.mjs';
import { researchSnapshotFixture } from './harness/research-read-fixture.mjs';

// This suite owns no server lifecycle. It only uses a localhost server supplied by the caller.
const argument = (name, fallback = null) => {
    const index = process.argv.indexOf(name);
    return index < 0 ? fallback : process.argv[index + 1] ?? fallback;
};
const baseUrl = argument('--base-url', process.env.SIGNAL_QA_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const before = process.argv.includes('--before');
const output = path.resolve(argument('--output', path.join('.tmp', 'learn-metric-links', before ? 'before' : 'after')));
const scenarioOption = process.argv.find(value => value.startsWith('--scenario='))?.slice('--scenario='.length) ?? argument('--scenario', 'all');
const timeoutMs = Number(process.env.SIGNAL_QA_TIMEOUT_MS ?? 15000);
const viewports = [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'tablet', width: 768, height: 900 },
    { name: 'mobile', width: 375, height: 812 },
    { name: 'narrow', width: 320, height: 812 },
];
const themes = ['light', 'dark'];
const concepts = [
    { id: 'rsi', pattern: /\bRSI\b/i },
    { id: 'pe', pattern: /P\/?E|price.to.earnings/i },
    { id: 'fcf-yield', pattern: /free cash flow|FCF/i },
    { id: 'put-call', pattern: /put\s*\/\s*call/i },
    { id: 'naaim', pattern: /NAAIM/i },
];
const tradingReplayFixture = {
    caseId: 'range-break-2024', replayId: 'learn-metric-links-fixture', symbol: 'EDU-A', timeframe: '15 minute', title: 'Fixture range boundary',
    contextKnownAsOf: '2024-04-18T12:15:00.000Z', context: 'Synthetic point-in-time lesson fixture.',
    candles: Array.from({ length: 12 }, (_, index) => ({
        openTime: new Date(Date.UTC(2024, 3, 18, 9, 30 + index * 15)).toISOString(), closeTime: new Date(Date.UTC(2024, 3, 18, 9, 45 + index * 15)).toISOString(),
        open: 100 + index / 10, high: 100.6 + index / 10, low: 99.2 + index / 10, close: 100.2 + index / 10, volume: 1000 + index * 100,
        knownAsOf: new Date(Date.UTC(2024, 3, 18, 9, 45 + index * 15)).toISOString(), future: false,
    })),
    execution: { spread: 0.04, slippage: 0.03, fee: 1, note: 'Illustrative fixture execution.' }, sourceNote: 'Controlled local fixture.',
};

assert.ok(['localhost', '127.0.0.1'].includes(new URL(baseUrl).hostname), 'Learn metric QA requires a local server.');
assert.ok(['all', 'matrix', 'links', 'navigation', 'boundary'].includes(scenarioOption), `Unknown --scenario=${scenarioOption}`);
await mkdir(output, { recursive: true });

const report = {
    command: 'node scripts/learn-metric-links-qa.mjs',
    mode: before ? 'before' : 'after',
    baseUrl,
    fixtureOnly: true,
    scenarios: [],
    fatalError: null,
};
const check = (scenario, name, condition, details = '') => {
    scenario.checks.push({ name, status: condition ? 'passed' : 'failed', details });
    assert.ok(condition, `${name}${details ? `: ${details}` : ''}`);
};
const pageOverflow = page => page.evaluate(() => Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - innerWidth);
const sourceUrl = (route, concept) => `${baseUrl}${route}?concept=${encodeURIComponent(concept)}`;

function snapshotFor(symbol, market) {
    const fixture = structuredClone(researchSnapshotFixture);
    fixture.data.symbol = symbol;
    fixture.data.market = market === 'MY' ? 'MY' : 'US';
    fixture.data.quote = { ...fixture.data.quote, name: 'Fixture Apple', price: 200 };
    fixture.data.technicals = { ...fixture.data.technicals, rsi14: 52.4 };
    fixture.data.valuation = { ...fixture.data.valuation, priceEarnings: 24.3, freeCashFlowYieldPercent: 3.6, marketCap: 500000000000 };
    return fixture;
}

async function installFixtures(context, observations) {
    await context.route('**/api/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        observations.requests.push({ method: request.method(), path: `${url.pathname}${url.search}` });
        if (request.method() !== 'GET') {
            observations.mutations.push({ method: request.method(), path: `${url.pathname}${url.search}` });
            return route.abort('blockedbyclient');
        }
        if (url.pathname === '/api/signals/v2') {
            const fixture = marketRequestFixture({ providerReadings: {
                putCallRatio: { ratio: 0.82, reportDate: '2026-09-11', retrievedAt: '2026-09-12T00:00:00.000Z', source: 'cboe-daily-market-statistics', sourceUrl: 'https://fixture.invalid/cboe' },
                naaimExposure: { exposure: 67, reportDate: '2026-09-11', retrievedAt: '2026-09-12T00:00:00.000Z', source: 'naaim-exposure-index', sourceUrl: 'https://fixture.invalid/naaim' },
            } });
            const response = await fixture.route.GET(fixture.request(url.search.slice(1)));
            return route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
        }
        if (url.pathname === '/api/signals/replay') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: { market: url.searchParams.get('market') ?? 'US', mode: url.searchParams.get('mode') ?? 'standard', enableSocial: url.searchParams.get('enableSocial') === 'true', summaries: [] } }) });
        if (url.pathname.startsWith('/api/learn/trading-replay/')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: tradingReplayFixture }) });
        if (url.pathname.startsWith('/api/research/symbol/')) {
            return route.fulfill({ contentType: 'application/json', body: JSON.stringify(snapshotFor(decodeURIComponent(url.pathname.split('/').at(-1)), url.searchParams.get('market'))) });
        }
        if (url.pathname === '/api/owner/session') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: { authenticated: false } }) });
        if (url.pathname === '/api/research/watchlist') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
        return route.abort('blockedbyclient');
    });
}

function observe(page, scenario) {
    page.on('console', message => {
        if (message.type() === 'error') scenario.issues.push({ type: 'console-error', message: message.text() });
    });
    page.on('pageerror', error => scenario.issues.push({ type: 'page-error', message: error.message }));
    page.on('requestfailed', request => {
        if (request.failure()?.errorText === 'net::ERR_ABORTED') return;
        if (!request.url().includes('/api/') || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) {
            scenario.issues.push({ type: 'request-failed', message: `${request.method()} ${request.url()}` });
        }
    });
}

async function selectTheme(page, theme) {
    await page.getByTestId('learn-shell').waitFor();
    const control = page.getByRole('radio', { name: theme === 'light' ? 'Light' : 'Dark' });
    // Force the explicit choice through the real control even when Auto currently resolves to it.
    if (await control.isChecked()) await page.getByRole('radio', { name: theme === 'light' ? 'Dark' : 'Light' }).check();
    await control.check();
    await page.waitForFunction(expected => document.documentElement.dataset.v8Theme === expected, theme);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('learn-shell').waitFor();
    await page.waitForFunction(expected => document.documentElement.dataset.v8Theme === expected, theme);
}

async function prepareMetricSource(page, route, concept) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    if (route.startsWith('/research') && concept.id !== 'rsi') await page.getByRole('tab', { name: /^Valuation/ }).click();
    if (route.startsWith('/main')) {
        const indicator = page.locator(`button[data-indicator="${concept.id === 'put-call' ? 'put_call' : 'naaim'}"]`).first();
        const showAll = page.getByRole('button', { name: /Show all/i });
        if (!(await indicator.isVisible().catch(() => false)) && await showAll.isVisible().catch(() => false)) await showAll.click();
        await indicator.click();
    }
}

async function assertMetricAnchors(page, scenario, route, routeConcepts) {
    for (const concept of routeConcepts) {
        await prepareMetricSource(page, route, concept);
        const anchor = page.locator(`a[href="/learn?concept=${concept.id}"]:visible`).first();
        await anchor.waitFor();
        check(scenario, `${route} publishes ${concept.id} lesson link`, await anchor.count() === 1);
        check(scenario, `${concept.id} opens in a separate tab`, await anchor.getAttribute('target') === '_blank');
        const rel = (await anchor.getAttribute('rel')) ?? '';
        check(scenario, `${concept.id} tab is protected`, rel.includes('noopener') && rel.includes('noreferrer'), rel);
        check(scenario, `${concept.id} has accessible new-tab wording`, /^Learn about .+ \(opens in a new tab\)$/.test((await anchor.getAttribute('aria-label')) ?? ''));
        if (route.startsWith('/main')) check(scenario, `${concept.id} link is in the market indicator inspector heading`, await anchor.evaluate(element => element.parentElement?.tagName === 'H2'));
    }
}

async function assertDisplayedLearnTarget(page, scenario, concept) {
    await page.getByTestId('learn-shell').waitFor();
    await page.evaluate(() => document.fonts.ready);
    if (concept.id === 'rsi') {
        const lesson = page.getByTestId('trading-concept');
        await lesson.waitFor();
        const selectedControls = await page.locator('button[aria-pressed="true"]').allTextContents();
        check(scenario, 'rsi query selects the Momentum module', selectedControls.some(text => /Momentum/i.test(text)), JSON.stringify(selectedControls));
        check(scenario, 'rsi query renders the Momentum concept heading', await lesson.getByRole('heading', { name: 'Momentum' }).count() === 1);
    } else if (concept.id === 'pe') {
        // The query-selected lesson renders after hydration; wait before reading it.
        await page.getByRole('heading', { name: 'P/E ratio' }).waitFor();
        check(scenario, 'pe query selects the P/E module', await page.getByRole('button', { name: /P\/E ratio/ }).getAttribute('aria-pressed') === 'true');
        check(scenario, 'pe query renders the P/E lesson heading', await page.getByRole('heading', { name: 'P/E ratio' }).count() === 1);
    } else if (concept.id === 'fcf-yield') {
        check(scenario, 'fcf-yield query selects FCF yield in the valuation lab', await page.getByLabel('Preferred valuation metric').inputValue() === 'fcf-yield');
    } else if (concept.id === 'put-call') {
        await page.getByRole('heading', { name: 'Put/call volume ratio' }).waitFor();
        check(scenario, 'put-call query renders the exact market lesson heading', await page.getByRole('heading', { name: 'Put/call volume ratio' }).count() === 1);
    } else {
        await page.getByRole('heading', { name: 'NAAIM Exposure Index' }).waitFor();
        check(scenario, 'naaim query renders the exact market lesson heading', await page.getByRole('heading', { name: 'NAAIM Exposure Index' }).count() === 1);
    }
}

async function navigateAndAssertLearnTarget(page, scenario, concept) {
    await page.goto(sourceUrl('/learn', concept.id), { waitUntil: 'domcontentloaded' });
    await assertDisplayedLearnTarget(page, scenario, concept);
}

async function captureBaseline(browser) {
    const scenario = { name: 'pre-change capture', checks: [], issues: [], snapshots: [], status: 'failed' };
    report.scenarios.push(scenario);
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    const observations = { requests: [], mutations: [] };
    scenario.requests = observations.requests;
    scenario.mutations = observations.mutations;
    await installFixtures(context, observations);
    const page = await context.newPage(); page.setDefaultTimeout(timeoutMs); observe(page, scenario);
    try {
        for (const [name, url] of [['learn', '/learn'], ['research', '/research-v8?ticker=AAPL&market=US'], ['market', '/main-v8?market=US']]) {
            await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded' });
            await page.screenshot({ path: path.join(output, `${name}-before.png`), fullPage: true });
            scenario.snapshots.push({ name, url: page.url(), text: (await page.locator('body').innerText()).slice(0, 1200) });
        }
        check(scenario, 'baseline capture made no API writes', observations.mutations.length === 0, JSON.stringify(observations.mutations));
        scenario.status = 'passed';
    } catch (error) {
        scenario.issues.push({ type: 'blocking', message: error instanceof Error ? error.message : String(error) });
    } finally { await context.close(); }
}

async function runAfter(browser, viewport, theme) {
    const scenario = { name: `${viewport.name} ${theme}`, viewport: `${viewport.width}x${viewport.height}`, theme, checks: [], issues: [], screenshots: [], status: 'failed' };
    report.scenarios.push(scenario);
    console.log(JSON.stringify({ event: 'scenario-start', name: scenario.name }));
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, serviceWorkers: 'block' });
    const observations = { requests: [], mutations: [] };
    await installFixtures(context, observations);
    await context.addInitScript(origin => {
        // A noopener popup briefly has an opaque about:blank origin with no storage access.
        if (location.origin !== origin) return;
        if (!localStorage.getItem('signal-learn-v0.4-progress')) localStorage.setItem('signal-learn-v0.4-progress', JSON.stringify({ version: 4, completedModules: ['price-structure'], completedWorkspaces: [] }));
    }, new URL(baseUrl).origin);
    const page = await context.newPage(); page.setDefaultTimeout(timeoutMs); observe(page, scenario);
    try {
        await page.goto(`${baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
        await selectTheme(page, theme);
        check(scenario, 'Learn uses the V8 shell', await page.getByTestId('learn-shell').count() === 1);
        check(scenario, 'requested V8 theme is applied to the document', await page.locator('html').getAttribute('data-v8-theme') === theme);
        check(scenario, 'Learn starts on the trading course without a metric query', await page.getByRole('button', { name: 'Trading process v0.4' }).getAttribute('aria-pressed') === 'true');
        const metricNav = page.getByRole('navigation', { name: 'Metric lessons' });
        check(scenario, 'Learn exposes all five same-tab metric lessons', await metricNav.locator('a').count() === concepts.length);
        check(scenario, 'Learn metric navigation does not open a separate tab', await metricNav.locator('a').evaluateAll(links => links.every(link => !link.getAttribute('target'))));
        check(scenario, 'Learn page has no horizontal overflow', await pageOverflow(page) <= 1, `${await pageOverflow(page)}px`);
        await assertMetricAnchors(page, scenario, '/research-v8?ticker=AAPL&market=US', concepts.slice(0, 3));
        await assertMetricAnchors(page, scenario, '/main-v8?market=US', concepts.slice(3));
        check(scenario, 'V8 source pages have no horizontal overflow', await pageOverflow(page) <= 1, `${await pageOverflow(page)}px`);
        if (viewport.width >= 375) {
            for (const [name, route, concept] of [
                ['research-rsi', '/research-v8?ticker=AAPL&market=US', concepts[0]],
                ['research-valuation', '/research-v8?ticker=AAPL&market=US', concepts[1]],
                ['market-put-call-inspector', '/main-v8?market=US', concepts[3]],
            ]) {
                await prepareMetricSource(page, route, concept);
                const file = path.join(output, `${name}-${viewport.width}-${theme}.png`);
                await page.screenshot({ path: file, fullPage: true });
                scenario.screenshots.push(file);
            }
        }

        if (viewport.width === 1280 && theme === 'light') {
            await page.goto(`${baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
            await selectTheme(page, theme);
            const palette = page.getByRole('dialog', { name: 'Signal command palette' });
            // The shortcut listener attaches on hydration, which can trail domcontentloaded on slow runners.
            for (let attempt = 0; attempt < 10 && !(await palette.isVisible()); attempt += 1) {
                await page.keyboard.press('Control+k');
                await palette.waitFor({ timeout: 1500 }).catch(() => {});
            }
            await palette.waitFor();
            await palette.getByRole('option', { name: 'Use dark theme' }).click();
            await page.waitForFunction(() => document.documentElement.dataset.v8Theme === 'dark');
            check(scenario, 'Ctrl+K theme command changes the saved V8 theme', await page.locator('html').getAttribute('data-v8-theme') === 'dark');
            await selectTheme(page, 'light');
            await page.waitForFunction(() => document.querySelector('[data-testid="trading-mastery"]')?.textContent?.includes('1/16'));
            const initialProgress = await page.getByTestId('trading-mastery').innerText();
            check(scenario, 'seeded existing trading completion is displayed before metric navigation', initialProgress.includes('1/16'));
            for (const concept of concepts) {
                const sourceRoute = ['put-call', 'naaim'].includes(concept.id) ? '/main-v8?market=US' : '/research-v8?ticker=AAPL&market=US';
                await prepareMetricSource(page, sourceRoute, concept);
                const source = page.url();
                const anchor = page.locator(`a[href="/learn?concept=${concept.id}"]`).first();
                const popupPromise = context.waitForEvent('page');
                await anchor.click();
                const lesson = await popupPromise;
                observe(lesson, scenario);
                lesson.setDefaultTimeout(timeoutMs);
                await lesson.waitForLoadState('domcontentloaded');
                check(scenario, `${concept.id} link leaves its source tab unchanged`, page.url() === source, `${page.url()} != ${source}`);
                check(scenario, `${concept.id} link opens the correct Learn URL`, new URL(lesson.url()).pathname === '/learn' && new URL(lesson.url()).searchParams.get('concept') === concept.id, lesson.url());
                check(scenario, `${concept.id} new tab has no browser opener`, await lesson.evaluate(() => window.opener === null));
                await lesson.getByTestId('learn-shell').waitFor();
                await assertDisplayedLearnTarget(lesson, scenario, concept);
                await lesson.close();
            }
            await page.goto(`${baseUrl}/learn?concept=rsi`, { waitUntil: 'domcontentloaded' });
            await page.reload({ waitUntil: 'domcontentloaded' });
            await assertDisplayedLearnTarget(page, scenario, concepts[0]);
            await page.getByRole('navigation', { name: 'Metric lessons' }).getByRole('link', { name: 'P/E' }).click();
            await page.waitForURL(url => url.searchParams.get('concept') === 'pe');
            check(scenario, 'metric lesson navigation changes the current Learn tab', new URL(page.url()).searchParams.get('concept') === 'pe');
            await page.goBack({ waitUntil: 'domcontentloaded' });
            await assertDisplayedLearnTarget(page, scenario, concepts[0]);
            await page.goForward({ waitUntil: 'domcontentloaded' });
            await assertDisplayedLearnTarget(page, scenario, concepts[1]);
            for (const query of ['invalid', 'rsi&concept=pe']) {
                await page.goto(`${baseUrl}/learn?concept=${query}`, { waitUntil: 'domcontentloaded' });
                check(scenario, `invalid or repeated concept ${query} falls back to trading`, await page.getByRole('button', { name: 'Trading process v0.4' }).getAttribute('aria-pressed') === 'true');
            }
            await page.goto(`${baseUrl}/learn?concept=put-call`, { waitUntil: 'domcontentloaded' });
            // A fill that lands before hydration is reset by React; refill until the recomputed ratio shows.
            const undefinedRatio = page.locator('main').getByText('Undefined').first();
            for (let attempt = 0; attempt < 10 && !(await undefinedRatio.isVisible()); attempt += 1) {
                await page.getByLabel('Illustrative call option volume').fill('0');
                await undefinedRatio.waitFor({ timeout: 1500 }).catch(() => {});
            }
            check(scenario, 'put/call lesson marks a zero denominator undefined', (await page.locator('main').innerText()).includes('Undefined'));
            await page.goto(`${baseUrl}/learn?concept=naaim`, { waitUntil: 'domcontentloaded' });
            const naaimSlider = page.getByLabel('Hypothetical manager equity exposure');
            await naaimSlider.focus();
            await page.keyboard.press('Home');
            for (let index = 0; index < 40; index += 1) await page.keyboard.press('ArrowRight');
            await page.getByText('At 0%, this example represents cash or market-neutral exposure in this simplified example.').waitFor();
            check(scenario, 'NAAIM lesson explains the keyboard-selected neutral boundary', await naaimSlider.inputValue() === '0');
            await page.getByRole('button', { name: 'Investment analysis v0.3' }).click();
            await page.getByTestId('learn-v0-3').waitFor();
            await page.getByRole('button', { name: 'Trading process v0.4' }).click();
            await page.getByTestId('trading-mastery').waitFor();
            await page.waitForFunction(() => document.querySelector('[data-testid="trading-mastery"]')?.textContent?.includes('1/16'));
            check(scenario, 'existing course switching preserves trading progress', await page.getByTestId('trading-mastery').innerText() === initialProgress);
            check(scenario, 'metric navigation does not alter the seeded completed state', (await page.getByTestId('trading-mastery').innerText()).includes('1/16'));
        }
        for (const concept of concepts) {
            await navigateAndAssertLearnTarget(page, scenario, concept);
            check(scenario, `${concept.id} lesson has no horizontal overflow`, await pageOverflow(page) <= 1, `${await pageOverflow(page)}px`);
        }
        if (viewport.width >= 375) {
            await page.goto(`${baseUrl}/learn?concept=put-call`, { waitUntil: 'domcontentloaded' });
            await selectTheme(page, theme);
            const file = path.join(output, `learn-metric-links-${viewport.width}-${theme}.png`);
            await page.screenshot({ path: file, fullPage: true });
            scenario.screenshots.push(file);
        }
        await page.goto(`${baseUrl}/learn?concept=rsi`, { waitUntil: 'domcontentloaded' });
        // Focus only after the query-selected lesson renders, so hydration cannot steal it.
        await page.getByTestId('trading-concept').waitFor();
        const focusTarget = page.getByRole('button', { name: 'Trading process v0.4' });
        await focusTarget.focus();
        check(scenario, 'keyboard focus reaches an in-viewport Learn control', await focusTarget.evaluate(element => { const rect = element.getBoundingClientRect(); return document.activeElement === element && rect.left >= 0 && rect.right <= innerWidth; }));
        check(scenario, 'fixture run made no API writes', observations.mutations.length === 0, JSON.stringify(observations.mutations));
        check(scenario, 'browser has no blocking errors', scenario.issues.length === 0, JSON.stringify(scenario.issues));
        scenario.status = 'passed';
    } catch (error) {
        scenario.issues.push({ type: 'blocking', message: error instanceof Error ? error.message : String(error) });
        const safeName = scenario.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        const screenshot = path.join(output, `${safeName}-failure.png`);
        await page.screenshot({ path: screenshot, fullPage: true }).then(() => scenario.screenshots.push(screenshot)).catch(() => undefined);
        const dom = path.join(output, `${safeName}-failure.txt`);
        await writeFile(dom, await page.locator('body').innerText().catch(() => '')).catch(() => undefined);
    } finally {
        scenario.requests = observations.requests;
        scenario.mutations = observations.mutations;
        await context.close();
        console.log(JSON.stringify({ event: 'scenario-complete', name: scenario.name, status: scenario.status, issues: scenario.issues }));
    }
}

let browser;
try {
    browser = await chromium.launch({ headless: true });
    if (before) await captureBaseline(browser);
    else {
        const selectedViewports = scenarioOption === 'all' || scenarioOption === 'matrix' ? viewports : [viewports[0]];
        const selectedThemes = scenarioOption === 'all' || scenarioOption === 'matrix' ? themes : ['light'];
        for (const theme of selectedThemes) for (const viewport of selectedViewports) await runAfter(browser, viewport, theme);
    }
} catch (error) {
    report.fatalError = error instanceof Error ? error.message : String(error);
} finally {
    if (browser) await browser.close();
    report.status = report.fatalError || report.scenarios.some(scenario => scenario.status !== 'passed') ? 'failed' : 'passed';
    await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ status: report.status, mode: report.mode, output, scenarios: report.scenarios.map(({ name, status, issues }) => ({ name, status, issues })), fatalError: report.fatalError }, null, 2));
if (report.status !== 'passed') process.exitCode = 1;
