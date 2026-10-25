import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { marketRequestFixture } from './harness/market-request-fixture.mjs';
import { researchReadFixture, researchSnapshotFixture } from './harness/research-read-fixture.mjs';

const base = process.env.SIGNAL_QA_URL ?? 'http://127.0.0.1:3000';
const out = path.join('.tmp', 'legacy-routes', `qa-${Date.now()}`);
const timeout = 20_000;
const widths = (process.env.SIGNAL_QA_VIEWPORTS ?? '1280,768,375').split(',').map(Number);
const marketAliases = ['/main-v2', '/main-v4', '/main-v5', '/main-v6', '/main-v7', '/backup/main'];
const researchAliases = ['/research-v2', '/research-v4', '/research-v5', '/research-v6', '/research-v7', '/backup/research'];
const toolHashes = ['drivers-title', 'market-trust-limitations', 'market-score-sensitivity-title', 'historical-calibration', 'market-alerts-title', 'market-context-title', 'market-watchlist-exposure-title', 'score-evidence-title'];
const report = { command: 'node scripts/legacy-routes-qa.mjs', base, fixtureOnly: true, checks: [], errors: [], requestFailures: [], mutations: [] };

const url = (pathname) => new URL(pathname, base).toString();
const skippedTour = JSON.stringify({ version: 1, stage: 'skipped', revision: 0 });

function check(name, condition, detail = '') {
    assert.ok(condition, `${name}${detail ? `: ${detail}` : ''}`);
    report.checks.push(name);
}

async function rawRedirect(pathname, expected) {
    const response = await fetch(url(pathname), { redirect: 'manual' });
    assert.equal(response.status, 307, `${pathname} must issue a raw HTTP 307`);
    const redirected = new URL(response.headers.get('location') ?? '', base);
    assert.equal(`${redirected.pathname}${redirected.search}`, expected, `${pathname} must change only the pathname`);
    report.checks.push(`HTTP 307 ${pathname} -> ${expected}`);
}

async function installFixtures(context) {
    const market = marketRequestFixture();
    const research = researchReadFixture();
    const watchlist = await (await research.route.GET()).json();
    await context.route('**/api/**', async route => {
        const request = route.request();
        const requestUrl = new URL(request.url());
        const method = request.method();
        if (requestUrl.pathname === '/api/owner/session') return route.fulfill({ json: { success: true, data: { configured: true, unlocked: true } } });
        if (requestUrl.pathname === '/api/signals/replay') return route.fulfill({ json: { success: true, data: {
            market: requestUrl.searchParams.get('market') ?? 'US', mode: requestUrl.searchParams.get('mode') ?? 'standard',
            enableSocial: requestUrl.searchParams.get('enableSocial') !== 'false', summaries: [],
        } } });
        if (requestUrl.pathname === '/api/research/quotes' && method === 'POST') {
            const inputs = request.postDataJSON();
            const items = Array.isArray(inputs) ? inputs.map(({ symbol, market }) => {
                const snapshot = structuredClone(researchSnapshotFixture);
                snapshot.data.symbol = symbol;
                snapshot.data.market = market;
                snapshot.data.quote = { ...snapshot.data.quote, name: `Fixture ${symbol}`, currency: market === 'MY' ? 'MYR' : 'USD' };
                return { success: true, data: { symbol, market, providerSymbol: symbol, fetchedAt: snapshot.data.fetchedAt, quote: snapshot.data.quote } };
            }) : [];
            return route.fulfill({ json: { success: true, data: { fetchedAt: researchSnapshotFixture.data.fetchedAt, items } } });
        }
        if (requestUrl.pathname === '/api/research/calendar' && method === 'POST') return route.fulfill({ json: { success: true, data: {
            generatedAt: researchSnapshotFixture.data.fetchedAt, rangeDays: requestUrl.searchParams.get('range') === '90' ? 90 : 30,
            timezone: 'UTC', events: [], macroEvents: [], warnings: [],
        } } });
        if (requestUrl.pathname === '/api/research/alerts' && method === 'POST') return route.fulfill({ json: { success: true, data: {
            generatedAt: researchSnapshotFixture.data.fetchedAt, monitoredCount: 1, alerts: [], triggerCoverage: [], warnings: [],
        } } });
        if (method !== 'GET') {
            report.mutations.push(`${method} ${requestUrl.pathname}`);
            return route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Mutation forbidden by legacy-route QA.' }) });
        }
        if (requestUrl.pathname === '/api/signals/v2') {
            const response = await market.route.GET(market.request(requestUrl.search.slice(1)));
            return route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
        }
        if (requestUrl.pathname === '/api/research/watchlist') return route.fulfill({ json: watchlist });
        if (requestUrl.pathname.startsWith('/api/research/symbol/')) {
            const symbol = decodeURIComponent(requestUrl.pathname.split('/').at(-1) ?? 'AAPL');
            const marketName = requestUrl.searchParams.get('market') ?? 'US';
            const snapshot = structuredClone(researchSnapshotFixture);
            snapshot.data.symbol = symbol;
            snapshot.data.market = marketName;
            snapshot.data.quote = { ...snapshot.data.quote, name: `Fixture ${symbol}`, currency: marketName === 'MY' ? 'MYR' : 'USD' };
            return route.fulfill({ json: snapshot });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
    });
}

async function waitForHydration(page, selector) {
    await page.locator(selector).first().waitFor({ state: 'visible', timeout });
    await page.waitForFunction(() => document.readyState === 'complete');
}

async function assertNoUiFaults(page, label) {
    const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
    check(`${label} has no horizontal overflow`, overflow <= 1, String(overflow));
}

async function assertWorkspaceNavigation(page, width) {
    const nav = page.getByRole('navigation', { name: 'Workspace views', exact: true });
    const reading = nav.getByRole('link', { name: 'Reading view', exact: true });
    const advanced = nav.getByRole('link', { name: 'Advanced tools', exact: true });
    await nav.waitFor({ state: 'visible', timeout });
    const hrefs = Object.fromEntries(await Promise.all([reading, advanced].map(async link => [await link.innerText(), await link.getAttribute('href')])));
    const expected = {
        market: ['MY', 'US'], mode: 'contrarian', enableSocial: 'false', unknown: 'safe', hash: '#plain-fragment',
    };
    for (const [label, target] of Object.entries(hrefs)) {
        const destination = new URL(target, base);
        assert.deepEqual(destination.searchParams.getAll('market'), expected.market, `${label} retains repeated market context`);
        assert.equal(destination.searchParams.get('mode'), expected.mode, `${label} retains mode context`);
        assert.equal(destination.searchParams.get('enableSocial'), expected.enableSocial, `${label} retains social context`);
        assert.equal(destination.searchParams.get('unknown'), expected.unknown, `${label} retains unknown safe key`);
        assert.equal(destination.hash, expected.hash, `${label} retains generic fragment`);
    }
    assert.equal(await reading.getAttribute('aria-current'), 'page', 'Reading view is current on V8 Market');
    assert.equal(await advanced.getAttribute('aria-current'), null, 'Advanced tools is not current on V8 Market');
    const boxes = await nav.getByRole('link').evaluateAll(nodes => nodes.map(node => {
        const box = node.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    }));
    const footer = await nav.evaluate(node => node.className.includes('footer'));
    const minimum = width <= 600 ? 44 : footer ? 36 : 40;
    check(`${width}px ${footer ? 'footer' : 'top'} workspace links meet the ${minimum}px target contract`, boxes.every(box => box.height >= minimum && box.width >= minimum), JSON.stringify(boxes));
    check(`${width}px workspace links do not overlap`, boxes.every((box, index) => !index || box.left >= boxes[index - 1].right), JSON.stringify(boxes));
    await nav.screenshot({ path: path.join(out, `workspace-navigation-${width}.png`) });
    await advanced.focus();
    assert.equal(await advanced.evaluate(node => getComputedStyle(node).outlineWidth), '3px', 'keyboard focus gets the visible focus outline');
    const popupPromise = page.context().waitForEvent('page', { timeout });
    await advanced.click({ button: 'middle' });
    const popup = await popupPromise;
    try {
        await popup.waitForURL(candidate => new URL(candidate).pathname === '/market/tools', { timeout });
        const opened = new URL(popup.url());
        assert.equal(opened.pathname, '/market/tools', 'middle-click opens Advanced tools');
        assert.deepEqual(opened.searchParams.getAll('market'), expected.market, 'middle-click retains repeated market context');
        assert.equal(opened.hash, expected.hash, 'middle-click retains generic fragment');
    } finally { await popup.close(); }
    await Promise.all([waitForRoute(page, '/market/tools', { market: 'MY', mode: 'contrarian', enableSocial: 'false', unknown: 'safe' }, '#plain-fragment'), advanced.press('Enter')]);
    const activeTools = page.getByRole('navigation', { name: 'Workspace views', exact: true }).getByRole('link', { name: 'Advanced tools', exact: true });
    assert.equal(await activeTools.getAttribute('aria-current'), 'page', 'Advanced tools is current after keyboard activation');
    check(`${width}px Workspace navigation retains href state, focus, Enter activation, and middle-click context`, true);
}

const routeMatches = (candidate, pathname, entries = {}, hash = undefined) => {
    const current = new URL(candidate);
    return current.pathname === pathname
        && Object.entries(entries).every(([key, value]) => current.searchParams.get(key) === value)
        && (hash === undefined || current.hash === hash);
};

const waitForRoute = (page, pathname, entries = {}, hash = undefined) => page.waitForURL(
    candidate => routeMatches(candidate, pathname, entries, hash), { timeout },
);

await mkdir(out, { recursive: true });
try {
    // The raw table deliberately exercises every alias before a browser sees the route.
    for (const pathname of ['/', ...marketAliases]) {
        await rawRedirect(pathname, '/main-v8');
        await rawRedirect(`${pathname}?market=MY&market=US&ticker=AAPL&ticker=MSFT&unknown=safe`, '/main-v8?market=MY&market=US&ticker=AAPL&ticker=MSFT&unknown=safe');
        await rawRedirect(`${pathname}?workspace=today&contextPanel=briefing&unknown=safe`, '/main-v8?workspace=today&contextPanel=briefing&unknown=safe');
    }
    for (const pathname of researchAliases) {
        await rawRedirect(pathname, '/research-v8');
        await rawRedirect(`${pathname}?ticker=AAPL&market=US&unknown=safe`, '/research-v8?ticker=AAPL&market=US&unknown=safe');
        await rawRedirect(`${pathname}?workspace=today&queueTask=task-1&contextPanel=briefing&unknown=safe`, '/research?workspace=today&queueTask=task-1&contextPanel=briefing&unknown=safe');
    }
    const canonicalAdvanced = await fetch(url('/research?workspace=today'), { redirect: 'manual' });
    assert.notEqual(canonicalAdvanced.status, 307, 'canonical advanced Research must not redirect to itself');
    report.checks.push('canonical advanced Research has no redirect loop');

    const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--no-sandbox'] });
    try {
        for (const width of widths) {
            const context = await browser.newContext({ viewport: { width, height: width === 375 ? 812 : 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
            await context.addInitScript((value) => localStorage.setItem('signal-v8-first-visit-v1', value), skippedTour);
            await installFixtures(context);
            const page = await context.newPage();
            page.setDefaultTimeout(timeout);
            page.on('pageerror', error => report.errors.push(`${width}: ${error.message}`));
            page.on('console', message => { if (message.type() === 'error') report.errors.push(`${width}: ${message.text()}`); });
            page.on('requestfailed', request => { if (!request.failure()?.errorText.includes('ERR_ABORTED')) report.requestFailures.push(`${width}: ${request.url()} ${request.failure()?.errorText}`); });
            try {
                // A representative backup alias proves actual browser query and fragment retention.
                await page.goto(url('/backup/main?market=MY&market=US&mode=contrarian&enableSocial=false&unknown=safe#plain-fragment'), { waitUntil: 'domcontentloaded' });
                await waitForRoute(page, '/main-v8', { mode: 'contrarian', enableSocial: 'false', unknown: 'safe' }, '#plain-fragment');
                assert.deepEqual(new URL(page.url()).searchParams.getAll('market'), ['MY', 'US'], 'redirect preserves repeated market query values');
                await waitForHydration(page, '#market-select');
                assert.equal(await page.locator('#market-select').inputValue(), 'MY', 'V8 must use the first repeated market query value');
                check(`${width}px backup Market alias retains query, fragment, and first market value`, true);
                await assertNoUiFaults(page, `${width}px V8 Market`);
                await assertWorkspaceNavigation(page, width);
                await page.goto(url('/main-v8?market=MY&market=US&mode=contrarian&enableSocial=false&unknown=safe#plain-fragment'), { waitUntil: 'domcontentloaded' });
                await waitForRoute(page, '/main-v8', { mode: 'contrarian', enableSocial: 'false', unknown: 'safe' }, '#plain-fragment');

                await page.goto(url('/backup/research?ticker=AAPL&market=US&unknown=safe#research-fragment'), { waitUntil: 'domcontentloaded' });
                await waitForRoute(page, '/research-v8', { ticker: 'AAPL', market: 'US', unknown: 'safe' }, '#research-fragment');
                await waitForHydration(page, '[data-testid="selected-security-identity"]');
                check(`${width}px backup Research alias retains ordinary query and fragment`, true);
                await assertNoUiFaults(page, `${width}px V8 Research`);

                // Known hashes intentionally go to the retained advanced engine, rather than stale alias rendering.
                const knownHash = toolHashes[0];
                await page.goto(url(`/main-v8?market=MY&mode=contrarian&enableSocial=false&unknown=safe#${knownHash}`), { waitUntil: 'domcontentloaded' });
                await waitForRoute(page, '/market/tools', { market: 'MY', mode: 'contrarian', enableSocial: 'false', unknown: 'safe' }, `#${knownHash}`);
                const target = page.locator(`#${knownHash}`);
                await target.waitFor({ state: 'visible', timeout });
                check(`${width}px known Market hash forwards to retained tools engine`, true);
                const expanded = await target.evaluate((node) => Boolean(node.closest('details[open]')) || node.getAttribute('aria-expanded') === 'true');
                check(`${width}px tools expands known hash section`, expanded);
                const reading = page.getByRole('link', { name: 'Reading view', exact: true });
                await reading.waitFor({ state: 'visible', timeout });
                await Promise.all([waitForRoute(page, '/main-v8', { market: 'MY', mode: 'contrarian', enableSocial: 'false', unknown: 'safe' }, ''), reading.click()]);
                check(`${width}px explicit Reading view clears only tool-return hash`, !new URL(page.url()).hash);
                await Promise.all([waitForRoute(page, '/market/tools', { market: 'MY', mode: 'contrarian', enableSocial: 'false', unknown: 'safe' }, `#${knownHash}`), page.goBack({ waitUntil: 'domcontentloaded' })]);
                check(`${width}px Back restores Market tools and its known hash`, true);
                await Promise.all([waitForRoute(page, '/main-v8', { market: 'MY', mode: 'contrarian', enableSocial: 'false', unknown: 'safe' }, ''), page.goForward({ waitUntil: 'domcontentloaded' })]);
                check(`${width}px Forward restores explicit Reading view`, true);

                // Unknown fragments are not tool aliases and must remain intact between the two views.
                await page.goto(url('/main-v8?market=MY&unknown=safe#ordinary-fragment'), { waitUntil: 'domcontentloaded' });
                await page.getByRole('link', { name: 'Advanced tools', exact: true }).click();
                await waitForRoute(page, '/market/tools', { market: 'MY', unknown: 'safe' }, '#ordinary-fragment');
                check(`${width}px generic fragment survives Advanced tools selection`, true);

                // Market V7 uses history.pushState for these evidence handoffs. The rendered
                // link store must observe that programmatic hash change before a user copies or
                // opens the current tools view in another tab.
                const freshness = page.locator('#market-freshness-inspection');
                await freshness.waitFor({ state: 'visible', timeout });
                await freshness.click();
                await page.waitForFunction(() => location.hash === '#market-trust-limitations');
                const toolsNav = page.getByRole('navigation', { name: 'Workspace views', exact: true });
                const toolsLink = toolsNav.getByRole('link', { name: 'Advanced tools', exact: true });
                const readingLink = toolsNav.getByRole('link', { name: 'Reading view', exact: true });
                const toolsHref = new URL(await toolsLink.getAttribute('href'), base);
                const readingHref = new URL(await readingLink.getAttribute('href'), base);
                assert.equal(toolsHref.hash, '#market-trust-limitations', 'V7 pushState updates the rendered Advanced tools href');
                assert.equal(readingHref.hash, '', 'explicit Reading view clears a known tool-only hash');
                const pushedPopupPromise = page.context().waitForEvent('page', { timeout });
                await toolsLink.click({ button: 'middle' });
                const pushedPopup = await pushedPopupPromise;
                try {
                    await pushedPopup.waitForURL(candidate => new URL(candidate).pathname === '/market/tools', { timeout });
                    const opened = new URL(pushedPopup.url());
                    assert.equal(opened.pathname, '/market/tools', 'pushState middle-click keeps the tools destination');
                    assert.equal(opened.hash, '#market-trust-limitations', 'pushState middle-click keeps the current evidence fragment');
                    assert.equal(opened.searchParams.get('market'), 'MY', 'pushState middle-click keeps the active market context');
                } finally { await pushedPopup.close(); }
                check(`${width}px V7 evidence pushState updates rendered links and middle-click destination`, true);

                await page.goto(url('/main-v8?returnTo=today&market=MY'), { waitUntil: 'domcontentloaded' });
                await page.getByRole('link', { name: 'Back to Today', exact: true }).waitFor({ state: 'visible', timeout });
                const continuation = await page.evaluate(() => localStorage.getItem('signal-research-today-continuation-v1'));
                check(`${width}px V8 Market writes Today continuation`, continuation !== null);
                await Promise.all([waitForRoute(page, '/research', { workspace: 'today' }), page.getByRole('link', { name: 'Back to Today', exact: true }).click()]);
                check(`${width}px Back to Today returns to canonical Research workspace`, true);

                // This is the actual Today continuation control. Its client router push targets root,
                // then the proxy changes only that pathname to V8 Market.
                const todayContinue = page.getByTestId('today-continue');
                await todayContinue.waitFor({ state: 'visible', timeout });
                await Promise.all([waitForRoute(page, '/main-v8', { returnTo: 'today' }), todayContinue.click()]);
                check(`${width}px Today continuation client-router chain reaches root then V8 Market`, true);

                // Retirement must not strand advanced work: it remains available on canonical Research.
                if (width === 1280) {
                    await page.goto(url('/research-v4?workspace=portfolio'), { waitUntil: 'domcontentloaded' });
                    await waitForRoute(page, '/research', { workspace: 'portfolio' });
                    const portfolio = page.getByRole('region', { name: 'Read-only holdings snapshot' });
                    await portfolio.waitFor({ state: 'visible', timeout });
                    const csv = [
                        'account_label,row_type,symbol,market,quantity,average_cost,currency,cash_balance',
                        'Legacy QA,holding,AAPL,US,2,420,USD,',
                    ].join('\n');
                    await portfolio.getByLabel('Canonical CSV').setInputFiles({ name: 'legacy-route.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
                    await portfolio.getByTestId('portfolio-import-preview').waitFor({ state: 'visible', timeout });
                    await portfolio.getByLabel(/I reviewed the complete preview/).check();
                    await portfolio.getByRole('button', { name: 'Save accepted snapshot' }).click();
                    await portfolio.getByText(/Saved 1 holding row/).waitFor({ state: 'visible', timeout });
                    const snapshot = await page.evaluate(() => localStorage.getItem('signal-portfolio-holdings-v1'));
                    check('legacy research-v4 advanced link reaches canonical LOCAL-only portfolio save', snapshot?.includes('AAPL') === true);
                    await portfolio.getByRole('button', { name: 'Queue AAPL holding review' }).click();
                    await portfolio.getByText('AAPL holding review added to the Queue.').waitFor({ state: 'visible', timeout });
                    await page.goto(url('/backup/research?workspace=queue'), { waitUntil: 'domcontentloaded' });
                    await waitForRoute(page, '/research', { workspace: 'queue' });
                    const queue = page.getByTestId('research-workflow-queue');
                    await queue.getByText('AAPL · Thesis challenge').waitFor({ state: 'visible', timeout });
                    await queue.getByRole('button', { name: 'Open Portfolio holdings source' }).click();
                    await waitForRoute(page, '/research', { workspace: 'portfolio' });
                    check('backup Research advanced link preserves Queue creation and opens its canonical portfolio source', true);
                }

                await page.screenshot({ path: path.join(out, `legacy-routes-${width}.png`), fullPage: false });
            } finally { await context.close(); }
        }
    } finally { await browser.close(); }
    assert.deepEqual(report.errors, [], `browser console/page errors: ${report.errors.join(' | ')}`);
    assert.deepEqual(report.requestFailures, [], `browser request failures: ${report.requestFailures.join(' | ')}`);
    assert.deepEqual(report.mutations, [], `fixture QA must not mutate APIs: ${report.mutations.join(' | ')}`);
    await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`legacy routes QA passed (${report.checks.length} checks; screenshots: ${out})`);
} catch (error) {
    await writeFile(path.join(out, 'failure.json'), JSON.stringify({ ...report, error: error instanceof Error ? error.message : String(error) }, null, 2));
    throw error;
}
