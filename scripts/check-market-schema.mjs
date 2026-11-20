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
const requiredIntraday = {
    id: 'int8', market_type: 'varchar', mode: 'varchar', enable_social: 'bool', snapshot_date: 'date',
    recorded_at: 'timestamptz', composite_score: 'int4', tier: 'varchar', components: 'jsonb', metadata_snapshot: 'jsonb',
};
try {
    const [allColumns, indexes, captureTriggers, constraints] = await sql.transaction([
        sql`SELECT table_schema, table_name, column_name, udt_name, is_nullable, column_default, identity_generation
            FROM information_schema.columns
            WHERE table_schema = current_schema() AND table_name IN ('signal_snapshots', 'signal_intraday_observations')`,
        sql`SELECT i.indisunique, i.indimmediate, i.indisvalid, i.indisready,
                t.relname AS table_name,
                i.indpred IS NULL AS unfiltered, i.indexprs IS NULL AS plain_columns,
                pg_get_indexdef(i.indexrelid) AS definition,
                ARRAY(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, position)
                    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
                    WHERE k.position <= i.indnkeyatts ORDER BY k.position) AS columns
            FROM pg_index i JOIN pg_class t ON t.oid = i.indrelid
                JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = current_schema() AND t.relname IN ('signal_snapshots', 'signal_intraday_observations')`,
        sql`SELECT tr.tgenabled, tr.tgtype, p.proname, p.provolatile, pn.nspname AS function_schema
            FROM pg_trigger tr JOIN pg_class t ON t.oid = tr.tgrelid
                JOIN pg_namespace n ON n.oid = t.relnamespace JOIN pg_proc p ON p.oid = tr.tgfoid
                JOIN pg_namespace pn ON pn.oid = p.pronamespace
            WHERE n.nspname = current_schema() AND t.relname = 'signal_snapshots'
                AND NOT tr.tgisinternal AND tr.tgname = 'capture_signal_intraday'`,
        sql`SELECT pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = current_schema() AND t.relname = 'signal_intraday_observations'
                AND c.conname = 'signal_intraday_utc_day' AND c.contype = 'c' AND c.convalidated`,
    ], { readOnly: true, fetchOptions: { signal: AbortSignal.timeout(15000) } });
    const issues = [];
    const columns = allColumns.filter(column => column.table_name === 'signal_snapshots');
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
    const usableIndexes = indexes.filter(i => i.indisvalid && i.indisready && i.unfiltered && i.plain_columns);
    const usable = usableIndexes.filter(i => i.table_name === 'signal_snapshots');
    if (!usable.some(i => i.indisunique && i.indimmediate && i.columns.length === keys.length && keys.every(key => i.columns.includes(key)))) issues.push('Missing usable composite unique index for snapshot upsert');
    if (!usable.some(i => keys.every((key, position) => i.columns[position] === key) && i.definition.includes('snapshot_date DESC'))) issues.push('Missing descending snapshot lookup index');
    const intradayColumns = allColumns.filter(column => column.table_name === 'signal_intraday_observations');
    for (const [name, type] of Object.entries(requiredIntraday)) {
        const column = intradayColumns.find(c => c.column_name === name);
        if (!column || column.udt_name !== type || column.is_nullable !== 'NO') {
            issues.push(`signal_intraday_observations.${name}: expected NOT NULL ${type}`);
        }
    }
    if (intradayColumns.find(c => c.column_name === 'id')?.identity_generation !== 'ALWAYS') issues.push('Missing intraday always-generated identity');
    const intradayIndexes = usableIndexes.filter(i => i.table_name === 'signal_intraday_observations');
    if (!intradayIndexes.some(i => i.indisunique && i.indimmediate && i.columns.length === 1 && i.columns[0] === 'id')) issues.push('Missing unique intraday identity index');
    const intradayKeys = [...keys, 'id'];
    if (!intradayIndexes.some(i => intradayKeys.every((key, position) => i.columns[position] === key) && i.definition.includes('id DESC'))) issues.push('Missing descending intraday lookup index');
    if (!constraints.some(c => c.definition.includes("AT TIME ZONE 'UTC'") && c.definition.includes('snapshot_date') && c.definition.includes('recorded_at'))) issues.push('Missing validated intraday UTC capture-day check');
    // PostgreSQL trigger type flags: row (1), insert (4), update (16), and no BEFORE/INSTEAD flag.
    if (!captureTriggers.some(t => ['O', 'A'].includes(t.tgenabled) && Number(t.tgtype) === 21
        && t.proname === 'capture_signal_intraday_observation' && t.provolatile === 'v'
        && intradayColumns.some(c => c.table_schema === t.function_schema))) {
        issues.push('Missing enabled intraday capture trigger on signal_snapshots');
    }
    console.log(JSON.stringify({ checkedAt: new Date().toISOString(), target: 'configured DATABASE_URL (identity redacted)',
        scope: 'Daily and intraday snapshot columns, insert defaults, indexes, UTC check and capture trigger',
        readOnly: true, ready: issues.length === 0, issues }, null, 2));
    if (issues.length) process.exitCode = 1;
} catch {
    console.error('Market schema inspection failed. Check database access; no schema changes were attempted.');
    process.exitCode = 1;
}
