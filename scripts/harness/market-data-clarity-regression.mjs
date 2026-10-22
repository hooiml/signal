import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { marketRequestFixture } from './market-request-fixture.mjs';

const modules = new Map();
function load(file) {
    const absolute = path.resolve(file);
    if (modules.has(absolute)) return modules.get(absolute).exports;
    const compiled = { exports: {} };
    modules.set(absolute, compiled);
    const require = id => {
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
assert.equal(my.components.news.enabled, true, 'Old or undated returned headlines retain existing count-based eligibility.');
assert.equal(my.metadata.source_availability.news.count, 3);
assert.equal(my.metadata.news_evidence.count, 3);
assert.equal(my.metadata.news_evidence.dated_count, 2);
assert.equal(my.metadata.news_evidence.unknown_date_count, 1);
assert.equal(my.metadata.news_evidence.within_24h_count, 1);
assert.equal(my.metadata.news_evidence.newest_published_at, '2026-09-11T12:00:00.000Z');
assert.equal(my.metadata.news_evidence.oldest_published_at, '2026-09-01T00:00:00.000Z');

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
