import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { chromium } from 'playwright';
import { marketRequestFixture } from './harness/market-request-fixture.mjs';
import { researchSnapshotFixture } from './harness/research-read-fixture.mjs';

const base = process.env.SIGNAL_QA_URL || 'http://127.0.0.1:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const output = '.tmp/v9-enhancements';
await mkdir(output, { recursive: true });

const cache = new Map();
function loadTs(file) {
    const absolute = path.resolve(file);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const mod = { exports: {} };
    cache.set(absolute, mod);
    const req = id => {
        const resolved = id.startsWith('@/') ? path.resolve('src', id.slice(2)) : path.resolve(path.dirname(absolute), id);
        return loadTs(`${resolved}.ts`);
    };
    const code = ts.transpileModule(readFileSync(absolute, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function('require', 'module', 'exports', code)(req, mod, mod.exports);
    return mod.exports;
}

const { createResearchRecord } = loadTs('src/lib/research/records.ts');

const marketFixture = marketRequestFixture({
    providerOverrides: {
        fetchVIX: () => ({ price: 30.4, change: 0, observedAt: new Date('2026-09-11T20:00:00Z') }),
    },
    providerReadings: {
        putCallRatio: {
            ratio: 1.08,
            reportDate: '2026-09-11',
            observedAt: '2026-09-11T20:00:00Z',
            source: 'Cboe',
            totalCalls: 1200000,
            totalPuts: 1296000,
            sourceUrl: 'https://www.cboe.com/',
        },
    },
});
const usSignal = await (await marketFixture.route.GET(marketFixture.request('market=US&mode=standard&enableSocial=false'))).json();
const usContrarianSignal = await (await marketFixture.route.GET(marketFixture.request('market=US&mode=contrarian&enableSocial=false'))).json();
const mySignal = await (await marketFixture.route.GET(marketFixture.request('market=MY&mode=standard&enableSocial=false'))).json();
assert.ok(usSignal.success && Object.keys(usSignal.data?.components ?? {}).length >= 2, 'US fixture needs >= 2 indicators');

const peerMsftPoints = Array.from({ length: 66 }, (_, i) => {
    const dt = new Date(Date.UTC(2026, 6, 8 + i));
    const close = Number((410 + i * 0.31 + Math.cos(i / 6) * 5.4).toFixed(2));
    return {
        time: dt.toISOString().slice(0, 10),
        open: close - 1,
        high: close + 2,
        low: close - 2,
        close,
        volume: 25_000_000,
        ma50: close - 3,
        ma200: close - 12,
        ema20: close - 1.5,
        ema50: close - 3,
        sma200: close - 12,
        averageVolume20: 24_000_000,
        rsi14: 54,
        macd: 0.9,
        macdSignal: 0.7,
        macdHistogram: 0.2,
        atr14: 4.1,
        atrPercent14: 1.0,
        anchoredVwap: close - 2,
        adx14: 22,
        plusDi14: 24,
        minusDi14: 18,
        supertrend: close - 4,
        supertrendDirection: 1,
    };
});

const aaplSnapshot = structuredClone(researchSnapshotFixture.data);
aaplSnapshot.symbol = 'AAPL';
aaplSnapshot.market = 'US';
aaplSnapshot.quote.name = 'Apple Inc.';
aaplSnapshot.quote.price = 228.5;
aaplSnapshot.quote.currency = 'USD';
aaplSnapshot.quote.dailyChangePercent = 1.42;
aaplSnapshot.quote.observedAt = '2026-09-11T20:00:00Z';
aaplSnapshot.chart.points = Array.from({ length: 66 }, (_, i) => {
    const dt = new Date(Date.UTC(2026, 6, 8 + i));
    const close = Number((200 + i * 0.42 + Math.sin(i / 5) * 4.2).toFixed(2));
    return {
        time: dt.toISOString().slice(0, 10),
        open: close - 1,
        high: close + 2,
        low: close - 2,
        close,
        volume: 45_000_000,
        ma50: close - 2,
        ma200: close - 10,
        ema20: close - 1,
        ema50: close - 2,
        sma200: close - 10,
        averageVolume20: 42_000_000,
        rsi14: 56,
        macd: 1.1,
        macdSignal: 0.9,
        macdHistogram: 0.2,
        atr14: 3.1,
        atrPercent14: 1.4,
        anchoredVwap: close - 1.5,
        adx14: 24,
        plusDi14: 26,
        minusDi14: 17,
        supertrend: close - 3,
        supertrendDirection: 1,
    };
});
aaplSnapshot.technicals.low52Week = 175;
aaplSnapshot.technicals.high52Week = 242;

const baseRecord = createResearchRecord({ symbol: 'AAPL', market: 'US', companyName: 'Apple Inc.' });
const ownerRecord = {
    ...baseRecord,
    whyInterested: 'Services mix expanding operating margins while steady buybacks shrink share count.',
    notes: 'Waiting for pullback near 215 USD before adding.',
    positionPlan: { ...baseRecord.positionPlan, plannedEntryPrice: 215, invalidationPrice: 185, currency: 'USD' },
    factorAssumptions: {
        version: 1,
        migrationState: 'current',
        assumptions: [
            { factor: 'interest-rates', direction: 'harmed-when-rises', materiality: 'moderate', evidenceNote: 'Higher discount rates weigh on long-duration valuation multiples.', evidenceDate: '2026-08-20', evidenceId: null },
            { factor: 'consumer-demand', direction: 'benefits-when-rises', materiality: 'high', evidenceNote: 'Hardware upgrade cycles and services ARPU track household spending.', evidenceDate: '2026-08-20', evidenceId: null },
            { factor: 'china-growth', direction: 'benefits-when-rises', materiality: 'high', evidenceNote: 'Greater China remains a material revenue and supply-chain region.', evidenceDate: '2026-08-20', evidenceId: null },
        ],
    },
    decisionJournal: { ...baseRecord.decisionJournal, decision: 'Wait for price', observedPrice: 210, observedCurrency: 'USD', nextReviewAt: '2020-01-01' },
    reviewHistory: [
        {
            id: 'rev-1',
            reviewedAt: aaplSnapshot.chart.points[20].time + 'T12:00:00Z',
            positionState: 'not-owned',
            inBuyZone: false,
            status: 'watch',
            targetBuyZone: '210-215',
            valuationState: 'fair',
            thesisStrength: 'high',
            whyInterested: 'Services mix expanding operating margins while steady buybacks shrink share count.',
            bullCase: 'AI cycle upgrade',
            bearCase: 'China demand slowdown',
            buyTrigger: '215',
            sellTrigger: '',
            thesisBreak: 'Services margin compression',
            notes: 'Reviewed after Q3 earnings.',
            checklist: baseRecord.checklist,
            monitoringRules: baseRecord.monitoringRules,
            acceptedEvidence: [],
            documentEvidence: baseRecord.documentEvidence,
            factorAssumptions: baseRecord.factorAssumptions,
            decisionJournal: { ...baseRecord.decisionJournal, decision: 'Wait for price', observedPrice: 210, observedCurrency: 'USD' },
            positionPlan: { ...baseRecord.positionPlan, plannedEntryPrice: 215, invalidationPrice: 185, currency: 'USD' },
        },
    ],
};

const valuationPlan = {
    ticker: 'AAPL',
    currentEps: 6.75,
    years: 5,
    annualDiscountRatePct: 10,
    scenarios: [
        { id: 'bear', label: 'Bear', currentEps: 6.75, epsCagrPct: 5, terminalPe: 20, years: 5, annualDiscountRatePct: 10 },
        { id: 'base', label: 'Base', currentEps: 6.75, epsCagrPct: 11, terminalPe: 26, years: 5, annualDiscountRatePct: 10 },
        { id: 'bull', label: 'Bull', currentEps: 6.75, epsCagrPct: 16, terminalPe: 30, years: 5, annualDiscountRatePct: 10 },
    ],
    updatedAt: '2026-09-10T00:00:00.000Z',
};

const fngHistory = Array.from({ length: 40 }, (_, i) => {
    const dt = new Date(Date.UTC(2026, 7, 1 + i));
    return { date: dt.toISOString().slice(0, 10), score: Math.round(35 + Math.sin(i / 4) * 18), rating: i % 2 === 0 ? 'fear' : 'neutral' };
});

const report = { checks: [], failures: [], errors: [] };
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });

async function runCheck(name, fn) {
    try {
        await fn();
        report.checks.push(name);
        console.log(`PASS ${name}`);
    } catch (error) {
        report.failures.push({ name, error: error.stack || error.message });
        console.error(`FAIL ${name}: ${error.message}`);
    }
}

async function createPage(width, theme, owner = false) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
    if (owner) {
        await context.addInitScript(() => {
            localStorage.setItem('signal-portfolio-holdings-v1', JSON.stringify({
                version: 1,
                updatedAt: '2026-09-10T10:00:00.000Z',
                holdings: [
                    { accountLabel: 'Core US', market: 'US', symbol: 'AAPL', quantity: 40, averageCost: 195, currency: 'USD', importedAt: '2026-09-10T10:00:00.000Z', provenanceLabel: 'Broker CSV snapshot' },
                    { accountLabel: 'Core US', market: 'US', symbol: 'MSFT', quantity: 15, averageCost: 390, currency: 'USD', importedAt: '2026-09-10T10:00:00.000Z', provenanceLabel: 'Broker CSV snapshot' },
                ],
                cashBalances: [{ accountLabel: 'Core US', currency: 'USD', balance: 4200, importedAt: '2026-09-10T10:00:00.000Z', provenanceLabel: 'Broker CSV snapshot' }],
            }));
        });
    }
    await context.route('**/*', async route => {
        const req = route.request();
        const url = new URL(req.url());
        if (url.origin !== new URL(base).origin) return route.abort();
        if (!url.pathname.startsWith('/api/')) return route.continue();
        if (url.pathname === '/api/owner/session') return route.fulfill({ json: { success: true, data: { configured: owner, unlocked: owner } } });
        if (url.pathname === '/api/research/watchlist') return route.fulfill({ json: { success: true, data: owner ? [ownerRecord] : [], archivedSymbols: [] } });
        if (url.pathname === '/api/signals/v2') {
            const mkt = url.searchParams.get('market');
            const mode = url.searchParams.get('mode');
            if (mkt === 'MY') return route.fulfill({ json: mySignal });
            return route.fulfill({ json: mode === 'contrarian' ? usContrarianSignal : usSignal });
        }
        if (url.pathname === '/api/signals/intraday') return route.fulfill({ json: { success: true, data: { market: 'US', mode: 'standard', enableSocial: false, day: '2026-09-12', entries: [], hasEarlierCaptures: false } } });
        if (url.pathname === '/api/signals/replay') return route.fulfill({ json: { success: true, data: { market: 'US', mode: 'standard', enableSocial: false, summaries: [] } } });
        if (url.pathname === '/api/signals/internals') return route.fulfill({ json: { success: true, data: { market: 'US', available: false, updatedAt: null, items: [] } } });
        if (url.pathname === '/api/signals/fear-greed') return route.fulfill({ json: { success: true, data: { available: true, score: 31, rating: 'fear', previousClose: 35, oneWeekAgo: 44, oneMonthAgo: 56, updatedAt: '2026-09-12T00:00:00.000Z', history: fngHistory } } });
        if (url.pathname.startsWith('/api/research/symbol/')) return route.fulfill({ json: { success: true, data: aaplSnapshot } });
        if (url.pathname.startsWith('/api/research/chart/')) {
            const sym = decodeURIComponent(url.pathname.split('/').at(-1) || 'AAPL').toUpperCase();
            return route.fulfill({ json: { success: true, data: { symbol: sym, market: 'US', fetchedAt: '2026-09-12T00:00:00Z', chart: { interval: '1d', points: sym === 'MSFT' ? peerMsftPoints : aaplSnapshot.chart.points } } } });
        }
        if (url.pathname.startsWith('/api/research/valuation-plan/')) return route.fulfill({ json: { success: true, data: valuationPlan } });
        if (url.pathname.startsWith('/api/research/valuation-history/')) return route.fulfill({ json: { success: true, data: { symbol: 'AAPL', market: 'US', observations: [], capabilities: {}, warnings: [] } } });
        return route.fulfill({ json: { success: true, data: {} } });
    });
    return { context, page };
}

try {
    for (const [width, theme] of [[1280, 'dark'], [1280, 'light'], [375, 'dark']]) {
        const { context, page } = await createPage(width, theme, true);

        await runCheck(`market score anatomy & cadence ${width} ${theme}`, async () => {
            await page.goto(`${base}/v9?market=US&mode=standard&enableSocial=false`, { waitUntil: 'domcontentloaded' });
            await page.getByTestId('v9-workspace').filter({ visible: true }).waitFor();
            const evidence = page.getByRole('region', { name: 'Explore indicators' });
            try {
                await evidence.waitFor({ timeout: 8000 });
            } catch (err) {
                const body = (await page.locator('main:visible').first().innerText().catch(() => '')).slice(0, 500);
                throw new Error(`${err.message} | MAIN: ${body}`);
            }
            await evidence.getByText('Live · daily').first().waitFor();
            await evidence.getByRole('button', { name: 'Explore score anatomy' }).click();
            const anatomy = page.getByTestId('market-score-anatomy');
            await anatomy.waitFor();
            await anatomy.getByRole('button', { name: /VIX Index/ }).click();
            assert.match(await anatomy.innerText(), /without VIX Index/);
            assert.match(await anatomy.innerText(), /Exploring · not saved/);
            await anatomy.scrollIntoViewIfNeeded();
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'no horizontal overflow');
            await page.screenshot({ path: `${output}/market-anatomy-${width}-${theme}.png` });
            await anatomy.getByRole('button', { name: 'Reset' }).click();
            assert.match(await anatomy.innerText(), /Official score/);

            // Dual-Market US vs MY & Dual-Mode Momentum vs Contrarian Compare
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.getByRole('button', { name: 'Compare', exact: true }).click();
            const compare = page.getByTestId('v9-market-compare');
            await compare.waitFor();
            await compare.getByText('Malaysia · Bursa').waitFor();
            await compare.getByRole('button', { name: 'Momentum vs. Contrarian' }).click();
            await compare.getByRole('columnheader', { name: 'Contrarian' }).waitFor();
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'no horizontal overflow');
            await page.screenshot({ path: `${output}/market-compare-${width}-${theme}.png` });
            await compare.getByRole('button', { name: 'Close compare' }).click();
        });

        await runCheck(`research chart measure, pins, peer overlay, due review & readiness ${width} ${theme}`, async () => {
            await page.goto(`${base}/v9?view=research&ticker=AAPL&market=US`, { waitUntil: 'domcontentloaded' });
            await page.getByTestId('v9-due-review').waitFor();
            await page.getByTestId('v9-research-readiness').waitFor();
            await page.getByText(/1 saved review in this range/).waitFor();
            await page.getByRole('button', { name: 'Measure' }).click();
            const chart = page.getByRole('slider', { name: /Price history over 3M/ });
            await chart.scrollIntoViewIfNeeded();
            const box = await chart.boundingBox();
            assert.ok(box && box.width > 100);
            await chart.click({ position: { x: Math.round(box.width * 0.25), y: Math.round(box.height * 0.5) } });
            await chart.click({ position: { x: Math.round(box.width * 0.80), y: Math.round(box.height * 0.5) } });
            const readout = page.getByTestId('v9-chart-measurement');
            await readout.waitFor();
            assert.match(await readout.innerText(), /returned observations/);
            assert.match(await readout.innerText(), /Exploring · not saved/);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'no horizontal overflow');
            await page.screenshot({ path: `${output}/research-overview-${width}-${theme}.png` });

            // Peer Rebased Chart Overlay (R4)
            const overlayBar = page.getByTestId('v9-peer-overlay-bar');
            await overlayBar.getByRole('button', { name: '+ MSFT' }).click();
            await page.getByTestId('v9-peer-overlay-line-MSFT').waitFor();
            await page.getByTestId('v9-peer-overlay-note').waitFor();
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'no horizontal overflow');
            await page.screenshot({ path: `${output}/research-peer-overlay-${width}-${theme}.png` });
            await overlayBar.getByRole('button', { name: 'Clear overlay' }).click();
        });

        await runCheck(`portfolio factor exposure matrix ${width} ${theme}`, async () => {
            await page.goto(`${base}/v9?view=portfolio&tab=factors`, { waitUntil: 'domcontentloaded' });
            const panel = page.getByTestId('v9-factor-exposure');
            await panel.waitFor();
            await panel.getByText('Core US · USD').waitFor();
            await panel.getByText('Consumer demand').first().waitFor();
            await panel.getByRole('button', { name: /Benefits.*High/ }).first().click();
            await panel.getByTestId('v9-factor-detail').waitFor();
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'no horizontal overflow');
            await page.screenshot({ path: `${output}/portfolio-factors-${width}-${theme}.png` });
        });

        await runCheck(`valuation reasoning V9 visual range bar ${width} ${theme}`, async () => {
            await page.goto(`${base}/v9?view=research&ticker=AAPL&market=US&tab=valuation`, { waitUntil: 'domcontentloaded' });
            const panel = page.getByTestId('valuation-reasoning-v9');
            await panel.waitFor();
            await panel.getByText(/Scenario present-value range vs\. market price/).waitFor();
            await panel.getByText(/Market-implied EPS CAGR:/).waitFor();
            await panel.scrollIntoViewIfNeeded();
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'no horizontal overflow');
            await page.screenshot({ path: `${output}/valuation-v9-${width}-${theme}.png` });
        });

        await context.close();
    }

    // Guest local-only valuation check (zero /api/research/valuation-plan calls)
    const guest = await createPage(1280, 'light', false);
    await runCheck('guest valuation local-only mode makes zero owner plan calls', async () => {
        let planRequests = 0;
        guest.page.on('request', req => { if (req.url().includes('/api/research/valuation-plan/')) planRequests += 1; });
        await guest.page.goto(`${base}/v9?view=research&ticker=AAPL&market=US&tab=valuation`, { waitUntil: 'domcontentloaded' });
        const panel = guest.page.getByTestId('valuation-reasoning-v9');
        await panel.waitFor();
        await panel.getByLabel('Current EPS').fill('6.75');
        await panel.getByText(/Scenario present-value range vs\. market price/).waitFor();
        await panel.getByText('Exploring · not saved').waitFor();
        assert.equal(planRequests, 0, 'guest local-only valuation must not call owner valuation-plan API');
    });
    await guest.context.close();
} finally {
    await browser.close();
    await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
}

if (report.failures.length || report.errors.length) {
    console.error('QA failures/errors:', JSON.stringify({ failures: report.failures, errors: report.errors }, null, 2));
    process.exitCode = 1;
}
