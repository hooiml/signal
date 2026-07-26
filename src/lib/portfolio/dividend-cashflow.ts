import {
    dividendCashFlowCategories,
    dividendCashFlowSnapshotVersion,
    type CashFlowPlanningEvent,
    type DividendCashFlowEvent,
    type DividendCashFlowRevision,
    type DividendCashFlowSnapshot,
    type DividendPlanningEvent,
    type NasdaqDividendDiscovery,
    type NasdaqDividendEvidence,
    type NasdaqDividendEvent,
} from '../types/dividend-cashflow';
import type { PortfolioHoldingsSnapshot } from '../types/portfolio-holdings';
import {
    parsePortfolioAccountLabel,
    parsePortfolioCurrency,
    parsePortfolioFiniteNumber,
    parsePortfolioMarket,
    parsePortfolioSymbol,
} from './holdings';

export const dividendCashFlowLimits = {
    maxEvents: 200,
    maxHistory: 500,
    maxNotesLength: 500,
    maxProviderEvents: 20,
    maxProviderSymbols: 20,
    maxAmount: 1_000_000_000,
    maxAmountPerShare: 1_000_000,
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const validTimestamp = (value: unknown): value is string =>
    typeof value === 'string' && Number.isFinite(Date.parse(value));

export const isDividendCashFlowDate = (value: unknown): value is string => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const optionalDate = (value: unknown, label: string): string | null => {
    if (value === null) return null;
    if (!isDividendCashFlowDate(value)) throw new Error(`${label} must be a valid YYYY-MM-DD date or null.`);
    return value;
};

const identifier = (value: unknown, label: string): string => {
    if (typeof value !== 'string' || !/^[A-Za-z0-9:._-]{1,180}$/.test(value)) {
        throw new Error(`${label} is invalid.`);
    }
    return value;
};

const eventId = (value: unknown): string => {
    if (typeof value !== 'string' || !/^[a-f0-9-]{36}$/i.test(value)) throw new Error('Event id is invalid.');
    return value;
};

const boundedNotes = (value: unknown): string => {
    if (typeof value !== 'string' || value.length > dividendCashFlowLimits.maxNotesLength) {
        throw new Error(`Event notes must be ${dividendCashFlowLimits.maxNotesLength} characters or fewer.`);
    }
    return value;
};

const eventRevision = (value: unknown): number => {
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 1_000_000_000) {
        throw new Error('Event revision is invalid.');
    }
    return Number(value);
};

const normalizedTimestamp = (value: unknown, label: string): string => {
    if (!validTimestamp(value)) throw new Error(`${label} is invalid.`);
    return new Date(value).toISOString();
};

const nullableAmountPerShare = (value: unknown): number | null => {
    if (value === null) return null;
    const parsed = parsePortfolioFiniteNumber(value, 'Dividend amount per share', { positive: true });
    if (parsed > dividendCashFlowLimits.maxAmountPerShare) {
        throw new Error(`Dividend amount per share must not exceed ${dividendCashFlowLimits.maxAmountPerShare}.`);
    }
    return parsed;
};

const parseProviderEvidence = (value: unknown): NasdaqDividendEvidence => {
    if (!isRecord(value)
        || value.provider !== 'Nasdaq dividends'
        || value.status !== 'declared'
        || typeof value.sourceUrl !== 'string'
        || !/^https:\/\/www\.nasdaq\.com\/market-activity\/stocks\/[a-z0-9.-]+\/dividend-history$/.test(value.sourceUrl)) {
        throw new Error('Dividend provider evidence is invalid.');
    }
    return {
        providerEventId: identifier(value.providerEventId, 'Provider event id'),
        provider: 'Nasdaq dividends',
        sourceUrl: value.sourceUrl,
        fetchedAt: normalizedTimestamp(value.fetchedAt, 'Provider fetched-at time'),
        status: 'declared',
        declarationDate: optionalDate(value.declarationDate, 'Provider declaration date'),
        recordDate: optionalDate(value.recordDate, 'Provider record date'),
        exDate: optionalDate(value.exDate, 'Provider ex-date'),
        paymentDate: optionalDate(value.paymentDate, 'Provider payment date'),
        amountPerShare: nullableAmountPerShare(value.amountPerShare),
        currency: parsePortfolioCurrency(value.currency),
    };
};

const parseCommon = (value: Record<string, unknown>) => ({
    id: eventId(value.id),
    revision: eventRevision(value.revision),
    accountLabel: parsePortfolioAccountLabel(value.accountLabel),
    currency: parsePortfolioCurrency(value.currency),
    notes: boundedNotes(value.notes),
    createdAt: normalizedTimestamp(value.createdAt, 'Created time'),
    updatedAt: normalizedTimestamp(value.updatedAt, 'Updated time'),
});

export const parseDividendCashFlowEvent = (value: unknown): DividendCashFlowEvent => {
    if (!isRecord(value)) throw new Error('Dividend or cash-flow event is invalid.');
    const common = parseCommon(value);
    if (value.kind === 'dividend') {
        if (value.status !== 'declared' && value.status !== 'confirmed') throw new Error('Dividend status is invalid.');
        if (value.source !== 'user-entered' && value.source !== 'provider-confirmed') throw new Error('Dividend source is invalid.');
        const providerEvidence = value.providerEvidence === null ? null : parseProviderEvidence(value.providerEvidence);
        if ((value.source === 'provider-confirmed') !== (providerEvidence !== null)) {
            throw new Error('Provider-confirmed dividends must retain their original provider evidence.');
        }
        const event: DividendPlanningEvent = {
            ...common,
            kind: 'dividend',
            symbol: parsePortfolioSymbol(value.symbol),
            market: parsePortfolioMarket(value.market),
            status: value.status,
            declarationDate: optionalDate(value.declarationDate, 'Declaration date'),
            recordDate: optionalDate(value.recordDate, 'Record date'),
            exDate: optionalDate(value.exDate, 'Ex-date'),
            paymentDate: optionalDate(value.paymentDate, 'Payment date'),
            amountPerShare: nullableAmountPerShare(value.amountPerShare),
            source: value.source,
            providerEvidence,
        };
        if (providerEvidence && providerEvidence.currency !== event.currency) {
            throw new Error('Provider dividend currency must match the planning event currency.');
        }
        return event;
    }
    if (value.kind === 'cash-flow') {
        if (!dividendCashFlowCategories.includes(value.category as CashFlowPlanningEvent['category'])
            || value.status !== 'planned'
            || value.source !== 'user-entered'
            || (value.direction !== 'inflow' && value.direction !== 'outflow')
            || !isDividendCashFlowDate(value.plannedDate)) {
            throw new Error('Cash-flow event is invalid.');
        }
        return {
            ...common,
            kind: 'cash-flow',
            category: value.category as CashFlowPlanningEvent['category'],
            status: 'planned',
            plannedDate: value.plannedDate,
            direction: value.direction,
            amount: (() => {
                const amount = parsePortfolioFiniteNumber(value.amount, 'Cash-flow amount', { positive: true });
                if (amount > dividendCashFlowLimits.maxAmount) {
                    throw new Error(`Cash-flow amount must not exceed ${dividendCashFlowLimits.maxAmount}.`);
                }
                return amount;
            })(),
            source: 'user-entered',
        };
    }
    throw new Error('Event kind is invalid.');
};

const emptySnapshotAt = '1970-01-01T00:00:00.000Z';

export const emptyDividendCashFlowSnapshot = (): DividendCashFlowSnapshot => ({
    version: dividendCashFlowSnapshotVersion,
    revision: 0,
    updatedAt: emptySnapshotAt,
    events: [],
    history: [],
});

const parseHistory = (value: unknown): readonly DividendCashFlowRevision[] => {
    if (!Array.isArray(value) || value.length > dividendCashFlowLimits.maxHistory) {
        throw new Error('Dividend and cash-flow revision history is invalid.');
    }
    return value.map((item): DividendCashFlowRevision => {
        if (!isRecord(item)
            || !Number.isInteger(item.snapshotRevision)
            || Number(item.snapshotRevision) < 1
            || (item.change !== 'created' && item.change !== 'updated' && item.change !== 'removed')) {
            throw new Error('Dividend and cash-flow revision entry is invalid.');
        }
        return {
            snapshotRevision: Number(item.snapshotRevision),
            eventId: eventId(item.eventId),
            eventRevision: eventRevision(item.eventRevision),
            changedAt: normalizedTimestamp(item.changedAt, 'Revision time'),
            change: item.change,
            previous: item.previous === null ? null : parseDividendCashFlowEvent(item.previous),
        };
    });
};

export const parseDividendCashFlowSnapshot = (value: unknown): DividendCashFlowSnapshot => {
    if (!isRecord(value)
        || value.version !== dividendCashFlowSnapshotVersion
        || !Number.isInteger(value.revision)
        || Number(value.revision) < 0
        || !validTimestamp(value.updatedAt)
        || !Array.isArray(value.events)
        || value.events.length > dividendCashFlowLimits.maxEvents) {
        throw new Error('Dividend and cash-flow snapshot is invalid.');
    }
    const events = value.events.map(parseDividendCashFlowEvent);
    if (new Set(events.map((event) => event.id)).size !== events.length) {
        throw new Error('Dividend and cash-flow snapshot contains duplicate event ids.');
    }
    return {
        version: dividendCashFlowSnapshotVersion,
        revision: Number(value.revision),
        updatedAt: new Date(value.updatedAt).toISOString(),
        events,
        history: parseHistory(value.history),
    };
};

export const migrateDividendCashFlowSnapshot = (value: unknown): DividendCashFlowSnapshot =>
    value === null || value === undefined ? emptyDividendCashFlowSnapshot() : parseDividendCashFlowSnapshot(value);

export class DividendCashFlowRevisionConflict extends Error {
    constructor() {
        super('Dividend and cash-flow data changed in another tab. Reload before saving.');
        this.name = 'DividendCashFlowRevisionConflict';
    }
}

export const upsertDividendCashFlowEvent = (
    snapshot: DividendCashFlowSnapshot,
    event: DividendCashFlowEvent,
    expectedRevision: number,
    changedAt = new Date().toISOString(),
): DividendCashFlowSnapshot => {
    const current = parseDividendCashFlowSnapshot(snapshot);
    if (current.revision !== expectedRevision) throw new DividendCashFlowRevisionConflict();
    const previous = current.events.find((item) => item.id === event.id) ?? null;
    const parsed = parseDividendCashFlowEvent({
        ...event,
        revision: previous ? previous.revision + 1 : 1,
        createdAt: previous?.createdAt ?? event.createdAt,
        updatedAt: changedAt,
    });
    if (!previous && current.events.length >= dividendCashFlowLimits.maxEvents) {
        throw new Error(`Store at most ${dividendCashFlowLimits.maxEvents} dividend and cash-flow events.`);
    }
    const nextRevision = current.revision + 1;
    const history: DividendCashFlowRevision = {
        snapshotRevision: nextRevision,
        eventId: parsed.id,
        eventRevision: parsed.revision,
        changedAt: normalizedTimestamp(changedAt, 'Revision time'),
        change: previous ? 'updated' : 'created',
        previous,
    };
    return parseDividendCashFlowSnapshot({
        version: dividendCashFlowSnapshotVersion,
        revision: nextRevision,
        updatedAt: changedAt,
        events: [...current.events.filter((item) => item.id !== parsed.id), parsed],
        history: [...current.history, history].slice(-dividendCashFlowLimits.maxHistory),
    });
};

export const removeDividendCashFlowEvent = (
    snapshot: DividendCashFlowSnapshot,
    id: string,
    expectedRevision: number,
    changedAt = new Date().toISOString(),
): DividendCashFlowSnapshot => {
    const current = parseDividendCashFlowSnapshot(snapshot);
    if (current.revision !== expectedRevision) throw new DividendCashFlowRevisionConflict();
    const previous = current.events.find((event) => event.id === id);
    if (!previous) throw new Error('Dividend or cash-flow event no longer exists.');
    const nextRevision = current.revision + 1;
    return parseDividendCashFlowSnapshot({
        version: dividendCashFlowSnapshotVersion,
        revision: nextRevision,
        updatedAt: changedAt,
        events: current.events.filter((event) => event.id !== id),
        history: [...current.history, {
            snapshotRevision: nextRevision,
            eventId: previous.id,
            eventRevision: previous.revision + 1,
            changedAt,
            change: 'removed',
            previous,
        }].slice(-dividendCashFlowLimits.maxHistory),
    });
};

export const dividendEventDate = (event: DividendPlanningEvent): {
    readonly date: string | null;
    readonly basis: 'payment date' | 'ex-date' | 'declaration date' | 'date unavailable';
} => event.paymentDate ? { date: event.paymentDate, basis: 'payment date' }
    : event.exDate ? { date: event.exDate, basis: 'ex-date' }
        : event.declarationDate ? { date: event.declarationDate, basis: 'declaration date' }
            : { date: null, basis: 'date unavailable' };

export const dividendCashFlowEventDate = (event: DividendCashFlowEvent): string | null =>
    event.kind === 'cash-flow' ? event.plannedDate : dividendEventDate(event).date;

export const filterDividendCashFlowEvents = (
    events: readonly DividendCashFlowEvent[],
    accountLabel: string,
    currency: DividendCashFlowEvent['currency'],
): readonly DividendCashFlowEvent[] => events
    .filter((event) => event.accountLabel === accountLabel && event.currency === currency)
    .sort((left, right) =>
        (dividendCashFlowEventDate(left) ?? '9999-12-31').localeCompare(dividendCashFlowEventDate(right) ?? '9999-12-31')
        || left.kind.localeCompare(right.kind)
        || left.id.localeCompare(right.id));

export const calculateIllustrativeGrossDividend = (
    event: DividendPlanningEvent,
    holdings: PortfolioHoldingsSnapshot,
): {
    readonly quantity: number;
    readonly amountPerShare: number;
    readonly grossAmount: number;
    readonly snapshotDate: string;
    readonly arithmetic: string;
} | null => {
    if (event.amountPerShare === null) return null;
    const holding = holdings.holdings.find((item) =>
        item.accountLabel === event.accountLabel
        && item.currency === event.currency
        && item.market === event.market
        && item.symbol === event.symbol);
    if (!holding) return null;
    const grossAmount = Number((holding.quantity * event.amountPerShare).toFixed(2));
    return {
        quantity: holding.quantity,
        amountPerShare: event.amountPerShare,
        grossAmount,
        snapshotDate: holdings.updatedAt.slice(0, 10),
        arithmetic: `${holding.quantity} shares × ${event.currency} ${event.amountPerShare} = ${event.currency} ${grossAmount}`,
    };
};

export const buildDividendDiscoveryPath = (symbol: string): string =>
    `/api/research/dividends/${encodeURIComponent(parsePortfolioSymbol(symbol))}`;

const nasdaqDate = (value: unknown): string | null => {
    if (typeof value !== 'string' || value === 'N/A') return null;
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
    if (!match) return null;
    const [, month, day, year] = match;
    const result = `${year}-${month}-${day}`;
    return isDividendCashFlowDate(result) ? result : null;
};

const nasdaqAmount = (value: unknown): number | null => {
    if (typeof value !== 'string') return null;
    const parsed = Number(value.replace(/[$,\s]/g, ''));
    return Number.isFinite(parsed) && parsed > 0 && parsed <= dividendCashFlowLimits.maxAmountPerShare
        ? parsed
        : null;
};

const providerEventIdentifier = (
    symbol: string,
    declarationDate: string | null,
    exDate: string | null,
    paymentDate: string | null,
    amountPerShare: number | null,
) => [symbol, declarationDate ?? 'na', exDate ?? 'na', paymentDate ?? 'na', amountPerShare ?? 'na'].join(':');

export const parseNasdaqDividendDiscovery = (
    payload: unknown,
    symbolInput: string,
    fetchedAtInput = new Date().toISOString(),
): NasdaqDividendDiscovery => {
    const symbol = parsePortfolioSymbol(symbolInput);
    const fetchedAt = normalizedTimestamp(fetchedAtInput, 'Provider fetched-at time');
    const root = isRecord(payload) ? payload : null;
    const data = root && isRecord(root.data) ? root.data : null;
    const dividends = data && isRecord(data.dividends) ? data.dividends : null;
    const rows = dividends && Array.isArray(dividends.rows) ? dividends.rows.slice(0, 100) : [];
    const sourceUrl = `https://www.nasdaq.com/market-activity/stocks/${symbol.toLowerCase()}/dividend-history`;
    const events = rows.flatMap((raw): NasdaqDividendEvent[] => {
        if (!isRecord(raw)) return [];
        const currency = raw.currency === 'USD' || raw.currency === 'MYR' ? raw.currency : null;
        const declarationDate = nasdaqDate(raw.declarationDate);
        const recordDate = nasdaqDate(raw.recordDate);
        const exDate = nasdaqDate(raw.exOrEffDate);
        const paymentDate = nasdaqDate(raw.paymentDate);
        const amountPerShare = nasdaqAmount(raw.amount);
        if (!currency || declarationDate === null || (exDate === null && paymentDate === null)) return [];
        return [{
            providerEventId: providerEventIdentifier(symbol, declarationDate, exDate, paymentDate, amountPerShare),
            symbol,
            market: 'US',
            status: 'declared',
            declarationDate,
            recordDate,
            exDate,
            paymentDate,
            amountPerShare,
            currency,
            provider: 'Nasdaq dividends',
            sourceUrl,
            fetchedAt,
        }];
    }).slice(0, dividendCashFlowLimits.maxProviderEvents);
    return {
        symbol,
        market: 'US',
        fetchedAt,
        provider: 'Nasdaq dividends',
        sourceUrl,
        events,
    };
};

export const providerEvidenceFromEvent = (event: NasdaqDividendEvent): NasdaqDividendEvidence => ({
    providerEventId: event.providerEventId,
    provider: event.provider,
    sourceUrl: event.sourceUrl,
    fetchedAt: event.fetchedAt,
    status: event.status,
    declarationDate: event.declarationDate,
    recordDate: event.recordDate,
    exDate: event.exDate,
    paymentDate: event.paymentDate,
    amountPerShare: event.amountPerShare,
    currency: event.currency,
});

export const parseNasdaqDividendDiscoveryResponse = (value: unknown): NasdaqDividendDiscovery => {
    if (!isRecord(value) || value.success !== true || !isRecord(value.data)) {
        throw new Error('Invalid Nasdaq dividend response.');
    }
    const data = value.data;
    const symbol = parsePortfolioSymbol(data.symbol);
    const fetchedAt = normalizedTimestamp(data.fetchedAt, 'Provider fetched-at time');
    if (data.market !== 'US' || data.provider !== 'Nasdaq dividends'
        || typeof data.sourceUrl !== 'string'
        || data.sourceUrl !== `https://www.nasdaq.com/market-activity/stocks/${symbol.toLowerCase()}/dividend-history`
        || !Array.isArray(data.events)
        || data.events.length > dividendCashFlowLimits.maxProviderEvents) {
        throw new Error('Invalid Nasdaq dividend discovery data.');
    }
    const events = data.events.map((event): NasdaqDividendEvent => {
        if (!isRecord(event) || event.symbol !== symbol || event.market !== 'US') {
            throw new Error('Invalid Nasdaq dividend event.');
        }
        const evidence = parseProviderEvidence(event);
        return {
            ...evidence,
            symbol,
            market: 'US',
        };
    });
    return {
        symbol,
        market: 'US',
        fetchedAt,
        provider: 'Nasdaq dividends',
        sourceUrl: data.sourceUrl,
        events,
    };
};

export const upcomingDividendCashFlowDigestEvents = (
    snapshot: DividendCashFlowSnapshot,
    now = new Date(),
    rangeDays = 30,
): readonly {
    readonly symbol: string | null;
    readonly type: 'dividend' | 'cash-flow';
    readonly date: string;
}[] => {
    if (!Number.isInteger(rangeDays) || rangeDays < 1 || rangeDays > 90) throw new Error('Digest range must be between 1 and 90 days.');
    const start = now.toISOString().slice(0, 10);
    const endDate = new Date(`${start}T00:00:00.000Z`);
    endDate.setUTCDate(endDate.getUTCDate() + rangeDays);
    const end = endDate.toISOString().slice(0, 10);
    return snapshot.events.flatMap((event) => {
        const date = dividendCashFlowEventDate(event);
        return date && date >= start && date <= end ? [{
            symbol: event.kind === 'dividend' ? event.symbol : null,
            type: event.kind,
            date,
        }] : [];
    });
};
