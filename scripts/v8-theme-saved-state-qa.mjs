import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { marketRequestFixture } from './harness/market-request-fixture.mjs';
import { researchSnapshotFixture } from './harness/research-read-fixture.mjs';
import { isolatedSnapshot } from './harness/research-improvements-regression.mjs';

const argument = (name, fallback = null) => {
    const index = process.argv.indexOf(name);
    return index < 0 ? fallback : process.argv[index + 1] ?? fallback;
};
const baseUrl = argument('--base-url', process.env.SIGNAL_QA_URL ?? 'http://127.0.0.1:3000');
const origin = new URL(baseUrl).origin;
assert.ok(['localhost', '127.0.0.1'].includes(new URL(baseUrl).hostname), 'This suite uses a local server and isolated API fixtures only.');
const output = path.resolve(argument('--output', '.tmp/v8-theme-saved-state-qa'));
const width = argument('--viewport');
const viewports = (width ? [Number(width)] : [1280, 768, 375]).map(value => ({ width: value, height: value === 375 ? 812 : 900 }));
assert.ok(viewports.every(viewport => Number.isInteger(viewport.width) && viewport.width >= 320));
const selectedScenario = argument('--scenario');
assert.ok(!selectedScenario || ['boot', 'theme', 'saved', 'pins'].includes(selectedScenario));
const themeKey = 'signal-v8-theme-v1';
const cockpitThemeKey = 'signal-dashboard-theme-v2';
const pinsKey = 'signal-research-pinned-workspaces-v1';
const fixtureTime = '2026-10-22T12:00:00.000Z';
const timeout = 15_000;
await mkdir(output, { recursive: true });

const domain = isolatedSnapshot();
const { createResearchRecord, appendResearchReview } = domain.load('src/lib/research/records.ts');
const { parseMarketReplayIndex } = domain.load('src/lib/types/market-replay.ts');
let saved = createResearchRecord({ symbol: 'AAPL', market: 'US', companyName: 'Fixture Apple' });
saved = { ...saved, whyInterested: 'Fixture authored thesis', notes: 'Fixture saved review note',
    decisionJournal: { ...saved.decisionJournal, nextReviewAt: '2026-10-20' },
    monitoringRules: { ...saved.monitoringRules, reviewAgeDays: 30 } };
saved = appendResearchReview(saved, '2026-09-12T12:00:00.000Z');
saved = appendResearchReview(saved, '2026-10-10T12:00:00.000Z');
saved = { ...saved, updatedAt: '2026-10-10T12:00:00.000Z', revision: 2 };
const snapshot = structuredClone(researchSnapshotFixture);
snapshot.data.fetchedAt = fixtureTime;
snapshot.data.quote = { ...snapshot.data.quote, observedAt: '2026-10-21T20:00:00.000Z', instrumentType: 'EQUITY' };
snapshot.data.chart.points = Array.from({ length: 51 }, (_, index) => ({
    time: new Date(Date.UTC(2026, 8, 1 + index, 20)).toISOString().slice(0, 10),
    open: 200 + index * .3, high: 210 + index * .3, low: 195 + index * .3,
    close: 200 + index * .3 + (index % 7), volume: 1_000_000 + index * 1000,
    ...Object.fromEntries(['ma50', 'ma200', 'ema20', 'ema50', 'sma200', 'averageVolume20', 'rsi14',
        'macd', 'macdSignal', 'macdHistogram', 'atr14', 'atrPercent14', 'anchoredVwap',
        'adx14', 'plusDi14', 'minusDi14', 'supertrend', 'supertrendDirection'].map(key => [key, null])),
})).filter(point => ![0, 6].includes(new Date(point.time).getUTCDay()));
snapshot.data.technicals = { ...snapshot.data.technicals, low52Week: 180, high52Week: 240 };
domain.load('src/lib/research/snapshot-input.ts').parseResearchSnapshotResponse(snapshot);
const marketFixture = marketRequestFixture();
const market = await (await marketFixture.route.GET(marketFixture.request())).json();
const report = { fixtureOnly: true, baseUrl, fixtureTime, viewports, scenarios: [] };
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });

const settlePaint = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const themeState = page => page.getByRole('combobox', { name: 'Colour theme' }).evaluate(select => ({
    choice: select.value, applied: document.documentElement.getAttribute('data-v8-theme'),
}));
const expectTheme = async (page, choice, applied) => {
    await page.waitForFunction(({ choice, applied }) => {
        const select = [...document.querySelectorAll('label')].find(label => label.textContent.includes('Colour theme'))?.querySelector('select');
        return select?.value === choice && document.documentElement.getAttribute('data-v8-theme') === applied;
    }, { choice, applied }, { timeout });
    assert.deepEqual(await themeState(page), { choice, applied });
};
const changeTheme = async (page, choice, applied) => {
    await page.getByRole('combobox', { name: 'Colour theme' }).selectOption(choice);
    await expectTheme(page, choice, applied);
};

function attachErrors(page, result) {
    page.setDefaultTimeout(timeout);
    page.on('pageerror', error => result.errors.push(`pageerror: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') result.errors.push(`console: ${message.text()}`); });
    page.on('response', response => {
        const url = new URL(response.url());
        if (url.origin === origin && response.status() >= 400) result.errors.push(`HTTP ${response.status()} ${url.pathname}`);
    });
    page.on('requestfailed', request => {
        const url = new URL(request.url());
        const failure = { method: request.method(), url: request.url(), resourceType: request.resourceType(),
            navigation: request.isNavigationRequest(), rsc: request.headers().rsc ?? 'none', error: request.failure()?.errorText ?? 'unknown' };
        // Only an observed same-origin Research RSC transition cancellation is nonblocking.
        if (url.origin === origin && url.pathname === '/research' && failure.method === 'GET'
            && failure.resourceType === 'fetch' && !failure.navigation && failure.rsc === '1' && failure.error === 'net::ERR_ABORTED') {
            result.canceledTransitions.push(failure);
        } else result.errors.push(`requestfailed: ${JSON.stringify(failure)}`);
    });
}

async function scenario(name, viewport, options, run) {
    const result = { name, viewport, status: 'running', checks: [], errors: [], canceledTransitions: [], requests: [], screenshots: [] };
    report.scenarios.push(result);
    const initialStorage = [{ name: cockpitThemeKey, value: options.theme ?? 'light' }];
    if (options.storedTheme !== undefined) initialStorage.push({ name: themeKey, value: options.storedTheme });
    if (options.pins !== undefined) initialStorage.push({ name: pinsKey, value: options.pins });
    const context = await browser.newContext({ viewport, serviceWorkers: 'block', reducedMotion: 'reduce',
        colorScheme: options.system ?? 'light', storageState: { cookies: [], origins: [{ origin, localStorage: initialStorage }] } });
    context.on('page', page => attachErrors(page, result));
    await context.addInitScript(({ time, key, fault, appOrigin }) => {
        // about:blank has no storage origin; fault injection belongs only to the app document.
        if (window.location.origin !== appOrigin) return;
        const OriginalDate = Date;
        class FixedDate extends OriginalDate {
            constructor(...args) { super(...(args.length ? args : [time])); }
            static now() { return OriginalDate.parse(time); }
        }
        window.Date = FixedDate;
        window.__qaThemeStorageFaultCounts = { getItem: 0, setItem: 0, removeItem: 0, access: 0 };
        const storage = window.localStorage;
        for (const method of ['getItem', 'setItem', 'removeItem']) {
            const original = Storage.prototype[method];
            Storage.prototype[method] = function(storageKey, ...args) {
                if (this === storage && storageKey === key && fault === method) {
                    window.__qaThemeStorageFaultCounts[method] += 1;
                    throw new DOMException('Fixture theme storage unavailable', 'SecurityError');
                }
                return original.call(this, storageKey, ...args);
            };
        }
        if (fault === 'access') Object.defineProperty(window, 'localStorage', { configurable: true, get() {
            window.__qaThemeStorageFaultCounts.access += 1;
            throw new DOMException('Fixture localStorage access denied', 'SecurityError');
        } });
    }, { time: fixtureTime, key: themeKey, fault: options.fault ?? null, appOrigin: origin });
    let releaseWatchlist;
    const watchlistGate = options.holdWatchlist ? new Promise(resolve => { releaseWatchlist = resolve; }) : Promise.resolve();
    await context.route('**/api/**', async route => {
        const request = route.request(), url = new URL(request.url());
        result.requests.push({ method: request.method(), path: url.pathname });
        const json = payload => route.fulfill({ status: 200, json: payload });
        if (request.method() !== 'GET' && !['/api/research/calendar', '/api/research/inbox', '/api/research/alerts'].includes(url.pathname)) {
            result.errors.push(`Unexpected mutation: ${request.method()} ${url.pathname}`);
            return json({ success: false, error: 'Fixture forbids mutations' });
        }
        if (url.pathname === '/api/signals/v2') return json(market);
        if (url.pathname === '/api/signals/replay' && !url.searchParams.has('date')) {
            const payload = { success: true, data: {
                market: url.searchParams.get('market') ?? 'US',
                mode: url.searchParams.get('mode') ?? 'standard',
                enableSocial: url.searchParams.get('enableSocial') !== 'false',
                summaries: [],
            } };
            // Use the same boundary parser as the connected Market before serving this fixture.
            parseMarketReplayIndex(payload);
            return json(payload);
        }
        if (url.pathname === '/api/research/watchlist') { await watchlistGate; return json({ success: true, data: [saved], archivedSymbols: [] }); }
        if (url.pathname.startsWith('/api/research/symbol/')) return json(snapshot);
        if (url.pathname.startsWith('/api/research/quote/')) return json({ success: true, data: { quote: snapshot.data.quote } });
        if (url.pathname === '/api/research/inbox') return json({ success: true, data: { generatedAt: fixtureTime, monitoredCount: 1, items: [], warnings: [] } });
        if (url.pathname === '/api/research/alerts') return json({ success: true, data: { generatedAt: fixtureTime, monitoredCount: 1, alerts: [], triggerCoverage: [], warnings: [] } });
        if (url.pathname === '/api/research/calendar') {
            const inputs = request.postDataJSON();
            const events = inputs.filter(input => input.symbol === 'AAPL' && input.nextReviewAt === '2026-10-20').map(input => ({
                id: 'AAPL-review-2026-10-20', symbol: input.symbol, market: input.market, type: 'review',
                title: 'Fixture overdue authored review', detail: 'An explicitly scheduled saved review is overdue.',
                source: 'Research journal', sourceDate: '2026-10-20', displayDate: '2026-10-22', timezone: 'UTC',
                freshness: 'overdue', urgency: 'action', targetHref: '/research?ticker=AAPL&tab=overview&review=edit',
            }));
            return json({ success: true, data: { generatedAt: fixtureTime, rangeDays: Number(url.searchParams.get('range') ?? 30), timezone: 'UTC', events, macroEvents: [], warnings: [] } });
        }
        if (url.pathname === '/api/research/notifications/settings') return json({ success: true, data: { configured: false, history: [], settings: { enabled: false, mode: 'daily', quietHoursEnabled: false, quietHoursStartUtc: 22, quietHoursEndUtc: 7 } } });
        result.errors.push(`Unexpected fixture API: ${request.method()} ${url.pathname}`);
        return json({ success: true, data: [] });
    });
    const page = await context.newPage();
    const check = (description, condition = true) => { assert.ok(condition, description); result.checks.push(description); };
    const capture = async (label, locator = page) => {
        // Keep sticky navigation at the document top instead of scrolling it over a region capture.
        await page.evaluate(() => window.scrollTo(0, 0));
        await settlePaint(page);
        const file = `${name}-${viewport.width}-${label}.png`;
        const clip = locator === page ? undefined : await locator.evaluate(element => {
            const rect = element.getBoundingClientRect();
            return { x: rect.left + scrollX, y: rect.top + scrollY, width: rect.width, height: rect.height };
        });
        await page.screenshot({ path: path.join(output, file), fullPage: true, ...(clip ? { clip } : {}) });
        result.screenshots.push(file);
    };
    try {
        await run({ page, context, result, check, capture, releaseWatchlist: () => releaseWatchlist?.() });
        assert.deepEqual(result.errors, [], 'Unexpected runtime, HTTP, console and request errors remain blocking.');
        result.status = 'passed';
    } catch (error) {
        result.status = 'failed';
        result.failure = error instanceof Error ? error.stack ?? error.message : String(error);
        await page.screenshot({ path: path.join(output, `${name}-${viewport.width}-failure.png`), timeout: 5000 }).catch(() => {});
    } finally {
        releaseWatchlist?.();
        for (const openPage of context.pages()) openPage.removeAllListeners();
        await context.close();
        await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    }
}

const goMarket = async page => {
    await page.goto(`${baseUrl}/main-v8?market=US`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('connected-score').waitFor();
    await page.getByRole('combobox', { name: 'Colour theme' }).waitFor();
    await settlePaint(page);
};
const goResearch = async page => {
    await page.goto(`${baseUrl}/research-v8?ticker=AAPL&market=US`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('research-price').waitFor();
    await page.getByTestId('research-review-marker').first().waitFor();
};
const goWorkspace = async (page, workspace) => {
    await page.goto(`${baseUrl}/research?workspace=${workspace}&ticker=AAPL`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('research-pinned-workspaces').waitFor();
};
const pinned = page => page.getByTestId('research-pinned-workspaces');
const storedPins = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), pinsKey);

async function tokenContrast(page) {
    const colors = await page.evaluate(() => {
        const probe = document.createElement('span');
        document.body.append(probe);
        const values = {};
        for (const token of ['surface', 'canvas', 'ink', 'muted', 'brand', 'brand-soft', 'on-brand',
            'up', 'up-soft', 'down', 'down-soft', 'caution', 'caution-soft']) {
            probe.style.color = `var(--${token})`;
            values[token] = getComputedStyle(probe).color;
        }
        probe.remove();
        return values;
    });
    const luminance = value => {
        const rgb = value.match(/[\d.]+/g).slice(0, 3).map(Number).map(channel => channel / 255)
            .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
        return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
    };
    const pairs = [['ink', 'surface', 4.5], ['ink', 'canvas', 4.5], ['muted', 'surface', 4.5], ['muted', 'canvas', 4.5],
        ['on-brand', 'brand', 4.5], ['brand', 'surface', 4.5], ['brand', 'canvas', 4.5], ['brand', 'brand-soft', 4.5],
        ['up', 'surface', 4.5], ['up', 'up-soft', 4.5], ['down', 'surface', 4.5], ['down', 'down-soft', 4.5],
        ['caution', 'surface', 4.5], ['caution', 'caution-soft', 4.5]];
    return pairs.map(([foreground, background, minimum]) => {
        const a = luminance(colors[foreground]), b = luminance(colors[background]);
        const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        assert.ok(ratio >= minimum, `${foreground}/${background} contrast ${ratio.toFixed(2)} is below ${minimum}`);
        return { foreground, background, colors: [colors[foreground], colors[background]], ratio, minimum };
    });
}

try {
    if (!selectedScenario || selectedScenario === 'boot') {
        for (const [name, options, expected] of [
            ['explicit-dark', { storedTheme: 'dark', system: 'light' }, 'dark'],
            ['explicit-light', { storedTheme: 'light', system: 'dark' }, 'light'],
            ['auto-light', { system: 'light' }, 'light'],
            ['invalid-auto-dark', { storedTheme: 'malformed-theme', system: 'dark' }, 'dark'],
            ['blocked-read-dark', { fault: 'getItem', system: 'dark' }, 'dark'],
            ['denied-storage-dark', { fault: 'access', system: 'dark' }, 'dark'],
        ]) await scenario(`boot-${name}`, viewports[0], options, async ({ page, context, result, check }) => {
            let blockedChunks = 0;
            await context.route('**/_next/static/**/*.js', route => { blockedChunks += 1; return route.fulfill({ contentType: 'application/javascript', body: '' }); });
            await page.goto(`${baseUrl}/main-v8`, { waitUntil: 'load' });
            const scripts = await page.locator('head script:not([src])').allTextContents();
            check('Actual server-rendered inline theme boot script is present', scripts.some(script => script.includes(themeKey) && script.includes('data-v8-theme')));
            check('Hydration chunks were withheld while the real inline boot ran', blockedChunks > 0 && result.requests.length === 0);
            result.bootTheme = await page.locator('html').getAttribute('data-v8-theme');
            assert.equal(result.bootTheme, expected);
            check(`Pre-hydration theme is ${expected}`);
            result.storageFaultCounts = await page.evaluate(() => window.__qaThemeStorageFaultCounts);
            if (options.fault) check('The intended storage denial actually ran', result.storageFaultCounts[options.fault] > 0);
        });
    }
    if (!selectedScenario || selectedScenario === 'theme') {
        for (const viewport of viewports) await scenario('theme-normal', viewport, {}, async ({ page, context, result, check, capture }) => {
            await goMarket(page); await expectTheme(page, 'system', 'light');
            const archiveSummary = page.getByText('About indicator history', { exact: true });
            await archiveSummary.scrollIntoViewIfNeeded();
            await page.waitForFunction(() => [...document.querySelectorAll('details')].some(details =>
                details.querySelector('summary')?.textContent === 'About indicator history'
                && details.textContent.includes('Archive loaded · 0 loaded / 0 pending / 0 failed / 0 unavailable.')));
            check('The validated empty archive reaches its loaded state without a parser error');
            await changeTheme(page, 'dark', 'dark');
            result.marketContrast = { dark: await tokenContrast(page) };
            await capture('market-dark');
            await page.emulateMedia({ colorScheme: 'light' }); await expectTheme(page, 'dark', 'dark');
            await changeTheme(page, 'light', 'light');
            result.marketContrast.light = await tokenContrast(page);
            await capture('market-light');
            await page.emulateMedia({ colorScheme: 'dark' }); await expectTheme(page, 'light', 'light');
            check('Explicit Light/Dark overrides OS appearance');
            await changeTheme(page, 'system', 'dark');
            assert.equal(await page.evaluate(key => localStorage.getItem(key), themeKey), null);
            await page.emulateMedia({ colorScheme: 'light' }); await expectTheme(page, 'system', 'light');
            check('Auto removes the stored override and follows later OS changes');
            await changeTheme(page, 'dark', 'dark');
            await page.reload({ waitUntil: 'domcontentloaded' }); await expectTheme(page, 'dark', 'dark');
            await goResearch(page); await expectTheme(page, 'dark', 'dark');
            check('Explicit choice survives reload and Market-to-Research navigation');
            const second = await context.newPage();
            await goMarket(second); await expectTheme(second, 'dark', 'dark');
            await changeTheme(second, 'light', 'light'); await expectTheme(page, 'light', 'light');
            await changeTheme(second, 'system', 'light'); await expectTheme(page, 'system', 'light');
            check('Real cross-tab localStorage changes update both controls and applied themes');
            await page.evaluate(key => window.dispatchEvent(new StorageEvent('storage', { key, newValue: 'dark', storageArea: sessionStorage })), themeKey);
            await expectTheme(page, 'system', 'light');
            check('Session-storage events cannot change the local theme');
            result.finalTheme = await themeState(page);
            await capture('auto-after-cross-tab');
        });
        for (const fault of ['getItem', 'setItem', 'removeItem', 'access']) await scenario(`theme-failed-${fault}`, viewports[0], {
            fault, storedTheme: fault === 'removeItem' ? 'dark' : 'light', system: fault === 'access' ? 'dark' : 'light',
        }, async ({ page, result, check, capture }) => {
            await goMarket(page);
            if (fault === 'removeItem') {
                await expectTheme(page, 'dark', 'dark');
                await changeTheme(page, 'system', 'light');
                assert.equal(await page.evaluate(key => localStorage.getItem(key), themeKey), 'dark');
                await page.emulateMedia({ colorScheme: 'dark' }); await expectTheme(page, 'system', 'dark');
                await page.emulateMedia({ colorScheme: 'light' }); await expectTheme(page, 'system', 'light');
                check('Failed removal retains Auto for this session despite stale persisted Dark');
            } else {
                await expectTheme(page, fault === 'setItem' ? 'light' : 'system', fault === 'access' ? 'dark' : 'light');
                await changeTheme(page, 'dark', 'dark');
                if (fault === 'setItem') {
                    assert.equal(await page.evaluate(key => localStorage.getItem(key), themeKey), 'light');
                    await page.evaluate(key => {
                        window.dispatchEvent(new StorageEvent('storage', { key, newValue: 'light', storageArea: sessionStorage }));
                        window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated-setting', newValue: 'light', storageArea: localStorage }));
                    }, themeKey);
                    await expectTheme(page, 'dark', 'dark');
                    check('Foreign storage events cannot discard an unsaved Dark choice in favor of stale persisted Light');
                }
                await changeTheme(page, 'light', 'light');
                await changeTheme(page, 'system', fault === 'access' ? 'dark' : 'light');
                check('Storage failure preserves selector and applied-theme agreement through Dark, Light and Auto');
            }
            if (fault === 'access') {
                await page.evaluate(() => window.dispatchEvent(new Event('offline')));
                await page.getByTestId('pwa-lifecycle').getByText('Offline — live server data is unavailable', { exact: true }).waitFor();
                await page.evaluate(() => window.dispatchEvent(new Event('online')));
                await page.getByTestId('pwa-lifecycle').waitFor({ state: 'hidden' });
                check('Root theme and PWA stay usable under global localStorage denial; online state recovers');
            }
            result.storageFaultCounts = await page.evaluate(() => window.__qaThemeStorageFaultCounts);
            check('The intended failed storage operation actually ran', result.storageFaultCounts[fault] > 0);
            result.finalTheme = await themeState(page);
            await capture('recovered');
        });
    }
    for (const viewport of viewports) for (const theme of ['light', 'dark']) {
        if (!selectedScenario || selectedScenario === 'saved') await scenario(`saved-${theme}`, viewport, { theme, storedTheme: theme }, async ({ page, result, check, capture }) => {
            await goResearch(page); await expectTheme(page, theme, theme);
            await page.getByRole('group', { name: 'Price history range' }).getByRole('button', { name: 'All', exact: true }).click();
            const markers = page.getByTestId('research-review-marker');
            assert.equal(await markers.count(), 2);
            const titles = await markers.locator('title').allTextContents();
            assert.deepEqual(titles.sort(), ['12 Sept 2026 · Decision: Watch', '10 Oct 2026 · Decision: Watch'].sort());
            check('The expected September 12 and October 10 saved reviews appear exactly once; the current day is deduplicated');
            await page.getByText(/Your saved reviews in this range:/).waitFor();
            result.markerGeometry = await markers.evaluateAll(elements => elements.map(element => {
                const rect = element.getBoundingClientRect(), svg = element.ownerSVGElement.getBoundingClientRect();
                return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
                    insideChart: rect.left >= svg.left - 1 && rect.right <= svg.right + 1 && rect.top >= svg.top - 1 && rect.bottom <= svg.bottom + 1,
                    fill: getComputedStyle(element.querySelector('path')).fill };
            }));
            result.markerLabelOverlaps = await markers.evaluateAll(elements => elements.flatMap(element => {
                const marker = element.querySelector('path').getBoundingClientRect();
                return [...element.ownerSVGElement.querySelectorAll('text')].flatMap(label => {
                    const text = label.getBoundingClientRect();
                    const width = Math.min(marker.right, text.right) - Math.max(marker.left, text.left);
                    const height = Math.min(marker.bottom, text.bottom) - Math.max(marker.top, text.top);
                    return width > 1 && height > 1 ? [{ marker: element.textContent, label: label.textContent,
                        markerBounds: { left: marker.left, right: marker.right, top: marker.top, bottom: marker.bottom },
                        labelBounds: { left: text.left, right: text.right, top: text.top, bottom: text.bottom },
                        overlap: { width, height } }] : [];
                });
            }));
            check('Saved markers remain inside the rendered chart', result.markerGeometry.every(marker => marker.insideChart));
            result.contrast = await tokenContrast(page);
            const brandColor = result.contrast.find(pair => pair.foreground === 'brand').colors[0];
            check('The actual saved-review diamond uses the measured brand color', result.markerGeometry.every(marker => marker.fill === brandColor));
            check('Measured V8 body, action and semantic badge token contrast meets the recorded 4.5:1 thresholds');
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
            await capture('review-markers', page.getByRole('region', { name: 'Price history', exact: true }));
            assert.deepEqual(result.markerLabelOverlaps, [], 'Saved-review diamonds must not obscure price/date/range labels.');
            await page.getByRole('button', { name: 'Saved research', exact: true }).click();
            await page.getByRole('button', { name: 'Read saved review', exact: true }).click();
            await page.getByText('Fixture saved review note', { exact: true }).first().waitFor();
            await capture('saved-review');
            await page.reload({ waitUntil: 'domcontentloaded' });
            await expectTheme(page, theme, theme);
            assert.equal(await page.getByRole('tab', { name: 'Review', exact: true }).getAttribute('aria-selected'), 'true');
            check('Saved Review tab and chosen theme persist through reload');
        });
        if (!selectedScenario || selectedScenario === 'pins') await scenario(`pins-${theme}`, viewport, {
            theme, storedTheme: theme, pins: '["calendar","calendar","unknown",null]', holdWatchlist: true,
        }, async ({ page, result, check, capture, releaseWatchlist }) => {
            await goWorkspace(page, 'calendar');
            await pinned(page).getByRole('button', { name: 'Calendar', exact: true }).waitFor();
            assert.equal(await pinned(page).getByTestId('research-workspace-attention').count(), 0);
            check('Unloaded saved records do not produce an overdue count');
            releaseWatchlist();
            await pinned(page).getByRole('button', { name: 'Calendar 1 overdue review', exact: true }).waitFor();
            await page.getByText('Fixture overdue authored review', { exact: true }).waitFor();
            assert.equal(await page.locator('html').getAttribute('data-cockpit-theme'), theme);
            check('Loaded saved records produce the one-overdue Calendar badge in the cockpit theme');
            await capture('loaded-overdue-calendar');
            await page.evaluate(key => localStorage.setItem(key, '{malformed JSON'), pinsKey);
            await goWorkspace(page, 'research');
            await pinned(page).getByText('None yet · pin up to 3 workspaces', { exact: true }).waitFor();
            check('Malformed pin storage recovers to usable empty navigation');
            await pinned(page).getByRole('button', { name: 'Pin Watchlist', exact: true }).click();
            assert.deepEqual(await storedPins(page), ['research']);
            await page.reload({ waitUntil: 'domcontentloaded' });
            await pinned(page).getByRole('button', { name: 'Unpin Watchlist', exact: true }).waitFor();
            check('Pinning survives reload');
            await goWorkspace(page, 'calendar');
            await pinned(page).getByRole('button', { name: 'Pin Calendar', exact: true }).click();
            await goWorkspace(page, 'queue');
            await pinned(page).getByRole('button', { name: 'Pin Queue', exact: true }).click();
            await goWorkspace(page, 'policy');
            assert.equal(await pinned(page).getByRole('button', { name: '3 pinned (limit)', exact: true }).isDisabled(), true);
            assert.deepEqual(await storedPins(page), ['research', 'calendar', 'queue']);
            check('The three-pin limit prevents another pin without evicting an existing pin');
            const pinBounds = await pinned(page).getByRole('button').evaluateAll(elements => elements.map(element => {
                const rect = element.getBoundingClientRect();
                return { text: element.textContent, left: rect.left, right: rect.right, height: rect.height };
            }));
            check('All pin controls remain within the viewport and at least 36px high', pinBounds.every(bounds => bounds.left >= -1 && bounds.right <= viewport.width + 1 && bounds.height >= 36));
            result.pinBounds = pinBounds;
            await capture('pin-limit');
            await pinned(page).getByRole('button', { name: 'Calendar 1 overdue review', exact: true }).click();
            await page.waitForURL(url => url.searchParams.get('workspace') === 'calendar');
            await page.getByText('Fixture overdue authored review', { exact: true }).waitFor();
            check('Pinned Calendar reaches the saved overdue review');
            await pinned(page).getByRole('button', { name: 'Clear pins', exact: true }).click();
            assert.deepEqual(await storedPins(page), []);
            await page.reload({ waitUntil: 'domcontentloaded' });
            await pinned(page).getByText('None yet · pin up to 3 workspaces', { exact: true }).waitFor();
            check('Clearing pins persists through reload');
            await page.evaluate(key => localStorage.setItem(key, JSON.stringify(['research', 'research', 'invalid', null, 'calendar', 'queue', 'policy'])), pinsKey);
            await page.reload({ waitUntil: 'domcontentloaded' });
            await pinned(page).getByRole('button', { name: 'Unpin Calendar', exact: true }).waitFor();
            assert.equal(await pinned(page).getByRole('button').count(), 5);
            check('Malformed entries and duplicates are dropped; stored pins are capped at three');
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        });
    }
} finally {
    await browser.close();
    report.status = report.scenarios.every(item => item.status === 'passed') ? 'passed' : 'failed';
    await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ status: report.status, fixtureOnly: true, output, scenarios: report.scenarios.map(({ name, viewport, status, checks, errors, failure }) => ({ name, viewport, status, checkCount: checks.length, errors, failure })) }, null, 2));
if (report.status !== 'passed') process.exitCode = 1;
