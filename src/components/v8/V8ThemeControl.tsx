'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { V8_THEME_STORAGE_KEY, parseV8ThemeChoice, type V8ThemeChoice } from './v8-theme';
import styles from './market-v8.module.css';

const listeners = new Set<() => void>();
let lastChoice: V8ThemeChoice = 'system';
let sessionOverride: V8ThemeChoice | null = null;

const notify = () => listeners.forEach(listener => listener());
const storageChanged = (event: StorageEvent) => {
    if (event.key !== V8_THEME_STORAGE_KEY && event.key !== null) return;
    try {
        if (event.storageArea !== null && event.storageArea !== window.localStorage) return;
    } catch { /* A storage event can still supply the choice when access is blocked. */ }
    sessionOverride = null;
    lastChoice = parseV8ThemeChoice(event.newValue);
    notify();
};
const subscribe = (listener: () => void) => {
    listeners.add(listener);
    if (listeners.size === 1) window.addEventListener('storage', storageChanged);
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener('storage', storageChanged);
    };
};
const readChoice = (): V8ThemeChoice => {
    if (sessionOverride !== null) return sessionOverride;
    try { lastChoice = parseV8ThemeChoice(window.localStorage.getItem(V8_THEME_STORAGE_KEY)); } catch { /* Keep the last observed or selected choice. */ }
    return lastChoice;
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
        lastChoice = next;
        sessionOverride = next;
        try {
            if (next === 'system') window.localStorage.removeItem(V8_THEME_STORAGE_KEY);
            else window.localStorage.setItem(V8_THEME_STORAGE_KEY, next);
            sessionOverride = null;
        } catch { /* Storage can be unavailable; the choice still applies until reload. */ }
        notify();
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
