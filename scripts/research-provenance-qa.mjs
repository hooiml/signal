import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { researchSnapshotFixture } from './harness/research-read-fixture.mjs';
import { isolatedSnapshot } from './harness/research-improvements-regression.mjs';

const base = process.env.SIGNAL_QA_URL || 'http://127.0.0.1:3101';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Fixture QA requires an owned local server.');
const out = '.tmp/research-provenance/browser';
await mkdir(out, { recursive: true });
const { createResearchRecord, appendResearchReview } = isolatedSnapshot().load('src/lib/research/records.ts');
const bookmark = (symbol = 'AAPL', market = 'US') => createResearchRecord({ symbol, market, companyName: `Fixture ${symbol}`, saveOnly: true });
const observedAt = '2026-10-20T20:00:00.000Z';
const fetchedAt = '2026-10-21T10:00:00.000Z';
const fixtureTime = '2026-10-22T12:00:00.000Z';
const nullableChart = ['volume', 'ma50', 'ma200', 'ema20', 'ema50', 'sma200', 'averageVolume20', 'rsi14', 'macd', 'macdSignal', 'macdHistogram', 'atr14', 'atrPercent14', 'anchoredVwap', 'adx14', 'plusDi14', 'minusDi14', 'supertrend', 'supertrendDirection'];
const point = (time, close) => ({ time, open: close, high: close, low: close, close, ...Object.fromEntries(nullableChart.map(key => [key, null])) });

function snapshot(symbol, market, { currencyOverride, dailyChange = null, legacyProvenance = false } = {}) {
    const payload = structuredClone(researchSnapshotFixture);
    const currency = market === 'MY' ? 'MYR' : 'USD';
    const source = market === 'MY' ? 'Yahoo Finance' : 'SEC EDGAR';
    const annual = {
        reportingPeriod: '2025-12-31', currency, source, annualRevenue: 1_200_000_000, revenueGrowthPercent: 20,
        grossMarginPercent: 45, operatingMarginPercent: 18, annualNetIncome: 100_000_000, freeCashFlow: 60_000_000,
        debt: 90_000_000, cash: 25_000_000, shares: 110_000_000, shareChangePercent: 10,
        comparisonPeriod: '2024-12-31', comparisonRevenue: 1_000_000_000, comparisonShares: 100_000_000, comparableAnnual: true,
        ...(market === 'MY' ? { shareBasis: 'diluted average' } : {}),
    };
    Object.assign(payload.data, { symbol, market, fetchedAt, sources: [source, 'Yahoo Finance'], warnings: [] });
    payload.data.quote = {
        name: `Fixture ${symbol}`, price: 120.34, currency: currencyOverride === undefined ? currency : currencyOverride,
        dailyChangePercent: dailyChange, observedAt, sharesOutstanding: market === 'MY' ? 120_000_000 : null, instrumentType: 'EQUITY',
        classification: { source: 'Yahoo Finance', instrumentType: 'EQUITY', sector: 'Industrials', industry: 'Machinery', retrievedAt: fixtureTime },
    };
    payload.data.fundamentals = {
        ...annual, debt: 100_000_000, cash: 30_000_000, shares: market === 'MY' ? 110_000_000 : 115_000_000,
        history: [annual, { ...annual, reportingPeriod: '2024-12-31', annualRevenue: 1_000_000_000 }],
        ...(!legacyProvenance ? { metricProvenance: {
            debt: { reportingPeriods: market === 'MY' ? ['2025-12-31'] : ['2026-03-31', '2026-06-30'], currency },
            cash: { reportingPeriods: [market === 'MY' ? '2025-12-31' : '2026-06-30'], currency },
            shares: { reportingPeriods: [market === 'MY' ? '2025-12-31' : '2026-06-30'], currency: null },
            shareChange: { reportingPeriods: ['2024-12-31', '2025-12-31'], currency: null },
        } } : {}),
    };
    payload.data.valuation = {
        marketCap: 13_839_100_000, priceEarnings: 138.391, priceSales: 11.5326, freeCashFlowYieldPercent: 0.4336,
        netCash: -70_000_000, reportingPeriod: '2025-12-31', source: market === 'MY' ? 'Yahoo Finance' : 'Yahoo Finance + SEC EDGAR',
        shareBasis: market === 'MY' ? 'Yahoo quote outstanding shares' : 'SEC outstanding shares',
    };
    payload.data.chart.points = [point('2026-09-01', 110), point('2026-10-01', 115), point('2026-10-20', 120.34)];
    return payload;
}

const report = { fixtureOnly: true, externalDataAccess: false, status: 'running', scenarios: [] };
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--no-sandbox'] });
try {
    for (const width of [1280, 768, 375]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width === 375, reducedMotion: 'reduce', serviceWorkers: 'block' });
        const page = await context.newPage();
        await page.clock.setFixedTime(fixtureTime);
        const errors = [], requests = [];
        let records = [bookmark()], listState = 'ready', quoteOptions = {}, providerFails = false, saveState = 'locked';
        const saveRequests = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource:.*status of (401|503)/.test(message.text())) errors.push(message.text()); });
        page.on('requestfailed', request => { if (!/ERR_ABORTED/.test(request.failure()?.errorText ?? '')) errors.push(`${request.url()}: ${request.failure()?.errorText}`); });
        await context.route('**/api/**', async route => {
            const request = route.request(), url = new URL(request.url());
            requests.push({ method: request.method(), path: url.pathname });
            if (url.pathname === '/api/research/watchlist') {
                assert.equal(request.method(), 'GET', 'Creating real records is outside this fixture matrix.');
                if (listState === 'locked') return route.fulfill({ status: 401, json: { success: false, code: 'OWNER_ACCESS_REQUIRED', error: 'Fixture locked' } });
                if (listState === 'unconfigured') return route.fulfill({ status: 503, json: { success: false, code: 'OWNER_ACCESS_UNCONFIGURED', error: 'Fixture unconfigured' } });
                if (listState === 'failed') return route.fulfill({ status: 503, json: { success: false, error: 'Fixture temporarily unavailable' } });
                return route.fulfill({ json: { success: true, data: records, archivedSymbols: [] } });
            }
            if (url.pathname === '/api/research/watchlist/AAPL') {
                assert.equal(request.method(), 'PATCH', 'Only the isolated draft-recovery fixture may save.');
                const draft = request.postDataJSON();
                saveRequests.push(draft);
                if (saveState === 'locked') return route.fulfill({ status: 401, json: { success: false, code: 'OWNER_ACCESS_REQUIRED', error: 'Fixture locked' } });
                if (saveState === 'unconfigured') return route.fulfill({ status: 503, json: { success: false, code: 'OWNER_ACCESS_UNCONFIGURED', error: 'Fixture unconfigured' } });
                const saved = appendResearchReview({ ...draft, revision: draft.revision + 1 }, '2026-10-21T10:15:00.000Z');
                records = [saved];
                return route.fulfill({ json: { success: true, data: saved } });
            }
            if (url.pathname.startsWith('/api/research/symbol/')) {
                assert.equal(request.method(), 'GET');
                return route.fulfill(providerFails ? { status: 503, json: { success: false, error: 'Fixture provider failed' } }
                    : { json: snapshot(url.pathname.split('/').at(-1), url.searchParams.get('market'), quoteOptions) });
            }
            if (url.pathname === '/api/research/quotes') {
                assert.equal(request.method(), 'POST', 'Batch quote POST is a read.');
                return route.fulfill({ json: { success: true, data: { fetchedAt, items: request.postDataJSON().map(({ symbol, market }) => ({ success: true, data: { symbol, market, providerSymbol: symbol, fetchedAt, quote: snapshot(symbol, market, quoteOptions).data.quote } })) } } });
            }
            if (url.pathname === '/api/research/inbox') {
                assert.equal(request.method(), 'POST', 'Inbox POST is a read.');
                return route.fulfill({ json: { success: true, data: { generatedAt: fetchedAt, monitoredCount: records.length, items: [], warnings: [] } } });
            }
            if (url.pathname.startsWith('/api/research/chart/')) return route.fulfill({ json: { success: true, data: { chart: snapshot('AAPL', 'US').data.chart } } });
            assert.equal(request.method(), 'GET', `Unexpected mutation: ${url.pathname}`);
            return route.fulfill({ json: { success: true, data: [] } });
        });

        async function capture(name, selector) {
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.evaluate(() => document.fonts.ready);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: document overflow at ${width}`);
            const scope = page.locator(selector);
            const geometry = await scope.locator('h2,h3,p,dt,dd,button,a').evaluateAll(elements => elements.filter(element => element.getClientRects().length).map(element => {
                const box = element.getBoundingClientRect();
                return { tag: element.tagName, text: element.textContent?.slice(0, 100), left: box.left, right: box.right, top: box.top, bottom: box.bottom, height: box.height };
            }));
            assert.ok(geometry.every(box => box.left >= -1 && box.right <= width + 1), `${name}: nested content clipped at ${width}`);
            const metricRows = await scope.locator('dl > div').evaluateAll(elements => elements.flatMap(element => {
                const dt = element.querySelector('dt'), dd = element.querySelector('dd');
                if (!dt || !dd || !dt.getClientRects().length || !dd.getClientRects().length) return [];
                const a = dt.getBoundingClientRect(), b = dd.getBoundingClientRect();
                return [{ label: dt.textContent, separate: a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1 }];
            }));
            assert.ok(metricRows.every(row => row.separate), `${name}: metric label/value overlap`);
            const numericTokens = await scope.locator('dl > div > dd').evaluateAll(elements => elements.filter(element => element.getClientRects().length).flatMap(element => {
                const tokens = [], walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
                for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                    for (const match of node.textContent.matchAll(/[-+]?\d[\d,.]*(?:%|×)?/g)) {
                        const range = document.createRange();
                        range.setStart(node, match.index); range.setEnd(node, match.index + match[0].length);
                        const lines = new Set([...range.getClientRects()].map(box => Math.round(box.top)));
                        tokens.push({ value: match[0], lines: lines.size });
                    }
                }
                return tokens;
            }));
            assert.ok(numericTokens.every(token => token.lines <= 1), `${name}: numeric token wraps internally at ${width}: ${JSON.stringify(numericTokens.filter(token => token.lines > 1))}`);
            await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: true });
            report.scenarios.push({ name, width, geometry, metricRows, numericTokens, overflow: false });
        }
        const open = async url => { await page.goto(base + url, { waitUntil: 'domcontentloaded' }); };
        const legacyReady = async url => {
            await open(url);
            await page.locator('#research-detail').waitFor();
            await page.getByText('Quote response retrieved', { exact: true }).waitFor();
        };
        const expectAuthoredAge = async (ageDays, name) => {
            const age = new RegExp(`reviewed ${ageDays} days ago`, 'i');
            await legacyReady('/research?workspace=research&ticker=AAPL&market=US&tab=overview');
            await page.getByTestId('research-readiness-details').locator('summary').click();
            const policyReadiness = page.getByTestId('research-readiness-policy');
            await policyReadiness.getByText(age).waitFor();
            await policyReadiness.click();
            await page.getByRole('heading', { name: 'Investment-policy guardrails', exact: true }).waitFor();
            const assessment = page.locator('#policy-assessment-title + ul > li').filter({ has: page.getByRole('heading', { name: 'AAPL', exact: true }) });
            await assessment.getByText(age).waitFor();
            assert.doesNotMatch(await assessment.innerText(), /Not reviewed|reviewed (?:null|NaN) days ago/i, `${name}: genuine review age is available`);
            await capture(name, 'section[aria-labelledby="policy-assessment-title"]');
        };

        await open('/research-v8?ticker=AAPL&market=US&tab=financials&advanced=1');
        await page.getByTestId('research-price').filter({ hasText: 'USD 120.34' }).waitFor();
        assert.equal(await page.getByRole('tab', { name: 'Financials', exact: true }).getAttribute('aria-selected'), 'true');
        const financials = page.locator('#connected-panel');
        await financials.getByText('More financial measures and reporting dates', { exact: true }).click();
        assert.match(await financials.innerText(), /Year ended 2025-12-31/);
        assert.match(await financials.innerText(), /Components reported 2026-03-31 and 2026-06-30; dates differ/);
        assert.match(await financials.innerText(), /Reported 2026-06-30/);
        assert.match(await page.locator('[aria-label="Saved user-authored decision"]').innerText(), /Not recorded.*No personal review recorded/s);
        const editSaved = financials.getByRole('link', { name: 'Edit saved research (new tab) ↗', exact: true });
        assert.equal(new URL(await editSaved.getAttribute('href'), base).searchParams.get('market'), 'US');
        assert.equal(await editSaved.getAttribute('target'), '_blank');
        await capture('v8-financial-periods', '#connected-panel');
        await page.getByRole('tab', { name: 'Valuation', exact: true }).click();
        assert.match(await financials.innerText(), /Quote observed: 20 Oct 2026, 20:00 UTC/);
        assert.match(await financials.innerText(), /not historical ratios at the financial year end/);
        assert.match(await financials.innerText(), /Cash: Reported 2026-06-30.*Debt: Components reported 2026-03-31 and 2026-06-30/s);
        await capture('v8-valuation-dates', '#connected-panel');

        // Review evidence can exist while the latest decision remains intentionally unrecorded.
        records = [appendResearchReview(bookmark(), '2026-10-10T09:00:00.000Z')];
        await open('/research-v8?ticker=AAPL&market=US&tab=review&advanced=1');
        await page.locator('[aria-label="Saved user-authored decision"]').getByText('Last reviewed 10 Oct 2026.', { exact: true }).waitFor();
        assert.match(await financials.innerText(), /Last reviewed\s+10 Oct 2026/);
        assert.doesNotMatch(await page.locator('[aria-label="Saved user-authored decision"]').innerText(), /No personal review/);
        const fullReview = financials.getByRole('link', { name: 'Open full research review (new tab) ↗', exact: true });
        assert.equal(new URL(await fullReview.getAttribute('href'), base).searchParams.get('market'), 'US');
        assert.equal(await fullReview.getAttribute('target'), '_blank');
        assert.equal(records[0].decisionJournal.decision, 'Not recorded');
        await expectAuthoredAge(12, 'history-only-authored-review-age');

        records = [bookmark('5347', 'MY')];
        await open('/research-v8?ticker=5347&market=MY&tab=valuation&advanced=1');
        await page.getByTestId('research-price').filter({ hasText: 'MYR 120.34' }).waitFor();
        assert.match(await financials.innerText(), /Yahoo quote outstanding shares · Share reporting date unavailable/);
        const fullValuation = financials.getByRole('link', { name: 'Open full valuation workspace (new tab) ↗', exact: true });
        assert.equal(new URL(await fullValuation.getAttribute('href'), base).searchParams.get('market'), 'MY');
        assert.equal(await fullValuation.getAttribute('target'), '_blank');
        await capture('v8-malaysia-share-basis', '#connected-panel');
        quoteOptions = { legacyProvenance: true };
        await open('/research-v8?ticker=5347&market=MY&tab=financials');
        await financials.getByText('More financial measures and reporting dates', { exact: true }).click();
        assert.match(await financials.innerText(), /Reporting date unavailable/);

        // Back can restore an old ticker-only entry after records have loaded. Canonical
        // market state must survive a later expired-access response clearing the records.
        records = [bookmark()]; quoteOptions = {};
        await open('/research-v8?ticker=AAPL&market=US');
        await page.getByRole('button', { name: /^Saved securities · 1/ }).waitFor();
        await page.getByTestId('research-price').filter({ hasText: 'USD 120.34' }).waitFor();
        await page.evaluate(() => {
            window.history.pushState(null, '', '/research-v8?ticker=AAPL&tab=financials&advanced=1#legacy-position');
            window.history.pushState(null, '', '/research-v8?ticker=AAPL&market=US&tab=overview');
        });
        await page.goBack();
        await page.waitForFunction(() => new URL(window.location.href).searchParams.get('market') === 'US');
        assert.equal(await page.getByRole('tab', { name: 'Financials', exact: true }).getAttribute('aria-selected'), 'true');
        listState = 'locked';
        await page.getByRole('button', { name: /^Saved securities · 1/ }).click();
        await page.getByRole('button', { name: 'Reload saved research', exact: true }).click();
        await page.getByRole('dialog').getByRole('link', { name: 'Unlock Signal', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Close research panel', exact: true }).click();
        assert.equal(await page.getByTestId('research-price').innerText(), 'USD 120.34');
        assert.equal(new URL(page.url()).searchParams.get('market'), 'US');
        const returnFromCanonical = new URL(await page.getByRole('link', { name: 'Unlock Signal', exact: true }).getAttribute('href'), base).searchParams.get('next');
        const canonicalUrl = new URL(returnFromCanonical, base);
        assert.equal(canonicalUrl.searchParams.get('market'), 'US');
        assert.equal(canonicalUrl.searchParams.get('tab'), 'financials');
        assert.equal(canonicalUrl.searchParams.get('advanced'), '1');
        assert.equal(canonicalUrl.hash, '#legacy-position');
        await capture('v8-back-entry-expired-access', '#connected-panel');
        listState = 'ready';

        records = [bookmark()]; quoteOptions = { currencyOverride: 'MYR', dailyChange: null };
        await legacyReady('/research?workspace=research&ticker=AAPL&market=US&tab=overview');
        const legacyDetail = page.locator('#research-detail');
        assert.match(await legacyDetail.innerText(), /Your saved decision · Not recorded/i);
        assert.match(await legacyDetail.innerText(), /Bookmarked · no personal review recorded/);
        assert.match(await page.getByTestId('research-decision-journal').innerText(), /no personal review recorded/);
        if (width >= 1024) assert.match(await page.locator('body').innerText(), /No personal reviews recorded/);
        assert.match(await legacyDetail.innerText(), /120.34 MYR/);
        assert.match(await legacyDetail.innerText(), /Daily change unavailable/);
        assert.doesNotMatch(await legacyDetail.innerText(), /\+0\.00%/);
        assert.match(await legacyDetail.innerText(), /Quote observed\s+· 20 Oct 2026, 20:00 UTC/);
        assert.match(await legacyDetail.innerText(), /Quote response retrieved\s+· 21 Oct 2026, 10:00 UTC/);
        await capture('legacy-bookmark-quote', '#research-detail > header');

        quoteOptions = { currencyOverride: null, dailyChange: 0 };
        await legacyReady('/research?workspace=research&ticker=AAPL&market=US&tab=overview');
        assert.match(await legacyDetail.innerText(), /120.34 \(currency not recorded\)/);
        assert.match(await legacyDetail.innerText(), /0.00% daily change/);
        await capture('legacy-unknown-currency', '#research-detail > header');
        const reviewed = bookmark();
        reviewed.decisionJournal = { ...reviewed.decisionJournal, decision: 'Avoid' };
        reviewed.lastReviewedAt = '2026-10-10'; records = [reviewed]; quoteOptions = { currencyOverride: 'GBp' };
        await legacyReady('/research?workspace=research&ticker=AAPL&market=US&tab=overview');
        assert.match(await legacyDetail.innerText(), /Your saved decision · Avoid/i);
        assert.match(await legacyDetail.innerText(), /Calculated checklist status: Watch/);
        assert.match(await legacyDetail.innerText(), /120.34 GBp/);
        await capture('legacy-saved-decision', '#research-detail > header');

        // A denied save must retain the mounted editor and its draft. Unlocking opens a
        // separate tab; only the user's next explicit Save review retries the PATCH.
        records = [bookmark()]; quoteOptions = {}; saveState = 'locked';
        await legacyReady('/research?workspace=research&ticker=AAPL&market=US&tab=overview&review=edit#draft-position');
        const journal = page.getByTestId('research-decision-journal');
        const whyInterested = journal.locator('[data-review-step="thesis"] label').filter({ hasText: /^Why interested/ }).locator('textarea');
        const draftText = `Fixture unsaved owner-access draft at ${width}px`;
        await whyInterested.fill(draftText);
        const originalField = await whyInterested.elementHandle();
        assert.ok(originalField);
        await journal.getByRole('navigation', { name: 'Review steps', exact: true }).getByRole('button', { name: 'Decision', exact: true }).click();
        const saveReview = journal.getByRole('button', { name: 'Save review', exact: true });
        await saveReview.click();
        const writeNotice = journal.getByTestId('owner-access-notice');
        await journal.locator('[data-owner-access-issue="locked"]').waitFor();
        assert.equal(await whyInterested.inputValue(), draftText);
        assert.equal(await originalField.evaluate(element => element.isConnected), true);
        assert.match(await writeNotice.innerText(), /Your draft remains in this tab and has not been saved/);
        assert.match(await writeNotice.innerText(), /select “Save review” again/);
        const draftUnlock = writeNotice.getByRole('link', { name: 'Unlock Signal in a new tab', exact: true });
        assert.equal(await draftUnlock.getAttribute('target'), '_blank');
        const currentDraftUrl = new URL(page.url());
        assert.equal(new URL(await draftUnlock.getAttribute('href'), base).searchParams.get('next'), currentDraftUrl.pathname + currentDraftUrl.search + currentDraftUrl.hash);
        assert.equal(currentDraftUrl.hash, '#draft-position');
        await capture('legacy-editor-locked-draft', '[data-testid="research-decision-journal"] [data-testid="owner-access-notice"]');
        const popupPromise = context.waitForEvent('page');
        await draftUnlock.click();
        const popup = await popupPromise;
        await popup.waitForURL(url => url.pathname === '/unlock', { waitUntil: 'domcontentloaded' });
        assert.equal(new URL(popup.url()).pathname, '/unlock');
        await popup.close();
        assert.equal(await whyInterested.inputValue(), draftText);
        assert.equal(await originalField.evaluate(element => element.isConnected), true);
        assert.equal(saveRequests.length, 1, 'Opening unlock must not automatically retry or save.');
        saveState = 'unconfigured';
        await saveReview.click();
        await journal.locator('[data-owner-access-issue="unconfigured"]').waitFor();
        assert.equal(await writeNotice.getByRole('link').count(), 0);
        assert.match(await writeNotice.innerText(), /After owner access is configured, select “Save review” again/);
        assert.equal(await whyInterested.inputValue(), draftText);
        assert.equal(await originalField.evaluate(element => element.isConnected), true);
        assert.equal(saveRequests.length, 2);
        assert.equal(records[0].reviewHistory.length, 0, 'denied saves cannot start an authored review history');
        await capture('legacy-editor-unconfigured-draft', '[data-testid="research-decision-journal"] [data-testid="owner-access-notice"]');
        saveState = 'ready';
        await saveReview.click();
        await journal.getByTestId('submit-research-review').waitFor();
        assert.equal(saveRequests.length, 3, 'Each explicit Save review should send exactly one PATCH.');
        assert.ok(saveRequests.every(draft => draft.whyInterested === draftText));
        assert.equal(records[0].whyInterested, draftText);
        assert.equal(await page.getByTestId('owner-access-notice').count(), 0);
        assert.equal(records[0].reviewHistory.length, 1, 'the first successful explicit review creates one authored snapshot');
        assert.equal(records[0].lastReviewedAt, '2026-10-21', 'the successful review uses the fixture save timestamp');
        await expectAuthoredAge(1, 'first-successful-authored-review-age');

        // Unknown legacy cost units must not look compatible with the current USD quote.
        const costRecord = bookmark();
        costRecord.positionState = 'owned';
        costRecord.positionPlan = { ...costRecord.positionPlan, averageCost: 100 };
        records = [costRecord]; quoteOptions = {};
        // Keep the saved record outside the selected detail so the batch-quote fixture supplies its current price.
        await open('/research?workspace=currency&ticker=UNSAVED');
        const performancePanel = page.getByTestId('currency-performance');
        await performancePanel.getByText('Performance is withheld while the cost currency is unknown.', { exact: false }).waitFor();
        assert.equal(await performancePanel.getByText('Price return', { exact: true }).count(), 0);
        await capture('performance-unknown-cost-currency', '[data-testid="currency-performance"]');
        records = [{ ...costRecord, positionPlan: { ...costRecord.positionPlan, currency: 'Usd' } }];
        await page.reload();
        await performancePanel.getByText('Price return', { exact: true }).waitFor();
        assert.equal(await performancePanel.getByText('+20.34%', { exact: true }).count() > 0, true);
        await capture('performance-normalized-cost-currency', '[data-testid="currency-performance"]');

        // Clearing a known plan currency keeps the draft open and never sends a PATCH.
        records = [{ ...costRecord, positionPlan: { ...costRecord.positionPlan, currency: 'MYR' } }];
        await legacyReady('/research?workspace=research&ticker=AAPL&market=US&tab=overview&review=edit');
        await journal.getByRole('navigation', { name: 'Review steps', exact: true }).getByRole('button', { name: 'Decision', exact: true }).click();
        await journal.locator('summary').filter({ hasText: 'Optional position plan' }).click();
        await journal.getByLabel('Price currency', { exact: true }).fill('');
        const beforeCurrencySave = saveRequests.length;
        await saveReview.click();
        await journal.getByRole('alert').filter({ hasText: 'Record the currency of the position plan prices before saving.' }).waitFor();
        assert.equal(saveRequests.length, beforeCurrencySave);
        assert.equal(await journal.getByLabel('Average cost', { exact: true }).inputValue(), '100');
        await saveReview.click();
        assert.equal(saveRequests.length, beforeCurrencySave, 'Repeated invalid save does not send a request');
        await capture('position-plan-currency-required', '[data-testid="research-decision-journal"]');
        await journal.getByLabel('Price currency', { exact: true }).fill('MYR');
        await journal.getByRole('button', { name: 'Cancel', exact: true }).click();
        assert.equal(saveRequests.length, beforeCurrencySave);

        records = [bookmark('5347', 'MY')]; quoteOptions = {};
        await legacyReady('/research?workspace=research&ticker=5347&market=MY&tab=fundamentals');
        const back = page.getByRole('link', { name: 'Back to basic view →', exact: true });
        const backUrl = new URL(await back.getAttribute('href'), base);
        assert.equal(backUrl.searchParams.get('ticker'), '5347'); assert.equal(backUrl.searchParams.get('market'), 'MY'); assert.equal(backUrl.searchParams.get('tab'), 'financials');
        await back.click();
        await page.locator('#connected-tab-Financials[aria-selected="true"]').waitFor();
        assert.equal(await page.getByRole('tab', { name: 'Financials', exact: true }).getAttribute('aria-selected'), 'true');
        assert.equal(new URL(page.url()).searchParams.get('market'), 'MY');

        // An unavailable chart must settle, while an unknown quote value remains unknown.
        providerFails = true;
        await open('/research?workspace=research&ticker=5347&market=MY&tab=chart');
        await page.getByText('Chart unavailable because the provider request failed. Use Retry above to load it again.', { exact: true }).waitFor();
        assert.equal(await page.getByText('Loading chart data…', { exact: true }).count(), 0);
        await capture('legacy-chart-unavailable', '#research-panel-chart');
        providerFails = false;

        listState = 'locked';
        await open('/research-v6?workspace=research&ticker=5347&market=MY&tab=chart#saved-position');
        const unlock = page.getByRole('link', { name: 'Unlock Signal', exact: true });
        await unlock.waitFor();
        // Layout hydration restores density asynchronously; check the settled continuation, not two different renders.
        await page.waitForURL(url => url.searchParams.get('density') === 'comfortable');
        await page.waitForFunction(() => {
            const link = [...document.querySelectorAll('a')].find(candidate => candidate.textContent === 'Unlock Signal');
            return link && new URL(link.href).searchParams.get('next') === window.location.pathname + window.location.search + window.location.hash;
        });
        const destination = new URL(await unlock.getAttribute('href'), base).searchParams.get('next');
        const actual = new URL(page.url());
        assert.equal(destination, actual.pathname + actual.search + actual.hash);
        assert.equal(actual.pathname, '/research-v6'); assert.equal(actual.hash, '#saved-position');
        assert.match(destination, /market=MY/); assert.match(destination, /tab=chart/);
        await capture('legacy-locked-continuation', 'main');
        listState = 'unconfigured';
        await page.reload();
        await page.getByRole('alert').filter({ hasText: 'owner access has not been configured' }).waitFor();
        assert.equal(await page.getByRole('link', { name: 'Unlock Signal', exact: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Retry saved research', exact: true }).count(), 0);
        await capture('legacy-unconfigured', 'main');
        listState = 'failed'; await page.reload();
        await page.getByRole('button', { name: 'Retry saved research', exact: true }).waitFor();
        listState = 'ready'; await page.getByRole('button', { name: 'Retry saved research', exact: true }).click();
        await page.getByText('Quote response retrieved', { exact: true }).waitFor();
        assert.match(await legacyDetail.innerText(), /120.34 MYR/);
        assert.equal(new URL(page.url()).searchParams.get('ticker'), '5347');
        assert.deepEqual(errors, [], `Unexpected console/runtime/request failures at ${width}`);
        report.scenarios.push({ name: 'navigation-auth-and-review-checks', width, requests, fixtureSaveAttempts: saveRequests.length, errors });
        await context.close();
    }
    report.status = 'passed';
} catch (error) {
    report.status = 'failed';
    report.failure = String(error);
    throw error;
} finally {
    await browser.close();
    await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
console.log(`Research provenance browser matrix ${report.status}: ${report.scenarios.length} states at 1280/768/375px; fixture-only API traffic.`);
