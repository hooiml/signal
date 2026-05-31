import { NextResponse } from 'next/server';
import { requireBearerSecret } from '@/lib/route-auth';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

export const GET = async (request: Request): Promise<NextResponse> => {
    const authError = requireBearerSecret(
        request,
        process.env.CRON_SECRET,
        'CRON_SECRET is not configured'
    );
    if (authError) {
        return authError;
    }

    try {
        const result = await sql`SELECT NOW() as current_time, version() as pg_version`;

        return NextResponse.json({
            success: true,
            message: 'Neon connection successful',
            data: result[0],
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
};
