import assert from 'node:assert/strict';
import {
    defaultDiscoveryFilterState,
    extractDiscoverySectors,
    filterDiscoveryRows,
    formatDiscoveryRankDelta,
} from '../../src/lib/research/discover-v9';
import {
    addPickerPreset,
    parsePickerPresets,
    PICKER_PRESET_LIMIT,
    removePickerPreset,
} from '../../src/lib/research/picker-presets';
import type { PickerConfig } from '../../src/lib/research/picker';
import type { QualityDiscoveryResult } from '../../src/lib/types/research-discovery';

const makeRow = (overrides: Partial<QualityDiscoveryResult>): QualityDiscoveryResult => ({
    symbol: 'MSFT',
    name: 'Microsoft Corp.',
    price: 425,
    momentum3MonthPercent: 18,
    momentum6MonthPercent: 28,
    distanceFromMa50Percent: 6,
    averageDollarVolume: 1_000_000_000,
    volumeSpikeRatio: 1.1,
    maxDailyMovePercent: 3.5,
    annualizedVolatilityPercent: 22,
    aboveMa50: true,
    aboveMa200: true,
    trendScore: 84,
    riskScore: 12,
    risk: 'low',
    reasons: ['Sustained 3M/6M trend'],
    flags: [],
    qualityScore: 88,
    discoveryScore: 86,
    category: 'quality compounder',
    qualityReasons: ['Positive free cash flow'],
    sector: 'Technology',
    sectorRelativeStrengthPercent: 4.5,
    scoreChange1Day: 1,
    scoreChange1Week: 3,
    scoreChange1Month: null,
    rankChange1Week: 2,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    earlyTrendStage: 'confirmed',
    valuation: {
        guardrail: 'fair',
        priceEarnings: 31,
        priceSales: 10,
        freeCashFlowYieldPercent: 2.8,
    },
    catalyst: null,
    ownership: null,
    ...overrides,
});

// 1. Rank/score delta formatting
assert.deepEqual(formatDiscoveryRankDelta(makeRow({ rankChange1Week: 4 })), {
    label: '▲ +4',
    tone: 'up',
    title: '1-week rank change',
});
assert.deepEqual(formatDiscoveryRankDelta(makeRow({ rankChange1Week: -3 })), {
    label: '▼ -3',
    tone: 'down',
    title: '1-week rank change',
});
assert.deepEqual(formatDiscoveryRankDelta(makeRow({ rankChange1Week: null, scoreChange1Day: null, scoreChange1Week: null })), {
    label: 'New',
    tone: 'new',
    title: 'New in discovery scan',
});
assert.deepEqual(formatDiscoveryRankDelta(makeRow({ rankChange1Week: 0, scoreChange1Day: 5, scoreChange1Week: 5 })), {
    label: '▲ +5 pts',
    tone: 'up',
    title: '1-day score change',
});
assert.equal(formatDiscoveryRankDelta(makeRow({ rankChange1Week: 0, scoreChange1Day: 0, scoreChange1Week: 0 })), null);

// 2. Sector extraction and row filtering
const rows = [
    makeRow({ symbol: 'MSFT', sector: 'Technology', risk: 'low' }),
    makeRow({ symbol: 'NVDA', sector: 'Technology', risk: 'moderate' }),
    makeRow({ symbol: 'LLY', sector: 'Healthcare', risk: 'low' }),
    makeRow({ symbol: 'XOM', sector: 'Energy', risk: 'high' }),
];
assert.deepEqual(extractDiscoverySectors(rows), ['Energy', 'Healthcare', 'Technology']);

const savedSet = new Set(['MSFT']);
assert.deepEqual(
    filterDiscoveryRows(rows, defaultDiscoveryFilterState, savedSet).map(row => row.symbol),
    ['MSFT', 'NVDA', 'LLY', 'XOM'],
);
assert.deepEqual(
    filterDiscoveryRows(rows, { sector: 'Technology', lowRiskOnly: false, hideSaved: false }, savedSet).map(row => row.symbol),
    ['MSFT', 'NVDA'],
);
assert.deepEqual(
    filterDiscoveryRows(rows, { sector: 'all', lowRiskOnly: true, hideSaved: true }, savedSet).map(row => row.symbol),
    ['LLY'],
);

// 3. Browser-local Picker presets validation, add, dedup, limit, remove
const baseConfig: PickerConfig = {
    horizon: '1M',
    riskProfile: 'conservative',
    minimumScore: 70,
    pickCount: 5,
    maximumPerSector: 2,
    excludeSavedSymbols: true,
};
let presets = addPickerPreset([], 'Quality Core', baseConfig, '2026-11-28T10:00:00.000Z');
assert.equal(presets.length, 1);
assert.equal(presets[0].name, 'Quality Core');

// Case-insensitive name update replaces rather than duplicating
presets = addPickerPreset(presets, 'quality core', { ...baseConfig, minimumScore: 80 }, '2026-11-28T10:05:00.000Z');
assert.equal(presets.length, 1);
assert.equal(presets[0].config.minimumScore, 80);

// Limit cap
for (let i = 0; i < PICKER_PRESET_LIMIT + 3; i++) {
    presets = addPickerPreset(presets, `Preset ${i}`, baseConfig, `2026-11-28T11:${String(i).padStart(2, '0')}:00.000Z`);
}
assert.equal(presets.length, PICKER_PRESET_LIMIT);
const removedId = presets[0].id;
presets = removePickerPreset(presets, removedId);
assert.equal(presets.length, PICKER_PRESET_LIMIT - 1);

// Corrupt preset payloads must throw
assert.throws(() => parsePickerPresets({ notAnArray: true }));
assert.throws(() => parsePickerPresets([{
    id: 'bad',
    name: 'Bad',
    savedAt: '2026-11-28T10:00:00.000Z',
    config: { ...baseConfig, minimumScore: 99 },
}]));
assert.throws(() => parsePickerPresets([{
    id: 'bad-name',
    name: '   ',
    savedAt: '2026-11-28T10:00:00.000Z',
    config: baseConfig,
}]));
