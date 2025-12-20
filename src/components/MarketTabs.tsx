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
}

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
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide mb-2 border-b border-white/5">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${activeTab === tab.id
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Stock List */}
            <div className="flex gap-2 w-full pb-2 overflow-x-auto scrollbar-thin">
                {sortedStocks.slice(0, 15).map((stock, i) => (
                    <div key={i} className="flex flex-col items-center bg-white/[0.03] rounded-lg px-3 py-2 min-w-[80px] shrink-0 border border-white/5 hover:bg-white/[0.05] transition-colors group">
                        <span className="text-xs font-bold text-gray-300 group-hover:text-white">{stock.symbol}</span>

                        {/* Dynamic metric display based on tab */}
                        {activeTab.includes('52w') ? (
                            // Show year stats for 52w tabs
                            <div className="flex flex-col items-center mt-1">
                                <span className={`text-[10px] font-mono ${stock.fiftyTwoWeekChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {stock.fiftyTwoWeekChangePercent >= 0 ? '+' : ''}{stock.fiftyTwoWeekChangePercent.toFixed(0)}%
                                </span>
                                <span className="text-[9px] text-gray-600">vs Low</span>
                            </div>
                        ) : (
                            // Show daily stats for others
                            <span className={`text-[10px] font-mono mt-1 ${stock.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(1)}%
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
