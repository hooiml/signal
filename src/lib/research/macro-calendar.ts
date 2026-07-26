import type {
    ResearchCalendarInput,
    ResearchCalendarRange,
    ResearchMacroCategory,
    ResearchMacroEvent,
} from '../types/research-calendar';

const FOMC_URL = 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm';
const BLS_URL = 'https://www.bls.gov/schedule/news_release/bls.ics';
const DOSM_URL = 'https://api.data.gov.my/data-catalogue?id=arc_dosm&limit=1000';
const BNM_URL = 'https://www.bnm.gov.my/monetary-stability/mpc-meetings';
const REQUEST_HEADERS = {
    Accept: 'text/html,text/calendar,application/json',
    'User-Agent': 'Signal research dashboard research@example.invalid',
};

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const cleanText = (value: string): string => value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const monthNumber = (value: string): string | null => {
    const parsed = new Date(`${value.trim()} 1, 2000 00:00:00 UTC`);
    return Number.isNaN(parsed.getTime()) ? null : String(parsed.getUTCMonth() + 1).padStart(2, '0');
};

const macroId = (market: 'US' | 'MY', category: ResearchMacroCategory, date: string, source: string) =>
    `${market.toLowerCase()}-${category}-${date}-${source.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

const baseEvent = (
    market: 'US' | 'MY',
    category: ResearchMacroCategory,
    title: string,
    date: string,
    timeLabel: string | null,
    source: ResearchMacroEvent['source'],
    sourceUrl: string,
    detail: string,
): ResearchMacroEvent => ({
    id: macroId(market, category, date, source),
    market,
    category,
    title,
    date,
    timeLabel,
    source,
    sourceUrl,
    detail,
    trackedSymbols: [],
});

export const parseFomcCalendarHtml = (html: string): readonly ResearchMacroEvent[] => {
    const headingPattern = /<h4\b[^>]*>[\s\S]*?(\d{4})\s+FOMC Meetings[\s\S]*?<\/h4>/gi;
    const headings = [...html.matchAll(headingPattern)];
    const events: ResearchMacroEvent[] = [];
    for (let index = 0; index < headings.length; index += 1) {
        const heading = headings[index]!;
        const year = Number(heading[1]);
        const start = (heading.index ?? 0) + heading[0].length;
        const end = headings[index + 1]?.index ?? html.length;
        const section = html.slice(start, end);
        const meetingPattern = /fomc-meeting__month[^>]*>[\s\S]*?(?:<strong[^>]*>)?([^<]+)(?:<\/strong>)?[\s\S]*?fomc-meeting__date[^>]*>([\s\S]*?)<\/div>/gi;
        for (const meeting of section.matchAll(meetingPattern)) {
            const month = monthNumber(cleanText(meeting[1] ?? ''));
            const dateText = cleanText(meeting[2] ?? '');
            const dayMatches = [...dateText.matchAll(/\d{1,2}/g)];
            const decisionDay = Number(dayMatches.at(-1)?.[0]);
            if (!month || !Number.isInteger(year) || !Number.isInteger(decisionDay)) continue;
            const date = `${year}-${month}-${String(decisionDay).padStart(2, '0')}`;
            const projections = dateText.includes('*');
            events.push(baseEvent(
                'US',
                'monetary-policy',
                'FOMC interest-rate decision',
                date,
                null,
                'Federal Reserve',
                FOMC_URL,
                projections ? 'Scheduled decision day with an economic projections release.' : 'Scheduled Federal Open Market Committee decision day.',
            ));
        }
    }
    return events;
};

const unfoldIcs = (value: string): readonly string[] =>
    value.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);

const icsDate = (value: string, parameters: string): { readonly date: string; readonly timeLabel: string | null } | null => {
    const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?Z?)?$/);
    if (!match) return null;
    return {
        date: `${match[1]}-${match[2]}-${match[3]}`,
        timeLabel: match[4] && match[5]
            ? `${match[4]}:${match[5]} ${value.endsWith('Z') ? 'UTC' : /TZID=America\/New_York/i.test(parameters) ? 'ET' : 'source local time'}`
            : null,
    };
};

export const parseBlsCalendarIcs = (ics: string): readonly ResearchMacroEvent[] => {
    const events: ResearchMacroEvent[] = [];
    const blocks = unfoldIcs(ics).join('\n').split('BEGIN:VEVENT').slice(1);
    for (const block of blocks) {
        const summary = block.match(/^SUMMARY(?:;[^:]*)?:(.+)$/m)?.[1]?.trim();
        const startsAt = block.match(/^DTSTART([^:]*):(.+)$/m);
        const url = block.match(/^URL(?:;[^:]*)?:(.+)$/m)?.[1]?.trim() ?? BLS_URL;
        const parsedDate = startsAt ? icsDate(startsAt[2]!.trim(), startsAt[1] ?? '') : null;
        if (!summary || !parsedDate) continue;
        const category = /consumer price index/i.test(summary)
            ? 'inflation'
            : /employment situation/i.test(summary) ? 'employment' : null;
        if (!category) continue;
        events.push(baseEvent(
            'US',
            category,
            summary,
            parsedDate.date,
            parsedDate.timeLabel,
            'U.S. Bureau of Labor Statistics',
            url.startsWith('https://www.bls.gov/') ? url : BLS_URL,
            category === 'inflation' ? 'Scheduled U.S. consumer inflation release.' : 'Scheduled U.S. employment report.',
        ));
    }
    return events;
};

const dosmCategory = (value: string): ResearchMacroCategory | null => {
    if (value === 'cpi') return 'inflation';
    if (value === 'lfs') return 'employment';
    if (value === 'gdp') return 'growth';
    return null;
};

export const parseDosmReleaseCalendar = (payload: unknown): readonly ResearchMacroEvent[] => {
    if (!Array.isArray(payload)) return [];
    const events: ResearchMacroEvent[] = [];
    for (const item of payload) {
        if (!isRecord(item) || typeof item.publication_type !== 'string') continue;
        const category = dosmCategory(item.publication_type.toLowerCase());
        if (!category || typeof item.title_en !== 'string' || typeof item.release_date !== 'string') continue;
        const match = item.release_date.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2}))?/);
        if (!match) continue;
        const date = match[1]!;
        const timeLabel = match[2] && match[3] ? `${match[2]}:${match[3]} MYT` : null;
        events.push(baseEvent(
            'MY',
            category,
            item.title_en.trim(),
            date,
            timeLabel,
            'OpenDOSM',
            'https://open.dosm.gov.my/data-catalogue/arc_dosm',
            category === 'inflation'
                ? 'Scheduled Malaysia consumer inflation release.'
                : category === 'employment' ? 'Scheduled Malaysia labour-force release.' : 'Scheduled Malaysia economic-growth release.',
        ));
    }
    return events;
};

const BNM_MPC_SCHEDULE: Readonly<Record<number, readonly string[]>> = {
    2026: ['2026-01-22', '2026-03-05', '2026-05-07', '2026-07-09', '2026-09-03', '2026-11-05'],
};

const bnmEventsForYears = (years: readonly number[]): {
    readonly events: readonly ResearchMacroEvent[];
    readonly missingYears: readonly number[];
} => ({
    events: years.flatMap((year) => (BNM_MPC_SCHEDULE[year] ?? []).map((date) => baseEvent(
        'MY',
        'monetary-policy',
        'BNM Monetary Policy Committee decision',
        date,
        null,
        'Bank Negara Malaysia',
        BNM_URL,
        'Maintained annual MPC schedule; confirm the official page before acting on a date.',
    ))),
    missingYears: years.filter((year) => !(year in BNM_MPC_SCHEDULE)),
});

const utcDate = (date: Date): string => date.toISOString().slice(0, 10);

const addUtcDays = (date: string, days: number): string => {
    const value = new Date(`${date}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return utcDate(value);
};

export const buildResearchMacroEvents = ({ inputs, events, now, rangeDays }: {
    readonly inputs: readonly ResearchCalendarInput[];
    readonly events: readonly ResearchMacroEvent[];
    readonly now: Date;
    readonly rangeDays: ResearchCalendarRange;
}): readonly ResearchMacroEvent[] => {
    const start = utcDate(now);
    const end = addUtcDays(start, rangeDays);
    const symbolsByMarket = {
        US: [...new Set(inputs.filter((input) => input.market === 'US').map((input) => input.symbol))].sort(),
        MY: [...new Set(inputs.filter((input) => input.market === 'MY').map((input) => input.symbol))].sort(),
    };
    return [...new Map(events
        .filter((event) => event.date >= start && event.date <= end)
        .map((event) => [event.id, { ...event, trackedSymbols: symbolsByMarket[event.market] }])).values()]
        .sort((left, right) => left.date.localeCompare(right.date) || left.market.localeCompare(right.market) || left.title.localeCompare(right.title));
};

const fetchText = async (url: string, fetcher: Fetcher): Promise<string> => {
    const response = await fetcher(url, { headers: REQUEST_HEADERS, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
    return response.text();
};

export const fetchResearchMacroCalendar = async (
    inputs: readonly ResearchCalendarInput[],
    rangeDays: ResearchCalendarRange,
    now = new Date(),
    fetcher: Fetcher = fetch,
): Promise<{ readonly events: readonly ResearchMacroEvent[]; readonly warnings: readonly string[] }> => {
    const providers = await Promise.allSettled([
        fetchText(FOMC_URL, fetcher).then(parseFomcCalendarHtml),
        fetchText(BLS_URL, fetcher).then(parseBlsCalendarIcs),
        fetchText(DOSM_URL, fetcher).then((text) => parseDosmReleaseCalendar(JSON.parse(text))),
    ]);
    const startYear = now.getUTCFullYear();
    const endYear = new Date(`${addUtcDays(utcDate(now), rangeDays)}T00:00:00.000Z`).getUTCFullYear();
    const bnm = bnmEventsForYears([...new Set([startYear, endYear])]);
    const warnings = [
        providers[0]?.status === 'rejected' ? 'Federal Reserve meeting coverage is temporarily unavailable.' : null,
        providers[1]?.status === 'rejected' ? 'U.S. inflation and employment release coverage is temporarily unavailable.' : null,
        providers[2]?.status === 'rejected' ? 'Malaysia economic-release coverage is temporarily unavailable.' : null,
        bnm.missingYears.length > 0 ? `BNM MPC dates are not maintained for ${bnm.missingYears.join(', ')}.` : null,
    ].filter((warning): warning is string => warning !== null);
    const providerEvents = providers.flatMap((provider) => provider.status === 'fulfilled' ? provider.value : []);
    return {
        events: buildResearchMacroEvents({ inputs, events: [...providerEvents, ...bnm.events], now, rangeDays }),
        warnings,
    };
};
