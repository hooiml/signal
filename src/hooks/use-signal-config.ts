
'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_SIGNAL_CONFIG, readSignalConfig, writeSignalConfig, type SignalConfig } from '../lib/signal-config';
export type { MarketMode, MarketRegion } from '../lib/signal-config';

export function useSignalConfig() {
    const [config, setConfig] = useState<SignalConfig>(DEFAULT_SIGNAL_CONFIG);
    const [isLoaded, setIsLoaded] = useState(false);
    const [storageError, setStorageError] = useState('');

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            const saved = readSignalConfig();
            setConfig(saved.config);
            setStorageError(saved.error);
            setIsLoaded(true);
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, []);

    const updateConfig = (updates: Partial<SignalConfig>) => {
        const next = { ...config, ...updates };
        setConfig(next);
        try { writeSignalConfig(next); setStorageError(''); }
        catch (error) { setStorageError(error instanceof Error ? error.message : 'Could not save defaults.'); }
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
        isLoaded,
        storageError
    };
}
