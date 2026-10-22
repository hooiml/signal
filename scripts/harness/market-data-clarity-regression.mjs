import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { marketRequestFixture } from './market-request-fixture.mjs';

const modules = new Map();
let rssItems = [];
function load(file) {
    const absolute = path.resolve(file);
    if (modules.has(absolute)) return modules.get(absolute).exports;
    const compiled = { exports: {} };
    modules.set(absolute, compiled);
    const require = id => {
        if (id === 'next/cache') return { unstable_cache: callback => callback };
        if (id === '@/lib/db') return { sql: async () => [] };
        if (id === './market-score-reconstruction') return { reconstructUsMarketScores: () => [] };
        if (id === './research/yahoo-research') return { fetchYahooResearchChart: async () => ({ points: [] }) };
        if (id === 'rss-parser') return class FixtureParser {
            constructor(options = {}) { this.options = options; }
            async parseURL(url) {
                assert.match(url, /when%3A1d/, 'MY RSS requests a bounded recent search.');
                assert.equal(this.options.timeout, 8_000, 'The MY RSS request has a bounded provider timeout.');
                return { items: rssItems };
            }
        };
        if (id === 'react' || id === 'react/jsx-runtime') return createRequire(absolute)(id);
        if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
        assert.ok(id.startsWith('.') || id.startsWith('@/'), `Unexpected dependency: ${id}`);
        const resolved = id.startsWith('@/') ? path.resolve('src', id.slice(2)) : path.resolve(path.dirname(absolute), id);
        return load(`${resolved}${existsSync(`${resolved}.ts`) ? '.ts' : '.tsx'}`);
    };
    const code = ts.transpileModule(readFileSync(absolute, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
        fileName: absolute,
    }).outputText;
    new Function('require', 'module', 'exports', code)(require, compiled, compiled.exports);
    return compiled.exports;
}

const request = async (fixture, query) => {
    const response = await fixture.route.GET(fixture.request(query));
    const payload = await response.json();
    assert.equal(response.status, 200);
    fixture.parseSignal(payload, new URLSearchParams(query).get('market'), 'standard');
    return payload.data;
};

const malaysia = marketRequestFixture({ rawMarketData: {
    newsItems: [
        { title: 'Recent headline', source: 'Fixture', link: 'https://example.test/recent', pubDate: '2026-09-11T12:00:00.000Z' },
        { title: 'Older headline', source: 'Fixture', link: 'https://example.test/older', pubDate: '2026-09-01T00:00:00.000Z' },
        { title: 'Undated headline', source: 'Fixture', link: 'https://example.test/unknown' },
    ],
} });
const my = await request(malaysia, 'market=MY&enableSocial=true');
assert.equal(my.components.news.enabled, true, 'One dated headline within 24 hours activates MY news.');
assert.equal(my.metadata.source_availability.news.count, 3);
assert.equal(my.metadata.news_evidence.count, 3);
assert.equal(my.metadata.news_evidence.dated_count, 2);
assert.equal(my.metadata.news_evidence.unknown_date_count, 1);
assert.equal(my.metadata.news_evidence.within_24h_count, 1);
assert.equal(my.metadata.news_evidence.eligible_count, 1);
assert.equal(my.metadata.my_news_eligibility_version, 1);
assert.equal(my.metadata.source_availability.news.eligible_count, 1);
assert.notEqual(my.metadata.counterfactuals.source_toggle.with_source_score, null, 'Fresh eligible MY evidence supports a source-toggle comparison.');
assert.equal(my.metadata.news_evidence.newest_published_at, '2026-09-11T12:00:00.000Z');
assert.equal(my.metadata.news_evidence.oldest_published_at, '2026-09-01T00:00:00.000Z');

const { normalizeNewsItems, fetchMarketNews } = load('src/lib/rss-feeds.ts');
const feedNow = Date.now();
const feedRows = Array.from({ length: 14 }, (_, index) => ({
    title: `Recent headline ${index}`,
    link: `https://example.test/${index}`,
    pubDate: new Date(feedNow - 60_000 - index * 60_000).toISOString(),
}));
feedRows.unshift({ title: 'Malformed duplicate', link: 'https://example.test/0', pubDate: 'not a date' });
feedRows.push({ title: 'Future headline', link: 'https://example.test/future', pubDate: new Date(feedNow + 60 * 60_000).toISOString() });
feedRows.push({ title: '   ', link: 'https://example.test/empty', pubDate: new Date(feedNow - 2 * 60 * 60_000).toISOString() });
const normalized = normalizeNewsItems(feedRows);
assert.equal(normalized.length, 12, 'The cap is applied after duplicate removal and publication-date ordering.');
assert.equal(normalized[0].title, 'Recent headline 0', 'The newest validated item survives a full feed page.');
assert.equal(normalized.some(item => item.title === 'Malformed duplicate'), false, 'A valid duplicate replaces an invalid-date copy.');
assert.equal(normalized.some(item => item.title === 'Future headline'), false, 'Future-dated results cannot take capacity from recent dated headlines.');
const freshDuplicate = { title: 'Duplicate syndicated headline', link: 'https://example.test/duplicate', pubDate: new Date(feedNow - 60_000).toISOString() };
const futureDuplicate = { ...freshDuplicate, pubDate: new Date(feedNow + 60_000).toISOString() };
for (const duplicateOrder of [[freshDuplicate, futureDuplicate], [futureDuplicate, freshDuplicate]]) {
    const selected = normalizeNewsItems(duplicateOrder, 12, feedNow);
    assert.equal(selected.length, 1);
    assert.equal(selected[0].pubDate, freshDuplicate.pubDate, 'A valid nonfuture duplicate wins independent of input order.');
}
rssItems = feedRows;
const rss = await fetchMarketNews('MY');
assert.equal(rss.length, 12);
assert.equal(rss[0].title, 'Recent headline 0');

const eligibility = load('src/lib/source-indicator.ts');
const now = Date.parse('2026-09-12T00:00:00.000Z');
const mixedEvidence = eligibility.getEligibleMyEvidence([
    { pubDate: '2026-09-11T23:00:00.000Z' },
    { pubDate: '2026-09-10T22:00:00.000Z' },
    { pubDate: '' },
    { pubDate: 'not a date' },
    { pubDate: '2026-09-12T00:01:00.000Z' },
], [
    { created_utc: (now - 60 * 60_000) / 1000 },
    { created_utc: (now - 25 * 60 * 60_000) / 1000 },
    { created_utc: (now + 60_000) / 1000 },
], now);
assert.equal(mixedEvidence.news.length, 1, 'Only valid, nonfuture news published within 24 hours is eligible.');
assert.equal(mixedEvidence.reddit.length, 1, 'Only nonfuture Reddit posts created within 24 hours are eligible.');

const staleFixture = marketRequestFixture({ rawMarketData: { newsItems: [
    { title: 'Old profit headline', source: 'Fixture', link: 'https://example.test/old', pubDate: '2026-09-10T22:00:00.000Z' },
    { title: 'Undated strong headline', source: 'Fixture', link: 'https://example.test/unknown' },
    { title: 'Future growth headline', source: 'Fixture', link: 'https://example.test/future', pubDate: '2026-09-12T00:01:00.000Z' },
    { title: 'Malformed profit date', source: 'Fixture', link: 'https://example.test/invalid', pubDate: 'not a date' },
] } });
const staleOnly = await request(staleFixture, 'market=MY&enableSocial=true');
assert.equal(staleOnly.components.news?.enabled ?? false, false, 'Stale, undated, invalid and future-only headlines do not activate MY news.');
assert.equal(staleOnly.metadata.news_evidence.eligible_count, 0);
assert.equal(staleOnly.metadata.news_evidence.future_date_count, 1);
assert.equal(staleOnly.metadata.source_availability.news.status, 'no-fresh-evidence');
assert.equal(staleOnly.metadata.news_evidence.evaluated_at, '2026-09-12T00:00:00.000Z');
assert.equal(staleOnly.metadata.counterfactuals.source_toggle.with_source_score, null, 'Stale-only MY evidence cannot produce a source-toggle comparison.');
assert.match(staleOnly.metadata.counterfactuals.source_toggle.unavailable_reason, /eligible.*24 hours/i);
assert.ok(staleOnly.metadata.articles.some(item => item.title === 'Undated strong headline'), 'An undated article can remain context without contributing to score.');
const snapshotWrite = staleFixture.calls.find(call => call.query.startsWith('INSERT INTO signal_snapshots'));
const storedMetadata = snapshotWrite.values.flatMap(value => {
    if (typeof value !== 'string') return [];
    try { return [JSON.parse(value)]; } catch { return []; }
}).find(value => value?.my_news_eligibility_version === 1);
assert.ok(storedMetadata, 'New MY snapshots record the news eligibility version without rewriting earlier rows.');

const noResults = await request(marketRequestFixture({ rawMarketData: { newsItems: [] } }), 'market=MY&enableSocial=true');
assert.equal(noResults.metadata.source_availability.news.status, 'no-results', 'No returned news or Reddit is distinct from returned but ineligible evidence.');

const { isStoredSnapshotValidationEligible } = load('src/lib/market-calibration-service.ts');
assert.equal(isStoredSnapshotValidationEligible('MY', { scoring_model_version: '2.0.0' }), false, 'News-enabled legacy MY snapshots without eligibility metadata cannot enter current validation.');
assert.equal(isStoredSnapshotValidationEligible('MY', { my_news_eligibility_version: 1 }), true, 'Version 1 MY snapshots remain validation eligible.');
assert.equal(isStoredSnapshotValidationEligible('MY', { my_news_eligibility_version: 1, validation_eligible: false }), false, 'An explicit validation exclusion still applies.');
assert.equal(isStoredSnapshotValidationEligible('MY', { scoring_model_version: '2.0.0' }, false), true, 'Legacy MY snapshots with news disabled remain eligible because this rule did not affect their inputs.');
assert.equal(isStoredSnapshotValidationEligible('MY', { scoring_model_version: '2.0.0', validation_eligible: false }, false), false, 'An explicit validation exclusion still applies when MY news is disabled.');
assert.equal(isStoredSnapshotValidationEligible('US', { scoring_model_version: '2.0.0' }), true, 'The MY rule does not alter US validation eligibility.');
const { calculateMarketCalibration } = load('src/lib/market-calibration.ts');
const calibrationStart = Date.parse('2026-01-01T00:00:00.000Z');
const calibration = calculateMarketCalibration({
    snapshots: [
        { date: '2026-01-01', score: 55, tier: 'neutral', validationEligible: false, modelVersion: '2.0.0' },
        { date: '2026-01-02', score: 60, tier: 'buy', validationEligible: true, modelVersion: '2.0.0' },
    ],
    prices: Array.from({ length: 45 }, (_, day) => ({
        date: new Date(calibrationStart + day * 86_400_000).toISOString().slice(0, 10),
        close: 100 + day,
    })),
    mode: 'standard', benchmarkSymbol: 'KLCI', benchmarkName: 'FBM KLCI',
});
assert.deepEqual(calibration.timeline.map(item => item.date), ['2026-01-01', '2026-01-02'], 'Pre-rule MY snapshots remain on the historical timeline.');
assert.equal(calibration.timeline_only_snapshot_count, 1);
assert.equal(calibration.horizons[0].observations.some(item => item.date === '2026-01-01'), false, 'Pre-rule MY snapshots do not enter forward-return validation.');
assert.equal(calibration.horizons[0].observations.some(item => item.date === '2026-01-02'), true, 'Version 1 MY snapshots remain in forward-return validation.');

const recentFixture = marketRequestFixture({ providerOverrides: {
    fetchMarketNews: () => [{ title: 'Company reports profit and strong growth', pubDate: '2026-09-11T23:00:00.000Z', link: 'https://example.test/recent' }],
    fetchMultipleSubreddits: () => [{ title: 'Bull call', selftext: '', created_utc: (now - 60 * 60_000) / 1000, permalink: '/r/bursabets/1', subreddit: 'bursabets' }],
} });
const freshRaw = await recentFixture.signal.fetchRawMarketData('MY', true, true);
assert.ok(freshRaw.newsSentiment > 0, 'A real dated recent headline contributes positive news sentiment.');
assert.ok(freshRaw.redditSentiment > 0, 'A recent Reddit post contributes positive Reddit sentiment.');
assert.equal(freshRaw.combinedSentiment, (freshRaw.redditSentiment * 0.2) + (freshRaw.newsSentiment * 0.8), 'The existing MY 20/80 blend is retained.');

const oldRedditFixture = marketRequestFixture({ providerOverrides: {
    fetchMarketNews: () => [{ title: 'Company reports profit and strong growth', pubDate: '2026-09-11T23:00:00.000Z', link: 'https://example.test/recent' }],
    fetchMultipleSubreddits: () => [{ title: 'Crash loss sell', selftext: '', created_utc: (now - 25 * 60 * 60_000) / 1000, permalink: '/r/bursabets/old', subreddit: 'bursabets' }],
} });
const oldRedditRaw = await oldRedditFixture.signal.fetchRawMarketData('MY', true, true);
assert.equal(oldRedditRaw.redditSentiment, 0, 'A stale Reddit post cannot affect the MY blended score.');
assert.equal(oldRedditRaw.combinedSentiment, oldRedditRaw.newsSentiment * 0.8, 'Missing eligible Reddit evidence keeps its documented 20% contribution at zero.');

const usFixture = marketRequestFixture({ sourceConfiguration: { reddit: false, stockTwits: false } });
const us = await request(usFixture, 'market=US&enableSocial=true');
assert.deepEqual(us.metadata.source_availability.reddit, { status: 'unconfigured', count: 0 });
assert.deepEqual(us.metadata.source_availability.stocktwits, { status: 'disabled', count: 0 });
assert.equal(us.metadata.source_availability.naaim.status, 'no-current-reading');
assert.equal(us.metadata.source_availability.bofa.status, 'manual-reading-unavailable');

const { ConnectedIndicator } = load('src/components/v8/MarketV8ConnectedPanels.tsx');
const unavailableSignal = {
    mode: 'standard', components: {},
    metadata: {
        market: 'US', data_freshness: {}, weight_distribution: {},
        source_availability: us.metadata.source_availability,
    },
};
const renderMissing = indicatorKey => renderToStaticMarkup(createElement(ConnectedIndicator, {
    signal: unavailableSignal, indicatorKey, onClose: () => {}, history: [],
    historyState: { loading: false, error: '', loaded: 0, pending: 0, failed: 0, unavailable: 0, total: 0 },
    onRetryHistory: () => {}, sourceEnabled: true,
}));
assert.match(renderMissing('social'), /20\.0% · held as neutral reserve/);
assert.match(renderMissing('social'), /Reddit: OAuth is not configured; StockTwits: disabled by configuration/);
assert.match(renderMissing('naaim'), /10\.0% · held as neutral reserve/);
assert.match(renderMissing('naaim'), /roughly three-month delayed reading/);
assert.match(renderMissing('bofa'), /5\.0% · held as neutral reserve/);
assert.match(renderMissing('bofa'), /normalization range is a placeholder/);

console.log('Market data clarity regression passed: missing-input reasons and configured weights, source states, and news publication evidence are accurate.');
