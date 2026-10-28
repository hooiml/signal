import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { researchReadFixture, researchSnapshotFixture } from './harness/research-read-fixture.mjs';

const base = process.env.SIGNAL_QA_URL || 'http://127.0.0.1:3113';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const out = '.tmp/research-earnings';
await mkdir(out, { recursive: true });
const ownerWatchlist = await (await researchReadFixture().route.GET()).json();
const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const identity = (symbol, market) => [{ symbol, market, nextReviewAt: null, lastReviewedAt: null, reviewAgeDays: null, earningsWithinDays: 30 }];
const result = (symbol, market, timing = 'pre-market') => ({ success: true, data: { generatedAt: new Date().toISOString(), rangeDays: 30, timezone: 'UTC', events: [{ id: `${symbol}-earnings-${date}`, symbol, market, type: 'earnings', title: 'Earnings announcement', detail: 'Fixture', source: 'Nasdaq earnings calendar', sourceDate: date, displayDate: date, timezone: 'UTC', freshness: 'scheduled', urgency: 'upcoming', targetHref: `/research?ticker=${symbol}&tab=events`, earningsTiming: timing }], macroEvents: [], warnings: [] } });
const snapshot = (symbol, market) => { const data = structuredClone(researchSnapshotFixture); Object.assign(data.data, { symbol, market, fetchedAt: new Date().toISOString() }); Object.assign(data.data.quote, { name: `Fixture ${symbol}`, currency: market === 'MY' ? 'MYR' : 'USD' }); return data; };
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--no-sandbox'] });
const report = []; const errors = []; const requests = [];
let mode = 'success', timing = 'pre-market', owner = false, releaseSlow;
try {
 const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
 await context.route('**/api/**', async route => {
  const request = route.request(), url = new URL(request.url());
  requests.push({ method: request.method(), path: url.pathname, query: url.search, body: request.postData() });
  if (url.pathname === '/api/owner/session') return route.fulfill({ json: { success: true, data: { configured: owner, unlocked: owner } } });
  if (url.pathname === '/api/research/watchlist') { assert.equal(request.method(), 'GET'); return route.fulfill({ json: owner ? ownerWatchlist : { success: true, data: [], archivedSymbols: [] } }); }
  if (url.pathname.startsWith('/api/research/symbol/')) return route.fulfill({ json: snapshot(decodeURIComponent(url.pathname.split('/').at(-1)), url.searchParams.get('market')) });
  if (url.pathname === '/api/research/calendar') {
   if (!url.searchParams.has('type')) return route.fulfill({ json: { success: true, data: { generatedAt: new Date().toISOString(), rangeDays: 30, timezone: 'UTC', events: [], macroEvents: [], warnings: [] } } });
   assert.equal(request.method(), 'POST'); assert.equal(url.searchParams.get('range'), '30'); assert.equal(url.searchParams.get('type'), 'earnings');
   const symbol = url.searchParams.get('ticker'), market = url.searchParams.get('market'); assert.equal(market, 'US'); assert.deepEqual(request.postDataJSON(), identity(symbol, market));
   const captured = mode;
   if (captured === 'slow' && symbol === 'AAPL') await new Promise(resolve => { releaseSlow = resolve; });
   if (captured === 'http') return route.fulfill({ status: 503, json: { success: false } }).catch(() => {});
   let data = result(symbol, market, timing);
   if (captured === 'empty') data.data.events = [];
   if (captured === 'legacy') delete data.data.events[0].earningsTiming;
   if (captured === 'warning') data.data.warnings = ['Provider unavailable'];
   if (captured === 'malformed') data = { success: true, data: {} };
   if (captured === 'symbol') data.data.events[0].symbol = 'MSFT';
   if (captured === 'market') data.data.events[0].market = 'MY';
   return route.fulfill({ json: data }).catch(() => {});
  }
  return route.fulfill({ json: { success: true, data: [] } });
 });
 const page = await context.newPage();
 page.on('pageerror', e => errors.push(e.message));
 page.on('console', m => { if (['error', 'warning'].includes(m.type()) && !/Service Worker registration blocked|503/.test(m.text())) errors.push(m.text()); });
 page.on('requestfailed', r => { if (!/ERR_ABORTED/.test(r.failure()?.errorText || '')) errors.push(r.failure()?.errorText); });
 const open = async (symbol = 'AAPL', market = 'US') => { await page.goto(`${base}/research-v8?ticker=${symbol}&market=${market}`); await page.getByRole('region', { name: 'Current provider quote' }).getByTestId('research-price').filter({ hasText: '200' }).waitFor(); };
 const ticket = page.getByTestId('earnings-ticket');
 for (const [value, label] of [['pre-market', 'before open'], ['after-hours', 'after close'], ['time-not-supplied', 'time not supplied']]) {
  mode = 'success'; timing = value; await open(); await ticket.getByText(label).waitFor(); const text = await ticket.innerText(); assert.match(text, /Date unconfirmed/); assert.doesNotMatch(text, /countdown|days? (?:left|away)/i); report.push(`PASS timing ${value}`);
 }
 mode = 'legacy'; await open(); await ticket.getByText('time not supplied').waitFor(); report.push('PASS legacy omitted timing'); mode = 'success';
 await ticket.focus(); const popupPromise = page.waitForEvent('popup'); await page.keyboard.press('Enter'); const popup = await popupPromise; await popup.waitForLoadState('domcontentloaded');
 const target = new URL(popup.url()); assert.equal(target.pathname, '/research-v8'); assert.equal(target.searchParams.get('ticker'), 'AAPL'); assert.equal(target.searchParams.get('market'), 'US'); assert.equal(target.searchParams.get('discover'), 'calendar'); assert.equal(target.searchParams.get('calendarDate'), date); assert.equal(target.hash, '#discover');
 const agenda = popup.getByRole('region', { name: 'Selected day' }); await agenda.getByText('Earnings announcement').waitFor(); assert.match(await agenda.innerText(), /AAPL[\s\S]*Date unconfirmed/); assert.equal(await popup.locator(`[data-testid="research-calendar-grid"] button[aria-pressed="true"] time[datetime="${date}"]`).count(), 1); assert.equal(requests.filter(r => r.path === '/api/research/discovery').length, 0); report.push('PASS keyboard link, targeted calendar, selected day and no discovery scan');
 await popup.getByText('Change stock', { exact: true }).click(); await popup.getByLabel('Company or ticker', { exact: true }).fill('MSFT'); await popup.getByRole('button', { name: 'Read ticker directly', exact: true }).click(); await popup.getByRole('heading', { level: 1, name: 'Fixture MSFT' }).waitFor(); let switched = new URL(popup.url()); assert.equal(switched.searchParams.get('ticker'), 'MSFT'); assert.equal(switched.searchParams.has('calendarDate'), false); assert.equal(switched.searchParams.has('discover'), false); assert.equal(await popup.getByText('AAPL · US earnings').count(), 0);
 await popup.goBack(); await popup.getByRole('region', { name: 'Selected day' }).getByText('Earnings announcement').waitFor(); assert.equal(new URL(popup.url()).searchParams.get('ticker'), 'AAPL'); assert.equal(await popup.locator(`[data-testid="research-calendar-grid"] button[aria-pressed="true"] time[datetime="${date}"]`).count(), 1); assert.match(await popup.getByRole('region', { name: 'Selected day' }).innerText(), /AAPL/);
 await popup.goForward(); await popup.getByRole('heading', { level: 1, name: 'Fixture MSFT' }).waitFor(); switched = new URL(popup.url()); assert.equal(switched.searchParams.get('ticker'), 'MSFT'); assert.equal(switched.searchParams.has('calendarDate'), false); assert.equal(switched.searchParams.has('discover'), false); assert.equal(await popup.getByText('AAPL · US earnings').count(), 0); await popup.close(); report.push('PASS target switch, Back restores date, Forward clears target');
 await page.goto(`${base}/research-v8?ticker=AAPL&market=US&discover=calendar&calendarDate=2020-01-01#discover`); await page.getByText('The linked date is outside the current 30-day window. Showing current dates.').waitFor(); report.push('PASS expired target date');
 await page.goto(`${base}/research-v8?ticker=AAPL&market=US&discover=calendar&calendarDate=2026-02-30#discover`); await page.getByRole('tab', { name: 'Calendar', exact: true }).waitFor(); assert.equal(await page.getByText('The linked date is outside the current 30-day window. Showing current dates.').count(), 0); assert.ok(requests.some(r => r.path === '/api/research/discovery')); report.push('PASS invalid date ignored');
 for (const kind of ['empty', 'http', 'warning', 'malformed', 'symbol', 'market']) {
  mode = kind; await open();
  if (kind === 'empty') await ticket.getByText('No date supplied in the next 30 days').waitFor();
  else { await ticket.getByRole('button', { name: 'Retry earnings' }).waitFor(); mode = 'success'; await ticket.getByRole('button', { name: 'Retry earnings' }).click(); await ticket.getByText('time not supplied').waitFor(); }
  report.push(`PASS ${kind}${kind === 'empty' ? '' : ' and retry'}`);
 }
 mode = 'success'; const beforeMy = requests.filter(r => r.path === '/api/research/calendar').length; await open('5347', 'MY'); await ticket.getByText('Malaysia coverage unavailable').waitFor(); assert.equal(requests.filter(r => r.path === '/api/research/calendar').length, beforeMy); report.push('PASS MY unavailable without calendar request');
 mode = 'slow'; await open(); await page.waitForFunction(() => document.querySelector('[data-testid="earnings-ticket"]')?.textContent?.includes('Checking dates')); assert.equal(typeof releaseSlow, 'function'); mode = 'success'; await page.getByText('Change stock', { exact: true }).click(); await page.getByLabel('Company or ticker', { exact: true }).fill('MSFT'); await page.getByRole('button', { name: 'Read ticker directly', exact: true }).click(); await page.getByRole('heading', { level: 1, name: 'Fixture MSFT' }).waitFor(); await ticket.getByText('time not supplied').waitFor(); releaseSlow(); await page.waitForTimeout(100); assert.match(await ticket.getAttribute('aria-label'), /^MSFT earnings/); report.push('PASS stale response after selection switch');
 owner = false; await open('AAPL'); await page.getByRole('button', { name: 'Save stock', exact: true }).click(); const note = page.getByLabel('Personal note for AAPL', { exact: true }); await note.fill('Private guest fixture note'); await page.getByRole('button', { name: 'Save note', exact: true }).click(); await page.getByRole('status').filter({ hasText: 'Note saved on this device' }).waitFor(); await page.reload(); await ticket.getByText('time not supplied').waitFor(); assert.equal(await note.inputValue(), 'Private guest fixture note'); await page.evaluate(() => localStorage.removeItem('signal.guest-research.v1')); report.push('PASS saved guest note remains private on ticket read');
 for (const isOwner of [false, true]) { owner = isOwner; await context.clearCookies(); await page.goto(`${base}/research-v8?ticker=UNSAVED&market=US`); await ticket.getByText('time not supplied').waitFor(); assert.equal(await page.evaluate(() => localStorage.getItem('signal.guest-research.v1')), null); report.push(`PASS ${isOwner ? 'owner' : 'guest'} unsaved read`); }
 await open('AAPL'); await ticket.getByText('time not supplied').waitFor(); await page.getByText('Owner workspace · Your private saved research', { exact: true }).waitFor(); report.push('PASS owner saved-record ticket with fixture private note');
 for (const width of [1280, 768, 375, 320]) for (const theme of ['light', 'dark']) {
  await page.setViewportSize({ width, height: 900 }); await page.getByRole('button', { name: 'Settings', exact: true }).click(); const settings = page.getByRole('dialog', { name: 'Settings' }); await settings.getByRole('radio', { name: theme === 'light' ? 'Light' : 'Dark', exact: true }).check(); await settings.getByRole('button', { name: 'Close settings' }).click();
  await page.waitForFunction(value => document.documentElement.getAttribute('data-v8-theme') === value, theme); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow ${width} ${theme}`);
  const [t, q] = await Promise.all([ticket.boundingBox(), page.getByRole('region', { name: 'Current provider quote' }).boundingBox()]); assert.ok(t && q && t.x >= -1 && t.x + t.width <= width + 1 && t.y >= q.y + q.height - 1 && Math.abs(t.x - q.x) <= 1 && Math.abs(t.width - q.width) <= 1, `ticket/quote geometry ${width} ${theme}`);
  await page.screenshot({ path: `${out}/${width}-${theme}.png`, fullPage: true }); report.push(`PASS ${width} ${theme} geometry`);
 }
 assert.ok(requests.filter(r => r.path === '/api/research/calendar').every(r => !/note|thesis/i.test(r.body))); assert.ok(requests.filter(r => r.path === '/api/research/watchlist').every(r => r.method === 'GET')); assert.deepEqual(errors, []); report.push('PASS payload privacy, no save, console and request errors');
 await context.close();
} catch (error) { report.push(`FAIL ${error.stack || error}`); throw error; }
finally { await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify({ date, requests, errors, report }, null, 2)); }
console.log(report.join('\n'));
