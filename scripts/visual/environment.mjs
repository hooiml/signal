import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';

const require = createRequire(import.meta.url);
export const playwrightVersion = require('playwright/package.json').version;
export const containerImage = 'mcr.microsoft.com/playwright:v1.60.0-noble@sha256:9bd26ad900bb5e0f4dee75839e957a89ae89c2b7ab1e76050e559790e946b948';
assert.equal(playwrightVersion, '1.60.0', 'Review the browser, container and baselines together when upgrading Playwright.');

// Never use a Windows golden on Linux, or treat every Windows version as equivalent.
if (process.platform === 'linux') {
    assert.equal(process.env.SIGNAL_VISUAL_CONTAINER, containerImage, 'Linux visual checks require the documented pinned container.');
    assert.match(readFileSync('/etc/os-release', 'utf8'), /VERSION_ID="24\.04"/);
} else {
    assert.equal(process.platform, 'win32', 'Only the documented Linux container and Windows local baselines are configured.');
    assert.ok(!process.env.CI, 'CI must use the pinned Linux rendering environment.');
}
export const renderer = process.platform === 'linux'
    ? 'linux-noble-9bd26ad900bb-pw1.60.0'
    : `win32-${os.release()}-pw${playwrightVersion}`;
export const baseURL = process.env.SIGNAL_QA_URL ?? 'http://127.0.0.1:3000';
const target = new URL(baseURL);
assert.ok(target.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(target.hostname)
    && target.username === '' && target.password === '' && target.pathname === '/' && target.search === '' && target.hash === '',
    'Visual fixtures require an owned local HTTP origin without credentials, path, query or fragment.');
