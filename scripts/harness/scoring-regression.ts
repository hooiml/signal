import { calculateCompositeScoreV2 } from '../../src/lib/sentiment-calculator-v2';
import { calculateDriverChanges, parseStoredComponentContributions, parseStoredDriverContributions } from '../../src/lib/signal-change';
import { IndicatorData } from '../../src/lib/types/signal-v2';
import { buildBuffettIndicator, normalizeNaaimExposure, normalizePutCallRatio, parseCboePutCallRatio, parseFredLatestObservation, parseNaaimExposure } from '../../src/lib/market-indicators';
import { buildBreadthContext, buildFinancialConditionsContext, buildYieldCurveContext, parseFredSeriesObservation, parseMalaysiaBenchmarkPage } from '../../src/lib/market-context';

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

function runMarketContextTests() {
    const yieldCurveObservation = parseFredSeriesObservation(
        '2026-07-14:&nbsp; <span class="series-meta-observation-value">0.74</span>'
    );
    const nfciObservation = parseFredSeriesObservation(
        '2026-07-03: <span class="series-meta-observation-value">-0.515</span>'
    );

    assertTrue(yieldCurveObservation !== null, 'FRED daily series parser returns yield-curve data');
    assertTrue(nfciObservation !== null, 'FRED daily series parser returns NFCI data');
    if (!yieldCurveObservation || !nfciObservation) throw new Error('FRED context parser unexpectedly returned null');

    assertEqual(buildYieldCurveContext(yieldCurveObservation).state, 'normal', 'positive curve spread is normal');
    assertEqual(buildFinancialConditionsContext(nfciObservation).stance, 'looser', 'negative NFCI is looser than average');

    const malaysia = parseMalaysiaBenchmarkPage(`
        OVERNIGHT POLICY RATE 2.75% as at 07 May 2026
        MGS 10 YEAR YIELD 3.64% as at 14 Jul 2026
        MYOR 2.75% as at 14 Jul 2026
        Trading Date: 14 Jul 2026
        Malaysian Government Securities (MGS) - Conventional
        MGS Benchmarks Trading Yields Total Volume (MYR mil) Daily change (bps)
        Tenor Maturity Coupon (%) Low (%) High (%) Close (%)
        10Y July 2035 3.48 3.64 3.66 3.64 453.80 2
        3Y March 2029 3.24 3.26 3.28 3.28 114.75 2
        Malaysian Government Investment Issues (MGII)
        Short-Term Bills Type of Bills Up to 3-mth abv. 3 to 6-mth abv. 6 to 12-mth
        BNM Monetary Notes 2.93 2.97 3.01
        For specific enquiries on:
    `);

    assertTrue(malaysia !== null, 'BNM benchmark parser returns Malaysia rates');
    if (!malaysia) throw new Error('BNM benchmark parser unexpectedly returned null');
    assertEqual(malaysia.mgs_3y_pct, 3.28, 'BNM MGS 3Y close');
    assertEqual(malaysia.mgs_10y_pct, 3.64, 'BNM MGS 10Y close');
    assertEqual(malaysia.curve_spread_pct, 0.36, 'BNM MGS curve spread');
    assertEqual(malaysia.opr_report_date, '2026-05-07', 'BNM OPR report date');
    assertEqual(malaysia.short_term_bill_3m_pct, 2.93, 'BNM short-term bill 3M rate');

    const breadth = buildBreadthContext(
        { history: { closes: [], adjustedCloses: [100, 110], volumes: [] } },
        { history: { closes: [], adjustedCloses: [100, 105], volumes: [] } },
        '2026-07-15'
    );
    assertTrue(breadth !== null, 'breadth builder returns equal-weight context');
    assertEqual(breadth?.relative_return_pct, 5, 'equal-weight relative return');
    assertEqual(breadth?.period_label, '1Y', 'breadth period label');
}

function runDriverChangeTests() {
    const current = [
        { key: 'vix', name: 'Volatility Index', contribution: 24 },
        { key: 'social', name: 'Social Sentiment', contribution: 12 },
        { key: 'put_call', name: 'Put/Call Ratio', contribution: 3 },
    ];
    const previous = [
        { key: 'vix', name: 'Volatility Index', contribution: 31 },
        { key: 'social', name: 'Social Sentiment', contribution: 7 },
        { key: 'aaii', name: 'AAII Sentiment', contribution: 2 },
    ];

    const changes = calculateDriverChanges(current, previous);

    assertEqual(changes[0]?.key, 'vix', 'largest driver change sorts first');
    assertEqual(changes[0]?.delta, -7, 'driver change subtracts prior contribution');
    assertEqual(changes[1]?.key, 'social', 'second-largest driver change');
    assertEqual(changes[1]?.delta, 5, 'positive driver change is preserved');
    assertEqual(changes[2]?.key, 'put_call', 'new driver remains attributable');
    assertEqual(changes[2]?.previous_contribution, 0, 'new driver has zero prior contribution');
    assertEqual(changes[3]?.key, 'aaii', 'removed driver remains attributable');
    assertEqual(changes[3]?.current_contribution, 0, 'removed driver has zero current contribution');

    const fractionalChanges = calculateDriverChanges(
        [{ key: 'vix', name: 'Volatility Index', contribution: 10.4 }],
        [{ key: 'vix', name: 'Volatility Index', contribution: 10.1 }],
    );
    assertNear(fractionalChanges[0]?.delta ?? 0, 0.3, 0.001, 'fractional contribution shifts are preserved');
    assertEqual(calculateDriverChanges(current, current).length, 0, 'unchanged contributions produce no attribution');

    const stored = parseStoredDriverContributions([
        { key: 'vix', name: 'Volatility Index', contribution: 10.25 },
        { key: 'invalid', name: 'Invalid driver', contribution: '10' },
    ]);
    assertEqual(stored?.length, 1, 'stored driver parser excludes malformed entries');
    assertEqual(stored?.[0]?.contribution, 10.25, 'stored driver parser preserves fractional values');
    assertEqual(parseStoredDriverContributions({ key: 'vix' }), null, 'legacy non-array driver payload is marked unavailable');

    const storedComponents = parseStoredComponentContributions({
        vix: { display_name: 'Volatility Index', score: 40.5, weight: 0.35 },
        invalid: { display_name: 'Invalid', score: '40', weight: 0.2 },
    });
    assertEqual(storedComponents?.length, 1, 'stored component parser excludes malformed entries');
    assertNear(storedComponents?.[0]?.contribution ?? 0, 14.175, 0.001, 'stored components reconstruct exact prior contribution');
}

function main() {
    runCoreScoringTests();
    runPutCallTests();
    runNaaimTests();
    runBuffettTests();
    runMarketContextTests();
    runDriverChangeTests();
    assertTrue(true, 'scoring regression tests reached completion');
    console.log('Scoring regression tests passed.');
}

main();
