import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';

export type ResearchActionV6 = 'Ready' | 'DCA' | 'Wait for price' | 'Watch' | 'Avoid';
export type ResearchTabV6 = 'overview' | 'fundamentals' | 'valuation' | 'events' | 'chart' | 'technical';
export type ResearchThemeV6 = 'light' | 'dark';

export const RESEARCH_THEME_STORAGE_KEY_V6 = 'signal-dashboard-theme-v2';

export const researchTabsV6: Array<{ id: ResearchTabV6; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'fundamentals', label: 'Fundamentals' },
    { id: 'valuation', label: 'Valuation' },
    { id: 'events', label: 'Events' },
    { id: 'chart', label: 'Chart' },
    { id: 'technical', label: 'Technical' },
];

export const isResearchTabV6 = (value: string | null): value is ResearchTabV6 =>
    researchTabsV6.some((tab) => tab.id === value);

export const checklistLabelsV6: Record<string, string> = {
    understandBusiness: 'Understand the business',
    revenueGrowingOrStable: 'Revenue growing or stable',
    marginsHealthyOrImproving: 'Margins healthy or improving',
    debtManageable: 'Debt manageable',
    freeCashFlowPositiveOrImproving: 'Free cash flow positive or improving',
    valuationReasonable: 'Valuation reasonable',
    catalystOrCompoundingReason: 'Clear catalyst or compounding reason',
    downsideAcceptable: 'Downside acceptable',
    betterThanCashOrIndex: 'Better than cash or index',
};

export const getThemeV6 = (theme: ResearchThemeV6) => theme === 'light' ? {
    page: 'bg-[#f8fafc] text-slate-950 selection:bg-emerald-200 selection:text-slate-950',
    panel: 'border-slate-200/80 bg-white/75 shadow-[0_18px_45px_rgba(15,23,42,0.05)]',
    row: 'border-slate-200/80 bg-white/55 hover:border-slate-300 hover:bg-white',
    selectedRow: 'border-emerald-600 bg-emerald-50/70 shadow-sm',
    textPrimary: 'text-slate-950',
    textSecondary: 'text-slate-700',
    textMuted: 'text-slate-500',
    divider: 'border-slate-200/85',
    gridBorder: 'border-slate-200/80 bg-slate-200/80',
    cell: 'bg-white/75',
    statusSurface: 'bg-slate-100',
    ringInner: 'bg-white',
    ringTrackColor: '#cbd5e1',
    positive: 'text-emerald-700',
    risk: 'text-rose-600',
} : {
    page: 'bg-[#0b1118] text-[#eef2f7] selection:bg-emerald-300 selection:text-slate-950',
    panel: 'border-[#2a3948] bg-[#111a23]/70 shadow-[0_18px_45px_rgba(0,0,0,0.22)]',
    row: 'border-[#2a3948] bg-[#111a23]/40 hover:border-[#3a4b5c] hover:bg-[#16202a]',
    selectedRow: 'border-emerald-400 bg-emerald-400/8 shadow-[inset_0_1px_0_rgba(167,243,208,0.06)]',
    textPrimary: 'text-[#eef2f7]',
    textSecondary: 'text-[#c8d2dd]',
    textMuted: 'text-[#9aa8b8]',
    divider: 'border-[#263442]/85',
    gridBorder: 'border-[#2a3948] bg-[#2a3948]',
    cell: 'bg-[#111a23]/70',
    statusSurface: 'bg-[#0f1720]',
    ringInner: 'bg-[#111a23]',
    ringTrackColor: '#2a3948',
    positive: 'text-emerald-300',
    risk: 'text-rose-300',
};

export type ResearchThemeClassesV6 = ReturnType<typeof getThemeV6>;

export const getActionToneV6 = (action: ResearchActionV6, theme: ResearchThemeV6) => {
    const lightTones: Record<ResearchActionV6, string> = {
        Ready: 'text-emerald-700',
        DCA: 'text-emerald-700',
        'Wait for price': 'text-amber-700',
        Watch: 'text-slate-600',
        Avoid: 'text-rose-600',
    };
    const darkTones: Record<ResearchActionV6, string> = {
        Ready: 'text-emerald-300',
        DCA: 'text-emerald-300',
        'Wait for price': 'text-amber-300',
        Watch: 'text-[#c8d2dd]',
        Avoid: 'text-rose-300',
    };
    return theme === 'light' ? lightTones[action] : darkTones[action];
};

export const getActionReasonV6 = (action: ResearchActionV6) => {
    const reasons: Record<ResearchActionV6, string> = {
        Ready: 'Most checks pass and the price is inside the saved buy zone.',
        DCA: 'The thesis is strong and an owned position is inside the buy zone.',
        'Wait for price': 'The thesis is intact, but price or valuation still needs to improve.',
        Watch: 'Research is incomplete, so keep monitoring before deciding.',
        Avoid: 'A thesis or downside check is not acceptable for the current posture.',
    };
    return reasons[action];
};

export const getChecklistCountV6 = (item: ResearchWatchlistItem) =>
    Object.values(item.checklist).filter(Boolean).length;

export const getResearchActionV6 = (item: ResearchWatchlistItem): ResearchActionV6 => {
    const count = getChecklistCountV6(item);
    const qualityPassed = item.checklist.understandBusiness
        && item.checklist.revenueGrowingOrStable
        && item.checklist.marginsHealthyOrImproving
        && item.checklist.debtManageable
        && item.checklist.freeCashFlowPositiveOrImproving
        && item.checklist.downsideAcceptable;

    if (count === 0) return 'Watch';
    if (item.thesisStrength === 'low'
        || !item.checklist.downsideAcceptable
        || (item.valuationState === 'expensive' && item.thesisStrength !== 'high')) return 'Avoid';
    if (item.positionState === 'owned' && item.thesisStrength === 'high' && qualityPassed
        && item.valuationState !== 'expensive' && item.inBuyZone
        && item.checklist.valuationReasonable) return 'DCA';
    if (count >= 8 && item.inBuyZone && item.checklist.valuationReasonable
        && item.checklist.downsideAcceptable) return 'Ready';
    if ((item.thesisStrength === 'high' || item.thesisStrength === 'medium')
        && count >= 6 && (item.valuationState === 'expensive' || !item.inBuyZone)) return 'Wait for price';
    return 'Watch';
};

export const formatPriceV6 = (item: ResearchWatchlistItem) => {
    if (item.price === undefined) return '--';
    return item.market === 'US' ? '$' + item.price.toFixed(2) : item.price.toFixed(2);
};
