import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

// Execute the actual route and cookie boundary. Persistence/provider imports are
// replaced with spies; neither denied nor allowed fixtures can reach real data.
const require = createRequire(import.meta.url);
const cache = new Map();
let touches = 0;
const spy = (value = {}) => () => { touches += 1; return value; };
class FixtureError extends Error {}
const boundary = new Proxy({
    listResearchState: spy({ records: [], archivedSymbols: [] }),
    researchBackupLimits: { maxFileBytes: 1024 },
    parseResearchRestoreRequest: spy({ records: [], conflictPolicy: 'skip' }),
}, { get(target, name) {
    if (name in target) return target[name];
    if (String(name).endsWith('Error')) return FixtureError;
    return spy(String(name).startsWith('list') ? [] : {});
} });
function load(file) {
    const absolute = path.resolve(file);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const loadedModule = { exports: {} };
    cache.set(absolute, loadedModule);
    const localRequire = (id) => {
        if (id === 'next/server') return require(id);
        if (id === '@/lib/owner-access') return load('src/lib/owner-access.ts');
        if (id === '@/lib/owner-access-client') return load('src/lib/owner-access-client.ts');
        if (id.startsWith('@/')) return boundary;
        throw new Error(`Unexpected import: ${id}`);
    };
    const compiled = ts.transpileModule(readFileSync(absolute, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function('require', 'module', 'exports', compiled)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
}

const originalSecret = process.env.OWNER_ACCESS_SECRET;
const secret = 'fixture-owner-access-secret-never-used-in-production';
const owner = load('src/lib/owner-access.ts');
const cookie = `${owner.ownerAccessCookieName}=${await owner.issueOwnerAccessToken(secret)}`;
const expired = `${owner.ownerAccessCookieName}=${await owner.issueOwnerAccessToken(secret, Date.now() - (owner.ownerAccessMaxAgeSeconds + 10) * 1000)}`;
const routes = [
    ['watchlist', ['GET', 'POST']], ['watchlist/[symbol]', ['PATCH', 'DELETE']],
    ['backup', ['POST']], ['notifications/settings', ['GET', 'PUT']],
    ['memory/[ticker]', ['GET', 'POST']], ['expectations/[ticker]', ['GET', 'POST', 'DELETE']],
    ['calibration/[ticker]', ['GET', 'POST']], ['valuation-plan/[ticker]', ['GET', 'POST']], ['inbox', ['POST']],
];
let checks = 0;
try {
    for (const [route, methods] of routes) {
        const handlers = load(`src/app/api/research/${route}/route.ts`);
        for (const method of methods) {
            for (const [configured, token, status, code] of [
                [undefined, cookie, 503, 'OWNER_ACCESS_UNCONFIGURED'],
                ['short', cookie, 503, 'OWNER_ACCESS_UNCONFIGURED'],
                [secret, '', 401, 'OWNER_ACCESS_REQUIRED'],
                [secret, 'signal_owner=invalid', 401, 'OWNER_ACCESS_REQUIRED'],
                [secret, expired, 401, 'OWNER_ACCESS_REQUIRED'],
            ]) {
                if (configured === undefined) delete process.env.OWNER_ACCESS_SECRET;
                else process.env.OWNER_ACCESS_SECRET = configured;
                touches = 0;
                const request = {
                    headers: new Headers({ cookie: token }),
                    get url() { throw new Error('Denied request URL must not be processed'); },
                    json() { throw new Error('Denied request body must not be processed'); },
                    text() { throw new Error('Denied request body must not be processed'); },
                };
                const context = { get params() { throw new Error('Denied params must not be processed'); } };
                const response = await handlers[method](request, context);
                assert.equal(response.status, status, `${method} ${route}`);
                assert.equal((await response.json()).code, code, `${method} ${route}`);
                assert.equal(touches, 0, `${method} ${route} denied before persistence/providers`);
                checks += 1;
            }
            process.env.OWNER_ACCESS_SECRET = secret;
            touches = 0;
            const payload = route === 'inbox'
                ? [{ symbol: 'AAPL', market: 'US', targetBuyZone: '', lastReviewedAt: '2026-10-21', acceptedEvidence: [], monitoringRules: {} }]
                : { ticker: 'AAPL' };
            const request = new Request('https://fixture.invalid/api/research/test?eventId=fixture', {
                method, headers: { cookie, 'content-type': 'application/json' },
                ...(method === 'GET' ? {} : { body: JSON.stringify(payload) }),
            });
            const response = await handlers[method](request, { params: Promise.resolve({ ticker: 'AAPL', symbol: 'AAPL' }) });
            assert.ok(response.status >= 200 && response.status < 300, `valid owner reaches ${method} ${route}: ${response.status}`);
            assert.ok(touches > 0, `valid owner reaches the ${method} ${route} boundary`);
        }
    }

    const session = load('src/app/api/owner/session/route.ts');
    assert.equal((await session.POST(new Request('https://fixture.invalid', {
        method: 'POST', body: JSON.stringify({ secret: 'wrong' }),
    }))).status, 401);
    const unlocked = await session.POST(new Request('https://fixture.invalid', {
        method: 'POST', body: JSON.stringify({ secret }),
    }));
    assert.equal(unlocked.status, 200);
    assert.match(unlocked.headers.get('set-cookie'), /HttpOnly/i);
    assert.match(unlocked.headers.get('set-cookie'), /SameSite=lax/i);
    assert.equal(JSON.stringify(await unlocked.json()).includes(secret), false);
} finally {
    if (originalSecret === undefined) delete process.env.OWNER_ACCESS_SECRET;
    else process.env.OWNER_ACCESS_SECRET = originalSecret;
}

const { safeOwnerReturnPath, ownerUnlockHref } = load('src/lib/owner-access-client.ts');
const fullReading = '/research-v8?ticker=5347.KL&market=MY&tab=financials&advanced=1&from=market#evidence';
assert.equal(safeOwnerReturnPath(fullReading), fullReading);
assert.equal(new URL(ownerUnlockHref(fullReading), 'https://fixture.invalid').searchParams.get('next'), fullReading);
for (const unsafe of ['', undefined, 'https://example.com', '//example.com', '/\\example.com', '/research\n-v8']) {
    assert.equal(safeOwnerReturnPath(unsafe), '/research-v8');
}
const { readData, readOwnerAccessIssue, readFailure } = load('src/components/v8/read-data.ts');
const originalFetch = globalThis.fetch;
try {
    for (const [status, code, attempts, issue] of [
        [401, 'OWNER_ACCESS_REQUIRED', 1, 'locked'],
        [503, 'OWNER_ACCESS_UNCONFIGURED', 1, 'unconfigured'],
        [503, null, 2, null],
    ]) {
        let calls = 0;
        globalThis.fetch = async () => { calls += 1; return Response.json({ code }, { status }); };
        await assert.rejects(readData('/fixture', new AbortController().signal, { attemptMs: 1000, budgetMs: 2000 }), error => {
            assert.equal(readOwnerAccessIssue(error), issue);
            return true;
        });
        assert.equal(calls, attempts, `retry count for ${status}/${code}`);
    }
    assert.equal((await readFailure(new Response('not JSON', { status: 503 }))).code, null);
    assert.equal((await readFailure(Response.json({ code: '<script>untrusted</script>' }, { status: 503 }))).code, null);
} finally { globalThis.fetch = originalFetch; }
console.log(`Owner access regression passed: ${checks} denied-route checks, 17 authorized handlers, cookie session, full return URL, and typed client retry states. No real SQL/providers.`);
