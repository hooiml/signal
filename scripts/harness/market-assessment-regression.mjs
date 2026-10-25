import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { marketRequestFixture } from './market-request-fixture.mjs';

// Render the actual assessment and its local helpers without providers or SQL.
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

const { MarketCurrentAssessment, newsEvidenceText } = load('src/components/v8/MarketV8Coverage.tsx');
const { MarketV81Hero } = load('src/components/v8/MarketV81Hero.tsx');
const { ConnectedPanels, emptyScenario } = load('src/components/v8/MarketV8ConnectedPanels.tsx');
const { reconcileScoreChange } = load('src/lib/signal-change.ts');
const fixture = marketRequestFixture();
const explanations = {
    standard: 'In Momentum mode, higher scores support positive momentum; lower scores indicate weaker momentum and a more cautious reading.',
    contrarian: 'In Contrarian mode, higher scores indicate crowding or greed risk; lower scores indicate fear and potential opportunity.',
};

for (const market of ['US', 'MY']) {
    for (const score of [10, 50, 90]) {
        // Repeated mode changes must follow the returned signal, for the same score.
        for (const mode of ['contrarian', 'standard', 'contrarian']) {
            const signal = {
                composite_score: score, tier: 'neutral', mode,
                interpretation: { action: 'Fixture', reasoning: '', color: '', emoji: '' },
                components: {},
                confidence: { agreement_pct: 0, level: 'low', majority_signal: 'NEUTRAL', conflicting_indicators: [] },
                metadata: { market, data_freshness: {}, weight_distribution: {} },
            };
            const html = renderToStaticMarkup(createElement(MarketCurrentAssessment, {
                signal, date: '2026-10-05', onSelect: () => assert.fail('Rendering must not select an input'),
            }));
            const paragraph = html.match(/<p>(.*?)<\/p>/)?.[1];
            assert.equal(paragraph, `The score describes the configured market indicators on a 0–100 scale. ${explanations[mode]} It is not a return estimate or a probability of gains.`, `${market} ${mode} score ${score}`);
            assert.match(html, /Categories follow the selected mode\. A conflict means a different indicator category, not necessarily a negative reading\. Leading inputs are selected by weight; alignment is agreement, not forecast accuracy\./, `${market} ${mode} category and conflict explanation`);
            assert.doesNotMatch(html, /Contribution and alignment answer different questions/, `${market} ${mode} uses concise explanation`);
            assert.equal(signal.composite_score, score, 'Mode interpretation must not invert the numeric score');
        }
    }
}

const conflictSignal = {
    tier: 'buy', mode: 'standard', components: {
        vix: { enabled: true, weight: .7, signal: 'sell', display_name: 'VIX Index', score: 35, last_updated: '2026-10-05', metadata: { timestamp_basis: 'observed' } },
        aaii: { enabled: true, weight: .3, signal: 'buy', display_name: 'AAII', score: 65, last_updated: '2026-10-05', metadata: { timestamp_basis: 'observed' } },
    },
    confidence: { conflicting_indicators: ['vix'], majority_signal: 'BUY', agreement_pct: 50, level: 'low' },
    metadata: { data_freshness: {}, weight_distribution: {} },
};
const conflictHtml = renderToStaticMarkup(createElement(MarketCurrentAssessment, {
    signal: conflictSignal, date: '2026-10-05', onSelect: () => assert.fail('Rendering must not select an input'),
}));
assert.match(conflictHtml, /Leading conflict:<\/b> VIX Index/);
assert.match(conflictHtml, /Indicator category: Leaning negative · overall: Leaning positive/,
    'Leading conflict names the indicator category and overall reading separately');
assert.match(conflictHtml, /Categories follow the selected mode/);
assert.match(conflictHtml, /In Momentum mode, higher scores support positive momentum/);

const knownNewsEvidence = {
    count: 3, dated_count: 2, unknown_date_count: 1, within_24h_count: 1, eligible_count: 1,
    evaluated_at: '2026-10-20T12:00:00.000Z', newest_published_at: '2026-10-20T11:00:00.000Z',
    oldest_published_at: '2026-10-19T10:00:00.000Z',
};
const knownNewsText = newsEvidenceText(knownNewsEvidence);
assert.match(knownNewsText, /1 eligible dated news item;/);
assert.match(knownNewsText, /dated within 24h of the evidence check at/);
const unknownNewsText = newsEvidenceText({ ...knownNewsEvidence, eligible_count: undefined, evaluated_at: undefined });
assert.match(unknownNewsText, /Eligibility count unavailable/);
assert.match(unknownNewsText, /24h of an unavailable evidence-check time/);

// Indicator identity drives the ring and leading-evidence markers; freshness stays explicit text.
const { MarketCoverageRing } = load('src/components/v8/MarketCoverageRing.tsx');
const ringSignal = {
    components: {
        vix: { enabled: true, weight: .6, display_name: 'VIX Index' },
        social: { enabled: true, weight: .3, display_name: 'Social Sentiment' },
        news: { enabled: true, weight: .1, display_name: 'News Sentiment' },
    },
};
const ringHtml = renderToStaticMarkup(createElement(MarketCoverageRing, {
    signal: { ...ringSignal, metadata: {
        market: 'MY', news_evidence: { ...knownNewsEvidence, eligible_count: undefined, evaluated_at: undefined },
    } },
    coverage: { observedPct: 90, fallbackPct: 10, freshKeys: ['vix'], staleKeys: ['social'] },
    onSelect: () => assert.fail('Rendering must not select an input'),
}));
assert.match(ringHtml, /<circle[^>]*data-indicator="vix" data-state="fresh"/);
assert.match(ringHtml, /<circle[^>]*data-indicator="social" data-state="stale"/);
assert.match(ringHtml, /<circle[^>]*data-indicator="news" data-state="unknown"/);
assert.match(ringHtml, /<circle[^>]*data-indicator="fallback" data-state="fallback"/);
assert.match(ringHtml, /<button type="button" class="ringItem"[^>]*><i data-indicator="vix"/);
assert.match(ringHtml, /VIX Index<small>fresh<\/small>/);
assert.match(ringHtml, /Social Sentiment<small>stale<\/small>/);
assert.match(ringHtml, /News Sentiment<small>freshness unverified<\/small>/);
assert.match(ringHtml, /MY news: eligible article count unavailable · 1 dated within 24h of an unavailable evidence-check time · aggregate sentiment observation timestamp unknown\./);
const observedNewsSignal = { ...ringSignal, components: {
    ...ringSignal.components, news: { ...ringSignal.components.news, last_updated: '2026-10-20', metadata: { timestamp_basis: 'observed' } },
}, metadata: { market: 'MY', news_evidence: knownNewsEvidence } };
const observedNewsRing = renderToStaticMarkup(createElement(MarketCoverageRing, {
    signal: observedNewsSignal, coverage: { observedPct: 90, fallbackPct: 10, freshKeys: ['vix'], staleKeys: ['social'] },
    onSelect: () => assert.fail('Rendering must not select an input'),
}));
assert.match(observedNewsRing, /aggregate sentiment observed 20 Oct 2026/,
    'An observed aggregate timestamp is shown when its basis is explicitly observed');
const absentNewsSignal = { ...ringSignal, components: { vix: ringSignal.components.vix }, metadata: {
    market: 'MY', news_evidence: knownNewsEvidence,
} };
const absentNewsRing = renderToStaticMarkup(createElement(MarketCoverageRing, {
    signal: absentNewsSignal, coverage: { observedPct: 90, fallbackPct: 10, freshKeys: ['vix'], staleKeys: [] },
    onSelect: () => assert.fail('Rendering must not select an input'),
}));
assert.match(absentNewsRing, /aggregate sentiment observation unavailable/,
    'Missing aggregate component metadata stays unavailable');

// MY change accounting carries explicit eligibility evidence; missing legacy metadata stays unknown.
for (const market of ['US', 'MY']) {
    for (const mode of ['standard', 'contrarian']) {
        const response = await fixture.route.GET(fixture.request(`market=${market}&mode=${mode}&enableSocial=false`));
        const seed = await response.json();
        for (const scenario of [
            { name: 'same version', previous: 1, current: 1, changed: false, copy: 'Both snapshots record MY news eligibility version 1.' },
            { name: 'different version', previous: 1, current: 2, changed: true, copy: 'MY news eligibility version changed from 1 to 2.' },
            { name: 'unknown previous version', previous: null, current: 1, changed: null, copy: 'previous unknown, current 1. The comparison cannot establish whether both snapshots used the same eligibility rules.' },
        ]) {
          for (const includeNews of [false, true]) {
            const payload = structuredClone(seed);
            const readings = [{ key: 'vix', name: 'VIX Index', score: 50, weight: includeNews ? .5 : 1, raw_value: 20, last_updated: '2026-10-19', timestamp_basis: 'observed' }, ...(includeNews ? [{key:'news',name:'News Sentiment',score:50,weight:.5,raw_value:0,last_updated:'2026-10-19',timestamp_basis:'retrieved'}] : [])];
            payload.data.metadata.change_reconciliation = reconcileScoreChange({
                current: readings, previous: readings, currentScore: 50, previousScore: 50,
                currentModelVersion: 'fixture-v1', previousModelVersion: 'fixture-v1',
                currentNewsEligibilityVersion: scenario.current,
                previousNewsEligibilityVersion: scenario.previous,
            });
            const signal = fixture.parseSignal(payload, market, mode);
            const html = renderToStaticMarkup(createElement(ConnectedPanels, {
                signal, tab: 'What changed', onSelect: () => assert.fail('Rendering must not select an input'),
                scenario: emptyScenario(), setScenario: () => assert.fail('Change accounting must not mutate scenarios'),
            }));
            const context = `${market} ${mode} ${scenario.name} news included: ${includeNews}`;
            if (market === 'MY') assert.ok(html.includes(scenario.copy), context);
            else assert.doesNotMatch(html, /MY news eligibility version/, context);
            assert.equal(signal.metadata.change_reconciliation.news_eligibility_version.changed, scenario.changed, context);
            if (market === 'MY' && scenario.changed === true) {
                assert.ok(html.includes(includeNews ? 'News contributes to at least one snapshot' : 'News has no applied weight in either snapshot'), context);
                assert.equal(html.includes('may reflect changed eligibility as well as market movement'), includeNews, context);
            }
          }
        }
        const legacy = structuredClone(seed);
        const readings = [{ key: 'vix', name: 'VIX Index', score: 50, weight: 1, raw_value: 20, last_updated: '2026-10-19', timestamp_basis: 'observed' }];
        legacy.data.metadata.change_reconciliation = reconcileScoreChange({
            current: readings, previous: readings, currentScore: 50, previousScore: 50,
            currentModelVersion: 'fixture-v1', previousModelVersion: 'fixture-v1',
        });
        assert.doesNotThrow(() => fixture.parseSignal(legacy, market, mode), `${market} ${mode}: earlier reconciliation payloads remain valid`);
        const invalid = structuredClone(seed);
        const invalidReadings = [{ key: 'vix', name: 'VIX Index', score: 50, weight: 1, raw_value: 20, last_updated: '2026-10-19', timestamp_basis: 'observed' }];
        invalid.data.metadata.change_reconciliation = reconcileScoreChange({
            current: invalidReadings, previous: invalidReadings, currentScore: 50, previousScore: 50,
            currentModelVersion: 'fixture-v1', previousModelVersion: 'fixture-v1',
        });
        invalid.data.metadata.change_reconciliation.news_eligibility_version = { previous: null, current: 1, changed: false };
        assert.throws(() => fixture.parseSignal(invalid, market, mode), /invalid/,
            `${market} ${mode}: parser rejects a contradictory rule-version comparison`);
    }
}

// Parse real route-shaped payloads before rendering the actual headline. A reported
// delta is not permission to reconstruct an unavailable previous score.
for (const market of ['US', 'MY']) {
    for (const mode of ['standard', 'contrarian']) {
        const response = await fixture.route.GET(fixture.request(`market=${market}&mode=${mode}&enableSocial=false`));
        const seed = await response.json();
        assert.equal(response.status, 200);
        for (const previousVersion of [1, 2, undefined, 0, -1, 1.5, '1']) {
            const priorSnapshot = {
                snapshot_date: '2026-09-11', composite_score: 45, tier: 'neutral',
                components: { vix: { score: 45, weight: 1, raw_value: 20, last_updated: '2026-09-11', display_name: 'VIX Index', timestamp_basis: 'observed' } },
                score_drivers: [], origin: 'observed', coverage_note: null,
                metadata_snapshot: { scoring_model_version: 'fixture-v1', ...(previousVersion === undefined ? {} : { my_news_eligibility_version: previousVersion }) },
            };
            const routeFixture = marketRequestFixture({ previousSnapshot: priorSnapshot });
            const routed = await (await routeFixture.route.GET(routeFixture.request(`market=${market}&mode=${mode}&enableSocial=false`))).json();
            const validVersion = typeof previousVersion === 'number' && Number.isSafeInteger(previousVersion) && previousVersion > 0 ? previousVersion : null;
            if (market === 'MY') assert.deepEqual(routed.data.metadata.change_reconciliation.news_eligibility_version, {
                previous: validVersion, current: 1, changed: validVersion === null ? null : validVersion !== 1,
            }, `${market} ${mode} prior eligibility version ${previousVersion ?? 'unknown'}`);
            else assert.equal(routed.data.metadata.change_reconciliation.news_eligibility_version, undefined,
                `${market} ${mode}: MY eligibility metadata is not attached to US comparisons`);
            assert.doesNotThrow(() => routeFixture.parseSignal(routed, market, mode), 'Malformed provenance must not invalidate otherwise valid signal data');
        }
        for (const scenario of [
            { name: 'supplied previous score', previous: 53.25, delta: 5.25, pin: 53.25 },
            { name: 'unavailable previous score', previous: null, delta: 5.25, pin: null },
            { name: 'zero is a valid previous score', previous: 0, delta: 58.5, pin: 0 },
            { name: 'upper boundary previous score', previous: 100, delta: -41.5, pin: 100 },
            { name: 'unchanged score', previous: 58.5, delta: 0, pin: null, unchanged: true },
            { name: 'rounds to unchanged', previous: 58.496, delta: 0.004, pin: null, unchanged: true },
            { name: 'unavailable comparison date', previous: 53.25, delta: 5.25, date: null, pin: null },
            { name: 'unavailable delta', previous: 53.25, delta: null, pin: null },
            { name: 'absent comparison', absent: true, pin: null },
        ]) {
            const payload = structuredClone(seed);
            payload.data.composite_score = 58.5;
            payload.data.metadata.score_delta = {
                previous_score: scenario.previous, delta: scenario.delta,
                previous_date: scenario.date === null ? null : '2026-10-19',
                snapshot_date: '2026-10-20', label: 'Controlled comparison',
            };
            if (scenario.absent) delete payload.data.metadata.score_delta;
            const signal = fixture.parseSignal(payload, market, mode);
            const original = JSON.stringify(signal);
            const html = renderToStaticMarkup(createElement(MarketV81Hero, {
                signal, snapshotDate: '2026-10-20', tierClass: 'neutral',
                onSelect: () => assert.fail('Rendering must not select an input'),
                onDrivers: () => assert.fail('Rendering must not open drivers'),
                onEvidence: () => assert.fail('Rendering must not open evidence'),
            }));
            const context = `${market} ${mode}: ${scenario.name}`;
            const spectrum = html.match(/role="img" aria-label="(Score [0-9]+ on a 0 to 100 scale[^"]+)"/)?.[1];
            assert.ok(spectrum?.startsWith('Score 59 on a 0 to 100 scale;'), context);
            assert.equal(html.includes('class="v81PreviousPin"'), scenario.pin !== null, context);
            if (scenario.pin === null) assert.doesNotMatch(spectrum, /Previous score/, context);
            else {
                assert.ok(spectrum.includes(`Previous score ${scenario.pin.toFixed(0)} on 19 Oct 2026.`), context);
                assert.ok(html.includes(`class="v81PreviousPin" style="left:${scenario.pin}%"`), context);
            }
            if (scenario.unchanged) assert.match(html, /No change since 19 Oct 2026/, context);
            else if (scenario.absent || scenario.date === null || scenario.delta === null) assert.match(html, /Earlier comparable score unavailable/, context);
            else assert.ok(html.includes(`${scenario.delta > 0 ? '+' : ''}${scenario.delta.toFixed(2)} points vs 19 Oct 2026`), `${context}: retain the reported delta`);
            assert.equal(JSON.stringify(signal), original, `${context}: rendering must preserve the payload`);
        }
    }
}
console.log('Market assessment regression passed: both markets/modes, score interpretation, payload-to-headline previous-score provenance, zero/boundary scores, unchanged and unavailable comparisons.');
