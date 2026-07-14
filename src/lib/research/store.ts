import { sql } from '@/lib/db';
import { parseResearchCreateInput, parseResearchRecord, parseResearchUpdateInput } from './input';
import { appendResearchReview, applyResearchUpdate, createResearchRecord } from './records';
import type { ResearchRecord, ResearchUpdateInput, ResearchUpdateMode } from '../types/research';

const ensureResearchTable = async () => {
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
            why_interested TEXT NOT NULL DEFAULT '',
            bull_case TEXT NOT NULL DEFAULT '',
            bear_case TEXT NOT NULL DEFAULT '',
            buy_trigger TEXT NOT NULL DEFAULT '',
            sell_trigger TEXT NOT NULL DEFAULT '',
            thesis_break TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
            monitoring_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
            accepted_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
            review_history JSONB NOT NULL DEFAULT '[]'::jsonb,
            last_reviewed_at DATE NOT NULL DEFAULT CURRENT_DATE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
};

export class ResearchConflictError extends Error {
    constructor(symbol: string) {
        super(`${symbol} is already in the research watchlist.`);
        this.name = 'ResearchConflictError';
    }
}

const readString = (row: Record<string, unknown>, key: string) => typeof row[key] === 'string' ? row[key] : '';
const readBoolean = (row: Record<string, unknown>, key: string) => row[key] === true;
const readDate = (row: Record<string, unknown>, key: string) => {
    const value = row[key];
    if (typeof value === 'string') return value.slice(0, 10);
    if (value instanceof Date) {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    throw new Error(`Invalid ${key} returned by database.`);
};

const mapRow = (raw: unknown): ResearchRecord => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('Invalid research record returned by database.');
    const row = Object.fromEntries(Object.entries(raw));
    const identity = parseResearchCreateInput({
        symbol: row.symbol,
        market: row.market_type,
        companyName: row.company_name,
    });
    const update = parseResearchUpdateInput({
        positionState: row.position_state,
        inBuyZone: readBoolean(row, 'in_buy_zone'),
        status: row.research_status,
        targetBuyZone: readString(row, 'target_buy_zone'),
        valuationState: row.valuation_state,
        thesisStrength: row.thesis_strength,
        whyInterested: readString(row, 'why_interested'),
        bullCase: readString(row, 'bull_case'),
        bearCase: readString(row, 'bear_case'),
        buyTrigger: readString(row, 'buy_trigger'),
        sellTrigger: readString(row, 'sell_trigger'),
        thesisBreak: readString(row, 'thesis_break'),
        notes: readString(row, 'notes'),
        checklist: row.checklist,
        monitoringRules: row.monitoring_rules,
        acceptedEvidence: row.accepted_evidence,
    });
    return parseResearchRecord({
        ...applyResearchUpdate(createResearchRecord(identity), update),
        reviewHistory: row.review_history,
        lastReviewedAt: readDate(row, 'last_reviewed_at'),
    });
};

const saveRecord = async (record: ResearchRecord): Promise<ResearchRecord> => {
    const rows = await sql`
        INSERT INTO research_records (
            user_id, symbol, market_type, company_name, position_state, in_buy_zone,
            research_status, target_buy_zone, valuation_state, thesis_strength,
            why_interested, bull_case, bear_case, buy_trigger, sell_trigger,
            thesis_break, notes, checklist, monitoring_rules, accepted_evidence, review_history, last_reviewed_at
        ) VALUES (
            'default', ${record.symbol}, ${record.market}, ${record.companyName},
            ${record.positionState}, ${record.inBuyZone}, ${record.status}, ${record.targetBuyZone},
            ${record.valuationState}, ${record.thesisStrength}, ${record.whyInterested},
            ${record.bullCase}, ${record.bearCase}, ${record.buyTrigger}, ${record.sellTrigger},
            ${record.thesisBreak}, ${record.notes}, ${JSON.stringify(record.checklist)},
            ${JSON.stringify(record.monitoringRules)}, ${JSON.stringify(record.acceptedEvidence)},
            ${JSON.stringify(record.reviewHistory)}, ${record.lastReviewedAt}
        )
        ON CONFLICT (user_id, symbol, market_type) DO UPDATE SET
            company_name = EXCLUDED.company_name,
            position_state = EXCLUDED.position_state,
            in_buy_zone = EXCLUDED.in_buy_zone,
            research_status = EXCLUDED.research_status,
            target_buy_zone = EXCLUDED.target_buy_zone,
            valuation_state = EXCLUDED.valuation_state,
            thesis_strength = EXCLUDED.thesis_strength,
            why_interested = EXCLUDED.why_interested,
            bull_case = EXCLUDED.bull_case,
            bear_case = EXCLUDED.bear_case,
            buy_trigger = EXCLUDED.buy_trigger,
            sell_trigger = EXCLUDED.sell_trigger,
            thesis_break = EXCLUDED.thesis_break,
            notes = EXCLUDED.notes,
            checklist = EXCLUDED.checklist,
            monitoring_rules = EXCLUDED.monitoring_rules,
            accepted_evidence = EXCLUDED.accepted_evidence,
            review_history = EXCLUDED.review_history,
            last_reviewed_at = EXCLUDED.last_reviewed_at,
            updated_at = NOW()
        RETURNING *
    `;
    return mapRow(rows[0]);
};

export const listResearchState = async (): Promise<{ readonly records: ResearchRecord[]; readonly archivedSymbols: string[] }> => {
    await ensureResearchTable();
    const rows = await sql`SELECT * FROM research_records WHERE user_id = 'default' ORDER BY updated_at DESC`;
    const archivedRows = await sql`SELECT symbol FROM research_archived_symbols WHERE user_id = 'default' ORDER BY archived_at DESC`;
    return {
        records: rows.map(mapRow),
        archivedSymbols: archivedRows.flatMap((raw) => {
            if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return [];
            const symbol = Object.fromEntries(Object.entries(raw)).symbol;
            return typeof symbol === 'string' ? [symbol] : [];
        }),
    };
};

export const createStoredResearchRecord = async (input: unknown): Promise<ResearchRecord> => {
    await ensureResearchTable();
    const record = createResearchRecord(parseResearchCreateInput(input));
    const existing = await sql`SELECT symbol FROM research_records WHERE user_id = 'default' AND symbol = ${record.symbol} LIMIT 1`;
    if (existing[0]) throw new ResearchConflictError(record.symbol);
    await sql`DELETE FROM research_archived_symbols WHERE user_id = 'default' AND symbol = ${record.symbol}`;
    return saveRecord(record);
};

export const updateStoredResearchRecord = async (symbol: string, input: ResearchUpdateInput, mode: ResearchUpdateMode): Promise<ResearchRecord | null> => {
    await ensureResearchTable();
    const rows = await sql`SELECT * FROM research_records WHERE user_id = 'default' AND symbol = ${symbol} LIMIT 1`;
    if (!rows[0]) return null;
    const current = mapRow(rows[0]);
    const updated = applyResearchUpdate(current, input);
    return saveRecord(mode === 'review' ? appendResearchReview(updated) : updated);
};

export const deleteStoredResearchRecord = async (symbol: string): Promise<boolean> => {
    await ensureResearchTable();
    await sql`DELETE FROM research_records WHERE user_id = 'default' AND symbol = ${symbol}`;
    await sql`
        INSERT INTO research_archived_symbols (user_id, symbol) VALUES ('default', ${symbol})
        ON CONFLICT (user_id, symbol) DO UPDATE SET archived_at = NOW()
    `;
    return true;
};
