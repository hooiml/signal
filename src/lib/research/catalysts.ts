import type { DiscoveryCatalyst } from '../types/research-discovery';

const objectValue = (value: unknown): Record<string, unknown> | null =>
    typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null;

const calendarDate = (offset: number, now: Date): string => {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
};

const timingValue = (value: unknown): DiscoveryCatalyst['timing'] => {
    if (value === 'time-pre-market') return 'pre-market';
    if (value === 'time-after-hours') return 'after-hours';
    return 'time-not-supplied';
};

const fetchCalendarDate = async (date: string, symbols: ReadonlySet<string>): Promise<ReadonlyMap<string, DiscoveryCatalyst>> => {
    const response = await fetch(`https://api.nasdaq.com/api/calendar/earnings?date=${date}`, {
        headers: {
            Accept: 'application/json, text/plain, */*',
            Origin: 'https://www.nasdaq.com',
            Referer: 'https://www.nasdaq.com/',
            'User-Agent': 'Mozilla/5.0 Signal research dashboard',
        },
        next: { revalidate: 21600 },
    });
    if (!response.ok) throw new Error(`Nasdaq earnings calendar failed (${response.status}).`);
    const root = objectValue(await response.json());
    const data = objectValue(root?.data);
    if (!Array.isArray(data?.rows)) return new Map();
    const catalysts = new Map<string, DiscoveryCatalyst>();
    for (const raw of data.rows) {
        const row = objectValue(raw);
        const symbol = typeof row?.symbol === 'string' ? row.symbol.toUpperCase() : null;
        if (!symbol || !symbols.has(symbol)) continue;
        catalysts.set(symbol, {
            date,
            type: 'earnings',
            timing: timingValue(row?.time),
            fiscalQuarterEnding: typeof row?.fiscalQuarterEnding === 'string' ? row.fiscalQuarterEnding : null,
            epsForecast: typeof row?.epsForecast === 'string' ? row.epsForecast : null,
            source: 'Nasdaq earnings calendar',
        });
    }
    return catalysts;
};

export const fetchUpcomingCatalysts = async (
    symbols: readonly string[],
    rangeDays = 20,
    now = new Date(),
): Promise<ReadonlyMap<string, DiscoveryCatalyst>> => {
    if (!Number.isInteger(rangeDays) || rangeDays < 0 || rangeDays > 90) throw new Error('Catalyst range must be between 0 and 90 days.');
    const requested = new Set(symbols);
    const catalysts = new Map<string, DiscoveryCatalyst>();
    for (let offset = 0; offset <= rangeDays; offset += 7) {
        const batchSize = Math.min(7, rangeDays - offset + 1);
        const results = await Promise.all(Array.from({ length: batchSize }, (_, index) => fetchCalendarDate(calendarDate(offset + index, now), requested)));
        for (const result of results) for (const [symbol, catalyst] of result) if (!catalysts.has(symbol)) catalysts.set(symbol, catalyst);
    }
    return catalysts;
};
