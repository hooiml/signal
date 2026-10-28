import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { researchReadFixture, researchSnapshotFixture } from './harness/research-read-fixture.mjs';
import { guestWorkspaceQa } from './guest-workspace-qa.mjs';
import { guestRecoveryQa } from './guest-recovery-qa.mjs';

// Local-only, intercepted fixture: no database, provider or mutation requests.
const origin = new URL(process.env.SIGNAL_QA_URL ?? 'http://127.0.0.1:3213');
assert.ok(origin.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(origin.hostname) && origin.pathname === '/' && !origin.search && !origin.hash);
const base = origin.origin;
const evidence = '.tmp/research-due-review';
const fixture = researchReadFixture();
const response = await fixture.route.GET();
assert.equal(response.status, 200);
const seed = (await response.json()).data[0];
const day = offset => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const review = (date, price, currency, thesis, id) => ({ ...structuredClone(seed), id, reviewedAt: `${date}T12:00:00.000Z`, whyInterested: thesis, decisionJournal: { ...seed.decisionJournal, decision: 'Watch', observedPrice: price, observedCurrency: currency } });
const record = (symbol = 'AAPL', market = 'US') => ({ ...structuredClone(seed), symbol, market, companyName: `${symbol} fixture`, whyInterested: 'Latest SAVED thesis', lastReviewedAt: day(-60), revision: 7, monitoringRules: { ...seed.monitoringRules, reviewAgeDays: 30 }, decisionJournal: { ...seed.decisionJournal, decision: 'Watch', nextReviewAt: day(0) }, reviewHistory: [review(day(-30), 111, 'USD', 'Newest historical thesis', 'new'), review(day(-90), 99, 'USD', 'Older historical thesis', 'old')] });
const report = { base, scenarios: [], errors: [] };
const selectedArg = process.argv.find(arg => arg.startsWith('--scenario='))?.split('=')[1];
const selected = selectedArg === 'all-with-guests' ? undefined : selectedArg;
function guestSnapshot(symbol, market) {
    const payload = structuredClone(researchSnapshotFixture);
    Object.assign(payload.data, { symbol, market, fetchedAt: new Date().toISOString(), warnings: [] });
    Object.assign(payload.data.quote, { name: symbol === 'MAYBANK' ? 'Malayan Banking Berhad' : `Fixture ${symbol}`, price: symbol === 'MSFT' ? 400 : 200, currency: market === 'MY' ? 'MYR' : 'USD', instrumentType: symbol === 'VOO' ? 'ETF' : 'EQUITY', observedAt: '2026-10-02T20:00:00.000Z', classification: { source: 'Yahoo Finance', instrumentType: symbol === 'VOO' ? 'ETF' : 'EQUITY', sector: symbol === 'MAYBANK' ? 'Financial Services' : 'Technology', industry: symbol === 'MAYBANK' ? 'Banks—Regional' : 'Consumer Electronics', retrievedAt: new Date().toISOString() } });
    Object.assign(payload.data.fundamentals, { source: market === 'MY' ? 'Yahoo Finance' : 'SEC EDGAR', reportingPeriod: '2025-12-31', revenueGrowthPercent: 10, annualRevenue: 1000, annualNetIncome: 100, freeCashFlow: 80 });
    const current = { ...payload.data.fundamentals, currency: market === 'MY' ? 'MYR' : 'USD' };
    payload.data.fundamentals.history = [current, { ...current, reportingPeriod: '2024-12-31', annualRevenue: 900, annualNetIncome: 90, freeCashFlow: 100 }];
    return payload;
}
const scenarios = [
    { name: 'due', make: () => record(), visible: true },
    { name: 'overdue', make: () => ({ ...record(), decisionJournal: { ...record().decisionJournal, nextReviewAt: day(-1) } }), visible: true },
    { name: 'future-and-boundary', make: () => ({ ...record(), lastReviewedAt: day(-30), decisionJournal: { ...record().decisionJournal, nextReviewAt: day(1) } }), visible: false },
    { name: 'stale-independent', make: () => ({ ...record(), decisionJournal: { ...record().decisionJournal, nextReviewAt: day(30) } }), visible: true },
    { name: 'scheduled-bookmark', make: () => ({ ...record(), decisionJournal: { ...seed.decisionJournal, decision: 'Not recorded', confidence: 'unrecorded', nextReviewAt: day(0) }, reviewHistory: [] }), visible: true },
    { name: 'missing-history', make: () => ({ ...record(), reviewHistory: [], decisionJournal: { ...record().decisionJournal, observedPrice: null, observedCurrency: null }, whyInterested: '' }), visible: true },
    { name: 'missing-currency', make: () => ({ ...record(), reviewHistory: [review(day(-30), 111, null, 'Currency unknown', 'unknown')] }), visible: true },
    { name: 'missing-current', make: () => record(), visible: true, missingCurrent: true },
    { name: 'long-thesis', make: () => ({ ...record(), whyInterested: 'Long saved thesis '.repeat(80) + 'X'.repeat(350) }), visible: true },
    { name: 'my', make: () => record('1155', 'MY'), symbol: '1155', market: 'MY', visible: true },
    { name: 'loading-error-transition', make: () => record(), visible: true, transition: true },
];

async function run(browser, scenario, viewport = { width: 1280, height: 900 }, theme = 'light') {
    const result = { name: `${scenario.name}-${theme}-${viewport.width}`, checks: [], requests: [], errors: [] };
    report.scenarios.push(result);
    const check = (condition, message) => { assert.ok(condition, message); result.checks.push(message); };
    const state = { records: scenario.market === 'MY' ? [scenario.make(), record()] : [scenario.make(), record('1155', 'MY')], mutations: [] };
    let releaseTransition;
    const transitionGate = new Promise(resolve => { releaseTransition = resolve; });
    const context = await browser.newContext({ viewport, colorScheme: theme, serviceWorkers: 'block', reducedMotion: 'reduce' });
    await context.addInitScript(choice => localStorage.setItem('signal-v8-theme-v1', choice), theme);
    await context.route('**/api/**', async route => {
        const request = route.request(); const url = new URL(request.url());
        result.requests.push(`${request.method()} ${url.pathname}${url.search}`);
        if (request.method() === 'POST' && url.pathname === '/api/research/quotes') return route.fulfill({ json: { success: true, data: { fetchedAt: new Date().toISOString(), items: request.postDataJSON().map(({ symbol, market }) => ({ success: true, data: { symbol, market, providerSymbol: symbol, fetchedAt: new Date().toISOString(), quote: { ...researchSnapshotFixture.data.quote, currency: market === 'MY' ? 'MYR' : 'USD' } } })) } } });
        if (request.method() === 'POST' && url.pathname === '/api/research/inbox') return route.fulfill({ json: { success: true, data: { generatedAt: new Date().toISOString(), monitoredCount: state.records.length, items: [], warnings: [] } } });
        if (request.method() !== 'GET') { state.mutations.push(`${request.method()} ${url.pathname}`); return route.abort(); }
        if (url.pathname === '/api/owner/session') return route.fulfill({ json: { success: true, data: { configured: true, unlocked: !scenario.guest } } });
        if (url.pathname === '/api/research/watchlist') return route.fulfill({ json: { success: true, data: scenario.guest ? [] : state.records, archivedSymbols: [] } });
        if (url.pathname.startsWith('/api/research/symbol/')) {
            const payload = structuredClone(researchSnapshotFixture); payload.data.symbol = decodeURIComponent(url.pathname.split('/').at(-1)); payload.data.market = url.searchParams.get('market') === 'MY' ? 'MY' : 'US';
            if (scenario.transition && payload.data.symbol === '1155') { await transitionGate; payload.data.symbol = 'WRONG'; }
            payload.data.quote.currency = payload.data.market === 'MY' ? 'MYR' : 'USD';
            payload.data.quote.observedAt = '2026-10-20T20:00:00.000Z';
            payload.data.technicals.high52Week = scenario.missingCurrent ? null : 250;
            if (scenario.missingCurrent) { payload.data.quote.price = null; payload.data.quote.currency = null; }
            return route.fulfill({ json: payload });
        }
        if (url.pathname.startsWith('/api/research/benchmark/')) return route.fulfill({ json: { success: true, data: researchSnapshotFixture.data.benchmark } });
        return route.fulfill({ json: { success: true, data: [] } });
    });
    const page = await context.newPage(); page.setDefaultTimeout(12000);
    page.on('pageerror', error => result.errors.push(`pageerror: ${error.message}`));
    page.on('requestfailed', req => { if (!req.failure()?.errorText.includes('ERR_ABORTED')) result.errors.push(`request: ${req.url()} ${req.failure()?.errorText}`); });
    page.on('console', msg => { if (['error', 'warning'].includes(msg.type()) && msg.text() !== 'Service Worker registration blocked by Playwright') result.errors.push(`${msg.type()}: ${msg.text()}`); });
    try {
        await page.goto(`${base}/research-v8?ticker=${scenario.symbol ?? 'AAPL'}&market=${scenario.market ?? 'US'}&tab=overview&advanced=1`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('tablist', { name: 'Research investigation' }).waitFor();
        await page.getByTestId('research-price').waitFor();
        const card = page.getByTestId('research-due-review');
        if (scenario.visible && !scenario.guest) await card.waitFor({ state: 'visible' });
        else { await page.waitForFunction(() => !document.querySelector('[data-testid="research-price"]')?.textContent?.includes('Loading')); check(await card.count() === 0, 'No due-review card when not due or guest'); check(state.mutations.length === 0, 'No mutation requests'); check(result.errors.length === 0, `No browser errors: ${result.errors.join(' | ')}`); return; }
        await card.locator('caption').filter({ hasText: 'Latest returned provider reading.' }).waitFor();
        if (scenario.transition) {
            check((await card.locator('tbody tr').first().locator('td').nth(1).innerText()).includes('200.00'), 'First stock renders its provider quote');
            await page.getByRole('button', { name: /Watchlist ·/ }).click(); await page.getByRole('button', { name: /1155.*fixture/ }).click();
            await page.locator('[data-testid="selected-security-identity"][data-symbol="1155"]').waitFor();
            await card.locator('caption').filter({ hasText: 'Provider reading is loading.' }).waitFor();
            check(!(await card.innerText()).includes('USD 200.00'), 'Delayed second stock never displays first stock quote');
            releaseTransition(); await card.locator('caption').filter({ hasText: 'Provider refresh failed.' }).waitFor();
            check(!(await card.innerText()).includes('USD 200.00') && (await card.locator('tbody tr').first().locator('td').nth(1).innerText()) === 'Unavailable', 'Mismatched provider response leaves current price unavailable');
            check(state.mutations.length === 0 && result.errors.length === 0, `Transition has no mutations or browser errors: ${result.errors.join(' | ')}`); return;
        }
        check(await card.getAttribute('aria-label') === 'Due review', 'Card has accessible Due review label');
        check(await card.getByText('Then vs now', { exact: true }).count() === 1, 'Card has Then vs now title');
        const text = await card.innerText();
        if (scenario.name === 'due') {
            check(text.includes('Newest historical thesis') && !text.includes('Older historical thesis') && text.includes('Latest SAVED thesis'), 'Latest historical snapshot and latest saved thesis are distinct');
            check(text.includes('111') && !text.includes('99'), 'Latest snapshot price wins regardless of array order');
            check(text.includes('Not recorded') && text.includes('Unavailable'), 'Unsupported history and current market score are explicit');
            const rows = card.locator('tbody tr');
            check((await rows.nth(0).innerText()).includes('USD 200.00') && (await rows.nth(1).innerText()).includes('20.0% below'), 'Current price and high distance use the current provider snapshot');
        }
        if (scenario.name === 'missing-history' || scenario.name === 'scheduled-bookmark') check(text.includes('Not recorded'), 'Missing historical values are explicit');
        if (scenario.name === 'scheduled-bookmark') check(text.includes('No personal review recorded.'), 'Bookmark creation is not presented as a personal review');
        if (scenario.name === 'missing-currency') check(text.includes('Currency not supplied') && !text.includes('USD 111'), 'Unknown historical currency is not inferred');
        if (scenario.name === 'missing-current') { const rows = card.locator('tbody tr'); check((await rows.nth(0).locator('td').nth(1).innerText()) === 'Unavailable' && (await rows.nth(1).locator('td').nth(1).innerText()) === 'Unavailable', 'Missing current price and high distance are explicit'); }
        if (scenario.name === 'long-thesis') {
            const disclosure = card.locator('details').filter({ hasText: 'Read full thesis' });
            const summary = disclosure.locator('summary');
            check(await disclosure.count() === 1 && !(await disclosure.getAttribute('open')) && (await summary.innerText()).length < 200 && (await disclosure.boundingBox()).height < 200, 'Long thesis starts as a bounded compact preview');
            await summary.focus(); await page.keyboard.press('Enter'); check(await disclosure.getAttribute('open') !== null && (await disclosure.innerText()).includes('X'.repeat(350)), 'Keyboard expands full thesis without truncation');
        }
        if (scenario.name === 'due') check(text.includes('Scheduled review:') && text.includes('Review age deadline passed:'), 'Independent scheduled and stale reasons are labelled');
        if (scenario.name === 'stale-independent') check(!text.includes('Scheduled review:') && text.includes('Review age deadline passed:'), 'Future schedule does not hide independently stale review');
        const link = card.getByRole('link', { name: 'Start review (new tab) ↗' });
        check(await link.getAttribute('target') === '_blank' && (await link.getAttribute('rel')).includes('noopener') && (await link.getAttribute('rel')).includes('noreferrer'), 'Native new-tab handoff has isolation attributes');
        const href = new URL(await link.getAttribute('href'), base);
        check(href.pathname === '/research' && href.searchParams.get('workspace') === 'research' && href.searchParams.get('ticker') === (scenario.symbol ?? 'AAPL') && href.searchParams.get('market') === (scenario.market ?? 'US') && href.searchParams.get('review') === 'edit', 'Link preserves exact symbol, market and review route');
        const before = result.requests.length;
        if (scenario.name === 'due' || scenario.name === 'my') {
            const draftPage = await context.newPage(); await draftPage.goto(href.href, { waitUntil: 'domcontentloaded' });
            const draft = draftPage.getByTestId('research-decision-journal').locator('[data-review-step="thesis"] label').filter({ hasText: /^Why interested/ }).locator('textarea');
            await draft.fill('Unsaved separate owner draft');
            const popupPromise = page.waitForEvent('popup'); await link.focus(); await page.keyboard.press('Enter'); const popup = await popupPromise;
            await popup.getByTestId('research-decision-journal').getByRole('navigation', { name: 'Review steps' }).waitFor();
            check(new URL(popup.url()).searchParams.get('review') === 'edit', 'Keyboard handoff opens the real review editor');
            check(await draft.inputValue() === 'Unsaved separate owner draft', 'Existing owner review draft remains untouched');
            await popup.close(); await draftPage.close();
            check(state.mutations.length === 0, 'Handoff never mutates saved records');
        }
        await card.scrollIntoViewIfNeeded();
        const geometry = await page.evaluate(() => { const el = document.querySelector('[data-testid="research-due-review"]'); const quote = document.querySelector('[aria-label="Current provider quote"]'); const box = el.getBoundingClientRect(); const q = quote?.getBoundingClientRect(); const children = [...el.querySelectorAll('th,td,h2,h3,p,a,button')].filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right }; }); return { viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, left: box.left, right: box.right, width: box.width, top: box.top, quoteBottom: q?.bottom, children }; });
        result.geometry = geometry; check(geometry.documentWidth <= geometry.viewport + 1 && geometry.left >= -1 && geometry.right <= geometry.viewport + 1 && geometry.children.every(child => child.left >= -1 && child.right <= geometry.viewport + 1), 'Card contents and document fit viewport');
        check(geometry.quoteBottom != null && geometry.top >= geometry.quoteBottom - 1, 'Card is separate and below quote band');
        await page.screenshot({ path: `${evidence}/${result.name}.png` });
        if (scenario.name === 'due') {
            const storageBefore = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('signal.guest-research')))));
            const beforeLater = result.requests.length; await card.getByRole('button', { name: 'Later', exact: true }).focus(); await page.keyboard.press('Enter');
            await card.waitFor({ state: 'hidden' }); check(result.requests.length === beforeLater, 'Later does not issue requests');
            await page.getByRole('tab', { name: 'Financials', exact: true }).click(); await page.getByRole('tab', { name: 'Overview', exact: true }).click();
            check(await card.count() === 0, 'Dismissal survives switching tabs');
            await page.getByRole('button', { name: 'Refresh provider data' }).click();
            await page.getByRole('button', { name: 'Refresh provider data' }).waitFor({ state: 'visible' });
            check(await card.count() === 0, 'Dismissal survives provider refresh');
            check(await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('signal.guest-research'))))) === storageBefore, 'Review controls leave guest research storage untouched');
            await page.getByRole('button', { name: /Watchlist ·/ }).click();
            await page.getByRole('button', { name: /1155.*fixture/ }).click();
            await page.locator('[data-testid="selected-security-identity"][data-symbol="1155"]').waitFor(); await card.waitFor({ state: 'visible' });
            await page.getByRole('button', { name: /Watchlist ·/ }).click(); await page.getByRole('button', { name: /AAPL.*fixture/ }).click();
            await page.locator('[data-testid="selected-security-identity"][data-symbol="AAPL"]').waitFor(); await card.waitFor({ state: 'visible' });
            check(true, 'Switching stock away and back resets dismissal');
            await card.getByRole('button', { name: 'Later', exact: true }).click();
            state.records[0] = { ...state.records[0], revision: 8 };
            await page.getByRole('button', { name: /Watchlist ·/ }).click(); await page.getByRole('button', { name: 'Reload watchlist' }).click();
            await card.waitFor({ state: 'visible' }); check(true, 'A newer saved revision resets dismissal');
            await page.getByRole('button', { name: 'Close research panel' }).click();
            await page.reload({ waitUntil: 'domcontentloaded' }); await card.waitFor({ state: 'visible' }); check(true, 'Reload resets dismissal');
        }
        check(state.mutations.length === 0, 'No mutation requests');
        check(result.errors.length === 0, `No browser errors: ${result.errors.join(' | ')}`);
        result.handoffRequests = result.requests.slice(before);
    } catch (error) { result.errors.push(String(error)); report.errors.push(`${result.name}: ${error}`); await page.screenshot({ path: `${evidence}/${result.name}-failure.png` }).catch(() => {}); }
    finally { releaseTransition(); await context.close(); }
}

await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--no-sandbox'] });
try {
    if (selectedArg === 'all-with-guests' || selected === 'guest-suites') {
        await guestWorkspaceQa(browser, base, guestSnapshot, { ...structuredClone(seed), symbol: 'AAPL', market: 'US', companyName: 'Private owner Apple', notes: 'PRIVATE_OWNER_ONLY' });
        await guestRecoveryQa(browser, base, guestSnapshot);
    }
    for (const scenario of scenarios.filter(item => !selected || item.name === selected)) await run(browser, scenario);
    if (!selected || selected === 'geometry') for (const width of [1280, 768, 375, 320]) for (const theme of ['light', 'dark']) await run(browser, { name: 'geometry', make: () => record(), visible: true }, { width, height: 900 }, theme);
    if (!selected || selected === 'long-thesis') await run(browser, scenarios.find(item => item.name === 'long-thesis'), { width: 320, height: 844 }, 'dark');
    if (!selected || selected === 'guest') await run(browser, { name: 'guest', make: () => record(), visible: false, guest: true });
} finally { await browser.close(); await writeFile(`${evidence}/report.json`, JSON.stringify(report, null, 2)); }
if (report.errors.length) { console.error(report.errors.join('\n')); process.exitCode = 1; }
else console.log(`Due-review QA passed: ${report.scenarios.length} scenarios; evidence ${evidence}`);
