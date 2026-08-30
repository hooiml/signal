import { sql } from '@/lib/db';
import { normalizeResearchMemoryTicker } from './research-memory.ts';
import { parseResearchDecisionCalibration, type ResearchDecisionCalibration } from './research-decision-calibration';

const MAX_REVIEWS_PER_TICKER = 24;

const ensureTable = async () => {
    await sql`
        CREATE TABLE IF NOT EXISTS research_decision_calibrations (
            user_id VARCHAR(255) NOT NULL DEFAULT 'default',
            ticker VARCHAR(20) NOT NULL,
            calibration_id VARCHAR(180) NOT NULL,
            reviewed_at TIMESTAMPTZ NOT NULL,
            payload JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (user_id, ticker, calibration_id)
        )
    `;
    await sql`CREATE INDEX IF NOT EXISTS research_decision_calibrations_idx ON research_decision_calibrations (user_id, ticker, reviewed_at DESC)`;
};

const rowPayload = (row: unknown) => {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) throw new Error('Invalid calibration row.');
    return parseResearchDecisionCalibration((row as Record<string, unknown>).payload);
};

export const listStoredDecisionCalibrations = async (tickerInput: string): Promise<ResearchDecisionCalibration[]> => {
    await ensureTable();
    const ticker = normalizeResearchMemoryTicker(tickerInput);
    const rows = await sql`SELECT payload FROM research_decision_calibrations WHERE user_id='default' AND ticker=${ticker} ORDER BY reviewed_at DESC LIMIT ${MAX_REVIEWS_PER_TICKER}`;
    return rows.map(rowPayload);
};

export const saveStoredDecisionCalibration = async (input: unknown): Promise<ResearchDecisionCalibration> => {
    await ensureTable();
    const review = parseResearchDecisionCalibration(input);
    await sql`
        INSERT INTO research_decision_calibrations (user_id, ticker, calibration_id, reviewed_at, payload)
        VALUES ('default', ${review.ticker}, ${review.id}, ${review.reviewedAt}, ${JSON.stringify(review)})
        ON CONFLICT (user_id, ticker, calibration_id) DO UPDATE SET reviewed_at=EXCLUDED.reviewed_at, payload=EXCLUDED.payload, updated_at=NOW()
    `;
    await sql`
        DELETE FROM research_decision_calibrations
        WHERE user_id='default' AND ticker=${review.ticker} AND calibration_id IN (
            SELECT calibration_id FROM research_decision_calibrations
            WHERE user_id='default' AND ticker=${review.ticker}
            ORDER BY reviewed_at DESC OFFSET ${MAX_REVIEWS_PER_TICKER}
        )
    `;
    return review;
};
