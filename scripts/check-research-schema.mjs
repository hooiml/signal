import nextEnv from '@next/env';
import { neon } from '@neondatabase/serverless';

// Deployment preflight only. Never called by a request; never executes DDL.
nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for schema inspection.');
const sql = neon(process.env.DATABASE_URL);
const required = {
    research_records: {
        user_id: 'varchar', symbol: 'varchar', market_type: 'varchar', company_name: 'varchar',
        position_state: 'varchar', in_buy_zone: 'bool', research_status: 'varchar',
        target_buy_zone: 'varchar', valuation_state: 'varchar', thesis_strength: 'varchar',
        why_interested: 'text', bull_case: 'text', bear_case: 'text', buy_trigger: 'text',
        sell_trigger: 'text', thesis_break: 'text', notes: 'text', checklist: 'jsonb',
        monitoring_rules: 'jsonb', accepted_evidence: 'jsonb', decision_journal: 'jsonb',
        position_plan: 'jsonb', review_history: 'jsonb', last_reviewed_at: 'date',
        created_at: 'timestamptz', updated_at: 'timestamptz', revision: 'int4',
    },
    research_archived_symbols: { user_id: 'varchar', symbol: 'varchar', archived_at: 'timestamptz' },
};
try {
    const [columns] = await sql.transaction([
        sql`SELECT table_name, column_name, udt_name, is_nullable
            FROM information_schema.columns
            WHERE table_schema = current_schema()
                AND table_name IN ('research_records', 'research_archived_symbols')`,
    ], { readOnly: true, fetchOptions: { signal: AbortSignal.timeout(15000) } });
    const issues = [];
    for (const [table, fields] of Object.entries(required)) {
        for (const [field, type] of Object.entries(fields)) {
            const column = columns.find(row => row.table_name === table && row.column_name === field);
            if (!column) issues.push(`${table}.${field}: missing`);
            else if (column.udt_name !== type || column.is_nullable !== 'NO') {
                issues.push(`${table}.${field}: expected ${type} NOT NULL`);
            }
        }
    }
    console.log(JSON.stringify({ checkedAt: new Date().toISOString(), target: 'configured DATABASE_URL (identity redacted)',
        scope: 'Required Research read columns, types and nullability; not a full migration audit',
        readOnly: true, ready: issues.length === 0, issues }, null, 2));
    if (issues.length) process.exitCode = 1;
} catch {
    // Connection errors can include connection details; do not print credentials.
    console.error('Research schema inspection failed. Check database access; no schema changes were attempted.');
    process.exitCode = 1;
}
