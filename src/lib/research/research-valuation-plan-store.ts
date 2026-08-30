import { sql } from '@/lib/db';
import { normalizeResearchMemoryTicker } from './research-memory';
import { createResearchValuationPlan, parseResearchValuationPlan, type ResearchValuationPlan } from './research-valuation-plan';

const ensureValuationPlanTable = async () => {
    await sql`
        CREATE TABLE IF NOT EXISTS research_valuation_plans (
            user_id VARCHAR(255) NOT NULL DEFAULT 'default',
            ticker VARCHAR(20) NOT NULL,
            payload JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (user_id, ticker)
        )
    `;
};

const readPayload = (row: unknown, ticker: string): ResearchValuationPlan => {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) return createResearchValuationPlan(ticker);
    const payload = (row as Record<string, unknown>).payload;
    return parseResearchValuationPlan(payload);
};

export const findStoredResearchValuationPlan = async (tickerInput: string): Promise<ResearchValuationPlan | null> => {
    await ensureValuationPlanTable();
    const ticker = normalizeResearchMemoryTicker(tickerInput);
    const rows = await sql`SELECT payload FROM research_valuation_plans WHERE user_id = 'default' AND ticker = ${ticker} LIMIT 1`;
    return rows[0] ? readPayload(rows[0], ticker) : null;
};

export const getStoredResearchValuationPlan = async (tickerInput: string): Promise<ResearchValuationPlan> => {
    const ticker = normalizeResearchMemoryTicker(tickerInput);
    return (await findStoredResearchValuationPlan(ticker)) ?? createResearchValuationPlan(ticker);
};

export const saveStoredResearchValuationPlan = async (input: unknown): Promise<ResearchValuationPlan> => {
    await ensureValuationPlanTable();
    const plan = parseResearchValuationPlan(input);
    await sql`
        INSERT INTO research_valuation_plans (user_id, ticker, payload)
        VALUES ('default', ${plan.ticker}, ${JSON.stringify(plan)})
        ON CONFLICT (user_id, ticker) DO UPDATE SET
            payload = EXCLUDED.payload,
            updated_at = NOW()
    `;
    return plan;
};
