'use client';

import React from 'react';

interface StrategyPresetsProps {
    currentMode: 'standard' | 'contrarian';
    currentSocial: boolean;
    onPresetSelect: (preset: 'momentum' | 'contrarian_pure' | 'contrarian_informed' | 'custom') => void;
}

export const StrategyPresets = ({ currentMode, currentSocial, onPresetSelect }: StrategyPresetsProps) => {
    // Determine current preset based on config
    const getCurrentPreset = (): string => {
        if (currentMode === 'standard' && currentSocial) return 'momentum';
        if (currentMode === 'contrarian' && !currentSocial) return 'contrarian_pure';
        if (currentMode === 'contrarian' && currentSocial) return 'contrarian_informed';
        return 'custom';
    };

    const activePreset = getCurrentPreset();

    const presets = [
        {
            id: 'momentum' as const,
            icon: '📈',
            name: 'Momentum Trader',
            description: 'Follow the trend',
            config: 'Standard + Social ON',
            tooltip: 'Best for trending markets. Follows crowd momentum with all indicators active.'
        },
        {
            id: 'contrarian_pure' as const,
            icon: '🔄',
            name: 'Pure Contrarian',
            description: 'Institutional only',
            config: 'Contrarian + Social OFF',
            tooltip: 'Ignores retail noise. Focuses purely on institutional indicators to fade extremes.'
        },
        {
            id: 'contrarian_informed' as const,
            icon: '🎯',
            name: 'Informed Contrarian',
            description: 'Fade with context',
            config: 'Contrarian + Social ON',
            tooltip: 'Uses social sentiment as counter-indicator. Fades extremes while staying informed.'
        }
    ];

    return (
        <div className="w-full p-4 rounded-lg border border-white/5 bg-white/[0.02]">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
                    Strategy Presets
                </h3>
                {activePreset === 'custom' && (
                    <span className="text-[8px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold uppercase tracking-wider">
                        ⚙️ Custom
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {presets.map((preset) => {
                    const isActive = activePreset === preset.id;

                    return (
                        <button
                            key={preset.id}
                            onClick={() => onPresetSelect(preset.id)}
                            className={`group relative p-3 rounded-lg border transition-all text-left ${isActive
                                    ? 'border-blue-500/50 bg-blue-500/10 shadow-lg'
                                    : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10'
                                }`}
                        >
                            <div className="flex items-start gap-2 mb-2">
                                <span className="text-lg">{preset.icon}</span>
                                <div className="flex-1">
                                    <div className="text-[11px] font-bold text-slate-200 mb-0.5">
                                        {preset.name}
                                    </div>
                                    <div className="text-[9px] text-slate-500 italic">
                                        {preset.description}
                                    </div>
                                </div>
                                {isActive && (
                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                )}
                            </div>

                            <div className="text-[8px] font-mono text-slate-600 border-t border-white/5 pt-2">
                                {preset.config}
                            </div>

                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 bg-slate-900 border border-white/10 rounded-lg text-[9px] leading-relaxed text-slate-300 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl pointer-events-none">
                                <div className="font-bold text-blue-400 mb-1">{preset.name}</div>
                                {preset.tooltip}
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="mt-3 pt-3 border-t border-white/5">
                <div className="text-[8px] text-slate-600 leading-relaxed">
                    <span className="text-slate-500 font-bold">💡 Tip:</span> Presets auto-configure mode and data sources.
                    Manual changes switch to <span className="text-purple-400 font-mono">Custom</span> mode.
                </div>
            </div>
        </div>
    );
};
