import { calculateCompositeScoreV2 } from '@/lib/sentiment-calculator-v2';
import { tierForMarketScore } from '@/lib/market-sensitivity';
import { INDICATOR_REGISTRY } from '@/lib/indicator-registry';
import type { IndicatorData, MarketSignal } from '@/lib/types/signal-v2';

export type Market = 'US' | 'MY';
export type Mode = MarketSignal['mode'];
export type Example = 'populated' | 'missing' | 'empty';
export type InvestigationTab = 'What changed' | 'Evidence' | 'Context' | 'History' | 'Scenarios';
export const tabs: InvestigationTab[] = ['What changed', 'Evidence', 'Context', 'History', 'Scenarios'];
export const currentDate = '2026-09-04';
export const archiveDate = '2026-08-28';
export type Point = { date: string; value: number };
export type ExplorerIndicator = {
    key: string; name: string; short: string; value: number | null; prior: number | null;
    units: string; score: number; priorScore: number; date: string; cadence: string;
    source: string; meaning: string; limitation: string; history: Point[]; context?: boolean;
};
export const dateLabel = (date: string) => `${Number(date.slice(8, 10))} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(date.slice(5, 7)) - 1]}`;
export const signed = (n: number, digits = 2) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(digits)}`;
export const zoneLabel = (score: number, mode: Mode) => mode === 'standard'
    ? score < 40 ? 'Negative' : score < 65 ? 'Mixed' : score < 85 ? 'Positive' : 'Strong positive'
    : score < 40 ? 'Low risk' : score < 65 ? 'Elevated' : score < 85 ? 'Cautionary' : 'Extreme risk';

// All values and histories in this module are representative fixtures, never provider observations.
// The real calculator supplies weights, neutral reserve, rounding, tiers and agreement.
function trend(end: number, amplitude: number, date: string, weekly = false): Point[] {
    const count = weekly ? 13 : 49;
    const last = Date.parse(`${date}T12:00:00Z`);
    let seed = Math.round(Math.abs(end) * 7919) + 41;
    let level = -0.4;
    const offsets = Array.from({ length: count }, () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        level = level * .85 + (seed / 4294967296 - .5) * .5;
        return level;
    });
    return offsets.map((offset, i) => ({
        date: new Date(last - (weekly ? (count - 1 - i) * 7 : Math.round((count - 1 - i) / (count - 1) * 93)) * 86400000).toISOString().slice(0, 10),
        value: i === count - 1 ? end : Math.round((end + amplitude * offset) * 10000) / 10000,
    }));
}
function driver(key: string, name: string, short: string, value: number, prior: number, units: string, score: number, priorScore: number, cadence: string, source: string, meaning: string, limitation: string): ExplorerIndicator {
    const date = cadence === 'Weekly' ? '2026-09-03' : currentDate;
    const history = trend(value, Math.max(Math.abs(value) * .35, .08), date, cadence === 'Weekly');
    if (cadence === 'Weekly') history[history.length - 2].value = prior;
    else history.push({ date: '2026-09-03', value: prior });
    return { key, name, short, value, prior, units, score, priorScore, date, cadence, source, meaning, limitation,
        history: history.sort((a, b) => a.date.localeCompare(b.date)) };
}
export function indicatorsFor(market: Market, example: Example, archived = false): ExplorerIndicator[] {
    const social = driver('social', 'Social sentiment', 'Social', 0.70, 0.72, '−1 to +1', 85, 86, 'Daily', 'Social aggregate', 'Discussion tone is positive in this example. Online sentiment can add context to participation.', 'No individual posts or provider excerpts are supplied.');
    social.history = [];
    const aaii = driver('aaii', 'AAII bullish sentiment', 'AAII', 50, 50, '% bullish', 100, 100, 'Weekly', 'AAII survey', 'The share of surveyed individual investors expecting prices to rise. Optimism can support momentum while also signalling crowding.', 'A weekly US survey, not a representative poll of all investors.');
    const result = market === 'US' ? [
        driver('vix', 'VIX volatility', 'VIX', 27, 28, 'index points', 37.75, 33.928571, 'Daily', 'VIX feed', 'Expected near-term volatility inferred from options prices. Lower volatility can support calmer conditions.', 'An improving reading can still conflict with a positive market interpretation.'),
        aaii,
        driver('put_call', 'Total put/call ratio', 'Put / call', 0.62, 0.655, 'ratio', 90, 85, 'Daily', 'Cboe statistics', 'Put activity relative to calls. A lower ratio indicates more call-heavy activity.', 'Options activity can reflect hedging; it does not establish future price direction.'),
        driver('naaim', 'NAAIM exposure', 'NAAIM', 82.5, 80, '% exposure', 85, 80, 'Weekly', 'NAAIM survey', 'Reported equity exposure among active managers. High exposure describes participation and potential crowding.', 'A weekly positioning survey, not an intraday trigger.'), social,
    ] : [
        driver('vix', 'USD/MYR volatility proxy', 'FX volatility', 6.2, 6.5, 'proxy units', 60, 58, 'Daily', 'Currency series', 'Currency variability provides a volatility proxy for this market.', 'This is not a native equity-volatility index.'),
        driver('news', 'Malaysia news sentiment', 'News', 0.12, 0.10, '−1 to +1', 56, 55, 'Daily', 'News aggregate', 'The tone of the covered headlines. News has 65% of the configured Malaysian model weight.', 'Concentrated coverage can dominate; headline tone is not company cash flow.'), Object.assign(aaii, { name: 'AAII · US survey proxy', limitation: 'US sentiment used as a proxy; not a survey of Malaysian investors.' }),
    ];
    if (market === 'MY') Object.assign(social, { value: 0, prior: 0, score: 50, priorScore: 50 });
    if (archived) {
        const scores: Record<string, number> = market === 'US' ? { vix: 24, social: 70, put_call: 80, aaii: 100, naaim: 90 } : { vix: 55, news: 50, social: 45, aaii: 85 };
        const values: Record<string, number> = market === 'US' ? { vix: 29.5, social: 0.4, put_call: 0.72, aaii: 50, naaim: 90 } : { vix: 6.8, news: 0, social: -0.1, aaii: 45.5 };
        result.forEach(item => { item.score = scores[item.key]; item.value = values[item.key]; item.prior = null; item.date = archiveDate; item.history = item.key === 'social' ? [] : trend(item.value, Math.abs(item.value) * 0.18, archiveDate, item.cadence === 'Weekly'); });
    } else if (example === 'missing') {
        social.value = null;
        aaii.date = '2026-08-20';
        aaii.history = trend(50, 9, aaii.date, true);
        aaii.history[aaii.history.length - 2].value = aaii.prior!;
    }
    result.push({ key: 'breadth', name: market === 'US' ? 'Market breadth' : 'MGS yield curve', short: market === 'US' ? 'Breadth' : 'MGS curve', value: null, prior: null, units: '', score: 50, priorScore: 50, date: currentDate, cadence: 'Context', source: 'Not supplied', meaning: market === 'US' ? 'Equal-weight versus cap-weight performance helps reveal how broadly market gains are shared.' : 'Malaysia’s native 3Y–10Y government bond curve provides rates context.', limitation: 'Context only. It never changes the composite score.', history: [], context: true });
    return result;
}
export function isStale(indicator: ExplorerIndicator, asOf = currentDate): boolean {
    return (Date.parse(asOf) - Date.parse(indicator.date)) / 86400000 > (INDICATOR_REGISTRY[indicator.key]?.staleAfterDays ?? Infinity);
}
export function signalFor(indicators: ExplorerIndicator[], market: Market, mode: Mode, sourceOn: boolean, prior = false, asOf = currentDate): MarketSignal {
    const snapshotDate = prior ? '2026-09-03' : asOf;
    const inputs: IndicatorData[] = indicators.filter(i => !i.context && (prior ? i.prior : i.value) !== null && !isStale(i, snapshotDate) && (sourceOn || i.key !== 'social')).map(i => ({
        name: i.key, display_name: i.name, value: prior ? i.prior ?? i.value! : i.value!, score: prior ? i.priorScore : i.score,
        weight: 0, signal: tierForMarketScore(i.score, mode), enabled: true, last_updated: i.date,
    }));
    const signal = calculateCompositeScoreV2(inputs, { market, mode });
    signal.metadata.score_drivers = Object.values(signal.components).map(i => ({ key: i.name, name: i.display_name, impact: i.score >= 65 ? 'positive' : i.score < 40 ? 'negative' : 'neutral', contribution: i.score * i.weight, score: i.score, weight: i.weight, raw_value: i.value, last_updated: i.last_updated, detail: 'Illustrative normalized input' }));
    return signal;
}
export function scoreHistory(current: number, archived: number, prior: number): Point[] {
    const points = trend(current, 17, currentDate);
    points.push({ date: archiveDate, value: archived }, { date: '2026-09-03', value: prior });
    return points.sort((a, b) => a.date.localeCompare(b.date)).map(p => ({ ...p, value: Math.round(p.value) }));
}
export function stance(indicator: ExplorerIndicator, signal: MarketSignal): 'Support' | 'Conflict' | 'Mixed' | 'Context only' | 'Unavailable' | 'Disabled' | 'Stale · excluded' {
    if (indicator.context) return 'Context only';
    if (indicator.value === null) return 'Unavailable';
    const component = signal.components[indicator.key];
    if (!component) return isStale(indicator) ? 'Stale · excluded' : 'Disabled';
    const direction = (score: number) => score >= 65 ? 1 : score < 40 ? -1 : 0;
    if (direction(component.score) === direction(signal.composite_score)) return 'Support';
    return direction(component.score) === 0 ? 'Mixed' : 'Conflict';
}
