import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { marketRequestFixture } from './market-request-fixture.mjs';

const sourcePath = path.resolve('src/components/v8/MarketV8ConnectedData.ts');
const source = readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: sourcePath,
}).outputText;
const compiledModule = { exports: {} };
new Function('require', 'module', 'exports', compiled)(() => ({}), compiledModule, compiledModule.exports);
const { marketSourceToggleStatus } = compiledModule.exports;

assert.equal(marketSourceToggleStatus('US', false, null), 'Excluded from score · source data can still be read for its comparison.');
assert.equal(marketSourceToggleStatus('MY', true, null), 'Enabled · no completed score response; news availability is not established.');
assert.match(marketSourceToggleStatus('US', true, { components: { social: {} } }), /usable social evidence is included in this score/);
assert.match(marketSourceToggleStatus('MY', true, { components: {} }), /no usable news evidence is available; its configured weight uses the neutral reserve/);
assert.match(marketSourceToggleStatus('US', true, { components: { social: {} } }, true), /previous reading/,
    'A refresh does not present retained evidence as the result of the pending source read.');
assert.match(marketSourceToggleStatus('MY', true, { components: { news: {} } }, false, 'request failed'), /previous reading remains shown/,
    'A failed refresh identifies retained evidence instead of reporting settled availability.');
assert.match(marketSourceToggleStatus('MY', true, null, false, 'request failed'), /source availability is unknown/,
    'A failed first read does not report sources as unavailable.');

const component = readFileSync('src/components/v8/MarketV8Connected.tsx', 'utf8');
assert.match(component, /const query = `market=\$\{market\}&mode=\$\{mode\}&enableSocial=\$\{social\}`/,
    'The selected toggle value is sent as enableSocial for the score and replay requests.');
assert.match(component, /checked=\{social\} onChange=\{event => \{ setSocial\(event\.target\.checked\); resetView\(\); \}\}/,
    'The visible checkbox updates the state used by the score and replay requests.');
assert.match(component, /marketSourceToggleStatus\(market, social, data, loading, response\.key === key \? response\.error : ''\)/,
    'The status distinguishes the selected setting, current signal evidence and request state.');

const publishedAt = '2026-09-11T23:00:00.000Z';
const fixtureProviders = {
    fetchMultipleSubreddits: subreddits => subreddits.includes('wallstreetbets') ? [{
        title: 'Bull call moon buy long breakout rally surge soar',
        selftext: 'buy buy buy buy buy buy',
        score: 100,
        created_utc: Date.parse(publishedAt) / 1000,
        permalink: '/r/wallstreetbets/fixture',
        subreddit: 'wallstreetbets',
    }] : [],
    fetchMarketNews: market => market === 'MY' ? [{
        title: 'Record profit growth surge strong',
        source: 'Fixture news',
        pubDate: publishedAt,
        link: 'https://example.test/market-news',
    }] : [],
};
const scoreRequest = async (market, enableSocial) => {
    const fixture = marketRequestFixture({ providerOverrides: fixtureProviders, sourceConfiguration: { reddit: true } });
    const response = await fixture.route.GET(fixture.request(`market=${market}&mode=standard&enableSocial=${enableSocial}`));
    const body = await response.json();
    assert.equal(response.status, 200, `${market} score request succeeds with fixture source data.`);
    fixture.parseSignal(body, market, 'standard');
    return { data: body.data, fixture };
};
const recompose = data => Math.round(
    Object.values(data.components).reduce((sum, item) => sum + item.score * item.weight, 0)
    + data.metadata.coverage_adjustment.neutral_points,
);
for (const [market, key, expectedWeight] of [['US', 'social', .20], ['MY', 'news', .65]]) {
    const [included, excluded] = await Promise.all([scoreRequest(market, true), scoreRequest(market, false)]);
    const includedInput = included.data.components[key];
    assert.ok(includedInput, `${market} fixture evidence activates the ${key} indicator.`);
    assert.ok(includedInput.score > 50, `${market} fixture evidence has a positive sentiment score.`);
    assert.equal(includedInput.weight, expectedWeight, `${market} evidence retains its configured score weight.`);
    assert.equal(excluded.data.components[key], undefined, `${market} disabled evidence contributes no indicator.`);
    const otherIncluded = Object.fromEntries(Object.entries(included.data.components).filter(([name]) => name !== key));
    assert.deepEqual(excluded.data.components, otherIncluded, `${market} non-social indicators remain identical when the toggle changes.`);
    assert.equal(included.data.composite_score, recompose(included.data), `${market} included score follows the production weighted-score and reserve calculation.`);
    assert.equal(excluded.data.composite_score, recompose(excluded.data), `${market} excluded score follows the production weighted-score and reserve calculation.`);
    assert.ok(Math.abs(
        excluded.data.metadata.coverage_adjustment.missing_weight
        - included.data.metadata.coverage_adjustment.missing_weight
        - expectedWeight
    ) < 1e-9, `${market} excluded source weight moves to missing coverage.`);
    assert.equal(included.fixture.events.includes('fetchMultipleSubreddits'), true, `${market} source evidence is read for comparison.`);
    assert.equal(excluded.fixture.events.includes('fetchMultipleSubreddits'), true, `${market} source evidence may still be read when excluded from the score.`);
    const availabilityKey = market === 'MY' ? 'news' : 'reddit';
    assert.equal(included.data.metadata.source_availability[availabilityKey].count, excluded.data.metadata.source_availability[availabilityKey].count,
        `${market} score toggle preserves the same returned source availability.`);
    assert.equal(excluded.data.metadata.counterfactuals.source_toggle.current_score, excluded.data.composite_score,
        `${market} current score uses the without-source branch when the source is excluded.`);
    assert.equal(excluded.data.metadata.counterfactuals.source_toggle.with_source_score, included.data.composite_score,
        `${market} counterfactual with-source score matches the enabled score.`);
    if (market === 'MY') {
        assert.ok(included.data.metadata.news_evidence.eligible_count > 0, 'MY fixture headline has a valid date within the evidence window.');
        assert.equal(included.fixture.events.includes('fetchMarketNews'), true);
        assert.equal(excluded.fixture.events.includes('fetchMarketNews'), true, 'MY dated evidence remains available to the source comparison when excluded from the score.');
        assert.equal(included.data.metadata.news_evidence.eligible_count, excluded.data.metadata.news_evidence.eligible_count);
    }
    console.log(`${market} toggle evidence: included=${included.data.composite_score}, excluded=${excluded.data.composite_score}, ${key}=${includedInput.score} × ${includedInput.weight}, excluded neutral points=${excluded.data.metadata.coverage_adjustment.neutral_points}.`);
}

console.log('Market social/news toggle status and request bindings passed.');
