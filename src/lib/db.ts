import { neon, neonConfig } from '@neondatabase/serverless';

// Enable connection caching for serverless
neonConfig.fetchConnectionCache = true;

const sql = neon(process.env.DATABASE_URL!);

export { sql };

