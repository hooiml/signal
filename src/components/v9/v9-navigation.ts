'use client';

import { createContext } from 'react';
import type { SignalConfig } from '@/lib/signal-config';

export type V9View = 'home' | 'market' | 'portfolio' | 'discover' | 'research' | 'learn';
export type V9Href = (view: V9View, params?: Record<string, string>) => string;

/** Shared controls use their original destinations outside the V9 workspace. */
export const V9Navigation = createContext<V9Href | null>(null);

export function workspaceHref(view: V9View, config: SignalConfig, params: Record<string, string> = {}): string {
    const query = new URLSearchParams({
        ...(view === 'home' ? {} : { view }),
        market: config.market,
        mode: config.mode,
        enableSocial: String(config.enableSocial),
        ...params,
    });
    return `/v9?${query}`;
}
