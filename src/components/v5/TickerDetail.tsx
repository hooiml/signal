'use client';

import { useState } from 'react';
import type { ResearchWatchlistItem } from '../research/ResearchDashboardV2';
import { ActionPillV5, type ActionLabel } from './v5-shared';

interface TickerDetailProps {
    ticker: ResearchWatchlistItem;
    actionLabel: ActionLabel;
}

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

const checklistKeys: ChecklistKey[] = [
    'understandBusiness',
    'revenueGrowingOrStable',
    'marginsHealthyOrImproving',
    'debtManageable',
    'freeCashFlowPositiveOrImproving',
    'valuationReasonable',
    'catalystOrCompoundingReason',
    'downsideAcceptable',
    'betterThanCashOrIndex',
];

const checklistLabels: Record<ChecklistKey, string> = {
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

const actionThemeV5: Record<ActionLabel, { rail: string; soft: string; text: string; border: string }> = {
    Ready: { rail: 'bg-[#17745a]', soft: 'bg-[#e8f3ef]', text: 'text-[#17745a]', border: 'border-[#17745a]/20' },
    DCA: { rail: 'bg-[#2f62d5]', soft: 'bg-[#edf2ff]', text: 'text-[#2f62d5]', border: 'border-[#2f62d5]/20' },
    Wait: { rail: 'bg-[#b86e00]', soft: 'bg-[#fff7e8]', text: 'text-[#b86e00]', border: 'border-[#b86e00]/20' },
    Watch: { rail: 'bg-zinc-500', soft: 'bg-zinc-100', text: 'text-zinc-700', border: 'border-zinc-200' },
    Avoid: { rail: 'bg-[#c73c35]', soft: 'bg-[#fff0ef]', text: 'text-[#c73c35]', border: 'border-[#c73c35]/20' },
};

type ActiveTab = 'decision' | 'fundamentals' | 'checklist' | 'events' | 'technical';

export const TickerDetail = ({ ticker, actionLabel }: TickerDetailProps) => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('decision');

    const checkedCount = checklistKeys.filter((k) => ticker.checklist[k]).length;

    const tabs: Array<{ id: ActiveTab; label: string }> = [
        { id: 'decision', label: 'Decision' },
        { id: 'fundamentals', label: 'Fundamentals' },
        { id: 'checklist', label: 'Checklist' },
        { id: 'events', label: 'Events' },
        { id: 'technical', label: 'Technical' },
    ];

    const changePct = ticker.dailyChange ?? 0;
    const isChangePos = changePct >= 0;
    const actionTheme = actionThemeV5[actionLabel];
    const confidencePercent = ticker.thesisStrength === 'high' ? 88 : ticker.thesisStrength === 'medium' ? 62 : 30;

    // 1. Hero Decision Sentence
    const decisionSentence = (() => {
        if (actionLabel === 'Ready') {
            return 'Price and quality checks are aligned for review';
        }
        if (actionLabel === 'Wait') {
            return 'Good business, but the price is not attractive yet';
        }
        if (actionLabel === 'Avoid') {
            if (ticker.thesisStrength === 'low') {
                return 'Thesis strength is weak; exit or avoid new positions';
            }
            return 'Avoid due to valuation or downside risk constraints';
        }
        if (actionLabel === 'DCA') {
            return 'Owned position still meets the quality and valuation rules';
        }
        return 'Worth following, but evidence is incomplete';
    })();

    // 2. Next Action logic
    const nextActionText = (() => {
        if (actionLabel === 'Ready') {
            return `Review for entry. Buy trigger: ${ticker.buyTrigger}`;
        }
        if (actionLabel === 'DCA') {
            return `Hold the position. ${ticker.buyTrigger}`;
        }
        if (actionLabel === 'Wait' || actionLabel === 'Watch') {
            return `Wait for buy zone of ${ticker.targetBuyZone}. Buy trigger: ${ticker.buyTrigger}`;
        }
        return `Thesis broken or high risk. Avoid purchases. Exit trigger: ${ticker.sellTrigger} Warning trigger: ${ticker.thesisBreak}`;
    })();

    return (
        <div className="flex flex-grow select-none flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
            {/* High-contrast company identity */}
            <div className="relative overflow-hidden bg-[#151916] p-5 text-white md:p-6">
                <div className={`absolute inset-y-0 left-0 w-1.5 ${actionTheme.rail}`} aria-hidden="true" />
                <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.65)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.65)_1px,transparent_1px)] [background-size:28px_28px]" aria-hidden="true" />
                <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-[#b8f14b] font-mono text-lg font-black text-[#151916]">
                            {ticker.symbol.slice(0, 2)}
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-3">
                                <h2 className="text-3xl font-black leading-none tracking-tight text-white">{ticker.symbol}</h2>
                                <ActionPillV5 label={actionLabel} large={true} />
                            </div>
                            <p className="mt-1.5 text-sm font-semibold text-zinc-300">{ticker.name}</p>
                            <p className="mt-1 text-[10px] text-zinc-500">{ticker.sector} / {ticker.industry}</p>
                        </div>
                    </div>
                    <div className="text-left sm:text-right">
                        <span className="font-mono text-[9px] uppercase text-zinc-500">Live reference price</span>
                        <div className="mt-1 font-mono text-3xl font-black leading-none text-white">{ticker.price ? `$${ticker.price.toFixed(2)}` : 'N/A'}</div>
                        <div className={`mt-2 font-mono text-xs font-bold ${isChangePos ? 'text-[#8fe3c2]' : 'text-[#ff8c84]'}`}>
                            {isChangePos ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}% today
                        </div>
                    </div>
                </div>
            </div>

            {/* Dossier Tabs Navigation */}
            <div className="relative border-b border-zinc-200 bg-white">
                <div className="overflow-x-auto flex px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <nav className="flex space-x-6 h-11 shrink-0" aria-label="Ticker tabs">
                        {tabs.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setActiveTab(t.id)}
                                className={`h-full border-b-2 px-1 text-xs font-semibold uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17745a] focus-visible:ring-offset-2 ${
                                    activeTab === t.id
                                        ? 'border-[#17745a] text-[#17745a]'
                                        : 'border-transparent text-zinc-600 hover:text-zinc-900'
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Tab content panel */}
            <div className="p-5 md:p-6 flex-grow bg-white">
                
                {/* TAB 1: DECISION (The 5-Second First-Look View) */}
                {activeTab === 'decision' && (
                    <div className="max-w-5xl space-y-5 font-sans ">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_230px]">
                            <div className={`relative overflow-hidden rounded-lg border p-5 md:p-7 ${actionTheme.soft} ${actionTheme.border}`}>
                                <div className={`absolute inset-y-0 left-0 w-1.5 ${actionTheme.rail}`} aria-hidden="true" />
                                <span className={`font-mono text-[10px] font-bold uppercase ${actionTheme.text}`}>Investment decision</span>
                                <p className="mt-4 max-w-3xl text-2xl font-black leading-tight text-[#17201d] md:text-3xl">{decisionSentence}</p>
                                <div className="mt-6 border-t border-black/10 pt-4">
                                    <span className="block font-mono text-[9px] font-bold uppercase text-zinc-400">Next move</span>
                                    <p className="mt-1.5 text-sm font-bold leading-relaxed text-zinc-900 md:text-base">{nextActionText}</p>
                                </div>
                            </div>

                            <aside className="flex flex-col justify-between rounded-lg bg-[#151916] p-5 text-white">
                                <div>
                                    <span className="font-mono text-[9px] uppercase text-zinc-500">Action state</span>
                                    <strong className={`mt-2 block text-4xl font-black uppercase leading-none ${actionLabel === 'Ready' ? 'text-[#8fe3c2]' : actionLabel === 'DCA' ? 'text-[#8facff]' : actionLabel === 'Wait' ? 'text-[#f4b84d]' : actionLabel === 'Avoid' ? 'text-[#ff8c84]' : 'text-zinc-200'}`}>{actionLabel}</strong>
                                </div>
                                <div className="mt-8">
                                    <div className="flex items-end justify-between gap-3">
                                        <span className="font-mono text-[9px] uppercase text-zinc-500">Confidence</span>
                                        <strong className="font-mono text-xl">{confidencePercent}%</strong>
                                    </div>
                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                                        <div className={`h-full rounded-full ${actionTheme.rail}`} style={{ width: `${confidencePercent}%` }} />
                                    </div>
                                    <p className="mt-3 text-[10px] capitalize text-zinc-500">{ticker.thesisStrength} thesis strength</p>
                                </div>
                            </aside>
                        </div>

                        <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-zinc-200 bg-white text-xs sm:grid-cols-3">
                            <div className="border-b border-zinc-200 p-4 sm:border-b-0 sm:border-r">
                                <span className="font-mono text-[9px] uppercase text-zinc-400">Price location</span>
                                <div className="mt-2 flex items-center gap-2">
                                    <span className={`h-2 w-2 rounded-full ${ticker.inBuyZone ? 'bg-[#17745a]' : 'bg-[#b86e00]'}`} />
                                    <strong>{ticker.inBuyZone ? 'In Buy Zone' : 'Outside Buy Zone'}</strong>
                                </div>
                                <span className="mt-1 block font-mono text-zinc-500">{ticker.targetBuyZone}</span>
                            </div>
                            <div className="border-b border-zinc-200 p-4 sm:border-b-0 sm:border-r">
                                <span className="font-mono text-[9px] uppercase text-zinc-400">Valuation</span>
                                <strong className="mt-2 block uppercase text-zinc-900">{ticker.valuationState}</strong>
                                <span className="mt-1 block text-zinc-500">Current pricing condition</span>
                            </div>
                            <div className="p-4">
                                <span className="font-mono text-[9px] uppercase text-zinc-400">Quality gate</span>
                                <strong className="mt-2 block text-zinc-900">{checkedCount}/{checklistKeys.length} checks passed</strong>
                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                                    <div className="h-full rounded-full bg-[#17745a]" style={{ width: `${(checkedCount / checklistKeys.length) * 100}%` }} />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="relative overflow-hidden rounded-lg border border-[#17745a]/15 bg-[#f2f8f5] p-5">
                                <span className="absolute inset-y-0 left-0 w-1 bg-[#17745a]" />
                                <h4 className="text-xs font-black uppercase text-[#17745a]">Why it may work</h4>
                                <div className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-700">
                                    <p><strong>Rationale:</strong> {ticker.whyInterested}</p>
                                    <p><strong>Bull case:</strong> {ticker.bullCase}</p>
                                </div>
                            </div>
                            <div className="relative overflow-hidden rounded-lg border border-[#c73c35]/15 bg-[#fff5f4] p-5">
                                <span className="absolute inset-y-0 left-0 w-1 bg-[#c73c35]" />
                                <h4 className="text-xs font-black uppercase text-[#c73c35]">Main risk</h4>
                                <div className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-700">
                                    <p><strong>Thesis break:</strong> {ticker.thesisBreak}</p>
                                    <p><strong>Bear case:</strong> {ticker.bearCase}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 2: FUNDAMENTALS */}
                {activeTab === 'fundamentals' && (
                    <div className="space-y-6  max-w-4xl text-xs">
                        {/* Business description */}
                        <div className="space-y-1">
                            <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">Business Description</span>
                            <p className="text-zinc-700 text-xs leading-relaxed font-sans">{ticker.description}</p>
                        </div>

                        {/* Financial Snapshot */}
                        <div className="space-y-3 pt-4 border-t border-zinc-200">
                            <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">Financial Snapshot</span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono bg-zinc-50/50 p-4 border border-zinc-200 rounded-md">
                                <div>
                                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Market Cap</span>
                                    <span className="text-zinc-900 font-bold">{ticker.marketCap}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Revenue Growth</span>
                                    <span className="text-zinc-900 font-bold">{ticker.revenueGrowth}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Gross Margin</span>
                                    <span className="text-zinc-900 font-bold">{ticker.grossMargin}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Operating Margin</span>
                                    <span className="text-zinc-900 font-bold">{ticker.operatingMargin}</span>
                                </div>
                                <div className="pt-2 border-t border-zinc-200">
                                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">FCF Trend</span>
                                    <span className="text-zinc-900 font-bold">{ticker.freeCashFlowTrend}</span>
                                </div>
                                <div className="pt-2 border-t border-zinc-200">
                                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Debt Level</span>
                                    <span className="text-zinc-900 font-bold">{ticker.debtLevel}</span>
                                </div>
                                <div className="pt-2 border-t border-zinc-200">
                                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Cash Position</span>
                                    <span className="text-zinc-900 font-bold">{ticker.cashPosition}</span>
                                </div>
                                <div className="pt-2 border-t border-zinc-200">
                                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Share Count Trend</span>
                                    <span className="text-zinc-900 font-bold">{ticker.shareCountTrend}</span>
                                </div>
                            </div>
                        </div>

                        {/* Valuation Details */}
                        <div className="space-y-3 pt-4 border-t border-zinc-200 font-mono">
                            <span className="text-[10px] font-sans font-bold text-zinc-400 uppercase tracking-wider block">Valuation Metrics</span>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-0 border border-zinc-200 divide-x divide-y divide-zinc-200 rounded-md overflow-hidden bg-white">
                                <div className="p-3">
                                    <span className="text-[10px] text-zinc-400 uppercase block mb-1 font-sans">P/E Ratio</span>
                                    <span className="text-zinc-900 font-bold text-sm">{ticker.valuation.pe}</span>
                                </div>
                                <div className="p-3">
                                    <span className="text-[10px] text-zinc-400 uppercase block mb-1 font-sans">Forward P/E</span>
                                    <span className="text-zinc-900 font-bold text-sm">{ticker.valuation.forwardPe}</span>
                                </div>
                                <div className="p-3">
                                    <span className="text-[10px] text-zinc-400 uppercase block mb-1 font-sans">Price / Sales</span>
                                    <span className="text-zinc-900 font-bold text-sm">{ticker.valuation.priceSales}</span>
                                </div>
                                <div className="p-3">
                                    <span className="text-[10px] text-zinc-400 uppercase block mb-1 font-sans">EV / EBITDA</span>
                                    <span className="text-zinc-900 font-bold text-sm">{ticker.valuation.evEbitda}</span>
                                </div>
                                <div className="p-3">
                                    <span className="text-[10px] text-zinc-400 uppercase block mb-1 font-sans">FCF Yield</span>
                                    <span className="text-zinc-900 font-bold text-sm">{ticker.valuation.fcfYield}</span>
                                </div>
                                <div className="p-3">
                                    <span className="text-[10px] text-zinc-400 uppercase block mb-1 font-sans">Div Yield</span>
                                    <span className="text-zinc-900 font-bold text-sm">{ticker.valuation.dividendYield}</span>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-zinc-200 font-sans text-xs">
                                <div>
                                    <h4 className="text-xs font-bold text-zinc-500 uppercase">5-Year Valuation Range</h4>
                                    <p className="text-zinc-700 mt-1 leading-relaxed">{ticker.valuation.fiveYearRange}</p>
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-zinc-500 uppercase">Peer Valuation Note</h4>
                                    <p className="text-zinc-700 mt-1 leading-relaxed">{ticker.valuation.peerNote}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 3: CHECKLIST */}
                {activeTab === 'checklist' && (
                    <div className="space-y-4 font-sans text-xs max-w-4xl ">
                        <div className="flex items-center justify-between border-b border-zinc-200 pb-2.5">
                            <span className="font-mono text-zinc-500 uppercase tracking-wider">Quality Criteria Ticks</span>
                            <span className="font-mono font-bold text-zinc-900 bg-zinc-100 border border-zinc-300 px-2 py-0.5 rounded-md">{checkedCount} of 9 checked</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {checklistKeys.map((k) => {
                                const passed = ticker.checklist[k];
                                return (
                                    <div key={k} className="flex items-center gap-3 p-2.5 bg-white border border-zinc-200 rounded-md">
                                        <div className={`w-4 h-4 flex items-center justify-center font-mono font-bold text-[10px] ${passed ? 'bg-[#17745a]/10 text-[#17745a] border border-[#17745a]/25' : 'bg-red-50 text-[#c73c35] border border-zinc-200'}`}>
                                            {passed ? '✓' : '✗'}
                                        </div>
                                        <span className={`text-xs ${passed ? 'text-zinc-900 font-medium' : 'text-zinc-400 line-through'}`}>
                                            {checklistLabels[k]}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* TAB 4: EVENTS */}
                {activeTab === 'events' && (
                    <div className="space-y-5 max-w-4xl  text-xs">
                        <div className="grid grid-cols-2 gap-4 font-mono">
                            <div className="bg-white p-3 border border-zinc-200 rounded-md">
                                <span className="text-[10px] text-zinc-400 uppercase block mb-1 font-sans">Next Earnings</span>
                                <span className="text-zinc-900 font-bold">{ticker.event.nextEarnings}</span>
                            </div>
                            <div className="bg-white p-3 border border-zinc-200 rounded-md">
                                <span className="text-[10px] text-zinc-400 uppercase block mb-1 font-sans">Last Earnings</span>
                                <span className="text-zinc-900 font-bold">{ticker.event.lastEarnings}</span>
                            </div>
                            <div className="bg-white p-3 border border-zinc-200 rounded-md">
                                <span className="text-[10px] text-zinc-400 uppercase block mb-1 font-sans">Rev Result</span>
                                <span className="text-zinc-900 font-bold">{ticker.event.revenueResult}</span>
                            </div>
                            <div className="bg-white p-3 border border-zinc-200 rounded-md">
                                <span className="text-[10px] text-zinc-400 uppercase block mb-1 font-sans">EPS Result</span>
                                <span className="text-zinc-900 font-bold">{ticker.event.epsResult}</span>
                            </div>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-zinc-200 font-sans text-xs">
                            <div>
                                <span className="text-xs font-bold text-zinc-500 uppercase block">Guidance</span>
                                <p className="text-zinc-700 mt-0.5 leading-relaxed">{ticker.event.guidance}</p>
                            </div>
                            <div>
                                <span className="text-xs font-bold text-zinc-500 uppercase block">Events Analyst Note</span>
                                <p className="text-zinc-700 mt-0.5 leading-relaxed">{ticker.event.note}</p>
                            </div>
                        </div>

                        {ticker.feed && ticker.feed.length > 0 && (
                            <div className="space-y-3 pt-4 border-t border-zinc-200">
                                <span className="text-xs font-bold text-zinc-500 uppercase block">Events Context updates</span>
                                <div className="space-y-3 font-sans">
                                    {ticker.feed.map((feedItem, idx) => (
                                        <div key={idx} className="p-3.5 bg-white border border-zinc-200 rounded-md text-xs">
                                            <div className="flex justify-between items-center mb-1 text-[10px] font-mono text-zinc-400">
                                                <span>{feedItem.source}</span>
                                                <span>{feedItem.date}</span>
                                            </div>
                                            <p className="text-zinc-800 font-semibold leading-normal">{feedItem.title}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 5: TECHNICAL */}
                {activeTab === 'technical' && (
                    <div className="space-y-6 font-mono text-xs max-w-4xl  text-[#17201d]">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-0 border border-zinc-200 divide-x divide-y divide-zinc-200 rounded-md overflow-hidden bg-white">
                            <div className="p-3">
                                <span className="text-[10px] text-zinc-400 uppercase block mb-1 font-sans">50-Day MA</span>
                                <span className="text-zinc-900 font-bold">{ticker.technical.ma50}</span>
                            </div>
                            <div className="p-3">
                                <span className="text-[10px] text-zinc-400 uppercase block mb-1 font-sans">200-Day MA</span>
                                <span className="text-zinc-900 font-bold">{ticker.technical.ma200}</span>
                            </div>
                            <div className="p-3">
                                <span className="text-[10px] text-zinc-400 uppercase block mb-1 font-sans">RSI (14)</span>
                                <span className="text-zinc-900 font-bold">{ticker.technical.rsi}</span>
                            </div>
                            <div className="p-3">
                                <span className="text-[10px] text-zinc-400 uppercase block mb-1 font-sans">MACD</span>
                                <span className="text-zinc-900 font-bold">{ticker.technical.macd}</span>
                            </div>
                            <div className="p-3">
                                <span className="text-[10px] text-zinc-400 uppercase block mb-1 font-sans">Volume</span>
                                <span className="text-zinc-900 font-bold">{ticker.technical.volume}</span>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-zinc-200 font-sans text-xs">
                            <div>
                                <h4 className="text-xs font-bold text-zinc-500 uppercase">52-Week Range</h4>
                                <p className="text-zinc-900 font-mono font-bold mt-1">{ticker.technical.range52Week}</p>
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-zinc-500 uppercase">Support / Resistance Bounds</h4>
                                <p className="text-zinc-900 font-mono font-bold mt-1">{ticker.technical.supportResistance}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
