import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { chromium } from 'playwright';
import { marketRequestFixture } from './harness/market-request-fixture.mjs';
import { researchReadFixture, researchSnapshotFixture } from './harness/research-read-fixture.mjs';

const phase = process.argv.includes('--before') ? 'before' : 'after';
const base = process.env.SIGNAL_QA_URL || 'http://127.0.0.1:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const output = process.env.SIGNAL_PRESENTATION_OUTPUT || '.tmp/v81-presentation';
await mkdir(output, { recursive: true });
// Compile real pure calculation modules; this loader never imports DB/provider code.
const cache = new Map();
function load(file) {
    const absolute = path.resolve(file);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const mod = { exports: {} }; cache.set(absolute, mod);
    const require = id => {
        if (id === '@/lib/market-evidence-coverage') return load('src/lib/market-evidence-coverage.ts');
        if (id === '@/lib/indicator-registry') return load('src/lib/indicator-registry.ts');
        assert.ok(id.startsWith('.'), 'Unexpected calculation dependency: ' + id);
        return load(path.resolve(path.dirname(absolute), id) + '.ts');
    };
    const code = ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    new Function('require', 'module', 'exports', code)(require, mod, mod.exports);
    return mod.exports;
}
const { calculateCompositeScoreV2 } = load('src/lib/sentiment-calculator-v2.ts');
const { calculateDriverChanges } = load('src/lib/signal-change.ts');
const fixture = marketRequestFixture();
const seed = (await (await fixture.route.GET(fixture.request('market=US&mode=standard&enableSocial=true'))).json()).data;
const note = 'US VIX index points. Timestamp is retrieval time; observation time is unavailable.';
const observed = '2026-10-16T00:00:00Z';
const inputs = [
    { name: 'vix', display_name: 'VIX Index', value: 16.16, score: 78.7, last_updated: observed,
        metadata: { timestamp_basis: 'retrieved', mode_note: note, source_url: 'https://finance.yahoo.com/quote/%5EVIX/' } },
    { name: 'put_call', display_name: 'Put/call ratio', value: .8, score: 64, last_updated: observed },
    { name: 'aaii', display_name: 'AAII', value: 36.3, score: 54.33, last_updated: '2026-07-08T00:00:00Z' },
].map(item => ({ ...item, enabled: true, weight: 0, signal: 'neutral' }));
const previousInputs = inputs.map(item => ({ ...item, score: item.name === 'vix' ? 82.07 : item.name === 'put_call' ? 61 : item.score }));
function payload(mode, market = 'US') {
    const current = calculateCompositeScoreV2(inputs, { market, mode });
    const previous = calculateCompositeScoreV2(previousInputs, { market, mode });
    const drivers = Object.values(current.components).map(item => ({ key: item.name, name: item.display_name,
        impact: 'neutral', contribution: item.score * item.weight, score: item.score, weight: item.weight,
        raw_value: item.value, last_updated: item.last_updated, detail: item.metadata?.mode_note || 'Returned normalized score and configured weight.',
        mode_note: item.metadata?.mode_note }));
    const previousDrivers = Object.values(previous.components).map(item => ({ key: item.name, name: item.display_name, contribution: item.score * item.weight }));
    const data = { ...structuredClone(seed), ...current, metadata: { ...structuredClone(seed.metadata), ...current.metadata,
        interpretation_context: { ...seed.metadata.interpretation_context,
            limitation: 'Signal alignment reflects indicator agreement only; it is not a probability forecast or trading advice.',
            mode_note: mode === 'standard' ? 'High normalized scores indicate momentum.' : 'High normalized scores indicate crowding risk.' },
        signal_quality: { ...seed.metadata.signal_quality,
            confidence_explanation: 'Signal alignment measures indicator agreement, not forecast accuracy.' + (current.confidence.cap_reason ? ' ' + current.confidence.cap_reason : '') },
        score_drivers: drivers, driver_changes: calculateDriverChanges(drivers, previousDrivers), driver_changes_available: true,
        score_delta: { snapshot_date: '2026-10-16', previous_date: '2026-10-10', previous_score: previous.composite_score,
            delta: current.composite_score - previous.composite_score, label: '-1 since 2026-10-10' },
        score_history: [
            { date: '2026-01-01', score: 50, tier: 'neutral', origin: 'reconstructed' },
            { date: '2026-07-17', score: 64, tier: 'neutral', origin: 'observed' },
            { date: '2026-10-10', score: previous.composite_score, tier: previous.tier, origin: 'observed' },
            { date: '2026-10-16', score: current.composite_score, tier: current.tier, origin: 'observed' },
        ],
        trend_context: { score_trend: '-1 since 2026-10-10', last_signal_change: 'Compared with 2026-10-10', note: 'Controlled history' },
        articles: [
            { title: 'Stocks making the biggest moves premarket', source: 'CNBC Finance', url: 'https://example.com/markets', pubDate: observed },
            { title: 'My wife says we cannot afford to retire. Should I take Social Security?', source: 'MarketWatch', url: 'https://example.com/retirement', pubDate: observed },
        ],
    } };
    fixture.parseSignal({ success: true, data }, market, mode);
    return { success: true, data };
}
const standard = payload('standard'), contrarian = payload('contrarian');
assert.equal(standard.data.composite_score, 62);
assert.equal(contrarian.data.composite_score, 62);
assert.equal(standard.data.components.vix.signal, 'buy');
assert.equal(contrarian.data.components.vix.signal, 'sell');
assert.equal(standard.data.components.vix.score, contrarian.data.components.vix.score);
assert.equal(standard.data.confidence.agreement_pct, 67);
assert.equal(contrarian.data.confidence.agreement_pct, 67);
const unrounded = data => data.metadata.coverage_adjustment.active_points + data.metadata.coverage_adjustment.neutral_points;
assert.ok(Math.abs(unrounded(standard.data) - 62.311) < .000001);
assert.equal(standard.data.metadata.driver_changes.length, 2, 'Unchanged AAII is absent, not an invented zero row.');
const saved = (await (await researchReadFixture().route.GET()).json()).data[0];
const research = structuredClone(researchSnapshotFixture);
research.data.quote = { ...research.data.quote, price: 342, observedAt: '2026-10-15T20:00:00Z' };
research.data.chart.points = [];
const report = { phase, base, fixture: true, calculations: {
    standardScore: standard.data.composite_score, contrarianScore: contrarian.data.composite_score,
    unroundedCurrent: unrounded(standard.data), normalizedVix: standard.data.components.vix.score,
    driverChangeTotal: standard.data.metadata.driver_changes.reduce((sum, item) => sum + item.delta, 0),
    reportedRoundedDelta: standard.data.metadata.score_delta.delta,
    agreement: standard.data.confidence, sourceArticlesRetained: standard.data.metadata.articles.length,
}, scenarios: [], captures: [], errors: [], failedRequests: [] };
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce', timezoneId: 'America/Los_Angeles' });
const page = await context.newPage();
page.on('pageerror', error => report.errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
page.on('requestfailed', request => { if (!request.failure()?.errorText.includes('ERR_ABORTED')) report.failedRequests.push(request.url()); });
await context.route('**/api/**', async route => {
    assert.equal(route.request().method(), 'GET', 'Presentation must not mutate records.');
    const url = new URL(route.request().url());
    if (url.pathname === '/api/signals/v2') return route.fulfill({ json: payload(url.searchParams.get('mode') || 'standard', url.searchParams.get('market') || 'US') });
    if (url.pathname === '/api/signals/replay') return route.fulfill({ json: { success: true, data: { market: url.searchParams.get('market'), mode: url.searchParams.get('mode'), enableSocial: true, summaries: [] } } });
    if (url.pathname === '/api/research/watchlist') return route.fulfill({ json: { success: true, data: [saved], archivedSymbols: [] } });
    if (url.pathname.startsWith('/api/research/symbol/')) return route.fulfill({ json: research });
    return route.fulfill({ json: { success: true, data: [] } });
});
async function shot(name, width) {
    if (![1440, 390].includes(width)) return;
    const filename = `${phase}-${name}-${width}.png`;
    await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    await page.waitForTimeout(150); // Bounded compositor-paint allowance after scrolling/resizing.
    const at = new Date().toISOString();
    await page.screenshot({ path: path.join(output, filename), scale: 'css' });
    report.captures.push({ filename, at, url: page.url(), viewport: page.viewportSize(),
        scrollY: await page.evaluate(() => scrollY), state: 'settled', fixture: true });
}
async function geometry(label) {
    const value = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.ok(value.scrollWidth <= value.width + 1, `${label}: document overflow ${JSON.stringify(value)}`);
    return value;
}
try {
    for (const width of [1440, 390, 380, 1280, 768, 375]) {
        await page.setViewportSize({ width, height: width > 900 ? 1000 : 844 });
        await page.goto(base + '/main-v8');
        await page.getByTestId('connected-score').waitFor();
        await page.getByRole('heading', { name: 'Market condition score', exact: true }).waitFor();
        await page.evaluate(() => scrollTo(0, 0)); await shot('market-summary', width);
        const matrix = [];
        for (const mode of ['standard', 'contrarian']) {
            if (mode === 'contrarian') {
                await page.getByRole('button', { name: 'Advanced tools', exact: true }).click();
                await page.getByRole('button', { name: 'Contrarian', exact: true }).click();
                await page.getByText('Contrarian: high scores read as crowding risk, low scores as opportunity · Social on', { exact: true }).waitFor();
                await page.getByRole('button', { name: 'Back to basic view', exact: true }).click();
            }
            for (const advanced of [false, true]) {
                if (advanced) await page.getByRole('button', { name: 'Advanced tools', exact: true }).click();
                await page.getByTestId('connected-score').waitFor();
                const score = await page.getByTestId('connected-score').innerText();
                assert.equal(score, '62');
                const card = page.locator('[data-indicator="vix"]');
                const text = await card.innerText();
                if (phase === 'after') {
                    assert.match(text, mode === 'standard' ? /Momentum: positive/ : /Contrarian: negative/);
                    assert.doesNotMatch(text, /Model: (buy|sell)/);
                    const agreement = await page.getByRole('region', { name: 'Market assessment', exact: true }).innerText();
                    assert.match(agreement, /2 of 3 match this reading/);
                    const coverage = await page.getByRole('region', { name: 'Observed evidence weight', exact: true }).innerText();
                    assert.match(coverage, /3 of 6 inputs included/);
                    assert.match(coverage, /65.0% configured weight/);
                    assert.match(coverage, /35.0% of configured weight uses neutral fallback/);
                    assert.match(coverage, /VIX Index: Observation date unknown/);
                    const evidenceBox = await page.getByRole('region', { name: 'Explore indicators' }).boundingBox();
                    const chartBox = await page.getByRole('region', { name: 'Market score and history' }).boundingBox();
                    assert.ok(width <= 900 ? evidenceBox.y < chartBox.y : Math.abs(evidenceBox.y - chartBox.y) < 2, 'Evidence precedes chart on mobile and aligns beside it on desktop.');
                    if (width <= 900) assert.ok(await card.evaluate(el => !!(el.compareDocumentPosition(document.querySelector('svg[role="slider"]')) & Node.DOCUMENT_POSITION_FOLLOWING)), 'Mobile DOM order follows evidence before history.');
                    if (advanced) {
                        await card.click();
                        const detail = page.getByRole(width <= 900 ? 'dialog' : 'complementary', { name: width <= 900 ? 'Indicator detail' : 'Selected indicator', exact: true });
                        await detail.getByText('78.70 / 100', { exact: true }).waitFor();
                        await detail.getByRole('button', { name: 'Close indicator detail', exact: true }).click();
                        await page.waitForFunction(() => document.activeElement?.getAttribute('data-indicator') === 'vix');
                    }
                }
                await card.scrollIntoViewIfNeeded();
                await shot(`market-${mode}-${advanced ? 'advanced' : 'basic'}-indicators`, width);
                const tabs = await page.getByRole('tablist', { name: 'Market investigation' }).getByRole('tab').evaluateAll(items => items.map(item => ({
                    text: item.textContent, whiteSpace: getComputedStyle(item).whiteSpace, height: item.getBoundingClientRect().height,
                })));
                if (phase === 'after') assert.ok(tabs.every(tab => tab.whiteSpace === 'nowrap'));
                if (phase === 'after') assert.ok(Math.max(...tabs.map(tab => tab.height)) - Math.min(...tabs.map(tab => tab.height)) <= 1);
                const color = await card.locator('[data-direction]').evaluate(el => getComputedStyle(el).color);
                matrix.push({ mode, advanced, score, badge: text.match(/Model[^\n]*/)?.[0], color, tabs });
                await page.getByRole('tab', { name: 'What changed', exact: true }).click();
                await shot(`market-${mode}-${advanced ? 'advanced' : 'basic'}-changes`, width);
                if (mode === 'standard' && !advanced) {
                    await page.getByRole('region', { name: 'Driver changes', exact: true }).evaluate(el => el.scrollIntoView({ block: 'start' }));
                    await shot('market-attribution', width);
                }
                if (phase === 'after') {
                    const panel = await page.getByRole('tabpanel', { name: 'What changed' }).innerText();
                    assert.doesNotMatch(panel, /Stocks making|retire|Latest source updates|−0.12/);
                    assert.match(panel, /Reported contribution changes/);
                    assert.match(panel, /round/i);
                }
                if (advanced) await page.getByRole('button', { name: 'Back to basic view', exact: true }).click();
            }
        }
        if (phase === 'after') {
            assert.notEqual(matrix[0].color, matrix[2].color, 'Positive/negative VIX colours remain distinct.');
            assert.equal(matrix[0].color, matrix[1].color, 'Basic/Advanced preserve positive colour.');
            assert.equal(matrix[2].color, matrix[3].color, 'Basic/Advanced preserve negative colour.');
        }
        await page.getByRole('button', { name: 'Advanced tools', exact: true }).click();
        await page.getByRole('button', { name: 'Momentum', exact: true }).click();
        await page.getByRole('button', { name: 'Back to basic view', exact: true }).click();
        const chart = page.getByRole('slider', { name: 'Market condition score', exact: true });
        const markers = [];
        for (const key of ['Home', 'End']) {
            await chart.focus(); await chart.press(key);
            await page.getByRole('heading', { name: 'Market condition score', exact: true }).evaluate(el => el.scrollIntoView({ block: 'start' }));
            markers.push(await chart.evaluate(svg => {
                const marker = svg.querySelector(':scope > circle:last-child');
                const view = svg.viewBox.baseVal;
                const radius = marker.r.baseVal.value + Number(marker.getAttribute('stroke-width')) / 2;
                const cx = marker.cx.baseVal.value, cy = marker.cy.baseVal.value;
                const plot = svg.parentElement, plotBox = plot.getBoundingClientRect();
                const box = svg.getBoundingClientRect(), svgStyle = getComputedStyle(svg), plotStyle = getComputedStyle(plot);
                const focusBox = plotStyle.outlineStyle === 'none' ? box : plotBox;
                const gap = parseFloat(plotStyle.outlineOffset) || 0;
                const axisInside = [...plot.querySelectorAll('[class*="axis"] span')].every(el => {
                    const b = el.getBoundingClientRect();
                    return b.left >= focusBox.left - gap && b.right <= focusBox.right + gap && b.top >= focusBox.top - gap && b.bottom <= focusBox.bottom + gap;
                });
                return { value: svg.getAttribute('aria-valuenow'), markerFits: cx - radius >= view.x && cx + radius <= view.x + view.width && cy - radius >= view.y && cy + radius <= view.y + view.height,
                    axisInside, svgOutline: svgStyle.outlineStyle, plotOutline: plotStyle.outlineStyle };
            }));
            await shot('market-chart-' + key.toLowerCase(), width);
        }
        await chart.press('Home'); await chart.press('ArrowRight'); assert.equal(await chart.getAttribute('aria-valuenow'), '1');
        await chart.press('ArrowLeft'); assert.equal(await chart.getAttribute('aria-valuenow'), '0');
        await chart.press('Enter'); await chart.press(' ');
        const bounds = await chart.boundingBox();
        await chart.click({ position: { x: bounds.width * 8 / 816, y: bounds.height / 2 } });
        assert.equal(await chart.getAttribute('aria-valuenow'), '0');
        await chart.click({ position: { x: bounds.width * 808 / 816, y: bounds.height / 2 } });
        assert.equal(await chart.getAttribute('aria-valuenow'), '2');
        if (phase === 'after') assert.ok(markers.every(marker => marker.markerFits && marker.axisInside && marker.plotOutline === 'solid' && marker.svgOutline === 'none'), JSON.stringify(markers));
        const trigger = page.getByRole('region', { name: 'Explore indicators', exact: true }).getByRole('button', { name: /VIX Index/ });
        await trigger.scrollIntoViewIfNeeded();
        const priorScroll = await page.evaluate(() => scrollY);
        await trigger.click();
        const inspector = page.getByRole(width <= 900 ? 'dialog' : 'complementary', { name: width <= 900 ? 'Indicator detail' : 'Selected indicator', exact: true });
        await inspector.waitFor();
        if (width > 900) await inspector.scrollIntoViewIfNeeded();
        const occurrences = await inspector.getByText(note, { exact: true }).count();
        await shot('market-vix-inspector', width);
        if (phase === 'after') assert.equal(occurrences, 1);
        assert.match(await inspector.innerText(), /Observation date unavailable/);
        await inspector.getByRole('button', { name: 'Close indicator detail', exact: true }).click();
        if (width > 900) {
            await page.waitForFunction(() => document.activeElement?.getAttribute('data-indicator') === 'vix', undefined, { timeout: 5000 });
            assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
            assert.ok(Math.abs(await page.evaluate(() => scrollY) - priorScroll) <= 1, 'Closing returns to the originating scroll context.');
        }
        await page.getByRole('tab', { name: 'Context', exact: true }).click();
        await shot('market-context', width);
        if (phase === 'after') assert.doesNotMatch(await page.getByRole('tabpanel', { name: 'Context' }).innerText(), /retire|Stocks making/);
        const dimensions = await geometry('Market ' + width);
        report.scenarios.push({ width, matrix, markers, occurrences, dimensions });
        await page.goto(base + '/research-v8?market=US&ticker=AAPL&advanced=1&tab=review');
        await page.getByRole('article', { name: 'AAPL research', exact: true }).waitFor();
        await page.getByRole('heading', { name: 'Your working note', exact: true }).waitFor();
        await page.getByRole('region', { name: 'Company investigation' }).scrollIntoViewIfNeeded();
        await shot('research-review', width);
        if (phase === 'after') {
            assert.equal(await page.getByRole('region', { name: 'Next research gap' }).count(), 0);
            assert.equal(await page.getByRole('link', { name: 'Open full research review ↗', exact: true }).count(), 1);
        }
        assert.match(await page.getByRole('region', { name: 'Current provider quote' }).innerText(), /15 Oct 2026, 20:00 UTC/);
        assert.equal(await page.getByRole('tabpanel').getByRole('region', { name: 'Current research assessment' }).count(), 0, 'Full automatic assessment must not repeat in Review.');
        await geometry('Research ' + width);
    }
    // Both the calculator and formatter must retain non-integer data and UTC calendar semantics.
    const formatting = readFileSync('src/components/v8/research-v8-connected-data.ts', 'utf8');
    assert.match(formatting, /maximumFractionDigits: 2/);
    assert.match(formatting, /timeZone: 'UTC'/);
    const ast = ts.createSourceFile('format.ts', formatting, ts.ScriptTarget.Latest, true);
    const formatterSource = ast.statements.filter(node => ts.isFunctionDeclaration(node)
        && ['number', 'money', 'price', 'date', 'retrievedAt'].includes(node.name?.text)).map(node => node.getText(ast)).join('\n');
    const formatterModule = { exports: {} };
    new Function('module', 'exports', ts.transpileModule(formatterSource, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText)(formatterModule, formatterModule.exports);
    assert.equal(formatterModule.exports.money(342.25, 'USD'), 'USD 342.25');
    assert.equal(formatterModule.exports.money(342, 'USD'), 'USD 342');
    assert.equal(formatterModule.exports.price(339.5, 'USD'), 'USD 339.50');
    assert.equal(formatterModule.exports.price(1234, 'MYR'), 'MYR 1,234.00');
    assert.equal(formatterModule.exports.retrievedAt('2026-10-15T20:00:00Z'), '15 Oct 2026, 20:00 UTC');
    if (phase === 'after') {
        const { fullDate, formatMarketDates, indicatorReadingLabel, indicatorStatus } = load('src/components/v8/MarketV8ConnectedData.ts');
        assert.equal(fullDate('2026-10-16T00:00:00Z'), '16 Oct 2026');
        assert.equal(formatMarketDates('Compared with 2026-10-10'), 'Compared with 10 Oct 2026');
        assert.equal(formatMarketDates('2026-10-16T00:00:00Z'), '2026-10-16T00:00:00Z');
        assert.equal(indicatorReadingLabel('neutral'), 'neutral');
        assert.equal(indicatorReadingLabel('sell'), 'negative');
        assert.equal(indicatorStatus(standard.data, 'put_call', ''), 'Freshness unknown');
        assert.equal(indicatorStatus(standard.data, 'put_call', '2026-10-15'), 'Freshness unknown');
    }
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.failedRequests, []);
    await writeFile(path.join(output, phase + '-report.json'), JSON.stringify(report, null, 2));
    console.log('PASS ' + phase + ' presentation matrix: ' + output);
} catch (error) {
    await writeFile(path.join(output, phase + '-failure.json'), JSON.stringify({ ...report, failure: error.stack }, null, 2));
    throw error;
} finally { await browser.close(); }
