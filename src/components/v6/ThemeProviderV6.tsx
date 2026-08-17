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
        document.documentElement.setAttribute('data-theme-ready', 'true');
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
    return (
        <div className={'min-h-[100dvh] px-4 py-5 sm:px-6 ' + styles.page}>
            <div className="mx-auto max-w-[1280px]">
                <p className={'text-xs font-bold uppercase tracking-[0.1em] ' + styles.positive}>Investment research</p>
                <h1 className={'mt-1 text-2xl font-bold ' + styles.textPrimary}>Selected security</h1>
            </div>
            <div role="status" className={'mx-auto mt-5 grid max-w-[1280px] gap-4 rounded-lg border p-4 min-[700px]:grid-cols-[230px_minmax(0,1fr)] ' + styles.panel}>
                <div className="grid content-start gap-3 border-b pb-4 min-[700px]:border-b-0 min-[700px]:border-r min-[700px]:pb-0 min-[700px]:pr-4">
                    <div className="h-10 w-full motion-safe:animate-pulse rounded bg-emerald-400/20" />
                    {[0, 1, 2].map((item) => <div key={item} className="h-14 w-full motion-safe:animate-pulse rounded bg-emerald-400/15" />)}
                </div>
                <div className="grid content-start gap-4">
                    <div className="h-24 w-full motion-safe:animate-pulse rounded bg-emerald-400/20" />
                    <div className="h-16 w-full motion-safe:animate-pulse rounded bg-emerald-400/15" />
                    <div className="h-64 w-full motion-safe:animate-pulse rounded bg-emerald-400/10" />
                </div>
                <span className="sr-only">Loading research workspace...</span>
            </div>
        </div>
    );
};
