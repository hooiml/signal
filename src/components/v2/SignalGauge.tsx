
'use client';

import React, { useEffect, useState } from 'react';
import { SignalTier } from '@/lib/types/signal-v2';

interface SignalGaugeProps {
    score: number;
    tier: SignalTier;
    confidence: 'low' | 'medium' | 'high';
}

export const SignalGauge = ({ score, tier, confidence }: SignalGaugeProps) => {
    const [animatedScore, setAnimatedScore] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => {
            setAnimatedScore(score);
        }, 100);
        return () => clearTimeout(timer);
    }, [score]);

    // SVG parameters
    const size = 200;
    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;

    const getTierColor = (t: SignalTier) => {
        switch (t) {
            case 'strong-buy': return 'var(--tier-strong-buy)';
            case 'buy': return 'var(--tier-buy)';
            case 'neutral': return 'var(--tier-neutral)';
            case 'sell': return 'var(--tier-sell)';
            case 'strong-sell': return 'var(--tier-strong-sell)';
            default: return 'var(--tier-neutral)';
        }
    };

    const color = getTierColor(tier);

    return (
        <div className="flex flex-col items-center w-full">
            <div className="relative" style={{ width: size, height: size * 0.85 }}>
                <svg
                    width={size}
                    height={size}
                    viewBox={`0 0 ${size} ${size}`}
                    className="transform"
                    style={{ transform: 'rotate(135deg)' }}
                >
                    {/* Background Track */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="#e2e8f0" /* slate-200 */
                        strokeWidth={strokeWidth}
                        strokeDasharray={`${circumference * 0.75} ${circumference}`}
                        strokeLinecap="round"
                    />
                    {/* Active Arc */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeDasharray={`${circumference * 0.75} ${circumference}`}
                        style={{
                            strokeDashoffset: (circumference * 0.75) * (1 - animatedScore / 100),
                            transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.5s ease'
                        }}
                        strokeLinecap="round"
                    />
                </svg>

                {/* Center Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
                    <span className="text-6xl font-bold tracking-tight font-mono tabular-nums text-slate-900">
                        {Math.round(animatedScore)}
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.3em] text-slate-500 font-bold -mt-1">
                        Score
                    </span>
                </div>
            </div>

            <div className="mt-4 flex flex-col items-center">
                <h2 className="text-5xl font-extrabold capitalize tracking-tight" style={{ color }}>
                    {tier.replace('-', ' ')}
                </h2>
                <div className="mt-2 flex items-center space-x-2">
                    <span className="text-[11px] uppercase tracking-widest text-slate-500">Signal alignment:</span>
                    <span className={`text-[11px] font-bold uppercase tracking-widest ${confidence === 'high' ? 'text-emerald-600' : confidence === 'medium' ? 'text-amber-500' : 'text-rose-600'
                        }`}>
                        {confidence}
                    </span>
                </div>
            </div>
        </div>
    );
};
