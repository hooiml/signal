import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const argument = (name, fallback = null) => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
};

const baseUrl = argument('--base-url', process.env.SIGNAL_QA_URL ?? 'http://127.0.0.1:3000');
const requestedViewport = argument('--viewport');
const viewports = requestedViewport
    ? [{ width: Number(requestedViewport), height: Number(argument('--height', '900')) }]
    : [{ width: 1440, height: 1000 }, { width: 360, height: 800 }, { width: 390, height: 844 }, { width: 430, height: 932 }];
const timeout = 20_000;
const baseOrigin = new URL(baseUrl).origin;
const artifactDirectory = path.resolve('.tmp', 'research-phase12-qa', new Date().toISOString().replace(/[.:]/g, '-'));
await mkdir(artifactDirectory, { recursive: true });

const checklist = {
    understandBusiness: false,
    revenueGrowingOrStable: false,
    marginsHealthyOrImproving: false,
    debtManageable: false,
    freeCashFlowPositiveOrImproving: false,
    valuationReasonable: false,
    catalystOrCompoundingReason: false,
    downsideAcceptable: false,
    betterThanCashOrIndex: false,
};

const createRecord = (symbol, companyName) => ({
    symbol,
    market: 'US',
    companyName,
    positionState: 'not-owned',
    inBuyZone: false,
    status: 'watch',
    targetBuyZone: '',
    valuationState: 'unknown',
    thesisStrength: 'medium',
    whyInterested: '',
    bullCase: '',
    bearCase: '',
    buyTrigger: '',
    sellTrigger: '',
    thesisBreak: '',
    notes: '',
    checklist,
    monitoringRules: {
        buyZone: true,
        belowMa200: true,
        rsiBelow: 30,
        rsiAbove: null,
        earningsWithinDays: 21,
        reviewAgeDays: 30,
        structuredTriggers: { version: 1, migrationState: 'current', rules: [] },
    },
    acceptedEvidence: [],
    documentEvidence: { version: 1, migrationState: 'current', citations: [] },
    factorAssumptions: { version: 1, migrationState: 'current', assumptions: [] },
    decisionJournal: {
        decision: 'Watch',
        confidence: 'medium',
        observedPrice: null,
        benchmarkLabel: null,
        benchmarkReturnPercent: null,
        nextReviewAt: null,
        priorReviewId: null,
        priorOutcome: 'unresolved',
        outcomeNote: '',
    },
    positionPlan: { plannedAllocationPercent: null, averageCost: null, plannedEntryPrice: null, invalidationPrice: null },
    reviewHistory: [],
    lastReviewedAt: '2026-08-29',
    updatedAt: '2026-08-29T00:00:00.000Z',
    revision: 1,
});

const records = [createRecord('MSFT', 'Microsoft'), createRecord('NVDA', 'NVIDIA')];

const createValuationPlan = (ticker) => ({
    ticker,
    currentEps: null,
    years: 5,
    annualDiscountRatePct: 10,
    scenarios: [
        { id: 'bear', label: 'Bear', currentEps: 1, epsCagrPct: 4, terminalPe: 20, years: 5, annualDiscountRatePct: 10 },
        { id: 'base', label: 'Base', currentEps: 1, epsCagrPct: 10, terminalPe: 25, years: 5, annualDiscountRatePct: 10 },
        { id: 'bull', label: 'Bull', currentEps: 1, epsCagrPct: 16, terminalPe: 30, years: 5, annualDiscountRatePct: 10 },
    ],
    updatedAt: '2026-08-30T08:00:00.000Z',
});

const createSnapshot = (symbol) => ({
    symbol,
    market: 'US',
    fetchedAt: '2026-08-30T08:00:00.000Z',
    benchmark: {
        baselineSymbol: 'VOO',
        baselineName: 'Vanguard S&P 500 ETF',
        period: '1Y',
        candidateReturnPercent: null,
        baselineReturnPercent: null,
        relativeReturnPercent: null,
        returnBasis: null,
        status: 'unavailable',
    },
    quote: {
        name: symbol === 'NVDA' ? 'NVIDIA' : symbol === 'VOO' ? 'Vanguard S&P 500 ETF' : 'Microsoft',
        currency: 'USD',
        price: symbol === 'NVDA' ? 182 : symbol === 'VOO' ? 610 : 425,
        dailyChangePercent: 0.5,
    },
    fundamentals: {
        revenueGrowthPercent: null,
        grossMarginPercent: null,
        operatingMarginPercent: null,
        freeCashFlow: null,
        debt: null,
        cash: null,
        shares: null,
        annualRevenue: null,
        annualNetIncome: null,
        reportingPeriod: null,
        shareChangePercent: null,
        source: null,
        history: [],
    },
    valuation: {
        marketCap: null,
        priceEarnings: null,
        priceSales: null,
        freeCashFlowYieldPercent: null,
        netCash: null,
        reportingPeriod: null,
        source: null,
    },
    technicals: {
        ma50: null,
        ma200: null,
        rsi14: null,
        macd: null,
        low52Week: null,
        high52Week: null,
        averageVolume20: null,
        support: null,
        resistance: null,
    },
    chart: { interval: '1d', points: [] },
    sources: ['Yahoo Finance'],
    warnings: [],
});

const failures = [];
const browser = await chromium.launch({ headless: true });

try {
    for (const viewport of viewports) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        const blocking = [];
        const memoryRequests = [];
        const reviewRequests = [];
        let watchlistRequestCount = 0;
        let symbolRequestCount = 0;

        page.on('console', (message) => {
            if (message.type() === 'error') blocking.push(`console: ${message.text()}`);
        });
        page.on('pageerror', (error) => blocking.push(`pageerror: ${error.message}`));
        page.on('requestfailed', (request) => {
            if (!request.failure()?.errorText.includes('ERR_ABORTED')) {
                blocking.push(`requestfailed: ${request.method()} ${new URL(request.url()).pathname}`);
            }
        });
        page.on('response', (response) => {
            const url = new URL(response.url());
            if (url.origin === baseOrigin && response.status() >= 400) blocking.push(`HTTP ${response.status()} ${url.pathname}`);
        });

        await page.route('**/api/research/**', async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            if (url.pathname === '/api/research/watchlist') {
                watchlistRequestCount += 1;
                await new Promise((resolve) => setTimeout(resolve, 150));
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: records, archivedSymbols: [] }) });
            }
            if (url.pathname === '/api/research/inbox') {
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { generatedAt: '2026-08-30T08:00:00.000Z', monitoredCount: records.length, items: [], warnings: [] } }) });
            }
            if (url.pathname.startsWith('/api/research/symbol/')) {
                symbolRequestCount += 1;
                await new Promise((resolve) => setTimeout(resolve, 250));
                const symbol = decodeURIComponent(url.pathname.split('/').at(-1));
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: createSnapshot(symbol) }) });
            }
            if (url.pathname.startsWith('/api/research/memory/')) {
                const symbol = decodeURIComponent(url.pathname.split('/').at(-1));
                memoryRequests.push(`${request.method()} ${symbol}`);
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: request.method() === 'GET' ? [] : { saved: true } }) });
            }
            if (url.pathname.startsWith('/api/research/expectations/')) {
                const symbol = decodeURIComponent(url.pathname.split('/').at(-1));
                reviewRequests.push(`${request.method()} expectations ${symbol}`);
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
            }
            if (url.pathname.startsWith('/api/research/valuation-plan/')) {
                const symbol = decodeURIComponent(url.pathname.split('/').at(-1));
                reviewRequests.push(`${request.method()} valuation ${symbol}`);
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: createValuationPlan(symbol) }) });
            }
            if (url.pathname.startsWith('/api/research/calibration/')) {
                const symbol = decodeURIComponent(url.pathname.split('/').at(-1));
                reviewRequests.push(`${request.method()} decision-review ${symbol}`);
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
            }
            if (url.pathname === '/api/research/quotes') {
                const requested = request.postDataJSON();
                const data = Array.isArray(requested)
                    ? requested.map(({ symbol }) => ({ symbol, success: true, data: { symbol, quote: createSnapshot(symbol).quote } }))
                    : [];
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
            }
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
        });

        try {
            await page.goto(`${baseUrl}/research?workspace=research&ticker=MSFT`, { waitUntil: 'domcontentloaded', timeout });
            const memory = page.getByTestId('research-memory-dock');
            await memory.getByText('Building decision memory for MSFT…').waitFor({ state: 'visible', timeout });
            await memory.getByRole('heading', { name: 'MSFT · What changed and what needs review' }).waitFor({ state: 'visible', timeout });
            if (await memory.count() !== 1) throw new Error('Decision Memory did not render exactly once after delayed mounting');
            if (!memoryRequests.includes('GET MSFT') || !memoryRequests.includes('POST MSFT')) throw new Error(`MSFT memory persistence path was incomplete: ${memoryRequests.join(', ')}`);

            const tickerPicker = page.getByTestId('research-mobile-ticker-selector').locator('select');
            await tickerPicker.selectOption('NVDA', { force: true });
            await page.waitForURL((url) => url.searchParams.get('ticker') === 'NVDA', { timeout });
            await memory.getByRole('heading', { name: 'NVDA · What changed and what needs review' }).waitFor({ state: 'visible', timeout });
            if (await memory.count() !== 1) throw new Error('Ticker change created a duplicate Decision Memory surface');
            if (!memoryRequests.includes('GET NVDA') || !memoryRequests.includes('POST NVDA')) throw new Error(`NVDA memory persistence path was incomplete: ${memoryRequests.join(', ')}`);
            const replayLink = memory.getByRole('link', { name: 'Open replay' });
            await replayLink.focus();
            const focusState = await replayLink.evaluate((node) => {
                const style = getComputedStyle(node);
                return { active: document.activeElement === node, outlineStyle: style.outlineStyle, outlineWidth: Number.parseFloat(style.outlineWidth) };
            });
            if (!focusState.active || focusState.outlineStyle === 'none' || focusState.outlineWidth < 1) {
                throw new Error(`Decision Memory keyboard focus is not visible: ${JSON.stringify(focusState)}`);
            }

            if (viewport.width >= 700) {
                await page.getByRole('button', { name: 'Today', exact: true }).click();
            } else {
                await page.locator('select[aria-label="Research section"]').selectOption('today');
            }
            await page.waitForURL((url) => url.searchParams.get('workspace') === 'today', { timeout });
            if (await memory.count() !== 0) throw new Error('Decision Memory remained mounted outside the selected-security workspace');
            await page.goBack({ waitUntil: 'domcontentloaded' });
            await memory.getByRole('heading', { name: 'NVDA · What changed and what needs review' }).waitFor({ state: 'visible', timeout });
            if (await memory.count() !== 1) throw new Error('Back navigation duplicated Decision Memory');
            if (new URL(page.url()).searchParams.get('ticker') !== 'NVDA') throw new Error('Back navigation did not preserve the selected ticker');

            await tickerPicker.selectOption('VOO', { force: true });
            await page.waitForURL((url) => url.searchParams.get('ticker') === 'VOO', { timeout });
            await memory.getByText('Save this security to Research before Signal can build persistent decision memory for it.').waitFor({ state: 'visible', timeout });
            if (await memory.count() !== 1) throw new Error('Unsaved state did not retain exactly one Decision Memory surface');

            const layout = await page.evaluate(() => ({
                documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                memoryCount: document.querySelectorAll('[data-testid="research-memory-dock"]').length,
            }));
            if (layout.documentOverflow > 1) throw new Error(`page-level horizontal overflow detected (${layout.documentOverflow}px)`);
            if (layout.memoryCount !== 1) throw new Error(`DOM contains ${layout.memoryCount} Decision Memory surfaces`);
            if (blocking.length > 0) throw new Error(blocking.join(' | '));

            await page.screenshot({ path: path.join(artifactDirectory, `ux-001-${viewport.width}x${viewport.height}.png`), fullPage: true });
            console.log(`PASS UX-001 Decision Memory ${viewport.width}x${viewport.height}`);

            await tickerPicker.selectOption('MSFT', { force: true });
            await page.waitForURL((url) => url.searchParams.get('ticker') === 'MSFT', { timeout });
            const reviewTools = page.getByTestId('research-review-tools');
            await reviewTools.waitFor({ state: 'visible', timeout });
            await reviewTools.getByRole('heading', { name: 'Review tools' }).waitFor({ state: 'visible', timeout });

            await page.evaluate(() => window.scrollTo(0, 0));
            const selectedSecurity = page.locator('#research-detail');
            await selectedSecurity.getByRole('heading', { name: 'MSFT', exact: true }).waitFor({ state: 'visible', timeout });
            const selectedSecurityBox = await selectedSecurity.boundingBox();
            if (!selectedSecurityBox) throw new Error('selected-security summary has no visible layout box');
            if (viewport.width === 1440 && selectedSecurityBox.y > 600) throw new Error(`selected-security summary starts at ${selectedSecurityBox.y}px, below the 600px desktop limit`);
            const primaryOrder = await page.evaluate(() => {
                const detail = document.querySelector('#research-detail');
                const tools = document.querySelector('[data-testid="research-review-tools"]');
                return Boolean(detail && tools && (detail.compareDocumentPosition(tools) & Node.DOCUMENT_POSITION_FOLLOWING));
            });
            if (!primaryOrder) throw new Error('selected-security research does not precede Review Tools in DOM order');
            if ((await page.getByTestId('expectation-reality').count()) + (await page.getByTestId('valuation-reasoning-v9').count()) + (await page.getByTestId('decision-calibration-v10').count()) !== 0) throw new Error('a full review form is expanded by default');
            await reviewTools.scrollIntoViewIfNeeded();
            if (viewport.width === 390) await reviewTools.getByText('Selected security · MSFT').waitFor({ state: 'visible', timeout });
            await page.screenshot({ path: path.join(artifactDirectory, `ux-002-${viewport.width}x${viewport.height}.png`), fullPage: true });
            console.log(`PASS UX-002 Selected Security ${viewport.width}x${viewport.height}`);

            const initialReviewState = await page.evaluate(() => ({
                shellCount: document.querySelectorAll('[data-testid="research-review-tools"]').length,
                memoryCount: document.querySelectorAll('[data-testid="research-memory-dock"]').length,
                expectationCount: document.querySelectorAll('[data-testid="expectation-reality"]').length,
                valuationCount: document.querySelectorAll('[data-testid="valuation-reasoning-v9"]').length,
                decisionCount: document.querySelectorAll('[data-testid="decision-calibration-v10"]').length,
                portalSlotCount: document.querySelectorAll('[data-testid$="-slot"]').length,
                controls: Array.from(document.querySelectorAll('[data-review-tool-control]')).map((node) => node.getAttribute('data-review-tool-control')),
                expandedCount: document.querySelectorAll('[data-review-tool-control][aria-expanded="true"]').length,
                followsBriefing: (() => {
                    const briefing = document.querySelector('[data-testid="since-last-visit"]');
                    const shell = document.querySelector('[data-testid="research-review-tools"]');
                    return Boolean(briefing && shell && (briefing.compareDocumentPosition(shell) & Node.DOCUMENT_POSITION_FOLLOWING));
                })(),
            }));
            if (initialReviewState.shellCount !== 1) throw new Error(`expected one Review Tools shell, found ${initialReviewState.shellCount}`);
            if (initialReviewState.memoryCount !== 1 || initialReviewState.expectationCount + initialReviewState.valuationCount + initialReviewState.decisionCount !== 0) throw new Error(`default Review Tools mount is not Decision Memory only: ${JSON.stringify(initialReviewState)}`);
            if (initialReviewState.portalSlotCount !== 0) throw new Error(`found ${initialReviewState.portalSlotCount} legacy portal slots`);
            if (initialReviewState.controls.join(',') !== 'memory,expectations,valuation,decision-review') throw new Error(`review control order is not deterministic: ${initialReviewState.controls.join(',')}`);
            if (initialReviewState.expandedCount !== 1 || !initialReviewState.followsBriefing) throw new Error(`Review Tools disclosure/source order failed: ${JSON.stringify(initialReviewState)}`);
            if (reviewRequests.length !== 0) throw new Error(`inactive review tools made API calls: ${reviewRequests.join(', ')}`);

            const expectationControl = reviewTools.getByRole('button', { name: /Expectation vs Reality/ });
            await expectationControl.click();
            await page.getByTestId('expectation-reality').waitFor({ state: 'visible', timeout });
            if ((await page.getByTestId('research-memory-dock').count()) !== 0 || (await page.getByTestId('expectation-reality').count()) !== 1) throw new Error('Expectation activation did not mount exactly one tool');
            if (reviewRequests.join(',') !== 'GET expectations MSFT') throw new Error(`Expectation activation called unexpected APIs: ${reviewRequests.join(', ')}`);

            const sharedRequestsBeforeValuation = { watchlistRequestCount, symbolRequestCount };
            await reviewTools.getByRole('button', { name: /Valuation/ }).click();
            const valuation = page.getByTestId('valuation-reasoning-v9');
            await valuation.waitFor({ state: 'visible', timeout });
            await valuation.getByText('$425').waitFor({ state: 'visible', timeout });
            if ((await page.getByTestId('expectation-reality').count()) !== 0 || (await valuation.count()) !== 1) throw new Error('Valuation activation did not replace the prior tool');
            if (!reviewRequests.includes('GET valuation MSFT')) throw new Error(`Valuation API was not called: ${reviewRequests.join(', ')}`);
            if (watchlistRequestCount !== sharedRequestsBeforeValuation.watchlistRequestCount || symbolRequestCount !== sharedRequestsBeforeValuation.symbolRequestCount) throw new Error('Valuation independently refetched dashboard-owned Research state');

            const sharedRequestsBeforeDecisionReview = { watchlistRequestCount, symbolRequestCount };
            await reviewTools.getByRole('button', { name: /Decision review/ }).click();
            const decisionReview = page.getByTestId('decision-calibration-v10');
            await decisionReview.waitFor({ state: 'visible', timeout });
            if ((await valuation.count()) !== 0 || (await decisionReview.count()) !== 1) throw new Error('Decision review activation did not replace the prior tool');
            if (!reviewRequests.includes('GET decision-review MSFT')) throw new Error(`Decision review API was not called: ${reviewRequests.join(', ')}`);
            if (watchlistRequestCount !== sharedRequestsBeforeDecisionReview.watchlistRequestCount || symbolRequestCount !== sharedRequestsBeforeDecisionReview.symbolRequestCount) throw new Error('Decision review independently refetched dashboard-owned Research state');

            const decisionControl = reviewTools.getByRole('button', { name: /Decision review/ });
            await decisionControl.focus();
            await page.keyboard.press('Tab');
            await page.keyboard.press('Shift+Tab');
            const reviewFocusState = await decisionControl.evaluate((node) => {
                const style = getComputedStyle(node);
                return { active: document.activeElement === node, outlineStyle: style.outlineStyle, outlineWidth: Number.parseFloat(style.outlineWidth) };
            });
            if (!reviewFocusState.active || reviewFocusState.outlineStyle === 'none' || reviewFocusState.outlineWidth < 1) throw new Error(`Review Tools keyboard focus is not visible: ${JSON.stringify(reviewFocusState)}`);

            await tickerPicker.selectOption('NVDA', { force: true });
            await page.waitForURL((url) => url.searchParams.get('ticker') === 'NVDA', { timeout });
            await decisionReview.getByText('Complete and save at least one Research review before calibrating your decision process.').waitFor({ state: 'visible', timeout });
            if (!reviewRequests.includes('GET decision-review NVDA')) throw new Error(`active Decision review did not follow ticker state: ${reviewRequests.join(', ')}`);
            if ((await reviewTools.locator('[data-active-review-tool="decision-review"]').count()) !== 1) throw new Error('active review tool was not preserved across ticker change');

            const reviewLayout = await page.evaluate(() => ({
                documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                shellCount: document.querySelectorAll('[data-testid="research-review-tools"]').length,
                activePanelCount: ['research-memory-dock', 'expectation-reality', 'valuation-reasoning-v9', 'decision-calibration-v10']
                    .reduce((count, testid) => count + document.querySelectorAll(`[data-testid="${testid}"]`).length, 0),
                expandedCount: document.querySelectorAll('[data-review-tool-control][aria-expanded="true"]').length,
            }));
            if (reviewLayout.documentOverflow > 1) throw new Error(`Review Tools caused page-level horizontal overflow (${reviewLayout.documentOverflow}px)`);
            if (reviewLayout.shellCount !== 1 || reviewLayout.activePanelCount !== 1 || reviewLayout.expandedCount !== 1) throw new Error(`Review Tools duplication/disclosure failed: ${JSON.stringify(reviewLayout)}`);
            if (blocking.length > 0) throw new Error(blocking.join(' | '));

            await page.screenshot({ path: path.join(artifactDirectory, `ux-003-${viewport.width}x${viewport.height}.png`), fullPage: true });
            console.log(`PASS UX-003 Review Tools ${viewport.width}x${viewport.height}`);

            const sectionControl = page.locator('select[aria-label="Research section"]');
            const topLevelCount = viewport.width >= 700
                ? await page.locator('nav[aria-label="Research sections"] > button').count()
                : await sectionControl.locator('option').count();
            if (topLevelCount !== 6) throw new Error(`expected six top-level Research destinations, found ${topLevelCount}`);

            if (viewport.width >= 700) await page.getByRole('button', { name: 'More', exact: true }).click();
            else await sectionControl.selectOption('more');
            await page.waitForURL((url) => url.searchParams.get('workspace') === 'health', { timeout });
            if (new URL(page.url()).searchParams.get('ticker') !== 'NVDA') throw new Error('selected ticker was lost when opening More');
            const moreLabels = viewport.width >= 700
                ? await page.getByRole('tablist', { name: 'More workspaces' }).getByRole('tab').allTextContents()
                : await page.getByLabel('More workspace').locator('option').allTextContents();
            for (const expected of ['Sources', 'Policy', 'Export', 'Backup', 'Usage']) {
                if (!moreLabels.includes(expected)) throw new Error(`${expected} is not discoverable through More`);
            }

            if (viewport.width >= 700) await page.getByRole('button', { name: 'Today', exact: true }).click();
            else await sectionControl.selectOption('today');
            await page.waitForURL((url) => url.searchParams.get('workspace') === 'today', { timeout });
            if (new URL(page.url()).searchParams.get('ticker') !== 'NVDA') throw new Error('selected ticker was lost when opening Today');
            await page.goBack({ waitUntil: 'domcontentloaded' });
            await page.waitForURL((url) => url.searchParams.get('workspace') === 'health' && url.searchParams.get('ticker') === 'NVDA', { timeout });
            await page.goForward({ waitUntil: 'domcontentloaded' });
            await page.waitForURL((url) => url.searchParams.get('workspace') === 'today' && url.searchParams.get('ticker') === 'NVDA', { timeout });
            const navigationOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
            if (navigationOverflow > 1) throw new Error(`Research navigation caused page-level horizontal overflow (${navigationOverflow}px)`);
            if (blocking.length > 0) throw new Error(blocking.join(' | '));
            await page.screenshot({ path: path.join(artifactDirectory, `ux-004-${viewport.width}x${viewport.height}.png`), fullPage: true });
            console.log(`PASS UX-004 Today Navigation ${viewport.width}x${viewport.height}`);

            if (viewport.width >= 700) await page.getByRole('button', { name: 'Watchlist', exact: true }).click();
            else await sectionControl.selectOption('watchlist');
            await page.waitForURL((url) => url.searchParams.get('workspace') === 'research', { timeout });
            const mobileReviewTools = page.getByTestId('research-review-tools');
            await mobileReviewTools.getByRole('button', { name: /Expectation vs Reality/ }).click();
            const expectationPanel = page.getByTestId('expectation-reality');
            await expectationPanel.waitFor({ state: 'visible', timeout });
            if (viewport.width <= 430) {
                await expectationPanel.locator('[data-testid="expectation-metric-cards"] > tr').first().waitFor({ state: 'visible', timeout });
                const mobileForm = await expectationPanel.evaluate((panel) => ({
                    panelOverflow: panel.scrollWidth - panel.clientWidth,
                    cardCount: panel.querySelectorAll('[data-testid="expectation-metric-cards"] > tr').length,
                    tableHeaderVisible: (() => {
                        const header = panel.querySelector('thead');
                        return header instanceof HTMLElement && getComputedStyle(header).display !== 'none';
                    })(),
                    undersizedControls: Array.from(panel.querySelectorAll('button, input, select, textarea'))
                        .filter((node) => node instanceof HTMLElement && node.getClientRects().length > 0 && node.getBoundingClientRect().height < 43.5)
                        .map((node) => `${node.tagName}:${node.getAttribute('aria-label') ?? node.textContent?.trim() ?? ''}:${node.getBoundingClientRect().height}`),
                    tinyActions: Array.from(panel.querySelectorAll('button, label'))
                        .filter((node) => node instanceof HTMLElement && node.getClientRects().length > 0 && Number.parseFloat(getComputedStyle(node).fontSize) < 12)
                        .map((node) => `${node.tagName}:${node.textContent?.trim() ?? ''}:${getComputedStyle(node).fontSize}`),
                }));
                if (mobileForm.panelOverflow > 1) throw new Error(`Expectation form has ${mobileForm.panelOverflow}px horizontal overflow`);
                if (mobileForm.cardCount < 2 || mobileForm.tableHeaderVisible) throw new Error(`mobile metric cards did not replace the desktop table header: ${JSON.stringify(mobileForm)}`);
                if (mobileForm.undersizedControls.length > 0) throw new Error(`review controls below 44px: ${mobileForm.undersizedControls.join(', ')}`);
                if (mobileForm.tinyActions.length > 0) throw new Error(`actionable labels below 12px: ${mobileForm.tinyActions.join(', ')}`);

                const eventTitle = expectationPanel.getByLabel('Event title');
                await eventTitle.focus();
                await page.keyboard.press('Tab');
                await page.keyboard.press('Shift+Tab');
                const inputFocus = await eventTitle.evaluate((node) => {
                    const style = getComputedStyle(node);
                    return { active: document.activeElement === node, outlineStyle: style.outlineStyle, outlineWidth: Number.parseFloat(style.outlineWidth) };
                });
                if (!inputFocus.active || inputFocus.outlineStyle === 'none' || inputFocus.outlineWidth < 1) throw new Error(`review input focus is not visible: ${JSON.stringify(inputFocus)}`);
            }
            const reviewFormOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
            if (reviewFormOverflow > 1) throw new Error(`review form caused page-level horizontal overflow (${reviewFormOverflow}px)`);
            if (blocking.length > 0) throw new Error(blocking.join(' | '));
            await page.screenshot({ path: path.join(artifactDirectory, `ux-005-${viewport.width}x${viewport.height}.png`), fullPage: true });
            console.log(`PASS UX-005 Mobile Review Forms ${viewport.width}x${viewport.height}`);

            const researchHeadings = await page.evaluate(() => ({
                h1: Array.from(document.querySelectorAll('h1')).map((node) => node.textContent?.trim()),
                levels: Array.from(document.querySelectorAll('h1, h2, h3')).map((node) => Number(node.tagName.slice(1))),
                detailBeforeTools: (() => {
                    const detail = document.querySelector('#research-detail');
                    const tools = document.querySelector('[data-testid="research-review-tools"]');
                    if (!(detail instanceof HTMLElement) || !(tools instanceof HTMLElement)) return false;
                    return Boolean(detail.compareDocumentPosition(tools) & Node.DOCUMENT_POSITION_FOLLOWING)
                        && detail.getBoundingClientRect().top <= tools.getBoundingClientRect().top;
                })(),
            }));
            if (researchHeadings.h1.length !== 1 || researchHeadings.h1[0] !== 'Selected security') throw new Error(`Research exposes invalid page headings: ${JSON.stringify(researchHeadings.h1)}`);
            if (researchHeadings.levels[0] !== 1 || researchHeadings.levels.findIndex((level) => level === 3) < researchHeadings.levels.findIndex((level) => level === 2)) throw new Error(`Research heading hierarchy is invalid: ${researchHeadings.levels.join(',')}`);
            if (!researchHeadings.detailBeforeTools) throw new Error('Research DOM order and visual order diverge');

            if (viewport.width >= 700) {
                const watchlistControl = page.getByRole('button', { name: 'Watchlist', exact: true });
                await watchlistControl.focus();
                await page.keyboard.press('ArrowRight');
                const todayControl = page.getByRole('button', { name: 'Today', exact: true });
                if (!await todayControl.evaluate((node) => document.activeElement === node)) throw new Error('keyboard navigation did not follow the visible top-level order');
            } else {
                await sectionControl.selectOption('today');
            }
            await page.waitForURL((url) => url.searchParams.get('workspace') === 'today', { timeout });
            const todayH1 = await page.locator('h1').allTextContents();
            if (todayH1.length !== 1 || todayH1[0]?.trim() !== 'Today') throw new Error(`Today exposes invalid page headings: ${JSON.stringify(todayH1)}`);

            if (viewport.width >= 700) await page.getByRole('button', { name: 'More', exact: true }).click();
            else await sectionControl.selectOption('more');
            await page.waitForURL((url) => url.searchParams.get('workspace') === 'health', { timeout });
            await page.getByRole('heading', { name: 'Source health and coverage' }).waitFor({ state: 'visible', timeout });
            if (await page.locator('h1').count() !== 1) throw new Error('More workspace exposes duplicate page headings');
            if (blocking.length > 0) throw new Error(blocking.join(' | '));
            await page.screenshot({ path: path.join(artifactDirectory, `ux-006-${viewport.width}x${viewport.height}.png`), fullPage: true });
            console.log(`PASS UX-006 Accessibility Order ${viewport.width}x${viewport.height}`);
        } catch (error) {
            failures.push(`${viewport.width}x${viewport.height}: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            await context.close();
        }
    }
} finally {
    await browser.close();
}

if (failures.length > 0) {
    failures.forEach((failure) => console.error(`FAIL ${failure}`));
    process.exitCode = 1;
} else {
    console.log(`Screenshots: ${artifactDirectory}`);
    console.log('Phase 12 Research QA passed.');
}
