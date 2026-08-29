import { sql } from '@/lib/db';
import { normalizeResearchMemoryTicker } from './research-memory';
import { parseResearchExpectationEvent, type ResearchExpectationEvent } from './research-expectation';

const MAX_EVENTS_PER_TICKER = 12;

const ensureExpectationTable = async () => {
    await sql`
        CREATE TABLE IF NOT EXISTS research_expectation_events (
            user_id VARCHAR(255) NOT NULL DEFAULT 'default',
            ticker VARCHAR(20) NOT NULL,
            event_id VARCHAR(100) NOT NULL,
            event_date DATE NOT NULL,
            payload JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (user_id, ticker, event_id)
        )
    `;
    await sql`
        CREATE INDEX IF NOT EXISTS research_expectation_events_ticker_date_idx
        ON research_expectation_events (user_id, ticker, event_date DESC)
    `;
};

const readPayload = (row: unknown): ResearchExpectationEvent => {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) throw new Error('Invalid expectation event row.');
    return parseResearchExpectationEvent((row as Record<string, unknown>).payload);
};

export const listStoredResearchExpectationEvents = async (tickerInput: string): Promise<ResearchExpectationEvent[]> => {
    await ensureExpectationTable();
    const ticker = normalizeResearchMemoryTicker(tickerInput);
    const rows = await sql`
        SELECT payload
        FROM research_expectation_events
        WHERE user_id = 'default' AND ticker = ${ticker}
        ORDER BY event_date DESC, updated_at DESC
        LIMIT ${MAX_EVENTS_PER_TICKER}
    `;
    return rows.map(readPayload);
};

export const saveStoredResearchExpectationEvent = async (input: unknown): Promise<ResearchExpectationEvent> => {
    await ensureExpectationTable();
    const event = parseResearchExpectationEvent(input);
    await sql`
        INSERT INTO research_expectation_events (user_id, ticker, event_id, event_date, payload)
        VALUES ('default', ${event.ticker}, ${event.id}, ${event.eventDate}, ${JSON.stringify(event)})
        ON CONFLICT (user_id, ticker, event_id) DO UPDATE SET
            event_date = EXCLUDED.event_date,
            payload = EXCLUDED.payload,
            updated_at = NOW()
    `;
    await sql`
        DELETE FROM research_expectation_events
        WHERE user_id = 'default' AND ticker = ${event.ticker}
          AND event_id IN (
              SELECT event_id
              FROM research_expectation_events
              WHERE user_id = 'default' AND ticker = ${event.ticker}
              ORDER BY event_date DESC, updated_at DESC
              OFFSET ${MAX_EVENTS_PER_TICKER}
          )
    `;
    return event;
};

export const deleteStoredResearchExpectationEvent = async (tickerInput: string, eventId: string): Promise<boolean> => {
    await ensureExpectationTable();
    const ticker = normalizeResearchMemoryTicker(tickerInput);
    if (!/^[a-zA-Z0-9._:-]{1,100}$/.test(eventId)) throw new Error('Invalid event id.');
    const rows = await sql`
        DELETE FROM research_expectation_events
        WHERE user_id = 'default' AND ticker = ${ticker} AND event_id = ${eventId}
        RETURNING event_id
    `;
    return Boolean(rows[0]);
};
