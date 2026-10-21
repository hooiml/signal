import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import ts from 'typescript';
import { researchSnapshotFixture } from './harness/research-read-fixture.mjs';

// Actual legacy panels and domain fixtures; every API request is intercepted. No SQL/providers.
const base = process.env.SIGNAL_QA_URL || 'http://127.0.0.1:3101';
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'Owner-panel QA requires an owned localhost server.');
const origin = new URL(base).origin;
const output = '.tmp/research-owner-panels';
await mkdir(output, { recursive: true });

const modules = new Map();
function domain(file) {
    const absolute = path.resolve(file);
    if (modules.has(absolute)) return modules.get(absolute).exports;
    const compiled = { exports: {} };
    modules.set(absolute, compiled);
    const require = id => {
        assert.ok(id.startsWith('.') || id.startsWith('@/'), `Unexpected fixture dependency: ${id}`);
        const resolved = id.startsWith('@/') ? path.resolve('src', id.slice(2)) : path.resolve(path.dirname(absolute), id);
        return domain(resolved.endsWith('.ts') ? resolved : `${resolved}.ts`);
    };
    const code = ts.transpileModule(readFileSync(absolute, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: absolute,
    }).outputText;
    new Function('require', 'module', 'exports', 'fetch', code)(require, compiled, compiled.exports, () => {
        throw new Error('Network access forbidden in domain fixture.');
    });
    return compiled.exports;
}

const { createResearchRecord, appendResearchReview } = domain('src/lib/research/records.ts');
const { createResearchValuationPlan } = domain('src/lib/research/research-valuation-plan.ts');
const record = appendResearchReview(createResearchRecord({ symbol: 'AAPL', market: 'US', companyName: 'Fixture Apple' }), '2026-10-01T12:00:00.000Z');
const snapshot = structuredClone(researchSnapshotFixture);
snapshot.data.fetchedAt = new Date().toISOString();
snapshot.data.quote.observedAt = '2026-10-20T20:00:00.000Z';
snapshot.data.quote.instrumentType = 'EQUITY';
const definitions = [
    { key: 'memory', tool: 'memory', panel: 'research-memory-dock' },
    { key: 'expectations', tool: 'expectations', panel: 'expectation-reality', input: 'Expected narrative', save: 'Save review', saved: 'Expectation review saved.' },
    { key: 'valuation-plan', tool: 'valuation', panel: 'valuation-reasoning-v9', input: 'Current EPS', save: 'Save assumptions', saved: 'Valuation assumptions saved.' },
    { key: 'calibration', tool: 'decision-review', panel: 'decision-calibration-v10', input: 'Process note', save: 'Save process review', saved: 'Process review saved.' },
];
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const results = [];
try {
    for (const width of [1280, 768, 375]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
        const errors = [], unexpected = [], requests = [], contrasts = [];
        const getStatus = Object.fromEntries(definitions.map(({ key }) => [key, 401]));
        const postStatus = Object.fromEntries(definitions.map(({ key }) => [key, 401]));
        let unlockTarget = null;
        context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
        await context.route('**/*', async route => {
            if (new URL(route.request().url()).origin !== origin) {
                unexpected.push(`External request blocked: ${route.request().url()}`);
                return route.abort();
            }
            return route.fallback();
        });
        await context.route('**/api/**', async route => {
            const request = route.request();
            const url = new URL(request.url());
            const method = request.method();
            requests.push({ path: url.pathname, method, body: method === 'POST' ? request.postDataJSON() : null });
            if (url.pathname === '/api/research/watchlist' && method === 'GET') return route.fulfill({ json: { success: true, data: [record], archivedSymbols: [] } });
            if (url.pathname.startsWith('/api/research/symbol/') && method === 'GET') return route.fulfill({ json: snapshot });
            if (url.pathname === '/api/research/quotes' && method === 'POST') return route.fulfill({ json: { success: true, data: [{ symbol: 'AAPL', success: true, data: snapshot.data }] } });
            if (url.pathname === '/api/research/inbox' && method === 'POST') return route.fulfill({ json: { success: true, data: { generatedAt: snapshot.data.fetchedAt, monitoredCount: 1, items: [], warnings: [] } } });
            if (url.pathname === '/api/owner/session' && method === 'POST') {
                assert.equal(request.postDataJSON().secret, 'fixture-owner-only');
                assert.ok(unlockTarget);
                postStatus[unlockTarget] = 200;
                return route.fulfill({ json: { success: true } });
            }
            const definition = definitions.find(({ key }) => url.pathname === `/api/research/${key}/AAPL`);
            if (definition) {
                assert.ok(method === 'GET' || method === 'POST', `Unexpected private request method: ${method}`);
                const status = (method === 'GET' ? getStatus : postStatus)[definition.key];
                if (definition.key === 'memory' && method === 'POST' && status === 401) getStatus.memory = 401;
                if (status !== 200) return route.fulfill({ status, json: {
                    success: false,
                    code: status === 401 ? 'OWNER_ACCESS_REQUIRED' : status === 503 ? 'OWNER_ACCESS_UNCONFIGURED' : 'FIXTURE_FAILURE',
                    error: status === 401 ? 'Unlock Signal to access saved research.' : 'Fixture unavailable.',
                } });
                const data = method === 'POST' ? request.postDataJSON()
                    : definition.key === 'valuation-plan' ? createResearchValuationPlan('AAPL') : [];
                return route.fulfill({ json: { success: true, data } });
            }
            if (method !== 'GET') unexpected.push(`${method} ${url.pathname}`);
            return route.fulfill({ status: 404, json: { success: false, error: 'Not included in owner-panel fixture.' } });
        });
        const page = await context.newPage();
        page.setDefaultTimeout(20_000);
        const openWorkspace = async () => {
            await page.goto(`${base}/research?workspace=research&ticker=AAPL&market=US`, { waitUntil: 'domcontentloaded' });
            const tools = page.getByTestId('research-review-tools');
            await tools.locator('details > summary').first().click();
            await tools.getByRole('heading', { name: 'Review tools', exact: true }).waitFor();
        };
        const selectPanel = async definition => {
            await page.locator(`[data-review-tool-control="${definition.tool}"]`).click();
            const panel = page.getByTestId(definition.panel);
            await panel.waitFor();
            return panel;
        };
        const inspectNotice = async (panel, issue) => {
            const notice = panel.getByTestId('owner-access-notice');
            await notice.waitFor();
            assert.equal(await notice.getAttribute('data-owner-access-issue'), issue);
            await notice.scrollIntoViewIfNeeded();
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, `No document overflow at ${width}px.`);
            for (const control of await notice.locator('a, button').all()) {
                const box = await control.boundingBox();
                assert.ok(box && box.height >= 43, 'Owner access actions have at least a 44px touch target.');
            }
            const contrast = await notice.locator('p').first().evaluate(node => {
                const canvas = document.createElement('canvas');
                canvas.width = canvas.height = 1;
                const context = canvas.getContext('2d', { willReadFrequently: true });
                const rgba = color => {
                    context.clearRect(0, 0, 1, 1);
                    context.fillStyle = color;
                    context.fillRect(0, 0, 1, 1);
                    return [...context.getImageData(0, 0, 1, 1).data].map(value => value / 255);
                };
                const over = (foreground, background) => foreground.slice(0, 3).map((value, index) => value * foreground[3] + background[index] * (1 - foreground[3]));
                const layers = [];
                for (let current = node; current; current = current.parentElement) {
                    const style = getComputedStyle(current);
                    if (style.backgroundImage !== 'none') throw new Error('Contrast measurement requires a solid background.');
                    const layer = rgba(style.backgroundColor);
                    layers.push(layer);
                    if (layer[3] === 1) break;
                }
                const background = layers.reverse().reduce((under, layer) => over(layer, under), [1, 1, 1]);
                const foreground = over(rgba(getComputedStyle(node).color), background);
                const luminance = color => color.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
                    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
                const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
                return { foreground: foreground.map(value => Math.round(value * 255)), background: background.map(value => Math.round(value * 255)), ratio: (values[0] + 0.05) / (values[1] + 0.05) };
            });
            assert.ok(contrast.ratio >= 4.5, `Owner access explanation meets normal-text contrast: ${contrast.ratio.toFixed(2)}:1`);
            contrasts.push(contrast);
            return notice;
        };

        for (const status of [401, 503]) {
            for (const { key } of definitions) getStatus[key] = status;
            const before = requests.filter(request => request.method === 'POST' && request.path.includes('/memory/')).length;
            await openWorkspace();
            for (const definition of definitions) {
                const panel = await selectPanel(definition);
                const notice = await inspectNotice(panel, status === 401 ? 'locked' : 'unconfigured');
                if (definition.input) assert.equal(await panel.getByLabel(definition.input, { exact: true }).count(), 0, 'An unreadable history does not produce a blank saved editor.');
                if (status === 401) {
                    const unlock = notice.getByRole('link', { name: 'Unlock Signal', exact: true });
                    const href = new URL(await unlock.getAttribute('href'), base);
                    const currentUrl = new URL(page.url());
                    assert.equal(href.searchParams.get('next'), currentUrl.pathname + currentUrl.search + currentUrl.hash);
                    await unlock.focus();
                    assert.equal(await unlock.evaluate(node => document.activeElement === node), true);
                } else assert.equal(await notice.getByRole('link').count(), 0, 'Unconfigured access is not described as an unlockable session.');
                await panel.screenshot({ path: `${output}/${definition.key}-get-${status}-${width}.png` });
            }
            assert.equal(requests.filter(request => request.method === 'POST' && request.path.includes('/memory/')).length, before, 'A denied memory GET never triggers an automatic POST.');
        }

        getStatus.calibration = 500;
        await openWorkspace();
        const failedCalibration = await selectPanel(definitions[3]);
        await failedCalibration.getByText('Decision review history could not be loaded.', { exact: true }).waitFor();
        assert.equal(await failedCalibration.getByLabel('Process note').count(), 0, 'A calibration 500 does not become an empty successful review.');
        await failedCalibration.getByRole('button', { name: 'Retry decision history' }).waitFor();

        for (const definition of definitions.filter(item => item.input)) {
            getStatus[definition.key] = 200;
            postStatus[definition.key] = 401;
            await openWorkspace();
            const panel = await selectPanel(definition);
            const input = panel.getByLabel(definition.input, { exact: true });
            const value = definition.key === 'valuation-plan' ? '12.34' : `Unsaved ${definition.key} draft at ${width}px`;
            await input.fill(value);
            await page.evaluate(() => history.replaceState(null, '', location.pathname + location.search + '#owner-draft'));
            const currentUrl = page.url();
            await panel.getByRole('button', { name: definition.save, exact: true }).click();
            const notice = await inspectNotice(panel, 'locked');
            assert.equal(await input.inputValue(), value, 'Denied saves preserve the draft.');
            await notice.getByText('Your draft remains in this tab and has not been saved.', { exact: false }).waitFor();
            const unlock = notice.getByRole('link', { name: 'Unlock Signal in a new tab', exact: true });
            assert.equal(await unlock.getAttribute('target'), '_blank');
            const href = new URL(await unlock.getAttribute('href'), base);
            const current = new URL(currentUrl);
            assert.equal(href.searchParams.get('next'), current.pathname + current.search + current.hash);
            await panel.screenshot({ path: `${output}/${definition.key}-draft-locked-${width}.png` });
            unlockTarget = definition.key;
            const popupPromise = page.waitForEvent('popup');
            await unlock.click();
            const popup = await popupPromise;
            await popup.getByLabel('Access secret').fill('fixture-owner-only');
            await popup.getByRole('button', { name: 'Unlock', exact: true }).click();
            await popup.waitForURL(currentUrl);
            await popup.close();
            assert.equal(page.url(), currentUrl, 'Unlocking in another tab preserves the original workspace URL.');
            assert.equal(await input.inputValue(), value);
            await panel.getByRole('button', { name: definition.save, exact: true }).click();
            await panel.getByText(definition.saved, { exact: true }).waitFor();

            const changed = definition.key === 'valuation-plan' ? '14.56' : `${value}; retained after setup failure`;
            await input.fill(changed);
            postStatus[definition.key] = 503;
            await panel.getByRole('button', { name: definition.save, exact: true }).click();
            const setupNotice = await inspectNotice(panel, 'unconfigured');
            assert.equal(await input.inputValue(), changed);
            assert.equal(await setupNotice.getByRole('link').count(), 0);
            await panel.screenshot({ path: `${output}/${definition.key}-draft-unconfigured-${width}.png` });
            postStatus[definition.key] = 200;
            await panel.getByRole('button', { name: definition.save, exact: true }).click();
            await panel.getByText(definition.saved, { exact: true }).waitFor();
        }

        getStatus.memory = 200;
        postStatus.memory = 401;
        const memoryPostsBefore = requests.filter(request => request.method === 'POST' && request.path.includes('/memory/')).length;
        await openWorkspace();
        const memory = page.getByTestId('research-memory-dock');
        await inspectNotice(memory, 'locked');
        await memory.getByText('Showing browser-local memory.', { exact: false }).waitFor();
        assert.equal(requests.filter(request => request.method === 'POST' && request.path.includes('/memory/')).length, memoryPostsBefore + 1);
        const retryResponse = page.waitForResponse(response => response.url().includes('/api/research/memory/AAPL') && response.request().method() === 'GET');
        await memory.getByRole('button', { name: 'Retry saved research', exact: true }).click();
        await retryResponse;
        await inspectNotice(memory, 'locked');
        assert.equal(requests.filter(request => request.method === 'POST' && request.path.includes('/memory/')).length, memoryPostsBefore + 1, 'A denied retry read does not restart automatic persistence.');
        await memory.screenshot({ path: `${output}/memory-post-denied-${width}.png` });
        assert.deepEqual(errors, [], 'No page runtime errors.');
        assert.deepEqual(unexpected, [], 'No unexpected mutations or external requests.');
        results.push({ width, states: 'All GET denials, failed calibration read, retained drafts, explicit new-tab unlock, retry saves, memory write gating', minimumNoticeContrast: Math.min(...contrasts.map(value => value.ratio)), contrastSamples: contrasts });
        await context.close();
        console.log(`PASS owner-panel browser matrix ${width}px`);
    }
} finally { await browser.close(); }
await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2) + '\n');
console.log(`Owner-panel QA passed. Screenshots and results: ${output}`);
