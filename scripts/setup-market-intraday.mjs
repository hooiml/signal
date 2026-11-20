import nextEnv from '@next/env';
import { neon } from '@neondatabase/serverless';
import { readMarketIntradayProvisioning } from '../src/lib/market-intraday-schema.mjs';

try {
    const provisioning = await readMarketIntradayProvisioning();
    if (process.argv.length === 3 && process.argv[2] === '--print-sql') {
        console.log(provisioning);
    } else if (process.argv.length === 2) {
        nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
        if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
        const sql = neon(process.env.DATABASE_URL);
        await sql.query(provisioning, [], { fetchOptions: { signal: AbortSignal.timeout(30000) } });
        console.log('Market intraday storage provisioned.');
    } else {
        throw new Error('Usage: node scripts/setup-market-intraday.mjs [--print-sql]');
    }
} catch (error) {
    if (error instanceof Error && error.name !== 'NeonDbError') console.error(error.message);
    else console.error('Market intraday provisioning failed. Check database connectivity, privileges, and the daily snapshot table.');
    process.exitCode = 1;
}
