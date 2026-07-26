import { NextResponse } from 'next/server';
import { getSourceHealthReport } from '@/lib/source-health';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const GET = async (): Promise<NextResponse> => {
    try {
        return NextResponse.json(
            { success: true, data: await getSourceHealthReport() },
            { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
        );
    } catch (error) {
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Source health is unavailable.' }, { status: 503 });
    }
};
