'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AppNav } from '@/components/AppNav';
import { ThemeModeSwitchV2 } from '@/components/ThemeModeSwitchV2';

export type Market = 'US' | 'MY';
export type ResearchStatus = 'owned' | 'watch' | 'waiting' | 'avoid';
export type ValuationState = 'cheap' | 'fair' | 'expensive' | 'unknown';
export type ThesisStrength = 'high' | 'medium' | 'low';
export type ReadinessState = 'Ready' | 'Wait for better price' | 'Too uncertain' | 'Avoid';
type ResearchTheme = 'light' | 'dark';
type ChecklistKey =
    | 'understandBusiness'
    | 'revenueGrowingOrStable'
    | 'marginsHealthyOrImproving'
    | 'debtManageable'
    | 'freeCashFlowPositiveOrImproving'
    | 'valuationReasonable'
    | 'catalystOrCompoundingReason'
    | 'downsideAcceptable'
    | 'betterThanCashOrIndex';
type InvestmentChecklist = Record<ChecklistKey, boolean>;
type KeyValueRow = [string, string];

export type ResearchWatchlistItem = {
    order: number;
    symbol: string;
    providerSymbol: string;
    name: string;
    market: Market;
    positionState: 'owned' | 'not-owned';
    inBuyZone: boolean;
    price?: number;
    dailyChange?: number;
    status: ResearchStatus;
    targetBuyZone: string;
    valuationState: ValuationState;
    thesisStrength: ThesisStrength;
    lastReviewedAt: string;
    description: string;
    sector: string;
    industry: string;
    marketCap: string;
    revenueGrowth: string;
    grossMargin: string;
    operatingMargin: string;
    freeCashFlowTrend: string;
    debtLevel: string;
    cashPosition: string;
    shareCountTrend: string;
    whyInterested: string;
    bullCase: string;
    bearCase: string;
    buyTrigger: string;
    sellTrigger: string;
    thesisBreak: string;
    valuation: {
        pe: string;
        forwardPe: string;
        priceSales: string;
        evEbitda: string;
        fcfYield: string;
        dividendYield: string;
        fiveYearRange: string;
        peerNote: string;
    };
    event: {
        nextEarnings: string;
        lastEarnings: string;
        revenueResult: string;
        epsResult: string;
        guidance: string;
        note: string;
    };
    feed: Array<{
        title: string;
        source: string;
        date: string;
        label: string;
    }>;
    technical: {
        ma50: string;
        ma200: string;
        range52Week: string;
        rsi: string;
        macd: string;
        volume: string;
        supportResistance: string;
    };
    checklist: InvestmentChecklist;
};

const THEME_STORAGE_KEY = 'signal-dashboard-theme-v2';

const checklistItems: Array<{ key: ChecklistKey; label: string }> = [
    { key: 'understandBusiness', label: 'Understand the business' },
    { key: 'revenueGrowingOrStable', label: 'Revenue growing or stable' },
    { key: 'marginsHealthyOrImproving', label: 'Margins healthy or improving' },
    { key: 'debtManageable', label: 'Debt manageable' },
    { key: 'freeCashFlowPositiveOrImproving', label: 'Free cash flow positive or improving' },
    { key: 'valuationReasonable', label: 'Valuation reasonable' },
    { key: 'catalystOrCompoundingReason', label: 'Clear catalyst or compounding reason' },
    { key: 'downsideAcceptable', label: 'Downside acceptable' },
    { key: 'betterThanCashOrIndex', label: 'Better than cash or index' },
];

export const watchlist: ResearchWatchlistItem[] = [
    {
        order: 10,
        symbol: 'MSFT',
        providerSymbol: 'MSFT.US',
        name: 'Microsoft',
        market: 'US',
        positionState: 'owned',
        inBuyZone: false,
        price: 428.4,
        dailyChange: 0.7,
        status: 'owned',
        targetBuyZone: '$390 - $405',
        valuationState: 'fair',
        thesisStrength: 'high',
        lastReviewedAt: '2026-05-10',
        description: 'Enterprise software, cloud infrastructure, productivity apps, gaming, and AI platform exposure.',
        sector: 'Technology',
        industry: 'Software - Infrastructure',
        marketCap: 'Large cap',
        revenueGrowth: 'Healthy, cloud-led',
        grossMargin: 'High and stable',
        operatingMargin: 'Strong',
        freeCashFlowTrend: 'Positive and expanding',
        debtLevel: 'Manageable',
        cashPosition: 'Large net cash position',
        shareCountTrend: 'Stable to declining',
        whyInterested: 'Durable enterprise distribution with cloud and AI optionality.',
        bullCase: 'Azure and AI tooling continue to compound inside existing enterprise distribution.',
        bearCase: 'AI capex rises faster than monetization and cloud growth slows from a larger base.',
        buyTrigger: 'Add only if valuation resets closer to the target zone or fundamentals accelerate.',
        sellTrigger: 'Reduce if cloud margins weaken while valuation remains stretched.',
        thesisBreak: 'Enterprise AI demand fails to convert into durable revenue growth.',
        valuation: {
            pe: 'High 20s',
            forwardPe: 'Mid 20s',
            priceSales: 'Premium',
            evEbitda: 'Premium',
            fcfYield: 'Low single digit',
            dividendYield: 'Low',
            fiveYearRange: 'Upper half',
            peerNote: 'Quality premium versus broad software peers',
        },
        event: {
            nextEarnings: 'Late July 2026',
            lastEarnings: 'April 2026',
            revenueResult: 'Beat',
            epsResult: 'Beat',
            guidance: 'Cloud demand still the key watch item',
            note: 'Track AI infrastructure spend versus Azure growth.',
        },
        feed: [
            { title: 'Cloud growth remains the main thesis driver', source: 'Sample research note', date: '2026-05-09', label: 'Relevant' },
            { title: 'AI capex questions remain active', source: 'Sample news', date: '2026-05-07', label: 'Risk' },
        ],
        technical: {
            ma50: 'Above',
            ma200: 'Above',
            range52Week: 'Near upper range',
            rsi: 'Neutral',
            macd: 'Positive momentum',
            volume: 'Normal',
            supportResistance: '$405 support, $455 resistance',
        },
        checklist: {
            understandBusiness: true,
            revenueGrowingOrStable: true,
            marginsHealthyOrImproving: true,
            debtManageable: true,
            freeCashFlowPositiveOrImproving: true,
            valuationReasonable: false,
            catalystOrCompoundingReason: true,
            downsideAcceptable: true,
            betterThanCashOrIndex: true,
        },
    },
    {
        order: 20,
        symbol: 'NVDA',
        providerSymbol: 'NVDA.US',
        name: 'NVIDIA',
        market: 'US',
        positionState: 'not-owned',
        inBuyZone: false,
        price: 118.9,
        dailyChange: -1.1,
        status: 'waiting',
        targetBuyZone: '$95 - $105',
        valuationState: 'expensive',
        thesisStrength: 'medium',
        lastReviewedAt: '2026-05-08',
        description: 'Accelerated computing platform spanning data center GPUs, networking, software, and gaming GPUs.',
        sector: 'Technology',
        industry: 'Semiconductors',
        marketCap: 'Mega cap',
        revenueGrowth: 'Very high but cyclical risk',
        grossMargin: 'Very high',
        operatingMargin: 'Very strong',
        freeCashFlowTrend: 'Strong',
        debtLevel: 'Low',
        cashPosition: 'Strong',
        shareCountTrend: 'Stable',
        whyInterested: 'Dominant AI infrastructure supplier with exceptional margin profile.',
        bullCase: 'AI infrastructure demand stays supply-constrained and software attach improves durability.',
        bearCase: 'Hyperscaler spending normalizes and customers diversify silicon away from one supplier.',
        buyTrigger: 'Wait for valuation compression or another data-center demand confirmation.',
        sellTrigger: 'Avoid chasing if expectations rise faster than earnings revisions.',
        thesisBreak: 'Data-center order growth decelerates before margins normalize.',
        valuation: {
            pe: 'Premium',
            forwardPe: 'Premium',
            priceSales: 'Very high',
            evEbitda: 'Premium',
            fcfYield: 'Low',
            dividendYield: 'Minimal',
            fiveYearRange: 'Near top',
            peerNote: 'Premium to semiconductor peers',
        },
        event: {
            nextEarnings: 'Late May 2026',
            lastEarnings: 'February 2026',
            revenueResult: 'Beat',
            epsResult: 'Beat',
            guidance: 'Demand durability is the central question',
            note: 'Watch gross margin and backlog commentary.',
        },
        feed: [
            { title: 'AI accelerator demand still dominates coverage', source: 'Sample transcript watch', date: '2026-05-11', label: 'Catalyst' },
            { title: 'Custom silicon risk remains a long-term bear case', source: 'Sample filing review', date: '2026-05-06', label: 'Risk' },
        ],
        technical: {
            ma50: 'Above',
            ma200: 'Above',
            range52Week: 'Upper quartile',
            rsi: 'Warm',
            macd: 'Flattening',
            volume: 'Elevated',
            supportResistance: '$105 support, $130 resistance',
        },
        checklist: {
            understandBusiness: true,
            revenueGrowingOrStable: true,
            marginsHealthyOrImproving: true,
            debtManageable: true,
            freeCashFlowPositiveOrImproving: true,
            valuationReasonable: false,
            catalystOrCompoundingReason: true,
            downsideAcceptable: true,
            betterThanCashOrIndex: true,
        },
    },
    {
        order: 30,
        symbol: 'VOO',
        providerSymbol: 'VOO.US',
        name: 'Vanguard S&P 500 ETF',
        market: 'US',
        positionState: 'not-owned',
        inBuyZone: true,
        price: 512.3,
        dailyChange: 0.1,
        status: 'watch',
        targetBuyZone: 'Dollar-cost average',
        valuationState: 'fair',
        thesisStrength: 'high',
        lastReviewedAt: '2026-05-05',
        description: 'Broad US large-cap equity exposure through an index fund structure.',
        sector: 'ETF',
        industry: 'Broad market',
        marketCap: 'Diversified',
        revenueGrowth: 'Index weighted',
        grossMargin: 'Not applicable',
        operatingMargin: 'Not applicable',
        freeCashFlowTrend: 'Index weighted',
        debtLevel: 'Not applicable',
        cashPosition: 'Not applicable',
        shareCountTrend: 'Creation/redemption driven',
        whyInterested: 'Baseline opportunity-cost benchmark against single-stock ideas.',
        bullCase: 'Low-cost broad exposure remains a strong baseline against single-stock risk.',
        bearCase: 'Index concentration and valuation leave less margin of safety.',
        buyTrigger: 'Use as the benchmark alternative when individual stocks are not clearly better.',
        sellTrigger: 'Only reduce for allocation reasons, not short-term market noise.',
        thesisBreak: 'A cheaper equivalent fund with better tax or fee characteristics becomes preferable.',
        valuation: {
            pe: 'Index level',
            forwardPe: 'Index level',
            priceSales: 'Index level',
            evEbitda: 'Unavailable',
            fcfYield: 'Index level',
            dividendYield: 'Modest',
            fiveYearRange: 'Upper half',
            peerNote: 'Compare against equivalent S&P 500 ETFs',
        },
        event: {
            nextEarnings: 'Not applicable',
            lastEarnings: 'Not applicable',
            revenueResult: 'Unavailable',
            epsResult: 'Unavailable',
            guidance: 'Index valuation and concentration matter most',
            note: 'Use as opportunity-cost benchmark.',
        },
        feed: [
            { title: 'Index concentration remains elevated', source: 'Sample market note', date: '2026-05-04', label: 'Context' },
            { title: 'Broad market valuation backdrop is mixed', source: 'Sample valuation note', date: '2026-05-03', label: 'Context' },
        ],
        technical: {
            ma50: 'Above',
            ma200: 'Above',
            range52Week: 'Upper half',
            rsi: 'Neutral',
            macd: 'Positive',
            volume: 'Normal',
            supportResistance: 'Watch prior month low',
        },
        checklist: {
            understandBusiness: true,
            revenueGrowingOrStable: true,
            marginsHealthyOrImproving: true,
            debtManageable: true,
            freeCashFlowPositiveOrImproving: true,
            valuationReasonable: true,
            catalystOrCompoundingReason: true,
            downsideAcceptable: true,
            betterThanCashOrIndex: true,
        },
    },
    {
        order: 40,
        symbol: 'MAYBANK',
        providerSymbol: '1155.KLSE',
        name: 'Malayan Banking',
        market: 'MY',
        positionState: 'not-owned',
        inBuyZone: false,
        price: 10.02,
        dailyChange: 0.3,
        status: 'watch',
        targetBuyZone: 'RM9.20 - RM9.60',
        valuationState: 'fair',
        thesisStrength: 'medium',
        lastReviewedAt: '2026-05-02',
        description: 'Large Malaysian banking group with regional exposure and dividend relevance.',
        sector: 'Financials',
        industry: 'Banks',
        marketCap: 'Large cap',
        revenueGrowth: 'Stable',
        grossMargin: 'Not applicable',
        operatingMargin: 'Stable',
        freeCashFlowTrend: 'Bank-specific metric needed',
        debtLevel: 'Bank balance sheet',
        cashPosition: 'Bank balance sheet',
        shareCountTrend: 'Stable',
        whyInterested: 'Dividend durability and domestic banking scale.',
        bullCase: 'Stable earnings base, dividend support, and domestic banking scale.',
        bearCase: 'Margin compression or asset-quality deterioration weakens income durability.',
        buyTrigger: 'Review after quarterly asset-quality and dividend commentary.',
        sellTrigger: 'Avoid if credit costs rise faster than earnings coverage.',
        thesisBreak: 'Dividend support weakens because earnings quality deteriorates.',
        valuation: {
            pe: 'Moderate',
            forwardPe: 'Unknown',
            priceSales: 'Unavailable',
            evEbitda: 'Unavailable',
            fcfYield: 'Unavailable',
            dividendYield: 'Relevant',
            fiveYearRange: 'Middle range',
            peerNote: 'Compare against Malaysian banking peers',
        },
        event: {
            nextEarnings: 'Unknown',
            lastEarnings: 'Recent quarter',
            revenueResult: 'Unknown',
            epsResult: 'Unknown',
            guidance: 'Asset quality and margin commentary needed',
            note: 'Add Bursa filing links in a later phase.',
        },
        feed: [
            { title: 'Dividend durability remains the key watch item', source: 'Sample Bursa note', date: '2026-05-01', label: 'Relevant' },
            { title: 'Banking margin outlook needs source confirmation', source: 'Sample news', date: '2026-04-30', label: 'Needs review' },
        ],
        technical: {
            ma50: 'Near',
            ma200: 'Above',
            range52Week: 'Middle range',
            rsi: 'Neutral',
            macd: 'Flat',
            volume: 'Normal',
            supportResistance: 'RM9.60 support, RM10.40 resistance',
        },
        checklist: {
            understandBusiness: true,
            revenueGrowingOrStable: true,
            marginsHealthyOrImproving: true,
            debtManageable: false,
            freeCashFlowPositiveOrImproving: true,
            valuationReasonable: true,
            catalystOrCompoundingReason: true,
            downsideAcceptable: true,
            betterThanCashOrIndex: false,
        },
    },
    {
        order: 50,
        symbol: 'NET',
        providerSymbol: 'NET.US',
        name: 'Cloudflare',
        market: 'US',
        positionState: 'not-owned',
        inBuyZone: false,
        price: 88.1,
        dailyChange: -0.8,
        status: 'avoid',
        targetBuyZone: '$55 - $65',
        valuationState: 'expensive',
        thesisStrength: 'low',
        lastReviewedAt: '2026-04-29',
        description: 'Edge network, security, developer platform, and application delivery services.',
        sector: 'Technology',
        industry: 'Software - Infrastructure',
        marketCap: 'Mid cap',
        revenueGrowth: 'High but slowing',
        grossMargin: 'High',
        operatingMargin: 'Still developing',
        freeCashFlowTrend: 'Improving but needs consistency',
        debtLevel: 'Manageable',
        cashPosition: 'Adequate',
        shareCountTrend: 'Dilution watch',
        whyInterested: 'Strong platform story, but valuation and margin proof are unresolved.',
        bullCase: 'Platform breadth creates durable expansion across security, edge compute, and developer workflows.',
        bearCase: 'Growth slows before margins prove the current valuation.',
        buyTrigger: 'Wait for either a large valuation reset or clearer operating leverage.',
        sellTrigger: 'Avoid if dilution continues while growth moderates.',
        thesisBreak: 'The platform story fails to produce durable free cash flow growth.',
        valuation: {
            pe: 'Not meaningful',
            forwardPe: 'High',
            priceSales: 'High',
            evEbitda: 'High',
            fcfYield: 'Low',
            dividendYield: 'None',
            fiveYearRange: 'Upper half',
            peerNote: 'Compare against high-growth infrastructure software',
        },
        event: {
            nextEarnings: 'August 2026',
            lastEarnings: 'May 2026',
            revenueResult: 'In line',
            epsResult: 'Beat',
            guidance: 'Operating leverage is the focus',
            note: 'Do not upgrade without margin proof.',
        },
        feed: [
            { title: 'Developer platform story needs margin proof', source: 'Sample transcript review', date: '2026-05-03', label: 'Risk' },
            { title: 'Revenue growth remains solid but valuation is demanding', source: 'Sample news', date: '2026-05-02', label: 'Context' },
        ],
        technical: {
            ma50: 'Below',
            ma200: 'Above',
            range52Week: 'Middle range',
            rsi: 'Soft',
            macd: 'Negative momentum',
            volume: 'Elevated on down days',
            supportResistance: '$75 support, $96 resistance',
        },
        checklist: {
            understandBusiness: true,
            revenueGrowingOrStable: true,
            marginsHealthyOrImproving: false,
            debtManageable: true,
            freeCashFlowPositiveOrImproving: false,
            valuationReasonable: false,
            catalystOrCompoundingReason: true,
            downsideAcceptable: false,
            betterThanCashOrIndex: false,
        },
    },
];

const statusLabels: Record<ResearchStatus, string> = {
    owned: 'Owned',
    watch: 'Watch',
    waiting: 'Waiting',
    avoid: 'Avoid',
};

const valuationLabels: Record<ValuationState, string> = {
    cheap: 'Cheap',
    fair: 'Fair',
    expensive: 'Expensive',
    unknown: 'Unknown',
};

const strengthLabels: Record<ThesisStrength, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
};

function getThemeV2(theme: ResearchTheme) {
    if (theme === 'light') {
        return {
            page: 'bg-[#f8fafc] text-slate-950 selection:bg-emerald-200 selection:text-slate-950 transition-colors duration-300',
            panel: 'border-slate-200/80 bg-white/75 backdrop-blur-md shadow-[0_18px_45px_rgba(15,23,42,0.05)] rounded-3xl border transition-all duration-300 hover:shadow-[0_20px_50px_rgba(15,23,42,0.08)]',
            panelSoft: 'border-slate-200 bg-slate-50/50 backdrop-blur-md rounded-2xl border transition-all duration-300',
            panelMuted: 'border-slate-100 bg-slate-100/50 backdrop-blur-md rounded-2xl border transition-all duration-300',
            tableHead: 'bg-slate-100/70 text-slate-600',
            row: 'bg-transparent hover:bg-slate-500/5 transition-colors duration-200 cursor-pointer',
            selectedRow: 'border-l-4 border-emerald-600 bg-emerald-50/70 shadow-sm transition-all duration-300 cursor-pointer',
            divide: 'divide-slate-200/80',
            textPrimary: 'text-slate-950 transition-colors duration-300',
            textSecondary: 'text-slate-700 transition-colors duration-300',
            textMuted: 'text-slate-500 transition-colors duration-300',
            textSubtle: 'text-slate-600 transition-colors duration-300',
            divider: 'border-slate-200/85',
            input: 'border-slate-300 bg-white text-slate-950 rounded-xl px-3 py-2 transition-all duration-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none',
            button: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition-all duration-200 active:scale-95 duration-100',
            buttonActive: 'border-emerald-700 bg-emerald-900 text-white transition-all duration-200 active:scale-95 duration-100',
        };
    }

    return {
        page: 'bg-[#0b1118] text-[#eef2f7] selection:bg-emerald-300 selection:text-slate-950 transition-colors duration-300',
        panel: 'border-[#2a3948] bg-[#111a23]/70 backdrop-blur-md shadow-[0_18px_45px_rgba(0,0,0,0.22)] rounded-3xl border transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)]',
        panelSoft: 'border-[#2a3948] bg-[#16202a]/60 backdrop-blur-md rounded-2xl border transition-all duration-300',
        panelMuted: 'border-[#263442] bg-[#0f1720]/60 backdrop-blur-md rounded-2xl border transition-all duration-300',
        tableHead: 'bg-[#17212c]/80 text-[#9aa8b8]',
        row: 'bg-transparent hover:bg-slate-500/5 transition-colors duration-200 cursor-pointer',
        selectedRow: 'border-l-4 border-emerald-400 bg-emerald-400/8 shadow-[inset_0_1px_0_rgba(167,243,208,0.06)] transition-all duration-300 cursor-pointer',
        divide: 'divide-[#263442]/80',
        textPrimary: 'text-[#eef2f7] transition-colors duration-300',
        textSecondary: 'text-[#c8d2dd] transition-colors duration-300',
        textMuted: 'text-[#9aa8b8] transition-colors duration-300',
        textSubtle: 'text-[#a8b4c2] transition-colors duration-300',
        divider: 'border-[#263442]/85',
        input: 'border-[#2a3948] bg-[#0f1720]/80 text-[#eef2f7] rounded-xl px-3 py-2 transition-all duration-300 focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none',
        button: 'border-[#2a3948] bg-[#111a23] text-[#c8d2dd] hover:bg-[#16202a] transition-all duration-200 active:scale-95 duration-100',
        buttonActive: 'border-emerald-300 bg-emerald-300 text-slate-950 transition-all duration-200 active:scale-95 duration-100',
    };
}

export function getReadiness(checklist: InvestmentChecklist): ReadinessState {
    const trueCount = Object.values(checklist).filter(Boolean).length;

    if (!checklist.downsideAcceptable) return 'Avoid';
    if (!checklist.debtManageable && !checklist.freeCashFlowPositiveOrImproving) return 'Avoid';

    if (!checklist.understandBusiness) return 'Too uncertain';
    if (trueCount <= 5) return 'Too uncertain';

    if (!checklist.valuationReasonable && trueCount >= 6) return 'Wait for better price';

    if (
        trueCount >= 8 &&
        checklist.valuationReasonable &&
        checklist.downsideAcceptable &&
        checklist.betterThanCashOrIndex
    ) {
        return 'Ready';
    }

    return 'Too uncertain';
}

export const formatCurrency = (value: number | undefined, market: Market) => {
    if (value === undefined) return 'Unknown';

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: market === 'MY' ? 'MYR' : 'USD',
        maximumFractionDigits: value >= 100 ? 0 : 2,
    }).format(value);
};

export const formatPercent = (value: number | undefined) => {
    if (value === undefined) return 'Unknown';
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
};

export const getChecklistCount = (checklist: InvestmentChecklist) => Object.values(checklist).filter(Boolean).length;

const detailRows = (item: ResearchWatchlistItem): KeyValueRow[] => [
    ['Sector', item.sector],
    ['Industry', item.industry],
    ['Market cap', item.marketCap],
    ['Revenue growth', item.revenueGrowth],
    ['Gross margin', item.grossMargin],
    ['Operating margin', item.operatingMargin],
    ['Free cash flow', item.freeCashFlowTrend],
    ['Debt level', item.debtLevel],
    ['Cash position', item.cashPosition],
    ['Share count', item.shareCountTrend],
];

const thesisRows = (item: ResearchWatchlistItem): KeyValueRow[] => [
    ['Why interested', item.whyInterested],
    ['Bull case', item.bullCase],
    ['Bear case', item.bearCase],
    ['Buy trigger', item.buyTrigger],
    ['Sell or avoid trigger', item.sellTrigger],
    ['Invalidation', item.thesisBreak],
];

const valuationRows = (item: ResearchWatchlistItem): KeyValueRow[] => [
    ['P/E', item.valuation.pe],
    ['Forward P/E', item.valuation.forwardPe],
    ['Price/sales', item.valuation.priceSales],
    ['EV/EBITDA', item.valuation.evEbitda],
    ['FCF yield', item.valuation.fcfYield],
    ['Dividend yield', item.valuation.dividendYield],
    ['5-year range', item.valuation.fiveYearRange],
    ['Peer comparison', item.valuation.peerNote],
];

const eventRows = (item: ResearchWatchlistItem): KeyValueRow[] => [
    ['Next earnings', item.event.nextEarnings],
    ['Last earnings', item.event.lastEarnings],
    ['Revenue result', item.event.revenueResult],
    ['EPS result', item.event.epsResult],
    ['Guidance change', item.event.guidance],
    ['Event notes', item.event.note],
];

const technicalRows = (item: ResearchWatchlistItem): KeyValueRow[] => [
    ['Price vs 50-day', item.technical.ma50],
    ['Price vs 200-day', item.technical.ma200],
    ['52-week range', item.technical.range52Week],
    ['RSI', item.technical.rsi],
    ['MACD direction', item.technical.macd],
    ['Volume trend', item.technical.volume],
    ['Support / resistance', item.technical.supportResistance],
];

const ResearchPageShell = ({ theme, children }: { theme: ResearchTheme; children: React.ReactNode }) => {
    const isLight = theme === 'light';
    const mainClass = isLight
        ? 'research-page relative min-h-screen overflow-x-hidden bg-[#f8fafc] text-slate-950 selection:bg-emerald-200 selection:text-slate-950 transition-colors duration-300'
        : 'research-page relative min-h-screen overflow-x-hidden bg-[#0b1118] text-slate-100 selection:bg-emerald-300 selection:text-slate-950 transition-colors duration-300';
    const orbClass = isLight
        ? 'absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.11),_transparent_28%),radial-gradient(circle_at_80%_10%,_rgba(14,165,233,0.08),_transparent_20%)] transition-opacity duration-300'
        : 'absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_24%),radial-gradient(circle_at_80%_10%,_rgba(52,211,153,0.1),_transparent_18%)] transition-opacity duration-300';
    const gridClass = isLight
        ? 'absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.06)_1px,transparent_1px)] bg-[size:44px_44px] opacity-45 transition-opacity duration-300'
        : 'absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.035)_1px,transparent_1px)] bg-[size:44px_44px] opacity-55 transition-opacity duration-300';
    const topLineClass = isLight
        ? 'absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/60 to-transparent'
        : 'absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent';

    return (
        <main className={mainClass}>
            <div className={orbClass} />
            <div className={gridClass} />
            <div className={topLineClass} />
            <div className="relative z-10">{children}</div>
        </main>
    );
};

const ChecklistIcon = ({ checked }: { checked: boolean }) => {
    if (checked) {
        return (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-slate-950 transition-all duration-300 hover:scale-110 shadow-[0_0_8px_rgba(16,185,129,0.4)]">
                <svg className="h-3 w-3 stroke-[3.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
            </span>
        );
    }
    return (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-400 bg-transparent text-slate-400 dark:border-slate-600 dark:text-slate-500 transition-all duration-300">
            <svg className="h-3 w-3 stroke-[3.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
            </svg>
        </span>
    );
};

export const ResearchDashboardV2 = () => {
    const [selectedSymbol, setSelectedSymbol] = useState(watchlist[0].symbol);
    const [theme, setTheme] = useState<ResearchTheme>('dark');
    const [isThemeLoaded, setIsThemeLoaded] = useState(false);
    const selected = watchlist.find((item) => item.symbol === selectedSymbol) ?? watchlist[0];
    const themeClasses = getThemeV2(theme);
    const readinessBySymbol = new Map(watchlist.map((item) => [item.symbol, getReadiness(item.checklist)]));
    const readyCount = watchlist.filter((item) => readinessBySymbol.get(item.symbol) === 'Ready').length;
    const waitingCount = watchlist.filter((item) => item.status === 'waiting').length;
    const unknownCount = watchlist.filter((item) => item.valuationState === 'unknown').length;

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
            if (storedTheme === 'light' || storedTheme === 'dark') {
                setTheme(storedTheme);
            }
            setIsThemeLoaded(true);
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, []);

    useEffect(() => {
        if (!isThemeLoaded) return;
        document.documentElement.setAttribute('data-cockpit-theme', theme);
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }, [isThemeLoaded, theme]);

    return (
        <ResearchPageShell theme={theme}>
            <AppNav active="research" tone={theme} isV2={true} />

            <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8 relative">
                <header className={`flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between transition-all duration-300 ${themeClasses.divider}`}>
                    <div className="min-w-0">
                        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-500 animate-pulse">Research workspace V2</div>
                        <h1 className={`mt-2 text-3xl font-bold tracking-normal sm:text-4xl transition-all duration-300 ${themeClasses.textPrimary}`}>Investment Research</h1>
                        <div className={`mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold transition-all ${themeClasses.textMuted}`}>
                            <span>Primary provider: EODHD</span>
                            <span>Fallback: Twelve Data</span>
                            <span>{unknownCount} unknown valuation states</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-sm">
                        <SummaryMetric label="Tickers" value={watchlist.length.toString()} themeClasses={themeClasses} />
                        <SummaryMetric label="Ready" value={readyCount.toString()} themeClasses={themeClasses} />
                        <ThemeModeSwitchV2
                            theme={theme}
                            tone={theme}
                            onToggle={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
                            className="min-h-[70px]"
                        />
                    </div>
                </header>

                <div className="mt-6 grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
                    <WatchlistPanel
                        items={watchlist}
                        selectedSymbol={selected.symbol}
                        readinessBySymbol={readinessBySymbol}
                        waitingCount={waitingCount}
                        theme={theme}
                        themeClasses={themeClasses}
                        onSelect={setSelectedSymbol}
                    />

                    <DecisionPanel selected={selected} theme={theme} themeClasses={themeClasses} />
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                    <SectionPanel title="Thesis Card" eyebrow="Investment reason" themeClasses={themeClasses}>
                        <KeyValueList rows={thesisRows(selected)} themeClasses={themeClasses} />
                    </SectionPanel>

                    <ChecklistPanel selected={selected} themeClasses={themeClasses} />
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
                    <SectionPanel title="Company Snapshot" eyebrow={selected.providerSymbol} themeClasses={themeClasses}>
                        <p className={`mb-4 text-sm leading-6 transition-all ${themeClasses.textSecondary}`}>{selected.description}</p>
                        <KeyValueList rows={detailRows(selected)} themeClasses={themeClasses} />
                    </SectionPanel>

                    <SectionPanel title="Valuation Snapshot" eyebrow={valuationLabels[selected.valuationState]} themeClasses={themeClasses}>
                        <KeyValueList rows={valuationRows(selected)} themeClasses={themeClasses} />
                    </SectionPanel>

                    <SectionPanel title="Earnings And Events" eyebrow="Company-specific" themeClasses={themeClasses}>
                        <KeyValueList rows={eventRows(selected)} themeClasses={themeClasses} />
                    </SectionPanel>

                    <SectionPanel title="Research Feed" eyebrow="News, filings, transcripts" themeClasses={themeClasses}>
                        <div className="space-y-4">
                            {selected.feed.map((feedItem) => (
                                <article key={`${selected.symbol}-${feedItem.title}`} className={`border-b pb-4 last:border-0 last:pb-0 transition-all ${themeClasses.divider}`}>
                                    <div className={`text-sm font-bold leading-6 transition-all duration-300 ${themeClasses.textPrimary}`}>{feedItem.title}</div>
                                    <div className={`mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold transition-all ${themeClasses.textMuted}`}>
                                        <span>{feedItem.source}</span>
                                        <span>{feedItem.date}</span>
                                        <Pill tone="neutral" theme={theme}>{feedItem.label}</Pill>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </SectionPanel>

                    <SectionPanel title="Technical Context" eyebrow="Secondary input" themeClasses={themeClasses}>
                        <KeyValueList rows={technicalRows(selected)} themeClasses={themeClasses} />
                    </SectionPanel>
                </div>
            </div>
        </ResearchPageShell>
    );
};

const WatchlistPanel = ({
    items,
    selectedSymbol,
    readinessBySymbol,
    waitingCount,
    theme,
    themeClasses,
    onSelect,
}: {
    items: ResearchWatchlistItem[];
    selectedSymbol: string;
    readinessBySymbol: Map<string, ReadinessState>;
    waitingCount: number;
    theme: ResearchTheme;
    themeClasses: ReturnType<typeof getThemeV2>;
    onSelect: (symbol: string) => void;
}) => (
    <section className={`min-w-0 ${themeClasses.panel}`}>
        <div className={`flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between transition-all ${themeClasses.divider}`}>
            <div>
                <h2 className={`text-base font-bold transition-all ${themeClasses.textPrimary}`}>Watchlist Overview</h2>
                <p className={`text-sm transition-all ${themeClasses.textMuted}`}>Sample data until provider integration.</p>
            </div>
            <div className={`text-sm font-semibold transition-all ${themeClasses.textMuted}`}>{waitingCount} waiting for price</div>
        </div>

        <DesktopWatchlistTable
            items={items}
            selectedSymbol={selectedSymbol}
            readinessBySymbol={readinessBySymbol}
            theme={theme}
            themeClasses={themeClasses}
            onSelect={onSelect}
        />
        <TabletWatchlistTable
            items={items}
            selectedSymbol={selectedSymbol}
            readinessBySymbol={readinessBySymbol}
            theme={theme}
            themeClasses={themeClasses}
            onSelect={onSelect}
        />
        <MobileWatchlistCards
            items={items}
            selectedSymbol={selectedSymbol}
            readinessBySymbol={readinessBySymbol}
            theme={theme}
            themeClasses={themeClasses}
            onSelect={onSelect}
        />
    </section>
);

const DesktopWatchlistTable = ({
    items,
    selectedSymbol,
    readinessBySymbol,
    theme,
    themeClasses,
    onSelect,
}: {
    items: ResearchWatchlistItem[];
    selectedSymbol: string;
    readinessBySymbol: Map<string, ReadinessState>;
    theme: ResearchTheme;
    themeClasses: ReturnType<typeof getThemeV2>;
    onSelect: (symbol: string) => void;
}) => (
    <div className="hidden overflow-hidden lg:block">
        <table className="w-full table-fixed border-collapse text-left text-sm">
            <thead className={`text-[11px] font-bold uppercase tracking-[0.14em] transition-all ${themeClasses.tableHead}`}>
                <tr>
                    <th className="w-[11%] px-4 py-3">Symbol</th>
                    <th className="w-[19%] px-4 py-3">Company</th>
                    <th className="w-[10%] px-4 py-3">Price</th>
                    <th className="w-[9%] px-4 py-3">Change</th>
                    <th className="w-[10%] px-4 py-3">Status</th>
                    <th className="w-[14%] px-4 py-3">Buy zone</th>
                    <th className="w-[10%] px-4 py-3">Valuation</th>
                    <th className="w-[8%] px-4 py-3">Thesis</th>
                    <th className="w-[9%] px-4 py-3">Reviewed</th>
                </tr>
            </thead>
            <tbody className={`divide-y transition-all ${themeClasses.divide}`}>
                {items.map((item) => {
                    const isSelected = selectedSymbol === item.symbol;
                    const readiness = readinessBySymbol.get(item.symbol) ?? getReadiness(item.checklist);

                    return (
                        <tr key={item.symbol} className={`${isSelected ? themeClasses.selectedRow : themeClasses.row} group`} onClick={() => onSelect(item.symbol)}>
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                <SymbolButton item={item} selected={isSelected} themeClasses={themeClasses} onSelect={onSelect} />
                            </td>
                            <td className="min-w-0 px-4 py-3">
                                <div className={`truncate font-semibold transition-all ${themeClasses.textPrimary}`}>{item.name}</div>
                                <div className={`text-xs transition-all ${themeClasses.textMuted}`}>{item.market} · {item.providerSymbol}</div>
                            </td>
                            <td className={`px-4 py-3 font-semibold transition-all ${themeClasses.textSecondary}`}>{formatCurrency(item.price, item.market)}</td>
                            <td className={`px-4 py-3 font-semibold transition-all ${getChangeTone(item.dailyChange, theme)}`}>{formatPercent(item.dailyChange)}</td>
                            <td className="px-4 py-3"><Pill tone={item.status} theme={theme}>{statusLabels[item.status]}</Pill></td>
                            <td className={`px-4 py-3 transition-all ${themeClasses.textSecondary}`}>{item.targetBuyZone}</td>
                            <td className="px-4 py-3"><Pill tone={item.valuationState} theme={theme}>{valuationLabels[item.valuationState]}</Pill></td>
                            <td className={`px-4 py-3 transition-all ${themeClasses.textSecondary}`}>{strengthLabels[item.thesisStrength]}</td>
                            <td className={`px-4 py-3 text-xs transition-all ${themeClasses.textMuted}`}>{item.lastReviewedAt}<span className="sr-only"> {readiness}</span></td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </div>
);

const TabletWatchlistTable = ({
    items,
    selectedSymbol,
    readinessBySymbol,
    theme,
    themeClasses,
    onSelect,
}: {
    items: ResearchWatchlistItem[];
    selectedSymbol: string;
    readinessBySymbol: Map<string, ReadinessState>;
    theme: ResearchTheme;
    themeClasses: ReturnType<typeof getThemeV2>;
    onSelect: (symbol: string) => void;
}) => (
    <div className="hidden md:block lg:hidden">
        <table className="w-full table-fixed border-collapse text-left text-sm">
            <thead className={`text-[11px] font-bold uppercase tracking-[0.14em] transition-all ${themeClasses.tableHead}`}>
                <tr>
                    <th className="w-[31%] px-4 py-3">Ticker</th>
                    <th className="w-[17%] px-4 py-3">Price</th>
                    <th className="w-[23%] px-4 py-3">Decision</th>
                    <th className="w-[16%] px-4 py-3">Valuation</th>
                    <th className="w-[13%] px-4 py-3">Reviewed</th>
                </tr>
            </thead>
            <tbody className={`divide-y transition-all ${themeClasses.divide}`}>
                {items.map((item) => {
                    const isSelected = selectedSymbol === item.symbol;
                    const readiness = readinessBySymbol.get(item.symbol) ?? getReadiness(item.checklist);

                    return (
                        <tr key={item.symbol} className={isSelected ? themeClasses.selectedRow : themeClasses.row} onClick={() => onSelect(item.symbol)}>
                            <td className="px-4 py-3">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div onClick={(e) => e.stopPropagation()}>
                                        <SymbolButton item={item} selected={isSelected} themeClasses={themeClasses} onSelect={onSelect} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className={`truncate font-semibold transition-all ${themeClasses.textPrimary}`}>{item.name}</div>
                                        <div className={`text-xs transition-all ${themeClasses.textMuted}`}>{item.market} · {item.providerSymbol}</div>
                                    </div>
                                </div>
                            </td>
                            <td className={`px-4 py-3 transition-all ${themeClasses.textSecondary}`}>
                                <div className="font-semibold">{formatCurrency(item.price, item.market)}</div>
                                <div className={`text-xs font-semibold transition-all ${getChangeTone(item.dailyChange, theme)}`}>{formatPercent(item.dailyChange)}</div>
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1.5">
                                    <Pill tone={readiness} theme={theme}>{readiness}</Pill>
                                    <Pill tone={item.status} theme={theme}>{statusLabels[item.status]}</Pill>
                                </div>
                            </td>
                            <td className="px-4 py-3"><Pill tone={item.valuationState} theme={theme}>{valuationLabels[item.valuationState]}</Pill></td>
                            <td className={`px-4 py-3 text-xs transition-all ${themeClasses.textMuted}`}>{item.lastReviewedAt}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </div>
);

const MobileWatchlistCards = ({
    items,
    selectedSymbol,
    readinessBySymbol,
    theme,
    themeClasses,
    onSelect,
}: {
    items: ResearchWatchlistItem[];
    selectedSymbol: string;
    readinessBySymbol: Map<string, ReadinessState>;
    theme: ResearchTheme;
    themeClasses: ReturnType<typeof getThemeV2>;
    onSelect: (symbol: string) => void;
}) => (
    <div className="grid gap-3 p-3 md:hidden">
        {items.map((item) => {
            const isSelected = selectedSymbol === item.symbol;
            const readiness = readinessBySymbol.get(item.symbol) ?? getReadiness(item.checklist);

            return (
                <button
                    key={item.symbol}
                    type="button"
                    onClick={() => onSelect(item.symbol)}
                    aria-pressed={isSelected}
                    className={`min-w-0 rounded-lg border p-3 text-left transition duration-200 active:scale-[0.98] ${isSelected ? themeClasses.selectedRow : `${themeClasses.panelSoft} hover:border-[#34d399]/60`}`}
                >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className={`font-mono text-lg font-bold transition-all ${themeClasses.textPrimary}`}>{item.symbol}</div>
                            <div className={`truncate text-sm font-semibold transition-all ${themeClasses.textSecondary}`}>{item.name}</div>
                            <div className={`text-xs transition-all ${themeClasses.textMuted}`}>{item.market} · {item.providerSymbol}</div>
                        </div>
                        <div className="shrink-0 text-right">
                            <div className={`font-semibold transition-all ${themeClasses.textPrimary}`}>{formatCurrency(item.price, item.market)}</div>
                            <div className={`text-xs font-bold transition-all ${getChangeTone(item.dailyChange, theme)}`}>{formatPercent(item.dailyChange)}</div>
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        <Pill tone={readiness} theme={theme}>{readiness}</Pill>
                        <Pill tone={item.status} theme={theme}>{statusLabels[item.status]}</Pill>
                        <Pill tone={item.valuationState} theme={theme}>{valuationLabels[item.valuationState]}</Pill>
                    </div>
                    <dl className={`mt-3 grid grid-cols-2 gap-2 text-xs transition-all ${themeClasses.textMuted}`}>
                        <InfoPair label="Thesis" value={strengthLabels[item.thesisStrength]} compact />
                        <InfoPair label="Reviewed" value={item.lastReviewedAt} compact />
                    </dl>
                    {isSelected && (
                        <div className={`mt-3 border-t pt-3 text-sm leading-6 transition-all ${themeClasses.divider} ${themeClasses.textSecondary}`}>
                            <span className="font-semibold">Buy zone: </span>{item.targetBuyZone}
                        </div>
                    )}
                </button>
            );
        })}
    </div>
);

const DecisionPanel = ({ selected, theme, themeClasses }: { selected: ResearchWatchlistItem; theme: ResearchTheme; themeClasses: ReturnType<typeof getThemeV2> }) => {
    const readiness = getReadiness(selected.checklist);
    const checklistCount = getChecklistCount(selected.checklist);

    return (
        <section className={`min-w-0 transition-all ${themeClasses.panel} p-5`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className={`text-[11px] font-bold uppercase tracking-[0.18em] transition-all ${themeClasses.textMuted}`}>Selected ticker</div>
                    <div className={`mt-3 font-mono text-3xl font-bold tracking-normal transition-all ${themeClasses.textPrimary}`}>{selected.symbol}</div>
                    <div className={`mt-1 text-base font-semibold transition-all ${themeClasses.textSecondary}`}>{selected.name}</div>
                    <div className={`mt-1 text-xs font-semibold transition-all ${themeClasses.textMuted}`}>{selected.providerSymbol}</div>
                </div>
                <div className="text-right">
                    <div className={`text-2xl font-bold tracking-normal transition-all ${themeClasses.textPrimary}`}>{formatCurrency(selected.price, selected.market)}</div>
                    <div className={`text-sm font-bold transition-all ${getChangeTone(selected.dailyChange, theme)}`}>{formatPercent(selected.dailyChange)}</div>
                </div>
            </div>

            <div className={`mt-5 border-t pt-4 transition-all ${themeClasses.divider}`}>
                <div className={`text-sm font-bold uppercase tracking-[0.14em] transition-all ${themeClasses.textMuted}`}>Research readiness</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <ReadinessBadge readiness={readiness} theme={theme} />
                    <span className={`text-sm font-semibold transition-all ${themeClasses.textMuted}`}>{checklistCount} of {checklistItems.length} checks</span>
                </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <InfoPair label="Target buy zone" value={selected.targetBuyZone} />
                <InfoPair label="Valuation" value={valuationLabels[selected.valuationState]} />
                <InfoPair label="Thesis strength" value={strengthLabels[selected.thesisStrength]} />
                <InfoPair label="Last reviewed" value={selected.lastReviewedAt} />
            </dl>

            <div className={`mt-4 transition-all ${themeClasses.panelMuted} p-4`}>
                <div className={`text-[11px] font-bold uppercase tracking-[0.16em] transition-all ${themeClasses.textMuted}`}>Thesis focus</div>
                <p className={`mt-2 text-sm leading-6 transition-all ${themeClasses.textSecondary}`}>{selected.whyInterested}</p>
                <p className={`mt-2 text-sm leading-6 transition-all ${themeClasses.textMuted}`}>{selected.thesisBreak}</p>
            </div>
        </section>
    );
};

const ChecklistPanel = ({ selected, themeClasses }: { selected: ResearchWatchlistItem; themeClasses: ReturnType<typeof getThemeV2> }) => {
    const readiness = getReadiness(selected.checklist);
    const checklistCount = getChecklistCount(selected.checklist);

    return (
        <section className={`transition-all ${themeClasses.panel} p-5`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-500">Investment Checklist</div>
                    <h2 className={`mt-1 text-xl font-bold tracking-normal transition-all ${themeClasses.textPrimary}`}>{readiness}</h2>
                </div>
                <div className={`text-sm font-semibold transition-all ${themeClasses.textMuted}`}>{checklistCount} of {checklistItems.length} checks marked</div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
                {checklistItems.map((item) => {
                    const checked = selected.checklist[item.key];

                    return (
                        <div key={`${selected.symbol}-${item.key}`} className={`flex min-h-12 items-center gap-3 transition-all ${themeClasses.panelMuted} px-4 py-3`}>
                            <ChecklistIcon checked={checked} />
                            <span className={`text-sm font-semibold leading-5 transition-all ${themeClasses.textSecondary}`}>{item.label}</span>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

const SummaryMetric = ({ label, value, themeClasses }: { label: string; value: string; themeClasses: ReturnType<typeof getThemeV2> }) => (
    <div className={`transition-all ${themeClasses.panel} px-4 py-3 text-right`}>
        <div className={`text-[11px] font-bold uppercase tracking-[0.16em] transition-all ${themeClasses.textMuted}`}>{label}</div>
        <div className={`mt-1 text-2xl font-bold tracking-normal transition-all ${themeClasses.textPrimary}`}>{value}</div>
    </div>
);

const SymbolButton = ({ item, selected, themeClasses, onSelect }: { item: ResearchWatchlistItem; selected: boolean; themeClasses: ReturnType<typeof getThemeV2>; onSelect: (symbol: string) => void }) => (
    <button
        type="button"
        onClick={() => onSelect(item.symbol)}
        aria-pressed={selected}
        className={`rounded-md px-2 py-1 font-mono text-sm font-bold shadow-sm transition-all duration-200 active:scale-95 hover:shadow-md ${selected ? themeClasses.buttonActive : themeClasses.button}`}
    >
        {item.symbol}
    </button>
);

const SectionPanel = ({ title, eyebrow, children, themeClasses }: { title: string; eyebrow: string; children: ReactNode; themeClasses: ReturnType<typeof getThemeV2> }) => (
    <section className={`transition-all ${themeClasses.panel} p-5`}>
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-500">{eyebrow}</div>
        <h2 className={`mt-1 text-xl font-bold tracking-normal transition-all ${themeClasses.textPrimary}`}>{title}</h2>
        <div className="mt-4">{children}</div>
    </section>
);

const KeyValueList = ({ rows, themeClasses }: { rows: KeyValueRow[]; themeClasses: ReturnType<typeof getThemeV2> }) => (
    <dl className={`divide-y transition-all ${themeClasses.divide}`}>
        {rows.map(([label, value]) => (
            <div key={label} className="grid gap-2 py-2 text-sm sm:grid-cols-[150px_minmax(0,1fr)]">
                <dt className={`font-semibold transition-all ${themeClasses.textMuted}`}>{label}</dt>
                <dd className={`min-w-0 break-words leading-6 transition-all ${themeClasses.textSecondary}`}>{value || 'Unknown'}</dd>
            </div>
        ))}
    </dl>
);

const InfoPair = ({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) => (
    <div>
        <dt className={`${compact ? 'text-[10px]' : 'text-xs'} font-bold uppercase tracking-[0.14em] opacity-65`}>{label}</dt>
        <dd className="mt-1 break-words font-semibold">{value}</dd>
    </div>
);

const ReadinessBadge = ({ readiness, theme }: { readiness: ReadinessState; theme: ResearchTheme }) => (
    <span className={`inline-flex rounded-md border px-2.5 py-1 text-sm font-bold transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] ${getToneClass(readiness, theme)}`}>
        {readiness}
    </span>
);

const Pill = ({ children, tone, theme }: { children: ReactNode; tone: ResearchStatus | ValuationState | ReadinessState | 'neutral'; theme: ResearchTheme }) => (
    <span className={`inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-xs font-bold transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] ${getToneClass(tone, theme)}`}>
        {children}
    </span>
);

function getToneClass(tone: ResearchStatus | ValuationState | ReadinessState | 'neutral', theme: ResearchTheme) {
    const light: Record<string, string> = {
        owned: 'border-emerald-300 bg-emerald-50 text-emerald-800',
        watch: 'border-sky-300 bg-sky-50 text-sky-800',
        waiting: 'border-amber-300 bg-amber-50 text-amber-800',
        avoid: 'border-rose-300 bg-rose-50 text-rose-800',
        cheap: 'border-emerald-300 bg-emerald-50 text-emerald-800',
        fair: 'border-slate-350 bg-slate-100 text-slate-700',
        expensive: 'border-amber-300 bg-amber-50 text-amber-800',
        unknown: 'border-zinc-300 bg-zinc-100 text-zinc-700',
        Ready: 'border-emerald-300 bg-emerald-50 text-emerald-800',
        'Wait for better price': 'border-amber-300 bg-amber-50 text-amber-800',
        'Too uncertain': 'border-slate-300 bg-slate-100 text-slate-700',
        Avoid: 'border-rose-300 bg-rose-50 text-rose-800',
        neutral: 'border-slate-300 bg-slate-100 text-slate-700',
    };
    const dark: Record<string, string> = {
        owned: 'border-emerald-400/50 bg-emerald-400/12 text-emerald-200',
        watch: 'border-sky-400/50 bg-sky-400/12 text-sky-200',
        waiting: 'border-amber-400/50 bg-amber-400/12 text-amber-200',
        avoid: 'border-rose-400/50 bg-rose-400/12 text-rose-200',
        cheap: 'border-emerald-400/50 bg-emerald-400/12 text-emerald-200',
        fair: 'border-[#3a4a58] bg-[#17212c] text-[#c8d2dd]',
        expensive: 'border-amber-400/50 bg-amber-400/12 text-amber-200',
        unknown: 'border-[#3a4a58] bg-[#17212c] text-[#9aa8b8]',
        Ready: 'border-emerald-400/50 bg-emerald-400/12 text-emerald-200',
        'Wait for better price': 'border-amber-400/50 bg-amber-400/12 text-amber-200',
        'Too uncertain': 'border-[#3a4a58] bg-[#17212c] text-[#c8d2dd]',
        Avoid: 'border-rose-400/50 bg-rose-400/12 text-rose-200',
        neutral: 'border-[#3a4a58] bg-[#17212c] text-[#c8d2dd]',
    };

    return theme === 'light' ? light[tone] : dark[tone];
}

function getChangeTone(value: number | undefined, theme: ResearchTheme) {
    if (value === undefined || value === 0) {
        return theme === 'light' ? 'text-slate-500' : 'text-[#9aa8b8]';
    }

    return value > 0
        ? theme === 'light' ? 'text-emerald-700' : 'text-emerald-300'
        : theme === 'light' ? 'text-rose-700' : 'text-rose-300';
}
