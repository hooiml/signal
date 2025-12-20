import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'edge';

export const GET = async (): Promise<NextResponse> => {
    try {
        const result = await sql`SELECT NOW() as current_time, version() as pg_version`;

        return NextResponse.json({
            success: true,
            message: 'Neon connection successful',
            data: result[0]
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
};
