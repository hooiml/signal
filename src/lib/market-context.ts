import { fetchYahooResearch, type YahooResearchResult } from './research/yahoo-research';
import type {
    BreadthContext,
    FinancialConditionsContext,
    MalaysiaRatesContext,
    MarketContextData,
    YieldCurveContext,
} from './types/market-context';

const FRED_T10Y3M_URL = 'https://fred.stlouisfed.org/series/T10Y3M';
const FRED_NFCI_URL = 'https://fred.stlouisfed.org/series/NFCI';
const BNM_BENCHMARK_YIELDS_URL = 'https://financialmarkets.bnm.gov.my/benchmark-yields';
const EQUAL_WEIGHT_SOURCE_URL = 'https://finance.yahoo.com/quote/%5ESP500EW/';
const CAP_WEIGHT_SOURCE_URL = 'https://finance.yahoo.com/quote/%5EGSPC/';

export type FredSeriesObservation = {
    readonly label: string;
    readonly value: number;
    readonly reportDate: string;
};

const fredObservationValuePattern = '<(?:span|div)[^>]*class=["\'][^"\']*series-meta-observation-value[^"\']*["\'][^>]*>\\s*(-?[0-9,]+(?:\\.[0-9]+)?)\\s*<\\/(?:span|div)>';
const fredObservationLabelPattern = '(Q[1-4]\\s+\\d{4}|\\d{4}-\\d{2}-\\d{2})';

const quarterLabelToDate = (label: string): string => {
    const match = label.match(/Q([1-4])\s+(\d{4})/);
    if (!match) return label;

    const quarter = Number(match[1]);
    const year = match[2];
    const endDates: Record<number, string> = {
        1: `${year}-03-31`,
        2: `${year}-06-30`,
        3: `${year}-09-30`,
        4: `${year}-12-31`,
    };
    return endDates[quarter] ?? label;
};

export function parseFredSeriesObservation(html: string): FredSeriesObservation | null {
    const normalized = html
        .replace(/&nbsp;|&#160;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/\r?\n/g, ' ');
    const match = normalized.match(new RegExp(
        `${fredObservationLabelPattern}\\s*:\\s*(?:<[^>]+>\\s*)*${fredObservationValuePattern}`,
        'i'
    ));

    if (!match) return null;

    const value = Number(match[2].replace(/,/g, ''));
    if (!Number.isFinite(value)) return null;

    return {
        label: match[1],
        value,
        reportDate: quarterLabelToDate(match[1]),
    };
}

export const buildYieldCurveContext = (observation: FredSeriesObservation): YieldCurveContext => ({
    spread_pct: observation.value,
    state: observation.value < 0 ? 'inverted' : 'normal',
    report_date: observation.reportDate,
    source_url: FRED_T10Y3M_URL,
});

export const buildFinancialConditionsContext = (observation: FredSeriesObservation): FinancialConditionsContext => ({
    value: observation.value,
    stance: observation.value > 0.05 ? 'tighter' : observation.value < -0.05 ? 'looser' : 'near-average',
    report_date: observation.reportDate,
    source_url: FRED_NFCI_URL,
});

const returnPercent = (values: readonly number[]): number | null => {
    const first = values[0];
    const last = values.at(-1);
    if (first === undefined || last === undefined || first <= 0) return null;
    return Number((((last - first) / first) * 100).toFixed(1));
};

const returnSeries = (data: Pick<YahooResearchResult, 'history'>): readonly number[] =>
    data.history.adjustedCloses.length >= 2 ? data.history.adjustedCloses : data.history.closes;

export const buildBreadthContext = (
    equalWeight: Pick<YahooResearchResult, 'history'>,
    capWeight: Pick<YahooResearchResult, 'history'>,
    reportDate = new Date().toISOString()
): BreadthContext | null => {
    const equalWeightReturn = returnPercent(returnSeries(equalWeight));
    const capWeightReturn = returnPercent(returnSeries(capWeight));
    if (equalWeightReturn === null || capWeightReturn === null) return null;

    return {
        equal_weight_return_pct: equalWeightReturn,
        cap_weight_return_pct: capWeightReturn,
        relative_return_pct: Number((equalWeightReturn - capWeightReturn).toFixed(1)),
        period_label: '1Y',
        report_date: reportDate,
        source_urls: [EQUAL_WEIGHT_SOURCE_URL, CAP_WEIGHT_SOURCE_URL],
    };
};

const parseBnmDate = (value: string): string | null => {
    const timestamp = Date.parse(`${value} UTC`);
    return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString().slice(0, 10);
};

const htmlToText = (html: string): string => {
    const withoutScripts = html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
    return withoutScripts
        .replace(/&nbsp;|&#160;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const parseBnmYieldRow = (section: string, tenor: '3Y' | '10Y'): number | null => {
    const row = section.match(new RegExp(
        `\\b${tenor}\\s+[A-Za-z]+\\s+\\d{4}\\s+` +
        `(-?\\d+(?:\\.\\d+)?)\\s+` +
        `(-?\\d+(?:\\.\\d+)?)\\s+` +
        `(-?\\d+(?:\\.\\d+)?)\\s+` +
        `(-?\\d+(?:\\.\\d+)?)`,
        'i'
    ));
    if (!row) return null;

    const close = Number(row[4]);
    return Number.isFinite(close) ? close : null;
};

export function parseMalaysiaBenchmarkPage(html: string): MalaysiaRatesContext | null {
    const text = htmlToText(html);
    const tradingDateMatch = text.match(/Trading Date:\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
    const oprMatch = text.match(/OVERNIGHT POLICY RATE\s+([0-9]+(?:\.[0-9]+)?)%\s+as at\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
    const myorMatch = text.match(/\bMYOR\s+([0-9]+(?:\.[0-9]+)?)%\s+as at\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
    const mgsSection = text.match(/Malaysian Government Securities \(MGS\) - Conventional([\s\S]*?)(?:Malaysian Government Investment Issues \(MGII\)|Short-Term Bills)/i)?.[1] ?? '';
    const shortTermSection = text.match(/Short-Term Bills([\s\S]*?)(?:For specific enquiries|Useful Links)/i)?.[1] ?? '';
    const reportDate = tradingDateMatch ? parseBnmDate(tradingDateMatch[1]) : null;
    const oprReportDate = oprMatch ? parseBnmDate(oprMatch[2]) : null;
    const myorReportDate = myorMatch ? parseBnmDate(myorMatch[2]) : null;
    const mgs3y = parseBnmYieldRow(mgsSection, '3Y');
    const mgs10y = parseBnmYieldRow(mgsSection, '10Y');
    const shortTermBillMatch = shortTermSection.match(/(BNM Monetary Notes(?: \(Islamic\))?|M'sian Islamic Treasury Bills|M'sian Treasury Bills)\s+([0-9]+(?:\.[0-9]+)?)/i);

    if (!reportDate || !oprMatch || !myorMatch || !oprReportDate || !myorReportDate || mgs3y === null || mgs10y === null) return null;

    const shortTermBill3m = shortTermBillMatch ? Number(shortTermBillMatch[2]) : null;
    return {
        mgs_3y_pct: mgs3y,
        mgs_10y_pct: mgs10y,
        curve_spread_pct: Number((mgs10y - mgs3y).toFixed(2)),
        opr_pct: Number(oprMatch[1]),
        myor_pct: Number(myorMatch[1]),
        short_term_bill_3m_pct: shortTermBill3m !== null && Number.isFinite(shortTermBill3m) ? shortTermBill3m : null,
        short_term_bill_name: shortTermBillMatch?.[1] ?? null,
        report_date: reportDate,
        opr_report_date: oprReportDate,
        source_url: BNM_BENCHMARK_YIELDS_URL,
    };
}

const fetchFredObservation = async (url: string): Promise<FredSeriesObservation | null> => {
    const response = await fetch(url, {
        cache: 'force-cache',
        headers: {
            Accept: 'text/html,application/xhtml+xml',
            'user-agent': 'SignalDashboard/1.0 (+https://github.com)',
        },
    });
    if (!response.ok) throw new Error(`FRED series fetch failed: ${response.status}`);
    return parseFredSeriesObservation(await response.text());
};

const fetchMalaysiaRates = async (): Promise<MalaysiaRatesContext | null> => {
    try {
        const response = await fetch(BNM_BENCHMARK_YIELDS_URL, {
            cache: 'no-store',
            headers: {
                Accept: 'text/html,application/xhtml+xml',
                'user-agent': 'SignalDashboard/1.0 (+https://github.com)',
            },
        });
        if (!response.ok) throw new Error(`BNM benchmark fetch failed: ${response.status}`);
        return parseMalaysiaBenchmarkPage(await response.text());
    } catch (error) {
        const detail = error instanceof Error ? error.message : 'Unknown BNM fetch failure';
        console.warn('Malaysia rates context fetch failed:', detail);
        return null;
    }
};

const settledValue = <T>(result: PromiseSettledResult<T>, label: string): T | null => {
    if (result.status === 'fulfilled') return result.value;
    const detail = result.reason instanceof Error ? result.reason.message : 'Unknown provider failure';
    console.warn(`${label} failed:`, detail);
    return null;
};

const fetchUsMarketContext = async (): Promise<MarketContextData> => {
    const [yieldCurveResult, financialConditionsResult, breadthResult] = await Promise.allSettled([
        fetchFredObservation(FRED_T10Y3M_URL).then((observation) => observation ? buildYieldCurveContext(observation) : null),
        fetchFredObservation(FRED_NFCI_URL).then((observation) => observation ? buildFinancialConditionsContext(observation) : null),
        Promise.allSettled([
            fetchYahooResearch('^SP500EW', 'US'),
            fetchYahooResearch('^GSPC', 'US'),
        ]).then(([equalWeightResult, capWeightResult]) => {
            const equalWeight = settledValue(equalWeightResult, 'Equal-weight index');
            const capWeight = settledValue(capWeightResult, 'Cap-weight index');
            return equalWeight && capWeight ? buildBreadthContext(equalWeight, capWeight) : null;
        }),
    ]);

    return {
        market: 'US',
        yield_curve: settledValue(yieldCurveResult, '10Y–3M yield curve'),
        financial_conditions: settledValue(financialConditionsResult, 'Chicago Fed NFCI'),
        breadth: settledValue(breadthResult, 'Market breadth'),
    };
};

export const fetchMarketContext = async (market: 'US' | 'MY'): Promise<MarketContextData> => {
    if (market === 'US') return fetchUsMarketContext();
    return { market: 'MY', malaysia_rates: await fetchMalaysiaRates() };
};
