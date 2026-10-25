import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { researchReadFixture, researchSnapshotFixture } from './harness/research-read-fixture.mjs';

// Deterministic acceptance QA for the narrow-screen Research tab strip. It
// owns no server and intercepts every API request, including owner reads.
const configuredBase = process.env.SIGNAL_QA_URL ?? 'http://127.0.0.1:3000';
const baseUrl = new URL(configuredBase);
assert.ok(baseUrl.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(baseUrl.hostname)
    && baseUrl.pathname === '/' && !baseUrl.search && !baseUrl.hash, 'SIGNAL_QA_URL must be a local HTTP origin with no path, query, or hash');
const base = baseUrl.origin;
const baselineOnly = process.argv.includes('--before');
const evidenceRoot = `.tmp/research-tabs/${baselineOnly ? 'before' : 'after'}`;
const tabs = ['Overview', 'Chart & technicals', 'Financials', 'Thesis', 'Valuation', 'Review', 'Peers', 'Filings'];
const publicTabs = tabs.filter(tab => tab !== 'Thesis' && tab !== 'Review');
const viewports = [
    { width: 1280, height: 900 }, { width: 768, height: 900 },
    { width: 375, height: 844 }, { width: 320, height: 844 },
];
const themes = ['light', 'dark'];
const guestStorageKey = 'signal.guest-research.v1';
const fixture = await researchReadFixture();
const fixtureResponse = await fixture.route.GET();
assert.equal(fixtureResponse.status, 200, 'research read fixture must return a valid owner watchlist');
const ownerRecords = (await fixtureResponse.json()).data;
const report = { base, baselineOnly, checks: [], issues: [], scenarios: [] };
const check = (scenario, name, condition, detail = '') => {
    assert.ok(condition, `${name}${detail ? `: ${detail}` : ''}`);
    scenario.checks.push(name);
    report.checks.push(name);
};

function snapshot(symbol, market) {
    const payload = structuredClone(researchSnapshotFixture);
    payload.data.symbol = symbol;
    payload.data.market = market;
    payload.data.quote = { ...payload.data.quote, name: `${symbol} fixture security`, currency: market === 'MY' ? 'MYR' : 'USD' };
    return payload;
}

const filings = {
    success: true,
    data: {
        symbol: 'AAPL', cik: '0000320193', issuer: 'Apple fixture security', filings: [{
            accessionNumber: '0000320193-26-000105', form: '10-K', sourceKind: 'annual-report',
            filingDate: '2026-10-20', reportingPeriod: '2026-09-30', title: 'Fixture annual report (10-K)',
            sourceUrl: 'https://www.sec.gov/Archives/edgar/data/320193/fixture-10k.htm', providerLabel: 'SEC EDGAR',
        }],
    },
};

async function addFixtures(context, mode, state) {
    await context.route('**/api/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        state.requests.push({ method: request.method(), path: url.pathname, search: url.search });
        if (request.method() !== 'GET') {
            state.mutations.push(`${request.method()} ${url.pathname}`);
            return route.abort();
        }
        if (url.pathname === '/api/owner/session') return route.fulfill({ json: { success: true, data: { configured: true, unlocked: mode === 'saved' } } });
        if (url.pathname === '/api/research/watchlist') return route.fulfill({ json: { success: true, data: mode === 'saved' ? ownerRecords : [], archivedSymbols: [] } });
        if (url.pathname.startsWith('/api/research/symbol/')) {
            const symbol = decodeURIComponent(url.pathname.split('/').at(-1));
            return route.fulfill({ json: snapshot(symbol, url.searchParams.get('market') === 'MY' ? 'MY' : 'US') });
        }
        if (url.pathname.startsWith('/api/research/filings/')) return route.fulfill({ status: 200, json: filings });
        if (url.pathname.startsWith('/api/research/benchmark/')) return route.fulfill({ json: { success: true, data: snapshot('VOO', 'US').data.benchmark } });
        // A complete fixture boundary prevents accidental live reads while still
        // keeping unrelated, optional page reads deterministic.
        return route.fulfill({ json: { success: true, data: [] } });
    });
}

async function screenshot(page, scenario, label) {
    const navigation = page.getByTestId('research-tab-navigation');
    if (await navigation.count()) await navigation.scrollIntoViewIfNeeded();
    else await page.getByRole('tablist', { name: 'Research investigation' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${evidenceRoot}/${scenario.name}-${label}.png`, fullPage: false });
}

async function tabState(page) {
    return page.evaluate(() => {
        const navigation = document.querySelector('[data-testid="research-tab-navigation"]');
        const list = navigation?.querySelector('[role="tablist"]');
        const selected = list?.querySelector('[role="tab"][aria-selected="true"]');
        return {
            scrollY: window.scrollY,
            scrollLeft: list instanceof HTMLElement ? list.scrollLeft : -1,
            scrollWidth: list instanceof HTMLElement ? list.scrollWidth : -1,
            clientWidth: list instanceof HTMLElement ? list.clientWidth : -1,
            selected: selected?.textContent?.trim(),
            href: window.location.href,
        };
    });
}

async function assertGeometry(page, scenario, mobile, label) {
    const geometry = await page.evaluate(() => {
        const navigation = document.querySelector('[data-testid="research-tab-navigation"]');
        const list = navigation?.querySelector('[role="tablist"]');
        const selected = list?.querySelector('[role="tab"][aria-selected="true"]');
        const controls = [...(navigation?.querySelectorAll('button[aria-label^="Scroll research tabs"]') ?? [])];
        const rect = element => { const box = element.getBoundingClientRect(); return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height }; };
        const listRect = list ? rect(list) : null;
        const selectedRect = selected ? rect(selected) : null;
        return {
            viewport: innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            tabScrollWidth: list instanceof HTMLElement ? list.scrollWidth : -1,
            tabClientWidth: list instanceof HTMLElement ? list.clientWidth : -1,
            listRect, selectedRect,
            controls: controls.map(control => ({ ...rect(control), disabled: control.disabled, display: getComputedStyle(control).display })),
            maskImage: list ? getComputedStyle(list).maskImage : null,
        };
    });
    scenario.geometry.push({ label, ...geometry });
    check(scenario, 'document has no horizontal overflow', geometry.documentWidth <= geometry.viewport + 1, JSON.stringify(geometry));
    check(scenario, 'selected tab remains inside the visible tab strip', !!geometry.listRect && !!geometry.selectedRect
        && geometry.selectedRect.left >= geometry.listRect.left - 1 && geometry.selectedRect.right <= geometry.listRect.right + 1, JSON.stringify(geometry));
    check(scenario, 'tab strip has no CSS edge fade mask', !geometry.maskImage || geometry.maskImage === 'none', geometry.maskImage ?? '');
    if (mobile) {
        check(scenario, 'mobile controls appear only for an overflowing tab strip', geometry.tabScrollWidth > geometry.tabClientWidth
            && geometry.controls.length === 2 && geometry.controls.every(control => control.display !== 'none'), JSON.stringify(geometry));
        check(scenario, 'mobile scroll controls have 44px targets', geometry.controls.length === 2
            && geometry.controls.every(control => control.width >= 44 && control.height >= 44), JSON.stringify(geometry.controls));
        check(scenario, 'mobile scroll controls do not overlap each other', geometry.controls[0].right <= geometry.controls[1].left || geometry.controls[1].right <= geometry.controls[0].left, JSON.stringify(geometry.controls));
    } else check(scenario, 'desktop and tablet hide mobile scroll controls', geometry.controls.length === 2
        && geometry.controls.every(control => control.display === 'none'), JSON.stringify(geometry.controls));
}

async function open(page, query) {
    const response = await page.goto(`${base}/research-v8${query}`, { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200, `Research page must load for ${query}`);
    await page.getByRole('tablist', { name: 'Research investigation' }).waitFor({ state: 'visible' });
}

async function waitForReading(page, expectedTabs) {
    await page.getByTestId('research-price').waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
        const price = document.querySelector('[data-testid="research-price"]')?.textContent?.trim();
        return !!price && price !== 'Loading…';
    });
    await page.getByRole('tablist', { name: 'Research investigation' }).getByRole('tab').nth(expectedTabs.length - 1).waitFor({ state: 'visible' });
    await page.waitForFunction(expectedCount => document.querySelectorAll('[role="tablist"][aria-label="Research investigation"] [role="tab"]').length === expectedCount, expectedTabs.length);
}

async function scrollArrowToEdge(page, button, label) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
        if (await button.isDisabled()) return;
        const before = await tabState(page);
        await button.click();
        await page.waitForFunction(({ previous, name }) => {
            const list = document.querySelector('[data-testid="research-tab-navigation"] [role="tablist"]');
            const control = [...document.querySelectorAll('button')].find(item => item.getAttribute('aria-label') === name);
            if (!(list instanceof HTMLElement) || !control) return false;
            const atEdge = name.endsWith('right')
                ? list.scrollWidth - list.clientWidth - list.scrollLeft <= 1
                : list.scrollLeft <= 1;
            return (list.scrollLeft !== previous || control.disabled) && control.disabled === atEdge;
        }, { previous: before.scrollLeft, name: label }, { timeout: 1500 });
        const after = await tabState(page);
        assert.ok(after.scrollLeft !== before.scrollLeft || await button.isDisabled(), `${label} must scroll or reach its edge`);
    }
    assert.fail(`${label} did not reach its disabled edge after 12 clicks`);
}

async function touchScroll(page) {
    const point = await page.getByRole('tablist', { name: 'Research investigation' }).boundingBox();
    assert.ok(point, 'tab strip needs a bounding box for touch scrolling');
    const before = await tabState(page);
    try {
        const cdp = await page.context().newCDPSession(page);
        const x = point.x + point.width * 0.72;
        const y = point.y + point.height / 2;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - Math.min(140, point.width * 0.45), y, id: 1 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForFunction(previous => {
            const list = document.querySelector('[data-testid="research-tab-navigation"] [role="tablist"]');
            return list instanceof HTMLElement && list.scrollLeft > previous;
        }, before.scrollLeft, { timeout: 1500 });
        return 'Chromium CDP touch gesture scrolls the native tab strip';
    } catch {
        await page.getByRole('tablist', { name: 'Research investigation' }).evaluate(element => element.scrollBy({ left: 120 }));
        const after = await tabState(page);
        assert.ok(after.scrollLeft > before.scrollLeft, 'programmatic native scroll fallback must move the tab strip');
        return 'programmatic native scroll fallback remains available (not a touch-gesture proof)';
    }
}

async function runScenario(browser, viewport, theme, mode) {
    const scenario = { name: `${mode}-${theme}-${viewport.width}`, checks: [], issues: [], geometry: [] };
    report.scenarios.push(scenario);
    const state = { requests: [], mutations: [], errors: [], expectedWarnings: [] };
    const context = await browser.newContext({ viewport, colorScheme: theme, hasTouch: viewport.width <= 600, serviceWorkers: 'block', reducedMotion: 'reduce' });
    await context.addInitScript(({ themeChoice, isGuest, key }) => {
        // V8_THEME_STORAGE_KEY in src/components/v8/v8-theme.ts.
        localStorage.setItem('signal-v8-theme-v1', themeChoice);
        if (isGuest) localStorage.setItem(key, JSON.stringify({ version: 1, guestId: '29a44aab-3621-4c56-a891-8212a9c2f372', records: [] }));
    }, { themeChoice: theme, isGuest: mode === 'guest', key: guestStorageKey });
    await addFixtures(context, mode, state);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => state.errors.push(`pageerror: ${error.message}`));
    page.on('requestfailed', request => {
        const text = request.failure()?.errorText ?? '';
        if (!text.includes('ERR_ABORTED')) state.errors.push(`request: ${request.url()} ${text}`);
    });
    page.on('console', message => {
        if (!['error', 'warning'].includes(message.type())) return;
        // This is Playwright's exact injected warning when serviceWorkers is block.
        if (message.type() === 'warning' && message.text() === 'Service Worker registration blocked by Playwright') {
            state.expectedWarnings.push(message.text());
            return;
        }
        state.errors.push(`console ${message.type()}: ${message.text()}`);
    });
    try {
        const advanced = mode === 'saved';
        await open(page, `?ticker=AAPL&market=US&tab=overview${advanced ? '&advanced=1' : ''}`);
        const expectedTabs = advanced ? tabs : publicTabs;
        await waitForReading(page, expectedTabs);
        if (baselineOnly) {
            await screenshot(page, scenario, 'baseline-overview');
            check(scenario, 'baseline Research tablist is present', await page.getByRole('tablist', { name: 'Research investigation' }).count() === 1);
            return;
        }

        const renderedTabs = await page.getByRole('tablist', { name: 'Research investigation' }).getByRole('tab').allTextContents();
        check(scenario, `${mode} surface exposes its expected number of tabs`, renderedTabs.map(value => value.trim()).join('|') === expectedTabs.join('|'), renderedTabs.join('|'));
        check(scenario, 'tab navigation preserves the required data-testid', await page.getByTestId('research-tab-navigation').count() === 1);
        check(scenario, 'Overview tab retains its connected ID', await page.getByRole('tab', { name: 'Overview', exact: true }).getAttribute('id') === 'connected-tab-Overview');
        check(scenario, 'Chart tab retains its special connected ID', await page.getByRole('tab', { name: 'Chart & technicals', exact: true }).getAttribute('id') === 'connected-tab-Chart');
        const panel = page.locator('#connected-panel');
        check(scenario, 'selected tab and panel keep their ARIA association', await panel.getAttribute('aria-labelledby') === 'connected-tab-Overview'
            && await page.getByRole('tab', { name: 'Overview', exact: true }).getAttribute('aria-controls') === 'connected-panel');
        check(scenario, 'theme is applied to the fixture state', await page.locator('html').getAttribute('data-v8-theme') === theme);
        await screenshot(page, scenario, 'overview');

        const mobile = viewport.width <= 600;
        await assertGeometry(page, scenario, mobile, 'initial');
        if (mobile) {
            const left = page.getByRole('button', { name: 'Scroll research tabs left', exact: true });
            const right = page.getByRole('button', { name: 'Scroll research tabs right', exact: true });
            await left.waitFor({ state: 'visible' }); await right.waitFor({ state: 'visible' });
            check(scenario, 'left arrow begins disabled at the start edge', await left.isDisabled());
            const before = await tabState(page);
            const requestsBeforeArrows = state.requests.length;
            await scrollArrowToEdge(page, right, 'Scroll research tabs right');
            const afterRight = await tabState(page);
            check(scenario, 'right arrow reaches the trailing Filings tab', afterRight.scrollLeft > before.scrollLeft
                && await page.getByRole('tab', { name: 'Filings', exact: true }).evaluate((element, list) => {
                    const tab = element.getBoundingClientRect(); const strip = list.getBoundingClientRect(); return tab.left >= strip.left - 1 && tab.right <= strip.right + 1;
                }, await page.getByRole('tablist', { name: 'Research investigation' }).elementHandle()));
            check(scenario, 'scroll arrows do not select a tab or change its URL', afterRight.selected === before.selected && afterRight.href === before.href);
            check(scenario, 'scroll arrows do not fetch or mutate', state.requests.length === requestsBeforeArrows && state.mutations.length === 0);
            check(scenario, 'right arrow disables at the trailing edge', await right.isDisabled());
            await scrollArrowToEdge(page, left, 'Scroll research tabs left');
            check(scenario, 'left arrow returns to the leading edge', (await tabState(page)).scrollLeft === 0 && await left.isDisabled());
            const touchResult = await touchScroll(page);
            check(scenario, touchResult, true);
        }

        const first = page.getByRole('tab', { name: 'Overview', exact: true });
        await first.focus();
        const verticalBefore = await page.evaluate(() => ({ y: window.scrollY, max: Math.max(0, document.documentElement.scrollHeight - window.innerHeight) }));
        await page.keyboard.press('End');
        const last = expectedTabs.at(-1);
        await page.getByRole('tab', { name: last, exact: true }).waitFor({ state: 'visible' });
        const verticalAfter = await page.evaluate(() => ({ y: window.scrollY, max: Math.max(0, document.documentElement.scrollHeight - window.innerHeight) }));
        check(scenario, 'End selects and reveals the final tab', await page.getByRole('tab', { name: last, exact: true }).getAttribute('aria-selected') === 'true');
        if (verticalBefore.y <= verticalAfter.max) check(scenario, 'End reveal does not move the page vertically when the panel cannot clamp scroll', verticalAfter.y === verticalBefore.y, JSON.stringify({ verticalBefore, verticalAfter }));
        else check(scenario, 'End vertical comparison is clamped only because the selected panel shrank', verticalAfter.y === verticalAfter.max, JSON.stringify({ verticalBefore, verticalAfter }));
        await assertGeometry(page, scenario, mobile, 'keyboard-end');
        await page.keyboard.press('ArrowRight');
        check(scenario, 'ArrowRight wraps from the last tab to Overview', await first.getAttribute('aria-selected') === 'true'
            && await first.evaluate(element => element === document.activeElement));
        await page.keyboard.press('ArrowLeft');
        check(scenario, 'ArrowLeft wraps from Overview to the final tab', await page.getByRole('tab', { name: last, exact: true }).getAttribute('aria-selected') === 'true');
        await page.keyboard.press('Home');
        check(scenario, 'Home returns selection to Overview', await first.getAttribute('aria-selected') === 'true');

        const filing = page.getByRole('tab', { name: 'Filings', exact: true });
        await filing.click();
        await page.getByTestId('research-filings').waitFor({ state: 'visible' });
        check(scenario, 'tapping Filings selects the actual Filings panel and URL', new URL(page.url()).searchParams.get('tab') === 'filings'
            && await filing.getAttribute('aria-selected') === 'true');
        await assertGeometry(page, scenario, mobile, 'filings-click');
        await screenshot(page, scenario, 'filings');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForReading(page, expectedTabs);
        await page.getByTestId('research-filings').waitFor({ state: 'visible' });
        check(scenario, 'direct Filings URL survives reload', new URL(page.url()).searchParams.get('tab') === 'filings');
        await assertGeometry(page, scenario, mobile, 'filings-reload');
        // Tab selection intentionally replaces the current URL. Use direct tab
        // routes here so this proves browser history restoration separately.
        await open(page, `?ticker=AAPL&market=US&tab=overview${advanced ? '&advanced=1' : ''}`);
        await page.goBack();
        await waitForReading(page, expectedTabs);
        await page.getByTestId('research-filings').waitFor({ state: 'visible' });
        await assertGeometry(page, scenario, mobile, 'filings-history-back');
        await page.goForward();
        await waitForReading(page, expectedTabs);
        await page.getByRole('tab', { name: 'Overview', exact: true }).waitFor({ state: 'visible' });
        check(scenario, 'browser Back and Forward restore tab history', new URL(page.url()).searchParams.get('tab') === 'overview');

        await page.getByRole('tab', { name: last, exact: true }).focus();
        await page.keyboard.press('End');
        const resizeWidth = viewport.width <= 600 ? 768 : 375;
        await page.setViewportSize({ width: resizeWidth, height: viewport.height });
        await page.waitForTimeout(50);
        check(scenario, 'resize preserves and reveals the final selected tab', await page.getByRole('tab', { name: last, exact: true }).getAttribute('aria-selected') === 'true');
        await assertGeometry(page, scenario, resizeWidth <= 600, 'resize-final-tab');
        check(scenario, 'no mutations were sent by navigation', state.mutations.length === 0, state.mutations.join(', '));
        check(scenario, 'browser console and requests are clean apart from expected service-worker warnings', state.errors.length === 0, state.errors.join(' | '));
    } catch (error) {
        scenario.issues.push(String(error)); report.issues.push(`${scenario.name}: ${error}`);
        await screenshot(page, scenario, 'failure').catch(() => {});
        throw error;
    } finally {
        scenario.expectedWarnings = state.expectedWarnings;
        await context.close();
    }
}

await mkdir(evidenceRoot, { recursive: true });
let browser;
try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--no-sandbox'] });
    for (const viewport of viewports) for (const theme of themes) for (const mode of ['guest', 'saved']) await runScenario(browser, viewport, theme, mode);
    await writeFile(`${evidenceRoot}/report.json`, JSON.stringify(report, null, 2));
    console.log(`Research tab QA passed: ${report.checks.length} checks. Evidence: ${evidenceRoot}`);
} catch (error) {
    await writeFile(`${evidenceRoot}/report.json`, JSON.stringify({ ...report, failure: String(error) }, null, 2));
    throw error;
} finally {
    await browser?.close();
}
