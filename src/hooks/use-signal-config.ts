
'use client';

import { useState, useEffect } from 'react';

export type MarketMode = 'standard' | 'contrarian';
export type MarketRegion = 'US' | 'MY';

interface SignalConfig {
    mode: MarketMode;
    market: MarketRegion;
    enableSocial: boolean;
}

const STORAGE_KEY = 'signal-dashboard-config';

export function useSignalConfig() {
    // Default values
    const [config, setConfig] = useState<SignalConfig>({
        mode: 'standard',
        market: 'US',
        enableSocial: true
    });

    const [isLoaded, setIsLoaded] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setConfig(parsed);
            } catch (e) {
                console.error('Failed to parse signal configuration:', e);
            }
        }
        setIsLoaded(true);
    }, []);

    // Save to localStorage on change
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        }
    }, [config, isLoaded]);

    const updateConfig = (updates: Partial<SignalConfig>) => {
        setConfig(prev => ({ ...prev, ...updates }));
    };

    // Preset configurations
    const applyPreset = (preset: 'momentum' | 'contrarian_pure' | 'contrarian_informed' | 'custom') => {
        switch (preset) {
            case 'momentum':
                updateConfig({ mode: 'standard', enableSocial: true });
                break;
            case 'contrarian_pure':
                updateConfig({ mode: 'contrarian', enableSocial: false });
                break;
            case 'contrarian_informed':
                updateConfig({ mode: 'contrarian', enableSocial: true });
                break;
            case 'custom':
                // Custom preset - user configures manually
                break;
        }
    };

    return {
        config,
        updateConfig,
        applyPreset,
        isLoaded
    };
}
