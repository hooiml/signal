import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.SIGNAL_QA_URL ?? 'http://127.0.0.1:3000';
const out = `.tmp/version-navigation/qa-${Date.now()}`;
await mkdir(out, { recursive: true });
const before = await (await fetch(`${base}/api/research/watchlist`)).text();
const digest = text => createHash('sha256').update(text).digest('hex');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const checks = [], errors = [], requestFailures = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('requestfailed', request => { if (!request.failure()?.errorText.includes('ERR_ABORTED')) requestFailures.push({ url: request.url(), error: request.failure()?.errorText }); });
// Existing research quote batching is a read request. Block persistence during navigation QA.
await context.route('**/api/**', route => {
    if (route.request().method() !== 'GET' && !route.request().url().includes('/api/research/quotes')) return route.fulfill({ status: 200, json: { success: false, error: 'Writes disabled in navigation QA' } });
    return route.continue();
});
const nav = page.getByRole('navigation', { name: 'UI versions' });
async function go(path) {
    const response = await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
    if (path === '/') await page.waitForURL(`${base}/main-v8`);
    assert.equal(response.status(), 200); await nav.waitFor(); await page.locator('header a[href]').first().waitFor();
}
async function verify(experience, version, width) {
    await page.locator('header a[href]').first().waitFor();
    assert.equal(await nav.locator('[aria-current=page]').innerText(), version === 6 ? 'V6' : width <= 600 ? `V${version}` : version === 7 ? 'V7\nPrevious home' : 'V8\nDefault');
    const links = await nav.getByRole('link').evaluateAll(nodes => nodes.map(node => ({ href: node.getAttribute('href'), r: (() => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })() })));
    assert.deepEqual(links.map(link => link.href), [6, 7, 8].map(v => `/${experience}-v${v}`));
    assert.ok(links.every(link => link.r.x >= 0 && link.r.x + link.r.width <= width && link.r.height >= 40));
    assert.ok(links.every((link, i) => !i || link.r.x >= links[i - 1].r.x + links[i - 1].r.width));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    checks.push(`${experience} V${version} ${width}: active version, destinations, targets, overlap and overflow`);
}
async function activate(version, path) {
    const link = nav.getByRole('link', { name: new RegExp(`^V${version}`) });
    await link.focus();
    assert.equal(await link.evaluate(el => getComputedStyle(el).outlineWidth), '3px');
    await Promise.all([page.waitForURL(`${base}${path}`), link.press('Enter')]);
    await nav.waitFor();
    checks.push(`Keyboard version link ${path}`);
}
try {
    const redirect = await fetch(base, { redirect: 'manual' });
    assert.equal(redirect.status, 307);
    assert.equal(redirect.headers.get('location'), '/main-v8');
    checks.push('Root emits HTTP 307 V8 redirect');
    for (const path of ['/main-v8-gemini', '/research-v8-gemini']) {
        assert.equal((await fetch(`${base}${path}`)).status, 404);
        checks.push(`Retired experiment ${path} returns 404`);
    }
    for (const width of [1280, 768, 375]) {
        await page.setViewportSize({ width, height: 900 });
        await go('/'); assert.equal(new URL(page.url()).pathname, '/main-v8'); await verify('main', 8, width);
        await page.screenshot({ caret: 'initial', path: `${out}/market-v8-${width}.png` });
        await activate(7, '/main-v7'); await verify('main', 7, width);
        await page.screenshot({ caret: 'initial', path: `${out}/market-v7-${width}.png` });
        await activate(6, '/main-v6'); await verify('main', 6, width);
        await page.screenshot({ caret: 'initial', path: `${out}/market-v6-${width}.png` });
        await page.goBack({ waitUntil: 'domcontentloaded' }); await nav.waitFor(); await verify('main', 7, width); checks.push(`Back restores V7 ${width}`);
        await go('/research-v8'); await verify('research', 8, width);
        await page.screenshot({ caret: 'initial', path: `${out}/research-v8-${width}.png` });
        await activate(7, '/research-v7'); await verify('research', 7, width);
        await activate(6, '/research-v6'); await verify('research', 6, width);
        await go('/research?workspace=research'); await verify('research', 7, width);
        checks.push(`Existing full research workspace retained ${width}`);
    }
    await page.goto(`${base}/offline`, { waitUntil: 'domcontentloaded' });
    assert.equal(await nav.count(), 0); checks.push('Switcher absent outside versioned experiences');
    const after = await (await fetch(`${base}/api/research/watchlist`)).text();
    assert.equal(digest(before), digest(after)); checks.push('Saved watchlist unchanged');
    assert.deepEqual(errors, []); assert.deepEqual(requestFailures, []);
    await writeFile(`${out}/report.json`, JSON.stringify({ checks, errors, requestFailures, savedWatchlistHash: digest(after) }, null, 2));
    console.log(JSON.stringify({ checks: checks.length, out }));
} catch (error) {
    await writeFile(`${out}/failure.json`, JSON.stringify({ checks, errors, requestFailures, error: error.message }, null, 2));
    await page.screenshot({ caret: 'initial', path: `${out}/failure.png` }); throw error;
} finally { await browser.close(); }
