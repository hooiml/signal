import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Uses an existing verified Signal server. Never writes research or starts a server.
const base = process.env.SIGNAL_QA_URL ?? 'http://127.0.0.1:3000';
const output = `.tmp/research-v8-connected/qa-${Date.now()}`;
await mkdir(output, { recursive: true });
const read = async path => {
    const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(45000) });
    assert.equal(response.status, 200);
    return response.json();
};
const before = await read('/api/research/watchlist');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const records = before.data.filter(record => !(before.archivedSymbols ?? []).includes(record.symbol));
assert.ok(['AAPL', 'MSFT', 'VOO', 'MAYBANK'].every(symbol => records.some(record => record.symbol === symbol)), 'Expected saved securities exist');
const seedSnapshot = await read('/api/research/symbol/AAPL?market=US');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(12000);
const checks = [], errors = [], mutations = [], requests = [];
let phase = 'live';
page.on('pageerror', error => errors.push({ phase, error: error.message }));
page.on('console', message => { if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push({ phase, error: message.text() }); });
page.on('requestfailed', request => { if (!request.failure()?.errorText.includes('ERR_ABORTED')) errors.push({ phase, error: request.failure()?.errorText, path: new URL(request.url()).pathname }); });
page.on('response', response => { if (response.status() >= 400 && phase !== 'expected-failure') errors.push({ phase, status: response.status(), path: new URL(response.url()).pathname }); });
await context.route('**/api/**', route => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push({ path: url.pathname, query: url.search, method: request.method() });
    if (request.method() !== 'GET') { mutations.push(url.pathname); return route.abort(); }
    return route.continue();
});
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };
const visible = async (locator, name) => { await locator.waitFor({ state: 'visible' }); checks.push(name); };
async function go(query = '') {
    const response = await page.goto(`${base}/research-v8${query}`, { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200);
    const dismiss = page.getByRole('button', { name: 'Dismiss notice', exact: true });
    if (await dismiss.isVisible()) await dismiss.click();
}
async function settled() { await page.getByRole('button', { name: 'Refresh provider data', exact: true }).waitFor(); await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(el => el.textContent === 'Refresh provider data')?.disabled); }
async function choose(symbol) {
    const picker = page.getByRole('combobox', { name: 'Selected saved security' });
    if (await picker.isVisible()) await picker.selectOption(symbol);
    else await page.getByRole('region', { name: 'Saved watchlist' }).getByRole('button', { name: new RegExp(symbol) }).click();
}
async function geometry(name) {
    const result = await page.evaluate(() => {
        const viewport = innerWidth;
        const nodes = [...document.querySelectorAll('main button, main input, main select, main summary, main h1, main h2, main a, [role=tablist], [role=tabpanel]')].filter(el => el.getClientRects().length && !el.closest('[role=region][tabindex="0"]'));
        const outside = nodes.filter(el => { const r = el.getBoundingClientRect(); return r.left < -1 || r.right > viewport + 1; }).map(el => el.tagName);
        const buttons = [...document.querySelectorAll('[role=tab]')].map(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
        const overlap = buttons.some((r, i) => i && r.x < buttons[i - 1].x + buttons[i - 1].width - 1);
        return { viewport, scrollWidth: document.documentElement.scrollWidth, outside, overlap };
    });
    assert.ok(result.scrollWidth <= result.viewport && !result.outside.length && !result.overlap, `${name}: ${JSON.stringify(result)}`);
    checks.push(name);
}
async function shot(name) { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: `${output}/${name}.png`, fullPage: true }); }
try {
    await go();
    await settled();
    check('Default watchlist uses all active saved records', await page.getByRole('region', { name: 'Saved watchlist' }).getByRole('button').count() === records.length);
    check('Fictional securities absent from connected page', !/Northstar|Meridian|Rimba/.test(await page.locator('main').innerText()));
    check('Live Apple quote matches existing API', await page.getByTestId('research-price').innerText() === `${seedSnapshot.data.quote.currency} ${seedSnapshot.data.quote.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    await page.getByRole('group', { name: 'Price history range' }).getByRole('button', { name: 'All', exact: true }).click();
    check('Every returned historical close is plotted', (await page.locator('[aria-label="Price history"] polyline').getAttribute('points')).split(' ').length === seedSnapshot.data.chart.points.length);
    await shot('live-apple-desktop');
    for (const symbol of ['MSFT', 'VOO', 'MAYBANK']) {
        const [response] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === `/api/research/symbol/${symbol}` && response.request().method() === 'GET', { timeout: 45000 }),
            choose(symbol),
        ]);
        const payload = await response.json();
        await settled();
        check(`${symbol} current values match its API response`, await page.getByTestId('research-price').innerText() === (payload.data.quote.price == null ? 'Unavailable' : `${payload.data.quote.currency || 'Currency not supplied'} ${payload.data.quote.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`));
        check(`${symbol} research comes from its saved record`, await page.getByRole('article', { name: `${symbol} research` }).count() === 1);
    }

    phase = 'controlled';
    const apple = structuredClone(records.find(record => record.symbol === 'AAPL'));
    Object.assign(apple, { whyInterested: 'QA saved thesis: recurring demand needs evidence.', bullCase: 'QA bull case.', bearCase: 'QA bear case.', thesisBreak: 'QA invalidation.', notes: 'QA saved note: verify the next report.', acceptedEvidence: [], reviewHistory: [] });
    apple.documentEvidence.citations = [];
    apple.checklist = Object.fromEntries(Object.keys(apple.checklist).map(key => [key, key === 'understandBusiness']));
    const microsoft = { ...structuredClone(apple), symbol: 'MSFT', companyName: 'Microsoft Corporation', notes: 'QA Microsoft note.' };
    const maybank = { ...structuredClone(apple), symbol: 'MAYBANK', market: 'MY', companyName: 'Malayan Banking Berhad' };
    let listMode = 'ready', snapshotMode = 'ready', delayApple = false, releaseApple;
    const snapshots = symbol => {
        const result = structuredClone(seedSnapshot);
        result.data.symbol = symbol; result.data.market = symbol === 'MAYBANK' ? 'MY' : 'US';
        result.data.quote = { name: symbol, currency: symbol === 'MAYBANK' ? 'MYR' : 'USD', price: symbol === 'MAYBANK' ? 10.5 : symbol === 'MSFT' ? 420.25 : 201.5, dailyChangePercent: 0 };
        if (snapshotMode === 'partial') {
            result.data.quote.price = null; result.data.chart.points = [];
            for (const key of Object.keys(result.data.fundamentals)) result.data.fundamentals[key] = key === 'history' ? [] : null;
            for (const key of Object.keys(result.data.valuation)) result.data.valuation[key] = null;
            result.data.warnings = ['QA: financial provider unavailable.'];
        }
        if (snapshotMode === 'mismatch') result.data.symbol = 'WRONG';
        return result;
    };
    await page.route('**/api/research/watchlist', route => route.fulfill({ status: listMode === 'error' ? 503 : 200, json: listMode === 'malformed' ? { success: true, data: [{}] } : { success: listMode !== 'error', data: listMode === 'empty' ? [] : [apple, microsoft, maybank], archivedSymbols: [] } }));
    await page.route('**/api/research/symbol/**', async route => {
        const symbol = new URL(route.request().url()).pathname.split('/').pop();
        if (delayApple && symbol === 'AAPL') await new Promise(resolve => { releaseApple = resolve; });
        await route.fulfill({ status: snapshotMode === 'error' ? 503 : 200, json: snapshots(symbol) }).catch(() => {});
    });
    for (const width of [1280, 768, 375]) {
        await page.setViewportSize({ width, height: 900 });
        await go('?ticker=AAPL'); await settled();
        await visible(page.getByText(apple.whyInterested, { exact: true }), `Saved thesis shown ${width}`);
        await geometry(`Overview geometry ${width}`); await shot(`connected-${width}`);
        const slider = page.getByRole('slider', { name: 'Inspect a trading date' });
        await slider.focus(); await slider.press('Home');
        check(`Chart date keyboard selection ${width}`, await slider.inputValue() === '0');
        check(`Visible keyboard focus ${width}`, await slider.evaluate(el => getComputedStyle(el).outlineWidth) !== '0px');
        await page.getByRole('tab', { name: 'Overview', exact: true }).focus(); await page.keyboard.press('ArrowRight');
        check(`Tab arrow navigation ${width}`, await page.getByRole('tab', { name: 'Financials', exact: true }).getAttribute('aria-selected') === 'true');
        for (const tab of ['Financials', 'Thesis', 'Valuation', 'Review']) {
            await page.getByRole('tab', { name: tab, exact: true }).click();
            await geometry(`${tab} geometry ${width}`);
        }
        await visible(page.getByText(apple.notes, { exact: true }), `Saved note shown ${width}`);
        const edit = new URL(await page.getByRole('tabpanel').getByRole('link', { name: 'Edit saved research' }).getAttribute('href'), base);
        check(`Existing edit destination preserves ticker ${width}`, edit.searchParams.get('ticker') === 'AAPL' && edit.searchParams.get('review') === 'edit');
        await page.getByRole('tab', { name: 'Thesis', exact: true }).click();
        await page.getByText('Saved investment checklist · 1/9 marked', { exact: true }).click();
        check(`Nine saved checklist questions ${width}`, await page.getByRole('tabpanel').getByRole('listitem').count() === 9);
        await page.getByText('Research tools · existing workspaces', { exact: true }).click();
        const toolLinks = await page.locator('details').filter({ has: page.getByText('Research tools · existing workspaces', { exact: true }) }).getByRole('link').evaluateAll(links => links.map(link => link.href));
        check(`All advanced tools use selected ticker ${width}`, toolLinks.length > 20 && toolLinks.every(link => new URL(link).searchParams.get('ticker') === 'AAPL'));
        await geometry(`Expanded tools and checklist ${width}`);
        await page.getByRole('searchbox', { name: 'Find a saved security' }).fill('Microsoft');
        await visible(page.getByText('AAPL remains open below and is outside the current filter.', { exact: true }), `Selection outside filter explained ${width}`);
        await choose('MSFT'); await settled();
        check(`Selected Microsoft quote isolated ${width}`, await page.getByTestId('research-price').innerText() === 'USD 420.25');
        await page.getByRole('combobox', { name: 'Market', exact: true }).selectOption('MY');
        await visible(page.getByRole('button', { name: 'Clear filters', exact: true }), `No matching securities ${width}`);
        await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
        await choose('MAYBANK'); await settled();
        check(`Malaysia quote retains currency ${width}`, await page.getByTestId('research-price').innerText() === 'MYR 10.5');
        await page.getByRole('tab', { name: 'Valuation', exact: true }).click();
        await visible(page.getByText('The existing research snapshot does not supply a comparable Malaysia benchmark. No cross-market comparison is inferred.', { exact: true }), `Malaysia benchmark limitation ${width}`);
    }
    snapshotMode = 'partial'; await go(); await settled();
    check('Missing provider price remains unavailable', await page.getByTestId('research-price').innerText() === 'Unavailable');
    await visible(page.getByText('No price history returned. No illustrative line is shown.', { exact: true }), 'Missing history has no fake chart');
    await visible(page.getByText(apple.whyInterested, { exact: true }), 'Partial provider response preserves saved thesis');
    await shot('partial-mobile');
    phase = 'expected-failure'; snapshotMode = 'error';
    await page.getByRole('button', { name: 'Refresh provider data', exact: true }).click();
    await visible(page.getByRole('button', { name: 'Retry provider data' }), 'Provider failure has retry');
    await visible(page.getByText(apple.whyInterested, { exact: true }), 'Provider failure preserves saved research');
    snapshotMode = 'mismatch'; await page.getByRole('button', { name: 'Retry provider data' }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(el => el.textContent === 'Retry provider data' && !el.disabled));
    check('Wrong security response rejected', await page.getByTestId('research-price').innerText() === 'Unavailable');
    snapshotMode = 'ready'; await page.getByRole('button', { name: 'Retry provider data' }).click(); await settled();
    phase = 'controlled'; check('Provider retry recovers', await page.getByTestId('research-price').innerText() === 'USD 201.5');
    phase = 'expected-failure'; listMode = 'error'; await page.getByRole('button', { name: 'Reload saved research' }).click();
    await visible(page.getByText(/The previously loaded records remain visible/), 'Watchlist refresh failure retains prior saved records');
    listMode = 'malformed'; await go(); await visible(page.getByText(/No example records have been substituted/), 'Malformed watchlist rejected without seeds');
    check('Malformed response does not expose stale research', await page.getByRole('article').count() === 0);
    listMode = 'empty'; phase = 'controlled'; await page.getByRole('button', { name: 'Reload saved research' }).click();
    await visible(page.getByRole('heading', { name: 'Your research starts here.' }), 'Empty watchlist stays empty'); await geometry('Empty mobile'); await shot('empty-mobile');
    listMode = 'ready'; delayApple = true; await go();
    await visible(page.getByText('Loading provider data… Your saved research is available below.', { exact: true }), 'Loading state keeps saved research usable');
    await choose('MSFT'); await settled();
    releaseApple?.(); delayApple = false;
    await page.getByRole('tab', { name: 'Review', exact: true }).click();
    check('Late Apple response cannot replace selected Microsoft', await page.getByTestId('research-price').innerText() === 'USD 420.25');
    await visible(page.getByText('QA Microsoft note.', { exact: true }), 'Saved notes isolated by security');
    await go('?ticker=NOT-SAVED'); await settled();
    check('Unknown initial ticker falls back to an active saved security', await page.getByRole('article', { name: 'AAPL research' }).count() === 1);
    await go('?ticker=%20msft%20'); await settled();
    check('Ticker query normalizes whitespace and case', await page.getByRole('article', { name: 'MSFT research' }).count() === 1);
    check('Retrieval time includes time and timezone', /Retrieved .*\d{2}:\d{2} UTC/.test(await page.getByRole('region', { name: 'Provider data status' }).innerText()));
    await page.unroute('**/api/research/watchlist'); await page.unroute('**/api/research/symbol/**');
    phase = 'demo'; await go('?demo=1');
    await visible(page.getByRole('heading', { name: 'Northstar Systems', exact: true }), 'Illustrative companies remain only in explicit demo');
    const after = await read('/api/research/watchlist');
    check('Saved research byte-equivalent before and after', hash(before) === hash(after));
    check('No API mutations sent', mutations.length === 0);
    check('No browser runtime errors', errors.length === 0);
    await writeFile(`${output}/report.json`, JSON.stringify({ status: 'pass', base, checks, errors, requests, savedResearchHash: hash(before), symbols: records.map(record => record.symbol) }, null, 2));
    console.log(JSON.stringify({ status: 'pass', checks: checks.length, output }));
} catch (error) {
    await writeFile(`${output}/failure.json`, JSON.stringify({ phase, checks, errors, error: error.message }, null, 2));
    await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
    throw error;
} finally { await browser.close(); }
