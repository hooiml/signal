import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { researchReadFixture, researchSnapshotFixture } from './harness/research-read-fixture.mjs';

// All records and network responses are synthetic; never target a remote server.
const origin = new URL(process.env.SIGNAL_QA_URL ?? 'http://127.0.0.1:3000');
assert.ok(origin.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(origin.hostname) && origin.pathname === '/' && !origin.search && !origin.hash);
const before = process.argv.includes('--before');
const output = path.resolve('.tmp/watchlist-review', before ? 'before' : 'after');
const fixtureResponse = await researchReadFixture().route.GET();
assert.equal(fixtureResponse.status, 200);
const seed = (await fixtureResponse.json()).data[0];
const fixtureTime = new Date('2026-10-29T12:00:00.000Z');
const date = offset => new Date(fixtureTime.getTime() + offset * 86400000).toISOString().slice(0, 10);
const makeRecord = (symbol, market, scheduled, reviewed, days = 30) => ({
    ...structuredClone(seed), symbol, market, companyName: `${symbol} fixture`,
    lastReviewedAt: reviewed ?? date(0), revision: 1, reviewHistory: [],
    monitoringRules: { ...seed.monitoringRules, reviewAgeDays: days },
    decisionJournal: { ...seed.decisionJournal, nextReviewAt: scheduled },
});
const records = [
    makeRecord('AAPL', 'US', date(-1), date(-40)),
    makeRecord('MSFT', 'US', date(0), date(-5)),
    makeRecord('1155', 'MY', date(2), date(-5)),
    makeRecord('1295', 'MY', null, null, null),
    makeRecord('ZZZ', 'US', date(0), date(-5)),
];
const views = [{ width: 1280, height: 900 }, { width: 768, height: 900 }, { width: 375, height: 812 }, { width: 320, height: 812 }];
const report = { base: origin.origin, before, scenarios: [], errors: [] };
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
try {
    for (const mode of ['owner', 'guest']) for (const theme of ['light', 'dark']) for (const viewport of views) {
        const result = { name: `${mode}-${theme}-${viewport.width}`, requests: [], errors: [] };
        let handoff = false;
        report.scenarios.push(result);
        const context = await browser.newContext({ viewport, colorScheme: theme, serviceWorkers: 'block', reducedMotion: 'reduce' });
        await context.addInitScript(({ theme, mode, records, appOrigin }) => {
            if (location.origin !== appOrigin || sessionStorage.getItem('watchlist-qa-seeded')) return;
            localStorage.setItem('signal-v8-theme-v1', theme);
            if (mode === 'guest') localStorage.setItem('signal.guest-research.v1', JSON.stringify({ version: 1, guestId: 'd197b5a7-6cd4-4dac-9926-0c44bda2cb39', records: records.map(({ symbol, market, companyName }) => ({ symbol, market, companyName, notes: '' })) }));
            sessionStorage.setItem('watchlist-qa-seeded', '1');
        }, { theme, mode, records, appOrigin: origin.origin });
        await context.route('**/api/**', async route => {
            const request = route.request(); const url = new URL(request.url());
            if (!handoff) result.requests.push(`${request.method()} ${url.pathname}${url.search}`);
            if (handoff && request.method() === 'POST' && url.pathname === '/api/research/inbox') return route.fulfill({ json: { success: true, data: { generatedAt: fixtureTime.toISOString(), monitoredCount: records.length, items: [], warnings: [] } } });
            if (handoff && request.method() === 'POST' && url.pathname === '/api/research/quotes') return route.fulfill({ json: { success: true, data: { fetchedAt: fixtureTime.toISOString(), items: request.postDataJSON().map(({ symbol, market }) => ({ success: true, data: { symbol, market, providerSymbol: symbol, fetchedAt: fixtureTime.toISOString(), quote: { ...researchSnapshotFixture.data.quote, currency: market === 'MY' ? 'MYR' : 'USD' } } })) } } });
            if (request.method() !== 'GET') { result.errors.push(`Unexpected write: ${request.method()} ${url.pathname}`); return route.abort(); }
            if (url.pathname === '/api/owner/session') return route.fulfill({ json: { success: true, data: { configured: true, unlocked: mode === 'owner' } } });
            if (url.pathname === '/api/research/watchlist') return route.fulfill({ json: { success: true, data: records, archivedSymbols: [] } });
            if (url.pathname.startsWith('/api/research/symbol/')) {
                const payload = structuredClone(researchSnapshotFixture); payload.data.symbol = decodeURIComponent(url.pathname.split('/').at(-1)); payload.data.market = url.searchParams.get('market') === 'MY' ? 'MY' : 'US'; payload.data.quote.currency = payload.data.market === 'MY' ? 'MYR' : 'USD';
                return route.fulfill({ json: payload });
            }
            return route.fulfill({ json: { success: true, data: {} } });
        });
        const page = await context.newPage(); page.setDefaultTimeout(15000);
        await page.clock.install({ time: fixtureTime });
        page.on('pageerror', error => result.errors.push(`pageerror: ${error.message}`));
        page.on('console', message => { if (['warning', 'error'].includes(message.type()) && message.text() !== 'Service Worker registration blocked by Playwright') result.errors.push(`${message.type()}: ${message.text()}`); });
        try {
            await page.goto(`${origin.origin}/research-v8`, { waitUntil: 'domcontentloaded' });
            const home = page.getByRole('tablist', { name: 'Research home' }); await home.waitFor();
            await page.waitForFunction(() => document.querySelector('#home-tab-watchlist')?.textContent?.includes('5'));
            await home.getByRole('tab', { name: /^Watchlist/ }).click();
            const panel = page.locator('#home-panel-watchlist');
            await panel.getByText('AAPL', { exact: true }).first().waitFor();
            if (!before) {
                const rows = panel.getByTestId('watchlist-row');
                const symbols = async () => rows.evaluateAll(items => items.map(item => item.dataset.symbol));
                const sort = panel.getByLabel('Sort watchlist');
                assert.equal(await rows.count(), 5);
                assert.equal(await sort.locator('option[value=high]').evaluate(el => el.disabled), true);
                assert.equal(await sort.locator('option[value=move]').evaluate(el => el.disabled), true);
                assert.match(await panel.innerText(), /Price sorting is unavailable/);
                if (mode === 'owner') {
                    assert.equal(await panel.getByRole('link', { name: 'Start review for AAPL · US (new tab)' }).getAttribute('href'), '/research?workspace=research&ticker=AAPL&market=US&review=edit');
                    assert.equal(await panel.getByRole('link', { name: 'Start review for AAPL · US (new tab)' }).getAttribute('target'), '_blank');
                    if (theme === 'light' && viewport.width === 1280) {
                        assert.ok(!result.requests.some(item => item.includes('/api/research/quotes')));
                        handoff = true;
                        const draftPage = await context.newPage();
                        await draftPage.goto(`${origin.origin}/research?workspace=research&ticker=AAPL&market=US&review=edit`, { waitUntil: 'domcontentloaded' });
                        const draft = draftPage.getByTestId('research-decision-journal').locator('[data-review-step="thesis"] label').filter({ hasText: /^Why interested/ }).locator('textarea');
                        await draft.fill('Unsaved separate owner draft');
                        for (const [symbol, market] of [['AAPL', 'US'], ['1155', 'MY']]) {
                            const link = panel.getByRole('link', { name: `Start review for ${symbol} · ${market} (new tab)` });
                            const popupPromise = page.waitForEvent('popup'); await link.focus(); await page.keyboard.press('Enter'); const popup = await popupPromise;
                            await popup.getByTestId('research-decision-journal').getByRole('navigation', { name: 'Review steps' }).waitFor();
                            const destination = new URL(popup.url());
                            assert.equal(destination.searchParams.get('ticker'), symbol); assert.equal(destination.searchParams.get('market'), market); assert.equal(destination.searchParams.get('review'), 'edit');
                            assert.equal(await draft.inputValue(), 'Unsaved separate owner draft'); await popup.close();
                        }
                        await draftPage.close();
                        handoff = false;
                    }
                    await sort.selectOption('review');
                    const order = await symbols();
                    assert.ok(order.indexOf('AAPL') < order.indexOf('MSFT') && order.indexOf('MSFT') < order.indexOf('ZZZ') && order.at(-1) === '1295', `Review order: ${order}`);
                    await panel.getByRole('button', { name: /Due this week/ }).click();
                    assert.equal(await sort.isDisabled(), true);
                    assert.ok((await symbols()).includes('AAPL') && !(await symbols()).includes('1295'));
                    await panel.getByRole('button', { name: 'Reload watchlist' }).click();
                    await page.waitForFunction(() => !document.querySelector('#home-panel-watchlist button:disabled')?.textContent?.includes('Reload'));
                    assert.equal(await sort.isDisabled(), true);
                    await panel.getByRole('button', { name: 'All saved' }).click();
                } else {
                    assert.equal(await panel.getByRole('button', { name: /Due this week/ }).count(), 0);
                    assert.equal(await panel.getByRole('link', { name: /Start review/ }).count(), 0);
                    assert.equal(await panel.getByText('No review schedule', { exact: true }).count(), 5);
                }
                await sort.selectOption('symbol');
                assert.deepEqual(await symbols(), ['1155', '1295', 'AAPL', 'MSFT', 'ZZZ']);
                await panel.locator('label').filter({ hasText: /^Market/ }).locator('select').selectOption('MY');
                assert.deepEqual(await symbols(), ['1155', '1295']);
                await panel.getByLabel('Find in watchlist').fill('1155');
                assert.deepEqual(await symbols(), ['1155']);
                await panel.getByLabel('Find in watchlist').fill('nothing matches');
                assert.match(await panel.innerText(), /No watchlist stocks match these filters/);
                await panel.getByRole('button', { name: 'Show all saved stocks' }).click();
                assert.equal(await rows.count(), 5);
                await sort.focus(); await page.keyboard.press('Home'); await page.keyboard.press('Enter'); await sort.blur();
                assert.equal(await sort.inputValue(), 'saved');
                assert.deepEqual(await symbols(), mode === 'owner' ? ['1155', '1295', 'AAPL', 'MSFT', 'ZZZ'] : ['AAPL', 'MSFT', '1155', '1295', 'ZZZ']);
                assert.ok(!result.requests.some(item => item.includes('/api/research/quotes')), `Unexpected quote request: ${result.requests}`);
            }
            result.geometry = await page.evaluate(() => ({ viewport: innerWidth, document: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) }));
            assert.ok(result.geometry.document <= result.geometry.viewport + 1, JSON.stringify(result.geometry));
            if (!before) {
                result.controls = await panel.locator('label input, label select').evaluateAll(els => els.map(el => ({ top: el.getBoundingClientRect().top, height: el.getBoundingClientRect().height, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right })));
                assert.ok(result.controls.every(rect => rect.height >= 40 && rect.left >= 0 && rect.right <= viewport.width + 1), JSON.stringify(result.controls));
                if (viewport.width > 900) assert.ok(Math.max(...result.controls.map(rect => rect.top)) - Math.min(...result.controls.map(rect => rect.top)) <= 2, JSON.stringify(result.controls));
                result.rowGeometry = await panel.getByTestId('watchlist-row').evaluateAll(rows => rows.map(row => {
                    const rect = el => el?.getBoundingClientRect().toJSON() ?? null;
                    const time = row.querySelector('time');
                    return { row: rect(row), button: rect(row.querySelector('button')), action: rect(row.querySelector('a')), time: time ? { align: getComputedStyle(time).textAlign, numeric: getComputedStyle(time).fontVariantNumeric } : null };
                }));
                for (const row of result.rowGeometry) {
                    assert.ok(row.button.left >= row.row.left - 1 && row.button.right <= row.row.right + 1);
                    if (row.action) assert.ok(row.action.top >= row.button.bottom - 1 && row.action.left >= row.row.left && row.action.right <= row.row.right);
                    if (row.time) assert.equal(row.time.align, 'right');
                    if (row.time) assert.match(row.time.numeric, /tabular-nums/);
                }
            }
            await page.screenshot({ path: path.join(output, `${result.name}.png`), fullPage: true });
            assert.deepEqual(result.errors, []);
        } catch (error) { result.errors.push(error.stack ?? String(error)); report.errors.push(result.name); console.error(result.name, error.message, (await page.locator('body').innerText()).slice(0, 2000), result.requests); }
        finally { await context.close(); }
    }
    if (!before) {
        const result = { name: 'owner-boundaries', requests: [], errors: [] }; report.scenarios.push(result);
        const context = await browser.newContext({ viewport: views[0], serviceWorkers: 'block' });
        let release; const gate = new Promise(resolve => { release = resolve; });
        let reads = 0;
        const sundayRecord = makeRecord('AAPL', 'US', '2026-11-01', '2026-10-28');
        await context.route('**/api/**', async route => {
            const request = route.request(), url = new URL(request.url()); result.requests.push(`${request.method()} ${url.pathname}`);
            if (request.method() !== 'GET') { result.errors.push(`Unexpected write ${request.method()} ${url.pathname}`); return route.abort(); }
            if (url.pathname === '/api/owner/session') return route.fulfill({ json: { success: true, data: { configured: true, unlocked: true } } });
            if (url.pathname === '/api/research/watchlist') {
                reads++;
                if (reads === 1) { await gate; return route.fulfill({ json: { success: false, error: 'Fixture unavailable' } }); }
                if (reads === 2) return route.fulfill({ json: { success: true, data: [], archivedSymbols: [] } });
                if (reads === 3) return route.fulfill({ json: { success: true, data: [sundayRecord], archivedSymbols: [] } });
                if (reads === 4) return route.fulfill({ json: { success: false, error: 'Fixture refresh failure' } });
                return route.fulfill({ json: { success: true, data: [{ ...sundayRecord, decisionJournal: { ...sundayRecord.decisionJournal, nextReviewAt: '2026-12-01' } }], archivedSymbols: [] } });
            }
            return route.fulfill({ json: { success: true, data: {} } });
        });
        const page = await context.newPage(); page.setDefaultTimeout(15000); await page.clock.install({ time: new Date('2026-11-01T23:59:50.000Z') }); await page.clock.pauseAt(new Date('2026-11-01T23:59:50.000Z'));
        try {
            await page.goto(`${origin.origin}/research-v8`, { waitUntil: 'domcontentloaded' });
            await page.getByRole('tab', { name: /^Watchlist/ }).click();
            const panel = page.locator('#home-panel-watchlist');
            await panel.getByText('Refreshing saved research…').waitFor();
            assert.equal(await panel.getByText(/Guest bookmarks have no review/).count(), 0);
            release(); await panel.getByText(/Saved research could not be refreshed/).waitFor();
            await panel.getByRole('button', { name: 'Retry saved research' }).click();
            await panel.getByText('Your watchlist is empty.').waitFor();
            await panel.getByRole('button', { name: 'Reload watchlist' }).click();
            await panel.getByTestId('watchlist-row').getByText('Due today').waitFor();
            await page.clock.fastForward(11000);
            await panel.getByTestId('watchlist-row').getByText('Overdue').waitFor();
            assert.match(await panel.innerText(), /2026-11-08 \(Sunday, UTC\)/);
            await panel.getByRole('button', { name: /Due this week/ }).click();
            await panel.getByRole('button', { name: 'Reload watchlist' }).click();
            await panel.getByText(/Previously loaded records remain visible/).waitFor();
            assert.equal(await panel.getByTestId('watchlist-row').count(), 1);
            await panel.getByRole('button', { name: 'Retry saved research' }).click();
            await panel.getByText('No reviews due this week match these filters.').waitFor();
            assert.equal(await panel.getByTestId('watchlist-row').count(), 0);
            assert.ok(!result.requests.some(item => item.includes('/api/research/quotes')));
            assert.deepEqual(result.errors, []);
        } catch (error) { result.errors.push(error.stack ?? String(error)); report.errors.push(result.name); console.error(result.name, error.message); }
        finally { release(); await context.close(); }
        for (const failure of [false, true]) {
            const result = { name: `automatic-watchlist-reload-${failure ? 'unauthorized' : 'empty'}`, requests: [], errors: [] }; report.scenarios.push(result);
            const context = await browser.newContext({ serviceWorkers: 'block' }); let reads = 0;
            await context.route('**/api/**', async route => {
                const request = route.request(), url = new URL(request.url()); result.requests.push(`${request.method()} ${url.pathname}`);
                if (request.method() !== 'GET') { result.errors.push('Unexpected write'); return route.abort(); }
                if (url.pathname === '/api/owner/session') return route.fulfill({ json: { success: true, data: { configured: true, unlocked: true } } });
                if (url.pathname === '/api/research/watchlist') {
                    reads++;
                    if (reads === 1) return route.fulfill({ json: { success: true, data: [records[0]], archivedSymbols: [] } });
                    if (failure) return route.fulfill({ status: 401, json: { success: false, error: 'Locked' } });
                    return route.fulfill({ json: { success: true, data: [], archivedSymbols: [] } });
                }
                return route.fulfill({ json: { success: true, data: {} } });
            });
            const page = await context.newPage(); page.setDefaultTimeout(15000); await page.clock.install({ time: fixtureTime });
            try {
                await page.goto(`${origin.origin}/research-v8`, { waitUntil: 'domcontentloaded' });
                const panel = page.locator('#home-panel-watchlist'); await panel.getByTestId('watchlist-row').waitFor();
                await panel.getByRole('button', { name: /Due this week/ }).click();
                await panel.getByRole('button', { name: 'Reload watchlist' }).click();
                if (failure) await panel.getByText(/unlock|access/i).first().waitFor();
                else await panel.getByText('Your watchlist is empty.').waitFor();
                assert.equal(await panel.isVisible(), true); assert.deepEqual(result.errors, []);
            } catch (error) { result.errors.push(error.stack ?? String(error)); report.errors.push(result.name); console.error(result.name, error.message); }
            finally { await context.close(); }
        }
    }
} finally { await browser.close(); await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); }
if (report.errors.length) throw new Error(`Failed scenarios: ${report.errors.join(', ')}`);
console.log(`Captured ${report.scenarios.length} fixture scenarios in ${output}`);
