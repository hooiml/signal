import nextEnv from '@next/env';
import { neon } from '@neondatabase/serverless';

nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for schema inspection.');
const sql = neon(process.env.DATABASE_URL);
const required = {
    id: 'uuid', market_type: 'varchar', mode: 'varchar', enable_social: 'bool', snapshot_date: 'date',
    composite_score: 'int4', tier: 'varchar', confidence_level: 'varchar', agreement_pct: 'int4',
    majority_signal: 'varchar', components: 'jsonb', score_drivers: 'jsonb', index_trend: 'jsonb',
    signal_quality: 'jsonb', interpretation_context: 'jsonb', metadata_snapshot: 'jsonb',
    created_at: 'timestamptz', updated_at: 'timestamptz', origin: 'varchar', coverage_note: 'text',
};
try {
    const [columns, indexes] = await sql.transaction([
        sql`SELECT column_name, udt_name, is_nullable, column_default FROM information_schema.columns
            WHERE table_schema = current_schema() AND table_name = 'signal_snapshots'`,
        sql`SELECT i.indisunique, i.indimmediate, i.indisvalid, i.indisready,
                i.indpred IS NULL AS unfiltered, i.indexprs IS NULL AS plain_columns,
                pg_get_indexdef(i.indexrelid) AS definition,
                ARRAY(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, position)
                    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
                    WHERE k.position <= i.indnkeyatts ORDER BY k.position) AS columns
            FROM pg_index i JOIN pg_class t ON t.oid = i.indrelid
                JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = current_schema() AND t.relname = 'signal_snapshots'`,
    ], { readOnly: true, fetchOptions: { signal: AbortSignal.timeout(15000) } });
    const issues = [];
    for (const [name, type] of Object.entries(required)) {
        const column = columns.find(c => c.column_name === name);
        if (!column || column.udt_name !== type) issues.push(`${name}: missing or incorrect type (expected ${type})`);
        else if (!['created_at', 'updated_at', 'coverage_note'].includes(name) && column.is_nullable !== 'NO') issues.push(`${name}: expected NOT NULL`);
    }
    for (const name of ['id', 'enable_social', 'created_at', 'updated_at', 'origin']) {
        if (!columns.find(c => c.column_name === name)?.column_default) issues.push(`${name}: required insert default is missing`);
    }
    const originDefault = columns.find(c => c.column_name === 'origin')?.column_default;
    if (originDefault && !/^'observed'::/.test(originDefault)) issues.push('origin: expected observed default');
    const keys = ['market_type', 'mode', 'enable_social', 'snapshot_date'];
    const usable = indexes.filter(i => i.indisvalid && i.indisready && i.unfiltered && i.plain_columns);
    if (!usable.some(i => i.indisunique && i.indimmediate && i.columns.length === keys.length && keys.every(key => i.columns.includes(key)))) issues.push('Missing usable composite unique index for snapshot upsert');
    if (!usable.some(i => keys.every((key, position) => i.columns[position] === key) && i.definition.includes('snapshot_date DESC'))) issues.push('Missing descending snapshot lookup index');
    console.log(JSON.stringify({ checkedAt: new Date().toISOString(), target: 'configured DATABASE_URL (identity redacted)',
        scope: 'Snapshot columns, insert defaults and valid upsert/lookup indexes; not a full migration audit',
        readOnly: true, ready: issues.length === 0, issues }, null, 2));
    if (issues.length) process.exitCode = 1;
} catch {
    console.error('Market schema inspection failed. Check database access; no schema changes were attempted.');
    process.exitCode = 1;
}
