import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { marketRequestFixture } from './harness/market-request-fixture.mjs';
import { researchReadFixture, researchSnapshotFixture } from './harness/research-read-fixture.mjs';

const base = process.env.SIGNAL_QA_URL || 'http://127.0.0.1:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Fixture QA is local only.');
const output = '.tmp/v81/browser';
await mkdir(output, { recursive: true });
const fixture = marketRequestFixture();
const us = await (await fixture.route.GET(fixture.request('market=US&mode=standard&enableSocial=true'))).json();
const my = await (await fixture.route.GET(fixture.request('market=MY&mode=standard&enableSocial=true'))).json();
assert.equal(us.success, true, 'Valid US score fixture required');
const original = us.data.components.vix;
assert.ok(original, 'Fixture must include a VIX indicator.');

function indicator(key, name, value, weight, lastUpdated, score) {
    return {
        ...structuredClone(original), name: key, display_name: name, value,
        score, weight, signal: 'neutral', enabled: true, last_updated: lastUpdated,
        metadata: { ...(original.metadata || {}), timestamp_basis: 'observed' },
    };
}
function marketPayload(unknownDate = false) {
    const body = structuredClone(us);
    const data = body.data;
    data.composite_score = 62;
    data.tier = 'neutral';
    data.components = {
        vix: indicator('vix', 'VIX Index', 16.46, .35, '2026-10-16T00:00:00.000Z', 80),
        put_call: indicator('put_call', 'Put/call ratio', .80, .10, '2026-10-16T00:00:00.000Z', 90),
        aaii: indicator('aaii', 'AAII Sentiment', 36.3, .20, '2026-07-08T00:00:00.000Z', 37.5),
    };
    if (unknownDate) data.components.put_call.metadata.timestamp_basis = 'retrieved';
    data.metadata.coverage_adjustment = {
        active_weight: .65, missing_weight: .35, neutral_baseline: 50,
        active_points: 44.5, neutral_points: 17.5,
    };
    data.metadata.score_delta = {
        previous_score: 63, delta: -1, previous_date: '2026-10-10',
        snapshot_date: '2026-10-16', label: 'Down one point since October 10',
    };
    data.metadata.score_history = [
        { date: '2026-10-10', score: 63, tier: 'neutral', origin: 'reconstructed', coverage_note: null },
        { date: '2026-10-16', score: 62, tier: 'neutral', origin: 'observed', coverage_note: null },
    ];
    data.metadata.driver_changes_available = true;
    data.metadata.driver_changes = [
        { key: 'vix', name: 'VIX Index', current_contribution: 28, previous_contribution: 29.51, delta: -1.51 },
        { key: 'put_call', name: 'Put/call ratio', current_contribution: 9, previous_contribution: 8.56, delta: .44 },
    ];
    data.confidence.agreement_pct = 67;
    data.confidence.conflicting_indicators = ['vix'];
    data.metadata.signal_quality = {
        ...data.metadata.signal_quality,
        warnings: ['AAII Sentiment data is stale (2026-07-08T00:00:00.000Z).'],
    };
    return body;
}
const saved = (await (await researchReadFixture().route.GET()).json()).data[0];
const quoteNullables = ['volume','ma50','ma200','ema20','ema50','sma200','averageVolume20','rsi14','macd','macdSignal','macdHistogram','atr14','atrPercent14','anchoredVwap','adx14','plusDi14','minusDi14','supertrend'];
const point = (time, price) => ({
    time, open: price, high: price + 1, low: price - 1, close: price,
    ...Object.fromEntries(quoteNullables.map(key => [key, null])),
    supertrendDirection: null,
});
function researchPayload(symbol, market) {
    const body = structuredClone(researchSnapshotFixture);
    Object.assign(body.data, { symbol, market, fetchedAt: new Date().toISOString() });
    Object.assign(body.data.quote, {
        name: 'Fixture ' + symbol, currency: market === 'MY' ? 'MYR' : 'USD',
        price: 200, dailyChangePercent: -.28, observedAt: '2026-10-15T20:00:00Z',
        instrumentType: symbol === 'VOO' ? 'ETF' : 'EQUITY',
    });
    body.data.quote.classification = {
        source: 'Yahoo Finance', instrumentType: body.data.quote.instrumentType,
        sector: 'Technology', industry: 'Consumer Electronics', retrievedAt: new Date().toISOString(),
    };
    Object.assign(body.data.fundamentals, {
        source: null, reportingPeriod: null, revenueGrowthPercent: null,
        annualNetIncome: null, freeCashFlow: null,
    });
    body.data.chart.points = [
        point('2026-09-15', 192), point('2026-10-01', 196), point('2026-10-15', 200),
    ];
    return body;
}
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const report = [];
try {
    for (const width of [1280, 768, 375]) {
        const context = await browser.newContext({
            viewport: { width, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce',
        });
        const page = await context.newPage();
        const errors = [];
        let unknownDate = false;
        let missingSnapshot = false;
        let contextOnly = false;
        const providerReads = [];
        page.on('pageerror', error => errors.push(error.message));
        await context.route('**/api/**', async route => {
            const url = new URL(route.request().url());
            if (url.pathname === '/api/signals/v2') {
                const body = url.searchParams.get('market') === 'MY' ? structuredClone(my) : marketPayload(unknownDate);
                if (missingSnapshot) delete body.data.metadata.score_delta;
                if (contextOnly) body.data.components.vix.weight = 0;
                return route.fulfill({ json: body });
            }
            if (url.pathname.startsWith('/api/signals/')) {
                return route.fulfill({ status: 503, json: { success: false, error: 'Fixture archive unavailable' } });
            }
            if (url.pathname === '/api/research/watchlist') {
                return route.fulfill({ json: { success: true, data: [saved], archivedSymbols: [] } });
            }
            if (url.pathname.startsWith('/api/research/symbol/')) {
                const symbol = decodeURIComponent(url.pathname.split('/').at(-1));
                const market = url.searchParams.get('market');
                providerReads.push({ symbol, market });
                return route.fulfill({ json: researchPayload(symbol, market) });
            }
            return route.fulfill({ json: { success: true, data: [] } });
        });
        const noOverflow = async label => {
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
            assert.ok(overflow <= 1, label + ': horizontal overflow ' + overflow + 'px at width ' + width);
        };

        await page.goto(base + '/main-v8');
        await page.getByTestId('connected-score').waitFor();
        const hero = page.getByRole('region', { name: 'Market assessment', exact: true });
        assert.equal(await hero.getByTestId('connected-score').innerText(), '62');
        assert.match(await hero.innerText(), /65\.0% configured weight/);
        await hero.getByText('Fresh 45.0% · stale 20.0% of model weight.', { exact: true }).waitFor();
        await hero.getByText('35.0% of configured weight uses neutral fallback for missing inputs.', { exact: true }).waitFor();
        assert.equal(await page.locator('[data-indicator]').count(), 6);
        if (width <= 900) await page.getByRole('button', { name: 'Show all 6 inputs' }).click();
        await page.getByRole('button', { name: /BofA SSI/ }).waitFor();
        const skip = page.locator('a[href="#market-content"]');
        await skip.focus();
        const rect = await skip.boundingBox();
        assert.ok(rect && rect.width > 90 && rect.y < 80, 'Skip link must become visible when focused.');
        await page.locator('main').click({ position: { x: 10, y: 10 }, force: true }).catch(() => {});
        await page.getByText('How to read this assessment · supporting inputs and limits', { exact: true }).click();
        const quality = page.getByRole('region', { name: 'Data needs attention' });
        await quality.waitFor();
        await quality.locator('details summary').click();
        await quality.getByText('AAII Sentiment: stale observation.', { exact: true }).waitFor();
        await hero.getByRole('button', { name: /points vs/ }).click();
        assert.equal(await page.getByRole('tab', { name: 'What changed' }).getAttribute('aria-selected'), 'true');
        const chart = page.getByRole('slider', { name: 'Market condition score' });
        // The investigation shortcut queues a requestAnimationFrame focus transfer. Wait for it
        // before pressing Home so the chart—not the scrolling document—receives the keystroke.
        await page.waitForFunction(() => document.activeElement?.id === 'investigation-panel');
        await chart.press('Home');
        await page.waitForFunction(() => document.querySelector('[role="slider"][aria-label="Market condition score"]')?.getAttribute('aria-valuetext')?.includes('10 Oct'));
        const chartFootText = await page.locator('[class*="chartFoot"]').first().innerText();
        console.log('Selected history:', await chart.getAttribute('aria-valuetext'), 'details:', JSON.stringify(chartFootText));
        assert.match(chartFootText, /Historical source-weight percentage unavailable/, 'Selected older point must not inherit today’s weight coverage.');
        await noOverflow('Market current and historical');
        if (width !== 768) {
            await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
            await page.screenshot({ path: output + '/market-' + width + '.png', fullPage: true });
        }

        if (width === 1280) {
            unknownDate = true;
            await page.reload();
            await page.getByTestId('connected-score').waitFor();
            await hero.getByText('65.0% configured weight', { exact: true }).waitFor();
            await hero.getByText(/Put\/call ratio: Observation date unknown/).waitFor();
            await noOverflow('Market unknown date');
            missingSnapshot = true; unknownDate = false; contextOnly = true;
            await page.reload(); await page.getByTestId('connected-score').waitFor();
            await page.locator('[data-indicator="put_call"]').getByText('Freshness unknown', { exact: true }).waitFor();
            await page.locator('[data-indicator="vix"]').getByText('Context · not scored', { exact: true }).waitFor();
            assert.doesNotMatch(await page.locator('[data-indicator="vix"]').innerText(), /Momentum:|Contrarian:/);
            await page.locator('[data-indicator="put_call"]').click();
            const inspector = page.getByRole('complementary', { name: 'Selected indicator', exact: true });
            await inspector.getByText('Freshness unavailable', { exact: true }).waitFor();
            await inspector.getByRole('button', { name: 'Close indicator detail' }).click();
            missingSnapshot = false; contextOnly = false;
        }

        providerReads.length = 0;
        await page.goto(base + '/research-v8?market=MY');
        await page.getByLabel('Lookup market', { exact: true }).waitFor();
        assert.equal(await page.getByLabel('Lookup market', { exact: true }).inputValue(), 'MY');
        assert.equal(await page.getByRole('article', { name: /AAPL research/ }).count(), 0);
        assert.equal(providerReads.length, 0, 'No US provider read for an MY-only handoff.');

        await page.goto(base + '/research-v8?ticker=VOO&market=US');
        const status = page.getByRole('region', { name: 'Financial assessment status' });
        await status.getByText('Assessment unsupported', { exact: true }).waitFor();
        const assessment = page.getByRole('region', { name: 'Current research assessment' });
        if (width !== 768) await page.screenshot({ path: output + '/research-compact-' + width + '.png', fullPage: true });
        assert.equal(await assessment.locator('[class*="assessmentGrid"]').count(), 0);
        await assessment.locator('summary').first().click();
        await assessment.getByText(/Financial source:/).waitFor();
        await assessment.getByText('Fixture: fundamentals unavailable.', { exact: true }).waitFor();
        assert.equal(await page.getByRole('region', { name: 'Provider data status' }).locator('details[class*="warning"]').count(), 0, 'Source notices for unsupported assessments must not appear twice.');
        await page.getByRole('region', { name: 'Price history' }).waitFor();
        await noOverflow('Research unsupported price history');
        if (width !== 768) {
            await page.screenshot({ path: output + '/v81-' + width + '.png', fullPage: true });
        }
        assert.deepEqual(errors, [], 'No runtime errors at width ' + width);
        report.push({ width, outcome: 'pass', score: 62, observedWeight: 65, archivedCoverage: 'withheld', marketContext: 'MY retained', errors });
        await context.close();
    }
    await writeFile(output + '/report.json', JSON.stringify({ status: 'passed', fixture: true, report }, null, 2));
    console.log('PASS Signal V8.1 desktop/tablet/mobile fixture UI: ' + output);
} finally {
    await browser.close();
}
