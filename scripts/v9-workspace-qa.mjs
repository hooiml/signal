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
function intradayFixture(url) {
    const day = new Date().toISOString().slice(0, 10);
    const market = url.searchParams.get('market');
    const mode = url.searchParams.get('mode');
    const enableSocial = url.searchParams.get('enableSocial') === 'true';
    const baseline = { id: '100', capturedAt: day + 'T01:00:00.000Z', score: 43, previousScore: null, delta: null,
        tier: 'neutral', status: 'baseline', reason: { code: 'baseline', text: 'First recorded reading.' }, accounting: null };
    const change = { id: '101', capturedAt: day + 'T07:15:00.000Z', score: 30, previousScore: 43, delta: -13,
        tier: 'sell', status: 'changed', reason: { code: 'vix-threshold-entered', text: 'VIX rose from 29.8 to 30.4. Its weight changed from 35% to 85%.' },
        accounting: { componentDelta: 11.6, neutralDelta: -25, roundingResidual: 0.4,
            drivers: [{ key: 'vix', name: 'VIX', delta: 11.6, beforeValue: 29.8, afterValue: 30.4,
                beforeWeight: 0.35, afterWeight: 0.85, scoreEffect: -1.4, weightEffect: 13 }] } };
    const entries = market === 'MY' ? [] : url.searchParams.has('before') ? [baseline] : [change];
    return { success: true, data: { market, mode, enableSocial, day, entries, hasEarlierCaptures: market === 'US' && !url.searchParams.has('before') } };
}
function benchmarkChartFixture(symbol) {
    const isKlci = symbol === 'KLCI';
    const baseVal = isKlci ? 1620 : 510;
    const step = isKlci ? 0.35 : 0.14;
    const points = [];
    for (let d = 0; d < 107; d++) {
        const dt = new Date(Date.UTC(2026, 5, 1 + d));
        const wave = Math.sin(d / 6) * (isKlci ? 8 : 3.2);
        const close = Number((baseVal + d * step + wave).toFixed(2));
        points.push({ time: dt.toISOString().slice(0, 10), open: close, high: close, low: close, close, volume: 1_000_000 });
    }
    return { success: true, data: { symbol, market: isKlci ? 'MY' : 'US', fetchedAt: '2026-09-12T00:00:00.000Z', chart: { interval: '1d', points } } };
}
function internalsFixture(rawMarket) {
    const market = rawMarket === 'MY' ? 'MY' : 'US';
    const makeSeries = (start, delta, baseVal) => Array.from({ length: 20 }, (_, i) => {
        const dt = new Date(Date.UTC(2026, 7, 20 + i));
        return { date: dt.toISOString().slice(0, 10), value: Number((start + i * delta).toFixed(2)), baseline: baseVal };
    });
    const items = market === 'MY'
        ? [
            { id: 'klci_trend', name: 'FBM KLCI Longer Trend', subtitle: 'Index close vs 125-day MA', latestLabel: '1648', baselineLabel: '125DMA: 1605 (+2.7%)', tone: 'up', description: 'FBM KLCI holds above its 125-day baseline.', points: makeSeries(1612, 1.8, 1605) },
            { id: 'myr_fx', name: 'Ringgit Stability (USD/MYR)', subtitle: 'Spot rate vs 50-day MA', latestLabel: '4.420', baselineLabel: '50DMA: 4.390 (+0.7%)', tone: 'neutral', description: 'USD/MYR sits near its 50-day average.', points: makeSeries(4.36, 0.003, 4.39) },
            { id: 'global_credit', name: 'US Credit Check (HYG / LQD)', subtitle: 'Global risk appetite vs 50-day MA', latestLabel: '97.8', baselineLabel: '50DMA: 99.6 (-1.8%)', tone: 'down', description: 'US high-yield credit lags investment grade.', points: makeSeries(100.4, -0.13, 99.6) },
        ]
        : [
            { id: 'credit', name: 'Credit Stress', subtitle: 'HYG / LQD ratio vs 50-day MA', latestLabel: '97.8', baselineLabel: '50DMA: 99.6 (-1.8%)', tone: 'down', description: 'High-yield bonds lagged investment-grade credit.', points: makeSeries(100.4, -0.13, 99.6) },
            { id: 'breadth', name: 'Equal-Weight Breadth', subtitle: 'RSP / SPY ratio vs 50-day MA', latestLabel: '0.295', baselineLabel: '50DMA: 0.299 (-1.3%)', tone: 'neutral', description: 'Equal-weight participation trailed megacaps.', points: makeSeries(0.303, -0.0004, 0.299) },
            { id: 'safe_haven', name: 'Safe-Haven Demand', subtitle: 'SPY vs TLT 20D relative return', latestLabel: '-3.4%', baselineLabel: 'Baseline: 0.0% neutral', tone: 'down', description: 'Treasuries outperformed equities over 20 days.', points: makeSeries(1.4, -0.25, 0) },
        ];
    return { success: true, data: { market, available: true, updatedAt: '2026-09-12T00:00:00.000Z', items } };
}
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
const fixture = marketRequestFixture({ providerOverrides: {
    fetchVIX: () => ({ price: 30.4, change: 0, observedAt: new Date('2026-09-11T20:00:00Z') }),
    fetchMarketNews: market => [{
        title: market === 'MY' ? 'Bursa banks steady on OPR hold' : 'Tech leads US pullback as VIX climbs',
        source: market === 'MY' ? 'Google News (MY)' : 'CNBC Finance',
        link: 'https://example.test/headline',
        pubDate: '2026-09-11T22:00:00Z',
    }],
} });
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
        if (url.pathname === '/api/signals/intraday' && req.method() === 'GET') return route.fulfill({ json: intradayFixture(url) });
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
        if (url.pathname === '/api/signals/fear-greed' && req.method() === 'GET') return route.fulfill({ json: { success: true, data: { available: true, score: 31, rating: 'fear', previousClose: 35, oneWeekAgo: 44, oneMonthAgo: 56, updatedAt: '2026-09-12T00:00:00.000Z' } } });
        if (url.pathname === '/api/signals/internals' && req.method() === 'GET') return route.fulfill({ json: internalsFixture(url.searchParams.get('market')) });
        if ((url.pathname === '/api/research/chart/VOO' || url.pathname === '/api/research/chart/KLCI') && req.method() === 'GET') return route.fulfill({ json: benchmarkChartFixture(url.pathname.split('/').pop()) });
        if (url.pathname === '/api/signals/replay' && req.method() === 'GET') return route.fulfill({ json: { success: true, data: { market: url.searchParams.get('market') || 'US', mode: url.searchParams.get('mode') || 'standard', enableSocial: url.searchParams.get('enableSocial') === 'true', summaries: [] } } });
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
        await scenario(`market landing ${width} ${theme}`, async () => {
            await page.goto(`${base}/v9`, { waitUntil: 'domcontentloaded' });
            await page.getByTestId('v9-workspace').filter({ visible: true }).waitFor();
            await page.getByRole('heading', { level: 1 }).waitFor();
            await page.getByRole('group', { name: 'Select market' }).waitFor();
            await page.getByRole('region', { name: 'Market assessment' }).waitFor();
            const crossCheck = page.getByRole('region', { name: 'Cross-Market Check' });
            await crossCheck.waitFor();
            await crossCheck.getByText('Credit Stress').waitFor();
            await crossCheck.getByText('Equal-Weight Breadth').waitFor();
            await crossCheck.getByText('Safe-Haven Demand').waitFor();
            await crossCheck.getByText(/31\/100/).waitFor();
            await page.getByRole('heading', { name: /market condition score/i }).waitFor();
            assert.ok(await page.getByRole('slider', { name: /market condition score/i }).count(), 'score chart');
            await page.getByTestId('benchmark-overlay-path').waitFor();
            const benchmarkColour = theme === 'dark' ? 'rgb(96, 165, 250)' : 'rgb(37, 99, 235)';
            const benchmarkAppearance = await page.evaluate(() => {
                const line = document.querySelector('[data-testid="benchmark-overlay-path"]');
                const marker = document.querySelector('[data-testid="benchmark-overlay-marker"]');
                const legend = document.querySelector('[data-testid="benchmark-overlay-legend"]');
                const axis = document.querySelector('[data-testid="benchmark-overlay-axis"]');
                assertNotNull(line, 'benchmark line');
                assertNotNull(marker, 'benchmark marker');
                assertNotNull(legend, 'benchmark legend');
                assertNotNull(axis, 'benchmark percentage axis');
                return {
                    lineColour: getComputedStyle(line).stroke,
                    lineDash: getComputedStyle(line).strokeDasharray,
                    markerColour: getComputedStyle(marker).stroke,
                    legendColour: getComputedStyle(legend).borderTopColor,
                    legendStyle: getComputedStyle(legend).borderTopStyle,
                    axisColour: getComputedStyle(axis).color,
                };
                function assertNotNull(element, label) {
                    if (!element) throw new Error(`${label} is missing`);
                }
            });
            assert.equal(benchmarkAppearance.lineColour, benchmarkColour, 'benchmark line uses theme-aware blue');
            assert.ok(['none', ''].includes(benchmarkAppearance.lineDash), 'benchmark line is solid');
            assert.equal(benchmarkAppearance.markerColour, benchmarkColour, 'benchmark selected marker matches');
            assert.equal(benchmarkAppearance.legendColour, benchmarkColour, 'benchmark legend colour matches');
            assert.equal(benchmarkAppearance.legendStyle, 'solid', 'benchmark legend is solid');
            assert.equal(benchmarkAppearance.axisColour, benchmarkColour, 'benchmark percentage axis matches');
            if (width === 1280) {
                const collapseBtn = page.getByRole('button', { name: 'Collapse sidebar' });
                const beforeRect = await collapseBtn.boundingBox();
                await collapseBtn.click();
                const expandBtn = page.getByRole('button', { name: 'Expand sidebar' });
                await expandBtn.waitFor();
                const afterRect = await expandBtn.boundingBox();
                assert.ok(beforeRect && afterRect && Math.abs(beforeRect.x - afterRect.x) <= 1 && Math.abs(beforeRect.y - afterRect.y) <= 1, 'sidebar toggle stays stationary');
                await expandBtn.click();
                await page.getByRole('button', { name: 'Collapse sidebar' }).waitFor();

                const overlayToggle = page.getByRole('checkbox', { name: /Overlay VOO \(S&P 500\)/i });
                await overlayToggle.waitFor();
                assert.equal(await overlayToggle.isChecked(), true, 'overlay checked by default');
                await overlayToggle.uncheck();
                assert.equal(await page.getByTestId('benchmark-overlay-path').count(), 0, 'overlay hidden when unchecked');
                await overlayToggle.check();
                await page.getByTestId('benchmark-overlay-path').waitFor();
            }
            await page.getByRole('region', { name: 'Explore indicators' }).waitFor();
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
            assert.ok(width > 768 || mainWidth >= width * .88, `market main uses only ${mainWidth}px of ${width}px viewport`);
            const palette = await page.getByTestId('v9-workspace').filter({ visible: true }).evaluate(node => {
                const css = getComputedStyle(node);
                return Object.fromEntries(['--canvas', '--surface', '--brand', '--ink', '--muted'].map(key => [key, css.getPropertyValue(key).trim()]));
            });
            report.checks.push({ name: `palette ${width} ${theme}`, palette });
            assert.equal(palette['--brand'].toLowerCase(), theme === 'dark' ? '#dfc08a' : '#8a5c22');
            await page.screenshot({ path: `${output}/market-${width}-${theme}.png` });

            await page.getByRole('region', { name: 'Market assessment' }).getByRole('button', { name: /What changed today\?/i }).click();
            const timeline = page.getByRole('region', { name: 'Intraday market timeline' });
            await timeline.getByText(/VIX rose from 29.8 to 30.4/).waitFor();
            await timeline.evaluate(node => window.scrollBy(0, node.getBoundingClientRect().top - 80));
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'timeline document overflow');
            await page.screenshot({ path: `${output}/today-${width}-${theme}.png` });
            const older = timeline.getByRole('button', { name: 'Load older captures' });
            await older.scrollIntoViewIfNeeded();
            if (width <= 768) {
                await older.evaluate(node => window.scrollBy(0, node.getBoundingClientRect().bottom - (window.innerHeight - 110)));
                const box = await older.boundingBox(), nav = await page.getByRole('navigation', { name: 'Mobile navigation' }).boundingBox();
                assert.ok(box && nav && box.y + box.height <= nav.y, 'Load older captures obscured by mobile navigation');
            }
        });
        await context.close();
    }
    const { context, page } = await setup(1280, 'dark');
    await scenario('Market summary opens the intraday timeline and preserves configuration', async () => {
        await page.goto(`${base}/v9?mode=contrarian&enableSocial=false`, { waitUntil: 'domcontentloaded' });
        const summary = page.getByRole('region', { name: 'Market assessment' });
        await summary.getByRole('button', { name: /What changed today\?/i }).click();
        await page.waitForURL(url => url.searchParams.get('tab') === 'today' && url.searchParams.get('mode') === 'contrarian' && url.searchParams.get('enableSocial') === 'false');
        const timeline = page.getByRole('tabpanel', { name: 'Today', exact: true });
        await timeline.getByText(/VIX rose from 29.8 to 30.4/).waitFor();
        await timeline.getByRole('button', { name: /earlier|older/i }).click();
        await timeline.getByText('First recorded reading.', { exact: true }).waitFor();
        await page.reload();
        await timeline.getByText(/VIX rose from 29.8 to 30.4/).waitFor();
        await page.getByRole('button', { name: 'Malaysia · Bursa', exact: true }).click();
        await page.waitForURL(url => url.searchParams.get('market') === 'MY' && url.searchParams.get('tab') === 'today');
        await timeline.waitFor();
        assert.equal(await timeline.getByText(/VIX rose/).count(), 0);
    });
    await scenario('Today configuration switch preserves selection', async () => {
        await page.goto(`${base}/v9?market=US&mode=standard&enableSocial=false&view=market&tab=today`, { waitUntil: 'domcontentloaded' });
        const timeline = page.getByRole('tabpanel', { name: 'Today' });
        await timeline.getByText(/VIX rose/).waitFor();
        await page.getByRole('button', { name: 'Contrarian', exact: true }).click();
        await page.waitForURL(url => url.searchParams.get('mode') === 'contrarian');
        await timeline.getByText(/VIX rose/).waitFor();
        await page.getByRole('button', { name: 'Malaysia · Bursa', exact: true }).click();
        await page.waitForURL(url => url.searchParams.get('market') === 'MY');
        await timeline.getByText(/No captures for this market/).waitFor();
    });
    await scenario('market actions remain in V9', async () => {
        await page.goto(`${base}/v9?market=US&view=market`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: /market condition score/i }).waitFor();
        await page.getByText(/VIX is above 25/).first().waitFor();
        const body = await page.locator('main:visible').innerText();
        assert.match(body, /47%|52%/); assert.match(body, /40%|47%/);
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
    for (const width of [1280, 375]) {
        const { context, page: historyPage } = await setup(width, 'light');
        await scenario(`V9 US score history views are distinct at ${width}px`, async () => {
            const history = structuredClone(seeds['US:standard:false']);
            const rows = [
                ['2026-04-01', 31, 'reconstructed', '2.1.0', 38, []],
                ['2026-08-01', 46, 'observed', '2.1.0', 58, ['aaii']],
                ['2026-09-09', 51, 'observed', '2.1.0', 49, []],
                ['2026-09-10', 55, 'observed', '2.1.0'],
                ['2026-09-11', 54, 'observed', '2.1.0', 42, []],
                ['2026-09-12', us.composite_score, 'observed', '2.2.0', us.composite_score, []],
            ];
            history.data.metadata.score_history = rows.map(([date, score, origin, model_version, recalculated, missing_inputs]) => ({
                date, score, origin, model_version, tier: 'neutral',
                ...(recalculated === undefined ? {} : { recalculated_v220: { score: recalculated, missing_inputs } }),
            }));
            history.data.metadata.trend_context = { score_trend: 'Fixture mixed-model live trend', last_signal_change: 'Fixture mixed-model comparison', note: 'Fixture only' };
            const summary = { date: '2026-09-11', score: 54, tier: 'neutral', origin: 'observed', coverageNote: null, hasFullEvidence: true, updatedAt: '2026-09-11T20:00:00Z' };
            await context.route('**/api/signals/v2?*', route => {
                const params = new URL(route.request().url()).searchParams;
                return params.get('market') === 'US' && params.get('mode') === 'standard' && params.get('enableSocial') === 'false'
                    ? route.fulfill({ json: history }) : route.fallback();
            });
            await context.route('**/api/signals/replay?*', route => {
                const params = new URL(route.request().url()).searchParams;
                return route.fulfill({ json: { success: true, data: params.has('date')
                    ? { summary, confidenceLevel: 'normal', agreementPercent: 50, majoritySignal: 'NEUTRAL', components: [], scoreDrivers: [], indexTrend: [], signalQuality: {}, interpretationContext: {}, metadata: {} }
                    : { market: params.get('market'), mode: params.get('mode'), enableSocial: params.get('enableSocial') === 'true', summaries: [summary] } } });
            });
            await historyPage.goto(`${base}/v9?view=market&market=US&mode=standard&enableSocial=false&advanced=1`, { waitUntil: 'domcontentloaded' });
            const score = historyPage.getByRole('region', { name: 'Market score and history' });
            const hero = historyPage.getByRole('region', { name: 'Market assessment' });
            const slider = score.getByRole('slider', { name: 'Market condition score' });
            const modelInfo = score.locator('summary[aria-label="Score model details"]');
            const recorded = score.getByRole('button', { name: 'As recorded', exact: true });
            const calculated = score.getByRole('button', { name: 'Recalculated with v2.2.0', exact: true });
            const replay = score.getByRole('button', { name: 'Open historical snapshot' });
            const groups = slider.locator('g[data-origin]');
            await modelInfo.waitFor();
            await modelInfo.click();
            await calculated.waitFor();
            assert.equal(await calculated.getAttribute('aria-pressed'), 'true');
            const smoothTrend = score.getByRole('button', { name: 'Smooth trend', exact: true });
            const exactDaily = score.getByRole('button', { name: 'Daily scores', exact: true });
            await smoothTrend.waitFor();
            assert.equal(await smoothTrend.getAttribute('aria-pressed'), 'true', 'V9 defaults to a smoother trend');
            await score.getByText(/14-day trailing average/).waitFor();
            assert.ok(await score.getByTestId('v9-score-trend-path').count() > 0, 'trend is drawn for contiguous readings');
            await exactDaily.click();
            assert.equal(await exactDaily.getAttribute('aria-pressed'), 'true', 'exact daily view is available');
            assert.equal(await score.getByTestId('v9-score-trend-path').count(), 0, 'daily view has no smoothed overlay');
            await smoothTrend.click();
            assert.ok(await score.getByTestId('v9-score-trend-path').count() > 0, 'smooth trend can be restored');
            await recorded.click();
            assert.equal(await recorded.getAttribute('aria-pressed'), 'true');
            assert.equal(await groups.count(), 5, '3M only shows dates inside its recorded window');
            await hero.getByText('Scoring model changed from v2.1.0 to v2.2.0. Score comparison unavailable.').waitFor();
            assert.equal(await hero.getByRole('button', { name: /points vs prior snapshot/ }).count(), 0);
            await historyPage.getByText('How to read this assessment · methodology and limits').click();
            await historyPage.getByText('No earlier comparable score supplied. A change cannot be established.').waitFor();
            assert.equal(await groups.last().locator('path').count(), 0, 'recorded line breaks between models');
            await score.getByText('History and comparison details').click();
            assert.equal(await score.getByText('Fixture mixed-model live trend').count(), 0);
            await slider.press('ArrowLeft');
            assert.match(await slider.getAttribute('aria-valuetext'), /11 Sept? 2026, score 54\. Observed · Model v2\.1\.0/);
            await replay.waitFor();
            await calculated.click();
            assert.match(await slider.getAttribute('aria-valuetext'), /11 Sept? 2026, score 42\. Recalculated with v2\.2\.0/);
            assert.equal(await groups.nth(2).locator('path').count(), 0, 'recalculated line leaves a gap on 10 September');
            assert.equal(await replay.count(), 0, 'recalculated scores cannot open recorded replay');
            assert.equal(await hero.getByTestId('connected-score').innerText(), String(us.composite_score));
            await slider.press('Home');
            assert.match(await slider.getAttribute('aria-valuetext'), /1 Aug 2026, score 58.*Partial · Neutral fallback for AAII Sentiment/);
            await score.getByRole('button', { name: '1M', exact: true }).click();
            assert.equal(await groups.count(), 3, '1M uses the same cutoff in both views');
            await score.getByRole('button', { name: '6M', exact: true }).click();
            await score.getByText(/28-day trailing average/).waitFor();
            assert.equal(await groups.count(), 5, '6M includes 1 Apr 2026 in recalculated view');
            await score.getByRole('button', { name: '1Y', exact: true }).click();
            await score.getByRole('button', { name: '3Y', exact: true }).click();
            await score.getByRole('button', { name: '5Y', exact: true }).click();
            await score.getByRole('button', { name: 'All', exact: true }).click();
            await slider.press('Home');
            assert.match(await slider.getAttribute('aria-valuetext'), /1 Apr 2026, score 38.*backfilled inputs/);
            await recorded.click();
            assert.match(await slider.getAttribute('aria-valuetext'), /1 Apr 2026, score 31\. Backfilled · Model v2\.1\.0/);
            await slider.press('End');
            await slider.press('ArrowLeft');
            await slider.press('ArrowLeft');
            await calculated.click();
            await score.getByText(/No recalculated score on 10 Sept? 2026/).waitFor();
            assert.ok(await historyPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'document overflow');
            await score.screenshot({ path: `${output}/market-history-${width}.png` });
            await recorded.click();
            await slider.press('ArrowRight');
            await replay.click();
            await historyPage.getByRole('heading', { name: /Reading on 11 Sept? 2026/ }).waitFor();
            assert.equal(await historyPage.getByTestId('connected-score').innerText(), '54');
            await score.getByRole('button', { name: 'As recorded', exact: true }).waitFor({ state: 'hidden' });
            await historyPage.getByRole('button', { name: 'Return to current ↗' }).click();
            await historyPage.getByRole('checkbox', { name: 'Include social in score', exact: true }).check();
            await historyPage.waitForURL(url => url.searchParams.get('enableSocial') === 'true');
            await slider.waitFor({ state: 'visible' });
            assert.equal(await recorded.count(), 0, 'social-on view has no history toggle');
            if (width === 1280) {
                await historyPage.goto(`${base}/v9?view=market&market=MY&mode=standard&enableSocial=false`, { waitUntil: 'domcontentloaded' });
                await score.waitFor();
                assert.equal(await recorded.count(), 0, 'MY view has no history toggle');
                await historyPage.goto(`${base}/v9?view=market&market=US&mode=contrarian&enableSocial=false`, { waitUntil: 'domcontentloaded' });
                await score.waitFor();
                assert.equal(await recorded.count(), 0, 'Contrarian view has no history toggle');
                history.data.metadata.score_history.slice(1).forEach(row => delete row.recalculated_v220);
                await historyPage.goto(`${base}/v9?view=market&market=US&mode=standard&enableSocial=false`, { waitUntil: 'domcontentloaded' });
                await score.getByText('No recalculated scores are available in this range.').waitFor();
                assert.equal(await slider.count(), 0, 'an empty range has no synthetic score or selected point');
                await score.getByRole('button', { name: 'All', exact: true }).click();
                await slider.waitFor();
                assert.match(await slider.getAttribute('aria-valuetext'), /1 Apr 2026, score 38/);

                // Recalculated historical scores are comparable across observed/backfilled
                // provenance; recorded history still keeps source/model breaks.
                const syntheticRows = [
                    ['2026-08-01', 58, 'reconstructed'],
                    ['2026-09-08', 54, 'reconstructed'],
                    ['2026-09-09', 28, 'observed'],
                    ['2026-09-10', 64, 'reconstructed'],
                    ['2026-09-11', 32, 'observed'],
                    ['2026-09-12', 60, 'observed'],
                ];
                history.data.metadata.score_history = syntheticRows.map(([date, value, origin]) => ({
                    date, score: value, origin, model_version: origin === 'observed' ? '2.2.0' : '2.1.0',
                    tier: 'neutral', recalculated_v220: { score: value, missing_inputs: [] },
                }));
                await historyPage.goto(`${base}/v9?view=market&market=US&mode=standard&enableSocial=false&advanced=1`, { waitUntil: 'domcontentloaded' });
                await smoothTrend.waitFor();
                const smoothGroups = slider.locator('g[data-origin]');
                assert.equal(await smoothGroups.count(), 6, 'historical observations remain individually inspectable');
                assert.equal(await smoothGroups.nth(1).locator('path').count(), 0, '38-day historical gap is not connected');
                assert.equal(await smoothGroups.nth(2).locator('path').count(), 1, 'adjacent recalculated observed/backfilled inputs connect');
                assert.equal(await smoothGroups.nth(3).locator('path').count(), 1, 'source-switching inputs stay connected');
                assert.equal(await score.getByTestId('v9-score-trend-path').count(), 1, 'single continuous recalculated trend after the genuine gap');
                assert.match(await slider.getAttribute('aria-valuetext'), /score 60/, 'inspection keeps actual scores');
                await exactDaily.click();
                assert.equal(await score.getByTestId('v9-score-trend-path').count(), 0, 'daily view hides the average');
                assert.equal(await smoothGroups.nth(2).locator('path').count(), 1, 'daily view still connects comparable recalculated inputs');
                await recorded.click();
                assert.equal(await smoothGroups.nth(2).locator('path').count(), 0, 'as-recorded mode retains origin/model breaks');
                await calculated.click();
                await smoothTrend.click();

                // A missing recalculated day is still a break, even when nearby scores exist.
                delete history.data.metadata.score_history[3].recalculated_v220;
                await historyPage.reload();
                await smoothTrend.waitFor();
                assert.equal(await slider.locator('g[data-origin]').count(), 5, 'missing recalculated input is omitted');
                assert.equal(await slider.locator('g[data-origin]').nth(3).locator('path').count(), 0, 'missing day is not bridged');
            }
        });
        await context.close();
    }
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
    await scenario('Market Pulse landing respects market selection and preserves URL', async () => {
        await page.goto(`${base}/v9?market=MY`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { level: 1, name: /Malaysia · Bursa/i }).waitFor();
        assert.equal(new URL(page.url()).searchParams.get('market'), 'MY');
        await page.getByRole('button', { name: 'US Market', exact: true }).click();
        await page.waitForURL(url => url.searchParams.get('market') === 'US');
        await page.getByRole('heading', { level: 1, name: /^United States$/i }).waitFor();
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
        await page.getByRole('searchbox', { name: 'Company or ticker' }).fill('MSFT');
        await page.getByRole('button', { name: 'Read ticker directly' }).click();
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
        await page.getByRole('heading', { name: 'Holdings', exact: true }).waitFor();
        await page.getByText('No holdings have been imported in this browser.').waitFor();
        assert.equal(await page.getByRole('link', { name: 'Import or update holdings' }).count(), 1, 'empty portfolio view renders a single import CTA');
        await page.screenshot({ path: `${output}/portfolio-1280-dark.png` });
        await page.getByRole('link', { name: 'Manage portfolio' }).click();
        await page.waitForURL(url => url.searchParams.get('tab') === 'manage');
        assert.equal(new URL(page.url()).pathname, '/v9');
        await page.getByRole('link', { name: 'Holdings', exact: true }).click();
        await page.waitForURL(url => !url.searchParams.has('tab'));
        const discoveryRequestsBeforeAlerts = report.requests.filter(r => r === 'GET /api/research/discovery').length;
        await page.goto(`${base}/v9?market=US&view=discover&discover=alerts`, { waitUntil: 'networkidle' });
        await page.getByRole('tab', { name: 'Alerts', exact: true }).waitFor();
        assert.equal(report.requests.filter(r => r === 'GET /api/research/discovery').length, discoveryRequestsBeforeAlerts, 'Discover Alerts skips US trend discovery scan');
        await page.goto(`${base}/v9?market=US&view=discover&discover=calendar`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('region', { name: 'Empty calendar' }).waitFor();
        await page.screenshot({ path: `${output}/discover-calendar-1280-dark.png` });
        await page.getByRole('button', { name: 'Show full calendar grid' }).click();
        await page.getByTestId('research-calendar-grid').waitFor();
        await page.goto(`${base}/v9?market=US&view=learn`, { waitUntil: 'domcontentloaded' });
        const trackSelect = page.getByLabel('Learn track').filter({ visible: true });
        await trackSelect.waitFor();
        await page.getByRole('heading', { level: 1 }).filter({ visible: true }).waitFor();
        await page.evaluate(() => new Promise(requestAnimationFrame));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'learn view horizontal overflow');
        await page.screenshot({ path: `${output}/learn-1280-dark.png` });
        await trackSelect.selectOption('v0.1');
        await page.getByTestId('learn-v0-1').waitFor();
    });
    await scenario('shared command palette retains V8 fallback', async () => {
        await page.goto(`${base}/main-v8?market=US`, { waitUntil: 'domcontentloaded' });
        assert.equal(await page.getByRole('button', { name: 'Smooth trend', exact: true }).count(), 0, 'V8 chart does not expose V9 smoothing');
        await page.getByLabel('Quick jump (Ctrl+K)').click();
        const link = page.getByRole('link', { name: /US Market Pulse/i });
        assert.match(await link.getAttribute('href'), /^\/main-v8\?/);
    });
    await context.close();
    const states = await setup(1280, 'light');
    let stateMode = 'baseline'; let attempts = 0; let releaseLoading;
    const loadingGate = new Promise(resolve => { releaseLoading = resolve; });
    await states.context.route('**/api/signals/intraday?*', async route => {
        const url = new URL(route.request().url());
        if (stateMode === 'loading') await loadingGate;
        if (stateMode === 'retry' && attempts++ === 0) return route.fulfill({ json: { success: false, error: 'Fixture failure' } });
        if (stateMode === 'older-retry' && url.searchParams.has('before') && attempts++ === 0) return route.fulfill({ json: { success: false, error: 'Fixture older failure' } });
        const data = intradayFixture(url);
        if (stateMode === 'baseline') {
            data.data.entries = [{ id: '100', capturedAt: `${data.data.day}T01:00:00.000Z`, score: 43, previousScore: null, delta: null, tier: 'neutral', status: 'baseline', reason: { code: 'baseline', text: 'First recorded reading.' }, accounting: null }];
            data.data.hasEarlierCaptures = false;
        }
        if (stateMode === 'equal') {
            data.data.entries[0].score = data.data.entries[0].previousScore;
            data.data.entries[0].delta = 0;
            data.data.entries[0].reason.text = 'Inputs changed while the score stayed equal.';
        }
        return route.fulfill({ json: data });
    });
    try {
        await scenario('Market Today baseline and equal-score changed input', async () => {
            await states.page.goto(`${base}/v9?market=US&tab=today`, { waitUntil: 'domcontentloaded' });
            const panel = states.page.getByRole('region', { name: 'Intraday market timeline' });
            await panel.getByText('First recorded reading.').waitFor();
            stateMode = 'equal';
            await states.page.goto(`${base}/v9?market=US&view=market&tab=today`, { waitUntil: 'domcontentloaded' });
            await panel.getByText('Inputs changed while the score stayed equal.').waitFor();
            await panel.getByText('Input or score changed').waitFor();
            await panel.getByText('43 → 43/100').waitFor();
        });
        await scenario('Today loading and retry after failed capture read', async () => {
            stateMode = 'loading';
            await states.page.goto(`${base}/v9?market=US&view=market&tab=today`, { waitUntil: 'domcontentloaded' });
            const panel = states.page.getByRole('region', { name: 'Intraday market timeline' });
            await panel.getByText('Loading today’s captures…').waitFor();
            stateMode = 'retry'; attempts = 0; releaseLoading();
            await panel.getByRole('alert').waitFor();
            await panel.getByRole('button', { name: 'Retry today’s captures' }).click();
            await panel.getByText(/VIX rose/).waitFor();
        });
        await scenario('Older capture failure can be retried', async () => {
            stateMode = 'older-retry'; attempts = 0;
            await states.page.goto(`${base}/v9?market=US&view=market&tab=today`, { waitUntil: 'domcontentloaded' });
            const panel = states.page.getByRole('region', { name: 'Intraday market timeline' });
            await panel.getByRole('button', { name: 'Load older captures' }).click();
            await panel.getByText('Older captures could not be loaded.').waitFor();
            await panel.getByRole('button', { name: 'Retry older captures' }).click();
            await panel.getByText('First recorded reading.').waitFor();
        });
    } finally { releaseLoading(); await states.context.close(); }
    const failedLive = await setup(1280, 'dark');
    await failedLive.context.route('**/api/signals/v2?*', route => route.fulfill({ json: { success: false, error: 'Fixture live failure' } }));
    await scenario('Today captures remain usable when live score fails', async () => {
        await failedLive.page.goto(`${base}/v9?market=US&view=market&tab=today`, { waitUntil: 'domcontentloaded' });
        const panel = failedLive.page.getByRole('region', { name: 'Intraday market timeline' });
        await panel.getByText(/VIX rose/).waitFor();
        await panel.getByRole('button', { name: 'Load older captures' }).click();
        await panel.getByText('First recorded reading.').waitFor();
    });
    await failedLive.context.close();
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
        await scenario('Market summary action opens Scenarios', async () => {
            await deferred.page.goto(`${base}/v9?market=US`, { waitUntil: 'domcontentloaded' });
            releaseSignals();
            await deferred.page.getByRole('region', { name: 'Market assessment' }).getByRole('button', { name: /Scenarios/i }).click();
            await deferred.page.waitForURL(url => url.searchParams.get('tab') === 'scenarios');
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
