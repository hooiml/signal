import { neon, neonConfig } from '@neondatabase/serverless';

// Enable connection caching for serverless
neonConfig.fetchConnectionCache = true;

const sql = neon(process.env.DATABASE_URL!);

export { sql };

// Type-safe query helper
export const query = async <T>(
  queryText: string,
  params: unknown[] = []
): Promise<T[]> => {
  const result = await sql(queryText, params);
  return result as T[];
};
