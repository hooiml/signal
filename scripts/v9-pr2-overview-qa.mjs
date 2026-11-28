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
const output = '.tmp/v9-pr2-overview';
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

function buildSnapshot({ symbol, market, name, price, currency, low52, high52, emptyHistory = false }) {
    const snap = structuredClone(researchSnapshotFixture.data);
    snap.symbol = symbol;
    snap.market = market;
    snap.quote.name = name;
    snap.quote.price = price;
    snap.quote.currency = currency;
    snap.quote.dailyChangePercent = 1.15;
    snap.quote.observedAt = '2026-09-11T20:00:00Z';
    snap.technicals.low52Week = low52;
    snap.technicals.high52Week = high52;
    snap.valuation.priceEarnings = 27.4;
    snap.valuation.freeCashFlowYieldPercent = 3.85;
    snap.fundamentals.operatingMarginPercent = 31.2;
    snap.fundamentals.grossMarginPercent = 46.5;
    snap.fundamentals.revenueGrowthPercent = 7.4;
    snap.fundamentals.reportingPeriod = '2025-09-30';
    snap.fundamentals.source = 'Yahoo Finance';
    snap.fundamentals.cash = emptyHistory ? null : 65_000_000_000;
    snap.fundamentals.debt = emptyHistory ? null : 42_000_000_000;
    snap.fundamentals.history = emptyHistory
        ? []
        : [
            {
                reportingPeriod: '2022-09-30',
                currency,
                source: 'Yahoo Finance',
                comparableAnnual: true,
                annualRevenue: 394_328_000_000,
                revenueGrowthPercent: null,
                annualNetIncome: 99_803_000_000,
                freeCashFlow: 111_443_000_000,
                grossMarginPercent: 43.3,
                operatingMarginPercent: 30.3,
                debt: null,
                cash: null,
                shares: 16_325_819_000,
                shareChangePercent: -2.1,
            },
            {
                reportingPeriod: '2023-09-30',
                currency,
                source: 'Yahoo Finance',
                comparableAnnual: true,
                annualRevenue: 383_285_000_000,
                revenueGrowthPercent: -2.8,
                annualNetIncome: 96_995_000_000,
                freeCashFlow: 99_584_000_000,
                grossMarginPercent: 44.1,
                operatingMarginPercent: 29.8,
                debt: null,
                cash: null,
                shares: 15_812_547_000,
                shareChangePercent: -3.14,
            },
            {
                reportingPeriod: '2024-09-30',
                currency,
                source: 'Yahoo Finance',
                comparableAnnual: true,
                annualRevenue: 391_035_000_000,
                revenueGrowthPercent: 2.0,
                annualNetIncome: 93_736_000_000,
                freeCashFlow: 108_807_000_000,
                grossMarginPercent: 45.6,
                operatingMarginPercent: 30.7,
                debt: null,
                cash: null,
                shares: 15_408_095_000,
                shareChangePercent: -2.56,
            },
            {
                reportingPeriod: '2025-09-30',
                currency,
                source: 'Yahoo Finance',
                comparableAnnual: true,
                annualRevenue: 416_200_000_000,
                revenueGrowthPercent: 6.4,
                annualNetIncome: 104_500_000_000,
                freeCashFlow: 118_100_000_000,
                grossMarginPercent: 46.5,
                operatingMarginPercent: 31.2,
                debt: null,
                cash: null,
                shares: 15_040_000_000,
                shareChangePercent: -2.39,
            },
        ];
    snap.chart.points = Array.from({ length: 45 }, (_, i) => {
        const dt = new Date(Date.UTC(2026, 7, 1 + i));
        const close = Number((price * 0.92 + i * (price * 0.002)).toFixed(2));
        return {
            time: dt.toISOString().slice(0, 10),
            open: close - 1,
            high: close + 2,
            low: close - 2,
            close,
            volume: 20_000_000,
            ma50: close - 2,
            ma200: close - 10,
            ema20: close - 1,
            ema50: close - 2,
            sma200: close - 10,
            averageVolume20: 19_000_000,
            rsi14: 54,
            macd: 1.0,
            macdSignal: 0.8,
            macdHistogram: 0.2,
            atr14: 2.5,
            atrPercent14: 1.2,
            anchoredVwap: close - 1,
            adx14: 22,
            plusDi14: 25,
            minusDi14: 17,
            supertrend: close - 3,
            supertrendDirection: 1,
        };
    });
    return snap;
}

const aaplSnapshot = buildSnapshot({ symbol: 'AAPL', market: 'US', name: 'Apple Inc.', price: 228.5, currency: 'USD', low52: 175, high52: 242 });
const msftSnapshot = buildSnapshot({ symbol: 'MSFT', market: 'US', name: 'Microsoft Corp.', price: 425, currency: 'USD', low52: 360, high52: 468 });
const nvdaSnapshot = buildSnapshot({ symbol: 'NVDA', market: 'US', name: 'NVIDIA Corp.', price: 132, currency: 'USD', low52: 90, high52: 148, emptyHistory: true });
const mySnapshot = buildSnapshot({ symbol: '5347', market: 'MY', name: 'Tenaga Nasional Bhd', price: 14.2, currency: 'MYR', low52: 11.4, high52: 15.1 });

const baseAapl = createResearchRecord({ symbol: 'AAPL', market: 'US', companyName: 'Apple Inc.' });
const ownerAapl = {
    ...baseAapl,
    targetBuyZone: '210-215',
    positionPlan: {
        plannedAllocationPercent: 8,
        averageCost: 205,
        plannedEntryPrice: 215,
        invalidationPrice: 185,
        currency: 'USD',
    },
};

const baseNvda = createResearchRecord({ symbol: 'NVDA', market: 'US', companyName: 'NVIDIA Corp.' });
const ownerNvdaMismatch = {
    ...baseNvda,
    positionPlan: {
        plannedAllocationPercent: 5,
        averageCost: null,
        plannedEntryPrice: 120,
        invalidationPrice: 95,
        currency: 'MYR',
    },
};

const internalsFixture = {
    market: 'US',
    available: true,
    updatedAt: '2026-09-12T00:00:00.000Z',
    items: [
        {
            id: 'credit',
            name: 'Credit Stress',
            subtitle: 'HYG / LQD ratio vs 50-day MA',
            latestLabel: '0.731',
            baselineLabel: '50D MA: 0.728',
            tone: 'up',
            description: 'High-yield vs investment-grade spreads remain stable.',
            points: Array.from({ length: 12 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, value: Number((0.72 + i * 0.001).toFixed(3)), baseline: 0.728 })),
        },
        {
            id: 'breadth',
            name: 'Equal-Weight Breadth',
            subtitle: 'RSP / SPY ratio vs 50-day MA',
            latestLabel: '0.305',
            baselineLabel: '50D MA: 0.308',
            tone: 'neutral',
            description: 'Equal-weight participation slightly trails mega-caps.',
            points: Array.from({ length: 12 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, value: Number((0.309 - i * 0.0003).toFixed(3)), baseline: 0.308 })),
        },
        {
            id: 'safe_haven',
            name: 'Safe-Haven Demand',
            subtitle: 'SPY vs TLT 20D relative return',
            latestLabel: '+1.8%',
            baselineLabel: '0% parity',
            tone: 'up',
            description: 'Equities lead long-duration Treasuries over 20 sessions.',
            points: Array.from({ length: 12 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, value: Number((0.4 + i * 0.12).toFixed(2)), baseline: 0 })),
        },
    ],
};

const todayPlus14 = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);
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

async function createPage(width, theme, owner = true) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    let allowExpected503 = false;
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('console', m => {
        if (m.type() === 'error') {
            if (allowExpected503 && /503/.test(m.text())) return;
            report.errors.push(m.text());
        }
    });

    const stats = { calendarPosts: [], mutations: [], msftCalendarAttempts: 0 };
    await context.route('**/*', async route => {
        const req = route.request();
        const url = new URL(req.url());
        if (url.origin !== new URL(base).origin) return route.abort();
        if (!url.pathname.startsWith('/api/')) return route.continue();
        if (['PATCH', 'PUT', 'DELETE'].includes(req.method())) {
            stats.mutations.push(`${req.method()} ${url.pathname}`);
            return route.fulfill({ status: 405, json: { error: 'Mutation blocked in read-only QA' } });
        }
        if (url.pathname === '/api/owner/session') return route.fulfill({ json: { success: true, data: { configured: owner, unlocked: owner } } });
        if (url.pathname === '/api/research/watchlist') return route.fulfill({ json: { success: true, data: owner ? [ownerAapl, ownerNvdaMismatch] : [], archivedSymbols: [] } });
        if (url.pathname === '/api/signals/v2') {
            const mkt = url.searchParams.get('market');
            return route.fulfill({ json: mkt === 'MY' ? mySignal : usSignal });
        }
        if (url.pathname === '/api/signals/intraday') return route.fulfill({ json: { success: true, data: { market: 'US', mode: 'standard', enableSocial: false, day: '2026-09-12', entries: [], hasEarlierCaptures: false } } });
        if (url.pathname === '/api/signals/replay') return route.fulfill({ json: { success: true, data: { market: 'US', mode: 'standard', enableSocial: false, summaries: [] } } });
        if (url.pathname === '/api/signals/internals') return route.fulfill({ json: { success: true, data: internalsFixture } });
        if (url.pathname === '/api/signals/fear-greed') return route.fulfill({ json: { success: true, data: { available: false, score: null, rating: null, previousClose: null, oneWeekAgo: null, oneMonthAgo: null, updatedAt: null, history: [] } } });
        if (url.pathname === '/api/research/calendar') {
            const ticker = (url.searchParams.get('ticker') || '').toUpperCase();
            stats.calendarPosts.push({ ticker, market: url.searchParams.get('market') });
            if (ticker === 'MSFT') {
                stats.msftCalendarAttempts += 1;
                if (stats.msftCalendarAttempts === 1) {
                    return route.fulfill({ status: 503, json: { error: 'Temporary calendar error' } });
                }
            }
            return route.fulfill({
                json: {
                    success: true,
                    data: {
                        generatedAt: new Date().toISOString(),
                        rangeDays: 30,
                        timezone: 'UTC',
                        events: [
                            {
                                id: `earn-${ticker}`,
                                type: 'earnings',
                                market: 'US',
                                symbol: ticker,
                                title: `${ticker} earnings`,
                                detail: 'Fixture',
                                source: 'Nasdaq earnings calendar',
                                sourceDate: todayPlus14,
                                displayDate: todayPlus14,
                                timezone: 'UTC',
                                freshness: 'scheduled',
                                urgency: 'upcoming',
                                targetHref: `/research?ticker=${ticker}&tab=events`,
                                earningsTiming: 'after-hours',
                            },
                        ],
                        macroEvents: [],
                        warnings: [],
                    },
                },
            });
        }
        if (url.pathname.startsWith('/api/research/symbol/')) {
            const sym = decodeURIComponent(url.pathname.split('/').at(-1) || 'AAPL').toUpperCase();
            const data = sym === 'MSFT' ? msftSnapshot : sym === 'NVDA' ? nvdaSnapshot : sym === '5347' ? mySnapshot : aaplSnapshot;
            return route.fulfill({ json: { success: true, data } });
        }
        if (url.pathname.startsWith('/api/research/valuation-history/')) {
            return route.fulfill({ json: { success: true, data: { symbol: 'AAPL', market: 'US', observations: [], capabilities: {}, warnings: [] } } });
        }
        return route.fulfill({ json: { success: true, data: {} } });
    });
    return { context, page, stats, setAllow503: value => { allowExpected503 = value; } };
}

try {
    for (const [width, theme] of [[1280, 'light'], [768, 'dark'], [375, 'dark']]) {
        const { context, page, stats } = await createPage(width, theme, true);

        await runCheck(`PR-2 Research Overview E2/E3/E4/E20 (${width} ${theme})`, async () => {
            await page.goto(`${base}/v9?view=research&ticker=AAPL&market=US`, { waitUntil: 'domcontentloaded' });
            await page.getByTestId('v9-workspace').filter({ visible: true }).waitFor();

            // V9-E2: Earnings Ticket in quote header linking to V9 Discover Calendar
            const ticket = page.getByTestId('earnings-ticket');
            await ticket.getByText(/after close/i).waitFor();
            const ticketText = await ticket.innerText();
            assert.match(ticketText, /Earnings/);
            assert.match(ticketText, /after close/i);
            assert.match(ticketText, /Date unconfirmed/);
            const href = await ticket.getAttribute('href');
            assert.ok(href && href.includes('/v9?') && href.includes('view=discover') && href.includes('discover=calendar') && href.includes('ticker=AAPL') && href.includes(`calendarDate=${todayPlus14}`), `unexpected ticket href: ${href}`);
            assert.equal(await ticket.getAttribute('target'), '_blank');

            // V9-E3: Guardrail initialized to owner plannedEntryPrice (215), pins & distances visible, drag -> Reset
            const guardrail = page.getByTestId('v9-entry-guardrail');
            await guardrail.waitFor();
            const slider = guardrail.getByRole('slider', { name: 'Target entry price' });
            assert.equal(await slider.inputValue(), '215');
            await guardrail.getByTestId('v9-guardrail-pins').waitFor();
            assert.ok(await guardrail.locator('[data-pin="invalidation"]').count() === 1);
            assert.ok(await guardrail.locator('[data-pin="entry"]').count() === 1);
            assert.ok(await guardrail.locator('[data-pin="cost"]').count() === 1);
            const distancesText = await guardrail.getByTestId('v9-guardrail-distances').innerText();
            assert.match(distancesText, /vs\. Saved entry/);
            assert.match(distancesText, /Stop buffer/);
            assert.match(distancesText, /vs\. Avg cost/);
            assert.match(await guardrail.innerText(), /Saved target zone: 210-215/);

            await slider.fill('200');
            await guardrail.getByText('Exploring · not saved').waitFor();
            const resetBtn = guardrail.getByRole('button', { name: 'Reset to saved plan' });
            await resetBtn.waitFor();
            await resetBtn.click();
            assert.equal(await slider.inputValue(), '215');
            assert.equal(await resetBtn.count(), 0);

            // V9-E4: Annual Financials 3-mode toggle
            const finCard = page.getByTestId('v9-annual-financials');
            await finCard.waitFor();
            await finCard.getByText('Free Cash Flow', { exact: true }).waitFor();
            await finCard.getByRole('button', { name: 'Margins %' }).click();
            await finCard.getByText('Gross Margin %').waitFor();
            await finCard.getByText(/pp YoY/).first().waitFor();
            await finCard.getByRole('button', { name: 'Cushion & Shares' }).click();
            await finCard.getByText('Balance-sheet cushion').waitFor();
            await finCard.getByText(/Net cash:/).waitFor();
            await finCard.getByText(/Annual diluted average shares/).waitFor();
            await finCard.getByRole('button', { name: 'Revenue & FCF' }).click();

            // V9-E20: MetricGlossary popovers on all 4 Overview metric tiles
            for (const metricId of ['pe', 'fcf-yield', 'operating-margin', 'revenue-growth']) {
                const trigger = page.locator(`button[data-glossary="${metricId}"]:visible`).first();
                await trigger.click();
                const panel = page.locator(`[data-glossary-panel="${metricId}"]:popover-open`);
                await panel.waitFor();
                const box = await panel.evaluate(el => {
                    const r = el.getBoundingClientRect();
                    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, vw: window.innerWidth, vh: window.innerHeight };
                });
                assert.ok(box.left >= 6 && box.right <= box.vw - 6 && box.top >= 6 && box.bottom <= box.vh - 6, `popover out of viewport: ${JSON.stringify(box)}`);
                const learnLink = panel.getByRole('link');
                assert.equal(await learnLink.getAttribute('target'), '_blank');
                await panel.getByRole('button', { name: /^Close/ }).click();
                await panel.waitFor({ state: 'hidden' });
                assert.equal(await page.locator('[data-glossary-panel]:visible').count(), 0, 'closed glossary popover must remain hidden');
            }

            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'no horizontal overflow');
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({ path: `${output}/research-overview-${width}-${theme}.png`, fullPage: true });
            await finCard.getByRole('button', { name: 'Cushion & Shares' }).click();
            await finCard.scrollIntoViewIfNeeded();
            await page.screenshot({ path: `${output}/research-cushion-${width}-${theme}.png` });
            assert.equal(stats.mutations.length, 0, 'zero mutations allowed');
        });

        await context.close();
    }

    // Boundary checks at 1280px light: MSFT retry, MY coverage note (zero calendar calls), NVDA currency mismatch & empty financials, V9MarketInternals glossary
    const { context, page, stats, setAllow503 } = await createPage(1280, 'light', true);

    await runCheck('PR-2 boundary: MSFT retry, MY no-call coverage, NVDA currency mismatch & empty financials', async () => {
        setAllow503(true);
        await page.goto(`${base}/v9?view=research&ticker=MSFT&market=US`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'Retry earnings' }).waitFor();
        setAllow503(false);
        await page.getByRole('button', { name: 'Retry earnings' }).click();
        await page.getByTestId('earnings-ticket').getByText(/after close/i).waitFor();

        const postsBeforeMy = stats.calendarPosts.length;
        await page.goto(`${base}/v9?view=research&ticker=5347&market=MY`, { waitUntil: 'domcontentloaded' });
        await page.getByTestId('v9-earnings-coverage-note').waitFor();
        assert.equal(stats.calendarPosts.length, postsBeforeMy, 'MY listing must not POST /api/research/calendar');

        await page.goto(`${base}/v9?view=research&ticker=NVDA&market=US`, { waitUntil: 'domcontentloaded' });
        await page.getByTestId('v9-guardrail-currency-mismatch').waitFor();
        assert.equal(await page.getByTestId('v9-guardrail-pins').count(), 0, 'mismatched currency must hide position plan pins');
        const finCard = page.getByTestId('v9-annual-financials');
        await finCard.getByRole('button', { name: 'Margins %' }).click();
        await finCard.getByText('Latest Gross Margin').waitFor();
        await finCard.getByRole('button', { name: 'Cushion & Shares' }).click();
        await finCard.getByText(/Cash and debt figures in a single confirmed currency were not supplied/).waitFor();
        await finCard.getByText(/Comparable multi-year share counts were not supplied/).waitFor();
    });

    await runCheck('PR-2 V9MarketInternals MetricGlossary popovers', async () => {
        await page.goto(`${base}/v9?market=US&mode=standard&enableSocial=false`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: /Inspect 3 baseline charts/ }).click();
        await page.getByLabel('Cross-Market Internals').waitFor();
        for (const id of ['internal-credit', 'internal-breadth', 'internal-safe-haven']) {
            const trigger = page.locator(`button[data-glossary="${id}"]:visible`).first();
            await trigger.click();
            const panel = page.locator(`[data-glossary-panel="${id}"]:popover-open`);
            await panel.waitFor();
            assert.match(await panel.innerText(), /Context only/);
            await page.keyboard.press('Escape');
            await panel.waitFor({ state: 'hidden' });
        }
        await page.screenshot({ path: `${output}/market-internals-1280-light.png` });
    });

    await context.close();
} finally {
    await browser.close();
    await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
}

if (report.failures.length || report.errors.length) {
    console.error('QA failures/errors:', JSON.stringify({ failures: report.failures, errors: report.errors }, null, 2));
    process.exitCode = 1;
}
