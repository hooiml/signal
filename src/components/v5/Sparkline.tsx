'use client';

interface HistoryPoint {
    date: string;
    score: number;
}

interface SparklineProps {
    history?: HistoryPoint[];
    width?: number;
    height?: number;
    tone?: 'light' | 'dark';
}

export const Sparkline = ({ history, width = 140, height = 36, tone = 'light' }: SparklineProps) => {
    if (!history || history.length < 2) return null;

    // Filter points and sort by date ascending
    const points = [...history]
        .filter((p) => typeof p.score === 'number' && !Number.isNaN(p.score))
        .map((p) => ({
            ...p,
            dateParsed: new Date(p.date).getTime(),
        }))
        .sort((a, b) => a.dateParsed - b.dateParsed);

    if (points.length < 2) return null;

    const minScore = 0;
    const maxScore = 100;
    const range = maxScore - minScore;

    // Generate SVG path coordinates
    const coords = points.map((p, index) => {
        const x = (index / (points.length - 1)) * width;
        const normalizedY = (p.score - minScore) / (range || 1);
        const y = height - normalizedY * (height - 4) - 2;
        return { x, y };
    });

    const pathData = coords.reduce((acc, c, i) => {
        return i === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`;
    }, '');

    return (
        <div className="flex items-center gap-2">
            <svg width={width} height={height} className="overflow-visible">
                {/* Flat Stroke Line - Cobalt, no gradient fill */}
                <path
                    d={pathData}
                    fill="none"
                    stroke={tone === 'dark' ? '#b8f14b' : '#315efb'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {/* End dot */}
                <circle
                    cx={coords[coords.length - 1].x}
                    cy={coords[coords.length - 1].y}
                    r="3.5"
                    className={tone === 'dark' ? 'fill-[#b8f14b] stroke-[#151916] stroke-[1.5px]' : 'fill-[#11110f] stroke-[#fffdf8] stroke-[1.5px]'}
                />
            </svg>
            <span className={`text-[11px] font-mono flex flex-col justify-between h-8 leading-tight ${tone === 'dark' ? 'text-zinc-600' : 'text-zinc-500'}`}>
                <span>100</span>
                <span>0</span>
            </span>
        </div>
    );
};
