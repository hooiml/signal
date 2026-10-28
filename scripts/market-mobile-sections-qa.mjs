import { fulfillEarningsCalendarRead } from './qa-earnings-calendar-fixture.mjs';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { marketRequestFixture } from './harness/market-request-fixture.mjs';

// Local, controlled UI proof only. This starts no server and never uses a live provider or owner record.
const base = process.env.SIGNAL_QA_URL || 'http://127.0.0.1:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'SIGNAL_QA_URL must be localhost.');
const before = process.argv.includes('--before');
const requested = process.argv.find(value => value.startsWith('--scenario='))?.slice('--scenario='.length);
const supported = ['core', 'exposure-loading', 'exposure-error', 'exposure-saved', 'exposure-unmapped', 'classification-error', 'classification-malformed', 'outcomes-insufficient', 'missing-summaries', 'summary-values'];
const scenarios = requested ? requested.split(',').filter(Boolean) : supported;
const unknown = scenarios.filter(name => !supported.includes(name));
assert.deepEqual(unknown, [], `Unknown scenario(s): ${unknown.join(', ')}`);
const output = process.env.SIGNAL_MARKET_MOBILE_SECTIONS_OUTPUT || `.tmp/market-mobile-sections/${before ? 'before' : 'after'}`;
await mkdir(output, { recursive: true });

const fixture = marketRequestFixture();
const signal = {};
for (const market of ['US', 'MY']) {
    signal[market] = await (await fixture.route.GET(fixture.request(`market=${market}&mode=standard&enableSocial=true`))).json();
}
const sectionIds = ['market-mobile-context', 'market-mobile-outcomes', 'market-mobile-exposure', 'market-mobile-investigation'];
const headings = ['Market context', 'Historical outcomes', 'Exposure map', 'What changed'];
const result = { base, before, scenarios, checks: [], errors: [], requests: [], fixtureAssumptions: {
    signal: 'marketRequestFixture executes the real signal route with fixed provider/SQL boundaries.',
    saved: 'Guest workspace is injected only in the saved scenario; no owner record is read or written.',
    classification: 'Search responses are labelled synthetic classifications for saved guest symbols.',
} };

function guestWorkspaceFixture(market) {
    const symbol = market === 'US' ? 'AAPL' : '1155.KL';
    // This is the exact persisted GuestRecord shape accepted by readGuestWorkspace:
    // it deliberately excludes owner-only fields, which that parser rejects.
    return JSON.stringify({ version: 1, guestId: '11111111-1111-4111-8111-111111111111', records: [{ symbol, market, companyName: market === 'US' ? 'Fixture Apple' : 'Fixture Maybank', notes: '' }] });
}
function withInsufficientOutcomes(payload) {
    const copy = structuredClone(payload);
    const validation = copy.data.metadata.historical_validation;
    if (!validation) return copy;
    for (const horizon of validation.horizons) {
        for (const cohort of horizon.cohorts) {
            cohort.sample_count = 1; cohort.observed_count = 1; cohort.reconstructed_count = 0;
            cohort.evidence_level = 'insufficient'; cohort.median_forward_return_pct = null;
            cohort.average_forward_return_pct = null; cohort.positive_return_rate_pct = null;
        }
    }
    return copy;
}
function withMissingSummaries(payload) {
    const copy = structuredClone(payload);
    copy.data.metadata.index_trend = [];
    copy.data.metadata.score_delta.delta = null;
    copy.data.metadata.historical_validation.horizons = [];
    return copy;
}
function withSummaryValues(payload, market, delta) {
    const copy = structuredClone(payload);
    copy.data.metadata.index_trend = market === 'US'
        ? [{ symbol: '^GSPC', price: 5000, changePercent: -0.52 }, { symbol: '^IXIC', price: 16000, changePercent: 0.25 }]
        : [{ symbol: '^KLSE', price: 1600, changePercent: 0.25 }, { symbol: '^FTFBM100', price: 12000, changePercent: -0.52 }];
    copy.data.metadata.index_trend = copy.data.metadata.index_trend.map(index => ({ ...index, trend: index.changePercent < 0 ? 'negative' : 'positive' }));
    copy.data.metadata.score_delta = { ...copy.data.metadata.score_delta, snapshot_date: '2026-09-12', previous_date: '2026-09-11', previous_score: copy.data.composite_score - delta, delta };
    const validation = copy.data.metadata.historical_validation;
    validation.minimum_sample_size = 6;
    const zone = copy.data.composite_score < 40 ? 'negative' : copy.data.composite_score < 65 ? 'mixed' : copy.data.composite_score < 85 ? 'positive' : 'strong-positive';
    for (const horizon of validation.horizons) {
        const cohort = horizon.cohorts.find(value => value.zone === zone);
        assert.ok(cohort, `Fixture calibration must include the ${zone} score zone.`);
        Object.assign(cohort, { sample_count: 6, observed_count: 6, reconstructed_count: 0, average_forward_return_pct: 0.6, median_forward_return_pct: 0.6, positive_return_rate_pct: 50, worst_forward_return_pct: -1, best_forward_return_pct: 1, alignment_rate_pct: 50, evidence_level: 'preliminary' });
    }
    return copy;
}
function rects(page) {
    return page.evaluate(() => {
        const box = element => { const value = element.getBoundingClientRect(); return { left: value.left, right: value.right, top: value.top, bottom: value.bottom, width: value.width, height: value.height }; };
        const visible = element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden' && getComputedStyle(element).display !== 'none';
        const wrappers = [...document.querySelectorAll('[data-testid^="market-mobile-"]')].filter(visible).map(box);
        const overlaps = [];
        for (let index = 0; index < wrappers.length; index += 1) for (let other = index + 1; other < wrappers.length; other += 1) {
            const a = wrappers[index], b = wrappers[other];
            const intersect = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
            if (intersect > 20 && !(a.top === b.top && a.bottom === b.bottom)) overlaps.push({ a, b });
        }
        const controls = [...document.querySelectorAll('[data-testid^="market-mobile-"] h2 > button')].filter(visible).map(box);
        return { overflow: document.documentElement.scrollWidth - innerWidth, overlaps: overlaps.slice(0, 5), controls, height: document.documentElement.scrollHeight };
    });
}
async function open(browser, { market, width, theme = 'light', state = 'core' }) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' });
    if (state === 'exposure-saved' || state === 'exposure-unmapped' || state.startsWith('classification-')) await context.addInitScript(value => localStorage.setItem('signal.guest-research.v1', value), guestWorkspaceFixture(market));
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    let releaseSession;
    const sessionGate = new Promise(resolve => { releaseSession = resolve; });
    page.on('pageerror', error => result.errors.push(`${market}/${state}: ${error.message}`));
    page.on('console', message => {
        if (!['warning', 'error'].includes(message.type())) return;
        if (message.type() === 'warning' && message.text() === 'Service Worker registration blocked by Playwright') return;
        if (state === 'exposure-error' && message.text() === 'Failed to load resource: the server responded with a status of 503 (Service Unavailable)' && message.location().url.includes('/api/research/watchlist')) return;
        if (state === 'classification-error' && message.text() === 'Failed to load resource: the server responded with a status of 503 (Service Unavailable)' && message.location().url.includes('/api/research/search')) return;
        result.errors.push(`${market}/${state}: console ${message.text()}`);
    });
    page.on('response', response => {
        if (response.status() < 400) return;
        const path = new URL(response.url()).pathname;
        if (state === 'exposure-error' && path === '/api/research/watchlist' && response.status() === 503) return;
        if (state === 'classification-error' && path === '/api/research/search' && response.status() === 503) return;
        result.errors.push(`${market}/${state}: HTTP ${response.status()} ${path}`);
    });
    page.on('requestfailed', request => {
        if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.errors.push(`${market}/${state}: ${request.url()} ${request.failure()?.errorText}`);
    });
    await page.route('**/api/**', async route => {
        if (await fulfillEarningsCalendarRead(route)) return;
        const request = route.request(), url = new URL(request.url());
        result.requests.push({ market, state, path: url.pathname, method: request.method() });
        assert.equal(request.method(), 'GET', `Fixture UI must not mutate: ${request.method()} ${url.pathname}`);
        if (url.pathname === '/api/signals/v2') {
            const payload = state === 'outcomes-insufficient' ? withInsufficientOutcomes(signal[market])
                : state === 'missing-summaries' ? withMissingSummaries(signal[market])
                    : state === 'summary-values-unchanged' ? withSummaryValues(signal[market], market, 0)
                        : state === 'summary-values-negative' ? withSummaryValues(signal[market], market, -1) : signal[market];
            return route.fulfill({ json: payload });
        }
        if (url.pathname === '/api/owner/session') {
            if (state === 'exposure-loading') await sessionGate;
            if (state === 'exposure-error') return route.fulfill({ json: { success: true, data: { configured: true, unlocked: true } } });
            return route.fulfill({ json: { success: true, data: { configured: false, unlocked: false } } });
        }
        if (url.pathname === '/api/research/watchlist') {
            if (state === 'exposure-error') return route.fulfill({ status: 503, json: { success: false, error: 'Controlled owner-watchlist failure' } });
            return route.fulfill({ json: { success: true, data: [], archivedSymbols: [] } });
        }
        if (url.pathname === '/api/signals/replay') return route.fulfill({ json: { success: true, data: { market, mode: 'standard', enableSocial: true, summaries: [] } } });
        if (url.pathname === '/api/research/search') {
            if (state === 'classification-error') return route.fulfill({ status: 503, json: { success: false } });
            if (state === 'classification-malformed') return route.fulfill({ json: { success: true, data: 'invalid fixture' } });
            return route.fulfill({ json: { success: true, data: [{ symbol: url.searchParams.get('q'), sector: state === 'exposure-unmapped' ? null : market === 'US' ? 'Technology' : 'Financial Services', industry: state === 'exposure-unmapped' ? null : 'Fixture classification', instrumentType: 'EQUITY' }] } });
        }
        return route.fulfill({ status: 404, json: { success: false, error: `Unexpected fixture API: ${url.pathname}` } });
    });
    await page.goto(`${base}/main-v8?market=${market}`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('connected-score').waitFor();
    // Scrolling normally starts the existing lazy archive read. Settle that read
    // before measuring requests caused specifically by disclosure toggles.
    await page.locator('[data-inspecting]').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll('details')].some(element => element.textContent.includes('Archive loaded')));
    await page.evaluate(() => window.scrollTo(0, 0));
    return { context, page, releaseSession };
}
function body(page, id) { return page.locator(`[id="${id}"]`); }
async function baseline(browser) {
    for (const market of ['US', 'MY']) for (const width of [1280, 768, 375, 320]) {
        const { context, page } = await open(browser, { market, width });
        const geometry = await rects(page);
        await page.screenshot({ path: `${output}/${market}-${width}-baseline.png`, fullPage: true });
        result.checks.push({ name: `baseline ${market} ${width}`, height: geometry.height, overflow: geometry.overflow });
        await context.close();
    }
}
async function verifyStructure(page, label, mobile) {
    for (let index = 0; index < sectionIds.length; index += 1) {
        const section = page.getByTestId(sectionIds[index]);
        await section.waitFor();
        const button = section.getByRole('button', { name: new RegExp(headings[index], 'i'), includeHidden: true }).first();
        const bodyId = await button.getAttribute('aria-controls');
        assert.ok(bodyId, `${label}: ${sectionIds[index]} heading controls a body`);
        const panel = body(page, bodyId);
        assert.equal(await panel.count(), 1, `${label}: ${sectionIds[index]} controls exactly one body`);
        const summary = await button.textContent() || '';
        if (index === 0) assert.match(summary, /(?:S&P 500|FBM KLCI|Index moves unavailable)\s*(?:[+−-]\d+(?:\.\d+)?%)?(?:\s*·\s*\d+\/\d+ down, \d+\/\d+ up)?/i, `${label}: context summary is a finite benchmark move and breadth count`);
        if (index === 1) assert.match(summary, /One-week (?:median|evidence insufficient|outcomes unavailable)/i, `${label}: outcomes summary is a 7-day evidence state`);
        if (index === 2) assert.match(summary, /(loading|error|no saved|\d+ (?:saved|mapped))/i, `${label}: exposure summary states its load/save count`);
        if (index === 3) assert.match(summary, /(?:score points.*since|Score unchanged.*since|Score comparison unavailable)/i, `${label}: what-changed summary carries a delta/prior date or unavailable`);
        if (mobile) {
            assert.equal(await button.getAttribute('aria-expanded'), 'false', `${label}: ${sectionIds[index]} starts collapsed`);
            assert.equal(await panel.isVisible(), false, `${label}: ${sectionIds[index]} body starts hidden`);
        } else {
            assert.equal(await panel.evaluate(element => getComputedStyle(element).display), 'contents', `${label}: ${sectionIds[index]} body remains mounted as desktop contents`);
            assert.equal(await panel.locator('*').evaluateAll(elements => elements.some(element => element.getClientRects().length > 0)), true, `${label}: ${sectionIds[index]} body has visible desktop descendants`);
            assert.equal(await button.isVisible(), false, `${label}: ${sectionIds[index]} disclosure control is hidden above mobile`);
        }
    }
}
async function toggle(page, id, key) {
    const section = page.getByTestId(id), button = section.getByRole('button').first();
    const bodyId = await button.getAttribute('aria-controls');
    const beforeRequests = result.requests.length;
    await button.focus(); await page.keyboard.press(key);
    await page.waitForFunction(sectionId => document.querySelector(`[data-testid="${sectionId}"] > h2 > button`)?.getAttribute('aria-expanded') === 'true', id, { timeout: 5000 });
    assert.equal(await button.getAttribute('aria-expanded'), 'true', `${id}: ${key} expands`);
    assert.equal(await body(page, bodyId).isVisible(), true, `${id}: body becomes visible`);
    assert.equal(result.requests.length, beforeRequests, `${id}: opening performs no API request`);
    return { button, bodyId };
}
async function core(browser, market, width, theme) {
    const { context, page } = await open(browser, { market, width, theme });
    const label = `${market} ${theme} ${width}`;
    const mobile = width <= 600;
    await verifyStructure(page, label, mobile);
    const initial = await rects(page);
    let expanded = initial;
    await page.screenshot({ path: `${output}/${market}-${theme}-${width}-collapsed.png`, fullPage: true });
    if (mobile) {
        const heroChange = page.getByRole('button', { name: /points vs/i }).first();
        await heroChange.click();
        await page.locator('#investigation-panel:focus').waitFor();
        const investigationToggle = page.getByTestId('market-mobile-investigation').getByRole('button').first();
        assert.equal(await investigationToggle.getAttribute('aria-expanded'), 'true', `${label}: hero change opens the investigation section`);
        assert.equal(await page.getByRole('tab', { name: 'What changed', exact: true }).getAttribute('aria-selected'), 'true', `${label}: hero change selects What changed`);
        for (const [index, id] of sectionIds.entries()) {
            const button = page.getByTestId(id).getByRole('button').first();
            if (await button.getAttribute('aria-expanded') !== 'true') await toggle(page, id, index % 2 ? 'Space' : 'Enter');
        }
        expanded = await rects(page);
        assert.ok(expanded.height > initial.height, `${label}: opening all mobile sections increases page height`);
        await page.screenshot({ path: `${output}/${market}-${theme}-${width}-expanded.png`, fullPage: true });
        const contextButton = page.getByTestId('market-mobile-context').getByRole('button', { name: /Explore market context/i });
        await contextButton.click();
        const contextTab = page.getByRole('tab', { name: 'Context', exact: true });
        await contextTab.waitFor(); assert.equal(await contextTab.getAttribute('aria-selected'), 'true', `${label}: context handoff selects Context`);
        const calibration = page.getByRole('button', { name: /Full historical calibration/i });
        await calibration.click();
        await page.locator('#investigation-panel:focus').waitFor();
        assert.equal(await page.getByRole('tab', { name: 'History', exact: true }).getAttribute('aria-selected'), 'true', `${label}: calibration handoff selects History`);
        await page.getByRole('tab', { name: 'What changed', exact: true }).click();
        assert.equal(await page.getByRole('tab', { name: 'What changed', exact: true }).getAttribute('aria-selected'), 'true', `${label}: investigation tabs remain reachable`);
        const exposureLink = page.getByTestId('market-mobile-exposure').getByRole('link').first();
        assert.match(await exposureLink.getAttribute('href'), /^\/research-v8\?market=(US|MY)$/, `${label}: exposure Research link remains reachable without provider navigation`);
        await page.setViewportSize({ width: 768, height: 900 });
        await verifyStructure(page, `${label} resized desktop`, false);
        await page.setViewportSize({ width, height: 900 });
        for (const id of sectionIds) assert.equal(await page.getByTestId(id).getByRole('button').first().getAttribute('aria-expanded'), 'true', `${label}: mobile choice survives resize`);
        await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByTestId('connected-score').waitFor();
        await verifyStructure(page, `${label} reload`, true);
    } else {
        const contextSection = page.getByTestId('market-mobile-context');
        const explore = contextSection.getByRole('button', { name: /Explore market context/ });
        await explore.focus();
        await page.waitForFunction(() => document.querySelector('[data-testid="market-mobile-context"]')?.getAttribute('data-expanded') === 'true');
        await page.setViewportSize({ width: 375, height: 900 });
        assert.equal(await explore.isVisible(), true, `${label}: a focused desktop control remains visible after phone resize`);
        assert.equal(await explore.evaluate(element => element === document.activeElement), true, `${label}: resizing retains keyboard focus`);
        await page.setViewportSize({ width, height: 900 });
    }
    const finalGeometry = await rects(page);
    assert.ok(finalGeometry.overflow <= 1, `${label}: no horizontal overflow`);
    assert.deepEqual(finalGeometry.overlaps, [], `${label}: no overlapping visible wrappers`);
    if (mobile) assert.ok(expanded.controls.every(control => control.height >= 44), `${label}: mobile disclosure controls retain 44px targets`);
    if (!mobile) await page.screenshot({ path: `${output}/${market}-${theme}-${width}-expanded.png`, fullPage: true });
    result.checks.push({ name: `core ${label}`, beforeHeight: initial.height, afterHeight: expanded.height });
    await context.close();
}
async function exposureState(browser, state) {
    const { context, page, releaseSession } = await open(browser, { market: 'US', width: 375, state });
    const section = page.getByTestId('market-mobile-exposure');
    const summary = section.locator('h2 > button > span:first-child');
    const panel = section.locator('[data-mobile-section-body]');
    try {
        await toggle(page, 'market-mobile-exposure', 'Enter');
        if (state === 'exposure-loading') {
            assert.equal(await summary.textContent(), 'Exposure mapLoading saved stocks…', 'loading summary is exact');
            await panel.locator('p[role="status"]').filter({ hasText: 'Loading saved securities…' }).waitFor();
            releaseSession();
            await panel.locator('p').filter({ hasText: /^No saved US stocks to map\./ }).waitFor();
            assert.equal(await summary.textContent(), 'Exposure mapNo saved US stocks to map', 'empty summary is exact');
        } else if (state === 'exposure-error') {
            await panel.locator('p[role="alert"]').filter({ hasText: 'Saved research could not be read. The market reading above is unaffected.' }).waitFor();
            assert.equal(await summary.textContent(), 'Exposure mapSaved research unavailable', 'error summary is exact');
        } else if (state.startsWith('classification-')) {
            await panel.getByText('Classification unavailable', { exact: true }).waitFor();
            assert.equal(await summary.textContent(), 'Exposure map1 saved US stock · 0 mapped · 1 classification unavailable');
            assert.equal(await panel.getByText('Unmapped', { exact: true }).count(), 0, 'failed classification is not labelled valid unmapped data');
        } else {
            const expectedMapped = state === 'exposure-unmapped' ? 0 : 1;
            await panel.getByRole('link', { name: 'AAPL', exact: true }).waitFor();
            await page.waitForFunction(count => document.querySelector('[data-testid="market-mobile-exposure"] h2 > button > span:first-child')?.textContent === `Exposure map1 saved US stock · ${count} mapped`, expectedMapped);
            assert.equal(await summary.textContent(), `Exposure map1 saved US stock · ${expectedMapped} mapped`, 'saved summary has the exact count');
            assert.equal(await panel.locator('[class*="tag"]').textContent(), `${expectedMapped} mapped · ${expectedMapped} higher`, 'exposure header reports the mapped count rather than total saved names');
        }
        result.checks.push({ name: state });
    } finally {
        releaseSession();
        await context.close();
    }
}

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
try {
    if (before) await baseline(browser);
    else {
        if (scenarios.includes('core')) for (const market of ['US', 'MY']) for (const theme of ['light', 'dark']) for (const width of [1280, 768, 375, 320]) await core(browser, market, width, theme);
        for (const state of ['exposure-loading', 'exposure-error', 'exposure-saved', 'exposure-unmapped', 'classification-error', 'classification-malformed']) if (scenarios.includes(state)) await exposureState(browser, state);
        if (scenarios.includes('outcomes-insufficient')) {
            const { context, page } = await open(browser, { market: 'US', width: 375, state: 'outcomes-insufficient' });
            const section = page.getByTestId('market-mobile-outcomes');
            const minimum = signal.US.data.metadata.historical_validation.minimum_sample_size;
            try {
                await toggle(page, 'market-mobile-outcomes', 'Enter');
                assert.equal(await section.locator('h2 > button > span:first-child').textContent(), `Historical outcomesOne-week evidence insufficient · 1/${minimum} periods needed · not a prediction`, 'insufficient-outcome summary is exact');
                await section.locator('[data-mobile-section-body]').getByTestId('similar-score-outcome-7').getByText(`Only 1 comparable period is available; ${minimum} are needed before outcomes are summarised.`, { exact: true }).waitFor();
                result.checks.push({ name: 'outcomes-insufficient' });
            } finally { await context.close(); }
        }
        if (scenarios.includes('missing-summaries')) {
            const { context, page } = await open(browser, { market: 'US', width: 375, state: 'missing-summaries' });
            try {
                await verifyStructure(page, 'missing summaries', true);
                assert.equal(await page.getByTestId('market-mobile-context').locator('h2 > button').textContent(), 'Market contextIndex moves unavailable+', 'missing context summary is exact');
                assert.equal(await page.getByTestId('market-mobile-outcomes').locator('h2 > button').textContent(), 'Historical outcomesOne-week outcomes unavailable · not a prediction+', 'missing outcomes summary is exact');
                assert.equal(await page.getByTestId('market-mobile-investigation').locator('h2 > button').textContent(), 'What changedScore comparison unavailable+', 'missing comparison summary is exact');
                for (const [index, id] of sectionIds.entries()) await toggle(page, id, index % 2 ? 'Space' : 'Enter');
                for (const id of sectionIds) assert.equal(await page.getByTestId(id).getByRole('button').first().getAttribute('aria-expanded'), 'true', `${id}: missing-data disclosure still expands`);
                result.checks.push({ name: 'missing-summaries' });
            } finally { await context.close(); }
        }
        if (scenarios.includes('summary-values')) {
            for (const market of ['US', 'MY']) for (const [state, expectedChange] of [['summary-values-unchanged', 'Score unchanged · since 11 Sep 2026'], ['summary-values-negative', '−1.00 score points · since 11 Sep 2026']]) {
                const { context, page } = await open(browser, { market, width: 375, state });
                const contextSection = page.getByTestId('market-mobile-context');
                const outcomeSection = page.getByTestId('market-mobile-outcomes');
                const changeSection = page.getByTestId('market-mobile-investigation');
                const benchmark = market === 'US' ? 'S&P 500' : 'FBM KLCI';
                const move = market === 'US' ? '−0.52%' : '+0.25%';
                try {
                    await verifyStructure(page, `${market} ${state}`, true);
                    assert.equal(await contextSection.locator('h2 > button > span:first-child').textContent(), `Market context${benchmark} ${move} · 1/2 down, 1/2 up`, 'rich context summary is exact');
                    assert.equal(await outcomeSection.locator('h2 > button > span:first-child').textContent(), 'Historical outcomesOne-week median +0.6% · 6 periods · preliminary evidence · not a prediction', 'rich outcomes summary is exact');
                    assert.equal((await changeSection.locator('h2 > button > span:first-child').textContent()).replace('Sept', 'Sep'), `What changed${expectedChange}`, 'score-delta summary preserves unchanged versus negative states');
                    await toggle(page, 'market-mobile-context', 'Enter');
                    await contextSection.locator('[data-mobile-section-body]').getByText(benchmark, { exact: true }).waitFor();
                    await contextSection.locator('[data-mobile-section-body]').getByText(move, { exact: true }).waitFor();
                    await toggle(page, 'market-mobile-outcomes', 'Space');
                    const oneWeek = outcomeSection.locator('[data-mobile-section-body]').getByTestId('similar-score-outcome-7');
                    await oneWeek.getByText('Evidence: Preliminary', { exact: true }).waitFor();
                    await oneWeek.getByText('+0.6%', { exact: true }).waitFor();
                    await oneWeek.getByText('50%', { exact: true }).waitFor();
                    await toggle(page, 'market-mobile-investigation', 'Enter');
                    assert.equal(await changeSection.getByRole('button').first().getAttribute('aria-expanded'), 'true', 'score-delta section expands with the rich summary');
                    result.checks.push({ name: `summary-values ${market} ${state}` });
                } finally { await context.close(); }
            }
        }
    }
    assert.deepEqual(result.errors, [], `Browser errors: ${result.errors.join(' | ')}`);
} catch (error) {
    result.errors.push(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
} finally {
    await browser.close();
    await writeFile(`${output}/report.json`, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ output, before, checks: result.checks.length, errors: result.errors }, null, 2));
}
