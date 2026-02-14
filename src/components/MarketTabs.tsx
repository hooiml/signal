'use client';

import { useState, useMemo } from 'react';

interface StockData {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    fiftyTwoWeekHigh: number;
    fiftyTwoWeekLow: number;
    fiftyTwoWeekChangePercent: number;
    sparkline?: number[];
}

// Sparkline Component
const Sparkline = ({ data, color, opacity = "opacity-30" }: { data?: number[], color: string, opacity?: string }) => {
    if (!data || data.length < 5) return null;

    const width = 80;
    const height = 40;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    // Create SVG path
    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((d - min) / range) * height;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    return (
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={opacity}>
            <path d={`M ${points}`} fill="none" stroke="currentColor" strokeWidth="2" className={color} vectorEffect="non-scaling-stroke" />
        </svg>
    );
};

interface MarketTabsProps {
    stocks: StockData[];
}

type TabType = 'trending' | 'gainers' | 'losers' | '52w-high' | '52w-low';

export default function MarketTabs({ stocks }: MarketTabsProps) {
    const [activeTab, setActiveTab] = useState<TabType>('trending');

    const sortedStocks = useMemo(() => {
        const list = [...stocks];
        switch (activeTab) {
            case 'gainers':
                return list.sort((a, b) => b.changePercent - a.changePercent);
            case 'losers':
                return list.sort((a, b) => a.changePercent - b.changePercent);
            case '52w-high':
                return list.sort((a, b) => b.fiftyTwoWeekChangePercent - a.fiftyTwoWeekChangePercent);
            case '52w-low':
                return list.sort((a, b) => a.fiftyTwoWeekChangePercent - b.fiftyTwoWeekChangePercent);
            case 'trending':
            default:
                // Default ranking: Popularity/Volume proxy (Active List is roughly sorted by vol)
                // Since we don't have volume, we keep the original order (Active + Popular)
                return list;
        }
    }, [stocks, activeTab]);

    const tabs: { id: TabType; label: string }[] = [
        { id: 'trending', label: 'Trending' },
        { id: 'gainers', label: 'Top Gainers' },
        { id: 'losers', label: 'Top Losers' },
        { id: '52w-high', label: '52W High' },
        { id: '52w-low', label: '52W Low' },
    ];

    return (
        <div className="bg-[#111] border border-[#222] rounded-2xl p-4 overflow-hidden">
            {/* Tab Navigation */}
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide mb-2 border-b border-white/5 mask-fade-right">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`text-[10px] md:text-xs font-bold px-3 py-1.5 rounded-full transition-all whitespace-nowrap shrink-0 ${activeTab === tab.id
                            ? 'bg-purple-500 text-white shadow-[0_0_12px_rgba(168,85,247,0.4)] border border-purple-400/20'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Stock List */}
            <div className="flex gap-2 w-full pb-2 overflow-x-auto scrollbar-thin min-h-[85px]">
                {sortedStocks.length > 0 ? (
                    sortedStocks.slice(0, 15).map((stock, i) => (
                        <div key={i} className="flex flex-col items-center justify-center bg-white/[0.03] rounded-lg px-2 py-2 min-w-[90px] shrink-0 border border-white/5 hover:bg-white/[0.05] transition-colors group relative overflow-hidden h-[80px]">

                            {/* Sparkline Background */}
                            {stock.sparkline && (
                                <div className="absolute inset-x-0 bottom-0 h-10 z-0 pointer-events-none px-1 pb-1">
                                    <Sparkline
                                        data={stock.sparkline}
                                        color={stock.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}
                                        opacity={stock.change >= 0 ? "opacity-30" : "opacity-50"}
                                    />
                                </div>
                            )}

                            {/* Content Stack */}
                            <div className="relative z-10 flex flex-col items-center w-full">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">{stock.symbol}</span>
                                <span className="text-sm font-bold text-white tracking-tight leading-none mb-1">
                                    {stock.price < 1000
                                        ? stock.price.toFixed(2)
                                        : (stock.price / 1000).toFixed(1) + 'k'}
                                </span>

                                {/* Dynamic metric display based on tab */}
                                {activeTab.includes('52w') ? (
                                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded backdrop-blur-sm shadow-sm ${stock.fiftyTwoWeekChangePercent >= 0 ? 'bg-emerald-500/30 text-emerald-50 border border-emerald-500/30' : 'bg-rose-500/30 text-rose-50 border border-rose-500/30'}`}>
                                        {stock.fiftyTwoWeekChangePercent >= 0 ? '+' : ''}{stock.fiftyTwoWeekChangePercent.toFixed(0)}%
                                    </span>
                                ) : (
                                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded backdrop-blur-sm shadow-sm ${stock.change >= 0 ? 'bg-emerald-500/30 text-emerald-50 border border-emerald-500/30' : 'bg-rose-500/30 text-rose-50 border border-rose-500/30'}`}>
                                        {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(1)}%
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="w-full flex flex-col items-center justify-center text-gray-500 py-2">
                        <span className="text-xs italic">No data available for this category</span>
                    </div>
                )}
            </div>
        </div>
    );
}
