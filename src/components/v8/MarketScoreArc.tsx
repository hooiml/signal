import { useId } from 'react';
import layout from './market-v8-connected.module.css';

const clamp = (value: number) => Math.min(100, Math.max(0, value));
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Luminous semi-circle posture gauge displaying the 0–100 composite score and threshold ticks. */
export function MarketScoreArc({
    score,
    previousScore,
    previousDateLabel,
    neutralLower,
    neutralUpper,
    posture,
    simulated = false,
}: {
    score: number;
    previousScore: number | null;
    previousDateLabel?: string | null;
    neutralLower: number;
    neutralUpper: number;
    posture: 'up' | 'neutral' | 'down';
    simulated?: boolean;
}) {
    const gradId = `arc-grad-${useId().replace(/:/g, '')}`;
    const cx = 110;
    const cy = 104;
    const r = 82;
    const pointAt = (value: number) => {
        const angle = 180 - (clamp(value) / 100) * 180;
        return {
            x: cx + r * Math.cos(toRad(angle)),
            y: cy - r * Math.sin(toRad(angle)),
        };
    };
    const start = pointAt(0);
    const end = pointAt(100);
    const active = pointAt(score);
    const prev = previousScore !== null ? pointAt(previousScore) : null;
    const arcLen = Math.PI * r;
    const dashOffset = arcLen * (1 - clamp(score) / 100);
    const orbColor = posture === 'up' ? 'var(--up-mark)' : posture === 'down' ? 'var(--down-mark)' : 'var(--caution-mark)';

    const label = `Score ${score.toFixed(0)} on a 0 to 100 scale; neutral band ${neutralLower} to ${neutralUpper - 1}.${
        previousScore !== null && previousDateLabel ? ` Previous score ${previousScore.toFixed(0)} on ${previousDateLabel}.` : ''
    }${simulated ? ' Local stress-test preview.' : ''}`;

    return (
        <div className={layout.arcWrap} role="img" aria-label={label}>
            <svg className={layout.arcSvg} viewBox="0 0 220 130">
                <defs>
                    <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="var(--down-mark)" />
                        <stop offset="50%" stopColor="var(--caution-mark)" />
                        <stop offset="100%" stopColor="var(--up-mark)" />
                    </linearGradient>
                </defs>
                {/* Resting track */}
                <path
                    d={`M ${start.x.toFixed(1)} ${start.y.toFixed(1)} A ${r} ${r} 0 0 1 ${end.x.toFixed(1)} ${end.y.toFixed(1)}`}
                    fill="none"
                    stroke="var(--surface-muted)"
                    strokeWidth="13"
                    strokeLinecap="round"
                />
                {/* Active gradient arc */}
                <path
                    d={`M ${start.x.toFixed(1)} ${start.y.toFixed(1)} A ${r} ${r} 0 0 1 ${end.x.toFixed(1)} ${end.y.toFixed(1)}`}
                    fill="none"
                    stroke={`url(#${gradId})`}
                    strokeWidth="13"
                    strokeLinecap="round"
                    strokeDasharray={arcLen.toFixed(1)}
                    strokeDashoffset={dashOffset.toFixed(1)}
                    className={layout.arcProgress}
                />
                {/* Threshold ticks */}
                {[neutralLower, neutralUpper].map(mark => {
                    const a = 180 - (mark / 100) * 180;
                    const x1 = cx + (r - 9) * Math.cos(toRad(a));
                    const y1 = cy - (r - 9) * Math.sin(toRad(a));
                    const x2 = cx + (r + 9) * Math.cos(toRad(a));
                    const y2 = cy - (r + 9) * Math.sin(toRad(a));
                    return <line key={mark} x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)} stroke="var(--surface)" strokeWidth="2.4" />;
                })}
                {/* Previous score ghost marker */}
                {prev && !simulated && previousScore !== null && (
                    <circle
                        className={layout.v81PreviousPin}
                        data-previous-score={String(previousScore)}
                        cx={prev.x.toFixed(1)}
                        cy={prev.y.toFixed(1)}
                        r="4"
                        fill="var(--surface)"
                        stroke="var(--subtle)"
                        strokeWidth="2"
                    />
                )}
                {/* Active orb */}
                <circle cx={active.x.toFixed(1)} cy={active.y.toFixed(1)} r="10" fill={orbColor} opacity="0.22" />
                <circle cx={active.x.toFixed(1)} cy={active.y.toFixed(1)} r="6" fill="var(--surface)" stroke={orbColor} strokeWidth="3.2" />
                {/* End scale labels */}
                <text x="24" y="124" textAnchor="middle" className={layout.arcTick}>0</text>
                <text x="110" y="124" textAnchor="middle" className={layout.arcTick}>Neutral {neutralLower}–{neutralUpper - 1}</text>
                <text x="196" y="124" textAnchor="middle" className={layout.arcTick}>100</text>
            </svg>
        </div>
    );
}
