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
const output = '.tmp/v9-pr4';
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
        fetchVIX: () => ({ price: 22.1, change: 0, observedAt: new Date('2026-11-26T20:00:00Z') }),
        fetchMarketNews: () => [
            { title: 'Fixture market pulse headline', source: 'Reuters', link: 'https://example.test/news', pubDate: '2026-11-26T20:00:00Z' },
        ],
    },
});
const usSignal = await (await marketFixture.route.GET(marketFixture.request('market=US&mode=standard&enableSocial=false'))).json();
const mySignal = await (await marketFixture.route.GET(marketFixture.request('market=MY&mode=standard&enableSocial=false'))).json();

const fixtureTime = new Date('2026-11-26T02:00:00.000Z'); // Thu 10:00 MYT (Bursa session · MYT)
const dayOffset = days => new Date(fixtureTime.getTime() + days * 86400000).toISOString().slice(0, 10);

const makeDiscoveryRow = (overrides) => ({
    symbol: 'MSFT',
    name: 'Microsoft Corp.',
    price: 425.5,
    momentum3MonthPercent: 18.4,
    momentum6MonthPercent: 28.2,
    distanceFromMa50Percent: 5.5,
    averageDollarVolume: 1_200_000_000,
    volumeSpikeRatio: 1.25,
    maxDailyMovePercent: 3.1,
    annualizedVolatilityPercent: 21.4,
    aboveMa50: true,
    aboveMa200: true,
    trendScore: 86,
    riskScore: 11,
    risk: 'low',
    reasons: ['Sustained 3M/6M trend', 'Above 50D and 200D moving averages'],
    flags: [],
    qualityScore: 89,
    discoveryScore: 88,
    category: 'quality compounder',
    qualityReasons: ['Positive free cash flow', 'High operating margin stability'],
    sector: 'Technology',
    sectorRelativeStrengthPercent: 5.2,
    scoreChange1Day: 2,
    scoreChange1Week: 4,
    scoreChange1Month: null,
    rankChange1Week: 4,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    earlyTrendStage: 'confirmed',
    valuation: {
        guardrail: 'fair',
        priceEarnings: 31.2,
        priceSales: 10.4,
        freeCashFlowYieldPercent: 2.8,
    },
    catalyst: {
        date: dayOffset(4),
        type: 'earnings',
        timing: 'after-hours',
        fiscalQuarterEnding: '2026-09-30',
        epsForecast: '3.12',
        source: 'Nasdaq earnings calendar',
    },
    ownership: {
        activity: 'increases-led',
        institutionalOwnershipPercent: 72,
        increasedShares: 120000,
        decreasedShares: 40000,
        reportPeriod: '2026-09-30',
        buyers: [],
        source: 'Nasdaq institutional holdings',
        sourceUrl: 'https://www.nasdaq.com/market-activity/stocks/msft/institutional-holdings',
    },
    ...overrides,
});

const discoveryFixture = {
    success: true,
    data: {
        generatedAt: fixtureTime.toISOString(),
        universeSize: 50,
        scannedCount: 50,
        candidates: [
            makeDiscoveryRow({
                symbol: 'AAPL',
                name: 'Apple Inc.',
                price: 229.4,
                sector: 'Technology',
                risk: 'low',
                discoveryScore: 90,
                rankChange1Week: 4,
            }),
            makeDiscoveryRow({
                symbol: 'LLY',
                name: 'Eli Lilly & Co.',
                price: 812.0,
                sector: 'Healthcare',
                risk: 'low',
                discoveryScore: 87,
                rankChange1Week: null,
                scoreChange1Day: null,
                scoreChange1Week: null,
                catalyst: {
                    date: dayOffset(6),
                    type: 'earnings',
                    timing: 'pre-market',
                    fiscalQuarterEnding: null,
                    epsForecast: null,
                    source: 'Nasdaq earnings calendar',
                },
            }),
            makeDiscoveryRow({
                symbol: 'NVDA',
                name: 'NVIDIA Corp.',
                price: 138.2,
                sector: 'Technology',
                risk: 'moderate',
                riskScore: 22,
                discoveryScore: 84,
                rankChange1Week: -2,
                catalyst: null,
            }),
            makeDiscoveryRow({
                symbol: 'CAT',
                name: 'Caterpillar Inc.',
                price: 368.1,
                sector: 'Industrials',
                risk: 'moderate',
                riskScore: 21,
                discoveryScore: 76,
                rankChange1Week: 0,
                scoreChange1Day: 3,
                scoreChange1Week: 3,
                catalyst: null,
            }),
        ],
        contenders: [
            makeDiscoveryRow({
                symbol: 'COST',
                name: 'Costco Wholesale',
                price: 912.3,
                sector: 'Consumer Defensive',
                risk: 'low',
                discoveryScore: 73,
                rankChange1Week: 1,
                contenderReason: 'Steady quality compounder outside top 10',
            }),
        ],
        emergingCandidates: [
            makeDiscoveryRow({
                symbol: 'LLY',
                name: 'Eli Lilly & Co.',
                price: 812.0,
                sector: 'Healthcare',
                risk: 'low',
                discoveryScore: 87,
                earlyTrendStage: 'emerging',
                distanceFromMa50Percent: 2.9,
                rankChange1Week: null,
                scoreChange1Day: null,
                scoreChange1Week: null,
            }),
            makeDiscoveryRow({
                symbol: 'NVDA',
                name: 'NVIDIA Corp.',
                price: 138.2,
                sector: 'Technology',
                risk: 'moderate',
                riskScore: 22,
                discoveryScore: 84,
                earlyTrendStage: 'confirmed',
                distanceFromMa50Percent: 8.1,
                rankChange1Week: -2,
            }),
        ],
        performance: [
            { period: '1D', averageReturnPercent: 0.9, trackedCount: 5, winnerCount: 4 },
            { period: '1W', averageReturnPercent: 2.1, trackedCount: 5, winnerCount: 4 },
            { period: '1M', averageReturnPercent: 4.6, trackedCount: 5, winnerCount: 4 },
        ],
        historySnapshotCount: 12,
        warnings: [],
    },
};

const baseAapl = createResearchRecord({ symbol: 'AAPL', market: 'US', companyName: 'Apple Inc.' });
const baseMaybank = createResearchRecord({ symbol: '1155', market: 'MY', companyName: 'Malayan Banking Berhad' });

const aaplRecord = {
    ...baseAapl,
    monitoringRules: {
        ...baseAapl.monitoringRules,
        structuredTriggers: {
            version: 1,
            migrationState: 'current',
            rules: [
                { id: 'aapl-pe', enabled: true, purpose: 'opportunity-review', metric: 'price-earnings', operator: 'below', threshold: 25 },
            ],
        },
    },
};

const maybankRecord = {
    ...baseMaybank,
    monitoringRules: {
        ...baseMaybank.monitoringRules,
        structuredTriggers: {
            version: 1,
            migrationState: 'current',
            rules: [
                { id: '1155-rsi', enabled: true, purpose: 'opportunity-review', metric: 'rsi14', operator: 'below', threshold: 35 },
            ],
        },
    },
};

const calendarFixture = {
    success: true,
    data: {
        generatedAt: fixtureTime.toISOString(),
        rangeDays: 30,
        timezone: 'UTC',
        warnings: [],
        events: [
            {
                id: 'aapl-earn-1',
                symbol: 'AAPL',
                market: 'US',
                type: 'earnings',
                title: 'Apple Inc. earnings',
                detail: 'After market close',
                source: 'Nasdaq earnings calendar',
                sourceDate: dayOffset(2),
                displayDate: dayOffset(2),
                timezone: 'UTC',
                freshness: 'scheduled',
                urgency: 'upcoming',
                targetHref: '/research?ticker=AAPL&tab=events',
            },
            {
                id: '1155-rev-1',
                symbol: '1155',
                market: 'MY',
                type: 'review',
                title: '1155 scheduled review',
                detail: 'Quarterly thesis check-in',
                source: 'Research journal',
                sourceDate: dayOffset(3),
                displayDate: dayOffset(3),
                timezone: 'UTC',
                freshness: 'scheduled',
                urgency: 'upcoming',
                targetHref: '/research?ticker=1155&tab=overview&review=edit',
            },
        ],
        macroEvents: [
            {
                id: 'macro-fomc-1',
                market: 'US',
                category: 'monetary-policy',
                title: 'FOMC Rate Decision',
                date: dayOffset(5),
                timeLabel: '19:00 UTC',
                source: 'Federal Reserve',
                sourceUrl: 'https://www.federalreserve.gov/',
                detail: 'Scheduled Federal Reserve rate decision.',
                trackedSymbols: ['AAPL'],
            },
        ],
    },
};

const alertsFixture = {
    success: true,
    data: {
        generatedAt: fixtureTime.toISOString(),
        monitoredCount: 2,
        alerts: [
            {
                id: 'alert-aapl-1',
                symbol: 'AAPL', market: 'US',
                kind: 'structured-trigger',
                severity: 'opportunity',
                title: 'Price / earnings below 25',
                detail: 'Observed P/E 23.8 is below 25.',
                structuredTrigger: null,
            },
            {
                id: 'alert-1155-1',
                symbol: '1155', market: 'MY',
                kind: 'market-condition',
                severity: 'watch',
                title: 'RSI (14) below 35',
                detail: 'Observed RSI 33.4.',
                structuredTrigger: null,
            },
        ],
        triggerCoverage: [
            {
                symbol: 'AAPL', market: 'US',
                rule: aaplRecord.monitoringRules.structuredTriggers.rules[0],
                status: 'matched',
                severity: 'opportunity',
                title: 'Price / earnings below 25',
                detail: 'Observed P/E 23.8.',
                observed: null,
            },
            {
                symbol: '1155', market: 'MY',
                rule: maybankRecord.monitoringRules.structuredTriggers.rules[0],
                status: 'not-matched',
                severity: 'opportunity',
                title: 'RSI (14) below 35',
                detail: 'Observed RSI 48.0.',
                observed: null,
            },
        ],
        warnings: [],
    },
};

const dualRecords = [
    { ...aaplRecord, symbol: 'DUAL', companyName: 'Dual US', monitoringRules: { ...aaplRecord.monitoringRules, earningsWithinDays: 11 } },
    { ...maybankRecord, symbol: 'DUAL', companyName: 'Dual MY', monitoringRules: { ...maybankRecord.monitoringRules, earningsWithinDays: 18 } },
];
const dualCalendar = structuredClone(calendarFixture);
dualCalendar.data.events = [
    { ...calendarFixture.data.events[0], id: 'dual-us', symbol: 'DUAL', title: 'Dual US earnings', targetHref: '/research?ticker=DUAL&market=US&tab=events' },
    { ...calendarFixture.data.events[1], id: 'dual-my', symbol: 'DUAL', title: 'Dual MY review', sourceDate: dayOffset(2), displayDate: dayOffset(2), targetHref: '/research?ticker=DUAL&market=MY&tab=overview&review=edit' },
];
dualCalendar.data.macroEvents = [];
const dualAlerts = structuredClone(alertsFixture);
dualAlerts.data.alerts = [{ ...alertsFixture.data.alerts[1], id: 'dual-my-alert', symbol: 'DUAL', market: 'MY', kind: 'structured-trigger', title: 'Dual MY alert', structuredTrigger: { ...alertsFixture.data.triggerCoverage[1], symbol: 'DUAL', market: 'MY', status: 'matched' } }];
dualAlerts.data.triggerCoverage = [
    { ...alertsFixture.data.triggerCoverage[0], symbol: 'DUAL', market: 'US', status: 'not-matched' },
    { ...alertsFixture.data.triggerCoverage[1], symbol: 'DUAL', market: 'MY', status: 'matched' },
];

const dividendSnapshotFixture = {
    version: 1,
    revision: 1,
    updatedAt: fixtureTime.toISOString(),
    events: [
        {
            id: '00000000-0000-4000-8000-000000000001',
            revision: 1,
            accountLabel: 'Primary',
            currency: 'USD',
            notes: 'Quarterly dividend',
            createdAt: fixtureTime.toISOString(),
            updatedAt: fixtureTime.toISOString(),
            kind: 'dividend',
            symbol: 'AAPL',
            market: 'US',
            status: 'declared',
            declarationDate: dayOffset(0),
            recordDate: dayOffset(1),
            exDate: dayOffset(1),
            paymentDate: dayOffset(7),
            amountPerShare: 0.25,
            source: 'user-entered',
            providerEvidence: null,
        },
    ],
    history: [],
};

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

async function setupContext({ width, theme, owner = false, seedGuest = true, seedDividends = true, blockPickerPresetWrite = false, corruptPickerPresets = false, dual = false }) {
    const context = await browser.newContext({
        viewport: { width, height: 900 },
        colorScheme: theme,
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
    });
    const requests = [];
    await context.addInitScript(({ selectedTheme, isOwner, doSeedGuest, doSeedDividends, blockWrite, corruptPresets }) => {
        if (!sessionStorage.getItem('pr4-qa-init')) {
            sessionStorage.setItem('pr4-qa-init', '1');
            localStorage.setItem('signal-v8-theme-v1', selectedTheme);
            if (!isOwner && doSeedGuest) {
                localStorage.setItem('signal.guest-research.v1', JSON.stringify({
                    version: 1,
                    guestId: '11111111-1111-4111-8111-111111111111',
                    records: [
                        { symbol: 'AAPL', market: 'US', companyName: 'Apple Inc.', notes: '' },
                    ],
                }));
            }
            if (corruptPresets) {
                localStorage.setItem('signal-picker-presets-v1', '{corrupt json');
            }
        }
        if (doSeedDividends) {
            localStorage.setItem('signal-dividend-cashflow-v1', doSeedDividends === 'corrupt' ? '{bad-dividend-json' : JSON.stringify(doSeedDividends));
        }
        if (blockWrite) {
            const orig = Storage.prototype.setItem;
            Storage.prototype.setItem = function setItem(k, v) {
                if (k === 'signal-picker-presets-v1') throw new DOMException('Blocked', 'QuotaExceededError');
                return orig.call(this, k, v);
            };
        }
    }, {
        selectedTheme: theme,
        isOwner: owner,
        doSeedGuest: seedGuest,
        doSeedDividends: seedDividends === true ? dividendSnapshotFixture : seedDividends,
        blockWrite: blockPickerPresetWrite,
        corruptPresets: corruptPickerPresets,
    });

    await context.route('**/*', async route => {
        const req = route.request();
        const url = new URL(req.url());
        if (url.origin !== new URL(base).origin) return route.abort();
        if (!url.pathname.startsWith('/api/')) return route.continue();
        requests.push({ method: req.method(), path: url.pathname, query: url.search, body: req.postData() || '' });

        if (url.pathname === '/api/owner/session') return route.fulfill({ json: { success: true, data: { configured: owner, unlocked: owner } } });
        if (url.pathname === '/api/research/watchlist') return route.fulfill({ json: { success: true, data: owner ? (dual ? dualRecords : [aaplRecord, maybankRecord]) : [], archivedSymbols: [] } });
        if (url.pathname === '/api/research/discovery') return route.fulfill({ json: discoveryFixture });
        if (url.pathname === '/api/research/calendar' && req.method() === 'POST') return route.fulfill({ json: dual ? dualCalendar : calendarFixture });
        if (url.pathname === '/api/research/alerts' && req.method() === 'POST') return route.fulfill({ json: dual ? dualAlerts : alertsFixture });
        if (url.pathname === '/api/signals/v2') return route.fulfill({ json: url.searchParams.get('market') === 'MY' ? mySignal : usSignal });
        if (url.pathname === '/api/signals/intraday') return route.fulfill({ json: { success: true, data: { market: 'US', mode: 'standard', enableSocial: false, day: dayOffset(0), entries: [], hasEarlierCaptures: false } } });
        if (url.pathname === '/api/signals/internals') return route.fulfill({ json: { success: true, data: { market: 'US', available: false, updatedAt: null, items: [] } } });
        if (url.pathname === '/api/signals/fear-greed') return route.fulfill({ json: { success: true, data: { available: false, score: null, rating: null, previousClose: null, oneWeekAgo: null, oneMonthAgo: null, updatedAt: null } } });
        if (url.pathname === '/api/research/quotes' && req.method() === 'POST') {
            const payload = req.postDataJSON();
            const items = payload.map(({ symbol, market }) => ({
                success: true,
                data: {
                    symbol,
                    market,
                    providerSymbol: symbol,
                    fetchedAt: fixtureTime.toISOString(),
                    quote: {
                        ...researchSnapshotFixture.data.quote,
                        currency: market === 'MY' ? 'MYR' : 'USD',
                        price: symbol === 'VOO' ? 512.4 : symbol === 'AAPL' ? 231.0 : symbol === 'LLY' ? 819.5 : 430.0,
                        dailyChangePercent: 1.1,
                    },
                },
            }));
            return route.fulfill({ json: { success: true, data: { fetchedAt: fixtureTime.toISOString(), items } } });
        }
        if (url.pathname.startsWith('/api/research/symbol/')) {
            const sym = decodeURIComponent(url.pathname.split('/').at(-1) || 'AAPL').toUpperCase();
            const payload = structuredClone(researchSnapshotFixture);
            payload.data.symbol = sym;
            payload.data.market = url.searchParams.get('market') === 'MY' ? 'MY' : 'US';
            return route.fulfill({ json: payload });
        }
        if (url.pathname.startsWith('/api/research/valuation-plan/')) return route.fulfill({ json: { success: true, data: null } });
        if (url.pathname.startsWith('/api/research/valuation-history/')) return route.fulfill({ json: { success: true, data: { symbol: 'AAPL', market: 'US', observations: [], capabilities: {}, warnings: [] } } });
        if (url.pathname.startsWith('/api/research/filings/')) return route.fulfill({ json: { success: true, data: { symbol: 'AAPL', cik: '0000320193', issuer: 'Apple Inc.', filings: [] } } });
        return route.fulfill({ json: { success: true, data: {} } });
    });

    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    await page.clock.install({ time: fixtureTime });
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error') report.errors.push(msg.text()); });
    return { context, page, requests };
}

async function assertNoOverflow(page, label) {
    const dims = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.ok(dims.scrollWidth <= dims.innerWidth, `${label}: horizontal overflow ${dims.scrollWidth} > ${dims.innerWidth}`);
}

try {
    // 1. V9-E10 + V9-E11 + V9-E12 Desktop Light (Guest)
    const guestDesktop = await setupContext({ width: 1280, theme: 'light', owner: false });
    await runCheck('V9-E12 Discover header subtitle lists all 5 tabs and US/MY scope', async () => {
        await guestDesktop.page.goto(`${base}/v9?view=discover`, { waitUntil: 'networkidle' });
        const sub = await guestDesktop.page.locator('p').filter({ hasText: 'Trending, Early trends & Stock Picker (US)' }).innerText();
        assert.ok(sub.includes('Calendar & Alerts (US & MY)'), `Unexpected subtitle: ${sub}`);
    });

    await runCheck('V9-E10 Trending filters, Saved badge, rank deltas, and Quick-Peek drawer preserve context & save to watchlist', async () => {
        const page = guestDesktop.page;
        const list = page.getByTestId('research-trending');
        await list.waitFor();

        // Saved badge on AAPL, deltas on AAPL (+4) & LLY (New)
        assert.equal(await list.locator('li[data-group]').first().getByTestId('discover-saved-badge').innerText(), 'Saved');
        assert.equal(await list.locator('li[data-group]').first().getByTestId('discover-rank-delta').innerText(), '▲ +4');
        assert.equal(await list.locator('li[data-group]').nth(1).getByTestId('discover-rank-delta').innerText(), 'New');

        // Filters: Sector, Low risk only, Hide saved
        const filterBar = page.getByTestId('discover-filter-bar');
        await filterBar.getByLabel('Filter by sector').selectOption('Technology');
        assert.equal(await list.locator('li[data-group]').count(), 2); // AAPL + NVDA
        await filterBar.getByRole('button', { name: 'Low risk only' }).click();
        assert.equal(await list.locator('li[data-group]').count(), 1); // AAPL
        await filterBar.getByRole('button', { name: 'Hide saved' }).click();
        await page.getByText('No candidates match the active filters.').waitFor();
        await filterBar.getByRole('button', { name: 'Reset' }).click();
        assert.equal(await list.locator('li[data-group]').count(), 4);

        // Quick-Peek Drawer on LLY + Save to watchlist + Escape close preserves filter
        await filterBar.getByRole('button', { name: 'Low risk only' }).click();
        await page.getByTestId('discover-peek-LLY').click();
        const drawer = page.getByTestId('discover-quick-peek-drawer');
        await drawer.waitFor();
        const drawerText = await drawer.innerText();
        assert.ok(drawerText.includes('$812.00') && drawerText.includes('Earnings') && drawerText.includes('89'), drawerText);
        await page.screenshot({ path: `${output}/quick-peek-1280-light.png` });

        await drawer.getByRole('button', { name: 'Save to watchlist' }).click();
        await drawer.getByTestId('quick-peek-saved-badge').waitFor();
        await page.keyboard.press('Escape');
        await drawer.waitFor({ state: 'detached' });

        // Filter still active after closing drawer and LLY now shows Saved badge
        assert.equal(await filterBar.getByRole('button', { name: 'Low risk only' }).getAttribute('aria-pressed'), 'true');
        assert.equal(await list.locator('li[data-group]').nth(1).getByTestId('discover-saved-badge').innerText(), 'Saved');

        // Open full research from Quick-Peek
        await page.getByTestId('discover-peek-AAPL').click();
        await drawer.waitFor();
        await drawer.getByRole('button', { name: /Open full research/ }).click();
        await page.waitForURL(u => u.searchParams.get('view') === 'research' && u.searchParams.get('ticker') === 'AAPL');
        await page.goto(`${base}/v9?view=discover`, { waitUntil: 'networkidle' });
    });

    await runCheck('V9-E10 Early trends filters, Saved badge, rank delta & Quick-Peek drawer', async () => {
        const page = guestDesktop.page;
        await page.getByRole('tab', { name: 'Early trends', exact: true }).click();
        const early = page.getByTestId('research-early-trends');
        await early.waitFor();
        assert.equal(await early.locator('li[data-stage]').count(), 2);
        await page.getByTestId('discover-filter-bar').getByRole('button', { name: 'Low risk only' }).click();
        assert.equal(await early.locator('li[data-stage]').count(), 1);
        assert.equal(await early.locator('li[data-stage]').first().getByTestId('discover-saved-badge').innerText(), 'Saved');
        await page.getByTestId('discover-peek-LLY').click();
        await page.getByTestId('discover-quick-peek-drawer').waitFor();
        await page.keyboard.press('Escape');
        await page.getByTestId('discover-quick-peek-drawer').waitFor({ state: 'detached' });
    });

    await runCheck('V9-E11 Stock Picker batched POST /api/research/quotes, zero GET /quote/, presets & row actions', async () => {
        const page = guestDesktop.page;
        guestDesktop.requests.length = 0;
        await page.getByRole('tab', { name: 'Stock Picker', exact: true }).click();
        const presetsBar = page.getByTestId('picker-presets-bar');
        await presetsBar.waitFor();
        assert.ok((await presetsBar.innerText()).includes('Saved on this device'));

        // Save preset, change rule, apply preset, reload to confirm persistence, then delete
        await page.getByLabel('Minimum score').selectOption('80');
        await presetsBar.getByPlaceholder(/Preset name/).fill('High Conviction 80+');
        await presetsBar.getByRole('button', { name: 'Save preset' }).click();
        await page.getByText('Preset saved on this device.').waitFor();

        // Save CAT via row action, Start paper basket (triggers batched POST /api/research/quotes)
        await page.getByLabel('Minimum score').selectOption('70');
        const shortlist = page.getByRole('region', { name: 'Picker shortlist' });
        const catRow = shortlist.locator('ol > li', { hasText: 'CAT' });
        await catRow.getByRole('button', { name: 'Save to Watchlist' }).click();
        await catRow.getByRole('button', { name: 'Saved ✓' }).waitFor();
        await shortlist.getByRole('button', { name: 'Start paper basket' }).click();
        await page.getByText(/Paper basket started with/).waitFor();

        // Reload and verify preset + basket refresh uses single POST /api/research/quotes and 0 GET /api/research/quote/*
        guestDesktop.requests.length = 0;
        await page.reload({ waitUntil: 'networkidle' });
        await page.getByTestId('picker-presets-bar').getByRole('button', { name: 'High Conviction 80+', exact: true }).click();
        assert.equal(await page.getByLabel('Minimum score').inputValue(), '80');

        const batchCalls = guestDesktop.requests.filter(r => r.method === 'POST' && r.path === '/api/research/quotes');
        const singleCalls = guestDesktop.requests.filter(r => r.path.startsWith('/api/research/quote/'));
        assert.ok(batchCalls.length >= 1, 'Expected at least 1 batched POST /api/research/quotes call');
        assert.equal(singleCalls.length, 0, `Expected 0 GET /api/research/quote/* calls, got ${singleCalls.length}`);

        // Delete preset and test row Open in Research
        await page.getByRole('button', { name: 'Delete preset High Conviction 80+' }).click();
        await page.screenshot({ path: `${output}/picker-1280-light.png` });
        await shortlist.locator('ol > li').first().getByRole('button', { name: 'Open in Research' }).click();
        await page.waitForURL(u => u.searchParams.get('view') === 'research');
        await page.goto(`${base}/v9?view=discover`, { waitUntil: 'networkidle' });
    });

    await runCheck('V9-E12 Calendar filters, session rhythm, weekend shading & local dividend overlay', async () => {
        const page = guestDesktop.page;
        await page.getByRole('tab', { name: 'Calendar', exact: true }).click();
        const grid = page.getByTestId('research-calendar-grid');
        await grid.waitFor();

        const rhythm = await page.getByTestId('calendar-session-rhythm').innerText();
        assert.ok(rhythm.includes('Bursa session · MYT'), `Unexpected session rhythm: ${rhythm}`);
        assert.ok((await grid.locator('[data-weekend="true"]').count()) >= 8, 'Expected weekend headers and day cells');

        // Event-kind filters
        const filters = page.getByTestId('calendar-kind-filters');
        await filters.getByRole('button', { name: 'Macro', exact: true }).click();
        assert.equal(await grid.locator('[data-kind="earnings"]').count(), 0);
        assert.ok((await grid.locator('[data-kind="macro"]').count()) >= 1);
        await filters.getByRole('button', { name: 'All', exact: true }).click();

        // Local dividend overlay (zero extra network requests)
        const reqsBefore = guestDesktop.requests.length;
        await page.getByTestId('calendar-dividend-toggle').click();
        await page.waitForFunction(() => document.querySelectorAll('[data-kind="dividend"]').length >= 1);
        assert.equal(guestDesktop.requests.length, reqsBefore, 'Dividend overlay must not trigger network requests');
        await page.screenshot({ path: `${output}/calendar-1280-light.png` });
    });

    await guestDesktop.context.close();

    // 2. Owner Alerts per-ticker trigger links + Corrupt/Blocked Picker Preset Resilience
    const ownerCtx = await setupContext({ width: 1280, theme: 'light', owner: true, corruptPickerPresets: true, blockPickerPresetWrite: true, seedDividends: 'corrupt' });
    await runCheck('V9-E12 Alerts per-ticker trigger links for US & MY triggers', async () => {
        const page = ownerCtx.page;
        await page.goto(`${base}/v9?view=discover&discover=alerts`, { waitUntil: 'networkidle' });
        await page.getByText(/Your review triggers/).click();
        const aaplLink = page.getByTestId('alert-trigger-link-US-AAPL-aapl-pe');
        const myLink = page.getByTestId('alert-trigger-link-MY-1155-1155-rsi');
        const aaplHref = await aaplLink.getAttribute('href');
        const myHref = await myLink.getAttribute('href');
        const aaplUrl = new URL(aaplHref ?? '', base);
        const myUrl = new URL(myHref ?? '', base);
        assert.equal(aaplUrl.pathname, '/v9');
        assert.equal(aaplUrl.searchParams.get('view'), 'research');
        assert.equal(aaplUrl.searchParams.get('market'), 'US');
        assert.equal(aaplUrl.searchParams.get('ticker'), 'AAPL');
        assert.equal(aaplUrl.searchParams.get('tab'), 'monitoring');
        assert.equal(myUrl.pathname, '/v9');
        assert.equal(myUrl.searchParams.get('view'), 'research');
        assert.equal(myUrl.searchParams.get('market'), 'MY');
        assert.equal(myUrl.searchParams.get('ticker'), '1155');
        assert.equal(myUrl.searchParams.get('tab'), 'monitoring');
        await page.screenshot({ path: `${output}/alerts-1280-light.png` });
    });
    await runCheck('V9-E11 & V9-E12 resilient to corrupt/blocked localStorage', async () => {
        const page = ownerCtx.page;
        await page.getByRole('tab', { name: 'Stock Picker', exact: true }).click();
        await page.getByText(/Saved presets on this device could not be read/).waitFor();
        await page.getByRole('tab', { name: 'Calendar', exact: true }).click();
        await page.getByTestId('calendar-dividend-toggle').click();
        await page.getByText(/Saved dividend and cash-flow data is invalid/).waitFor();
    });
    await ownerCtx.context.close();

    const dualCtx = await setupContext({ width: 1280, theme: 'light', owner: true, dual: true });
    await runCheck('Same-symbol US/MY calendar and alerts preserve listing identity', async () => {
        const { page, requests } = dualCtx;
        const assertBody = path => {
            const request = requests.filter(item => item.path === path && item.method === 'POST').at(-1);
            assert.ok(request, `Missing ${path} POST`);
            const body = JSON.parse(request.body);
            const entries = Array.isArray(body) ? body : body.records;
            assert.ok(Array.isArray(entries), `Unexpected ${path} body: ${request.body}`);
            const us = entries.find(item => item.symbol === 'DUAL' && item.market === 'US');
            const my = entries.find(item => item.symbol === 'DUAL' && item.market === 'MY');
            assert.ok(us && my, `${path} must contain both listings`);
            if (path.endsWith('/calendar')) {
                assert.equal(us.earningsWithinDays, 11);
                assert.equal(my.earningsWithinDays, 18);
            } else {
                assert.equal(us.monitoringRules.structuredTriggers.rules[0].id, 'aapl-pe');
                assert.equal(my.monitoringRules.structuredTriggers.rules[0].id, '1155-rsi');
            }
        };
        await page.goto(`${base}/v9?view=discover`, { waitUntil: 'networkidle' });
        const calendarRequest = page.waitForRequest(req => new URL(req.url()).pathname === '/api/research/calendar' && req.method() === 'POST');
        await page.getByRole('tab', { name: 'Calendar', exact: true }).click();
        await calendarRequest;
        await page.getByTestId('research-calendar-grid').waitFor();
        assertBody('/api/research/calendar');
        for (const market of ['US', 'MY']) {
            await page.locator(`button:has(time[datetime="${dayOffset(2)}"])`).click();
            const agenda = page.getByRole('region', { name: 'Selected day' });
            await agenda.getByText('Dual US earnings').waitFor();
            await agenda.getByText('Dual MY review').waitFor();
            await agenda.getByRole('button', { name: `DUAL · ${market}` }).click();
            await page.waitForURL(u => u.searchParams.get('view') === 'research' && u.searchParams.get('ticker') === 'DUAL' && u.searchParams.get('market') === market);
            await page.getByRole('navigation', { name: 'Company research' }).getByRole('link', { name: 'Monitoring rules' }).click();
            const rule = market === 'US' ? 'aapl-pe' : '1155-rsi';
            const metric = market === 'US' ? 'price-earnings' : 'rsi14';
            assert.equal(await page.getByLabel(`Metric for rule ${rule}`).inputValue(), metric);
            await page.goto(`${base}/v9?view=discover`, { waitUntil: 'networkidle' });
            await page.getByRole('tab', { name: 'Calendar', exact: true }).click();
        }
        await page.goto(`${base}/v9?view=research&tab=watchlist`, { waitUntil: 'networkidle' });
        await page.getByTestId('watchlist-row').first().waitFor();
        await page.getByTestId('watchlist-triggered-filter').click();
        await page.getByTestId('watchlist-triggered-status').getByText(/Showing stocks/).waitFor();
        assertBody('/api/research/alerts');
        const rows = page.getByTestId('watchlist-row');
        assert.equal(await rows.count(), 1);
        assert.equal(await rows.first().getAttribute('data-market'), 'MY');
        assert.match(await rows.first().innerText(), /Dual MY/);
        await page.getByTestId('attention-trigger').click();
        const popover = page.getByTestId('attention-popover');
        const myAlert = popover.getByRole('link', { name: /Dual MY alert/ });
        const popoverUrl = new URL(await myAlert.getAttribute('href'), base);
        assert.equal(popoverUrl.searchParams.get('market'), 'MY');
        assert.equal(popoverUrl.searchParams.get('tab'), 'monitoring');
        await myAlert.click();
        await page.waitForURL(u => u.searchParams.get('ticker') === 'DUAL' && u.searchParams.get('market') === 'MY');
        await page.getByRole('heading', { name: 'Monitoring rules for DUAL · MY' }).waitFor();
        assert.equal(await page.getByLabel('Metric for rule 1155-rsi').inputValue(), 'rsi14');
        await page.goto(`${base}/v9?view=discover&discover=alerts`, { waitUntil: 'networkidle' });
        assertBody('/api/research/alerts');
        await page.getByText(/Your review triggers/).click();
        const myTrigger = page.getByTestId('alert-trigger-link-MY-DUAL-1155-rsi');
        assert.equal(new URL(await myTrigger.getAttribute('href'), base).searchParams.get('market'), 'MY');
        await myTrigger.click();
        await page.waitForURL(u => u.searchParams.get('ticker') === 'DUAL' && u.searchParams.get('market') === 'MY' && u.searchParams.get('tab') === 'monitoring');
        await page.getByRole('heading', { name: 'Monitoring rules for DUAL · MY' }).waitFor();
        assert.equal(await page.getByLabel('Metric for rule 1155-rsi').inputValue(), 'rsi14');
        await page.goto(`${base}/v9?view=discover&discover=alerts`, { waitUntil: 'networkidle' });
        await page.getByRole('button', { name: 'DUAL (MY)' }).click();
        await page.waitForURL(u => u.searchParams.get('ticker') === 'DUAL' && u.searchParams.get('market') === 'MY');
    });
    await dualCtx.context.close();


    // 3. Responsive Matrix: 1280, 768, 375 in Light & Dark
    for (const [width, theme] of [
        [1280, 'dark'],
        [768, 'light'],
        [768, 'dark'],
        [375, 'light'],
        [375, 'dark'],
    ]) {
        const ctx = await setupContext({ width, theme, owner: false });
        await runCheck(`Responsive ${width}px ${theme} Trending + Quick-Peek + Picker + Calendar`, async () => {
            const page = ctx.page;
            await page.goto(`${base}/v9?view=discover&discover=trending`, { waitUntil: 'networkidle' });
            await page.getByTestId('research-trending').waitFor();
            await assertNoOverflow(page, `trending-${width}-${theme}`);
            await page.screenshot({ path: `${output}/trending-${width}-${theme}.png` });

            await page.getByTestId('discover-peek-AAPL').click();
            await page.getByTestId('discover-quick-peek-drawer').waitFor();
            await assertNoOverflow(page, `quick-peek-${width}-${theme}`);
            await page.screenshot({ path: `${output}/quick-peek-${width}-${theme}.png` });
            await page.keyboard.press('Escape');

            await page.getByRole('tab', { name: 'Stock Picker', exact: true }).click();
            await page.getByTestId('picker-presets-bar').waitFor();
            await assertNoOverflow(page, `picker-${width}-${theme}`);
            await page.screenshot({ path: `${output}/picker-${width}-${theme}.png` });

            await page.getByRole('tab', { name: 'Calendar', exact: true }).click();
            await page.getByTestId('research-calendar-grid').waitFor();
            await assertNoOverflow(page, `calendar-${width}-${theme}`);
            await page.screenshot({ path: `${output}/calendar-${width}-${theme}.png` });
        });
        await ctx.context.close();
    }

    assert.equal(report.errors.length, 0, `Browser errors: ${report.errors.join(' | ')}`);
    assert.equal(report.failures.length, 0, `QA failures: ${report.failures.map(f => f.name).join(', ')}`);
    await writeFile(`${output}/summary.json`, JSON.stringify(report, null, 2));
    console.log(`V9 PR-4 Discover QA passed: ${report.checks.length} checks.`);
} catch (error) {
    await writeFile(`${output}/summary.json`, JSON.stringify({ ...report, fatal: String(error) }, null, 2));
    throw error;
} finally {
    await browser.close();
}
