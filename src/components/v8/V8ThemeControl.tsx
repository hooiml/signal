'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { V8_THEME_STORAGE_KEY, parseV8ThemeChoice, type V8ThemeChoice } from './v8-theme';
import styles from './market-v8.module.css';

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
    listeners.add(listener);
    window.addEventListener('storage', listener);
    return () => { listeners.delete(listener); window.removeEventListener('storage', listener); };
};
const readChoice = (): V8ThemeChoice => {
    try { return parseV8ThemeChoice(window.localStorage.getItem(V8_THEME_STORAGE_KEY)); } catch { return 'system'; }
};
const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)');

/** Auto / Light / Dark for the V8 pages. Auto follows the system setting and stores nothing. */
export function V8ThemeControl() {
    const choice = useSyncExternalStore(subscribe, readChoice, () => 'system' as const);
    useEffect(() => {
        const apply = () => document.documentElement.setAttribute('data-v8-theme', choice === 'system' ? systemDark().matches ? 'dark' : 'light' : choice);
        apply();
        if (choice !== 'system') return;
        const media = systemDark();
        media.addEventListener('change', apply);
        return () => media.removeEventListener('change', apply);
    }, [choice]);
    const change = (next: V8ThemeChoice) => {
        try {
            if (next === 'system') window.localStorage.removeItem(V8_THEME_STORAGE_KEY);
            else window.localStorage.setItem(V8_THEME_STORAGE_KEY, next);
        } catch { /* Storage can be unavailable; the choice still applies until reload. */ }
        listeners.forEach(listener => listener());
        if (next !== 'system') document.documentElement.setAttribute('data-v8-theme', next);
    };
    return <label className={styles.themeControl}>
        <span className={styles.visuallyHidden}>Colour theme</span>
        <select value={choice} onChange={event => change(parseV8ThemeChoice(event.target.value))}>
            <option value="system">Auto</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
        </select>
    </label>;
}
