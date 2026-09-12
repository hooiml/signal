import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

// Execute real store/route code with an isolated SQL spy. No database or provider access.
export function researchReadFixture({ allowSchema = false } = {}) {
    const cache = new Map();
    const calls = [];
    let failure = null;
    let rows = [];
    let archived = [{ symbol: 'ARCHIVED' }, { symbol: 123 }];
    const sql = async (strings) => {
        const query = strings.join('?').replace(/\s+/g, ' ').trim();
        calls.push(query);
        if (failure && query.includes(failure.match)) throw new Error(failure.message);
        if (/^(CREATE|ALTER) /.test(query) && allowSchema) return [];
        if (query === "SELECT * FROM research_records WHERE user_id = 'default' ORDER BY updated_at DESC") return structuredClone(rows);
        if (query === "SELECT symbol FROM research_archived_symbols WHERE user_id = 'default' ORDER BY archived_at DESC") return structuredClone(archived);
        throw new Error(`Unexpected SQL in Research read: ${query}`);
    };
    function load(file) {
        const absolute = path.resolve(file);
        if (cache.has(absolute)) return cache.get(absolute).exports;
        const compiledModule = { exports: {} };
        cache.set(absolute, compiledModule);
        const localRequire = createRequire(absolute);
        const resolve = (id) => {
            if (id === '@/lib/db') return { sql };
            if (id.startsWith('@/') || id.startsWith('.')) {
                const resolved = id.startsWith('@/') ? path.resolve('src', id.slice(2)) : path.resolve(path.dirname(absolute), id);
                return load(`${resolved}.ts`);
            }
            if (id === '@neondatabase/serverless') throw new Error('Real database access is forbidden in the fixture.');
            return localRequire(id);
        };
        const code = ts.transpileModule(readFileSync(absolute, 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
            fileName: absolute,
        }).outputText;
        new Function('require', 'module', 'exports', code)(resolve, compiledModule, compiledModule.exports);
        return compiledModule.exports;
    }
    const { createResearchRecord } = load('src/lib/research/records.ts');
    const record = createResearchRecord({ symbol: 'AAPL', companyName: 'Fixture Apple', market: 'US' });
    rows = [{
        user_id: 'default', symbol: record.symbol, market_type: record.market, company_name: record.companyName,
        position_state: record.positionState, in_buy_zone: record.inBuyZone, research_status: record.status,
        target_buy_zone: record.targetBuyZone, valuation_state: record.valuationState, thesis_strength: record.thesisStrength,
        why_interested: 'Fixture saved thesis', bull_case: '', bear_case: '', buy_trigger: '', sell_trigger: '',
        thesis_break: '', notes: 'Fixture saved note', checklist: record.checklist, monitoring_rules: record.monitoringRules,
        accepted_evidence: [], decision_journal: record.decisionJournal, position_plan: record.positionPlan,
        review_history: [], last_reviewed_at: '2026-09-01', created_at: '2026-09-01T00:00:00.000Z',
        updated_at: '2026-09-12T00:00:00.000Z', revision: 7,
    }];
    return {
        store: load('src/lib/research/store.ts'), route: load('src/app/api/research/watchlist/route.ts'), calls,
        parseWatchlist: load('src/components/v8/research-v8-connected-data.ts').parseWatchlist,
        parseSnapshot: load('src/lib/research/snapshot-input.ts').parseResearchSnapshotResponse,
        setFailure(value) { failure = value; },
        setRows(value) { rows = value; },
        getRows() { return structuredClone(rows); },
        setArchived(value) { archived = value; },
    };
}

export const researchSnapshotFixture = {
    success: true,
    data: {
        symbol: 'AAPL', market: 'US', fetchedAt: '2026-09-12T00:00:00.000Z',
        benchmark: { baselineSymbol: 'VOO', baselineName: 'Vanguard S&P 500 ETF', period: '1Y',
            candidateReturnPercent: null, baselineReturnPercent: null, relativeReturnPercent: null,
            returnBasis: null, status: 'unavailable' },
        quote: { name: 'Fixture Apple', currency: 'USD', price: 200, dailyChangePercent: 0 },
        fundamentals: { revenueGrowthPercent: null, grossMarginPercent: null, operatingMarginPercent: null,
            freeCashFlow: null, debt: null, cash: null, shares: null, annualRevenue: null,
            annualNetIncome: null, reportingPeriod: null, shareChangePercent: null, source: null, history: [] },
        valuation: { marketCap: null, priceEarnings: null, priceSales: null, freeCashFlowYieldPercent: null,
            netCash: null, reportingPeriod: null, source: null },
        technicals: { ma50: null, ma200: null, rsi14: null, macd: null, low52Week: null,
            high52Week: null, averageVolume20: null, support: null, resistance: null },
        chart: { interval: '1d', points: [] }, sources: ['Synthetic QA fixture'], warnings: ['Fixture: fundamentals unavailable.'],
    },
};
