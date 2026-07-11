'use client';

import React from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MarketSignal } from '@/lib/types/signal-v2';

export type ActionLabel = 'Ready' | 'Wait' | 'DCA' | 'Watch' | 'Avoid';

// Shallow unknown-to-MarketSignal type guard (free of type assertions)
export function isMarketSignal(data: unknown): data is MarketSignal {
    if (typeof data !== 'object' || data === null) return false;
    return (
        'composite_score' in data && typeof data.composite_score === 'number' &&
        'tier' in data && typeof data.tier === 'string' &&
        'mode' in data && (data.mode === 'standard' || data.mode === 'contrarian') &&
        'interpretation' in data && typeof data.interpretation === 'object' && data.interpretation !== null &&
        'components' in data && typeof data.components === 'object' && data.components !== null &&
        'confidence' in data && typeof data.confidence === 'object' && data.confidence !== null &&
        'metadata' in data && typeof data.metadata === 'object' && data.metadata !== null
    );
}

// Deterministic formatters (fixed locale/timezone)
export const formatSnapshotTimeV5 = (timestamp?: string | null): string => {
    if (!timestamp) return 'No snapshot';
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) return 'Unknown time';
    return parsed.toLocaleString('en-US', {
        timeZone: 'UTC',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }) + ' UTC';
};

export const formatShortDateV5 = (timestamp?: string | null): string => {
    if (!timestamp) return 'Unknown';
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) return timestamp;
    return parsed.toLocaleString('en-US', {
        timeZone: 'UTC',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }) + ' UTC';
};

export const formatSignedV5 = (value: number | null | undefined, suffix = ''): string => {
    if (value === null || value === undefined) return '0.0';
    const rounded = Math.round(value * 10) / 10;
    if (rounded > 0) return `+${rounded}${suffix}`;
    return `${rounded}${suffix}`;
};

// Icons (Inline SVG)
export const RefreshIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
        <path d="M16 16h5v5" />
    </svg>
);

export const ChevronIcon = ({ className = 'h-4 w-4', direction = 'down' }: { className?: string; direction?: 'up' | 'down' | 'left' | 'right' }) => {
    const rotations = {
        up: 'rotate-180',
        down: '',
        left: 'rotate-90',
        right: '-rotate-90',
    };
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`${className} transition-transform duration-200 ${rotations[direction]}`}
        >
            <path d="m6 9 6 6 6-6" />
        </svg>
    );
};

export const InfoIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
    </svg>
);

export const SearchIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
    </svg>
);

// Quiet semantic Action Chips
export const ActionPillV5 = ({ label, large = false }: { label: ActionLabel; large?: boolean }) => {
    const classes: Record<ActionLabel, string> = {
        Ready: 'bg-[#17745a]/10 text-[#17745a] border border-[#17745a]/20',
        DCA: 'bg-[#2f62d5]/10 text-[#2f62d5] border border-[#2f62d5]/20',
        Wait: 'bg-[#b86e00]/10 text-[#b86e00] border border-[#b86e00]/20',
        Watch: 'bg-zinc-100 text-zinc-600 border border-zinc-200',
        Avoid: 'bg-[#c73c35]/10 text-[#c73c35] border border-[#c73c35]/20',
    };

    return (
        <span
            className={`inline-flex items-center justify-center font-mono font-bold rounded-[4px] uppercase tracking-wider px-2.5 py-0.5 ${
                classes[label]
            } ${large ? 'text-xs h-7' : 'text-[11px] h-[22px]'}`}
        >
            {label}
        </span>
    );
};

const SignalMark = () => (
    <span className="flex h-7 w-7 items-end justify-center gap-[3px] rounded-md bg-[#b8f14b] px-1.5 py-1.5" aria-hidden="true">
        <span className="h-2 w-[3px] rounded-full bg-[#151916]" />
        <span className="h-4 w-[3px] rounded-full bg-[#151916]" />
        <span className="h-3 w-[3px] rounded-full bg-[#151916]" />
    </span>
);

// High-contrast app bar shared by both decision surfaces.
export const TopAppBarV5 = ({
    snapshotDate,
    onRefresh,
    isRefreshing = false,
    showRefresh = false,
    showSnapshot = true,
}: {
    snapshotDate?: string | null;
    onRefresh?: () => void;
    isRefreshing?: boolean;
    showRefresh?: boolean;
    showSnapshot?: boolean;
}) => {
    const pathname = usePathname();

    const formattedFreshness = React.useMemo(() => {
        if (!snapshotDate) return '';
        return formatSnapshotTimeV5(snapshotDate);
    }, [snapshotDate]);

    return (
        <header className="sticky top-0 z-50 w-full h-[68px] bg-[#151916] text-white select-none shadow-[0_1px_0_rgba(255,255,255,0.08)]">
            <div className="max-w-[1240px] h-full mx-auto px-4 flex items-center justify-between">
                {/* Brand Logo & Navigation */}
                <div className="flex items-center gap-4 sm:gap-7">
                    <Link href="/main-v5" className="flex items-center gap-2.5 font-sans font-black text-lg tracking-tight hover:opacity-80 transition-opacity">
                        <SignalMark />
                        <span>SIGNAL</span>
                        <span className="hidden sm:inline text-[#b8f14b] text-[10px] font-mono font-bold uppercase">Intelligence</span>
                    </Link>
                    <nav className="flex items-center rounded-md bg-white/[0.06] p-1" aria-label="Main Navigation">
                        <Link
                            href="/main-v5"
                            className={`rounded px-3 py-1.5 text-xs font-bold transition-colors ${
                                pathname === '/main-v5'
                                    ? 'bg-[#b8f14b] text-[#151916]'
                                    : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                            Market
                        </Link>
                        <Link
                            href="/research-v5"
                            className={`rounded px-3 py-1.5 text-xs font-bold transition-colors ${
                                pathname === '/research-v5'
                                    ? 'bg-[#b8f14b] text-[#151916]'
                                    : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                            Research
                        </Link>
                    </nav>
                </div>

                {/* Freshness & Refresh status */}
                <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
                    {showSnapshot && formattedFreshness && (
                        <div className="hidden sm:flex items-center gap-1">
                            <span className="text-zinc-500 font-sans">Freshness</span>
                            <span className="text-zinc-200 font-semibold">{formattedFreshness}</span>
                        </div>
                    )}

                    {showRefresh && onRefresh && (
                        <button
                            type="button"
                            onClick={onRefresh}
                            disabled={isRefreshing}
                            aria-label="Refresh analysis"
                            className="flex items-center justify-center p-2 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-wait border border-white/10"
                        >
                            <RefreshIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
};

export const ShellV5 = ({ children }: { children: ReactNode }) => {
    return (
        <div className="min-h-screen w-full bg-[#f2f4ef] text-[#17201d] font-sans flex flex-col antialiased [background-image:radial-gradient(#cfd5cc_0.7px,transparent_0.7px)] [background-size:18px_18px]">
            {children}
        </div>
    );
};
