'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getChecklistCount, ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';

export type ReliabilityLevel = 'Strong' | 'Moderate' | 'Weak';
export type ActionLabel = 'Ready' | 'Wait' | 'DCA' | 'Watch' | 'Avoid';
export type FreshnessLevel = 'fresh' | 'recent' | 'stale';

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;
const THREE_DAYS = 3 * ONE_DAY;

export const v4Tokens = {
    cmdBg: '#0F1117',
    cmdPanel: '#181A20',
    cmdPanelAlt: '#202229',
    cmdBorder: '#1E2130',
    cmdBorderStrong: '#3A3D47',
    cmdText: '#E8EAF0',
    cmdMuted: '#9CA3AF',
    readBg: '#FAFAF8',
    readPanel: '#FFFFFF',
    readBorder: '#E5E3DC',
    readText: '#1A1A1A',
    readMuted: '#6B7280',
    positive: '#22C55E',
    positiveLight: '#16A34A',
    positiveBg: '#DCFCE7',
    caution: '#F59E0B',
    cautionLight: '#D97706',
    cautionBg: '#FEF3C7',
    negative: '#EF4444',
    negativeLight: '#DC2626',
    negativeBg: '#FEE2E2',
    neutral: '#9CA3AF',
    neutralLight: '#4B5563',
    neutralBg: '#F3F4F6',
    accent: '#2563EB',
    accentDark: '#3B82F6',
    accentBg: '#EFF6FF',
};

export const AppHeaderV4 = ({
    snapshotDate,
    onRefresh,
    isRefreshing = false,
}: {
    snapshotDate?: string | null;
    onRefresh?: () => void;
    isRefreshing?: boolean;
}) => {
    const pathname = usePathname();
    const snapshotAge = getAgeMs(snapshotDate);
    const isLive = snapshotAge !== null && snapshotAge < FIFTEEN_MINUTES;

    return (
        <header className="mx-auto flex h-12 w-full max-w-[1280px] items-center justify-between gap-4 px-4 md:px-6">
            <Link href="/main-v4" className="shrink-0 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">
                Signal
            </Link>

            <nav className="flex h-8 items-center rounded-md bg-white/[0.045] p-0.5 text-[13px] font-medium" aria-label="V4 primary">
                <TabLink href="/main-v4" active={pathname === '/main-v4'}>Market signal</TabLink>
                <TabLink href="/research-v4" active={pathname === '/research-v4'}>Research</TabLink>
            </nav>

            <div className="hidden min-w-[210px] items-center justify-end gap-3 text-xs text-[#9CA3AF] sm:flex">
                {onRefresh ? (
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        className="rounded px-2 py-1 font-medium text-[#E8EAF0] transition hover:bg-white/[0.06] disabled:cursor-wait disabled:text-[#6B7280]"
                    >
                        {isRefreshing ? 'Refreshing' : 'Refresh'}
                    </button>
                ) : null}
                <span className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-[#22C55E]' : 'bg-[#F59E0B]'}`} />
                    <span>{formatSnapshotTime(snapshotDate)}</span>
                </span>
            </div>
        </header>
    );
};

const TabLink = ({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) => (
    <Link
        href={href}
        className={`flex h-7 items-center rounded px-3 transition-colors ${
            active ? 'bg-white/[0.08] text-[#E8EAF0]' : 'text-[#9CA3AF] hover:text-[#E8EAF0]'
        }`}
    >
        {children}
    </Link>
);

export const ActionBadge = ({ label, large = false }: { label: ActionLabel; large?: boolean }) => {
    const classes: Record<ActionLabel, string> = {
        Ready: 'bg-[#DCFCE7] text-[#166534]',
        Wait: 'bg-[#FEF3C7] text-[#92400E]',
        DCA: 'bg-[#EFF6FF] text-[#1D4ED8]',
        Watch: 'bg-[#F3F4F6] text-[#374151]',
        Avoid: 'bg-[#FEE2E2] text-[#991B1B]',
    };

    return (
        <span className={`inline-flex items-center rounded px-2 font-semibold ${classes[label]} ${large ? 'h-8 text-base' : 'h-6 text-xs'}`}>
            {label}
        </span>
    );
};

export const computeActionLabel = (item: ResearchWatchlistItem): ActionLabel => {
    const checklistCount = getChecklistCount(item.checklist);
    const coreQualityPassed = item.checklist.understandBusiness
        && item.checklist.revenueGrowingOrStable
        && item.checklist.marginsHealthyOrImproving
        && item.checklist.debtManageable
        && item.checklist.freeCashFlowPositiveOrImproving
        && item.checklist.downsideAcceptable;

    if (
        item.thesisStrength === 'low'
        || !item.checklist.downsideAcceptable
        || (item.valuationState === 'expensive' && item.thesisStrength !== 'high')
    ) {
        return 'Avoid';
    }

    if (
        item.positionState === 'owned'
        && item.thesisStrength === 'high'
        && coreQualityPassed
        && item.valuationState !== 'expensive'
    ) {
        return 'DCA';
    }

    if (
        checklistCount >= 8
        && item.inBuyZone
        && item.checklist.valuationReasonable
        && item.checklist.downsideAcceptable
    ) {
        return 'Ready';
    }

    if (
        (item.thesisStrength === 'high' || item.thesisStrength === 'medium')
        && checklistCount >= 6
        && (item.valuationState === 'expensive' || !item.inBuyZone)
    ) {
        return 'Wait';
    }

    return 'Watch';
};

export const getFreshnessLevel = (timestamp?: string | null): FreshnessLevel => {
    const age = getAgeMs(timestamp);
    if (age === null || age > THREE_DAYS) return 'stale';
    if (age > ONE_DAY) return 'recent';
    return 'fresh';
};

export const getAgeMs = (timestamp?: string | null) => {
    if (!timestamp) return null;
    const parsed = new Date(timestamp).getTime();
    if (Number.isNaN(parsed)) return null;
    return Date.now() - parsed;
};

export const computeReliability = ({
    activeSourceCount,
    agreementPct,
    sourceFreshness,
}: {
    activeSourceCount: number;
    agreementPct: number;
    sourceFreshness: FreshnessLevel[];
}): ReliabilityLevel => {
    if (sourceFreshness.includes('stale')) return 'Weak';
    if (activeSourceCount < 3) return 'Weak';
    if (agreementPct < 60) return 'Weak';
    if (sourceFreshness.includes('recent')) return 'Moderate';
    if (activeSourceCount <= 4) return 'Moderate';
    if (agreementPct < 80) return 'Moderate';
    return 'Strong';
};

export const formatSnapshotTime = (timestamp?: string | null) => {
    if (!timestamp) return 'No snapshot';
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) return 'Unknown time';
    return parsed.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

export const formatShortDate = (timestamp?: string | null) => {
    if (!timestamp) return 'Unknown';
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) return timestamp;
    return parsed.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

export const formatSigned = (value: number | null | undefined, suffix = '') => {
    if (value === null || value === undefined) return 'Flat';
    const rounded = Math.round(value * 10) / 10;
    if (rounded > 0) return `+${rounded}${suffix}`;
    return `${rounded}${suffix}`;
};

export const getScoreToneClass = (score: number) => {
    if (score >= 65) return 'text-[#22C55E]';
    if (score >= 45) return 'text-[#F59E0B]';
    return 'text-[#EF4444]';
};

export const getScoreBgClass = (score: number) => {
    if (score >= 65) return 'bg-[#22C55E]';
    if (score >= 45) return 'bg-[#F59E0B]';
    return 'bg-[#EF4444]';
};

export const normalizeWatchlist = (items: ResearchWatchlistItem[]) => [...items].sort((a, b) => a.order - b.order);
