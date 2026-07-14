
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

        await sql`
            CREATE TABLE IF NOT EXISTS research_records (
                user_id VARCHAR(255) NOT NULL DEFAULT 'default',
                symbol VARCHAR(20) NOT NULL,
                market_type VARCHAR(10) NOT NULL CHECK (market_type IN ('US', 'MY')),
                company_name VARCHAR(120) NOT NULL,
                position_state VARCHAR(20) NOT NULL DEFAULT 'not-owned',
                in_buy_zone BOOLEAN NOT NULL DEFAULT false,
                research_status VARCHAR(20) NOT NULL DEFAULT 'watch',
                target_buy_zone VARCHAR(120) NOT NULL DEFAULT '',
                valuation_state VARCHAR(20) NOT NULL DEFAULT 'unknown',
                thesis_strength VARCHAR(20) NOT NULL DEFAULT 'medium',
                why_interested TEXT NOT NULL DEFAULT '', bull_case TEXT NOT NULL DEFAULT '',
                bear_case TEXT NOT NULL DEFAULT '', buy_trigger TEXT NOT NULL DEFAULT '',
                sell_trigger TEXT NOT NULL DEFAULT '', thesis_break TEXT NOT NULL DEFAULT '',
                notes TEXT NOT NULL DEFAULT '', checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
                monitoring_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
                accepted_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
                review_history JSONB NOT NULL DEFAULT '[]'::jsonb,
                last_reviewed_at DATE NOT NULL DEFAULT CURRENT_DATE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (user_id, symbol, market_type)
            )
        `;

        await sql`
            ALTER TABLE research_records
                ADD COLUMN IF NOT EXISTS accepted_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
                ADD COLUMN IF NOT EXISTS review_history JSONB NOT NULL DEFAULT '[]'::jsonb,
                ADD COLUMN IF NOT EXISTS monitoring_rules JSONB NOT NULL DEFAULT '{}'::jsonb
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS research_archived_symbols (
                user_id VARCHAR(255) NOT NULL DEFAULT 'default',
                symbol VARCHAR(20) NOT NULL,
                archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (user_id, symbol)
            )
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS discovery_snapshots (
                snapshot_hour TIMESTAMPTZ PRIMARY KEY,
                generated_at TIMESTAMPTZ NOT NULL,
                candidates JSONB NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `;
        await sql`CREATE INDEX IF NOT EXISTS idx_discovery_snapshots_generated ON discovery_snapshots(generated_at DESC)`;

        return NextResponse.json({
            success: true,
            message: 'Database setup complete: institutional, signal snapshot, research, and discovery history tables are ready.',
        });
    } catch (error) {
        console.error('Migration error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
