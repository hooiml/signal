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
            className="absolute inset-0 w-full h-full opacity-25"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
        >
            <polyline
                fill="none"
                stroke={isPositive ? '#0f766e' : '#dc2626'}
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
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-600">
                    {market === 'US' ? 'Popular US Stocks' : 'Active MY Stocks'}
                </h3>
                <span className="text-[11px] text-emerald-700 uppercase tracking-wider font-bold">Live</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {stocks.map((stock) => (
                    <div
                        key={stock.symbol}
                        className="relative p-2.5 rounded-lg border border-slate-200 bg-white hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md transition-all overflow-hidden shadow-sm"
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
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                                {stock.symbol}
                            </span>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-base font-mono font-semibold text-slate-950">
                                    {currencySymbol}{stock.price.toFixed(2)}
                                </span>
                                <span className={`text-[11px] font-mono font-semibold ${stock.change >= 0 ? 'text-emerald-700' : 'text-rose-700'
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
