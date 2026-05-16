import { calculateCompositeScoreV2 } from '../../src/lib/sentiment-calculator-v2';
import { IndicatorData } from '../../src/lib/types/signal-v2';
import { buildBuffettIndicator, normalizeNaaimExposure, normalizePutCallRatio, parseCboePutCallRatio, parseFredLatestObservation, parseNaaimExposure } from '../../src/lib/market-indicators';

function indicator(overrides: Partial<IndicatorData> & Pick<IndicatorData, 'name' | 'score' | 'value'>): IndicatorData {
    return {
        display_name: overrides.name.toUpperCase(),
        weight: 0,
        signal: 'neutral',
        enabled: true,
        last_updated: '2026-05-13T00:00:00.000Z',
        ...overrides,
    };
}

function assertEqual<T>(actual: T, expected: T, label: string) {
    if (actual !== expected) {
        throw new Error(`${label}: expected ${expected}, got ${actual}`);
    }
}

function assertNear(actual: number, expected: number, epsilon: number, label: string) {
    if (Math.abs(actual - expected) > epsilon) {
        throw new Error(`${label}: expected ${expected}, got ${actual}`);
    }
}

function assertTrue(condition: boolean, label: string) {
    if (!condition) {
        throw new Error(label);
    }
}

function runCoreScoringTests() {
    const standardUs = calculateCompositeScoreV2([
        indicator({ name: 'vix', value: 18, score: 50 }),
        indicator({ name: 'social', value: 0.2, score: 60 }),
        indicator({ name: 'put_call', display_name: 'Put/call ratio', value: 0.74, score: 73 }),
    ], { market: 'US', mode: 'standard' });

    assertEqual(standardUs.composite_score, 57, 'US VIX/social/put-call score');
    assertNear(standardUs.metadata.weight_distribution.vix, 0.538, 0.001, 'US VIX redistributed weight');
    assertNear(standardUs.metadata.weight_distribution.social, 0.308, 0.001, 'US social redistributed weight');
    assertNear(standardUs.metadata.weight_distribution.put_call, 0.154, 0.001, 'US put/call redistributed weight');
    assertEqual(standardUs.confidence.level, 'moderate', 'three-source mixed agreement stays moderate');

    const vixOnly = calculateCompositeScoreV2([
        indicator({ name: 'vix', value: 22, score: 40 }),
    ], { market: 'US', mode: 'standard' });

    assertEqual(vixOnly.composite_score, 40, 'VIX-only score');
    assertNear(vixOnly.metadata.weight_distribution.vix, 1, 0, 'VIX-only weight');
    assertEqual(vixOnly.confidence.level, 'low', 'single-source confidence');

    const highVol = calculateCompositeScoreV2([
        indicator({ name: 'vix', value: 35, score: 10 }),
        indicator({ name: 'social', value: -0.5, score: 20 }),
        indicator({ name: 'aaii', value: 45, score: 80 }),
    ], { market: 'US', mode: 'standard' });

    assertEqual(highVol.composite_score, 12, 'high-volatility override score');
    assertNear(highVol.metadata.weight_distribution.vix, 0.85, 0, 'high-volatility VIX weight');
    assertNear(highVol.metadata.weight_distribution.social, 0.15, 0, 'high-volatility social weight');
    assertEqual(highVol.metadata.weight_distribution.aaii, undefined, 'zero-weight AAII excluded during high-volatility override');

    const malaysia = calculateCompositeScoreV2([
        indicator({ name: 'vix', display_name: 'USD/MYR Volatility', value: 22, score: 60 }),
        indicator({ name: 'news', display_name: 'News Sentiment', value: 0.6, score: 80 }),
        indicator({ name: 'aaii', display_name: 'AAII Sentiment', value: 45, score: 80 }),
    ], { market: 'MY', mode: 'standard' });

    assertEqual(malaysia.composite_score, 74, 'MY score');
    assertNear(malaysia.metadata.weight_distribution.news, 0.588, 0.001, 'MY news redistributed weight');

    const unknownIndicator = calculateCompositeScoreV2([
        indicator({ name: 'vix', value: 18, score: 50 }),
        indicator({ name: 'unknown_positioning', value: 95, score: 95 }),
    ], { market: 'US', mode: 'standard' });

    assertEqual(unknownIndicator.composite_score, 50, 'unknown indicator does not alter score');
    assertEqual(unknownIndicator.components.unknown_positioning, undefined, 'unknown indicator excluded from scored components');
    assertEqual(unknownIndicator.confidence.source_count, 1, 'unknown indicator excluded from confidence source count');
}

function runPutCallTests() {
    const parsed = parseCboePutCallRatio(
        '<table><tr><td>TOTAL PUT/CALL RATIO</td><td>0.74</td></tr></table>',
        '2026-05-13T00:00:00.000Z'
    );

    assertTrue(parsed !== null, 'Cboe put/call ratio parser returns data');
    assertEqual(parsed?.ratio, 0.74, 'Cboe put/call ratio parser value');
    assertEqual(normalizePutCallRatio(0.55), 100, 'low put/call maps to greed/complacency');
    assertEqual(normalizePutCallRatio(1.25), 0, 'high put/call maps to fear/hedging');
    assertEqual(normalizePutCallRatio(0.90), 50, 'middle put/call maps to neutral');
}

function runNaaimTests() {
    const parsed = parseNaaimExposure(
        '<table><tr><td>05/06/2026</td><td>96.67</td><td>0</td></tr></table>',
        '2026-05-13T00:00:00.000Z'
    );

    assertTrue(parsed !== null, 'NAAIM parser returns data');
    assertEqual(parsed?.exposure, 96.67, 'NAAIM parser value');
    assertEqual(parsed?.reportDate, '2026-05-06', 'NAAIM parser report date');
    assertEqual(normalizeNaaimExposure(40), 0, 'low manager exposure maps to fear');
    assertEqual(normalizeNaaimExposure(90), 100, 'high manager exposure maps to greed/crowding');
    assertEqual(normalizeNaaimExposure(65), 50, 'middle manager exposure maps to neutral');

    const withNaaim = calculateCompositeScoreV2([
        indicator({ name: 'vix', value: 18, score: 50 }),
        indicator({ name: 'social', value: 0.2, score: 60 }),
        indicator({ name: 'put_call', value: 0.74, score: 73 }),
        indicator({ name: 'naaim', value: 96.67, score: 100 }),
    ], { market: 'US', mode: 'standard' });

    assertEqual(withNaaim.composite_score, 62, 'NAAIM participates in US score');
    assertNear(withNaaim.metadata.weight_distribution.naaim, 0.133, 0.001, 'NAAIM redistributed weight');
}

function runBuffettTests() {
    const gdp = parseFredLatestObservation(
        'Q1 2026: <span class="series-meta-observation-value">31,856.257</span>'
    );
    const equities = parseFredLatestObservation(
        'Q4 2025: <span class="series-meta-observation-value">51,375,828</span>'
    );

    assertTrue(gdp !== null, 'FRED GDP parser returns data');
    assertTrue(equities !== null, 'FRED equities parser returns data');
    assertEqual(gdp?.reportDate, '2026-03-31', 'FRED GDP parser quarter-end date');
    assertEqual(equities?.reportDate, '2025-12-31', 'FRED equities parser quarter-end date');

    if (!gdp || !equities) {
        throw new Error('FRED parser unexpectedly returned null');
    }

    const buffett = buildBuffettIndicator(equities, gdp);
    assertEqual(buffett.ratioPct, 161.3, 'Buffett Indicator ratio');
    assertEqual(buffett.label, 'Elevated valuation backdrop', 'Buffett Indicator label');
}

function main() {
    runCoreScoringTests();
    runPutCallTests();
    runNaaimTests();
    runBuffettTests();
    assertTrue(true, 'scoring regression tests reached completion');
    console.log('Scoring regression tests passed.');
}

main();
