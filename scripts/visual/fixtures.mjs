import { fulfillEarningsCalendarRead } from '../qa-earnings-calendar-fixture.mjs';
import { marketRequestFixture } from '../harness/market-request-fixture.mjs';
import { researchReadFixture, researchSnapshotFixture } from '../harness/research-read-fixture.mjs';
import { baseURL } from './environment.mjs';

export const fixedTime = '2026-09-12T00:00:00.000Z';

export async function installFixtures(context, theme, observations) {
    const record = (await (await researchReadFixture().route.GET()).json()).data[0];
    const saved = { symbol: record.symbol, market: record.market, companyName: record.companyName, notes: 'Visual fixture saved note' };
    const snapshot = structuredClone(researchSnapshotFixture);
    snapshot.data.quote.observedAt = '2026-09-11T20:00:00.000Z';
    snapshot.data.quote.instrumentType = 'EQUITY';
    snapshot.data.valuation.priceEarnings = 25;
    snapshot.data.chart.points = [
        ['2026-06-12', 160], ['2026-07-12', 180], ['2026-08-12', 175], ['2026-09-11', 200],
    ].map(([time, close]) => ({ time, open: close - 2, high: close + 3, low: close - 4, close, volume: 1_000_000,
        ...Object.fromEntries(['ma50', 'ma200', 'ema20', 'ema50', 'sma200', 'averageVolume20', 'rsi14', 'macd', 'macdSignal', 'macdHistogram', 'atr14', 'atrPercent14', 'anchoredVwap', 'adx14', 'plusDi14', 'minusDi14', 'supertrend'].map(key => [key, null])), supertrendDirection: null }));
    researchReadFixture().parseSnapshot(snapshot);
    await context.addInitScript(({ theme, saved, fixedTime }) => {
        localStorage.setItem('signal-v8-theme-v1', theme);
        localStorage.setItem('signal-v8-first-visit-v1', JSON.stringify({ version: 1, stage: 'skipped', revision: 0 }));
        localStorage.setItem('signal.guest-research.v1', JSON.stringify({ version: 1, guestId: 'd197b5a7-6cd4-4dac-9926-0c44bda2cb39', records: [saved] }));
        localStorage.setItem('signal-portfolio-holdings-v1', JSON.stringify({
            version: 1, updatedAt: fixedTime,
            holdings: [{ accountLabel: 'Fixture brokerage', symbol: 'AAPL', market: 'US', quantity: 4, averageCost: 125, currency: 'USD', importedAt: fixedTime, provenanceLabel: 'Visual fixture' }],
            cashBalances: [{ accountLabel: 'Fixture brokerage', currency: 'USD', balance: 50, importedAt: fixedTime, provenanceLabel: 'Visual fixture' }],
        }));
    }, { theme, saved, fixedTime });

    // One allowlist blocks external traffic, unknown APIs, and every mutation before network access.
    await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin !== new URL(baseURL).origin) {
            observations.errors.push(`Forbidden request: ${request.method()} ${url.origin}${url.pathname}`);
            return route.abort();
        }
        if (await fulfillEarningsCalendarRead(route, fixedTime)) return;
        if (request.method() !== 'GET') {
            observations.errors.push(`Forbidden request: ${request.method()} ${url.origin}${url.pathname}`);
            return route.abort();
        }
        if (!url.pathname.startsWith('/api/')) return route.continue();
        observations.apis.push(`${url.pathname}${url.search}`);
        if (url.pathname === '/api/signals/v2') {
            const fixture = marketRequestFixture();
            const response = await fixture.route.GET(fixture.request(url.search.slice(1)));
            return route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
        }
        if (url.pathname === '/api/owner/session') return route.fulfill({ json: { success: true, data: { configured: true, unlocked: false } } });
        if (url.pathname === '/api/research/symbol/AAPL') return route.fulfill({ json: snapshot });
        if (url.pathname === '/api/research/search') return route.fulfill({ json: { success: true, data: [] } });
        if (url.pathname === '/api/signals/replay') return route.fulfill({ json: { success: true, data: { market: 'US', mode: 'standard', enableSocial: true, summaries: [] } } });
        if (url.pathname === '/api/research/discovery') return route.fulfill({ json: { success: true, data: { generatedAt: fixedTime, universeSize: 0, scannedCount: 0, candidates: [], contenders: [], emergingCandidates: [], performance: [], historySnapshotCount: 0, warnings: [] } } });
        observations.errors.push(`Unexpected API: ${url.pathname}`);
        return route.abort();
    });
}
