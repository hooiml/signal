import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { chromium } from 'playwright';
import { marketRequestFixture } from './harness/market-request-fixture.mjs';

const base = process.env.SIGNAL_QA_URL || 'http://127.0.0.1:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const output = process.env.SIGNAL_MARKET_CLARITY_OUTPUT || '.tmp/market-clarity';
await mkdir(output, { recursive: true });
// Real pure calculation modules and an isolated provider/SQL fixture; browser APIs are intercepted.
const modules = new Map();
function load(file) {
    const absolute = path.resolve(file);
    if (modules.has(absolute)) return modules.get(absolute).exports;
    const mod = { exports: {} }; modules.set(absolute, mod);
    const require = id => {
        assert.ok(id.startsWith('.') || id.startsWith('@/'), `Unexpected dependency: ${id}`);
        const resolved = id.startsWith('@/') ? path.resolve('src', id.slice(2)) : path.resolve(path.dirname(absolute), id);
        return load(`${resolved}.ts`);
    };
    const code = ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    new Function('require', 'module', 'exports', code)(require, mod, mod.exports);
    return mod.exports;
}
const { calculateCompositeScoreV2 } = load('src/lib/sentiment-calculator-v2.ts');
const { calculateDriverChanges, reconcileScoreChange } = load('src/lib/signal-change.ts');
const { marketReadingLabel } = load('src/lib/market-display.ts');
const fixture = marketRequestFixture();
const seed = (await (await fixture.route.GET(fixture.request('market=US&mode=standard&enableSocial=true'))).json()).data;
const observed = '2026-10-19T14:30:00Z';
const retrieved = '2026-10-20T15:02:00Z';
const input = (name, display_name, value, score, unit) => ({ name, display_name, value, score, weight: 0,
    enabled: true, signal: 'neutral', last_updated: observed,
    metadata: { timestamp_basis: 'observed', retrieved_at: retrieved, unit } });
const inputs = [input('vix', 'VIX Index', 20, 70, 'VIX points'), input('put_call', 'Put/call ratio', .8, 20, 'put/call ratio'), { ...input('aaii', 'AAII', 36, 50, '% bullish'), last_updated: '2026-10-20' }];
function payload(mode, variant = 'offset') {
    const calculated = calculateCompositeScoreV2(inputs, { market: 'US', mode });
    if (variant === 'tiers') {
        const only = { ...calculated.components.vix, score: 50, weight: 1, signal: 'neutral' };
        calculated.components = { vix: only }; calculated.composite_score = 50; calculated.tier = 'neutral';
        calculated.metadata.weight_distribution = { vix: 1 };
        calculated.metadata.coverage_adjustment = { active_weight: 1, missing_weight: 0, neutral_baseline: 50, active_points: 50, neutral_points: 0 };
    }
    const current = Object.values(calculated.components).map(item => ({ key: item.name, name: item.display_name,
        score: item.score, weight: item.weight, raw_value: item.value, last_updated: item.last_updated,
        timestamp_basis: item.metadata.timestamp_basis, retrieved_at: item.metadata.retrieved_at, unit: item.metadata.unit }));
    const previous = current.map(item => ({ ...item, retrieved_at: '2026-10-19T15:02:00Z',
        ...(item.key === 'vix' && variant === 'offset' ? { score: 50, weight: .49 } : {}),
        ...(item.key === 'put_call' ? { last_updated: '2026-10-19T10:00:00Z' } : {}),
        ...(item.key === 'aaii' ? { last_updated: '2026-10-19' } : {}),
    }));
    const previousRaw = previous.reduce((sum, item) => sum + item.score * item.weight, 0) + Math.max(0, 1 - previous.reduce((sum, item) => sum + item.weight, 0)) * 50;
    const previousScore = Math.round(previousRaw);
    const contributions = rows => rows.map(item => ({ key: item.key, name: item.name, contribution: item.score * item.weight }));
    const drivers = current.map(item => ({ ...item, contribution: item.score * item.weight, impact: 'neutral', detail: 'Controlled input', mode_note: 'Controlled model reading.' }));
    const data = { ...structuredClone(seed), ...calculated, metadata: { ...structuredClone(seed.metadata), ...calculated.metadata,
        market: 'US', data_freshness: Object.fromEntries(current.map(item => [item.key, item.last_updated])),
        score_drivers: drivers, driver_changes: calculateDriverChanges(contributions(current), contributions(previous)), driver_changes_available: variant !== 'missing',
        score_delta: { snapshot_date: '2026-10-20', previous_date: '2026-10-19', previous_score: previousScore, delta: calculated.composite_score - previousScore, label: 'Compared with 2026-10-19' },
        change_reconciliation: reconcileScoreChange({ current, previous, currentScore: calculated.composite_score, previousScore, currentModelVersion: 'fixture-v2', previousModelVersion: 'fixture-v1' }),
        score_history: ['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20'].map((date, index) => ({ date, score: index === 3 ? calculated.composite_score : 30 + index * 5, tier: index === 3 ? calculated.tier : 'sell', origin: 'observed' })),
    } };
    if (data.metadata.historical_validation) data.metadata.historical_validation.mode = mode;
    if (variant === 'retrieval') {
        const row = data.metadata.change_reconciliation.components.find(item => item.key === 'vix');
        Object.assign(row, { status: 'changed', observation_change: 'unknown', new_observation: null,
            previous_timestamp_basis: 'retrieved', current_timestamp_basis: 'retrieved', previous_observed_at: null, current_observed_at: null,
            previous_retrieved_at: '2026-10-19T10:00:00Z', current_retrieved_at: retrieved });
    }
    if (variant === 'legacy') {
        for (const row of data.metadata.change_reconciliation.components) {
            for (const key of ['previous_timestamp_basis', 'current_timestamp_basis', 'previous_retrieved_at', 'current_retrieved_at', 'previous_unit', 'current_unit', 'observation_change']) delete row[key];
            row.status = 'changed'; row.new_observation = true;
        }
    }
    if (variant === 'missing-previous-score') {
        data.metadata.score_delta.previous_score = null;
        data.metadata.score_delta.delta = 5.25;
        data.metadata.driver_changes_available = false;
        data.metadata.driver_changes = [];
        delete data.metadata.change_reconciliation;
    }
    fixture.parseSignal({ success: true, data }, 'US', mode);
    return { success: true, data };
}
const standard = payload('standard');
assert.equal(standard.data.metadata.driver_changes.length, 0, 'Offsetting fixture must have no net input contribution changes.');
const vix = standard.data.metadata.change_reconciliation.components.find(row => row.key === 'vix');
assert.equal(vix.status, 'changed'); assert.equal(vix.delta, 0); assert.notEqual(vix.score_effect, 0); assert.equal(vix.score_effect, -vix.weight_effect);
const summaries = ['2026-10-19', '2026-10-18', '2026-10-17'].map((date, index) => ({ date, score: 40 - index * 5, tier: 'sell', origin: 'observed', coverageNote: 'Controlled archive', hasFullEvidence: true, updatedAt: `${date}T17:00:00Z` }));
function snapshot(summary) {
    return { success: true, data: { summary, confidenceLevel: 'low', agreementPercent: 50, majoritySignal: 'SELL',
        components: inputs.map(item => ({ key: item.name, displayName: item.display_name, rawValue: item.value, score: item.score, weight: .2,
            signal: 'neutral', lastUpdated: `${summary.date}T14:30:00Z`, timestampBasis: 'observed', retrievedAt: `${summary.date}T15:02:00Z`, unit: item.metadata.unit })),
        scoreDrivers: [], indexTrend: [], signalQuality: {}, interpretationContext: {}, metadata: {} } };
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
const ledger = [], errors = [], unexpectedRequests = [];
async function open(width, options = {}) {
    const context = await browser.newContext({ viewport: { width, height: 960 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() !== 'error') return;
        const expected = message.location().url.includes('/api/signals/replay') && /status of (400|404)/.test(message.text());
        if (!expected) errors.push(message.text());
    });
    page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') errors.push(`${request.url()}: ${request.failure()?.errorText}`); });
    page.on('response', response => {
        if (response.status() >= 400 && !(response.url().includes('/api/signals/replay') && [400, 404].includes(response.status()))) errors.push(`${response.url()}: HTTP ${response.status()}`);
    });
    let variant = options.variant || 'offset', archivePhase = options.archivePhase || 'normal';
    const indexGate = options.indexGate, snapshotGate = options.snapshotGate;
    let scoreRequests = 0;
    await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        assert.equal(route.request().method(), 'GET', 'This suite must never mutate data.');
        if (url.pathname === '/api/owner/session') return route.fulfill({ json: { success: true, data: { configured: false, unlocked: false } } });
        if (url.pathname === '/api/signals/v2') { scoreRequests++; return route.fulfill({ json: payload(url.searchParams.get('mode') || 'standard', variant) }); }
        if (url.pathname === '/api/signals/replay') {
            const date = url.searchParams.get('date');
            if (!date) {
                if (indexGate) await indexGate.promise;
                if (archivePhase === 'index-error') return route.fulfill({ status: 400, json: { success: false, error: 'Controlled index failure' } });
                return route.fulfill({ json: { success: true, data: { market: 'US', mode: url.searchParams.get('mode'), enableSocial: url.searchParams.get('enableSocial') === 'true', summaries: archivePhase === 'empty' ? [] : summaries } } });
            }
            if (archivePhase === 'partial' && date === summaries[1].date) return route.fulfill({ status: 404, json: { success: false, error: 'Controlled missing snapshot' } });
            if (archivePhase === 'partial' && date === summaries[2].date && snapshotGate) await snapshotGate.promise;
            const result = snapshot(summaries.find(item => item.date === date));
            if (archivePhase === 'legacy') for (const item of result.data.components) { delete item.unit; delete item.timestampBasis; delete item.retrievedAt; }
            return route.fulfill({ json: result });
        }
        unexpectedRequests.push(url.pathname);
        return route.fulfill({ status: 404, json: { success: false } });
    });
    await page.goto(`${base}/main-v8`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('connected-score').waitFor();
    return { context, page, setArchivePhase: next => { archivePhase = next; }, setVariant: next => { variant = next; }, scoreRequests: () => scoreRequests };
}
async function geometry(page, width, name) {
    const result = await page.evaluate(() => {
        const rect = element => { const b = element.getBoundingClientRect(); return { x: b.x, y: b.y, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; };
        const chart = document.querySelector('[aria-label="Market score and history"]');
        const evidence = document.querySelector('[aria-label="Explore indicators"]');
        const pairs = [...document.querySelectorAll('[class*="comparisonValues"]')].filter(el => el.getClientRects().length).map(el => ({ parent: rect(el), labels: [...el.querySelectorAll('small')].map(rect) }));
        const controls = [...document.querySelectorAll('[aria-label="Leading evidence"] button, [aria-label="Chart range"] button')].filter(el => el.getClientRects().length).map(rect);
        return { overflow: document.documentElement.scrollWidth - innerWidth, chart: rect(chart), evidence: rect(evidence), chartFirst: !!(chart.compareDocumentPosition(evidence) & Node.DOCUMENT_POSITION_FOLLOWING), pairs, controls };
    });
    assert.ok(result.overflow <= 1, `${name} ${width}: page overflow ${result.overflow}`);
    assert.ok(result.chartFirst, 'Chart must precede evidence in DOM order.');
    assert.ok(width > 900 ? result.chart.x < result.evidence.x : result.chart.bottom <= result.evidence.y + 1, 'Visual chart/evidence sequence must match DOM sequence.');
    assert.ok(result.controls.every(rect => rect.height >= 43.5), 'Changed controls retain 44px targets.');
    for (const pair of result.pairs) for (const label of pair.labels) assert.ok(label.x >= pair.parent.x - 1 && label.right <= pair.parent.right + 1, 'Comparison labels stay inside their container.');
    ledger.push({ name, width, geometry: result });
}
try {
    for (const width of [1280, 768, 375]) {
        const session = await open(width); const { page } = session;
        const hero = page.getByRole('region', { name: 'Market assessment', exact: true });
        await hero.getByRole('button', { name: /Leading support: AAII/ }).waitFor();
        await hero.getByRole('button', { name: /Leading conflict: VIX Index/ }).waitFor();
        await page.getByText('No weighted-contribution changes.', { exact: true }).waitFor();
        const accounting = page.getByRole('region', { name: 'Complete score change accounting' });
        await accounting.locator('summary', { hasText: 'Complete accounting' }).click();
        await accounting.locator('summary', { hasText: 'VIX Index' }).click();
        await accounting.locator('summary', { hasText: 'Put/call ratio' }).click();
        await accounting.locator('summary', { hasText: 'AAII' }).click();
        assert.match(await accounting.innerText(), /Score and weight changed · net contribution unchanged/);
        assert.match(await accounting.innerText(), /% bullish/); assert.match(await accounting.innerText(), /VIX points/); assert.match(await accounting.innerText(), /put\/call ratio/);
        assert.match(await accounting.innerText(), /14:30:00 UTC/); assert.match(await accounting.innerText(), /15:02:00 UTC/);
        assert.match(await accounting.innerText(), /10:00:00 UTC/);
        const surveyReading = await accounting.locator('details details').filter({ hasText: 'AAII' }).innerText();
        assert.match(surveyReading, /Observed 20 Oct 2026/);
        assert.doesNotMatch(surveyReading, /00:00:00/, 'A date-only report must not imply midnight precision.');
        assert.match(await accounting.innerText(), /9\.80 points/);
        await geometry(page, width, 'accounting-and-leading-evidence');
        await accounting.screenshot({ path: `${output}/accounting-${width}.png` });
        await hero.screenshot({ path: `${output}/leading-evidence-${width}.png` });
        await page.getByRole('button', { name: 'Advanced tools', exact: true }).click();
        await page.getByRole('slider', { name: /Market condition score/ }).press('Home');
        await page.getByRole('button', { name: 'Open historical snapshot', exact: true }).click();
        await page.getByText('Leaning negative', { exact: true }).waitFor();
        assert.ok(!/strong-buy|strong-sell|\bstrong buy\b|\bstrong sell\b/.test(await page.locator('main').innerText()));
        await page.getByRole('button', { name: /Return to current/ }).click();
        await session.context.close();

        const missingPrevious = await open(width, { variant: 'missing-previous-score' });
        const missingHero = missingPrevious.page.getByRole('region', { name: 'Market assessment', exact: true });
        const spectrum = missingHero.getByRole('img', { name: /^Score [0-9]+ on a 0 to 100 scale/ });
        assert.doesNotMatch(await spectrum.getAttribute('aria-label'), /Previous score/, 'An unavailable previous score must not be announced as a derived value.');
        assert.equal(await spectrum.locator('[class*="v81PreviousPin"]').count(), 0, 'An unavailable previous score must not acquire a ghost pin.');
        await missingHero.getByRole('button', { name: '+5.25 points vs 19 Oct 2026 ↗', exact: true }).click();
        const previousMetric = missingPrevious.page.getByText('Previous score', { exact: true }).locator('..');
        assert.equal(await previousMetric.locator('strong').innerText(), 'Unavailable', 'The headline and detail must agree that the previous score is unavailable.');
        assert.equal(await missingPrevious.page.getByRole('tab', { name: 'What changed', exact: true }).getAttribute('aria-selected'), 'true');
        await geometry(missingPrevious.page, width, 'missing-previous-score');
        await missingHero.screenshot({ path: `${output}/missing-previous-score-${width}.png` });
        await missingPrevious.context.close();

        const indexGate = deferred(), snapshotGate = deferred();
        const history = await open(width, { indexGate, snapshotGate, archivePhase: 'partial' });
        const trigger = history.page.getByRole('button', { name: /Leading conflict: VIX Index/ });
        await trigger.click();
        const inspector = width > 900 ? history.page.getByRole('complementary', { name: 'Selected indicator' }) : history.page.getByRole('dialog', { name: 'Indicator detail' });
        await inspector.getByText('Loading archived readings…', { exact: true }).waitFor();
        indexGate.resolve();
        await inspector.getByText(/Showing 1 archived reading; 1 archive date still loading/).waitFor();
        snapshotGate.resolve();
        await inspector.getByRole('button', { name: 'Retry history', exact: true }).waitFor();
        await inspector.getByText(/Showing previously loaded history/).waitFor();
        await inspector.screenshot({ path: `${output}/history-partial-${width}.png` });
        const before = history.scoreRequests(); history.setArchivePhase('normal');
        await inspector.getByRole('button', { name: 'Retry history', exact: true }).click();
        await inspector.getByText('Showing 3 archived readings.', { exact: true }).waitFor();
        assert.equal(history.scoreRequests(), before, 'Local archive retry must not reload current market data.');
        assert.equal(await inspector.getByRole('button', { name: 'Reload history', exact: true }).evaluate(el => el === document.activeElement), true, 'Retry completion retains focus on the same history action.');
        await history.page.keyboard.press('Escape');
        await history.page.waitForFunction(() => document.activeElement instanceof HTMLButtonElement && document.activeElement.textContent?.includes('Leading conflict:') && document.activeElement?.textContent?.includes('VIX Index'));
        assert.equal(await trigger.evaluate(el => el === document.activeElement), true, 'Inspector close restores the leading-evidence trigger.');
        await geometry(history.page, width, 'history-retry-and-focus');
        await history.context.close();
    }
    for (const phase of ['empty', 'index-error', 'legacy']) {
        const session = await open(375, { archivePhase: phase });
        await session.page.getByRole('button', { name: /Leading conflict: VIX Index/ }).click();
        const inspector = session.page.getByRole('dialog', { name: 'Indicator detail' });
        await inspector.getByText(phase === 'empty' ? 'No archived readings have been stored.' : phase === 'legacy' ? 'No comparable raw readings are available in the loaded snapshots.' : 'Archived readings could not be loaded.', { exact: true }).waitFor();
        if (phase === 'index-error') {
            session.setArchivePhase('normal'); await inspector.getByRole('button', { name: 'Retry history', exact: true }).click();
            await inspector.getByText('Showing 3 archived readings.', { exact: true }).waitFor();
        }
        ledger.push({ name: `mobile-history-${phase}`, width: 375 }); await session.context.close();
    }
    for (const variant of ['missing', 'retrieval', 'legacy']) {
        const session = await open(375, { variant });
        if (variant === 'missing') await session.page.getByText('Driver comparison unavailable.', { exact: true }).waitFor();
        else {
            const accounting = session.page.getByRole('region', { name: 'Complete score change accounting' });
            await accounting.locator('summary', { hasText: 'Complete accounting' }).click();
            await accounting.locator('summary', { hasText: 'VIX Index' }).click();
            assert.match(await accounting.innerText(), /Retrieval alone does not establish a new observation/);
            if (variant === 'legacy') { assert.match(await accounting.innerText(), /Timestamp basis unavailable/); assert.match(await accounting.innerText(), /unit unavailable/); }
            assert.ok(!(await accounting.innerText()).includes('Newer observed reading.'));
        }
        ledger.push({ name: variant, width: 375 }); await session.context.close();
    }
    const tiers = await open(375, { variant: 'tiers' });
    for (const mode of ['standard', 'contrarian']) {
        if (mode === 'contrarian') await tiers.page.getByRole('button', { name: 'Contrarian', exact: true }).click();
        if (await tiers.page.getByRole('button', { name: 'Advanced tools', exact: true }).isVisible()) await tiers.page.getByRole('button', { name: 'Advanced tools', exact: true }).click();
        await tiers.page.getByRole('tab', { name: 'Scenarios', exact: true }).click();
        const slider = tiers.page.getByRole('slider', { name: /Hypothetical normalized score/ });
        const labels = mode === 'standard' ? ['strong-sell', 'sell', 'neutral', 'buy', 'strong-buy'] : ['strong-buy', 'buy', 'neutral', 'sell', 'strong-sell'];
        for (const [index, score] of [10, 30, 50, 70, 90].entries()) {
            await slider.evaluate((el, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(value)); el.dispatchEvent(new Event('input', { bubbles: true })); }, score);
            await tiers.page.getByText(`Simulated reading: ${marketReadingLabel(labels[index])} · ${mode === 'standard' ? 'Momentum' : 'Contrarian'} · hypothetical`, { exact: true }).waitFor();
            const card = tiers.page.locator('[data-reading]');
            assert.equal(await card.getAttribute('data-reading'), labels[index].includes('buy') ? 'positive' : labels[index].includes('sell') ? 'negative' : 'neutral');
        }
    }
    await tiers.page.getByTestId('market-v8-connected-scenarios').screenshot({ path: `${output}/scenario-negative-375.png` });
    ledger.push({ name: 'all-five-tiers-both-modes', width: 375 }); await tiers.context.close();
    assert.deepEqual(errors, []); assert.deepEqual(unexpectedRequests, []);
    await writeFile(`${output}/report.json`, JSON.stringify({ status: 'passed', controlledFixtures: true, ledger, errors, unexpectedRequests }, null, 2));
    console.log(`PASS Market clarity: ${ledger.length} scenarios; evidence ${output}`);
} finally { await browser.close(); }
