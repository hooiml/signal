
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
const DEFAULT_CONFIG: SignalConfig = {
    mode: 'standard',
    market: 'US',
    enableSocial: true
};

const isSignalConfig = (value: unknown): value is SignalConfig => {
    if (!value || typeof value !== 'object') return false;
    const config = value as Partial<SignalConfig>;
    return (config.mode === 'standard' || config.mode === 'contrarian')
        && (config.market === 'US' || config.market === 'MY')
        && typeof config.enableSocial === 'boolean';
};

const getInitialConfig = (): SignalConfig => {
    if (typeof window === 'undefined') return DEFAULT_CONFIG;

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_CONFIG;

    try {
        const parsed: unknown = JSON.parse(stored);
        return isSignalConfig(parsed) ? parsed : DEFAULT_CONFIG;
    } catch (error) {
        console.error('Failed to parse signal configuration:', error);
        return DEFAULT_CONFIG;
    }
};

export function useSignalConfig() {
    const [config, setConfig] = useState<SignalConfig>(DEFAULT_CONFIG);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setConfig(getInitialConfig());
            setIsLoaded(true);
        }, 0);

        return () => window.clearTimeout(timeoutId);
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
