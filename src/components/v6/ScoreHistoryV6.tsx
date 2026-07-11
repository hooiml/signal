import type { MarketSignal } from '@/lib/types/signal-v2';
import type { ResearchThemeV6 } from './research-v6';
import { formatCompactDateV6 } from './market-v6';

type ScoreHistoryV6Props = {
    signal: MarketSignal;
    theme: ResearchThemeV6;
};

export const ScoreHistoryV6 = ({ signal, theme }: ScoreHistoryV6Props) => {
    const history = signal.metadata.score_history ?? [];
    const points = history.length > 0
        ? history
        : [{ date: signal.metadata.score_delta?.snapshot_date ?? new Date().toISOString(), score: signal.composite_score, tier: signal.tier }];
    const bands = getScoreBandsV6(signal.mode);

    return (
        <section aria-labelledby="score-history-title" className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <p className={'text-xs font-semibold ' + (theme === 'light' ? 'text-slate-500' : 'text-[#9aa8b8]')}>Historical context</p>
                    <h2 id="score-history-title" className={'mt-0.5 text-lg font-bold ' + (theme === 'light' ? 'text-slate-950' : 'text-[#eef2f7]')}>Score history</h2>
                </div>
                <p className={'text-xs ' + (theme === 'light' ? 'text-slate-500' : 'text-[#9aa8b8]')}>{points.length} snapshots - current {Math.round(signal.composite_score)}</p>
            </div>
            <div className="mt-3 overflow-hidden rounded-md">
                <HistoryChartV6 points={points} currentScore={signal.composite_score} theme={theme} width={340} height={210} compact />
                <HistoryChartV6 points={points} currentScore={signal.composite_score} theme={theme} width={760} height={260} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4" aria-label={signal.mode === 'contrarian' ? 'Contrarian score zones' : 'Momentum score zones'}>
                {bands.map((band) => (
                    <div key={band.range} className={'flex items-center gap-2 text-[11px] ' + (theme === 'light' ? 'text-slate-600' : 'text-[#9aa8b8]')}>
                        <span className={'h-2 w-2 shrink-0 rounded-full ' + band.tone} />
                        <span><strong className="font-semibold">{band.range}</strong> {band.label}</span>
                    </div>
                ))}
            </div>
        </section>
    );
};

type HistoryPointV6 = NonNullable<MarketSignal['metadata']['score_history']>[number];

type HistoryChartV6Props = {
    points: HistoryPointV6[];
    currentScore: number;
    theme: ResearchThemeV6;
    width: number;
    height: number;
    compact?: boolean;
};

const HistoryChartV6 = ({ points, currentScore, theme, width, height, compact = false }: HistoryChartV6Props) => {
    const left = compact ? 32 : 42;
    const right = compact ? 12 : 18;
    const top = 14;
    const bottom = compact ? 30 : 38;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const coordinates = points.map((point, index) => ({
        x: left + (points.length === 1 ? plotWidth : (index / (points.length - 1)) * plotWidth),
        y: top + ((100 - point.score) / 100) * plotHeight,
        ...point,
    }));
    const linePoints = coordinates.map((point) => point.x + ',' + point.y).join(' ');
    const areaPoints = left + ',' + (top + plotHeight) + ' ' + linePoints + ' ' + (left + plotWidth) + ',' + (top + plotHeight);
    const stroke = theme === 'light' ? '#047857' : '#6ee7b7';
    const grid = theme === 'light' ? '#cbd5e1' : '#334155';
    const text = theme === 'light' ? '#475569' : '#9aa8b8';
    const fill = theme === 'light' ? 'rgba(16,185,129,0.10)' : 'rgba(52,211,153,0.08)';
    const last = coordinates.at(-1);
    const ticks = compact ? [0, 50, 100] : [0, 25, 50, 75, 100];

    return (
        <svg
            viewBox={'0 0 ' + width + ' ' + height}
            role="img"
            aria-label={'Score history from ' + formatCompactDateV6(points[0].date) + ' to ' + formatCompactDateV6(points.at(-1)?.date) + ', ending at ' + Math.round(currentScore) + '.'}
            className={(compact ? 'block sm:hidden' : 'hidden sm:block') + ' h-auto w-full'}
        >
            {ticks.map((value) => {
                const y = top + ((100 - value) / 100) * plotHeight;
                return (
                    <g key={value}>
                        <line x1={left} x2={left + plotWidth} y1={y} y2={y} stroke={grid} strokeWidth="1" opacity="0.65" />
                        <text x={left - 8} y={y + 4} textAnchor="end" fill={text} fontSize={compact ? '9' : '11'}>{value}</text>
                    </g>
                );
            })}
            {[40, 65, 85].map((value) => {
                const y = top + ((100 - value) / 100) * plotHeight;
                return <line key={value} x1={left} x2={left + plotWidth} y1={y} y2={y} stroke={grid} strokeDasharray="4 5" opacity="0.55" />;
            })}
            <polygon points={areaPoints} fill={fill} />
            <polyline points={linePoints} fill="none" stroke={stroke} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            {coordinates.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r={compact ? '2.5' : '3'} fill={stroke} />)}
            {last ? <circle cx={last.x} cy={last.y} r={compact ? '4' : '5'} fill={stroke} /> : null}
            {last ? <text x={Math.min(last.x + 10, width - 28)} y={last.y + 4} fill={stroke} fontWeight="700" fontSize={compact ? '11' : '14'}>{Math.round(last.score)}</text> : null}
            <text x={left} y={height - 8} fill={text} fontSize={compact ? '9' : '11'}>{formatCompactDateV6(points[0].date)}</text>
            <text x={left + plotWidth} y={height - 8} textAnchor="end" fill={text} fontSize={compact ? '9' : '11'}>{formatCompactDateV6(points.at(-1)?.date)}</text>
        </svg>
    );
};

const getScoreBandsV6 = (mode: MarketSignal['mode']) => mode === 'contrarian' ? [
    { range: '0-39', label: 'Low risk', tone: 'bg-emerald-500' },
    { range: '40-64', label: 'Elevated', tone: 'bg-sky-500' },
    { range: '65-84', label: 'Cautionary', tone: 'bg-amber-500' },
    { range: '85+', label: 'Extreme risk', tone: 'bg-rose-500' },
] : [
    { range: '0-39', label: 'Negative', tone: 'bg-rose-500' },
    { range: '40-64', label: 'Mixed', tone: 'bg-sky-500' },
    { range: '65-84', label: 'Positive', tone: 'bg-emerald-400' },
    { range: '85+', label: 'Strong positive', tone: 'bg-emerald-600' },
];
