import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const argument = (name, fallback = null) => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
};
const baseUrl = argument('--base-url', process.env.SIGNAL_QA_URL ?? 'http://127.0.0.1:3000');
const timeout = Number(argument('--timeout', '15000'));
const baseOrigin = new URL(baseUrl).origin;
const viewports = [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 812 },
];
const themes = ['light', 'dark'];
const artifactDirectory = path.resolve('.tmp', 'v7-phase1-interaction-qa', new Date().toISOString().replace(/[.:]/g, '-'));
await mkdir(artifactDirectory, { recursive: true });

const marketResponse = await fetch(`${baseUrl}/api/signals/v2?market=US&mode=standard&enableSocial=true`, {
    signal: AbortSignal.timeout(timeout),
}).then((response) => response.json());
if (!marketResponse?.success || !marketResponse.data) throw new Error('Unable to obtain a valid local Market fixture.');

const checklist = {
    understandBusiness: false, revenueGrowingOrStable: false, marginsHealthyOrImproving: false,
    debtManageable: false, freeCashFlowPositiveOrImproving: false, valuationReasonable: false,
    catalystOrCompoundingReason: false, downsideAcceptable: false, betterThanCashOrIndex: false,
};
const record = {
    symbol: 'MSFT', market: 'US', companyName: 'Microsoft', positionState: 'not-owned', inBuyZone: false,
    status: 'watch', targetBuyZone: '', valuationState: 'unknown', thesisStrength: 'medium',
    whyInterested: '', bullCase: 'PRIVATE_THESIS_SENTINEL', bearCase: '', buyTrigger: '', sellTrigger: '', thesisBreak: '', notes: '',
    checklist,
    monitoringRules: {
        buyZone: true, belowMa200: true, rsiBelow: 30, rsiAbove: null, earningsWithinDays: 21,
        reviewAgeDays: 30, structuredTriggers: { version: 1, migrationState: 'current', rules: [] },
    },
    acceptedEvidence: [], documentEvidence: { version: 1, migrationState: 'current', citations: [] },
    factorAssumptions: { version: 1, migrationState: 'current', assumptions: [] },
    decisionJournal: {
        decision: 'Watch', confidence: 'medium', observedPrice: null, benchmarkLabel: null,
        benchmarkReturnPercent: null, nextReviewAt: null, priorReviewId: null,
        priorOutcome: 'unresolved', outcomeNote: '',
    },
    positionPlan: { plannedAllocationPercent: null, averageCost: null, plannedEntryPrice: null, invalidationPrice: null },
    reviewHistory: [], lastReviewedAt: '2026-07-20', updatedAt: '2026-07-26T00:00:00.000Z', revision: 1,
};
const records = [record, { ...record, symbol: 'NVDA', companyName: 'NVIDIA', bullCase: '', decisionJournal: { ...record.decisionJournal, decision: 'Ready' } }];
const snapshot = {
    symbol: 'MSFT', market: 'US', fetchedAt: '2026-07-31T08:00:00.000Z',
    benchmark: { baselineSymbol: 'VOO', baselineName: 'Vanguard S&P 500 ETF', period: '1Y', candidateReturnPercent: null, baselineReturnPercent: null, relativeReturnPercent: null, returnBasis: null, status: 'unavailable' },
    quote: { name: 'Microsoft', currency: 'USD', price: 425, dailyChangePercent: 0.5 },
    fundamentals: { revenueGrowthPercent: null, grossMarginPercent: null, operatingMarginPercent: null, freeCashFlow: null, debt: null, cash: null, shares: null, annualRevenue: null, annualNetIncome: null, reportingPeriod: null, shareChangePercent: null, source: null, history: [] },
    valuation: { marketCap: null, priceEarnings: null, priceSales: null, freeCashFlowYieldPercent: null, netCash: null, reportingPeriod: null, source: null },
    technicals: { ma50: null, ma200: null, rsi14: null, macd: null, low52Week: null, high52Week: null, averageVolume20: null, support: null, resistance: null },
    chart: { interval: '1d', points: [] }, sources: ['Yahoo Finance'], warnings: [],
};
const policy = { version: 1, maxSingleAllocationPercent: 20, maxSectorAllocationPercent: 35, minEvidenceCoveragePercent: 40, maxReviewAgeDays: 90, requireFairOrCheapForReady: true };

const report = { command: 'npm run qa:v7-phase1', baseUrl, artifactDirectory, scenarios: [], failures: [] };
const check = (condition, message) => {
    if (!condition) throw new Error(message);
};
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const documentOverflow = (page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0) - window.innerWidth);
const maximumOverlapArea = (page, selector) => page.locator(selector).evaluateAll((nodes) => {
    const rectangles = nodes
        .filter((node) => node instanceof HTMLElement && node.getClientRects().length > 0)
        .map((node) => node.getBoundingClientRect());
    if (rectangles.length < 2) return Number.POSITIVE_INFINITY;
    let maximum = 0;
    for (let first = 0; first < rectangles.length; first += 1) {
        for (let second = first + 1; second < rectangles.length; second += 1) {
            const width = Math.max(0, Math.min(rectangles[first].right, rectangles[second].right) - Math.max(rectangles[first].left, rectangles[second].left));
            const height = Math.max(0, Math.min(rectangles[first].bottom, rectangles[second].bottom) - Math.max(rectangles[first].top, rectangles[second].top));
            maximum = Math.max(maximum, width * height);
        }
    }
    return maximum;
});

const createState = () => ({
    signalMode: 'success', signalDelay: 0, staleResponses: false, quoteFailure: false,
    signalRequests: [], requestUrls: [], mutations: [], blocking: [], expectedFailures: new Set(),
});

const fixtureSignal = (requestUrl, score = null) => {
    const url = new URL(requestUrl);
    const data = structuredClone(marketResponse.data);
    data.market = url.searchParams.get('market') === 'MY' ? 'MY' : 'US';
    data.mode = url.searchParams.get('mode') === 'contrarian' ? 'contrarian' : 'standard';
    if (score !== null) data.composite_score = score;
    return { success: true, data };
};

const preparePage = async (context, state) => {
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);
    page.on('console', (message) => {
        if (message.type() !== 'error') return;
        if (message.text().startsWith('Failed to load resource:') && state.expectedFailures.size > 0) return;
        state.blocking.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => state.blocking.push(`pageerror: ${error.message}`));
    page.on('request', (request) => state.requestUrls.push(request.url()));
    page.on('requestfailed', (request) => {
        if (!(request.failure()?.errorText ?? '').includes('ERR_ABORTED')) state.blocking.push(`requestfailed: ${request.method()} ${request.url()}`);
    });
    page.on('response', (response) => {
        if (response.status() < 400) return;
        const url = new URL(response.url());
        if (url.origin === baseOrigin && !state.expectedFailures.has(url.pathname)) state.blocking.push(`HTTP ${response.status()} ${url.pathname}`);
    });
    await page.route('**/api/signals/v2?**', async (route) => {
        const url = route.request().url();
        state.signalRequests.push(url);
        if (state.signalMode === 'failure') {
            state.expectedFailures.add('/api/signals/v2');
            return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Fixture refresh failure' }) });
        }
        let wait = state.signalDelay;
        let score = null;
        if (state.staleResponses) {
            const parsed = new URL(url);
            const isLatest = parsed.searchParams.get('market') === 'MY' && parsed.searchParams.get('mode') === 'contrarian';
            wait = isLatest ? 80 : 650;
            score = isLatest ? 88 : 12;
        }
        if (wait > 0) await delay(wait);
        try {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtureSignal(url, score)) });
        } catch {
            // Superseded requests are intentionally aborted by the Market controller.
        }
    });
    await page.route('**/api/research/**', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (['PATCH', 'PUT', 'DELETE'].includes(request.method())
            || (request.method() === 'POST' && url.pathname.startsWith('/api/research/watchlist'))) state.mutations.push(`${request.method()} ${url.pathname}`);
        if (url.pathname === '/api/research/watchlist') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: records, archivedSymbols: [] }) });
        if (url.pathname === '/api/research/inbox') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { generatedAt: snapshot.fetchedAt, monitoredCount: records.length, items: [], warnings: [] } }) });
        if (url.pathname === '/api/research/quotes' && state.quoteFailure) {
            state.expectedFailures.add(url.pathname);
            return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Fixture quote failure' }) });
        }
        if (url.pathname === '/api/research/quotes') {
            const inputs = request.postDataJSON();
            const items = Array.isArray(inputs) ? inputs.map((input) => ({
                success: true,
                data: {
                    symbol: input.symbol,
                    market: input.market,
                    providerSymbol: input.symbol,
                    fetchedAt: snapshot.fetchedAt,
                    quote: { ...snapshot.quote, name: input.symbol === 'NVDA' ? 'NVIDIA' : input.symbol },
                },
            })) : [];
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { fetchedAt: snapshot.fetchedAt, items } }) });
        }
        if (url.pathname.startsWith('/api/research/symbol/')) {
            const symbol = url.pathname.split('/').at(-1) ?? 'MSFT';
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { ...snapshot, symbol, quote: { ...snapshot.quote, name: symbol === 'NVDA' ? 'NVIDIA' : 'Microsoft' } } }) });
        }
        if (url.pathname.startsWith('/api/research/quote/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { quote: snapshot.quote } }) });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
    });
    return page;
};

const initializeTheme = (theme, extra = () => {}) => async (context) => {
    await context.addInitScript(({ selectedTheme, savedPolicy }) => {
        localStorage.setItem('signal-dashboard-theme-v2', selectedTheme);
        localStorage.setItem('signal-investment-policy-v1', JSON.stringify(savedPolicy));
    }, { selectedTheme: theme, savedPolicy: policy });
    await extra(context);
};

const browser = await chromium.launch({ headless: true });
try {
    for (const theme of themes) {
        for (const viewport of viewports) {
            const name = `matrix-${theme}-${viewport.name}`;
            const scenario = { name, status: 'failed', screenshots: [] };
            report.scenarios.push(scenario);
            const state = createState();
            const context = await browser.newContext({ viewport, hasTouch: viewport.width === 375 });
            await initializeTheme(theme)(context);
            const page = await preparePage(context, state);
            try {
                await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
                await page.locator('#market-posture-v7').waitFor({ state: 'visible' });
                check(await page.getByTestId('market-v7').getAttribute('data-theme') === theme, `${name}: Market theme did not restore`);
                check(await page.getByRole('link', { name: /Inspect evidence/ }).count() === 3, `${name}: first-reading inspection links are incomplete`);
                check(await page.getByTestId('market-research-handoff').isVisible(), `${name}: Research handoff is not visible before advanced evidence`);
                check(await page.getByTestId('market-advanced-evidence').getAttribute('open') === null, `${name}: advanced evidence should start collapsed`);
                check(await documentOverflow(page) <= 1, `${name}: Market has horizontal overflow`);
                const statusOverlap = await maximumOverlapArea(page, '[data-market-control-cluster="status"] p');
                check(statusOverlap <= 1, `${name}: Market status labels overlap (${statusOverlap.toFixed(2)}px squared)`);
                if (viewport.width === 375) {
                    const statusRows = await page.locator('[data-market-control-cluster="status"] p').evaluateAll((nodes) => nodes
                        .filter((node) => node instanceof HTMLElement && node.getClientRects().length > 0)
                        .map((node) => ({ top: node.getBoundingClientRect().top, bottom: node.getBoundingClientRect().bottom })));
                    check(statusRows.length >= 2 && statusRows[1].top >= statusRows[0].bottom + 4, `${name}: Market status labels are not separated into readable mobile rows`);
                }
                const marketScreenshot = path.join(artifactDirectory, `${name}-market.png`);
                await page.screenshot({ path: marketScreenshot, fullPage: false, caret: 'initial' });
                scenario.screenshots.push(marketScreenshot);
                const firstReadingScreenshot = path.join(artifactDirectory, `${name}-market-first-reading.png`);
                await page.getByTestId('market-first-reading').screenshot({ path: firstReadingScreenshot, caret: 'initial' });
                scenario.screenshots.push(firstReadingScreenshot);

                await page.goto(`${baseUrl}/research?workspace=research&ticker=MSFT`, { waitUntil: 'domcontentloaded' });
                const researchRoot = page.locator('[data-testid="research-v7"]:visible');
                const matrixNextAction = page.locator('[data-testid="research-readiness-next"]:visible');
                await matrixNextAction.waitFor({ state: 'visible' });
                await page.waitForFunction((expectedTheme) => [...document.querySelectorAll('[data-testid="research-v7"]')]
                    .find((element) => element.getClientRects().length > 0)?.getAttribute('data-theme') === expectedTheme, theme);
                check(await researchRoot.getAttribute('data-theme') === theme, `${name}: Research theme did not restore`);
                check(await matrixNextAction.count() === 1, `${name}: Research exposes more than one visible next action`);
                check(await documentOverflow(page) <= 1, `${name}: Research has horizontal overflow`);
                await page.getByText(/Live quote ·/).first().waitFor({ state: 'visible' });
                await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
                check(await page.evaluate(() => window.scrollY) === 0, `${name}: Research first-viewport capture did not reset to the route origin`);
                if (viewport.width === 375) {
                    const order = await page.evaluate(() => {
                        const header = document.querySelector('#research-detail > header')?.getBoundingClientRect();
                        const watchlist = document.querySelector('[data-testid="research-watchlist-owner"]')?.getBoundingClientRect();
                        return { headerBottom: header?.bottom ?? Infinity, watchlistTop: watchlist?.top ?? -Infinity, watchlistHeight: watchlist?.height ?? Infinity };
                    });
                    check(order.headerBottom <= order.watchlistTop + 1 && order.watchlistHeight <= 230, `${name}: mobile decision/ticker order or compactness failed`);
                }
                const researchScreenshot = path.join(artifactDirectory, `${name}-research.png`);
                await page.screenshot({ path: researchScreenshot, fullPage: false, caret: 'initial' });
                scenario.screenshots.push(researchScreenshot);
                if (viewport.width === 375) {
                    await page.getByTestId('research-watchlist-owner').getByRole('button', { name: /NVDA/ }).tap();
                    await page.waitForURL((url) => url.searchParams.get('ticker') === 'NVDA');
                }
                check(state.blocking.length === 0, `${name}: ${state.blocking.join(' | ')}`);
                scenario.status = 'passed';
            } catch (error) {
                scenario.error = error instanceof Error ? error.message : String(error);
                report.failures.push(`${name}: ${scenario.error}`);
            } finally {
                await context.close();
            }
        }
    }

    {
        const scenario = { name: 'market-interactions-and-recovery', status: 'failed' };
        report.scenarios.push(scenario);
        const state = createState();
        state.signalDelay = 550;
        const context = await browser.newContext({ viewport: viewports[0] });
        await initializeTheme('light')(context);
        const page = await preparePage(context, state);
        try {
            await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
            await page.getByLabel('Loading market conditions').waitFor({ state: 'visible' });
            check(await page.getByTestId('market-v7').isVisible(), 'Market route identity disappeared while loading');
            await page.locator('#market-posture-v7').waitFor({ state: 'visible' });
            const advanced = page.getByTestId('market-advanced-evidence');
            const beforeScroll = await page.evaluate(() => window.scrollY);
            await page.getByRole('link', { name: /Strongest support/ }).click();
            await page.waitForFunction(() => document.activeElement?.id === 'drivers-title');
            check(await advanced.getAttribute('open') !== null && new URL(page.url()).hash === '#drivers-title', 'Evidence inspection did not reveal, focus, and deep-link its owner');
            await page.goBack();
            await page.waitForFunction(() => window.location.hash === '');
            await page.waitForFunction(() => document.activeElement?.id === 'market-support-inspection');
            check(await advanced.getAttribute('open') === null, 'Browser Back did not restore the prior disclosure state');
            check(Math.abs((await page.evaluate(() => window.scrollY)) - beforeScroll) <= 4, 'Browser Back did not restore the prior scroll context');
            check(await page.locator('#market-support-inspection').evaluate((node) => node === document.activeElement), 'Browser Back did not restore focus to the evidence inspection link');
            await advanced.locator('summary').first().click();
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.locator('#market-posture-v7').waitFor({ state: 'visible' });
            check(await page.getByTestId('market-advanced-evidence').getAttribute('open') !== null, 'Advanced-evidence preference did not survive reload');
            await page.getByTestId('market-advanced-evidence').locator('summary').first().click();

            state.signalDelay = 450;
            const priorPosture = await page.locator('#market-posture-v7').textContent();
            await page.getByRole('button', { name: 'Contrarian' }).click();
            await page.getByText('Updating for Contrarian interpretation. Previous market conditions remain visible.').waitFor({ state: 'visible' });
            check(await page.locator('#market-posture-v7').textContent() === priorPosture, 'Market replaced prior valid content while updating');
            await page.getByText(/Active configuration · .*Contrarian interpretation/).waitFor({ state: 'visible' });

            state.signalDelay = 0;
            state.signalMode = 'failure';
            await page.getByRole('button', { name: /Refresh market conditions/ }).click();
            const failure = page.getByTestId('market-v7').getByRole('alert');
            await failure.waitFor({ state: 'visible' });
            check((await failure.textContent())?.includes('Previous market conditions remain visible'), 'Market failure did not retain and explain previous conditions');
            state.signalMode = 'success';
            await failure.getByRole('button', { name: 'Retry' }).click();
            await page.getByText(/Active configuration/).waitFor({ state: 'visible' });
            check(state.blocking.length === 0, state.blocking.join(' | '));
            scenario.status = 'passed';
        } catch (error) {
            scenario.error = error instanceof Error ? error.message : String(error);
            report.failures.push(`${scenario.name}: ${scenario.error}`);
        } finally {
            await context.close();
        }
    }

    {
        const scenario = { name: 'market-stale-response-protection', status: 'failed' };
        report.scenarios.push(scenario);
        const state = createState();
        const context = await browser.newContext({ viewport: viewports[0] });
        await initializeTheme('dark')(context);
        const page = await preparePage(context, state);
        try {
            await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
            await page.locator('#market-posture-v7').waitFor({ state: 'visible' });
            state.staleResponses = true;
            await page.getByRole('button', { name: 'MY', exact: true }).click();
            await page.waitForFunction(() => window.location.href && document.querySelector('[aria-label="Market conditions controls"]')?.textContent?.includes('Updating for Malaysia market'));
            await page.getByRole('button', { name: 'Contrarian' }).click();
            await page.waitForFunction(() => document.querySelector('[aria-label="Market orientation metrics"] strong')?.textContent?.trim() === '88 / 100');
            await delay(750);
            check(await page.locator('[aria-label="Market orientation metrics"] strong').first().textContent() === '88 / 100', 'A stale Market response replaced the latest configuration');
            check(state.signalRequests.some((url) => url.includes('market=MY') && url.includes('mode=standard'))
                && state.signalRequests.some((url) => url.includes('market=MY') && url.includes('mode=contrarian')), 'Stale-response scenario did not issue both requests');
            check(state.blocking.length === 0, state.blocking.join(' | '));
            scenario.status = 'passed';
        } catch (error) {
            scenario.error = error instanceof Error ? error.message : String(error);
            report.failures.push(`${scenario.name}: ${scenario.error}`);
        } finally {
            await context.close();
        }
    }

    {
        const scenario = { name: 'research-url-filter-history-partial-and-modal', status: 'failed' };
        report.scenarios.push(scenario);
        const state = createState();
        state.quoteFailure = true;
        const context = await browser.newContext({ viewport: viewports[0] });
        await initializeTheme('light', async (targetContext) => {
            await targetContext.addInitScript(() => {
                localStorage.setItem('signal-research-density-v1', 'compact');
                localStorage.setItem('signal-research-saved-layouts-v1', JSON.stringify([{
                    id: 'phase1-saved-view', name: 'Phase 1 saved view', savedAt: '2026-08-16T00:00:00.000Z',
                    workspace: 'research', query: 'NVDA', market: 'US', action: 'ALL', ticker: 'NVDA', tab: 'valuation', density: 'compact',
                }]));
            });
        })(context);
        const page = await preparePage(context, state);
        try {
            await page.goto(`${baseUrl}/research?workspace=research&ticker=MSFT&future=keep&density=broken`, { waitUntil: 'domcontentloaded' });
            await page.getByTestId('research-readiness-next').waitFor({ state: 'visible' });
            await page.getByTestId('research-quote-status').waitFor({ state: 'visible' });
            check((await page.getByTestId('research-quote-status').textContent())?.includes('Saved research remains visible'), 'Partial quote failure was not scoped to the watchlist owner');
            check(await page.getByRole('tab', { name: 'Overview' }).isVisible(), 'Saved Research became unusable after quote failure');
            await page.waitForURL((url) => url.searchParams.get('density') === 'compact' && url.searchParams.get('future') === 'keep');
            check(await page.locator('main[data-density="compact"]').isVisible(), 'Malformed URL density did not recover from saved preference');

            const search = page.getByRole('searchbox', { name: 'Ticker search' });
            const historyBefore = await page.evaluate(() => history.length);
            await search.fill('N');
            await search.fill('NV');
            await search.fill('NVDA');
            await page.waitForURL((url) => url.searchParams.get('query') === 'NVDA');
            check(await page.evaluate(() => history.length) === historyBefore, 'Filter typing added browser-history entries');
            const hidden = page.getByTestId('research-selected-hidden');
            await hidden.waitFor({ state: 'visible' });
            check((await hidden.textContent())?.includes('MSFT · Hidden by current filters'), 'Filtering silently replaced or failed to announce the selected security');
            check(await page.locator('#research-detail').getByRole('heading', { name: 'MSFT' }).isVisible(), 'Filtered selection no longer owns the detail');

            await search.fill('zz-no-match');
            await page.getByTestId('research-no-results').waitFor({ state: 'visible' });
            check((await page.getByTestId('research-no-results').textContent())?.includes('Active filters:'), 'Zero results do not disclose active filters');
            await page.getByTestId('research-no-results').getByRole('button', { name: 'Clear filters' }).click();
            await page.waitForURL((url) => !url.searchParams.has('query') && !url.searchParams.has('market') && !url.searchParams.has('decision'));

            const explicitHistory = await page.evaluate(() => history.length);
            await page.getByTestId('research-watchlist-owner').getByRole('button', { name: /NVDA/ }).click();
            await page.waitForURL((url) => url.searchParams.get('ticker') === 'NVDA');
            check(await page.evaluate(() => history.length) === explicitHistory + 1, 'Explicit ticker selection did not push history');
            await page.goBack();
            await page.waitForURL((url) => url.searchParams.get('ticker') === 'MSFT');
            await page.goForward();
            await page.waitForURL((url) => url.searchParams.get('ticker') === 'NVDA');

            const views = page.getByText('Views & density', { exact: true });
            await views.click();
            await page.getByRole('button', { name: 'Phase 1 saved view', exact: true }).click();
            await page.waitForURL((url) => url.searchParams.get('ticker') === 'NVDA' && url.searchParams.get('tab') === 'valuation' && url.searchParams.get('future') === 'keep');

            const trigger = page.getByRole('button', { name: 'Open command palette' });
            await trigger.focus();
            await page.keyboard.press('Control+K');
            const dialog = page.getByRole('dialog', { name: 'Signal command palette' });
            await dialog.waitFor({ state: 'visible' });
            const modalState = await page.evaluate(() => ({
                bodyOverflow: document.body.style.overflow,
                backgroundInert: document.querySelector('[data-testid="research-v7"] > div')?.inert ?? false,
                backgroundHidden: document.querySelector('[data-testid="research-v7"] > div')?.getAttribute('aria-hidden'),
            }));
            check(modalState.bodyOverflow === 'hidden' && modalState.backgroundInert && modalState.backgroundHidden === 'true', 'Command palette did not make and hide the inert background or lock scrolling');
            const focusables = dialog.locator('button:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])');
            await focusables.first().focus();
            await page.keyboard.press('Shift+Tab');
            check(await focusables.last().evaluate((node) => node === document.activeElement), 'Shift+Tab escaped the command palette');
            await page.keyboard.press('Tab');
            check(await focusables.first().evaluate((node) => node === document.activeElement), 'Tab did not loop inside the command palette');
            await page.keyboard.press('Escape');
            check(await dialog.count() === 0 && await trigger.evaluate((node) => node === document.activeElement), 'Escape did not close the palette and restore trigger focus');

            check(state.mutations.length === 0, `Phase 1 interactions emitted Research mutations: ${state.mutations.join(', ')}`);
            check(!state.requestUrls.some((url) => url.includes('PRIVATE_THESIS_SENTINEL')), 'Authored Research content entered a request URL');
            check(state.blocking.length === 0, state.blocking.join(' | '));
            scenario.status = 'passed';
        } catch (error) {
            scenario.error = error instanceof Error ? error.message : String(error);
            report.failures.push(`${scenario.name}: ${scenario.error}`);
        } finally {
            await context.close();
        }
    }

    {
        const scenario = { name: 'reduced-motion-and-route-compatibility', status: 'failed' };
        report.scenarios.push(scenario);
        const state = createState();
        state.signalDelay = 450;
        const context = await browser.newContext({ viewport: viewports[2], reducedMotion: 'reduce', hasTouch: true });
        await initializeTheme('dark', async (targetContext) => {
            await targetContext.addInitScript(() => {
                window.__phase1ScrollBehaviors = [];
                const original = Element.prototype.scrollIntoView;
                Element.prototype.scrollIntoView = function scrollIntoView(options) {
                    window.__phase1ScrollBehaviors.push(typeof options === 'object' ? options.behavior ?? 'auto' : 'auto');
                    return original.call(this, options);
                };
            });
        })(context);
        const page = await preparePage(context, state);
        try {
            await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
            const skeleton = page.getByLabel('Loading market conditions');
            await skeleton.waitFor({ state: 'visible' });
            const duration = await skeleton.locator('span').first().evaluate((node) => getComputedStyle(node).animationDuration);
            check(duration === '0.00001s' || duration === '1e-05s' || duration === '0s', `Reduced motion retained skeleton pulse (${duration})`);
            await page.locator('#market-posture-v7').waitFor({ state: 'visible' });
            await page.getByRole('link', { name: /Freshness concern/ }).tap();
            await page.waitForFunction(() => document.activeElement?.id === 'market-trust-limitations');
            check((await page.evaluate(() => window.__phase1ScrollBehaviors)).every((behavior) => behavior === 'auto'), 'Reduced motion retained automatic smooth scrolling');

            for (const [route, testId] of [['/', 'market-v7'], ['/main-v7', 'market-v7'], ['/research', 'research-v7'], ['/research-v7', 'research-v7']]) {
                state.signalDelay = 0;
                await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
                await page.getByTestId(testId).waitFor({ state: 'visible' });
            }
            await page.goto(`${baseUrl}/main-v6`, { waitUntil: 'domcontentloaded' });
            await page.locator('#market-story-title').waitFor({ state: 'visible' });
            await page.goto(`${baseUrl}/research-v6?workspace=research&ticker=MSFT`, { waitUntil: 'domcontentloaded' });
            await page.locator('#research-detail').waitFor({ state: 'visible' });
            check(await page.getByTestId('research-v7').count() === 0, 'Research V6 rollback route was replaced by V7');
            check(state.blocking.length === 0, state.blocking.join(' | '));
            scenario.status = 'passed';
        } catch (error) {
            scenario.error = error instanceof Error ? error.message : String(error);
            report.failures.push(`${scenario.name}: ${scenario.error}`);
        } finally {
            await context.close();
        }
    }
} finally {
    await browser.close();
}

await writeFile(path.join(artifactDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
for (const scenario of report.scenarios) console.log(`${scenario.status === 'passed' ? 'PASS' : 'FAIL'} ${scenario.name}${scenario.error ? `: ${scenario.error}` : ''}`);
console.log(`Evidence: ${artifactDirectory}`);
if (report.failures.length > 0) process.exitCode = 1;
else console.log('V7 Phase 1 interaction QA passed.');
