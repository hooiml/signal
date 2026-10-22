import type { MarketSignal } from '@/lib/types/signal-v2';
import type { MarketEvidenceCoverage } from '@/lib/market-evidence-coverage';
import layout from './market-v8-connected.module.css';

type Segment = { key: string; label: string; weight: number; state: 'fresh' | 'stale' | 'unknown' | 'fallback' };
const stateLabel = { fresh: 'fresh', stale: 'stale', unknown: 'freshness unverified', fallback: 'neutral fallback' } as const;
const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Score weight by input: each slice is one included input, coloured by freshness; grey is neutral fallback. */
export function MarketCoverageRing({ signal, coverage, onSelect }: {
    signal: MarketSignal; coverage: MarketEvidenceCoverage;
    onSelect: (key: string, element: HTMLButtonElement) => void;
}) {
    if (coverage.observedPct === null || coverage.fallbackPct === null) return null;
    const inputs: Segment[] = Object.entries(signal.components)
        .filter(([, item]) => item.enabled !== false && item.weight > 0)
        .sort(([, a], [, b]) => b.weight - a.weight)
        .map(([key, item]) => ({
            key, label: item.display_name, weight: item.weight * 100,
            state: coverage.staleKeys.includes(key) ? 'stale' : coverage.freshKeys.includes(key) ? 'fresh' : 'unknown',
        }));
    const segments: Segment[] = coverage.fallbackPct > 0 ? [...inputs, { key: 'fallback', label: 'Neutral fallback', weight: coverage.fallbackPct, state: 'fallback' }] : inputs;
    const total = segments.reduce((sum, segment) => sum + segment.weight, 0) || 1;
    const gap = segments.length > 1 ? 2 : 0;
    // Each arc starts where the previous one ended.
    const arcs = segments.map((segment, index) => {
        const start = segments.slice(0, index).reduce((sum, previous) => sum + previous.weight, 0) / total * CIRCUMFERENCE;
        const length = segment.weight / total * CIRCUMFERENCE;
        return { segment, start, dash: Math.max(0, length - gap) };
    });
    return <div className={layout.coverageRing}>
        <svg viewBox="0 0 120 120" role="img" aria-label={`Score weight: ${segments.map(segment => `${segment.label} ${segment.weight.toFixed(1)}%, ${stateLabel[segment.state]}`).join('; ')}.`}>
            <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="var(--surface-muted)" strokeWidth="14" />
            {arcs.map(({ segment, start, dash }) => <circle key={segment.key} data-state={segment.state} cx="60" cy="60" r={RADIUS} fill="none" strokeWidth="14"
                strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`} strokeDashoffset={-start} transform="rotate(-90 60 60)" />)}
            <text x="60" y="58" textAnchor="middle" className={layout.ringValue}>{Math.round(coverage.observedPct)}%</text>
            <text x="60" y="74" textAnchor="middle" className={layout.ringLabel}>scored</text>
        </svg>
        <ul className={layout.ringLegend}>
            {segments.map(segment => <li key={segment.key}>
                {segment.state === 'fallback'
                    ? <span className={layout.ringItem}><i data-state="fallback" aria-hidden="true" />{segment.label}<b>{segment.weight.toFixed(0)}%</b></span>
                    : <button type="button" className={layout.ringItem} onClick={event => onSelect(segment.key, event.currentTarget)}><i data-state={segment.state} aria-hidden="true" />{segment.label}<small>{stateLabel[segment.state]}</small><b>{segment.weight.toFixed(0)}%</b></button>}
            </li>)}
        </ul>
    </div>;
}
