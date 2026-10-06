import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

// Render the actual assessment and its local helpers without providers or SQL.
const modules = new Map();
function load(file) {
    const absolute = path.resolve(file);
    if (modules.has(absolute)) return modules.get(absolute).exports;
    const compiled = { exports: {} };
    modules.set(absolute, compiled);
    const require = id => {
        if (id === 'react/jsx-runtime') return createRequire(absolute)(id);
        if (id.endsWith('.module.css')) return {};
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

const { MarketCurrentAssessment } = load('src/components/v8/MarketV8Coverage.tsx');
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
            assert.equal(signal.composite_score, score, 'Mode interpretation must not invert the numeric score');
        }
    }
}
console.log('Market assessment regression passed: both markets, low/mixed/high scores and repeated Momentum/Contrarian interpretation.');
