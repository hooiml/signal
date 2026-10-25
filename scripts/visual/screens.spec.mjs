import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { test, expect } from 'playwright/test';
import { renderer, playwrightVersion, containerImage } from './environment.mjs';
import { fixedTime, installFixtures } from './fixtures.mjs';

test.beforeAll(async ({}, testInfo) => {
    if (process.env.CI) assert.equal(testInfo.config.updateSnapshots, 'none', 'CI must never accept snapshots.');
    if (process.env.SIGNAL_VISUAL_PROBE) assert.equal(testInfo.config.updateSnapshots, 'none', 'Never accept the intentional failure probe.');
});

async function hydrated(locator) {
    await expect(locator).toBeVisible();
    await expect.poll(() => locator.evaluate(element => Object.keys(element).some(key => key.startsWith('__reactProps$')))).toBe(true);
}

for (const screen of ['market', 'research', 'holdings', 'settings', 'glossary']) {
    test(screen, async ({ page, context, browser, colorScheme }, testInfo) => {
        const observations = { apis: [], errors: [] };
        page.on('pageerror', error => observations.errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') observations.errors.push(message.text()); });
        page.on('requestfailed', request => { if (!request.failure()?.errorText.includes('ERR_ABORTED')) observations.errors.push(`Failed: ${request.url()}`); });
        page.on('response', response => { if (response.status() >= 400) observations.errors.push(`HTTP ${response.status()}: ${response.url()}`); });
        await installFixtures(context, colorScheme, observations);
        await page.clock.setFixedTime(new Date(fixedTime));

        try {
            const market = screen === 'market' || screen === 'settings';
            await page.goto(market ? '/main-v8' : screen === 'holdings' ? '/research-v8' : '/research-v8?ticker=AAPL&market=US', { waitUntil: 'domcontentloaded' });
            const ready = market ? page.getByTestId('connected-score').filter({ visible: true })
                : screen === 'holdings' ? page.getByRole('tablist', { name: 'Research home' })
                    : page.getByTestId('research-price').filter({ visible: true });
            await hydrated(ready);
            if (screen === 'research' || screen === 'glossary') await expect(ready).toHaveText('USD 200.00');
            if (!market) await expect(page.getByText(/Guest workspace/).first()).toBeVisible();
            if (screen === 'holdings') {
                await ready.getByRole('tab', { name: 'Holdings', exact: true }).click();
                await expect(page.locator('#home-panel-holdings')).toContainText('Fixture brokerage');
                await page.locator('#home-panel-holdings').evaluate(element => element.scrollIntoView({ block: 'start' }));
            }
            if (screen === 'settings') {
                await page.getByRole('button', { name: 'Settings', exact: true }).click();
                await expect(page.getByRole('dialog', { name: 'Settings', exact: true })).toBeVisible();
            }
            if (screen === 'glossary') {
                await page.getByRole('tab', { name: 'Valuation', exact: true }).click();
                const trigger = page.locator('button[data-glossary="pe"]:visible').first();
                await trigger.click();
                await expect(page.locator('[data-glossary-panel]:popover-open')).toBeVisible();
            }
            await page.evaluate(async () => {
                const style = getComputedStyle(document.body);
                for (const variable of ['--font-source-sans', '--font-roboto-mono']) {
                    const family = style.getPropertyValue(variable).split(',')[0].trim();
                    if (!family) throw new Error(`Missing bundled font: ${variable}`);
                    await document.fonts.load(`400 16px ${family}`);
                }
                await document.fonts.ready;
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            });
            const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth), fonts: [...document.fonts].filter(font => font.status === 'loaded').map(font => font.family) }));
            expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
            expect(geometry.fonts.some(font => /sourceSans/i.test(font))).toBe(true);
            expect(geometry.fonts.some(font => /robotoMono/i.test(font))).toBe(true);
            await expect(page.getByRole('region', { name: 'First visit to V8', exact: true })).toHaveCount(0);
            // A reversible, test-only controlled change proves that the comparison blocks regressions.
            if (process.env.SIGNAL_VISUAL_PROBE && screen === 'market') await page.addStyleTag({ content: 'body { border-top: 16px solid magenta !important; }' });

            // Missing goldens fail without writing baselines. Still upload a settled candidate for explicit review.
            let previous;
            let actual;
            await expect.poll(async () => {
                actual = await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' });
                const stable = previous?.equals(actual) ?? false;
                previous = actual;
                return stable;
            }, { message: 'Two consecutive captures must be byte-identical' }).toBe(true);
            const candidatePath = testInfo.outputPath(`${screen}-candidate.png`);
            await writeFile(candidatePath, actual);
            await testInfo.attach(`${screen}-candidate`, { path: candidatePath, contentType: 'image/png' });
            await testInfo.attach('geometry', { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' });
            expect(observations.errors).toEqual([]);
            await expect(page).toHaveScreenshot(`${screen}.png`);
            expect(observations.errors).toEqual([]);
        } finally {
            const fontHashes = {};
            for (const name of ['SourceSans3-Variable.woff2', 'RobotoMono-Variable.woff2']) fontHashes[name] = createHash('sha256').update(await readFile(`src/app/fonts/${name}`)).digest('hex');
            const environmentPath = testInfo.outputPath('environment.json');
            await writeFile(environmentPath, JSON.stringify({ renderer, playwrightVersion, browser: browser.version(), os: os.release(), architecture: os.arch(), container: process.env.SIGNAL_VISUAL_CONTAINER ? containerImage : null, fixedTime, locale: 'en-US', timezone: 'Asia/Kuala_Lumpur', dpr: 1, viewport: page.viewportSize(), theme: colorScheme, fontHashes, ...observations }, null, 2));
            await testInfo.attach('environment', { path: environmentPath, contentType: 'application/json' });
        }
    });
}
