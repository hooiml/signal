import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { researchReadFixture, researchSnapshotFixture } from './harness/research-read-fixture.mjs';
import { fulfillEarningsCalendarRead } from './qa-earnings-calendar-fixture.mjs';

const base = process.env.SIGNAL_QA_URL || 'http://127.0.0.1:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const out = '.tmp/v8-data-gaps'; await mkdir(out, { recursive: true });
const watchlist = await (await researchReadFixture().route.GET()).json();
const report = [], errors = [], requests = [];
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--no-sandbox'] });
let variant = 'missing', owner = false, valuation = 'unavailable';
try {
 const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
 await context.route('**/api/**', async route => {
  const req = route.request(), url = new URL(req.url()); requests.push({ method: req.method(), path: url.pathname, query: url.search });
  if (await fulfillEarningsCalendarRead(route)) return;
  assert.equal(req.method(), 'GET', `Unexpected mutation ${req.method()} ${url.pathname}`);
  if (url.pathname === '/api/owner/session') return route.fulfill({ json: { success: true, data: { configured: owner, unlocked: owner } } });
  if (url.pathname === '/api/research/watchlist') return route.fulfill({ json: owner ? watchlist : { success: true, data: [], archivedSymbols: [] } });
  if (url.pathname.startsWith('/api/research/symbol/')) {
   const data = structuredClone(researchSnapshotFixture), market = url.searchParams.get('market');
   Object.assign(data.data, { symbol: decodeURIComponent(url.pathname.split('/').at(-1)), market, fetchedAt: new Date().toISOString() });
   Object.assign(data.data.quote, { name: 'Fixture company', currency: market === 'MY' ? 'MYR' : 'USD' });
   if (variant === 'populated') Object.assign(data.data.fundamentals, { annualRevenue: 1000000, annualNetIncome: 100000, freeCashFlow: 50000, revenueGrowthPercent: 5, source: 'Yahoo Finance', reportingPeriod: '2025-12-31' });
   if (variant === 'partial') data.data.fundamentals.annualRevenue = 1000000;
   if (variant === 'zero') data.data.fundamentals.annualRevenue = 0;
   if (variant === 'growth') data.data.fundamentals.revenueGrowthPercent = 5;
   return route.fulfill({ json: data });
  }
  if (url.pathname.startsWith('/api/research/valuation-history/')) {
   if (valuation === 'error') return route.fulfill({ status: 503, json: { success: false, error: 'Controlled valuation failure' } });
   const capability = status => ({ status, detail: `Fixture ${status} detail` });
   return route.fulfill({ json: { success: true, data: { symbol: decodeURIComponent(url.pathname.split('/').at(-1)), market: url.searchParams.get('market'), companyName: 'Fixture company', generatedAt: new Date().toISOString(), observationKind: 'filing observation', priceConvention: 'Fixture prices', capabilities: { historicalPrices: capability('available'), periodCorrectFundamentals: capability(valuation), analystEstimateRevisions: capability('unavailable') }, observations: [], sources: [], warnings: ['Fixture warning'] } } });
  }
  throw new Error(`Unexpected fixture API: ${req.method()} ${url.pathname}`);
 });
 const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
 page.on('console', m => { if (['error', 'warning'].includes(m.type()) && !/Service Worker registration blocked|503/.test(m.text())) errors.push(m.text()); });
 page.on('requestfailed', r => { if (!/ERR_ABORTED/.test(r.failure()?.errorText || '')) errors.push(r.failure()?.errorText); });
 const open = async (market = 'MY') => { await page.goto(`${base}/research-v8?ticker=${market === 'MY' ? '5347' : 'AAPL'}&market=${market}`); await page.getByTestId('research-price').filter({ hasText: '200' }).waitFor(); };
 for (const role of [false, true]) {
  owner = role; variant = 'populated'; const start = requests.length; await open();
  assert.equal(await page.getByTestId('research-market-coverage').count(), 1); assert.equal(await page.getByTestId('earnings-ticket').count(), 0);
  await page.getByRole('tab', { name: 'Financials', exact: true }).click(); await page.getByText('Annual revenue', { exact: true }).waitFor();
  if (role) assert.ok(requests.slice(start).some(r => r.path === '/api/research/watchlist'));
  await page.getByRole('tab', { name: 'Filings', exact: true }).click(); await page.getByRole('link', { name: /Bursa Malaysia/ }).waitFor();
  assert.equal(requests.slice(start).filter(r => /calendar|filing/.test(r.path)).length, 0); report.push(`PASS ${role ? 'owner' : 'guest'} MY populated and coverage`);
 }
 owner = false;
 for (const value of ['missing', 'partial', 'zero', 'growth']) {
  variant = value; await open('US'); assert.equal(await page.getByTestId('research-market-coverage').count(), 0);
  await page.getByRole('tab', { name: 'Financials', exact: true }).click();
  await page.getByRole('heading', { name: 'Business performance' }).waitFor();
  assert.equal(await page.getByText('Annual revenue', { exact: true }).count(), value === 'missing' ? 0 : 1, value);
  if (value === 'growth') await page.getByText('Exact amount and comparison', { exact: true }).first().click();
  const panelText = await page.getByRole('tabpanel').innerText();
  if (value === 'partial') assert.match(panelText, /1 million/);
  if (value === 'zero') assert.match(panelText, /\b0\b/);
  if (value === 'growth') assert.match(panelText, /5(?:\.0)?%/);
  if (value === 'missing') await page.getByRole('region', { name: 'Financials availability' }).waitFor();
  report.push(`PASS US financial ${value}`);
 }
 for (const state of ['unavailable', 'available', 'error']) {
  valuation = state; variant = 'populated'; await open('US'); await page.getByRole('tab', { name: 'Valuation', exact: true }).click(); await page.getByTestId('v8-historical-valuation').locator('summary').first().click();
  if (state === 'error') { await page.getByText('Controlled valuation failure').waitFor(); report.push('PASS valuation error'); continue; }
  const empty = page.getByTestId('v8-historical-valuation-empty'); await empty.waitFor();
  const copy = await empty.innerText(); if (state === 'unavailable') assert.match(copy, /period.correct/i); else assert.doesNotMatch(copy, /period.correct.*unavailable/i);
  const summary = page.getByText('Coverage and source details', { exact: true }); await summary.focus(); await page.keyboard.press('Enter'); await page.getByText('Fixture warning').waitFor(); report.push(`PASS valuation ${state} disclosure keyboard`);
 }
 valuation = 'unavailable'; variant = 'populated';
 for (const width of [1280, 768, 375, 320]) for (const theme of ['light', 'dark']) {
  await page.setViewportSize({ width, height: 900 }); await open('MY');
  await page.getByRole('button', { name: 'Settings', exact: true }).click(); const dialog = page.getByRole('dialog', { name: 'Settings' }); await dialog.getByRole('radio', { name: theme === 'light' ? 'Light' : 'Dark', exact: true }).check(); await dialog.getByRole('button', { name: 'Close settings' }).click();
  await page.getByRole('tab', { name: 'Financials', exact: true }).click(); await page.getByText('Annual revenue', { exact: true }).waitFor();
  const geometry = await page.evaluate(() => { const visible = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'; const nodes = [...document.querySelectorAll('[data-testid="research-market-coverage"], [role="tabpanel"] h2, [role="tabpanel"] h3, [role="tabpanel"] p, [role="tabpanel"] dt, [role="tabpanel"] dd')].filter(visible); return { overflow: document.documentElement.scrollWidth - innerWidth, out: nodes.map(e => ({ text: e.textContent?.slice(0, 80), box: e.getBoundingClientRect().toJSON() })).filter(({ box }) => box.left < -1 || box.right > innerWidth + 1) }; });
  assert.ok(geometry.overflow <= 1 && geometry.out.length === 0, `geometry ${width} ${theme}: ${JSON.stringify(geometry)}`);
  await page.screenshot({ path: `${out}/my-financials-${width}-${theme}.png`, fullPage: true }); report.push(`PASS ${width} ${theme} geometry`);
  variant = 'missing'; await open('US'); await page.getByRole('tab', { name: 'Financials', exact: true }).click(); await page.getByRole('region', { name: 'Financials availability' }).waitFor(); await page.screenshot({ path: `${out}/missing-financials-${width}-${theme}.png`, fullPage: true });
  await page.getByRole('tab', { name: 'Valuation', exact: true }).click(); await page.getByTestId('v8-historical-valuation').locator('summary').first().click(); await page.getByTestId('v8-historical-valuation-empty').waitFor(); await page.screenshot({ path: `${out}/empty-valuation-${width}-${theme}.png`, fullPage: true }); variant = 'populated';
 }
 assert.deepEqual(errors, []); await context.close();
} catch (error) { report.push(`FAIL ${error.stack || error}`); throw error; }
finally { await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify({ fixtureOnly: true, report, requests, errors }, null, 2)); }
console.log(report.join('\n'));
