export type MarketMode = 'standard' | 'contrarian';
export type MarketRegion = 'US' | 'MY';
export interface SignalConfig {
    mode: MarketMode;
    market: MarketRegion;
    enableSocial: boolean;
}

export const SIGNAL_CONFIG_KEY = 'signal-dashboard-config';
export const DEFAULT_SIGNAL_CONFIG: SignalConfig = { mode: 'standard', market: 'US', enableSocial: true };

export const isSignalConfig = (value: unknown): value is SignalConfig => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const config = value as Partial<SignalConfig>;
    return Object.keys(value).length === 3 && Object.keys(value).every(key => ['mode', 'market', 'enableSocial'].includes(key))
        && (config.mode === 'standard' || config.mode === 'contrarian')
        && (config.market === 'US' || config.market === 'MY')
        && typeof config.enableSocial === 'boolean';
};

/** Reading never repairs storage. Only an explicit user change may replace it. */
export function readSignalConfig(): { config: SignalConfig; error: string } {
    let raw: string | null;
    try { raw = window.localStorage.getItem(SIGNAL_CONFIG_KEY); }
    catch { return { config: DEFAULT_SIGNAL_CONFIG, error: 'Could not read saved defaults. Using US, Momentum and social included for now. Check browser storage and reopen Settings to retry.' }; }
    if (raw === null) return { config: DEFAULT_SIGNAL_CONFIG, error: '' };
    try {
        const value: unknown = JSON.parse(raw);
        if (isSignalConfig(value)) return { config: { mode: value.mode, market: value.market, enableSocial: value.enableSocial }, error: '' };
    } catch { /* Preserve malformed bytes until an explicit Save. */ }
    return { config: DEFAULT_SIGNAL_CONFIG, error: 'Saved defaults could not be read. Using US, Momentum and social included for now. The original data stays untouched until you save defaults.' };
}

export function writeSignalConfig(config: SignalConfig): void {
    if (!isSignalConfig(config)) throw new Error('Choose a valid market, mode and social setting.');
    try {
        window.localStorage.setItem(SIGNAL_CONFIG_KEY, JSON.stringify({ mode: config.mode, market: config.market, enableSocial: config.enableSocial }));
    } catch { throw new Error('Could not save defaults. Browser storage may be blocked or full. Your previous defaults were kept; try again.'); }
}
