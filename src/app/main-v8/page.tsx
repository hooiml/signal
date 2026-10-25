import type { Metadata } from 'next';
import { MarketV8 } from '@/components/v8/MarketV8';
import { firstRouteValue } from '@/lib/legacy-routes';

export const metadata: Metadata = { title: 'Market overview · Signal V8', robots: { index: false, follow: false } };

export default async function MarketPageV8({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const params = await searchParams;
    const market = firstRouteValue(params.market);
    return <MarketV8 demo={firstRouteValue(params.demo) === '1'} initialMarket={market === 'MY' || market === 'US' ? market : undefined} />;
}
