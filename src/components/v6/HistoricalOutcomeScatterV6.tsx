import { getCalibrationZoneBounds, type CalibrationObservation } from '@/lib/market-calibration';
import type { ResearchThemeV6 } from './research-v6';

const WIDTH = 520;
const HEIGHT = 224;
const PLOT = { left: 42, right: 12, top: 14, bottom: 32 } as const;

const formatTick = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(0)}%`;

export const HistoricalOutcomeScatterV6 = ({
    observations,
    currentScore,
    similarMedian,
    baselineMedian,
    benchmarkName,
    days,
    theme,
}: {
    readonly observations: readonly CalibrationObservation[];
    readonly currentScore: number;
    readonly similarMedian: number;
    readonly baselineMedian: number;
    readonly benchmarkName: string;
    readonly days: 7 | 30;
    readonly theme: ResearchThemeV6;
}) => {
    const zone = getCalibrationZoneBounds(currentScore);
    if (!zone || observations.length === 0) return null;

    const plotWidth = WIDTH - PLOT.left - PLOT.right;
    const plotHeight = HEIGHT - PLOT.top - PLOT.bottom;
    const maxAbsReturn = Math.max(1, ...observations.map((item) => Math.abs(item.forward_return_pct)), Math.abs(similarMedian), Math.abs(baselineMedian));
    const yLimit = Math.ceil(maxAbsReturn);
    const x = (score: number) => PLOT.left + (score / 100) * plotWidth;
    const y = (value: number) => PLOT.top + ((yLimit - value) / (yLimit * 2)) * plotHeight;
    const palette = theme === 'light' ? {
        primary: '#0f172a', muted: '#64748b', grid: '#cbd5e1', zone: '#d1fae5',
        observed: '#64748b', reconstructed: '#ffffff', positive: '#059669', baseline: '#d97706',
    } : {
        primary: '#eef2f7', muted: '#9aa8b8', grid: '#334155', zone: '#064e3b',
        observed: '#94a3b8', reconstructed: '#0f1720', positive: '#34d399', baseline: '#fbbf24',
    };
    const xTicks = [0, 20, 40, 60, 80, 100];
    const yTicks = [-yLimit, 0, yLimit];
    const horizon = days === 7 ? 'one-week' : 'one-month';

    return <figure className="mt-4" data-testid={`historical-outcome-plot-${days}`}>
        <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: palette.muted }}>
            <span>Signal score to {horizon} return</span>
            <span>{benchmarkName}</span>
        </figcaption>
        <svg
            className="mt-2 block h-auto w-full"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label={`${benchmarkName} ${horizon} forward returns plotted against historical Signal scores. The current ${zone.label} score zone is highlighted.`}
        >
            <desc>Each point is one eligible historical score snapshot. Solid points are observed scores and hollow points are reconstructed scores.</desc>
            <rect x={x(zone.min)} y={PLOT.top} width={x(zone.max + 1) - x(zone.min)} height={plotHeight} fill={palette.zone} opacity="0.55" />
            {yTicks.map((tick) => <g key={tick}>
                <line x1={PLOT.left} x2={WIDTH - PLOT.right} y1={y(tick)} y2={y(tick)} stroke={palette.grid} strokeWidth={tick === 0 ? 1.25 : 0.75} />
                <text x={PLOT.left - 7} y={y(tick) + 3} textAnchor="end" fontSize="9" fill={palette.muted}>{formatTick(tick)}</text>
            </g>)}
            {xTicks.map((tick) => <g key={tick}>
                <line x1={x(tick)} x2={x(tick)} y1={PLOT.top} y2={HEIGHT - PLOT.bottom} stroke={palette.grid} strokeWidth="0.5" opacity="0.7" />
                <text x={x(tick)} y={HEIGHT - 15} textAnchor="middle" fontSize="9" fill={palette.muted}>{tick}</text>
            </g>)}
            <line x1={PLOT.left} x2={WIDTH - PLOT.right} y1={y(baselineMedian)} y2={y(baselineMedian)} stroke={palette.baseline} strokeWidth="1.5" strokeDasharray="5 4" />
            <line x1={x(zone.min)} x2={x(zone.max + 1)} y1={y(similarMedian)} y2={y(similarMedian)} stroke={palette.positive} strokeWidth="2" />
            {observations.map((observation, index) => {
                const inCurrentZone = observation.score >= zone.min && observation.score <= zone.max;
                const pointColor = inCurrentZone ? palette.positive : palette.observed;
                const reconstructed = observation.origin === 'reconstructed';
                return <circle
                    key={`${observation.date}-${observation.score}-${index}`}
                    cx={x(observation.score)}
                    cy={y(observation.forward_return_pct)}
                    r={inCurrentZone ? 4 : 3.25}
                    fill={reconstructed ? palette.reconstructed : pointColor}
                    stroke={pointColor}
                    strokeWidth={reconstructed ? 1.75 : 0.75}
                    opacity={inCurrentZone ? 0.95 : 0.78}
                    data-origin={observation.origin}
                    data-current-zone={inCurrentZone ? 'true' : 'false'}
                >
                    <title>{observation.date}: score {observation.score}, {formatTick(observation.forward_return_pct)} {horizon} return ({observation.origin})</title>
                </circle>;
            })}
            <text x={PLOT.left + plotWidth / 2} y={HEIGHT - 2} textAnchor="middle" fontSize="10" fontWeight="600" fill={palette.muted}>Signal score</text>
        </svg>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px]" style={{ color: palette.muted }} aria-hidden="true">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: palette.observed }} />Observed</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border-2 bg-transparent" style={{ borderColor: palette.observed }} />Reconstructed</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ backgroundColor: palette.positive }} />Similar-score median</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t border-dashed" style={{ borderColor: palette.baseline }} />All-score median</span>
        </div>
    </figure>;
};
