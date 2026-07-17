import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const getArg = (name) => {
    const index = args.indexOf(name);
    if (index >= 0) return args[index + 1];
    const inline = args.find((arg) => arg.startsWith(`${name}=`));
    return inline ? inline.slice(name.length + 1) : undefined;
};

const baseUrl = getArg('--base-url') || process.env.SIGNAL_QA_URL || 'http://127.0.0.1:3000';
const timeout = Number(getArg('--timeout') || 15_000);
const widths = (getArg('--viewport') || '1280,768,375').split(',').map(Number);
const requestedTheme = getArg('--theme');
const captureScreenshots = !args.includes('--no-screenshots');
const screenshotDirectory = getArg('--screenshot-dir') || path.join(process.env.TEMP || process.cwd(), 'signal-research-calendar-qa');
const failures = [];

const check = (condition, message) => {
    if (!condition) throw new Error(message);
};

check(!requestedTheme || requestedTheme === 'light' || requestedTheme === 'dark', '--theme must be light or dark');

const quote = { success: true, data: { quote: { name: 'Microsoft', currency: 'USD', price: 401.1, dailyChangePercent: 1.38 } } };
const snapshot = {
    success: true,
    data: {
        symbol: 'MSFT', market: 'US', fetchedAt: '2026-07-17T08:00:00.000Z',
        benchmark: { baselineSymbol: 'VOO', baselineName: 'Vanguard S&P 500 ETF', period: '1Y', candidateReturnPercent: null, baselineReturnPercent: null, relativeReturnPercent: null, returnBasis: null, status: 'unavailable' },
        quote: quote.data.quote,
        fundamentals: { revenueGrowthPercent: null, grossMarginPercent: null, operatingMarginPercent: null, freeCashFlow: null, debt: null, cash: null, shares: null, annualRevenue: null, annualNetIncome: null, reportingPeriod: null, shareChangePercent: null },
        valuation: { marketCap: null, priceEarnings: null, priceSales: null, freeCashFlowYieldPercent: null, netCash: null, reportingPeriod: null, source: null },
        technicals: { ma50: null, ma200: null, rsi14: null, macd: null, low52Week: null, high52Week: null, averageVolume20: null, support: null, resistance: null },
        chart: { interval: '1d', points: [] }, sources: [], warnings: [],
    },
};

const calendarResponse = (rangeDays, partial = false) => ({
    success: true,
    data: {
        generatedAt: '2026-07-17T08:00:00.000Z', rangeDays, timezone: 'UTC',
        events: [
            { id: 'MSFT-stale-2026-06-09', symbol: 'MSFT', market: 'US', type: 'stale', title: 'Research review is stale', detail: 'The 30-day review deadline passed on 2026-06-09.', source: 'Research journal', sourceDate: '2026-06-09', displayDate: '2026-07-17', timezone: 'UTC', freshness: 'overdue', urgency: 'action', targetHref: '/research?ticker=MSFT&tab=overview&review=edit' },
            { id: 'MSFT-review-2026-07-20', symbol: 'MSFT', market: 'US', type: 'review', title: 'Scheduled research review', detail: 'Review the thesis, valuation, invalidation, and saved decision.', source: 'Research journal', sourceDate: '2026-07-20', displayDate: '2026-07-20', timezone: 'UTC', freshness: 'scheduled', urgency: 'upcoming', targetHref: '/research?ticker=MSFT&tab=overview&review=edit' },
            ...(partial ? [] : [{ id: 'MSFT-earnings-2026-07-22', symbol: 'MSFT', market: 'US', type: 'earnings', title: 'Earnings announcement', detail: 'After market close', source: 'Nasdaq earnings calendar', sourceDate: '2026-07-22', displayDate: '2026-07-22', timezone: 'UTC', freshness: 'scheduled', urgency: 'upcoming', targetHref: '/research?ticker=MSFT&tab=events' }]),
        ], warnings: partial ? ['Upcoming earnings coverage is temporarily unavailable.'] : [],
    },
});

const browser = await chromium.launch({ headless: !args.includes('--headed') });
try {
    if (captureScreenshots) await mkdir(screenshotDirectory, { recursive: true });
    for (const width of widths) {
        const context = await browser.newContext({ viewport: { width, height: width <= 480 ? 812 : 900 } });
        await context.addInitScript((theme) => {
            window.localStorage.setItem('signal-research-calendar-dates-v1', JSON.stringify({ 'MSFT:earnings': '2026-07-21' }));
            if (theme) window.localStorage.setItem('signal-dashboard-theme-v2', theme);
        }, requestedTheme);
        const page = await context.newPage();
        let calendarMode = 'success';
        let expectedCalendarError = false;
        let calendarRequestCount = 0;
        const issues = [];
        const researchMutations = [];
        page.on('console', (message) => {
            if (message.type() !== 'error') return;
            if (expectedCalendarError && message.text().includes('Failed to load resource')) return;
            issues.push(`console: ${message.text()}`);
        });
        page.on('pageerror', (error) => issues.push(`page: ${error.message}`));
        page.on('requestfailed', (request) => {
            if (!(request.failure()?.errorText || '').includes('ERR_ABORTED')) issues.push(`request: ${request.url()} ${request.failure()?.errorText || ''}`);
        });
        await page.route('**/api/research/watchlist', (route) => {
            if (route.request().method() !== 'GET') researchMutations.push(`${route.request().method()} ${route.request().url()}`);
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [], archivedSymbols: [] }) });
        });
        await page.route('**/api/research/watchlist/**', (route) => {
            if (route.request().method() !== 'GET') researchMutations.push(`${route.request().method()} ${route.request().url()}`);
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: null }) });
        });
        await page.route('**/api/research/quote/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(quote) }));
        await page.route('**/api/research/inbox', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { generatedAt: '2026-07-17T08:00:00.000Z', monitoredCount: 6, items: [], warnings: [] } }) }));
        await page.route('**/api/research/symbol/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(snapshot) }));
        await page.route('**/api/research/calendar**', (route) => {
            calendarRequestCount += 1;
            const rangeDays = new URL(route.request().url()).searchParams.get('range') === '90' ? 90 : 30;
            if (calendarMode === 'error') return route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Calendar provider unavailable.' }) });
            const respond = async () => {
                if (calendarRequestCount === 1) await new Promise((resolve) => setTimeout(resolve, 150));
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(calendarResponse(rangeDays, calendarMode === 'partial')) });
            };
            return respond();
        });
        try {
            await page.goto(`${baseUrl}/research?workspace=calendar`, { waitUntil: 'domcontentloaded', timeout });
            await page.getByRole('tab', { name: 'Calendar', exact: true }).waitFor({ state: 'visible', timeout });
            check(await page.getByRole('tab', { name: 'Calendar', exact: true }).getAttribute('aria-selected') === 'true', `${width}: Calendar workspace was not restored`);
            await page.getByRole('heading', { name: 'Catalyst and review calendar' }).waitFor({ state: 'visible', timeout });
            await page.getByRole('status').getByText('Loading catalyst and review dates...').waitFor({ state: 'visible', timeout });
            check(await page.getByText(/UTC source dates · generated/).isVisible(), `${width}: UTC disclosure missing`);
            await page.waitForFunction(() => document.querySelectorAll('[data-calendar-event]').length === 3, undefined, { timeout });
            await page.waitForLoadState('networkidle', { timeout });
            check(await page.locator('[data-calendar-event]').count() === 3, `${width}: expected three calendar events`);
            check(calendarRequestCount === 1, `${width}: initial load made ${calendarRequestCount} calendar requests`);
            await page.getByText('Date changed from 2026-07-21 UTC').waitFor({ state: 'visible', timeout });
            check(await page.getByRole('button', { name: '30 days' }).getAttribute('aria-pressed') === 'true', `${width}: thirty-day range is not selected`);

            await page.getByRole('button', { name: 'Calendar view' }).focus();
            await page.keyboard.press('Enter');
            await page.locator('[data-calendar-day]').first().waitFor({ state: 'visible', timeout });
            await page.locator('[data-calendar-month-label]').getByText('July 2026', { exact: true }).waitFor({ state: 'visible', timeout });
            check(await page.getByRole('button', { name: 'Previous month' }).isDisabled(), `${width}: previous month should be bounded at today`);
            await page.getByRole('button', { name: 'Next month' }).focus();
            await page.keyboard.press('Enter');
            await page.locator('[data-calendar-month-label]').getByText('August 2026', { exact: true }).waitFor({ state: 'visible', timeout });
            check(await page.getByRole('button', { name: 'Next month' }).isDisabled(), `${width}: next month should stop at the end of the thirty-day range`);
            await page.getByRole('button', { name: 'Today' }).click();
            await page.locator('[data-calendar-month-label]').getByText('July 2026', { exact: true }).waitFor({ state: 'visible', timeout });
            check(await page.locator('[data-calendar-week]').count() > 0, `${width}: compact week rows are missing`);
            check(await page.locator('[data-calendar-event-chip]').count() === 3, `${width}: calendar view does not show all events inside their dates`);
            const compactGeometry = await page.evaluate(() => {
                const cells = [...(document.querySelector('[data-calendar-week]')?.children ?? [])].map((cell) => cell.getBoundingClientRect().width);
                const chips = [...document.querySelectorAll('[data-calendar-event-chip]')].map((chip) => chip.getBoundingClientRect().height);
                const fontWeight = (selector) => Number.parseInt(getComputedStyle(document.querySelector(selector)).fontWeight, 10);
                return {
                    cellWidthSpread: cells.length > 0 ? Math.max(...cells) - Math.min(...cells) : Number.POSITIVE_INFINITY,
                    tallestChip: chips.length > 0 ? Math.max(...chips) : Number.POSITIVE_INFINITY,
                    monthWeight: fontWeight('[data-calendar-month-label]'),
                    weekdayWeight: fontWeight('[data-calendar-grid] > div > div'),
                    dateWeight: fontWeight('[data-calendar-day] time'),
                    eventWeight: fontWeight('[data-calendar-event-chip] span > span:first-child'),
                    headingWeight: fontWeight('#research-calendar-title'),
                    filterWeight: fontWeight('[aria-label="Calendar market"]'),
                };
            });
            check(compactGeometry.cellWidthSpread <= 2, `${width}: calendar day columns are uneven`);
            check(compactGeometry.tallestChip <= 32, `${width}: compact event bar is too tall (${compactGeometry.tallestChip}px)`);
            check(compactGeometry.monthWeight <= 600, `${width}: month label is too heavy (${compactGeometry.monthWeight})`);
            check(compactGeometry.weekdayWeight <= 600, `${width}: weekday label is too heavy (${compactGeometry.weekdayWeight})`);
            check(compactGeometry.dateWeight <= 600, `${width}: date label is too heavy (${compactGeometry.dateWeight})`);
            check(compactGeometry.eventWeight <= 500, `${width}: event label is too heavy (${compactGeometry.eventWeight})`);
            check(compactGeometry.headingWeight <= 500, `${width}: calendar heading is too heavy (${compactGeometry.headingWeight})`);
            check(compactGeometry.filterWeight <= 500, `${width}: calendar filter is too heavy (${compactGeometry.filterWeight})`);
            if (captureScreenshots) await page.locator('section[aria-labelledby="research-calendar-title"]').screenshot({ path: path.join(screenshotDirectory, `compact-calendar-${width}.png`) });
            await page.getByRole('button', { name: 'List view' }).focus();
            await page.keyboard.press('Enter');
            await page.getByLabel('Event type').selectOption('earnings');
            check(await page.locator('[data-calendar-event]').count() === 1, `${width}: event-type filter did not reduce the list`);
            await page.getByLabel('Event type').selectOption('ALL');
            await page.getByLabel('Calendar market').selectOption('MY');
            await page.getByRole('heading', { name: 'No events in this view' }).waitFor({ state: 'visible', timeout });
            await page.getByLabel('Calendar market').selectOption('ALL');

            calendarMode = 'error';
            expectedCalendarError = true;
            await page.getByRole('button', { name: '90 days' }).click();
            await page.getByRole('alert').getByText('Calendar provider unavailable.').waitFor({ state: 'visible', timeout });
            expectedCalendarError = false;
            calendarMode = 'partial';
            await page.getByRole('button', { name: 'Retry' }).click();
            await page.getByText('Upcoming earnings coverage is temporarily unavailable.').waitFor({ state: 'visible', timeout });
            await page.waitForFunction(() => document.querySelectorAll('[data-calendar-event]').length === 2, undefined, { timeout });
            calendarMode = 'success';
            await page.getByRole('button', { name: '30 days' }).click();
            await page.waitForFunction(() => document.querySelectorAll('[data-calendar-event]').length === 3, undefined, { timeout });

            const documentWidth = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
            check(documentWidth <= width + 1, `${width}: document horizontally overflows (${documentWidth}px)`);

            await page.getByRole('tab', { name: 'Research', exact: true }).click();
            await page.getByRole('searchbox').fill('NVDA');
            await page.getByRole('tab', { name: 'Calendar', exact: true }).click();
            await page.waitForFunction(() => document.querySelectorAll('[data-calendar-event]').length === 3, undefined, { timeout });
            await page.getByRole('button', { name: /Open MSFT review workflow/i }).first().click();
            await page.waitForURL(/ticker=MSFT.*review=edit/, { timeout });
            await page.getByRole('heading', { name: 'MSFT', exact: true }).waitFor({ state: 'visible', timeout });
            await page.getByRole('button', { name: 'Save review' }).waitFor({ state: 'visible', timeout });

            await page.goto(`${baseUrl}/research?workspace=calendar`, { waitUntil: 'domcontentloaded', timeout });
            await page.getByRole('heading', { name: 'Catalyst and review calendar' }).waitFor({ state: 'visible', timeout });
            await page.waitForFunction(() => document.querySelectorAll('[data-calendar-event]').length === 3, undefined, { timeout });
            await page.getByRole('button', { name: /Open MSFT earnings/i }).click();
            await page.waitForURL(/ticker=MSFT.*tab=events/, { timeout });
            check(await page.getByRole('tab', { name: 'Research', exact: true }).getAttribute('aria-selected') === 'true', `${width}: event did not return to Research workspace`);
            await page.getByRole('tab', { name: 'Events', exact: true }).waitFor({ state: 'visible', timeout });
            check(await page.getByRole('tab', { name: 'Events', exact: true }).getAttribute('aria-selected') === 'true', `${width}: earnings destination did not open Events`);
            check(researchMutations.length === 0, `${width}: opening calendar events mutated research state (${researchMutations.join(', ')})`);
            check(issues.length === 0, `${width}: ${issues.join(' | ')}`);
            console.log(`PASS research calendar ${width}px`);
        } catch (error) {
            failures.push(error instanceof Error ? error.message : String(error));
        } finally {
            await context.close();
        }
    }
} finally {
    await browser.close();
}

if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exitCode = 1;
} else {
    if (captureScreenshots) console.log(`Screenshots: ${screenshotDirectory}`);
    console.log('Research calendar QA passed.');
}
