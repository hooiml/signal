import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const modulePath = path.resolve('src/lib/legacy-routes.ts');
const compiled = { exports: {} };
const output = ts.transpileModule(readFileSync(modulePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: modulePath,
}).outputText;
new Function('require', 'module', 'exports', output)(
    (id) => { throw new Error(`legacy route helper must not load ${id} in its route-contract harness`); },
    compiled,
    compiled.exports,
);

const {
    legacyMarketPaths,
    legacyResearchPaths,
    legacyRouteDestination,
    marketRouteConfig,
    firstRouteValue,
} = compiled.exports;

const marketAliases = ['/main-v2', '/main-v4', '/main-v5', '/main-v6', '/main-v7', '/backup/main'];
const researchAliases = ['/research-v2', '/research-v4', '/research-v5', '/research-v6', '/research-v7', '/backup/research'];
const destination = (pathname, search = '') => legacyRouteDestination(pathname, new URLSearchParams(search));

assert.deepEqual(legacyMarketPaths, marketAliases, 'market retirement list contains only shipped aliases (never V3)');
assert.deepEqual(legacyResearchPaths, researchAliases, 'research retirement list contains only shipped aliases (never V3)');

for (const pathname of ['/', ...marketAliases]) {
    assert.equal(destination(pathname), '/main-v8', `${pathname} retires to the V8 Market pathname`);
    assert.equal(destination(pathname, 'market=MY&market=US&unknown=safe'), '/main-v8', `${pathname} does not reinterpret duplicate or unknown query keys`);
}

for (const pathname of researchAliases) {
    assert.equal(destination(pathname), '/research-v8', `${pathname} ordinary reading retires to V8 Research`);
    for (const taskKey of ['workspace', 'tab', 'review', 'query', 'decision', 'density', 'setup', 'queueTask', 'returnTo', 'context', 'contextPanel']) {
        assert.equal(destination(pathname, `${taskKey}=`), '/research', `${pathname} preserves advanced Research task key ${taskKey}`);
    }
    assert.equal(destination(pathname, 'ticker=AAPL&market=US&unknown=safe'), '/research-v8', `${pathname} keeps ordinary ticker links in V8`);
}

assert.equal(destination('/research'), '/research-v8', 'canonical Research ordinary reading goes to V8');
assert.equal(destination('/research', 'workspace=today'), null, 'canonical advanced Research does not redirect to itself');
assert.equal(destination('/research', 'context=focus'), null, 'canonical context work does not redirect to itself');
assert.equal(destination('/market/tools', 'market=MY'), null, 'current Market tools route stays current');
assert.equal(destination('/main-v3'), null, 'unshipped V3 is not claimed as a legacy alias');
assert.equal(destination('/unknown'), null, 'unknown routes are not intercepted');

assert.deepEqual(marketRouteConfig(new URLSearchParams('market=MY&market=US&mode=contrarian&enableSocial=false')), {
    market: 'MY', mode: 'contrarian', enableSocial: false,
}, 'Market V8 configuration uses the first repeated query value');
assert.deepEqual(marketRouteConfig(new URLSearchParams('market=EU&mode=broken&enableSocial=1')), {}, 'invalid Market values remain absent');
assert.equal(firstRouteValue(['MY', 'US']), 'MY', 'first route value preserves the first duplicate');
assert.equal(firstRouteValue(undefined), undefined, 'missing route value remains absent');

console.log(`legacy routes regression passed (${marketAliases.length + researchAliases.length + 2} aliases, query and no-loop contracts)`);
