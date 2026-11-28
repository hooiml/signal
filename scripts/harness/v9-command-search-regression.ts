import assert from 'node:assert/strict';
import {
    MAX_RECENT_TICKERS,
    mergeRecentTicker,
    parseRecentTickers,
    searchLocalResearchRecords,
} from '../../src/lib/research/command-search';
import { createResearchRecord } from '../../src/lib/research/records';
import type { ResearchRecord } from '../../src/lib/types/research';

const baseAapl = createResearchRecord({ symbol: 'AAPL', market: 'US', companyName: 'Apple Inc.' });
const aapl: ResearchRecord = {
    ...baseAapl,
    whyInterested: 'High services gross margin and sticky ecosystem cash generation.',
    thesisBreak: 'App Store regulatory compression reduces net services profitability.',
    acceptedEvidence: [
        {
            id: 'ev-1',
            title: 'Services revenue share expanding',
            summary: 'Recurring ecosystem revenue reached record 26% mix.',
            target: 'whyInterested',
            tone: 'positive',
            mode: 'evidence',
            acceptedAt: '2026-10-01T00:00:00.000Z',
            sources: [{ id: 's-1', label: '10-K Segment Note', value: '26%', source: 'SEC EDGAR', sourceUrl: 'https://sec.gov/example', reportingPeriod: '2026' }],
        },
    ],
    documentEvidence: {
        version: 1,
        migrationState: 'current',
        citations: [
            {
                id: 'cit-1',
                market: 'US',
                symbol: 'AAPL',
                sourceKind: '10-K',
                publicationDate: '2026-10-20',
                reportingPeriod: 'FY2026',
                title: 'Form 10-K Annual Report',
                sourceUrl: 'https://www.sec.gov/Archives/edgar/data/320193/example.htm',
                providerLabel: 'SEC EDGAR',
                location: 'Item 7 · Liquidity',
                excerpt: 'Operating cash flow exceeded capital expenditures by $98B during fiscal 2026.',
                capturedAt: '2026-10-21T00:00:00.000Z',
                contentDigest: 'sha256:fixture',
                captureMethod: 'sec-official',
            },
        ],
    },
    monitoringRules: {
        ...baseAapl.monitoringRules,
        rsiBelow: 28,
        structuredTriggers: {
            version: 1,
            migrationState: 'current',
            rules: [
                {
                    id: 'trig-pe',
                    enabled: true,
                    purpose: 'opportunity-review',
                    metric: 'price-earnings',
                    operator: 'below',
                    threshold: 24,
                },
            ],
        },
    },
};

const maybank = createResearchRecord({ symbol: '1155', market: 'MY', companyName: 'Malayan Banking Berhad' });

// 1. Symbol and company name search
const companyHits = searchLocalResearchRecords([aapl, maybank], 'Malayan');
assert.equal(companyHits[0]?.symbol, '1155');
assert.equal(companyHits[0]?.market, 'MY');
assert.equal(companyHits[0]?.tag, 'Saved');
assert.equal(companyHits[0]?.tab, undefined);

// 2. Thesis search -> review tab
const thesisHits = searchLocalResearchRecords([aapl, maybank], 'regulatory compression');
assert.ok(thesisHits.some(hit => hit.symbol === 'AAPL' && hit.tab === 'review' && hit.tag === 'Thesis'));

// 3. Multi-word symbol + thesis search -> review tab
const multiWordHits = searchLocalResearchRecords([aapl, maybank], 'AAPL sticky ecosystem');
assert.ok(multiWordHits.some(hit => hit.symbol === 'AAPL' && hit.tab === 'review' && hit.tag === 'Thesis'));

// 4. Primary-document citation & accepted evidence search -> evidence tab
const citationHits = searchLocalResearchRecords([aapl, maybank], 'exceeded capital expenditures');
assert.ok(citationHits.some(hit => hit.symbol === 'AAPL' && hit.tab === 'evidence' && hit.tag === 'Citation'));

const evidenceHits = searchLocalResearchRecords([aapl, maybank], 'Recurring ecosystem revenue');
assert.ok(evidenceHits.some(hit => hit.symbol === 'AAPL' && hit.tab === 'evidence' && hit.tag === 'Evidence'));

// 5. Monitoring rules & structured triggers -> monitoring tab
const monitorHits = searchLocalResearchRecords([aapl, maybank], 'Price / earnings below 24');
assert.ok(monitorHits.some(hit => hit.symbol === 'AAPL' && hit.tab === 'monitoring' && hit.tag === 'Monitor'));

// 6. Bounds: scans <= 200 records, returns <= maxResults, snippet <= 110 chars
const manyRecords = Array.from({ length: 240 }, (_, index) => ({
    ...createResearchRecord({ symbol: `T${index}`, market: 'US', companyName: `Company ${index}` }),
    whyInterested: `${'long thesis note '.repeat(12)}unique-marker-${index}`,
}));
const boundedHits = searchLocalResearchRecords(manyRecords, 'long thesis note', 5);
assert.equal(boundedHits.length, 5);
assert.ok(boundedHits.every(hit => hit.subtitle.length <= 110));
assert.equal(searchLocalResearchRecords(manyRecords, 'unique-marker-220').length, 0);

// 7. Recent tickers parsing, deduplication, and cap
assert.deepEqual(parseRecentTickers('not-json{'), []);
let recent = parseRecentTickers(null);
for (let i = 0; i < 8; i++) {
    recent = mergeRecentTicker(recent, { symbol: `SYM${i}`, market: i % 2 === 0 ? 'US' : 'MY', companyName: `Company ${i}` }, `2026-10-0${i + 1}T00:00:00.000Z`);
}
assert.equal(recent.length, MAX_RECENT_TICKERS);
assert.equal(recent[0]?.symbol, 'SYM7');
recent = mergeRecentTicker(recent, { symbol: 'sym5', market: 'MY' }, '2026-10-10T00:00:00.000Z');
assert.equal(recent.length, MAX_RECENT_TICKERS);
assert.equal(recent[0]?.symbol, 'SYM5');
assert.equal(recent[0]?.companyName, 'Company 5');

console.log('V9 command search regression checks passed.');
