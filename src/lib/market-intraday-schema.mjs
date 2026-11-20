import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** One atomic statement shared by fresh schema, protected setup and focused upgrades. */
export async function readMarketIntradayProvisioning() {
    const schema = await readFile(join(process.cwd(), 'schema.sql'), 'utf8');
    const match = schema.match(/^-- BEGIN MARKET INTRADAY PROVISIONING\r?\n([\s\S]*?)^-- END MARKET INTRADAY PROVISIONING$/m);
    if (!match?.[1]) throw new Error('Market intraday provisioning is missing from schema.sql.');
    return match[1].trim();
}
