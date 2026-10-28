import type { Metadata } from 'next';
import { ResearchV8 } from '@/components/v8/ResearchV8';
import { ResearchV8Connected } from '@/components/v8/ResearchV8Connected';
import { parseDiscoverView } from '@/components/v8/discover-view';
import { firstRouteValue } from '@/lib/legacy-routes';
import { parseEarningsCalendarTarget } from '@/lib/research/earnings-ticket';

export const metadata: Metadata = { title: 'Company research · Signal V8', robots: { index: false, follow: false } };

export default async function ResearchPageV8({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const params = await searchParams;
    const ticker = firstRouteValue(params.ticker)?.trim().toUpperCase();
    const market = firstRouteValue(params.market);
    const calendarTarget = firstRouteValue(params.discover) === 'calendar' ? parseEarningsCalendarTarget(ticker, market, firstRouteValue(params.calendarDate)) : undefined;
    return firstRouteValue(params.demo) === '1' ? <ResearchV8 /> : <ResearchV8Connected initialCalendarTarget={calendarTarget} initialMarket={market === 'MY' ? 'MY' : market === 'US' ? 'US' : undefined} initialTicker={ticker} initialDiscover={parseDiscoverView(firstRouteValue(params.discover))} />;
}
