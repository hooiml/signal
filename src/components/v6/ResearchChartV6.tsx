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
import { buildTechnicalOutlook, type TechnicalTone } from '@/lib/research/technical-outlook';
import type { ResearchChartPoint, ResearchSnapshot } from '@/lib/types/research-snapshot';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type Range = '1M' | '3M' | '6M' | '1Y' | '5Y';
type MomentumIndicator = 'RSI' | 'MACD';
const ranges: ReadonlyArray<{ readonly id: Range; readonly sessions: number }> = [
    { id: '1M', sessions: 22 },
    { id: '3M', sessions: 66 },
    { id: '6M', sessions: 132 },
    { id: '1Y', sessions: 252 },
    { id: '5Y', sessions: 1_260 },
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

const normalizedBenchmarkSeries = (
    points: readonly ResearchChartPoint[],
    benchmark: ResearchSnapshot['chart'] | null,
) => {
    if (!benchmark || points.length === 0) return [];
    const benchmarkByTime = new Map(benchmark.points.map((point) => [point.time, point.close]));
    const shared = points.flatMap((point) => {
        const benchmarkClose = benchmarkByTime.get(point.time);
        return benchmarkClose === undefined ? [] : [{ time: point.time, candidateClose: point.close, benchmarkClose }];
    });
    const first = shared[0];
    if (!first || first.benchmarkClose === 0) return [];
    return shared.map((point) => ({
        time: time(point.time),
        value: first.candidateClose * (point.benchmarkClose / first.benchmarkClose),
    }));
};

const atrContext = (point: ResearchChartPoint | undefined) => {
    if (point?.atrPercent14 === null || point?.atrPercent14 === undefined) {
        return { label: 'ATR unavailable', detail: 'Not enough daily ranges for ATR%.', tone: 'unavailable' as const };
    }
    const label = point.atrPercent14 >= 4 ? 'Higher volatility' : point.atrPercent14 >= 2 ? 'Moderate volatility' : 'Lower volatility';
    return { label, detail: `ATR% (14) is ${point.atrPercent14.toFixed(2)}% of the current price.`, tone: 'neutral' as const };
};

export const ResearchChartV6 = ({ snapshot, chart, historyState, benchmarkChart, benchmarkState, compareBenchmark, onToggleBenchmark, onRetryBenchmark, onRetryHistory, theme }: {
    readonly snapshot: ResearchSnapshot;
    readonly chart: ResearchSnapshot['chart'];
    readonly historyState: 'loading' | 'ready' | 'error';
    readonly benchmarkChart: ResearchSnapshot['chart'] | null;
    readonly benchmarkState: 'idle' | 'loading' | 'ready' | 'error';
    readonly compareBenchmark: boolean;
    readonly onToggleBenchmark: () => void;
    readonly onRetryBenchmark: () => void;
    readonly onRetryHistory: () => void;
    readonly theme: ResearchThemeV6;
}) => {
    const [range, setRange] = useState<Range>('6M');
    const [indicator, setIndicator] = useState<MomentumIndicator>('RSI');
    const containerRef = useRef<HTMLDivElement>(null);
    const styles = getThemeV6(theme);
    const points = useMemo(() => visiblePoints(chart.points, range), [chart.points, range]);
    const benchmarkSeries = useMemo(() => normalizedBenchmarkSeries(points, compareBenchmark ? benchmarkChart : null), [benchmarkChart, compareBenchmark, points]);
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
        const ma50 = chart.addSeries(LineSeries, { color: '#38bdf8', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
        ma50.setData(points.flatMap((point) => point.ma50 === null ? [] : [{ time: time(point.time), value: point.ma50 }]));
        const ma200 = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
        ma200.setData(points.flatMap((point) => point.ma200 === null ? [] : [{ time: time(point.time), value: point.ma200 }]));
        if (benchmarkSeries.length > 0) {
            const benchmark = chart.addSeries(LineSeries, { color: '#a78bfa', lineWidth: 2, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false });
            benchmark.setData(benchmarkSeries);
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
        } else {
            const histogram = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, 1);
            histogram.setData(points.flatMap((point) => point.macdHistogram === null ? [] : [{
                time: time(point.time), value: point.macdHistogram, color: point.macdHistogram >= 0 ? '#10b98188' : '#f43f5e88',
            }]));
            const macd = chart.addSeries(LineSeries, { color: '#22d3ee', lineWidth: 2, priceLineVisible: false, lastValueVisible: false }, 1);
            macd.setData(points.flatMap((point) => point.macd === null ? [] : [{ time: time(point.time), value: point.macd }]));
            const signal = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2, priceLineVisible: false, lastValueVisible: false }, 1);
            signal.setData(points.flatMap((point) => point.macdSignal === null ? [] : [{ time: time(point.time), value: point.macdSignal }]));
            histogram.createPriceLine({ price: 0, color: dark ? '#64748b' : '#94a3b8', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false });
        }
        chart.priceScale('right', 1).applyOptions({ borderColor: dark ? '#344454' : '#cbd5e1' });
        const panes = chart.panes();
        panes[0]?.setStretchFactor(3);
        panes[1]?.setStretchFactor(1);
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
    }, [benchmarkSeries, indicator, points, snapshot.technicals.resistance, snapshot.technicals.support, theme]);

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
                <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Daily candles · MA50 · MA200 · volume · support and resistance</p>
            </div>
            <div className="flex flex-wrap gap-2 min-[700px]:justify-end">
                <div role="group" aria-label="Chart range" className={'flex w-fit rounded border p-1 ' + styles.row}>
                    {ranges.map((candidate) => {
                        const disabled = candidate.id === '5Y' && historyState !== 'ready';
                        return <button key={candidate.id} type="button" disabled={disabled} aria-pressed={range === candidate.id} onClick={() => setRange(candidate.id)} className={'min-h-10 rounded px-3 text-xs font-bold disabled:cursor-wait disabled:opacity-45 ' + (range === candidate.id ? styles.selectedRow : styles.textMuted)}>{candidate.id}</button>;
                    })}
                </div>
                <div role="group" aria-label="Momentum indicator" className={'flex w-fit rounded border p-1 ' + styles.row}>
                    {(['RSI', 'MACD'] as const).map((candidate) => <button key={candidate} type="button" aria-pressed={indicator === candidate} onClick={() => setIndicator(candidate)} className={'min-h-10 rounded px-3 text-xs font-bold ' + (indicator === candidate ? styles.selectedRow : styles.textMuted)}>{candidate}</button>)}
                </div>
                {snapshot.market === 'US' && snapshot.symbol !== 'VOO' ? <button type="button" aria-pressed={compareBenchmark} onClick={onToggleBenchmark} className={'min-h-12 rounded border px-3 text-xs font-bold ' + (compareBenchmark ? styles.selectedRow : styles.row) + ' ' + styles.textSecondary}>{benchmarkState === 'loading' && compareBenchmark ? 'Loading VOO...' : 'Compare VOO'}</button> : null}
            </div>
        </div>
        {historyState === 'loading' ? <p role="status" className={'mt-2 text-xs ' + styles.textMuted}>Loading five-year daily history...</p>
            : historyState === 'error' ? <div role="alert" className={'mt-2 flex flex-wrap items-center gap-2 text-xs ' + styles.risk}><span>Five-year history is unavailable. Shorter ranges remain usable.</span><button type="button" onClick={onRetryHistory} className="min-h-10 rounded border border-current px-3 font-semibold">Retry</button></div>
                : null}
        {compareBenchmark && benchmarkState === 'error' ? <div role="alert" className={'mt-2 flex flex-wrap items-center gap-2 text-xs ' + styles.risk}><span>VOO comparison is unavailable. The price chart remains usable.</span><button type="button" onClick={onRetryBenchmark} className="min-h-10 rounded border border-current px-3 font-semibold">Retry VOO</button></div> : null}
        <div className={'mt-3 overflow-hidden rounded-lg border p-2 ' + styles.row}>
            <div ref={containerRef} role="img" aria-label={`${snapshot.symbol} daily candlestick chart for ${range} with moving averages, volume, ${indicator}${compareBenchmark && benchmarkChart ? ', and normalized VOO comparison' : ''}`} className="h-[560px] w-full" />
            <div className={'mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] ' + styles.textMuted}>
                <span><span className="mr-1 inline-block h-0.5 w-4 align-middle bg-sky-400" />MA50</span>
                <span><span className="mr-1 inline-block h-0.5 w-4 align-middle bg-amber-500" />MA200</span>
                <span><span className="mr-1 inline-block h-0.5 w-4 align-middle bg-purple-400" />20d average volume</span>
                {compareBenchmark && benchmarkChart ? <span><span className="mr-1 inline-block h-0.5 w-4 border-t-2 border-dotted border-violet-400 align-middle" />VOO normalized at range start</span> : null}
                <span>{indicator === 'RSI' ? 'RSI pane: 30 oversold · 70 overbought' : 'MACD pane: MACD · signal · histogram'}</span>
                <span>Dashed green: support{snapshot.technicals.support === null ? '' : ` ${snapshot.technicals.support.toFixed(2)}`}</span>
                <span>Dashed red: resistance{snapshot.technicals.resistance === null ? '' : ` ${snapshot.technicals.resistance.toFixed(2)}`}</span>
            </div>
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
