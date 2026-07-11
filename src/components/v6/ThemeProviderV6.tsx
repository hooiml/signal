'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { getThemeV6, RESEARCH_THEME_STORAGE_KEY_V6, type ResearchThemeV6 } from './research-v6';

type ThemeContextValue = {
    readonly theme: ResearchThemeV6;
    readonly toggleTheme: () => void;
};

const ThemeContextV6 = createContext<ThemeContextValue | null>(null);

class ThemeProviderError extends Error {
    constructor() {
        super('useThemeV6 must be used inside ThemeProviderV6.');
        this.name = 'ThemeProviderError';
    }
}

export const ThemeProviderV6 = ({ children }: { readonly children: React.ReactNode }) => {
    const [theme, setTheme] = useState<ResearchThemeV6>('dark');
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            const stored = window.localStorage.getItem(RESEARCH_THEME_STORAGE_KEY_V6);
            if (stored === 'light' || stored === 'dark') setTheme(stored);
            setReady(true);
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, []);

    useEffect(() => {
        if (!ready) return;
        document.documentElement.setAttribute('data-cockpit-theme', theme);
        window.localStorage.setItem(RESEARCH_THEME_STORAGE_KEY_V6, theme);
    }, [ready, theme]);

    const toggleTheme = () => setTheme((current) => current === 'dark' ? 'light' : 'dark');
    return <ThemeContextV6 value={{ theme, toggleTheme }}>{children}</ThemeContextV6>;
};

export const useThemeV6 = (): ThemeContextValue => {
    const context = useContext(ThemeContextV6);
    if (!context) throw new ThemeProviderError();
    return context;
};

export const ResearchLoadingV6 = () => {
    const { theme } = useThemeV6();
    const styles = getThemeV6(theme);
    return <div className={'min-h-[100dvh] p-6 text-sm ' + styles.page}>Loading research...</div>;
};
