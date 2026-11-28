import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { chromium } from 'playwright';
import { marketRequestFixture } from './harness/market-request-fixture.mjs';

const base = process.env.SIGNAL_QA_URL || 'http://127.0.0.1:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const output = '.tmp/v9-pr1';
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

const marketFixture = marketRequestFixture();
const usSignal = await (await marketFixture.route.GET(marketFixture.request('market=US&mode=standard&enableSocial=false'))).json();
const mySignal = await (await marketFixture.route.GET(marketFixture.request('market=MY&mode=standard&enableSocial=false'))).json();

const aapl = {
    ...createResearchRecord({ symbol: 'AAPL', market: 'US', companyName: 'Apple Inc.' }),
    factorAssumptions: {
        version: 1,
        migrationState: 'current',
        assumptions: [
            { factor: 'consumer-demand', direction: 'benefits-when-rises', materiality: 'high', evidenceNote: 'Hardware upgrade cycle.', evidenceDate: '2026-09-01', evidenceId: null },
        ],
    },
};
const msft = {
    ...createResearchRecord({ symbol: 'MSFT', market: 'US', companyName: 'Microsoft Corp.' }),
    factorAssumptions: {
        version: 1,
        migrationState: 'current',
        assumptions: [
            { factor: 'ai-data-center-capex', direction: 'benefits-when-rises', materiality: 'high', evidenceNote: 'Cloud AI demand.', evidenceDate: '2026-09-01', evidenceId: null },
        ],
    },
};
const maybank = createResearchRecord({ symbol: '1155', market: 'MY', companyName: 'Maybank' });
const missing = createResearchRecord({ symbol: 'ZZZZ', market: 'US', companyName: 'No Quote Corp' });
const watchlistRecords = [aapl, msft, maybank, missing];

const quoteItems = {
    'US:AAPL': { symbol: 'AAPL', market: 'US', providerSymbol: 'AAPL', fetchedAt: '2026-09-12T10:00:00.000Z', quote: { name: 'Apple Inc.', currency: 'USD', price: 228.5, dailyChangePercent: 1.42, fiftyTwoWeekHigh: 240, observedAt: '2026-09-12T09:55:00Z' } },
    'US:MSFT': { symbol: 'MSFT', market: 'US', providerSymbol: 'MSFT', fetchedAt: '2026-09-12T10:00:00.000Z', quote: { name: 'Microsoft Corp.', currency: 'USD', price: 430.0, dailyChangePercent: -3.85, fiftyTwoWeekHigh: 435, observedAt: '2026-09-12T09:55:00Z' } },
    'MY:1155': { symbol: '1155', market: 'MY', providerSymbol: '1155.KL', fetchedAt: '2026-09-12T10:00:00.000Z', quote: { name: 'Maybank', currency: 'MYR', price: 10.6, dailyChangePercent: 0.95, fiftyTwoWeekHigh: 10.8, observedAt: '2026-09-12T08:55:00Z' } },
};

const holdingsSnapshot = {
    version: 1,
    updatedAt: '2026-09-10T10:00:00.000Z',
    holdings: [
        { accountLabel: 'Core US', market: 'US', symbol: 'AAPL', quantity: 20, averageCost: 195, currency: 'USD', importedAt: '2026-09-10T10:00:00.000Z', provenanceLabel: 'Broker CSV' },
        { accountLabel: 'Core US', market: 'US', symbol: 'MSFT', quantity: 10, averageCost: 400, currency: 'USD', importedAt: '2026-09-10T10:00:00.000Z', provenanceLabel: 'Broker CSV' },
        { accountLabel: 'Core US', market: 'US', symbol: 'NVDA', quantity: 5, averageCost: 110, currency: 'USD', importedAt: '2026-09-10T10:00:00.000Z', provenanceLabel: 'Broker CSV' },
        { accountLabel: 'Bursa', market: 'MY', symbol: '1155', quantity: 1000, averageCost: 9.8, currency: 'MYR', importedAt: '2026-09-10T10:00:00.000Z', provenanceLabel: 'Broker CSV' },
    ],
    cashBalances: [
        { accountLabel: 'Core US', currency: 'USD', balance: 2500, importedAt: '2026-09-10T10:00:00.000Z', provenanceLabel: 'Broker CSV' },
        { accountLabel: 'Bursa', currency: 'MYR', balance: 5000, importedAt: '2026-09-10T10:00:00.000Z', provenanceLabel: 'Broker CSV' },
    ],
};

const report = { checks: [], failures: [], errors: [], quoteRequests: [] };
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

async function tableCell(table, rowName, columnName) {
    const headers = await table.getByRole('columnheader').allTextContents();
    const index = headers.findIndex(header => header.trim() === columnName);
    assert.notEqual(index, -1, `Missing column ${columnName}`);
    const row = table.getByRole('row', { name: rowName });
    assert.equal(await row.count(), 1, `Expected one ${rowName} row`);
    return (await row.locator('th, td').nth(index).innerText()).trim();
}

function assertQuotePrivacy(payloads) {
    assert.ok(payloads.length, 'A quote batch was sent');
    for (const payload of payloads) {
        assert.ok(Array.isArray(payload));
        assert.deepEqual(payload.map(x => `${x.market}:${x.symbol}`).sort(), ['MY:1155', 'US:AAPL', 'US:MSFT', 'US:ZZZZ']);
        for (const entry of payload) assert.deepEqual(Object.keys(entry).sort(), ['market', 'symbol'], 'Only saved security identity may leave the browser');
    }
}

async function setup(width, theme, { owner = true, quoteMode = 'ok' } = {}) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('console', m => {
        if (m.type() === 'error' && !(quoteMode === 'fail' && m.text().includes('502'))) {
            report.errors.push(m.text());
        }
    });

    await context.addInitScript(({ snapshot, guestList, isOwner }) => {
        localStorage.setItem('signal-portfolio-holdings-v1', JSON.stringify(snapshot));
        if (!isOwner) {
            localStorage.setItem('signal.guest-research.v1', JSON.stringify({
                version: 1,
                guestId: '11111111-1111-4111-8111-111111111111',
                records: guestList.map(r => ({ symbol: r.symbol, market: r.market, companyName: r.companyName, notes: r.notes })),
            }));
        }
    }, { snapshot: holdingsSnapshot, guestList: watchlistRecords, isOwner: owner });

    await context.route('**/*', async route => {
        const req = route.request();
        const url = new URL(req.url());
        if (url.origin !== new URL(base).origin) return route.abort();
        if (!url.pathname.startsWith('/api/')) return route.continue();
        if (url.pathname === '/api/owner/session') return route.fulfill({ json: { success: true, data: { configured: owner, unlocked: owner } } });
        if (url.pathname === '/api/research/watchlist') return route.fulfill({ json: { success: true, data: owner ? watchlistRecords : [], archivedSymbols: [] } });
        if (url.pathname === '/api/signals/v2') return route.fulfill({ json: url.searchParams.get('market') === 'MY' ? mySignal : usSignal });
        if (url.pathname === '/api/signals/internals') return route.fulfill({ json: { success: true, data: { market: url.searchParams.get('market') || 'US', available: false, updatedAt: null, items: [] } } });
        if (url.pathname === '/api/signals/fear-greed') return route.fulfill({ json: { success: true, data: { available: false, reason: 'Fixture' } } });
        if (url.pathname === '/api/research/quotes' && req.method() === 'POST') {
            const payload = req.postDataJSON();
            report.quoteRequests.push(payload);
            if (quoteMode === 'fail') return route.fulfill({ status: 502, json: { success: false, error: 'Live quotes are temporarily unavailable.' } });
            const items = payload.map(entry => {
                const key = `${entry.market}:${entry.symbol}`;
                const found = quoteItems[key];
                if (!found) return { success: false, symbol: entry.symbol, market: entry.market, error: 'Live quote unavailable.' };
                if (quoteMode === 'currency-mismatch' && key === 'MY:1155') {
                    return { success: true, data: { ...found, quote: { ...found.quote, currency: 'EUR' } } };
                }
                if (key === 'US:AAPL' && (quoteMode === 'missing-currency' || quoteMode === 'aapl-mismatch')) {
                    return { success: true, data: { ...found, quote: { ...found.quote, currency: quoteMode === 'missing-currency' ? null : 'EUR' } } };
                }
                return { success: true, data: found };
            });
            return route.fulfill({ json: { success: true, data: { fetchedAt: '2026-09-12T10:00:00.000Z', items } } });
        }
        return route.fulfill({ json: { success: true, data: {} } });
    });

    return { context, page };
}

try {
    for (const [width, theme] of [[1280, 'dark'], [1280, 'light'], [375, 'dark']]) {
        const { context, page } = await setup(width, theme, { owner: true, quoteMode: 'ok' });
        const beforeCount = report.quoteRequests.length;

        await runCheck(`portfolio holdings single summary, live prices, weights & privacy ${width} ${theme}`, async () => {
            await page.goto(`${base}/v9?view=portfolio`, { waitUntil: 'domcontentloaded' });
            const section = page.getByLabel('Totals by currency');
            await section.waitFor();
            await page.getByText('Known market value').first().waitFor();
            assert.equal(await page.getByLabel('Currency totals').count(), 0, 'Duplicate V9 currency-totals wrapper must be removed');
            assert.equal(report.quoteRequests.length - beforeCount, 1, 'Portfolio opens with exactly 1 batch quote request');
            const sentSymbols = report.quoteRequests.at(-1).map(x => `${x.market}:${x.symbol}`);
            assert.ok(!sentSymbols.includes('US:NVDA'), 'Unmatched local holding NVDA must never be sent to /api/research/quotes');
            const text = await section.innerText();
            assert.match(text, /MYR totals/);
            assert.match(text, /USD totals/);
            assert.match(text, /Unrealized P\/L/);
            const tableText = await page.getByRole('region', { name: 'Imported holdings table' }).innerText();
            assert.match(tableText, /Weight/);
            assert.match(tableText, /Market value/);
            assert.match(tableText, /68\.0%|67\.95%/); // 10600 / (10600 + 5000) = 67.95% -> 68.0%
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'no horizontal overflow');
            await page.screenshot({ path: `${output}/portfolio-holdings-${width}-${theme}.png` });
        });

        await runCheck(`portfolio factor exposure value-weighted ${width} ${theme}`, async () => {
            await page.getByRole('link', { name: 'Factor exposure', exact: true }).click();
            const matrix = page.getByTestId('v9-factor-exposure');
            await matrix.waitFor();
            await matrix.getByText(/Value-weighted/).first().waitFor();
            await matrix.getByText(/% of priced value/).first().waitFor();
            await matrix.getByRole('button', { name: /Benefits\s*High/ }).first().click();
            const detail = matrix.getByTestId('v9-factor-detail');
            await detail.waitFor();
            assert.match(await detail.innerText(), /Market value/);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'no horizontal overflow');
            await page.screenshot({ path: `${output}/portfolio-factors-${width}-${theme}.png` });
        });

        await runCheck(`watchlist live prices and sorting ${width} ${theme}`, async () => {
            await page.goto(`${base}/v9?view=research&tab=watchlist`, { waitUntil: 'domcontentloaded' });
            const title = page.getByRole('heading', { name: 'Watchlist' });
            await title.waitFor();
            await page.getByTestId('watchlist-row-quote').first().waitFor();
            const select = page.getByLabel('Sort watchlist');
            await select.selectOption('move');
            const moveOrder = await page.getByTestId('watchlist-row').evaluateAll(els => els.map(el => `${el.getAttribute('data-market')}:${el.getAttribute('data-symbol')}`));
            assert.deepEqual(moveOrder, ['US:MSFT', 'US:AAPL', 'MY:1155', 'US:ZZZZ'], 'Biggest daily % move sorts largest absolute move first, missing last');
            await select.selectOption('high');
            const highOrder = await page.getByTestId('watchlist-row').evaluateAll(els => els.map(el => `${el.getAttribute('data-market')}:${el.getAttribute('data-symbol')}`));
            assert.deepEqual(highOrder, ['US:MSFT', 'MY:1155', 'US:AAPL', 'US:ZZZZ'], 'Closest to 52-week high sorts highest proximity first, missing last');
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'no horizontal overflow');
            await page.screenshot({ path: `${output}/watchlist-quotes-${width}-${theme}.png` });
        });

        await context.close();
    }

    // Exercise each portfolio consumer with the same priced quote under each currency condition.
    for (const owner of [true, false]) {
        for (const quoteMode of ['ok', 'missing-currency', 'aapl-mismatch']) {
            const { context, page } = await setup(1280, 'light', { owner, quoteMode });
            const requestStart = report.quoteRequests.length;
            const priced = quoteMode === 'ok';
            const label = `${owner ? 'owner' : 'guest'} ${quoteMode}`;

            await runCheck(`${label}: Holdings valuation, coverage and quote privacy`, async () => {
                await page.goto(`${base}/v9?view=portfolio`, { waitUntil: 'domcontentloaded' });
                const totals = page.getByLabel('Totals by currency');
                const usd = totals.locator('section', { hasText: 'USD totals' });
                await usd.getByText('Known market value').waitFor();
                const text = await usd.innerText();
                assert.match(text, priced ? /8,870\.00/ : /4,300\.00/);
                assert.match(text, priced ? /\+\$970\.00/ : /\+\$300\.00/, 'Unrealized P/L uses only priced holdings and their cost basis');
                assert.match(text, priced ? /Holdings without current price\s*1/ : /Holdings without current price\s*2/);
                const table = page.getByRole('region', { name: 'Imported holdings table' }).getByRole('table');
                assert.match(await tableCell(table, /AAPL/, 'Price'), priced ? /228\.50/ : /^—$/);
                assert.match(await tableCell(table, /AAPL/, 'Market value'), priced ? /4,570\.00/ : /^—$/);
                assert.equal(await tableCell(table, /AAPL/, 'Weight'), '—', 'Partial USD coverage suppresses weights');
                assertQuotePrivacy(report.quoteRequests.slice(requestStart));
            });

            await runCheck(`${label}: Factor exposure valuation and coverage`, async () => {
                await page.getByRole('link', { name: 'Factor exposure', exact: true }).click();
                const matrix = page.getByTestId('v9-factor-exposure');
                if (owner) {
                    const group = matrix.locator('article', { hasText: 'Core US · USD' });
                    await group.getByText(priced ? /8,870\.00 priced/ : /4,300\.00 priced/).waitFor();
                    const text = await group.innerText();
                    assert.match(text, priced ? /8,870\.00 priced/ : /4,300\.00 priced/);
                    assert.match(text, priced ? /1 without live price/ : /2 without live price/);
                    const consumer = group.getByLabel('Core US factor concentration').locator(':scope > div', { has: page.getByText('Consumer demand', { exact: true }) });
                    assert.match(await consumer.innerText(), priced ? /52% of priced value · 1\/3 holdings/ : /0% of priced value · 1\/3 holdings/);
                } else {
                    // Guest records contain identities and notes, not authored factor assumptions.
                    await matrix.getByText(/none of their matched saved research records have declared factor assumptions/).waitFor();
                }
            });

            await runCheck(`${label}: Manage portfolio valuation and coverage`, async () => {
                await page.getByRole('link', { name: 'Manage portfolio', exact: true }).click();
                const summary = page.getByTestId('portfolio-actual-summary');
                await summary.getByText(priced ? /11,370\.00/ : /6,800\.00/).waitFor();
                const card = summary.locator('div', { has: page.getByText('Known value + cash · USD', { exact: true }) }).first();
                const text = await card.innerText();
                assert.match(text, priced ? /11,370\.00/ : /6,800\.00/);
                assert.match(text, priced ? /1 holding value unavailable/ : /2 holding value unavailable/);
                const table = page.getByRole('table', { name: /Imported holdings — actual values/ });
                assert.match(await tableCell(table, /AAPL/, 'Current value'), priced ? /4,570\.00/ : /^Unavailable$/);
                assert.equal(await tableCell(table, /AAPL/, 'Actual weight'), 'Unavailable', 'Partial USD coverage suppresses weights');
                assertQuotePrivacy(report.quoteRequests.slice(requestStart));
            });
            await context.close();
        }
    }

    // Guest mode + currency mismatch + quote error checks
    {
        const { context, page } = await setup(1280, 'light', { owner: false, quoteMode: 'currency-mismatch' });
        await runCheck('guest portfolio currency-mismatch protection & guest watchlist quote sort', async () => {
            await page.goto(`${base}/v9?view=portfolio`, { waitUntil: 'domcontentloaded' });
            await page.getByLabel('Totals by currency').waitFor();
            await page.getByText('Known market value').first().waitFor();
            const myrSection = page.getByLabel('Totals by currency').locator('section', { hasText: 'MYR totals' });
            assert.doesNotMatch(await myrSection.innerText(), /Known market value/, 'Mismatched EUR quote must not price MYR holding');
            await page.goto(`${base}/v9?view=research&tab=watchlist`, { waitUntil: 'domcontentloaded' });
            await page.getByTestId('watchlist-row-quote').first().waitFor();
            await page.getByLabel('Sort watchlist').selectOption('move');
            const guestOrder = await page.getByTestId('watchlist-row').evaluateAll(els => els.map(el => `${el.getAttribute('data-market')}:${el.getAttribute('data-symbol')}`));
            assert.deepEqual(guestOrder, ['US:MSFT', 'US:AAPL', 'MY:1155', 'US:ZZZZ']);
        });
        await context.close();
    }

    {
        const { context, page } = await setup(1280, 'dark', { owner: true, quoteMode: 'fail' });
        await runCheck('quote API failure degrades gracefully to cost basis', async () => {
            await page.goto(`${base}/v9?view=portfolio`, { waitUntil: 'domcontentloaded' });
            await page.getByText(/Live prices unavailable · showing cost basis/).waitFor();
            await page.getByLabel('Totals by currency').waitFor();
        });
        await context.close();
    }
} finally {
    await browser.close();
    await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
}

if (report.failures.length || report.errors.length) {
    console.error('PR-1 QA failures/errors:', JSON.stringify({ failures: report.failures, errors: report.errors }, null, 2));
    process.exitCode = 1;
}
