
import { NextResponse } from 'next/server';
import { requireBearerSecret } from '@/lib/route-auth';
import { sql } from '@/lib/db';

export async function GET(request: Request) {
    const authError = requireBearerSecret(
        request,
        process.env.ADMIN_SECRET,
        'ADMIN_SECRET is not configured'
    );
    if (authError) {
        return authError;
    }

    try {
        await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

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

        await sql`
            CREATE TABLE IF NOT EXISTS signal_snapshots (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                market_type VARCHAR(10) NOT NULL CHECK (market_type IN ('US', 'MY')),
                mode VARCHAR(20) NOT NULL CHECK (mode IN ('standard', 'contrarian')),
                enable_social BOOLEAN NOT NULL DEFAULT true,
                snapshot_date DATE NOT NULL,
                composite_score INTEGER NOT NULL CHECK (composite_score BETWEEN 0 AND 100),
                tier VARCHAR(20) NOT NULL,
                confidence_level VARCHAR(20) NOT NULL,
                agreement_pct INTEGER NOT NULL,
                majority_signal VARCHAR(20) NOT NULL,
                components JSONB NOT NULL,
                score_drivers JSONB NOT NULL,
                index_trend JSONB NOT NULL,
                signal_quality JSONB NOT NULL,
                interpretation_context JSONB NOT NULL,
                metadata_snapshot JSONB NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(market_type, mode, enable_social, snapshot_date)
            )
        `;

        await sql`
            CREATE INDEX IF NOT EXISTS idx_signal_snapshots_lookup
            ON signal_snapshots(market_type, mode, enable_social, snapshot_date DESC)
        `;

        return NextResponse.json({
            success: true,
            message: 'Database setup complete: institutional_data and signal_snapshots tables created or already exist.',
        });
    } catch (error) {
        console.error('Migration error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
