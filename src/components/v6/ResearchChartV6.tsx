'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
    CandlestickSeries,
    ColorType,
    createChart,
    HistogramSeries,
    LineSeries,
    LineStyle,
    type Time,
} from 'lightweight-charts';
import { anchoredVwap, relativeStrengthSeries, volumeProfile, type VwapAnchor } from '@/lib/research/chart-analysis';
import { buildTechnicalOutlook, type TechnicalTone } from '@/lib/research/technical-outlook';
import type { ResearchChartPoint, ResearchSnapshot } from '@/lib/types/research-snapshot';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type Range = '1M' | '3M' | '6M' | '1Y' | '5Y';
type MomentumIndicator = 'RSI' | 'MACD' | 'ADX';
type ChartSetup = 'clean' | 'trend' | 'levels';
type GuideItem = { readonly term: string; readonly meaning: string; readonly use: string };
const ranges: ReadonlyArray<{ readonly id: Range; readonly sessions: number }> = [
    { id: '1M', sessions: 22 },
    { id: '3M', sessions: 66 },
    { id: '6M', sessions: 132 },
    { id: '1Y', sessions: 252 },
    { id: '5Y', sessions: 1_260 },
];

const indicatorGuide: ReadonlyArray<{ readonly setup: string; readonly items: readonly GuideItem[] }> = [
    {
        setup: 'Clean setup',
        items: [
            { term: 'EMA20', meaning: 'A fast 20-day average that gives more weight to recent prices.', use: 'Short-term momentum and pullbacks.' },
            { term: 'EMA50', meaning: 'A smoother 50-day average that still reacts to recent prices.', use: 'Medium-term trend direction.' },
            { term: 'SMA200', meaning: 'An equal-weight average of the last 200 daily closes.', use: 'The major long-term trend benchmark.' },
            { term: 'Volume', meaning: 'How much of the asset traded during each day.', use: 'Checks whether a price move has meaningful participation.' },
            { term: 'RSI', meaning: 'Momentum on a 0–100 scale; 70 is extended and 30 is oversold.', use: 'Momentum context, not an automatic buy or sell signal.' },
            { term: 'ATR', meaning: 'Average daily price movement over 14 sessions.', use: 'Volatility and risk-distance context; it does not show direction.' },
        ],
    },
    {
        setup: 'Trend setup',
        items: [
            { term: 'ADX', meaning: 'Trend strength without saying whether the trend is up or down.', use: 'Above roughly 25 suggests a more meaningful trend.' },
            { term: '+DI / −DI', meaning: 'Compares upward and downward directional pressure.', use: '+DI above −DI favors upward pressure; the reverse favors downward pressure.' },
            { term: 'Supertrend', meaning: 'An ATR-based line that changes side when the trend state flips.', use: 'Green marks an upward state and red a downward state; sideways markets can whipsaw.' },
        ],
    },
    {
        setup: 'Levels and comparison',
        items: [
            { term: 'Anchored VWAP', meaning: 'The volume-weighted average price from a selected starting point.', use: 'Shows the market’s average cost since the range or swing anchor.' },
            { term: 'Volume Profile / POC', meaning: 'An estimate of volume traded at different price areas; POC has the most.', use: 'Highlights price acceptance and possible support or resistance.' },
            { term: 'Relative strength', meaning: 'Performance versus VOO or FBM KLCI, rebased to 100.', use: 'Rising means the asset is outperforming its benchmark.' },
            { term: 'MACD', meaning: 'The difference between faster and slower exponential averages.', use: 'Optional momentum confirmation; avoid stacking it blindly with RSI.' },
        ],
    },
];

const toneClass = (tone: TechnicalTone, theme: ResearchThemeV6) => {
    const styles = getThemeV6(theme);
    if (tone === 'positive') return styles.positive;
    if (tone === 'negative') return styles.risk;
    return styles.textSecondary;
};

const time = (value: string) => value as Time;

const visiblePoints = (points: readonly ResearchChartPoint[], range: Range) => {
    const sessions = ranges.find((candidate) => candidate.id === range)?.sessions ?? 252;
    return points.slice(-sessions);
};

const atrContext = (point: ResearchChartPoint | undefined) => {
    if (point?.atrPercent14 === null || point?.atrPercent14 === undefined) {
        return { label: 'ATR unavailable', detail: 'Not enough daily ranges for ATR%.', tone: 'unavailable' as const };
    }
    const label = point.atrPercent14 >= 4 ? 'Higher volatility' : point.atrPercent14 >= 2 ? 'Moderate volatility' : 'Lower volatility';
    const stop = point.atr14 === null ? '' : ` A 1.5× ATR volatility reference is ${(point.atr14 * 1.5).toFixed(2)} price units.`;
    return { label, detail: `ATR% (14) is ${point.atrPercent14.toFixed(2)}% of the current price.${stop}`, tone: 'neutral' as const };
};

export const ResearchChartV6 = ({ snapshot, chart, historyState, benchmarkChart, benchmarkLabel, benchmarkState, compareBenchmark, onToggleBenchmark, onRetryBenchmark, onRetryHistory, theme }: {
    readonly snapshot: ResearchSnapshot;
    readonly chart: ResearchSnapshot['chart'];
    readonly historyState: 'loading' | 'ready' | 'error';
    readonly benchmarkChart: ResearchSnapshot['chart'] | null;
    readonly benchmarkLabel: string;
    readonly benchmarkState: 'idle' | 'loading' | 'ready' | 'error';
    readonly compareBenchmark: boolean;
    readonly onToggleBenchmark: () => void;
    readonly onRetryBenchmark: () => void;
    readonly onRetryHistory: () => void;
    readonly theme: ResearchThemeV6;
}) => {
    const [range, setRange] = useState<Range>('6M');
    const [indicator, setIndicator] = useState<MomentumIndicator>('RSI');
    const [setup, setSetup] = useState<ChartSetup>('clean');
    const [vwapAnchor, setVwapAnchor] = useState<VwapAnchor>('range-start');
    const containerRef = useRef<HTMLDivElement>(null);
    const styles = getThemeV6(theme);
    const points = useMemo(() => visiblePoints(chart.points, range), [chart.points, range]);
    const benchmarkSeries = useMemo(() => compareBenchmark && benchmarkChart
        ? relativeStrengthSeries(points, benchmarkChart.points)
        : [], [benchmarkChart, compareBenchmark, points]);
    const vwapSeries = useMemo(() => setup === 'levels' ? anchoredVwap(points, vwapAnchor) : [], [points, setup, vwapAnchor]);
    const profile = useMemo(() => setup === 'levels' ? volumeProfile(points) : [], [points, setup]);
    const outlook = useMemo(() => buildTechnicalOutlook(snapshot), [snapshot]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || points.length === 0) return;
        const dark = theme === 'dark';
        const chart = createChart(container, {
            autoSize: true,
            height: 560,
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: dark ? '#9aa8b8' : '#64748b',
                attributionLogo: true,
            },
            grid: {
                vertLines: { color: dark ? '#1f2b36' : '#e8edf2' },
                horzLines: { color: dark ? '#1f2b36' : '#e8edf2' },
            },
            rightPriceScale: { borderColor: dark ? '#344454' : '#cbd5e1', scaleMargins: { top: 0.08, bottom: 0.25 } },
            timeScale: { borderColor: dark ? '#344454' : '#cbd5e1', timeVisible: false, minBarSpacing: 0.1 },
            crosshair: { vertLine: { labelBackgroundColor: '#059669' }, horzLine: { labelBackgroundColor: '#059669' } },
        });
        const candles = chart.addSeries(CandlestickSeries, {
            upColor: '#10b981', downColor: '#f43f5e', borderVisible: false,
            wickUpColor: '#10b981', wickDownColor: '#f43f5e',
        });
        candles.setData(points.map((point) => ({
            time: time(point.time), open: point.open, high: point.high, low: point.low, close: point.close,
        })));
        if (setup === 'clean') {
            const ema20 = chart.addSeries(LineSeries, { color: '#22d3ee', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
            ema20.setData(points.flatMap((point) => point.ema20 === null ? [] : [{ time: time(point.time), value: point.ema20 }]));
        }
        if (setup !== 'levels') {
            const ema50 = chart.addSeries(LineSeries, { color: '#38bdf8', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
            ema50.setData(points.flatMap((point) => point.ema50 === null ? [] : [{ time: time(point.time), value: point.ema50 }]));
            const sma200 = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
            sma200.setData(points.flatMap((point) => point.sma200 === null ? [] : [{ time: time(point.time), value: point.sma200 }]));
        }
        if (setup === 'trend') {
            const bullish = chart.addSeries(LineSeries, { color: '#10b981', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
            bullish.setData(points.map((point) => point.supertrend === null || point.supertrendDirection !== 1
                ? { time: time(point.time) }
                : { time: time(point.time), value: point.supertrend }));
            const bearish = chart.addSeries(LineSeries, { color: '#f43f5e', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
            bearish.setData(points.map((point) => point.supertrend === null || point.supertrendDirection !== -1
                ? { time: time(point.time) }
                : { time: time(point.time), value: point.supertrend }));
        }
        if (setup === 'levels' && vwapSeries.length > 0) {
            const vwap = chart.addSeries(LineSeries, { color: '#a78bfa', lineWidth: 2, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: true });
            vwap.setData(vwapSeries.map((point) => ({ time: time(point.time), value: point.value })));
        }
        const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: '', lastValueVisible: false, priceLineVisible: false });
        volume.setData(points.flatMap((point) => point.volume === null ? [] : [{
            time: time(point.time), value: point.volume,
            color: point.averageVolume20 !== null && point.volume >= point.averageVolume20 * 1.5
                ? point.close >= point.open ? '#34d399' : '#fb7185'
                : point.close >= point.open ? '#10b98166' : '#f43f5e66',
        }]));
        const averageVolume = chart.addSeries(LineSeries, { color: '#c084fc', lineWidth: 1, priceScaleId: '', priceLineVisible: false, lastValueVisible: false });
        averageVolume.setData(points.flatMap((point) => point.averageVolume20 === null ? [] : [{ time: time(point.time), value: point.averageVolume20 }]));
        chart.priceScale('').applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
        if (indicator === 'RSI') {
            const rsi = chart.addSeries(LineSeries, { color: '#22d3ee', lineWidth: 2, priceLineVisible: false, lastValueVisible: true }, 1);
            rsi.setData(points.flatMap((point) => point.rsi14 === null ? [] : [{ time: time(point.time), value: point.rsi14 }]));
            rsi.createPriceLine({ price: 70, color: '#fb7185', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '70' });
            rsi.createPriceLine({ price: 50, color: dark ? '#64748b' : '#94a3b8', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false });
            rsi.createPriceLine({ price: 30, color: '#34d399', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '30' });
        } else if (indicator === 'MACD') {
            const histogram = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, 1);
            histogram.setData(points.flatMap((point) => point.macdHistogram === null ? [] : [{
                time: time(point.time), value: point.macdHistogram, color: point.macdHistogram >= 0 ? '#10b98188' : '#f43f5e88',
            }]));
            const macd = chart.addSeries(LineSeries, { color: '#22d3ee', lineWidth: 2, priceLineVisible: false, lastValueVisible: false }, 1);
            macd.setData(points.flatMap((point) => point.macd === null ? [] : [{ time: time(point.time), value: point.macd }]));
            const signal = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2, priceLineVisible: false, lastValueVisible: false }, 1);
            signal.setData(points.flatMap((point) => point.macdSignal === null ? [] : [{ time: time(point.time), value: point.macdSignal }]));
            histogram.createPriceLine({ price: 0, color: dark ? '#64748b' : '#94a3b8', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false });
        } else {
            const adx = chart.addSeries(LineSeries, { color: '#f8fafc', lineWidth: 2, priceLineVisible: false, lastValueVisible: true }, 1);
            adx.setData(points.flatMap((point) => point.adx14 === null ? [] : [{ time: time(point.time), value: point.adx14 }]));
            const plusDi = chart.addSeries(LineSeries, { color: '#10b981', lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, 1);
            plusDi.setData(points.flatMap((point) => point.plusDi14 === null ? [] : [{ time: time(point.time), value: point.plusDi14 }]));
            const minusDi = chart.addSeries(LineSeries, { color: '#f43f5e', lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, 1);
            minusDi.setData(points.flatMap((point) => point.minusDi14 === null ? [] : [{ time: time(point.time), value: point.minusDi14 }]));
            adx.createPriceLine({ price: 25, color: '#f59e0b', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '25' });
        }
        chart.priceScale('right', 1).applyOptions({ borderColor: dark ? '#344454' : '#cbd5e1' });
        const panes = chart.panes();
        panes[0]?.setStretchFactor(3);
        panes[1]?.setStretchFactor(1);
        if (benchmarkSeries.length > 0) {
            const relativeStrength = chart.addSeries(LineSeries, { color: '#a78bfa', lineWidth: 2, priceLineVisible: false, lastValueVisible: true }, 2);
            relativeStrength.setData(benchmarkSeries.map((point) => ({ time: time(point.time), value: point.value })));
            relativeStrength.createPriceLine({ price: 100, color: dark ? '#64748b' : '#94a3b8', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false });
            chart.priceScale('right', 2).applyOptions({ borderColor: dark ? '#344454' : '#cbd5e1' });
            chart.panes()[2]?.setStretchFactor(1);
        }
        const latest = points.at(-1);
        if (latest?.atr14 !== null && latest?.atr14 !== undefined) {
            candles.createPriceLine({
                price: latest.close - latest.atr14 * 1.5, color: '#fb7185', lineWidth: 1,
                lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: '1.5× ATR below',
            });
            candles.createPriceLine({
                price: latest.close + latest.atr14 * 1.5, color: '#34d399', lineWidth: 1,
                lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: '1.5× ATR above',
            });
        }
        if (snapshot.technicals.support !== null) candles.createPriceLine({
            price: snapshot.technicals.support, color: '#10b981', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false,
        });
        if (snapshot.technicals.resistance !== null) candles.createPriceLine({
            price: snapshot.technicals.resistance, color: '#f43f5e', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false,
        });
        let settleFrame = 0;
        const fitFrame = window.requestAnimationFrame(() => {
            settleFrame = window.requestAnimationFrame(() => chart.timeScale().fitContent());
        });
        return () => {
            window.cancelAnimationFrame(fitFrame);
            window.cancelAnimationFrame(settleFrame);
            chart.remove();
        };
    }, [benchmarkSeries, indicator, points, setup, snapshot.technicals.resistance, snapshot.technicals.support, theme, vwapSeries]);

    if (chart.points.length === 0) return (
        <div role="status" className={'rounded-lg border p-5 text-sm ' + styles.row + ' ' + styles.textMuted}>
            Historical chart data is unavailable for this ticker. The saved research and technical summary remain usable.
        </div>
    );

    const contexts = [outlook.trend, outlook.momentum, outlook.volume, atrContext(chart.points.at(-1))];
    return <section aria-labelledby="research-chart-heading">
        <div className="flex flex-col gap-3 min-[700px]:flex-row min-[700px]:items-end min-[700px]:justify-between">
            <div>
                <div className="flex flex-wrap items-center gap-2">
                    <h3 id="research-chart-heading" className={'text-base font-bold ' + styles.textPrimary}>Price and technical context</h3>
                    <span className={'rounded-full border px-2 py-1 text-xs font-bold ' + styles.row + ' ' + toneClass(outlook.overall.tone, theme)}>{outlook.overall.label}</span>
                </div>
                <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Daily candles · EMA20 · EMA50 · SMA200 · volume · volatility-aware levels</p>
            </div>
            <div className="flex flex-wrap gap-2 min-[700px]:justify-end">
                <div role="group" aria-label="Chart setup" className={'flex w-fit rounded border p-1 ' + styles.row}>
                    {(['clean', 'trend', 'levels'] as const).map((candidate) => <button
                        key={candidate}
                        type="button"
                        data-chart-setup={candidate}
                        aria-pressed={setup === candidate}
                        onClick={() => {
                            setSetup(candidate);
                            setIndicator(candidate === 'trend' ? 'ADX' : 'RSI');
                        }}
                        className={'min-h-10 rounded px-3 text-xs font-bold capitalize ' + (setup === candidate ? styles.selectedRow : styles.textMuted)}
                    >{candidate}</button>)}
                </div>
                <div role="group" aria-label="Chart range" className={'flex w-fit rounded border p-1 ' + styles.row}>
                    {ranges.map((candidate) => {
                        const disabled = candidate.id === '5Y' && historyState !== 'ready';
                        return <button key={candidate.id} type="button" disabled={disabled} aria-pressed={range === candidate.id} onClick={() => setRange(candidate.id)} className={'min-h-10 rounded px-3 text-xs font-bold disabled:cursor-wait disabled:opacity-45 ' + (range === candidate.id ? styles.selectedRow : styles.textMuted)}>{candidate.id}</button>;
                    })}
                </div>
                <div role="group" aria-label="Momentum indicator" className={'flex w-fit rounded border p-1 ' + styles.row}>
                    {(['RSI', 'MACD', 'ADX'] as const).map((candidate) => <button key={candidate} type="button" aria-pressed={indicator === candidate} onClick={() => setIndicator(candidate)} className={'min-h-10 rounded px-3 text-xs font-bold ' + (indicator === candidate ? styles.selectedRow : styles.textMuted)}>{candidate}</button>)}
                </div>
                {snapshot.symbol !== (snapshot.market === 'US' ? 'VOO' : 'KLCI') ? <button type="button" aria-pressed={compareBenchmark} onClick={onToggleBenchmark} className={'min-h-12 rounded border px-3 text-xs font-bold ' + (compareBenchmark ? styles.selectedRow : styles.row) + ' ' + styles.textSecondary}>{benchmarkState === 'loading' && compareBenchmark ? `Loading ${benchmarkLabel}...` : `Relative strength vs ${benchmarkLabel}`}</button> : null}
            </div>
        </div>
        {setup === 'levels' ? <div className={'mt-2 flex flex-wrap items-center gap-2 text-xs ' + styles.textMuted}>
            <span className="font-semibold">Anchored VWAP:</span>
            {([['range-start', 'Range start'], ['swing-low', 'Swing low'], ['swing-high', 'Swing high']] as const).map(([value, label]) => <button
                key={value}
                type="button"
                aria-pressed={vwapAnchor === value}
                onClick={() => setVwapAnchor(value)}
                className={'min-h-10 rounded border px-3 font-semibold ' + (vwapAnchor === value ? styles.selectedRow : styles.row)}
            >{label}</button>)}
        </div> : null}
        {historyState === 'loading' ? <p role="status" className={'mt-2 text-xs ' + styles.textMuted}>Loading five-year daily history...</p>
            : historyState === 'error' ? <div role="alert" className={'mt-2 flex flex-wrap items-center gap-2 text-xs ' + styles.risk}><span>Five-year history is unavailable. Shorter ranges remain usable.</span><button type="button" onClick={onRetryHistory} className="min-h-10 rounded border border-current px-3 font-semibold">Retry</button></div>
                : null}
        {compareBenchmark && benchmarkState === 'error' ? <div role="alert" className={'mt-2 flex flex-wrap items-center gap-2 text-xs ' + styles.risk}><span>{benchmarkLabel} comparison is unavailable. The price chart remains usable.</span><button type="button" onClick={onRetryBenchmark} className="min-h-10 rounded border border-current px-3 font-semibold">Retry comparison</button></div> : null}
        <div className={'mt-3 overflow-hidden rounded-lg border p-2 ' + styles.row}>
            <div className={setup === 'levels' && profile.length > 0 ? 'grid grid-cols-[minmax(0,1fr)_minmax(92px,18%)] gap-2' : ''}>
                <div ref={containerRef} role="img" data-research-chart aria-label={`${snapshot.symbol} daily candlestick chart for ${range} using the ${setup} setup with volume, ${indicator}${compareBenchmark && benchmarkChart ? `, and relative strength versus ${benchmarkLabel}` : ''}`} className="h-[560px] min-w-0 w-full" />
                {setup === 'levels' && profile.length > 0 ? <aside aria-label="Estimated visible-range volume profile" className="flex h-[560px] min-w-0 flex-col border-l pl-2">
                    <p className={'mb-1 text-[10px] font-bold uppercase ' + styles.textMuted}>Volume by price</p>
                    <div className="flex min-h-0 flex-1 flex-col gap-px">
                        {profile.map((bin) => <div key={bin.midpoint} title={`${bin.low.toFixed(2)}–${bin.high.toFixed(2)}`} className="flex min-h-0 flex-1 items-center justify-end">
                            <div className={'h-2 rounded-l ' + (bin.isPointOfControl ? 'bg-amber-500' : 'bg-violet-400/60')} style={{ width: `${Math.max(3, bin.share * 100)}%` }} />
                        </div>)}
                    </div>
                    <p className={'mt-1 text-[9px] leading-3 ' + styles.textMuted}>Daily-bar estimate · amber is POC</p>
                </aside> : null}
            </div>
            <div className={'mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] ' + styles.textMuted}>
                {setup === 'clean' ? <span><span className="mr-1 inline-block h-0.5 w-4 align-middle bg-cyan-400" />EMA20</span> : null}
                {setup !== 'levels' ? <span><span className="mr-1 inline-block h-0.5 w-4 align-middle bg-sky-400" />EMA50</span> : null}
                {setup !== 'levels' ? <span><span className="mr-1 inline-block h-0.5 w-4 align-middle bg-amber-500" />SMA200</span> : null}
                {setup === 'trend' ? <span>Supertrend: green up · red down</span> : null}
                {setup === 'levels' ? <span><span className="mr-1 inline-block h-0.5 w-4 border-t-2 border-dashed border-violet-400 align-middle" />Anchored VWAP · {vwapAnchor.replace('-', ' ')}</span> : null}
                <span><span className="mr-1 inline-block h-0.5 w-4 align-middle bg-purple-400" />20d average volume</span>
                {compareBenchmark && benchmarkChart ? <span><span className="mr-1 inline-block h-0.5 w-4 border-t-2 border-violet-400 align-middle" />Relative-strength pane vs {benchmarkLabel} · 100 at range start</span> : null}
                <span>{indicator === 'RSI' ? 'RSI pane: 30 oversold · 70 overbought' : indicator === 'MACD' ? 'MACD pane: MACD · signal · histogram' : 'ADX/DMI pane: ADX · +DI · −DI · 25 trend threshold'}</span>
                <span>Dotted levels: 1.5× ATR volatility reference</span>
                <span>Dashed green: support{snapshot.technicals.support === null ? '' : ` ${snapshot.technicals.support.toFixed(2)}`}</span>
                <span>Dashed red: resistance{snapshot.technicals.resistance === null ? '' : ` ${snapshot.technicals.resistance.toFixed(2)}`}</span>
            </div>
            <details data-testid="indicator-guide" className={'group mt-3 rounded-md border ' + styles.row}>
                <summary className={'flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ' + styles.textPrimary}>
                    <span><span aria-hidden="true" className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs">i</span>What do these indicators mean?</span>
                    <span aria-hidden="true" className={'text-lg transition-transform group-open:rotate-45 ' + styles.textMuted}>+</span>
                </summary>
                <div className={'border-t px-4 py-4 ' + styles.divider}>
                    <p className={'text-xs leading-5 ' + styles.textMuted}>Use indicators as supporting context. Agreement can strengthen a read, but no indicator predicts the next move by itself.</p>
                    <div className="mt-4 grid gap-5 min-[900px]:grid-cols-3">
                        {indicatorGuide.map((group) => <section key={group.setup} aria-labelledby={`indicator-guide-${group.setup.replaceAll(' ', '-').toLowerCase()}`}>
                            <h4 id={`indicator-guide-${group.setup.replaceAll(' ', '-').toLowerCase()}`} className={'text-xs font-bold uppercase tracking-wide ' + styles.textSecondary}>{group.setup}</h4>
                            <dl className="mt-2 space-y-3">
                                {group.items.map((item) => <div key={item.term} className={'rounded-md border p-3 ' + styles.row}>
                                    <dt className={'text-sm font-bold ' + styles.textPrimary}>{item.term}</dt>
                                    <dd className={'mt-1 text-xs leading-5 ' + styles.textMuted}>{item.meaning} <span className={styles.textSecondary}>{item.use}</span></dd>
                                </div>)}
                            </dl>
                        </section>)}
                    </div>
                </div>
            </details>
        </div>
        <div className="mt-3 grid gap-2 min-[700px]:grid-cols-2 min-[1100px]:grid-cols-4">
            {contexts.map((context) => <article key={context.label} className={'rounded-lg border p-3 ' + styles.row}>
                <p className={'text-sm font-bold ' + toneClass(context.tone, theme)}>{context.label}</p>
                <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>{context.detail}</p>
            </article>)}
        </div>
        <p className={'mt-3 text-xs leading-5 ' + styles.textMuted}>Technical context describes price behavior; it does not override the saved thesis, fundamentals, valuation, or downside checks. Charting by <a className="underline hover:text-emerald-500" href="https://www.tradingview.com/lightweight-charts/" target="_blank" rel="noreferrer">TradingView Lightweight Charts</a>.</p>
    </section>;
};
