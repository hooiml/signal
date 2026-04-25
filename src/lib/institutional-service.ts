
import { sql } from './db';

export interface InstitutionalDataEntry {
    indicator_name: string;
    value: number;
    report_date: string;
}

export interface AAIISentimentData {
    bullish: number;
    neutral: number;
    bearish: number;
    bullBearSpread: number;
    reportDate: string;
    source: 'aaii-page' | 'aaii-insights-rss';
    sourceUrl: string;
}

const AAII_SENTIMENT_URL = 'https://www.aaii.com/sentimentsurvey';
const AAII_INSIGHTS_FEED_URL = 'https://insights.aaii.com/feed';

export async function getLatestInstitutionalData(): Promise<InstitutionalDataEntry[]> {
    try {
        // Fetch the most recent entry for each indicator
        const result = await sql`
            SELECT DISTINCT ON (indicator_name)
                indicator_name,
                value,
                report_date::text as report_date
            FROM institutional_data
            ORDER BY indicator_name, report_date DESC
        `;

        return result.map(row => ({
            indicator_name: row.indicator_name,
            value: Number(row.value),
            report_date: row.report_date
        }));
    } catch (error) {
        console.error('Error fetching institutional data:', error);
        return [];
    }
}

export async function updateInstitutionalIndicator(
    name: string,
    value: number,
    date: string
): Promise<boolean> {
    try {
        await sql`
            INSERT INTO institutional_data (indicator_name, value, report_date)
            VALUES (${name}, ${value}, ${date})
            ON CONFLICT (indicator_name, report_date)
            DO UPDATE SET value = EXCLUDED.value
        `;
        return true;
    } catch (error) {
        console.error('Error updating institutional indicator:', error);
        return false;
    }
}

export async function refreshAAIIIndicator(): Promise<AAIISentimentData> {
    const latest = await fetchLatestAAIISentiment();

    if (!latest) {
        throw new Error('Unable to fetch current AAII sentiment data from AAII sources');
    }

    const success = await updateInstitutionalIndicator('aaii', latest.bullish, latest.reportDate);

    if (!success) {
        throw new Error('Fetched AAII data but failed to update institutional_data');
    }

    return latest;
}

export async function fetchLatestAAIISentiment(): Promise<AAIISentimentData | null> {
    const candidates = await Promise.all([
        fetchAAIIPageSentiment(),
        fetchAAIIInsightsFeedSentiment(),
    ]);

    return candidates
        .filter((candidate): candidate is AAIISentimentData => candidate !== null)
        .sort((a, b) => b.reportDate.localeCompare(a.reportDate))[0] ?? null;
}

async function fetchAAIIPageSentiment(): Promise<AAIISentimentData | null> {
    try {
        const html = await fetchText(AAII_SENTIMENT_URL);
        const text = normalizeText(stripHtml(html));
        const tableMatch = text.match(
            /Week Ending\s+Sentiment Votes\s+Bullish\s+Neutral\s+Bearish\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%/i
        );

        if (!tableMatch) {
            return null;
        }

        const [, rawDate, bullish, neutral, bearish] = tableMatch;
        return toAAIIData({
            bullish,
            neutral,
            bearish,
            reportDate: parseUSDate(rawDate),
            source: 'aaii-page',
            sourceUrl: AAII_SENTIMENT_URL,
        });
    } catch (error) {
        console.warn('AAII sentiment page fetch failed:', error);
        return null;
    }
}

async function fetchAAIIInsightsFeedSentiment(): Promise<AAIISentimentData | null> {
    try {
        const xml = await fetchText(AAII_INSIGHTS_FEED_URL);
        const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];

        for (const itemMatch of itemMatches) {
            const itemXml = itemMatch[1];
            const link = decodeHtml(extractTag(itemXml, 'link'));

            if (!/aaii-sentiment-survey/i.test(link)) {
                continue;
            }

            const content = normalizeText(stripHtml(decodeHtml(extractTag(itemXml, 'content:encoded'))));
            const pubDate = decodeHtml(extractTag(itemXml, 'pubDate'));
            const bullish = extractPercent(content, /Bullish:\s*([\d.]+)%/i)
                ?? extractPercent(content, /Bullish sentiment[\s\S]*?to\s+([\d.]+)%/i);
            const neutral = extractPercent(content, /Neutral:\s*([\d.]+)%/i)
                ?? extractPercent(content, /Neutral sentiment[\s\S]*?to\s+([\d.]+)%/i);
            const bearish = extractPercent(content, /Bearish:\s*([\d.]+)%/i)
                ?? extractPercent(content, /Bearish sentiment[\s\S]*?to\s+([\d.]+)%/i);

            if (bullish === null || neutral === null || bearish === null) {
                continue;
            }

            return toAAIIData({
                bullish,
                neutral,
                bearish,
                reportDate: inferAAIIWeekEndingDate(pubDate),
                source: 'aaii-insights-rss',
                sourceUrl: link || AAII_INSIGHTS_FEED_URL,
            });
        }

        return null;
    } catch (error) {
        console.warn('AAII Insights feed fetch failed:', error);
        return null;
    }
}

async function fetchText(url: string): Promise<string> {
    const response = await fetch(url, {
        cache: 'no-store',
        headers: {
            'user-agent': 'SignalDashboard/1.0 (+https://github.com)',
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
    });

    if (!response.ok) {
        throw new Error(`Fetch failed for ${url}: ${response.status}`);
    }

    return response.text();
}

function toAAIIData(input: {
    bullish: string | number;
    neutral: string | number;
    bearish: string | number;
    reportDate: string;
    source: AAIISentimentData['source'];
    sourceUrl: string;
}): AAIISentimentData | null {
    const bullish = Number(input.bullish);
    const neutral = Number(input.neutral);
    const bearish = Number(input.bearish);

    if (!Number.isFinite(bullish) || !Number.isFinite(neutral) || !Number.isFinite(bearish)) {
        return null;
    }

    return {
        bullish,
        neutral,
        bearish,
        bullBearSpread: Number((bullish - bearish).toFixed(1)),
        reportDate: input.reportDate,
        source: input.source,
        sourceUrl: input.sourceUrl,
    };
}

function extractTag(xml: string, tagName: string): string {
    const escapedTag = tagName.replace(':', '\\:');
    const match = xml.match(new RegExp(`<${escapedTag}[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, 'i'));
    return stripCdata(match?.[1] ?? '');
}

function stripCdata(value: string): string {
    return value.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
}

function extractPercent(text: string, pattern: RegExp): number | null {
    const match = text.match(pattern);
    return match ? Number(match[1]) : null;
}

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ');
}

function normalizeText(text: string): string {
    return decodeHtml(text).replace(/\s+/g, ' ').trim();
}

function decodeHtml(value: string): string {
    return value
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#8211;/g, '-')
        .replace(/&#8212;/g, '-')
        .replace(/&#8217;/g, "'");
}

function parseUSDate(value: string): string {
    const [month, day, year] = value.split('/').map(Number);
    return formatDateUTC(new Date(Date.UTC(year, month - 1, day)));
}

function inferAAIIWeekEndingDate(pubDate: string): string {
    const publishedAt = new Date(pubDate);

    if (Number.isNaN(publishedAt.getTime())) {
        throw new Error(`Invalid AAII publication date: ${pubDate}`);
    }

    const date = new Date(Date.UTC(
        publishedAt.getUTCFullYear(),
        publishedAt.getUTCMonth(),
        publishedAt.getUTCDate()
    ));
    const day = date.getUTCDay();
    const daysSinceWednesday = (day - 3 + 7) % 7;
    date.setUTCDate(date.getUTCDate() - daysSinceWednesday);

    return formatDateUTC(date);
}

function formatDateUTC(date: Date): string {
    return date.toISOString().slice(0, 10);
}
