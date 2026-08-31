import 'server-only';

import type { CandleV04 } from './v0-4';

export const tradingReplayCaseIdsV04 = ['range-break-2024', 'trend-pullback-2023'] as const;
export type TradingReplayCaseIdV04 = (typeof tradingReplayCaseIdsV04)[number];
export type TradingReplayIntroV04 = { readonly caseId: TradingReplayCaseIdV04; readonly replayId: string; readonly symbol: string; readonly timeframe: string; readonly title: string; readonly contextKnownAsOf: string; readonly context: string; readonly candles: readonly CandleV04[]; readonly execution: { readonly spread: number; readonly slippage: number; readonly fee: number; readonly note: string }; readonly sourceNote: string };
export type TradingReplayAdvanceV04 = { readonly candle: CandleV04 | null; readonly complete: boolean; readonly debrief: readonly string[] | null };

const buildCandles = (date: string, closes: readonly number[], volumes: readonly number[]): readonly CandleV04[] => closes.map((close, index) => {
    const open = index === 0 ? close - 0.4 : closes[index - 1]; const hour = 9 + Math.floor((30 + index * 15) / 60); const minute = (30 + index * 15) % 60; const closeMinute = minute + 15; const closeHour = hour + Math.floor(closeMinute / 60);
    const openTime = `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`; const closeTime = `${date}T${String(closeHour).padStart(2, '0')}:${String(closeMinute % 60).padStart(2, '0')}:00.000Z`;
    return { openTime, closeTime, open, high: Math.max(open, close) + 0.45 + (index % 3) * 0.08, low: Math.min(open, close) - 0.38 - (index % 2) * 0.07, close, volume: volumes[index] ?? 1000, knownAsOf: closeTime };
});

const fixtures: Readonly<Record<TradingReplayCaseIdV04, { intro: Omit<TradingReplayIntroV04, 'candles'>; candles: readonly CandleV04[]; initialCount: number; debrief: readonly string[] }>> = {
    'range-break-2024': {
        intro: { caseId: 'range-break-2024', replayId: 'range-break-2024-15m', symbol: 'EDU-A', timeframe: '15 minute', title: 'Range boundary and failed-break risk', contextKnownAsOf: '2024-04-18T12:15:00.000Z', context: 'A liquid educational instrument has traded between roughly $99 and $102. The broad market is flat. Classify the structure and decide whether a complete setup exists.', execution: { spread: 0.04, slippage: 0.03, fee: 1, note: 'Illustrative liquid large-cap execution assumption.' }, sourceNote: 'Curated educational candles. Values are illustrative and not a public-issuer claim.' },
        candles: buildCandles('2024-04-18', [100, 100.6, 101.2, 101.7, 101.1, 100.5, 99.9, 99.4, 99.8, 100.7, 101.5, 101.9, 102.3, 102.8, 102.1, 101.6, 101.1, 100.4, 99.7, 99.1, 98.7, 99.3, 99.8, 100.2], [900, 980, 1040, 1200, 940, 880, 1020, 1160, 920, 970, 1100, 1320, 1700, 2100, 1850, 1400, 1250, 1600, 1900, 2200, 2400, 1800, 1450, 1300]),
        initialCount: 12,
        debrief: ['A temporary break above the range did not guarantee continuation.', 'Process quality depends on the pre-committed trigger, invalidation, risk, and management rather than the later P&L.', 'No Trade was valid if the trigger or execution conditions were incomplete.'],
    },
    'trend-pullback-2023': {
        intro: { caseId: 'trend-pullback-2023', replayId: 'trend-pullback-2023-15m', symbol: 'EDU-B', timeframe: '15 minute', title: 'Trend, pullback, and persistent momentum', contextKnownAsOf: '2023-11-07T12:15:00.000Z', context: 'Price has formed higher highs and higher lows. RSI may be elevated. Decide whether the calculated state alone is sufficient for a setup.', execution: { spread: 0.08, slippage: 0.08, fee: 1, note: 'Illustrative moderate-liquidity execution assumption.' }, sourceNote: 'Curated educational candles. Values are illustrative and not a public-issuer claim.' },
        candles: buildCandles('2023-11-07', [48, 48.4, 48.9, 49.3, 49.8, 49.5, 49.2, 49.7, 50.2, 50.8, 51.3, 51.0, 51.5, 52.1, 52.8, 53.2, 52.9, 53.5, 54.1, 54.6, 54.3, 54.9, 55.4, 55.8], [700, 760, 820, 900, 980, 720, 680, 800, 920, 1100, 1300, 840, 960, 1200, 1500, 1700, 1050, 1300, 1600, 1800, 1200, 1450, 1680, 1900]),
        initialCount: 12,
        debrief: ['An elevated RSI described persistent momentum; it did not independently require a short.', 'Compare planned invalidation and execution assumptions with every management change.', 'A winning outcome cannot repair a missing setup or oversized risk.'],
    },
};

export const isTradingReplayCaseIdV04 = (value: string): value is TradingReplayCaseIdV04 => tradingReplayCaseIdsV04.includes(value as TradingReplayCaseIdV04);
export const getTradingReplayIntroV04 = (caseId: TradingReplayCaseIdV04): TradingReplayIntroV04 => { const fixture = fixtures[caseId]; return { ...fixture.intro, candles: fixture.candles.slice(0, fixture.initialCount) }; };
export const advanceTradingReplayV04 = (caseId: TradingReplayCaseIdV04, replayId: string, fromOpenTime: string): TradingReplayAdvanceV04 | null => {
    const fixture = fixtures[caseId]; if (fixture.intro.replayId !== replayId) return null; const index = fixture.candles.findIndex((candle) => candle.openTime === fromOpenTime); if (index < fixture.initialCount - 1) return null; const next = fixture.candles[index + 1] ?? null; return { candle: next, complete: next === null || index + 1 === fixture.candles.length - 1, debrief: next === null || index + 1 === fixture.candles.length - 1 ? fixture.debrief : null };
};
