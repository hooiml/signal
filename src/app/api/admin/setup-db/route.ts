
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    const adminSecret = process.env.ADMIN_SECRET;

    if (!adminSecret) {
        return NextResponse.json({ error: 'ADMIN_SECRET is not configured' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${adminSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Create institutional_data table
        await sql`
            CREATE TABLE IF NOT EXISTS institutional_data (
                id SERIAL PRIMARY KEY,
                indicator_name VARCHAR(50) NOT NULL,
                value DECIMAL(10, 4) NOT NULL,
                report_date DATE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(indicator_name, report_date)
            )
        `;

        return NextResponse.json({
            success: true,
            message: 'Database setup complete: institutional_data table created or already exists.'
        });
    } catch (error) {
        console.error('Migration error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
