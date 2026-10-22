// V8 colour theme: an explicit Light/Dark choice is stored per browser; otherwise the system setting applies.
export const V8_THEME_STORAGE_KEY = 'signal-v8-theme-v1';

export type V8ThemeChoice = 'system' | 'light' | 'dark';

export const parseV8ThemeChoice = (value: unknown): V8ThemeChoice =>
    value === 'light' || value === 'dark' ? value : 'system';

/** Inlined in the root layout so the resolved theme is on <html> before first paint. */
export const v8ThemeBootScript = `(function(){try{var v=localStorage.getItem(${JSON.stringify(V8_THEME_STORAGE_KEY)});var t=v==='light'||v==='dark'?v:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-v8-theme',t);}catch(e){}})();`;
