import type { Metadata } from 'next';
import { Suspense } from 'react';
import { V9Workspace, type V9View } from '@/components/v9/V9Workspace';
import { firstRouteValue } from '@/lib/legacy-routes';

export const metadata: Metadata = {
    title: 'Signal — Calm Investing Workspace',
    robots: { index: false, follow: false },
};

const views = new Set<V9View>(['home', 'market', 'portfolio', 'discover', 'research']);

export default async function SignalV9Page({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = await searchParams;
    const rawView = firstRouteValue(params.view);
    const rawMarket = firstRouteValue(params.market);
    const rawTicker = firstRouteValue(params.ticker);
    const initialView: V9View = rawView && views.has(rawView as V9View) ? (rawView as V9View) : 'home';
    const initialMarket = rawMarket === 'MY' || rawMarket === 'US' ? rawMarket : undefined;

    return (
        <Suspense fallback={<div style={{ padding: 24 }}>Loading Signal workspace…</div>}>
            <V9Workspace
                initialView={initialView}
                initialMarket={initialMarket}
                initialTicker={rawTicker}
            />
        </Suspense>
    );
}
