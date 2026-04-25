'use client';

import React from 'react';

interface StrategyPresetsProps {
    currentMode: 'standard' | 'contrarian';
    currentSocial: boolean;
    onPresetSelect: (preset: 'momentum' | 'contrarian_pure' | 'contrarian_informed' | 'custom') => void;
}

export const StrategyPresets = ({ currentMode, currentSocial, onPresetSelect }: StrategyPresetsProps) => {
    const getCurrentPreset = (): string => {
        if (currentMode === 'standard' && currentSocial) return 'momentum';
        if (currentMode === 'contrarian' && !currentSocial) return 'contrarian_pure';
        if (currentMode === 'contrarian' && currentSocial) return 'contrarian_informed';
        return 'custom';
    };

    const activePreset = getCurrentPreset();
    const presets = [
        { id: 'momentum' as const, name: 'Momentum', detail: 'Standard + social' },
        { id: 'contrarian_pure' as const, name: 'Pure Contrarian', detail: 'Institutional only' },
        { id: 'contrarian_informed' as const, name: 'Informed Contrarian', detail: 'Contrarian + social' }
    ];

    return (
        <div className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h3 className="text-xs uppercase font-bold tracking-widest text-slate-500">
                        Strategy Presets
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                        Select how the engine interprets sentiment extremes.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:min-w-[560px]">
                    {presets.map((preset) => {
                        const isActive = activePreset === preset.id;

                        return (
                            <button
                                key={preset.id}
                                onClick={() => onPresetSelect(preset.id)}
                                className={`relative overflow-hidden rounded-lg border px-3 py-2 text-left transition-all duration-300 ${isActive
                                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700 shadow-sm'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                            >
                                {isActive && <div className="absolute inset-x-0 top-0 h-0.5 bg-indigo-500 opacity-80" />}
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-bold">{preset.name}</span>
                                    {isActive && <span className="h-2 w-2 rounded-full bg-indigo-600 shadow-sm" />}
                                </div>
                                <div className="mt-1 text-[11px] font-mono text-slate-500">{preset.detail}</div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
