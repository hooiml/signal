'use client';

import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from 'react';
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
export const setV8ThemeChoice = (next: V8ThemeChoice) => {
    let persisted = true;
    lastChoice = next;
    sessionOverride = next;
    try {
        if (next === 'system') window.localStorage.removeItem(V8_THEME_STORAGE_KEY);
        else window.localStorage.setItem(V8_THEME_STORAGE_KEY, next);
        sessionOverride = null;
    } catch { persisted = false; }
    notify();
    return persisted;
};

/** Auto / Light / Dark for the V8 pages. Auto follows the system setting and stores nothing. */
export function V8ThemeControl() {
    const [storageError, setStorageError] = useState(false);
    const choice = useSyncExternalStore(subscribe, readChoice, () => 'system' as const);
    // Each instance needs its own radio group name, or two headers on one page would share one checked radio.
    const group = useId();
    useEffect(() => {
        const apply = () => document.documentElement.setAttribute('data-v8-theme', choice === 'system' ? systemDark().matches ? 'dark' : 'light' : choice);
        apply();
        if (choice !== 'system') return;
        const media = systemDark();
        media.addEventListener('change', apply);
        return () => media.removeEventListener('change', apply);
    }, [choice]);
    // Native radios give arrow-key movement between the three choices.
    return <><div className={styles.themeControl} role="radiogroup" aria-label="Colour theme">
        {themeOptions.map(option => <label key={option.value} title={option.title}>
            <input type="radio" name={group} value={option.value} checked={choice === option.value} onChange={() => setStorageError(!setV8ThemeChoice(option.value))} />
            <svg aria-hidden="true" viewBox="0 0 24 24">{option.icon}</svg>
            <span>{option.label}</span>
        </label>)}
    </div>{storageError && <p role="alert">Theme applied for this session. Browser storage is unavailable, so it may reset after reload.</p>}</>;
}

const themeOptions: readonly { value: V8ThemeChoice; label: string; title: string; icon: ReactNode }[] = [
    { value: 'light', label: 'Light', title: 'Light theme', icon: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></> },
    { value: 'system', label: 'Auto', title: 'Follow the system setting', icon: <><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" /></> },
    { value: 'dark', label: 'Dark', title: 'Dark theme', icon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /> },
];
