import type { Metadata } from 'next';
import { V9Workspace } from '@/components/v9/V9Workspace';
import { firstRouteValue } from '@/lib/legacy-routes';
import { readSavedMarketPulses } from '@/lib/v9-market-pulse';
import { resolveV9View } from '@/lib/v9-view';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Signal — Calm Investing Workspace',
    robots: { index: false, follow: false },
};

export default async function SignalV9Page({ searchParams }: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = await searchParams;
    const get = (name: string) => firstRouteValue(params[name]) ?? null;
    const savedPulses = resolveV9View(get('view'), get('ticker')) === 'market'
        ? await readSavedMarketPulses()
        : [];
    return <V9Workspace savedPulses={savedPulses} />;
}
