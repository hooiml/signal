import { getCalibrationZone } from '@/lib/market-calibration';
import type { Market } from './market-v8-fixtures';

// Entirely synthetic observations and outcomes. Never supplied to production scoring or storage.
export const calibrationZones = [
    { id: 'negative', label: 'Negative · 0–39', score: 25 },
    { id: 'mixed', label: 'Mixed · 40–64', score: 52 },
    { id: 'positive', label: 'Positive · 65–84', score: 74 },
    { id: 'strong-positive', label: 'Strong positive · 85–100', score: 90 },
] as const;
export type CalibrationZone = typeof calibrationZones[number]['id'];
export type Outcome = { date: string; score: number; origin: 'observed' | 'reconstructed'; seven: number; thirty: number };
const returns = [
    [[-2,-4],[-1,2],[1,-3],[-3,-6],[2,4],[-.5,-1],[.2,1],[-1.5,-2]],
    [[.3,1],[-.8,-2],[1.2,10],[-.4,2],[.6,-1],[-1.1,-9],[1.5,4],[0,0]],
    [[1,3],[2,5],[-1,-4],[.5,2],[1.5,4],[-2,-6],[.8,1],[1.2,-1]],
    [[1.5,2],[2,-1],[-2.5,-7],[1,4],[-1,-3],[.5,1],[-3,-5],[2.5,6]],
];
export function calibrationRows(market: Market, partial: boolean): Outcome[] {
    return calibrationZones.flatMap((zone, z) => returns[z].slice(0, partial ? 3 : 8).map(([seven, thirty], i) => ({
        date: new Date(Date.UTC(2026, 4, 1 + (i * 4 + z) * 3)).toISOString().slice(0, 10),
        score: zone.score, origin: i < 6 ? 'observed' : 'reconstructed',
        seven: Number((seven * (market === 'MY' ? .6 : 1)).toFixed(2)),
        thirty: Number((thirty * (market === 'MY' ? .6 : 1)).toFixed(2)),
    })));
}
export function outcomeStats(rows: Outcome[], days: 7 | 30) {
    const values = rows.map(r => days === 7 ? r.seven : r.thirty).sort((a,b) => a-b);
    const n = values.length;
    return { count: n, observed: rows.filter(r => r.origin === 'observed').length, sufficient: n >= 5,
        median: n ? (values[Math.floor((n-1)/2)] + values[Math.floor(n/2)]) / 2 : null,
        positive: n ? values.filter(v => v > 0).length / n * 100 : null,
        worst: n ? values[0] : null, best: n ? values[n-1] : null };
}
export const rowsInZone = (rows: Outcome[], zone: CalibrationZone) => rows.filter(row => getCalibrationZone(row.score) === zone);

export type ContextReading = { name: string; reading: string; date: string; cadence: string; source: string; reasoning: string; limitation: string; facts?: string[] };
export function contextIndicatorReading(market: Market, partial: boolean) {
    return {
        value: market === 'US' ? partial ? -1.3 : -1.2 : partial ? .53 : .5,
        date: partial ? '2026-08-14' : '2026-09-04',
        units: market === 'US' ? 'pp · 1-month spread' : 'pp · 10Y minus 3Y',
        source: market === 'US' ? 'Synthetic equal/cap-weight series' : 'Synthetic Malaysian rates',
        limitation: 'Context only. No score contribution or provider verification. Historical series is not supplied.',
    };
}
export function contextReadings(market: Market, partial = false): ContextReading[] {
    const readings: ContextReading[] = market === 'US' ? [
        { name: 'Market benchmarks', reading: 'S&P 500 +0.8% · Nasdaq +1.1% · Russell 2000 −0.3%', date: '2026-09-04', cadence: 'Daily close', source: 'Synthetic index observations', reasoning: 'Large indices advance while small caps lag. The headline move is not broad confirmation.', limitation: 'Daily index moves describe this example session only.' },
        { name: 'Breadth & concentration', reading: 'Equal weight +0.4% · cap weight +1.6% · spread −1.2 pp', date: '2026-09-04', cadence: 'One-month return window', source: 'Synthetic equal/cap-weight series', reasoning: 'Equal weight trails cap weight. Participation offers weaker support than the headline index.', limitation: 'A participation proxy, not an advance/decline count. Spread is a percentage-point difference.' },
        { name: 'Rates & financial conditions', facts: ['Treasury 10Y 3.80% and 3M 4.00% · 2 Sep 2026', 'NFCI −0.25 · week ending 28 Aug 2026; fixture publication 2 Sep'], reading: '10Y–3M spread −0.20 pp · NFCI −0.25', date: '2026-09-02', cadence: 'Weekly context snapshot', source: 'Synthetic Treasury and financial-conditions observations', reasoning: 'An inverted curve and looser-than-average financial conditions give different signals.', limitation: 'Different series and horizons; neither automatically adds or removes score points.' },
        { name: 'Long-term valuation', facts: ['Corporate equity value: USD 45,000 billion · 30 Jun 2026', 'Annualized GDP: USD 25,000 billion · Q2 2026', '45,000 ÷ 25,000 × 100 = 180% · synthetic inputs'], reading: 'Corporate equity value / GDP · 180%', date: '2026-06-30', cadence: 'Quarterly example', source: 'Synthetic equity-value and GDP observations', reasoning: 'An elevated valuation backdrop adds a slower-moving caution alongside daily sentiment.', limitation: 'Uses a corporate-equity/GDP proxy. This is neither a timing tool nor a company valuation.' },
    ] : [
        { name: 'Market benchmark', reading: 'FBM KLCI +0.3%', date: '2026-09-04', cadence: 'Daily close', source: 'Synthetic KLCI observation', reasoning: 'The benchmark advances modestly. Broader Malaysian participation data is not supplied.', limitation: 'Do not infer market breadth from the KLCI alone.' },
        { name: 'Native rates', facts: ['OPR 2.75% · observation 20 Aug 2026', 'MYOR 2.74% · observation 4 Sep 2026', '3-month Treasury bill 2.72% · observation 4 Sep 2026'], reading: 'MGS 3Y 3.10% · 10Y 3.60% · spread +0.50 pp', date: '2026-09-04', cadence: 'Daily rates snapshot', source: 'Synthetic Malaysian rates', reasoning: 'The longer government yield is above the shorter yield. OPR 2.75% and MYOR 2.74% provide short-rate context.', limitation: 'Illustrative rates at one date; no policy-event narrative or future rate path is implied.' },
        { name: 'Currency context', reading: 'USD/MYR 4.25 · daily change −0.2%', date: '2026-09-04', cadence: 'Daily close', source: 'Synthetic currency observation', reasoning: 'A lower USD/MYR reading means a stronger ringgit in this example.', limitation: 'The exchange-rate level is context. It is distinct from the scored currency-volatility proxy.' },
    ];
    if (partial) {
        readings[1] = market === 'US'
            ? { ...readings[1], date: '2026-08-14', reading: 'Equal weight −0.2% · cap weight +1.1% · spread −1.3 pp', reasoning: 'The older one-month sample showed narrower participation. It cannot confirm conditions on 4 September.' }
            : { ...readings[1], date: '2026-08-14', facts: ['OPR, MYOR and Treasury bill observations unavailable for this partial example.'], reading: 'MGS 3Y 3.15% · 10Y 3.68% · spread +0.53 pp', reasoning: 'This older curve was upward sloping. Current policy and money-market observations are not supplied for the partial example.' };
    }
    return readings;
}
