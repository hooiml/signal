import { defineConfig } from 'playwright/test';
import path from 'node:path';
import { baseURL, renderer } from './environment.mjs';

export default defineConfig({
    testDir: '.',
    testMatch: 'screens.spec.mjs',
    outputDir: '../../.tmp/visual-checks/results',
    snapshotPathTemplate: `{testDir}/baselines/${renderer}/{projectName}/{arg}{ext}`,
    updateSnapshots: 'none',
    forbidOnly: true,
    workers: 1,
    retries: 0,
    timeout: 30_000,
    expect: { timeout: 10_000, toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css', threshold: 0, maxDiffPixels: 0 } },
    reporter: [['list'], ['html', { outputFolder: path.resolve('.tmp/visual-checks/report'), open: 'never' }], ['json', { outputFile: path.resolve('.tmp/visual-checks/results.json') }]],
    use: {
        baseURL, browserName: 'chromium', headless: true,
        locale: 'en-US', timezoneId: 'Asia/Kuala_Lumpur', deviceScaleFactor: 1,
        reducedMotion: 'reduce', serviceWorkers: 'block',
        trace: 'retain-on-failure', screenshot: 'only-on-failure',
    },
    projects: ['light', 'dark'].flatMap(colorScheme => [
        { name: `desktop-${colorScheme}`, use: { viewport: { width: 1280, height: 900 }, colorScheme } },
        { name: `phone-${colorScheme}`, use: { viewport: { width: 375, height: 812 }, colorScheme } },
    ]),
});
