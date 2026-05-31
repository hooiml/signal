import { NextResponse } from 'next/server';
import { refreshAAIIIndicator } from '@/lib/institutional-service';
import { requireAnyBearerSecret } from '@/lib/route-auth';

export const runtime = 'nodejs';
export const maxDuration = 20;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    return handleInstitutionalRefresh(request);
}

export async function POST(request: Request) {
    return handleInstitutionalRefresh(request);
}

async function handleInstitutionalRefresh(request: Request) {
    const authError = requireAnyBearerSecret(
        request,
        [process.env.CRON_SECRET, process.env.ADMIN_SECRET],
        'CRON_SECRET or ADMIN_SECRET must be configured'
    );
    if (authError) {
        return authError;
    }

    try {
        const aaii = await refreshAAIIIndicator();

        return NextResponse.json({
            success: true,
            updated: {
                indicator: 'aaii',
                value: aaii.bullish,
                report_date: aaii.reportDate,
                neutral: aaii.neutral,
                bearish: aaii.bearish,
                bull_bear_spread: aaii.bullBearSpread,
                source: aaii.source,
                source_url: aaii.sourceUrl,
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Institutional refresh error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown institutional refresh error',
            },
            { status: 500 }
        );
    }
}
