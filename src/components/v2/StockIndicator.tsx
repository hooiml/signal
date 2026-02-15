'use client';

import React from 'react';

interface StockData {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    sparkline?: number[]; // Mini chart data points
}

interface StockIndicatorProps {
    stocks: StockData[];
    market: 'US' | 'MY';
}

const MiniSparkline = ({ data, isPositive }: { data: number[]; isPositive: boolean }) => {
    if (!data || data.length === 0) return null;

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    const points = data.map((value, index) => {
        const x = (index / (data.length - 1)) * 100;
        const y = 100 - ((value - min) / range) * 100;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg
            className="absolute inset-0 w-full h-full opacity-20"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
        >
            <polyline
                fill="none"
                stroke={isPositive ? '#10b981' : '#ef4444'}
                strokeWidth="2"
                points={points}
            />
        </svg>
    );
};

export const StockIndicator = ({ stocks, market }: StockIndicatorProps) => {
    const currencySymbol = market === 'MY' ? 'RM' : '$';

    return (
        <div className="w-full">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    {market === 'US' ? 'Popular US Stocks' : 'Active MY Stocks'}
                </h3>
                <span className="text-[9px] text-slate-500 uppercase tracking-wider">Live</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {stocks.map((stock) => (
                    <div
                        key={stock.symbol}
                        className="relative p-2.5 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors overflow-hidden"
                    >
                        {/* Background Sparkline */}
                        {stock.sparkline && (
                            <MiniSparkline
                                data={stock.sparkline}
                                isPositive={stock.change >= 0}
                            />
                        )}

                        {/* Content */}
                        <div className="relative z-10 flex flex-col">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                                {stock.symbol}
                            </span>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-sm font-mono font-medium text-white">
                                    {currencySymbol}{stock.price.toFixed(2)}
                                </span>
                                <span className={`text-[9px] font-mono font-medium ${stock.change >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                    }`}>
                                    {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
