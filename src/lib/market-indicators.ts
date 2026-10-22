import { parseMarketReportDate } from './market-observation-date';

const CBOE_DAILY_MARKET_STATS_URL = 'https://www.cboe.com/markets/us/options/market-statistics/daily';
const NAAIM_EXPOSURE_URL = 'https://naaim.org/programs/naaim-exposure-index/';
const FRED_GDP_URL = 'https://fred.stlouisfed.org/series/GDP';
const FRED_EQUITY_MARKET_VALUE_URL = 'https://fred.stlouisfed.org/series/BOGZ1LM383064105Q';

export interface PutCallRatioData {
    ratio: number;
    reportDate: string | null;
    retrievedAt: string;
    source: 'cboe-daily-market-statistics';
    sourceUrl: string;
}

export interface NaaimExposureData {
    exposure: number;
    reportDate: string | null;
    retrievedAt: string;
    source: 'naaim-exposure-index';
    sourceUrl: string;
}

interface FredObservation {
    label: string;
    value: number;
    reportDate: string;
}

export interface BuffettIndicatorData {
    ratioPct: number;
    marketValueBillions: number;
    gdpBillions: number;
    reportDate: string;
    label: string;
    detail: string;
    sourceUrl: string;
}

export async function fetchCboePutCallRatio(): Promise<PutCallRatioData | null> {
    try {
        const response = await fetch(CBOE_DAILY_MARKET_STATS_URL, {
            cache: 'no-store',
            headers: {
                'user-agent': 'SignalDashboard/1.0 (+https://github.com)',
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
        });

        if (!response.ok) {
            throw new Error(`Cboe market statistics fetch failed: ${response.status}`);
        }

        return parseCboePutCallRatio(await response.text(), new Date().toISOString());
    } catch (error) {
        console.warn('Cboe put/call ratio fetch failed:', error);
        return null;
    }
}

export function parseCboePutCallRatio(html: string, retrievedAt: string): PutCallRatioData | null {
    const document = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ');
    const text = document
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const match = text.match(/TOTAL PUT\/CALL RATIO\s+([0-9]+(?:\.[0-9]+)?)/i);

    if (!match) {
        return null;
    }

    const ratio = Number(match[1]);
    if (!Number.isFinite(ratio) || ratio <= 0) {
        return null;
    }

    return {
        ratio,
        reportDate: parseCboeReportDate(document, retrievedAt),
        retrievedAt,
        source: 'cboe-daily-market-statistics',
        sourceUrl: CBOE_DAILY_MARKET_STATS_URL,
    };
}

function parseCboeReportDate(html: string, retrievedAt: string): string | null {
    // The provider's date control selects the displayed ratios. Unrelated dates and
    // embedded scripts are not evidence of the table's reporting period.
    const controls = [...html.matchAll(/<input\b[^>]*>/gi)]
        .map(match => match[0])
        .filter(input => /\splaceholder\s*=\s*(["'])yyyy\/mm\/dd\1/i.test(input));
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const dates = controls.map(input => {
        const value = input.match(/\svalue\s*=\s*(["'])(.*?)\1/i)?.[2]?.trim();
        const isoDate = parseMarketReportDate(value, retrievedAt);
        if (isoDate) return isoDate;
        const parts = value?.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/i);
        if (!parts) return null;
        const month = months.indexOf(parts[2].toLowerCase()) + 1;
        return parseMarketReportDate(`${parts[3]}-${String(month).padStart(2, '0')}-${parts[1].padStart(2, '0')}`, retrievedAt);
    });
    return dates.length > 0 && dates.every(date => date !== null && date === dates[0]) ? dates[0] : null;
}

export function normalizePutCallRatio(ratio: number): number {
    // Lower put/call means call-heavy optimism/complacency; higher means fear or hedging.
    const lowerBound = 0.55;
    const upperBound = 1.25;
    const clamped = Math.max(lowerBound, Math.min(upperBound, ratio));
    return Math.round(((upperBound - clamped) / (upperBound - lowerBound)) * 100);
}

export async function fetchNaaimExposure(): Promise<NaaimExposureData | null> {
    try {
        const response = await fetch(NAAIM_EXPOSURE_URL, {
            cache: 'no-store',
            headers: {
                'user-agent': 'SignalDashboard/1.0 (+https://github.com)',
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
        });

        if (!response.ok) {
            throw new Error(`NAAIM exposure fetch failed: ${response.status}`);
        }

        return parseNaaimExposure(await response.text(), new Date().toISOString());
    } catch (error) {
        console.warn('NAAIM exposure fetch failed:', error);
        return null;
    }
}

export function parseNaaimExposure(html: string, retrievedAt: string): NaaimExposureData | null {
    const text = html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#8217;|&rsquo;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
    const tableMatch = text.match(/(\d{2}\/\d{2}\/\d{4})\s+([0-9]+(?:\.[0-9]+)?)\s+[-0-9.]+/);
    const headlineMatch = text.match(/This week's NAAIM Exposure Index number is\*?:\s*([0-9]+(?:\.[0-9]+)?)/i);

    const exposure = Number(tableMatch?.[2] ?? headlineMatch?.[1]);
    if (!Number.isFinite(exposure)) {
        return null;
    }

    return {
        exposure,
        reportDate: tableMatch ? parseUSDate(tableMatch[1], retrievedAt) : null,
        retrievedAt,
        source: 'naaim-exposure-index',
        sourceUrl: NAAIM_EXPOSURE_URL,
    };
}

export function normalizeNaaimExposure(exposure: number): number {
    // Existing model semantics: 40% exposure = fear, 90%+ = greed/crowding.
    const lowerBound = 40;
    const upperBound = 90;
    const clamped = Math.max(lowerBound, Math.min(upperBound, exposure));
    return Math.round(((clamped - lowerBound) / (upperBound - lowerBound)) * 100);
}

function parseUSDate(value: string, retrievedAt: string) {
    const [month, day, year] = value.split('/');
    return parseMarketReportDate(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`, retrievedAt);
}

export async function fetchBuffettIndicator(): Promise<BuffettIndicatorData | null> {
    try {
        const [gdpResponse, equityResponse] = await Promise.all([
            fetch(FRED_GDP_URL, {
                cache: 'force-cache',
                headers: { 'user-agent': 'SignalDashboard/1.0 (+https://github.com)' },
            }),
            fetch(FRED_EQUITY_MARKET_VALUE_URL, {
                cache: 'force-cache',
                headers: { 'user-agent': 'SignalDashboard/1.0 (+https://github.com)' },
            }),
        ]);

        if (!gdpResponse.ok || !equityResponse.ok) {
            throw new Error(`FRED fetch failed: GDP ${gdpResponse.status}, equities ${equityResponse.status}`);
        }

        const gdp = parseFredLatestObservation(await gdpResponse.text());
        const equities = parseFredLatestObservation(await equityResponse.text());

        if (!gdp || !equities) {
            return null;
        }

        return buildBuffettIndicator(equities, gdp);
    } catch (error) {
        console.warn('Buffett Indicator fetch failed:', error);
        return null;
    }
}

export function parseFredLatestObservation(html: string): FredObservation | null {
    const match = html.match(/(Q[1-4]\s+\d{4}):\s*<span class="series-meta-observation-value">([0-9,]+(?:\.[0-9]+)?)<\/span>/);

    if (!match) {
        return null;
    }

    const value = Number(match[2].replace(/,/g, ''));
    if (!Number.isFinite(value)) {
        return null;
    }

    return {
        label: match[1],
        value,
        reportDate: quarterLabelToDate(match[1]),
    };
}

export function buildBuffettIndicator(equitiesMillions: FredObservation, gdpBillions: FredObservation): BuffettIndicatorData {
    const marketValueBillions = equitiesMillions.value / 1000;
    const ratioPct = Math.round((marketValueBillions / gdpBillions.value) * 1000) / 10;
    const label = ratioPct >= 200
        ? 'Extreme valuation backdrop'
        : ratioPct >= 150
            ? 'Elevated valuation backdrop'
            : ratioPct >= 100 ? 'Neutral-to-elevated valuation backdrop' : 'Subdued valuation backdrop';

    return {
        ratioPct,
        marketValueBillions,
        gdpBillions: gdpBillions.value,
        reportDate: equitiesMillions.reportDate,
        label,
        detail: `Strategic context only. Latest domestic nonfinancial corporate equities are ${ratioPct.toFixed(1)}% of latest GDP; valuation moves slowly and should not override tactical evidence by itself.`,
        sourceUrl: `${FRED_EQUITY_MARKET_VALUE_URL} and ${FRED_GDP_URL}`,
    };
}

function quarterLabelToDate(label: string) {
    const match = label.match(/Q([1-4])\s+(\d{4})/);
    if (!match) return new Date().toISOString();

    const quarter = Number(match[1]);
    const year = match[2];
    const endDates: Record<number, string> = {
        1: `${year}-03-31`,
        2: `${year}-06-30`,
        3: `${year}-09-30`,
        4: `${year}-12-31`,
    };

    return endDates[quarter];
}
