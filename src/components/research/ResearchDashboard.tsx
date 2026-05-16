'use client';

import { useState, type ReactNode } from 'react';

type Market = 'US' | 'MY';
type ResearchStatus = 'owned' | 'watch' | 'waiting' | 'avoid';
type ValuationState = 'cheap' | 'fair' | 'expensive' | 'unknown';
type ThesisStrength = 'high' | 'medium' | 'low';
type ReadinessState = 'Ready to research deeper' | 'Wait for better price' | 'Too uncertain' | 'Avoid';
type KeyValueRow = [string, string];

type ResearchWatchlistItem = {
    symbol: string;
    name: string;
    market: Market;
    price?: number;
    dailyChange?: number;
    status: ResearchStatus;
    targetBuyZone: string;
    valuationState: ValuationState;
    thesisStrength: ThesisStrength;
    lastReviewedAt: string;
    readiness: ReadinessState;
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
    checklist: Array<{
        label: string;
        checked: boolean;
    }>;
};

const watchlist: ResearchWatchlistItem[] = [
    {
        symbol: 'MSFT',
        name: 'Microsoft',
        market: 'US',
        price: 428.4,
        dailyChange: 0.7,
        status: 'owned',
        targetBuyZone: '$390 - $405',
        valuationState: 'fair',
        thesisStrength: 'high',
        lastReviewedAt: '2026-05-10',
        readiness: 'Ready to research deeper',
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
        checklist: [
            { label: 'Business is understandable', checked: true },
            { label: 'Revenue is growing or stable', checked: true },
            { label: 'Margins are healthy', checked: true },
            { label: 'Debt is manageable', checked: true },
            { label: 'Valuation is reasonable', checked: false },
        ],
    },
    {
        symbol: 'NVDA',
        name: 'NVIDIA',
        market: 'US',
        price: 118.9,
        dailyChange: -1.1,
        status: 'waiting',
        targetBuyZone: '$95 - $105',
        valuationState: 'expensive',
        thesisStrength: 'medium',
        lastReviewedAt: '2026-05-08',
        readiness: 'Wait for better price',
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
        checklist: [
            { label: 'Business is understandable', checked: true },
            { label: 'Revenue is growing or stable', checked: true },
            { label: 'Margins are healthy', checked: true },
            { label: 'Debt is manageable', checked: true },
            { label: 'Valuation is reasonable', checked: false },
        ],
    },
    {
        symbol: 'VOO',
        name: 'Vanguard S&P 500 ETF',
        market: 'US',
        price: 512.3,
        dailyChange: 0.1,
        status: 'watch',
        targetBuyZone: 'Dollar-cost average',
        valuationState: 'fair',
        thesisStrength: 'high',
        lastReviewedAt: '2026-05-05',
        readiness: 'Ready to research deeper',
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
        checklist: [
            { label: 'Business is understandable', checked: true },
            { label: 'Revenue is growing or stable', checked: true },
            { label: 'Margins are healthy', checked: true },
            { label: 'Debt is manageable', checked: true },
            { label: 'Valuation is reasonable', checked: true },
        ],
    },
    {
        symbol: 'MAYBANK',
        name: 'Malayan Banking',
        market: 'MY',
        price: 10.02,
        dailyChange: 0.3,
        status: 'watch',
        targetBuyZone: 'RM9.20 - RM9.60',
        valuationState: 'fair',
        thesisStrength: 'medium',
        lastReviewedAt: '2026-05-02',
        readiness: 'Ready to research deeper',
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
        checklist: [
            { label: 'Business is understandable', checked: true },
            { label: 'Revenue is growing or stable', checked: true },
            { label: 'Margins are healthy', checked: true },
            { label: 'Debt is manageable', checked: false },
            { label: 'Valuation is reasonable', checked: true },
        ],
    },
    {
        symbol: 'NET',
        name: 'Cloudflare',
        market: 'US',
        price: 88.1,
        dailyChange: -0.8,
        status: 'avoid',
        targetBuyZone: '$55 - $65',
        valuationState: 'expensive',
        thesisStrength: 'low',
        lastReviewedAt: '2026-04-29',
        readiness: 'Too uncertain',
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
        checklist: [
            { label: 'Business is understandable', checked: true },
            { label: 'Revenue is growing or stable', checked: true },
            { label: 'Margins are healthy', checked: false },
            { label: 'Debt is manageable', checked: true },
            { label: 'Valuation is reasonable', checked: false },
        ],
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

const statusStyles: Record<ResearchStatus, string> = {
    owned: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    watch: 'bg-sky-100 text-sky-800 ring-sky-200',
    waiting: 'bg-amber-100 text-amber-800 ring-amber-200',
    avoid: 'bg-rose-100 text-rose-800 ring-rose-200',
};

const valuationStyles: Record<ValuationState, string> = {
    cheap: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    fair: 'bg-slate-100 text-slate-700 ring-slate-200',
    expensive: 'bg-amber-100 text-amber-800 ring-amber-200',
    unknown: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
};

const readinessStyles: Record<ReadinessState, string> = {
    'Ready to research deeper': 'border-emerald-300 bg-emerald-50 text-emerald-900',
    'Wait for better price': 'border-amber-300 bg-amber-50 text-amber-900',
    'Too uncertain': 'border-slate-300 bg-slate-50 text-slate-800',
    Avoid: 'border-rose-300 bg-rose-50 text-rose-900',
};

const formatCurrency = (value: number | undefined, market: Market) => {
    if (value === undefined) {
        return 'Unknown';
    }

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: market === 'MY' ? 'MYR' : 'USD',
        maximumFractionDigits: value >= 100 ? 0 : 2,
    }).format(value);
};

const formatPercent = (value: number | undefined) => {
    if (value === undefined) {
        return 'Unknown';
    }

    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
};

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

export const ResearchDashboard = () => {
    const [selectedSymbol, setSelectedSymbol] = useState(watchlist[0].symbol);
    const selected = watchlist.find((item) => item.symbol === selectedSymbol) ?? watchlist[0];
    const readyCount = watchlist.filter((item) => item.readiness === 'Ready to research deeper').length;
    const waitingCount = watchlist.filter((item) => item.status === 'waiting').length;
    const unknownCount = watchlist.filter((item) => item.valuationState === 'unknown').length;

    return (
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
            <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">Static MVP sample</div>
                    <h1 className="mt-2 text-3xl font-bold tracking-normal text-slate-950 sm:text-4xl">Investment Research</h1>
                    <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">
                        Long-horizon watchlist, thesis, valuation, events, and checklist context separated from the market signal cockpit.
                    </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                    <SummaryMetric label="Tickers" value={watchlist.length.toString()} />
                    <SummaryMetric label="Ready" value={readyCount.toString()} />
                    <SummaryMetric label="Waiting" value={waitingCount.toString()} />
                </div>
            </header>

            <div className="mt-6 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
                <section className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-base font-bold text-slate-950">Watchlist Overview</h2>
                            <p className="text-sm text-slate-500">Sample data only. Live quote and source timestamps come in the next phase.</p>
                        </div>
                        <div className="text-sm font-semibold text-slate-500">{unknownCount} unknown valuation states</div>
                    </div>

                    <div className="max-w-full overflow-x-auto">
                        <table className="min-w-[920px] w-full border-collapse text-left text-sm">
                            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                <tr>
                                    <th className="px-4 py-3">Symbol</th>
                                    <th className="px-4 py-3">Company</th>
                                    <th className="px-4 py-3">Price</th>
                                    <th className="px-4 py-3">Change</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Buy zone</th>
                                    <th className="px-4 py-3">Valuation</th>
                                    <th className="px-4 py-3">Thesis</th>
                                    <th className="px-4 py-3">Reviewed</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {watchlist.map((item) => {
                                    const isSelected = selected.symbol === item.symbol;

                                    return (
                                        <tr key={item.symbol} className={isSelected ? 'bg-emerald-50/70' : 'bg-white'}>
                                            <td className="px-4 py-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedSymbol(item.symbol)}
                                                    aria-pressed={isSelected}
                                                    className={`rounded-md px-2 py-1 font-mono text-sm font-bold ${isSelected ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'}`}
                                                >
                                                    {item.symbol}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-slate-950">{item.name}</div>
                                                <div className="text-xs text-slate-500">{item.market}</div>
                                            </td>
                                            <td className="px-4 py-3 font-semibold text-slate-800">{formatCurrency(item.price, item.market)}</td>
                                            <td className={`px-4 py-3 font-semibold ${item.dailyChange !== undefined && item.dailyChange < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                                {formatPercent(item.dailyChange)}
                                            </td>
                                            <td className="px-4 py-3"><Pill className={statusStyles[item.status]}>{statusLabels[item.status]}</Pill></td>
                                            <td className="px-4 py-3 text-slate-700">{item.targetBuyZone}</td>
                                            <td className="px-4 py-3"><Pill className={valuationStyles[item.valuationState]}>{valuationLabels[item.valuationState]}</Pill></td>
                                            <td className="px-4 py-3 text-slate-700">{strengthLabels[item.thesisStrength]}</td>
                                            <td className="px-4 py-3 text-slate-500">{item.lastReviewedAt}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className={`min-w-0 rounded-lg border p-4 shadow-sm ${readinessStyles[selected.readiness]}`}>
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-75">Selected ticker</div>
                    <div className="mt-3 flex items-start justify-between gap-4">
                        <div>
                            <div className="font-mono text-3xl font-bold tracking-normal">{selected.symbol}</div>
                            <div className="mt-1 text-base font-semibold">{selected.name}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold tracking-normal">{formatCurrency(selected.price, selected.market)}</div>
                            <div className={`text-sm font-bold ${selected.dailyChange !== undefined && selected.dailyChange < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                {formatPercent(selected.dailyChange)}
                            </div>
                        </div>
                    </div>
                    <div className="mt-5 border-t border-current/15 pt-4">
                        <div className="text-sm font-bold uppercase tracking-[0.14em] opacity-70">Readiness</div>
                        <div className="mt-1 text-xl font-bold tracking-normal">{selected.readiness}</div>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                        <InfoPair label="Target buy zone" value={selected.targetBuyZone} />
                        <InfoPair label="Valuation" value={valuationLabels[selected.valuationState]} />
                        <InfoPair label="Thesis strength" value={strengthLabels[selected.thesisStrength]} />
                        <InfoPair label="Last reviewed" value={selected.lastReviewedAt} />
                    </dl>
                </section>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
                <SectionCard title="Company Snapshot" eyebrow={selected.symbol}>
                    <p className="mb-4 text-sm leading-6 text-slate-600">{selected.description}</p>
                    <KeyValueList rows={detailRows(selected)} />
                </SectionCard>

                <SectionCard title="Thesis Card" eyebrow="Investment reason">
                    <KeyValueList
                        rows={[
                            ['Bull case', selected.bullCase],
                            ['Bear case', selected.bearCase],
                            ['What would make me buy', selected.buyTrigger],
                            ['What would make me sell or avoid', selected.sellTrigger],
                            ['What would prove it wrong', selected.thesisBreak],
                        ]}
                    />
                </SectionCard>

                <SectionCard title="Valuation Snapshot" eyebrow={valuationLabels[selected.valuationState]}>
                    <KeyValueList rows={valuationRows(selected)} />
                </SectionCard>

                <SectionCard title="Earnings And Events" eyebrow="Company-specific">
                    <KeyValueList rows={eventRows(selected)} />
                </SectionCard>

                <SectionCard title="Research Feed" eyebrow="News, filings, transcripts">
                    <div className="space-y-4">
                        {selected.feed.map((feedItem) => (
                            <article key={`${selected.symbol}-${feedItem.title}`} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                                <div className="text-sm font-bold leading-6 text-slate-950">{feedItem.title}</div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                                    <span>{feedItem.source}</span>
                                    <span>{feedItem.date}</span>
                                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">{feedItem.label}</span>
                                </div>
                            </article>
                        ))}
                    </div>
                </SectionCard>

                <SectionCard title="Technical Context" eyebrow="Secondary input">
                    <KeyValueList rows={technicalRows(selected)} />
                </SectionCard>
            </div>

            <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Investment Checklist</div>
                        <h2 className="mt-1 text-xl font-bold tracking-normal text-slate-950">{selected.readiness}</h2>
                    </div>
                    <div className="text-sm font-semibold text-slate-500">
                        {selected.checklist.filter((item) => item.checked).length} of {selected.checklist.length} checks marked
                    </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {selected.checklist.map((item) => (
                        <div key={`${selected.symbol}-${item.label}`} className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs font-bold ${item.checked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white text-slate-400'}`}>
                                {item.checked ? 'Y' : '-'}
                            </span>
                            <span className="text-sm font-semibold leading-5 text-slate-800">{item.label}</span>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

const SummaryMetric = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-right shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</div>
        <div className="mt-1 text-2xl font-bold tracking-normal text-slate-950">{value}</div>
    </div>
);

const Pill = ({ children, className }: { children: ReactNode; className: string }) => (
    <span className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold ring-1 ${className}`}>
        {children}
    </span>
);

const SectionCard = ({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) => (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">{eyebrow}</div>
        <h2 className="mt-1 text-xl font-bold tracking-normal text-slate-950">{title}</h2>
        <div className="mt-4">{children}</div>
    </section>
);

const KeyValueList = ({ rows }: { rows: KeyValueRow[] }) => (
    <dl className="divide-y divide-slate-100">
        {rows.map(([label, value]) => (
            <div key={label} className="grid gap-2 py-2 text-sm sm:grid-cols-[150px_minmax(0,1fr)]">
                <dt className="font-semibold text-slate-500">{label}</dt>
                <dd className="leading-6 text-slate-800">{value || 'Unknown'}</dd>
            </div>
        ))}
    </dl>
);

const InfoPair = ({ label, value }: { label: string; value: string }) => (
    <div>
        <dt className="text-xs font-bold uppercase tracking-[0.14em] opacity-65">{label}</dt>
        <dd className="mt-1 font-semibold">{value}</dd>
    </div>
);
