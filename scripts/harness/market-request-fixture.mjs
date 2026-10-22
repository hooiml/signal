import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

// Real orchestration, scoring, persistence and route; isolated raw providers and SQL.
export function marketRequestFixture({ allowSchema = false, signalSource, providerReadings = {}, previousSnapshot, providerOverrides, providerFetch, auraRows } = {}) {
    const modules = new Map(), calls = [], events = [], providerTimeouts = [];
    let failure = '', hold = null, sqlHold = null;
    const fixedTime = '2026-09-12T00:00:00.000Z';
    class FixedDate extends Date {
        constructor(...args) { super(...(args.length ? args : [fixedTime])); }
        static now() { return Date.parse(fixedTime); }
    }
    // Supplying providerOverrides preserves fetchCoreMarketData/fetchRawMarketData themselves.
    const provider = (name, fallback) => async (...args) => {
        events.push(name);
        return (providerOverrides?.[name] ?? fallback)(...args);
    };
    const context = market => market === 'US'
        ? { market, yield_curve: null, financial_conditions: null, breadth: null }
        : { market, malaysia_rates: null };
    const externalProviders = {
        'yahoo-finance': {
            fetchVIX: provider('fetchVIX', (...args) => providerFetch
                ? load('src/lib/yahoo-finance.ts').fetchVIX(...args)
                : { price: 20, change: 0, observedAt: new FixedDate('2026-09-11T20:00:00.000Z') }),
            fetchIndicesWithChart: provider('fetchIndicesWithChart', () => []),
            fetchQuotes: provider('fetchQuotes', () => []),
            fetchHistoricalCurrencyVol: provider('fetchHistoricalCurrencyVol', () => ({ currentPrice: 4.2, vol20d: .003, change: .01, observedAt: new FixedDate('2026-09-11T08:00:00.000Z') })),
        },
        reddit: { fetchMultipleSubreddits: provider('fetchMultipleSubreddits', () => []) },
        'rss-feeds': { fetchMarketNews: provider('fetchMarketNews', () => []) },
        stocktwits: { fetchTrendingTwits: provider('fetchTrendingTwits', () => []), calculateStockTwitsSentiment: () => 0 },
        'market-context': { fetchMarketContext: provider('fetchMarketContext', context) },
    };
    const raw = async (market) => {
        events.push('providers');
        if (hold) await hold;
        if (failure === 'providers') throw new Error('Fixture providers unavailable');
        return {
            vixData: { price: 20, change: 0 }, fearGauge: { value: 20, isFxProxy: false }, marketIndices: [], popularStocks: [], activeStocks: [],
            redditPosts: [], stockTwits: [], newsItems: [],
            putCallRatio: providerReadings.putCallRatio ?? null, naaimExposure: providerReadings.naaimExposure ?? null,
            buffettIndicator: null,
            marketContext: market === 'US' ? { market, yield_curve: null, financial_conditions: null, breadth: null } : { market, malaysia_rates: null },
            combinedSentiment: 0, redditSentiment: 0,
            stockTwitsSentiment: 0, newsSentiment: 0,
            sentimentOutput: { score: 50, auraLevel: 'NEUTRAL', components: { vixScore: 50, socialScore: 50 } },
        };
    };
    const sql = async (strings, ...values) => {
        const query = strings.join('?').replace(/\s+/g, ' ').trim();
        calls.push({ query, values });
        if (sqlHold && query.includes('FROM signal_snapshots')) await sqlHold;
        if (failure && query.includes(failure)) throw new Error('Fixture database unavailable');
        if (/^(CREATE|ALTER) /.test(query)) {
            if (!allowSchema) throw new Error('Unexpected DDL in Market request');
            return [];
        }
        if (query.includes('FROM market_signals')) return auraRows ?? [{ signal_date: '2026-09-12', summary: 'Fixture neutral market', key_drivers: [], outlook: 'Fixture outlook' }];
        if (query.includes('FROM signal_snapshots')) return [previousSnapshot ?? { snapshot_date: '2026-09-11', composite_score: 45, tier: 'neutral', components: { vix: { score: 45, weight: 1 } }, score_drivers: [], origin: 'observed', coverage_note: null }];
        if (query.startsWith('INSERT INTO signal_snapshots')) return [];
        throw new Error(`Unexpected SQL: ${query}`);
    };
    const safeModules = new Set(['signal', 'signal-cache', 'sentiment-calculator', 'sentiment-calculator-v2', 'market-score-thresholds', 'market-evidence-coverage', 'market-observation-date', 'social-sentiment', 'indicator-registry', 'signal-change', 'source-indicator', 'market-calibration', 'market-indicators', 'aura-cache', 'MarketV8ConnectedData', 'route-auth']);
    function load(file) {
        const absolute = path.resolve(file);
        if (modules.has(absolute)) return modules.get(absolute).exports;
        const compiled = { exports: {} };
        modules.set(absolute, compiled);
        let source = readFileSync(absolute, 'utf8');
        if (absolute.endsWith(`${path.sep}signal.ts`)) {
            source = signalSource ?? source;
            if (providerOverrides === undefined) {
                const ast = ts.createSourceFile(absolute, source, ts.ScriptTarget.Latest, true);
                const statement = ast.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(ast) === 'fetchRawMarketData'));
                if (!statement) throw new Error('Raw-provider boundary was not found');
                source = source.slice(0, statement.getStart(ast)) + 'export const fetchRawMarketData = __raw;' + source.slice(statement.end);
            }
        }
        const resolve = id => {
            if (id === 'next/server') return createRequire(absolute)(id);
            const resolved = id.startsWith('@/') ? path.resolve('src', id.slice(2)) : path.resolve(path.dirname(absolute), id);
            const name = path.basename(resolved);
            if (name === 'db') return { sql };
            if (name === 'institutional-service') return { getLatestInstitutionalData: async () => { events.push('institutional'); return []; } };
            if (name === 'market-calibration-service') return { getMarketCalibration: async ({ mode }) => {
                events.push('calibration');
                if (failure === 'calibration') throw new Error('Fixture calibration unavailable');
                const calibration = load('src/lib/market-calibration.ts');
                return calibration.calculateMarketCalibration({ snapshots: [], prices: [], mode,
                    benchmarkSymbol: 'FIXTURE', benchmarkName: 'Synthetic benchmark', modelVersion: calibration.MARKET_SCORE_MODEL_VERSION });
            } };
            if (['yahoo-finance', 'reddit', 'rss-feeds', 'stocktwits', 'market-context'].includes(name)) {
                if (providerOverrides !== undefined) return externalProviders[name];
                return new Proxy({}, { get: () => () => { throw new Error('Unexpected provider access'); } });
            }
            if (name === 'market-indicators' && providerOverrides !== undefined) return {
                ...load(`${resolved}.ts`),
                fetchCboePutCallRatio: provider('fetchCboePutCallRatio', () => providerReadings.putCallRatio ?? null),
                fetchNaaimExposure: provider('fetchNaaimExposure', () => providerReadings.naaimExposure ?? null),
                fetchBuffettIndicator: provider('fetchBuffettIndicator', () => null),
            };
            if (!safeModules.has(name)) throw new Error(`Unexpected fixture import: ${id}`);
            return load(`${resolved}.ts`);
        };
        const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
        new Function('require', 'module', 'exports', '__raw', 'Date', 'fetch', 'AbortSignal', code)(
            resolve, compiled, compiled.exports, raw, FixedDate,
            providerFetch ?? (() => { throw new Error('Network access forbidden in fixture'); }),
            { timeout: delay => { providerTimeouts.push(delay); return AbortSignal.timeout(delay); } },
        );
        return compiled.exports;
    }
    return {
        route: load('src/app/api/signals/v2/route.ts'), signal: load('src/lib/signal.ts'), calls, events, providerTimeouts,
        parseSignal: load('src/components/v8/MarketV8ConnectedData.ts').parseConnectedSignal,
        debugRoute: () => load('src/app/api/signals/debug/route.ts'),
        setFailure(value) { failure = value; },
        setHold(value) { hold = value; },
        setSqlHold(value) { sqlHold = value; },
        request(query = '') { return new Request(`http://fixture.invalid/api/signals/v2?${query}`); },
    };
}
