import type { MarketMode, MarketRegion } from '../hooks/use-signal-config';

export const SIGNAL_CACHE_TTL_MS = 45_000;

type SignalCacheInput = {
    market: MarketRegion;
    mode: MarketMode;
    enableSocial: boolean;
};

type SignalCacheStatus = 'hit' | 'miss' | 'shared' | 'bypass';

type SignalCacheResult<Value> = {
    value: Value;
    status: SignalCacheStatus;
};

type SignalCacheOptions = {
    forceRefresh?: boolean;
    now?: () => number;
};

const cacheKey = ({ market, mode, enableSocial }: SignalCacheInput) =>
    `${market}:${mode}:${enableSocial ? 'social' : 'core'}`;

export const createSignalCache = <Value>(isCacheable: (value: Value) => boolean) => {
    const cached = new Map<string, { expiresAt: number; value: Value }>();
    const pending = new Map<string, Promise<Value>>();

    const get = async (
        input: SignalCacheInput,
        load: () => Promise<Value>,
        options: SignalCacheOptions = {},
    ): Promise<SignalCacheResult<Value>> => {
        const key = cacheKey(input);
        const now = options.now ?? Date.now;
        const inFlight = pending.get(key);
        if (inFlight) {
            return { value: await inFlight, status: 'shared' };
        }

        if (!options.forceRefresh) {
            const entry = cached.get(key);
            if (entry && entry.expiresAt > now()) {
                return { value: entry.value, status: 'hit' };
            }
            if (entry) cached.delete(key);
        }

        const loadPromise = load();
        pending.set(key, loadPromise);
        try {
            const value = await loadPromise;
            if (isCacheable(value)) {
                cached.set(key, { expiresAt: now() + SIGNAL_CACHE_TTL_MS, value });
            }
            return { value, status: options.forceRefresh ? 'bypass' : 'miss' };
        } finally {
            if (pending.get(key) === loadPromise) pending.delete(key);
        }
    };

    return {
        get,
        clear: () => {
            cached.clear();
            pending.clear();
        },
    };
};
