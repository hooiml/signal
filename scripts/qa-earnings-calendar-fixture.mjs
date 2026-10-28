import assert from 'node:assert/strict';

// This public POST is a read. Reject additional parameters and authored state before
// excluding it from a fixture suite's existing mutation guard.
export function isEarningsCalendarRead(request) {
    const url = new URL(request.url());
    if (url.pathname !== '/api/research/calendar' || request.method() !== 'POST' || url.searchParams.get('type') !== 'earnings') return false;
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname), 'Earnings fixtures are local only.');
    assert.deepEqual([...url.searchParams.keys()].sort(), ['market', 'range', 'ticker', 'type']);
    assert.equal(url.searchParams.get('range'), '30');
    assert.equal(url.searchParams.get('market'), 'US', 'Only US has public earnings coverage.');
    const ticker = url.searchParams.get('ticker');
    assert.match(ticker ?? '', /^[A-Z0-9.-]{1,15}$/);
    const inputs = request.postDataJSON();
    assert.ok(Array.isArray(inputs) && inputs.length === 1, 'An earnings ticket reads one identity.');
    assert.deepEqual(inputs[0], {
        symbol: ticker, market: 'US', nextReviewAt: null, lastReviewedAt: null, reviewAgeDays: null, earningsWithinDays: 30,
    }, 'An earnings ticket sends identity and null review fields only.');
    return true;
}

export async function fulfillEarningsCalendarRead(route, generatedAt = new Date().toISOString()) {
    if (!isEarningsCalendarRead(route.request())) return false;
    await route.fulfill({ json: { success: true, data: {
        generatedAt, rangeDays: 30, timezone: 'UTC', events: [], macroEvents: [], warnings: [],
    } } });
    return true;
}
