import type { SignalConfig } from './signal-config';

// These are the aliases that actually shipped. There has never been a V3 route.
export const legacyMarketPaths = ['/main-v2', '/main-v4', '/main-v5', '/main-v6', '/main-v7', '/backup/main'] as const;
export const legacyResearchPaths = ['/research-v2', '/research-v4', '/research-v5', '/research-v6', '/research-v7', '/backup/research'] as const;
const researchTaskKeys = new Set(['workspace', 'tab', 'review', 'query', 'decision', 'density', 'setup', 'queueTask', 'returnTo']);

export function hasResearchTask(params: URLSearchParams): boolean {
    return Array.from(params.keys()).some(key => researchTaskKeys.has(key) || key.startsWith('context'));
}

/** Choose a local pathname only. The caller retains the original query and hash. */
export function legacyRouteDestination(pathname: string, params: URLSearchParams): string | null {
    if (pathname === '/' || legacyMarketPaths.some(path => path === pathname)) return '/main-v8';
    if (pathname === '/research' || legacyResearchPaths.some(path => path === pathname)) {
        const destination = hasResearchTask(params) ? '/research' : '/research-v8';
        return destination === pathname ? null : destination;
    }
    return null;
}

export const legacyMarketAnchors = new Set([
    'drivers-title', 'market-trust-limitations', 'market-score-sensitivity-title',
    'historical-calibration', 'market-alerts-title', 'market-context-title',
    'market-watchlist-exposure-title', 'score-evidence-title',
]);

export function marketRouteConfig(params: Pick<URLSearchParams, 'get'>): Partial<SignalConfig> {
    const market = params.get('market');
    const mode = params.get('mode');
    const social = params.get('enableSocial');
    return {
        ...(market === 'US' || market === 'MY' ? { market } : {}),
        ...(mode === 'standard' || mode === 'contrarian' ? { mode } : {}),
        ...(social === 'true' || social === 'false' ? { enableSocial: social === 'true' } : {}),
    };
}

export function firstRouteValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}
