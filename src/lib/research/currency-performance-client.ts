'use client';

import {
    defaultCurrencyPerformanceSettings,
    parseCurrencyPerformanceSettings,
    type CurrencyPerformanceSettings,
} from './currency-performance';

export const CURRENCY_PERFORMANCE_STORAGE_KEY = 'signal-currency-performance-v1';

export const readCurrencyPerformanceSettings = (): CurrencyPerformanceSettings => {
    try {
        return parseCurrencyPerformanceSettings(JSON.parse(localStorage.getItem(CURRENCY_PERFORMANCE_STORAGE_KEY) ?? 'null'));
    } catch {
        return defaultCurrencyPerformanceSettings;
    }
};

export const writeCurrencyPerformanceSettings = (
    settings: CurrencyPerformanceSettings,
): CurrencyPerformanceSettings => {
    const parsed = parseCurrencyPerformanceSettings(settings);
    localStorage.setItem(CURRENCY_PERFORMANCE_STORAGE_KEY, JSON.stringify(parsed));
    return parsed;
};
