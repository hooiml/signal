import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { getTrendDiscovery } from '@/lib/research/discovery';

export const dynamic = 'force-dynamic';
const getCachedTrendDiscovery = unstable_cache(getTrendDiscovery, ['quality-trend-discovery-v8'], { revalidate: 3600 });

export const GET = async (): Promise<NextResponse> => {
    try {
        return NextResponse.json({ success: true, data: await getCachedTrendDiscovery() });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Trend discovery is temporarily unavailable.',
        }, { status: 502 });
    }
};
