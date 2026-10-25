import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { marketRequestFixture } from './harness/market-request-fixture.mjs';
import { researchReadFixture, researchSnapshotFixture } from './harness/research-read-fixture.mjs';

// G4 is intentionally one browser process. Each scenario gets a new context so preference,
// guest-record and storage-denial states cannot leak into the next assertion.
const base = (process.env.SIGNAL_QA_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const output = path.resolve(process.env.SIGNAL_SETTINGS_OUTPUT ?? '.tmp/v8-settings');
const configKey = 'signal-dashboard-config';
const guestKey = 'signal.guest-research.v1';
const draftPrefix = `${guestKey}.draft.`;
const viewports = [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'tablet', width: 768, height: 900 },
    { name: 'mobile', width: 375, height: 812 },
    { name: 'narrow', width: 320, height: 812 },
];

assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'V8 Settings QA requires an owned local server.');
await mkdir(output, { recursive: true });

const report = { command: 'node scripts/v8-settings-qa.mjs', base, fixtureOnly: true, scenarios: [], fatalError: null };
const settingsDefaults = { market: 'US', mode: 'standard', enableSocial: true };
const validPreferences = { market: 'MY', mode: 'contrarian', enableSocial: false };
const ownerRecord = { ...(await (await researchReadFixture().route.GET()).json()).data[0], companyName: 'Private Owner Apple', notes: 'PRIVATE_OWNER_ONLY' };

const preferenceJson = preference => JSON.stringify({ mode: preference.mode, market: preference.market, enableSocial: preference.enableSocial });
const overflow = page => page.evaluate(() => Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) <= innerWidth + 1);

function scenario(name) {
    const item = { name, checks: [], issues: [], screenshots: [], status: 'failed' };
    report.scenarios.push(item);
    return item;
}
function check(item, name, value, detail = '') {
    item.checks.push({ name, status: value ? 'passed' : 'failed', detail });
    assert.ok(value, `${name}${detail ? `: ${detail}` : ''}`);
}
function snapshot(symbol, market) {
    const fixture = structuredClone(researchSnapshotFixture);
    fixture.data.symbol = symbol;
    fixture.data.market = market ?? 'US';
    fixture.data.quote = { ...fixture.data.quote, name: 'Fixture Apple', price: 200, currency: market === 'MY' ? 'MYR' : 'USD' };
    return fixture;
}

async function installFixtures(context, observations, ownerUnlocked = false) {
    await context.route('**/api/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        observations.requests.push({ method: request.method(), path: `${url.pathname}${url.search}` });
        if (request.method() !== 'GET') observations.privateMutations.push({ method: request.method(), path: url.pathname });
        if (url.pathname === '/api/signals/v2') {
            observations.signalQueries.push(url.search);
            const fixture = marketRequestFixture();
            const response = await fixture.route.GET(fixture.request(url.search.slice(1)));
            return route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
        }
        if (url.pathname === '/api/owner/session') return route.fulfill({ json: { success: true, data: { configured: true, unlocked: ownerUnlocked } } });
        if (url.pathname === '/api/research/watchlist') return ownerUnlocked ? route.fulfill({ json: { success: true, data: [ownerRecord] } }) : route.fulfill({ status: 401, json: { success: false, error: 'Locked fixture owner workspace' } });
        if (url.pathname.startsWith('/api/research/symbol/')) return route.fulfill({ json: snapshot(decodeURIComponent(url.pathname.split('/').at(-1)), url.searchParams.get('market')) });
        if (url.pathname.startsWith('/api/research/')) return route.fulfill({ status: 503, json: { success: false, error: 'Optional fixture unavailable' } });
        return route.fulfill({ status: 503, json: { success: false, error: 'Unexpected fixture request' } });
    });
}

async function wirePage(page, item) {
    page.on('pageerror', error => item.issues.push({ type: 'page-error', message: error.message }));
    page.on('console', message => {
        if (message.type() === 'error' && !/status of (401|500|503)/.test(message.text())) item.issues.push({ type: 'console-error', message: message.text() });
    });
    page.on('requestfailed', request => {
        if (!/ERR_ABORTED/.test(request.failure()?.errorText ?? '')) item.issues.push({ type: 'request-failed', message: `${request.method()} ${request.url()}` });
    });
}
async function openSettings(page) {
    const trigger = page.getByRole('button', { name: 'Settings', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
    await dialog.waitFor();
    return { trigger, dialog };
}
async function closeSettings(dialog) {
    await dialog.getByRole('button', { name: 'Close settings', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
}
async function chooseTheme(page, theme) {
    const { dialog } = await openSettings(page);
    await dialog.getByRole('radio', { name: theme, exact: true }).check();
    await page.waitForFunction(expected => document.documentElement.dataset.v8Theme === expected, theme.toLowerCase());
    await closeSettings(dialog);
}
const defaultMarket = dialog => dialog.getByLabel('Default market', { exact: true });
const defaultMode = dialog => dialog.getByLabel('Default mode', { exact: true });
async function newFixtureContext(browser, item, options = {}) {
    const context = await browser.newContext({ viewport: options.viewport ?? viewports[0], serviceWorkers: 'block' });
    const observations = { requests: [], signalQueries: [], privateMutations: [] };
    if (options.initScript) await context.addInitScript(options.initScript, options.initScriptArgs);
    await installFixtures(context, observations, options.ownerUnlocked);
    const page = await context.newPage();
    await wirePage(page, item);
    return { context, page, observations };
}

async function runLayoutMatrix(browser) {
    for (const viewport of viewports) for (const theme of ['Light', 'Dark']) {
        const item = scenario(`Settings layout ${viewport.name} ${theme.toLowerCase()}`);
        const { context, page, observations } = await newFixtureContext(browser, item, { viewport });
        try {
            await page.goto(`${base}/main-v8`, { waitUntil: 'domcontentloaded' });
            await page.getByTestId('connected-score').waitFor();
            const { trigger, dialog } = await openSettings(page);
            check(item, 'Settings is a mounted native dialog', await dialog.evaluate(node => node instanceof HTMLDialogElement && node.open));
            check(item, 'Settings enters the browser modal top layer', await dialog.evaluate(node => node.matches(':modal')));
            await dialog.getByRole('button', { name: 'Close settings', exact: true }).focus(); await page.keyboard.press('Tab');
            check(item, 'Tab focus stays inside the modal', await dialog.evaluate(node => node.contains(document.activeElement)));
            const ownerLink = dialog.getByRole('link', { name: /Open owner workspace/i });
            await ownerLink.focus(); await page.keyboard.press('Tab');
            const tabAfterOwner = await dialog.evaluate(node => ({
                dialogContainsActive: node.contains(document.activeElement), activeTag: document.activeElement?.tagName,
                activeLabel: document.activeElement?.getAttribute('aria-label'), activeIsBody: document.activeElement === document.body,
                tabbables: Array.from(node.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')).filter(element => (element instanceof HTMLElement || element instanceof SVGElement) && !element.hasAttribute('disabled') && element.tabIndex >= 0).map(element => ({ tag: element.tagName, label: element.getAttribute('aria-label'), text: element.textContent?.trim(), value: element.getAttribute('value') })),
            }));
            check(item, 'Tab wraps from the final Settings control to the first', await dialog.getByRole('button', { name: 'Close settings', exact: true }).evaluate(node => document.activeElement === node), JSON.stringify(tabAfterOwner));
            await dialog.getByRole('button', { name: 'Close settings', exact: true }).focus(); await page.keyboard.press('Shift+Tab');
            check(item, 'Shift+Tab wraps from the first Settings control to the final link', await ownerLink.evaluate(node => document.activeElement === node));
            await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Market', exact: true }).focus();
            check(item, 'modal background cannot receive focus', await dialog.evaluate(node => node.contains(document.activeElement)));
            check(item, 'Settings exposes Default market', await defaultMarket(dialog).count() === 1);
            check(item, 'Settings exposes Default mode', await defaultMode(dialog).count() === 1);
            check(item, 'Settings exposes Include social in score', await dialog.getByRole('checkbox', { name: 'Include social in score', exact: true }).count() === 1);
            check(item, 'Settings exposes explicit Save defaults', await dialog.getByRole('button', { name: 'Save defaults', exact: true }).count() === 1);
            check(item, 'Settings contains all theme choices', await dialog.getByRole('radio').count() === 3);
            const controlBoxes = await dialog.locator('button, select, label:has(input[type="checkbox"]), [role="radiogroup"] > label').evaluateAll(nodes => nodes.map(node => {
                const box = node.getBoundingClientRect(); return { width: box.width, height: box.height, contained: box.left >= -1 && box.right <= innerWidth + 1 };
            }));
            check(item, 'Settings controls are touch-sized and contained', controlBoxes.every(box => box.height >= 44 && box.contained), JSON.stringify(controlBoxes));
            await dialog.getByRole('radio', { name: theme, exact: true }).check();
            await page.waitForFunction(expected => document.documentElement.dataset.v8Theme === expected, theme.toLowerCase());
            check(item, `${theme} applies immediately`, await page.locator('html').getAttribute('data-v8-theme') === theme.toLowerCase());
            check(item, 'Settings has no horizontal overflow', await overflow(page));
            await dialog.getByRole('button', { name: 'Close settings', exact: true }).focus();
            await dialog.evaluate(node => node.scrollTop = 0);
            await dialog.screenshot({ path: path.join(output, `settings-${viewport.width}-${theme.toLowerCase()}.png`) });
            await dialog.evaluate(node => node.scrollTop = node.scrollHeight);
            await dialog.getByRole('link', { name: /Open owner workspace/i }).scrollIntoViewIfNeeded();
            await dialog.screenshot({ path: path.join(output, `settings-lower-${viewport.width}-${theme.toLowerCase()}.png`) });
            await closeSettings(dialog);
            check(item, 'Close restores focus to Settings trigger', await trigger.evaluate(node => document.activeElement === node));
            await page.keyboard.press('Enter');
            const reopened = page.getByRole('dialog', { name: 'Settings', exact: true });
            await reopened.waitFor();
            check(item, 'closed Settings remains mounted with its selected theme', await reopened.getByRole('radio', { name: theme, exact: true }).isChecked());
            await page.keyboard.press('Escape');
            await page.getByRole('dialog', { name: 'Settings', exact: true }).waitFor({ state: 'hidden' });
            check(item, 'keyboard dismissal restores trigger focus', await trigger.evaluate(node => document.activeElement === node));
            check(item, 'Settings interaction does not write private APIs', observations.privateMutations.length === 0, JSON.stringify(observations.privateMutations));
            check(item, 'browser has no blocking errors', item.issues.length === 0, JSON.stringify(item.issues));
            item.status = 'passed';
        } catch (error) { item.issues.push({ type: 'blocking', message: error instanceof Error ? error.message : String(error) }); }
        finally { await context.close(); }
    }
}

async function runNarrowClosedHeaders(browser) {
    const item = scenario('Closed connected headers remain contained at 320px');
    const { context, page } = await newFixtureContext(browser, item, { viewport: viewports.at(-1) });
    try {
        for (const [name, route, ready] of [
            ['market', '/main-v8', () => page.getByTestId('connected-score').waitFor()],
            ['research', '/research-v8', () => page.getByText('Search a company or ticker, or open one from your watchlist or Discover. Reading saves nothing.', { exact: true }).waitFor()],
            ['learn', '/learn', () => page.getByTestId('learn-shell').waitFor()],
        ]) {
            await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded' }); await ready();
            for (const theme of ['Light', 'Dark']) {
                await chooseTheme(page, theme);
                check(item, `${name} ${theme.toLowerCase()} closed header has no overflow`, await overflow(page));
                const headerText = await page.locator('header a, header button').evaluateAll(nodes => nodes.filter(node => node.textContent?.trim() && node.getClientRects().length > 0).map(node => {
                    const range = document.createRange(); range.selectNodeContents(node);
                    const box = node.getBoundingClientRect(); return { text: node.textContent?.trim(), lines: range.getClientRects().length, width: box.width, height: box.height };
                }));
                check(item, `${name} ${theme.toLowerCase()} header labels stay on one line`, headerText.every(item => item.lines === 1), JSON.stringify(headerText));
                const settingsBox = headerText.find(item => item.text === 'Settings');
                check(item, `${name} ${theme.toLowerCase()} Settings button remains 44px`, !!settingsBox && settingsBox.height >= 44 && settingsBox.width >= 44, JSON.stringify(settingsBox));
                await page.screenshot({ path: path.join(output, `header-closed-${name}-320-${theme.toLowerCase()}.png`) });
            }
        }
        item.status = 'passed';
    } catch (error) { item.issues.push({ type: 'blocking', message: error instanceof Error ? error.message : String(error) }); }
    finally { await context.close(); }
}

async function runPreferences(browser) {
    const cases = [
        { name: 'valid saved defaults', value: preferenceJson(validPreferences), expected: validPreferences },
        { name: 'corrupt defaults remain untouched', value: '{broken', expected: settingsDefaults },
        { name: 'extra-key defaults remain untouched', value: JSON.stringify({ ...validPreferences, unexpected: true }), expected: settingsDefaults },
        { name: 'blocked preference read', value: preferenceJson(validPreferences), expected: settingsDefaults, blockRead: true },
    ];
    for (const testCase of cases) {
        const item = scenario(`Settings preference hydration: ${testCase.name}`);
        const { context, page, observations } = await newFixtureContext(browser, item, { initScript: ({ key, value, blockRead }) => {
            localStorage.setItem(key, value);
            if (blockRead) { const getItem = Storage.prototype.getItem; Storage.prototype.getItem = function (name) { if (name === key) throw new DOMException('blocked', 'SecurityError'); return getItem.call(this, name); }; }
        }, initScriptArgs: { key: configKey, value: testCase.value, blockRead: testCase.blockRead }, viewport: viewports[0] });
        try {
            await page.goto(`${base}/main-v8?market=US`, { waitUntil: 'domcontentloaded' });
            await page.getByTestId('connected-score').waitFor();
            const first = new URLSearchParams(observations.signalQueries[0]);
            check(item, 'explicit URL market wins the stored default', first.get('market') === 'US');
            check(item, 'first request uses hydrated default mode', first.get('mode') === testCase.expected.mode);
            check(item, 'first request uses hydrated social default', first.get('enableSocial') === String(testCase.expected.enableSocial));
            if (testCase.name.includes('untouched')) check(item, 'invalid preference bytes were not rewritten during read', await page.evaluate(key => localStorage.getItem(key), configKey) === testCase.value);
            check(item, 'browser has no blocking errors', item.issues.length === 0, JSON.stringify(item.issues));
            item.status = 'passed';
        } catch (error) { item.issues.push({ type: 'blocking', message: error instanceof Error ? error.message : String(error) }); }
        finally { await context.close(); }
    }

    const item = scenario('Settings saves defaults only for the next Market opening');
    const { context, page, observations } = await newFixtureContext(browser, item, { viewport: viewports[0] });
    try {
        await page.goto(`${base}/main-v8`, { waitUntil: 'domcontentloaded' });
        await page.getByTestId('connected-score').waitFor();
        const before = observations.signalQueries.at(-1);
        const { dialog } = await openSettings(page);
        await defaultMarket(dialog).selectOption('MY');
        await defaultMode(dialog).selectOption('contrarian');
        await dialog.getByRole('checkbox', { name: 'Include social in score', exact: true }).uncheck();
        await dialog.getByRole('button', { name: 'Save defaults', exact: true }).click();
        await dialog.getByRole('status').filter({ hasText: /Defaults saved/i }).waitFor();
        check(item, 'saving defaults does not change the current request', observations.signalQueries.at(-1) === before);
        check(item, 'saved defaults retain the exact compact shape', await page.evaluate(key => localStorage.getItem(key), configKey) === preferenceJson(validPreferences));
        await closeSettings(dialog);
        check(item, 'default hydration keeps the original no-query URL', new URL(page.url()).search === '');
        const requestsBeforeDefaultReload = observations.signalQueries.length;
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByTestId('connected-score').waitFor();
        const after = new URLSearchParams(observations.signalQueries.at(-1));
        check(item, 'clean-route reload makes exactly one default-hydrated signal request', observations.signalQueries.length === requestsBeforeDefaultReload + 1, JSON.stringify(observations.signalQueries.slice(requestsBeforeDefaultReload)));
        check(item, 'next Market reload applies saved market', after.get('market') === 'MY');
        check(item, 'next Market reload applies saved mode', after.get('mode') === 'contrarian');
        check(item, 'next Market reload applies saved social setting', after.get('enableSocial') === 'false');
        await page.goto(`${base}/main-v8?market=US`, { waitUntil: 'domcontentloaded' }); await page.getByTestId('connected-score').waitFor();
        let explicit = new URLSearchParams(observations.signalQueries.at(-1));
        check(item, 'explicit URL market overrides the saved market', explicit.get('market') === 'US' && explicit.get('mode') === 'contrarian' && explicit.get('enableSocial') === 'false');
        await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByTestId('connected-score').waitFor();
        explicit = new URLSearchParams(observations.signalQueries.at(-1));
        check(item, 'reload preserves an explicit URL market override', explicit.get('market') === 'US' && explicit.get('mode') === 'contrarian' && explicit.get('enableSocial') === 'false');
        await chooseTheme(page, 'Dark');
        await page.reload({ waitUntil: 'domcontentloaded' });
        check(item, 'explicit theme survives reload', await page.locator('html').getAttribute('data-v8-theme') === 'dark');
        item.status = 'passed';
    } catch (error) { item.issues.push({ type: 'blocking', message: error instanceof Error ? error.message : String(error) }); }
    finally { await context.close(); }

    const blocked = scenario('Settings reports a blocked defaults write without changing the view');
    const blockedFixture = await newFixtureContext(browser, blocked, { initScript: key => {
        const setItem = Storage.prototype.setItem; Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException('full', 'QuotaExceededError'); return setItem.call(this, name, value); };
    }, initScriptArgs: configKey, viewport: viewports[0] });
    try {
        await blockedFixture.page.goto(`${base}/main-v8`, { waitUntil: 'domcontentloaded' });
        await blockedFixture.page.getByTestId('connected-score').waitFor();
        const { dialog } = await openSettings(blockedFixture.page);
        await dialog.getByRole('button', { name: 'Save defaults', exact: true }).click();
        await dialog.getByRole('alert').waitFor();
        check(blocked, 'write failure leaves no preferences bytes', await blockedFixture.page.evaluate(key => localStorage.getItem(key), configKey) === null);
        check(blocked, 'write failure does not issue a new Market request', blockedFixture.observations.signalQueries.length === 1);
        blocked.status = 'passed';
    } catch (error) { blocked.issues.push({ type: 'blocking', message: error instanceof Error ? error.message : String(error) }); }
    finally { await blockedFixture.context.close(); }
}

async function runGuestActions(browser) {
    const item = scenario('Settings guest export, clear, recovery and isolation');
    const { context, page, observations } = await newFixtureContext(browser, item, { viewport: viewports[0], initScript: ({ guestKey, draftPrefix, configKey }) => {
        if (!localStorage.getItem('signal-settings-qa-seeded')) {
            const guestId = '11111111-1111-4111-8111-111111111111'; const draftId = '22222222-2222-4222-8222-222222222222';
            localStorage.setItem(guestKey, JSON.stringify({ version: 1, guestId, records: [{ symbol: 'AAPL', market: 'US', companyName: 'Fixture Apple', notes: 'Saved guest note' }] }));
            localStorage.setItem(`${draftPrefix}${guestId}.${draftId}`, JSON.stringify({ version: 1, guestId, id: draftId, symbol: 'AAPL', market: 'US', text: 'Recoverable unsaved draft', expectedNote: 'Saved guest note', updatedAt: '2026-10-25T00:00:00.000Z' }));
            localStorage.setItem(configKey, JSON.stringify({ mode: 'contrarian', market: 'MY', enableSocial: false })); localStorage.setItem('signal-learn-v0.4-progress', JSON.stringify({ version: 4, completedModules: ['price-structure'], completedWorkspaces: [] })); localStorage.setItem('signal-settings-qa-seeded', '1');
        }
    }, initScriptArgs: { guestKey, draftPrefix, configKey }, viewport: viewports[0] });
    try {
        await page.goto(`${base}/main-v8`, { waitUntil: 'domcontentloaded' });
        await page.getByTestId('connected-score').waitFor();
        const { dialog } = await openSettings(page);
        let cancelledDownloads = 0; page.once('download', () => { cancelledDownloads += 1; });
        page.once('dialog', native => { check(item, 'export warning is native confirmation', native.type() === 'confirm' && /draft/i.test(native.message())); native.dismiss(); });
        await dialog.getByRole('button', { name: 'Export guest research', exact: true }).click();
        await page.evaluate(() => new Promise(requestAnimationFrame));
        check(item, 'cancelled export creates no download or private mutation', cancelledDownloads === 0 && observations.privateMutations.length === 0);
        const download = page.waitForEvent('download');
        page.once('dialog', native => native.accept());
        await dialog.getByRole('button', { name: 'Export guest research', exact: true }).click();
        const exported = JSON.parse(await (await download).createReadStream().then(async stream => { let text = ''; for await (const chunk of stream) text += chunk; return text; }));
        check(item, 'continued export includes only saved guest research', exported.records[0].notes === 'Saved guest note' && !JSON.stringify(exported).includes('Recoverable unsaved draft'));
        check(item, 'Settings works outside Research', new URL(page.url()).pathname === '/main-v8');
        await closeSettings(dialog);

        await page.goto(`${base}/research-v8?ticker=AAPL&market=US`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'Restore AAPL draft', exact: true }).waitFor();
        const peer = await context.newPage(); await wirePage(peer, item); await peer.goto(`${base}/research-v8?ticker=AAPL&market=US`, { waitUntil: 'domcontentloaded' });
        await peer.getByRole('button', { name: 'Restore AAPL draft', exact: true }).waitFor();
        const researchSettings = await openSettings(page);
        page.once('dialog', native => native.dismiss());
        await researchSettings.dialog.getByRole('button', { name: 'Clear guest research', exact: true }).click();
        check(item, 'cancelled clear preserves guest records', await page.evaluate(key => localStorage.getItem(key), guestKey) !== null);
        page.once('dialog', native => { check(item, 'clear uses native confirmation', native.type() === 'confirm'); native.accept(); });
        await researchSettings.dialog.getByRole('button', { name: 'Clear guest research', exact: true }).click();
        await page.waitForFunction(({ guestKey, draftPrefix }) => localStorage.getItem(guestKey) === null && Object.keys(localStorage).every(key => !key.startsWith(draftPrefix)), { guestKey, draftPrefix });
        check(item, 'confirmed clear removes saved data and backup drafts', true);
        await closeSettings(researchSettings.dialog);
        check(item, 'same-tab Research reacts without a private request', observations.privateMutations.length === 0, JSON.stringify(observations.privateMutations));
        await peer.getByRole('button', { name: 'Save stock', exact: true }).waitFor();
        check(item, 'guest clear updates the already-open second Research tab', await peer.evaluate(key => localStorage.getItem(key), guestKey) === null);
        await peer.close();
        await page.goto(`${base}/learn`, { waitUntil: 'domcontentloaded' });
        await page.getByTestId('learn-shell').waitFor();
        check(item, 'clear does not remove Market preferences', await page.evaluate(key => localStorage.getItem(key), configKey) === preferenceJson(validPreferences));
        check(item, 'clear leaves Learn progress bytes untouched', await page.evaluate(() => localStorage.getItem('signal-learn-v0.4-progress')) === JSON.stringify({ version: 4, completedModules: ['price-structure'], completedWorkspaces: [] }));
        check(item, 'clear leaves Learn reachable', new URL(page.url()).pathname === '/learn');
        item.status = 'passed';
    } catch (error) { item.issues.push({ type: 'blocking', message: error instanceof Error ? error.message : String(error) }); }
    finally { await context.close(); }
}

async function runDirtyAndUnlock(browser) {
    const item = scenario('Settings preserves dirty Research and provides a safe owner link');
    const { context, page, observations } = await newFixtureContext(browser, item, { viewport: viewports[0], initScript: key => localStorage.setItem(key, JSON.stringify({ version: 1, guestId: '11111111-1111-4111-8111-111111111111', records: [{ symbol: 'AAPL', market: 'US', companyName: 'Fixture Apple', notes: '' }] })), initScriptArgs: guestKey });
    try {
        await page.goto(`${base}/research-v8?ticker=AAPL&market=US&tab=financials&advanced=1#review`, { waitUntil: 'domcontentloaded' });
        const note = page.getByLabel('Personal note for AAPL', { exact: true });
        await note.waitFor();
        await note.fill('Unsaved note survives Settings');
        const { dialog } = await openSettings(page);
        await closeSettings(dialog);
        check(item, 'open and close leave dirty editor mounted', await note.inputValue() === 'Unsaved note survives Settings');
        const { dialog: ownerSettings } = await openSettings(page);
        const ownerLink = ownerSettings.getByRole('link', { name: /Open owner workspace/i });
        check(item, 'owner workspace opens in a new tab', await ownerLink.getAttribute('target') === '_blank');
        const href = await ownerLink.getAttribute('href');
        const ownerUrl = new URL(href, base);
        check(item, 'owner link targets the existing unlock route', ownerUrl.pathname === '/unlock');
        check(item, 'owner link retains the exact full Research return path', ownerUrl.searchParams.get('next') === '/research-v8?ticker=AAPL&market=US&tab=financials&advanced=1#review');
        await closeSettings(ownerSettings);
        check(item, 'Settings never writes private owner APIs', observations.privateMutations.length === 0, JSON.stringify(observations.privateMutations));
        item.status = 'passed';
    } catch (error) { item.issues.push({ type: 'blocking', message: error instanceof Error ? error.message : String(error) }); }
    finally { await context.close(); }
}

async function runClearFailureAndPendingBackup(browser) {
    const item = scenario('Settings clear rolls back failures and cannot resurrect a queued draft backup');
    const holdingsKey = 'signal-portfolio-holdings-v1';
    const { context, page } = await newFixtureContext(browser, item, { viewport: viewports[0], initScript: ({ guestKey, draftPrefix, configKey, holdingsKey }) => {
        if (!localStorage.getItem('signal-settings-clear-qa-seeded')) {
            const guestId = '11111111-1111-4111-8111-111111111111'; const draftId = '33333333-3333-4333-8333-333333333333';
            localStorage.setItem(guestKey, JSON.stringify({ version: 1, guestId, records: [{ symbol: 'AAPL', market: 'US', companyName: 'Fixture Apple', notes: 'Guest record survives failed clear' }] }));
            localStorage.setItem(`${draftPrefix}${guestId}.${draftId}`, JSON.stringify({ version: 1, guestId, id: draftId, symbol: 'AAPL', market: 'US', text: 'Queued recovery backup', expectedNote: 'Guest record survives failed clear', updatedAt: '2026-10-25T00:00:00.000Z' }));
            localStorage.setItem(configKey, JSON.stringify({ market: 'MY', mode: 'contrarian', enableSocial: false }));
            localStorage.setItem(holdingsKey, JSON.stringify({ version: 1, holdings: [{ symbol: 'AAPL', market: 'US', quantity: 2 }] })); localStorage.setItem('signal-settings-clear-qa-seeded', '1');
        }
    }, initScriptArgs: { guestKey, draftPrefix, configKey, holdingsKey }, viewport: viewports[0] });
    try {
        await page.goto(`${base}/research-v8?ticker=AAPL&market=US`, { waitUntil: 'domcontentloaded' });
        const preferencesBeforeClear = await page.evaluate(key => localStorage.getItem(key), configKey);
        await page.getByRole('button', { name: 'Restore AAPL draft', exact: true }).waitFor();
        await page.evaluate(key => { window.qaRemoveItem = Storage.prototype.removeItem; Storage.prototype.removeItem = function (name) { if (name === key) throw new DOMException('blocked', 'SecurityError'); return window.qaRemoveItem.call(this, name); }; }, guestKey);
        const failed = await openSettings(page);
        page.once('dialog', native => native.accept());
        await failed.dialog.getByRole('button', { name: 'Clear guest research', exact: true }).click();
        await failed.dialog.getByRole('alert').waitFor();
        check(item, 'failed clear preserves guest bytes', await page.evaluate(key => localStorage.getItem(key), guestKey) !== null);
        check(item, 'failed clear preserves recovery backups', await page.evaluate(prefix => Object.keys(localStorage).some(key => key.startsWith(prefix)), draftPrefix));
        await closeSettings(failed.dialog);
        await page.evaluate(() => { Storage.prototype.removeItem = window.qaRemoveItem; delete window.qaRemoveItem; });

        // Queue recovery first, then clear under the same Web Lock. A late restoration must not recreate either key.
        await page.evaluate(() => { window.qaLockHeld = false; void navigator.locks.request('signal.guest-research.v1', () => new Promise(resolve => { window.qaLockRelease = resolve; window.qaLockHeld = true; })); });
        await page.waitForFunction(() => window.qaLockHeld === true);
        await page.getByRole('button', { name: 'Restore AAPL draft', exact: true }).click();
        await page.waitForFunction(async () => ((await navigator.locks.query()).pending ?? []).some(lock => lock.name === 'signal.guest-research.v1'));
        const pending = await openSettings(page);
        page.once('dialog', native => native.accept());
        await pending.dialog.getByRole('button', { name: 'Clear guest research', exact: true }).click();
        await page.evaluate(() => window.qaLockRelease());
        await page.waitForFunction(({ guestKey, draftPrefix }) => localStorage.getItem(guestKey) === null && Object.keys(localStorage).every(key => !key.startsWith(draftPrefix)), { guestKey, draftPrefix });
        check(item, 'queued backup cannot resurrect after confirmed clear', true);
        check(item, 'clear leaves imported holdings untouched', await page.evaluate(key => localStorage.getItem(key), holdingsKey) === JSON.stringify({ version: 1, holdings: [{ symbol: 'AAPL', market: 'US', quantity: 2 }] }));
        check(item, 'clear leaves preference bytes untouched', await page.evaluate(key => localStorage.getItem(key), configKey) === preferencesBeforeClear);
        item.status = 'passed';
    } catch (error) { item.issues.push({ type: 'blocking', message: error instanceof Error ? error.message : String(error) }); }
    finally { await context.close(); }
}

async function runOwnerClearIsolation(browser) {
    const item = scenario('Settings clear preserves an unlocked owner workspace');
    const { context, page, observations } = await newFixtureContext(browser, item, { ownerUnlocked: true, viewport: viewports[0], initScript: key => localStorage.setItem(key, JSON.stringify({ version: 1, guestId: '11111111-1111-4111-8111-111111111111', records: [{ symbol: 'AAPL', market: 'US', companyName: 'Guest Apple', notes: 'guest-only' }] })), initScriptArgs: guestKey });
    try {
        await page.goto(`${base}/research-v8?ticker=AAPL&market=US`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: 'Private Owner Apple', exact: true }).waitFor();
        const { dialog } = await openSettings(page);
        page.once('dialog', native => native.accept());
        await dialog.getByRole('button', { name: 'Clear guest research', exact: true }).click();
        await page.waitForFunction(key => localStorage.getItem(key) === null, guestKey);
        await closeSettings(dialog);
        check(item, 'clear leaves the mounted owner record visible', await page.getByRole('heading', { name: 'Private Owner Apple', exact: true }).count() === 1);
        check(item, 'clear does not mutate owner APIs', observations.privateMutations.length === 0, JSON.stringify(observations.privateMutations));
        item.status = 'passed';
    } catch (error) { item.issues.push({ type: 'blocking', message: error instanceof Error ? error.message : String(error) }); }
    finally { await context.close(); }
}

async function runLegacyConfigSmoke(browser) {
    for (const testCase of [
        { name: 'valid stored defaults', value: preferenceJson(validPreferences), expected: validPreferences },
        { name: 'corrupt stored defaults', value: '{broken', expected: settingsDefaults, error: /Saved defaults could not be read/ },
        { name: 'blocked explicit write', value: null, expected: settingsDefaults, blockWrite: true, error: /Could not save defaults/ },
    ]) {
        const item = scenario(`Retained Market tools config smoke: ${testCase.name}`);
        const { context, page, observations } = await newFixtureContext(browser, item, { initScript: ({ key, value, blockWrite }) => {
            if (value !== null) localStorage.setItem(key, value);
            if (blockWrite) { const setItem = Storage.prototype.setItem; Storage.prototype.setItem = function (name, next) { if (name === key) throw new DOMException('full', 'QuotaExceededError'); return setItem.call(this, name, next); }; }
        }, initScriptArgs: { key: configKey, value: testCase.value, blockWrite: testCase.blockWrite }, viewport: viewports[0] });
        try {
            await page.goto(`${base}/market/tools`, { waitUntil: 'domcontentloaded' });
            await page.locator('[data-market-controls]').waitFor();
            const request = new URLSearchParams(observations.signalQueries.at(-1));
            check(item, 'retained Market tools reads the validated defaults', request.get('market') === testCase.expected.market && request.get('mode') === testCase.expected.mode && request.get('enableSocial') === String(testCase.expected.enableSocial));
            if (testCase.error) {
                if (testCase.blockWrite) await page.getByRole('button', { name: 'Contrarian', exact: true }).first().click();
                await page.getByRole('alert').filter({ hasText: testCase.error }).waitFor();
                check(item, 'retained Market tools leaves blocked explicit preference writes absent', !testCase.blockWrite || await page.evaluate(key => localStorage.getItem(key), configKey) === null);
            }
            item.status = 'passed';
        } catch (error) { item.issues.push({ type: 'blocking', message: error instanceof Error ? error.message : String(error) }); }
        finally { await context.close(); }
    }
}

let browser;
try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--no-sandbox'] });
    await runLayoutMatrix(browser);
    await runNarrowClosedHeaders(browser);
    await runPreferences(browser);
    await runGuestActions(browser);
    await runDirtyAndUnlock(browser);
    await runClearFailureAndPendingBackup(browser);
    await runOwnerClearIsolation(browser);
    await runLegacyConfigSmoke(browser);
} catch (error) {
    report.fatalError = error instanceof Error ? error.message : String(error);
} finally {
    if (browser) await browser.close();
    report.status = report.fatalError || report.scenarios.some(item => item.status !== 'passed') ? 'failed' : 'passed';
    await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ status: report.status, output, scenarios: report.scenarios.map(({ name, status, issues }) => ({ name, status, issues })), fatalError: report.fatalError }, null, 2));
if (report.status !== 'passed') process.exitCode = 1;
