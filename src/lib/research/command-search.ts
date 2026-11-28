import type { ResearchMarket, ResearchRecord } from '../types/research';
import { researchStructuredTriggerDefinitions } from './structured-triggers';

export const RECENT_TICKERS_STORAGE_KEY = 'signal.v9.recent-tickers.v1';
export const MAX_RECENT_TICKERS = 6;
const MAX_RECORDS_SCANNED = 200;
const MAX_SNIPPET_CHARS = 110;

export type RecentTicker = {
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly companyName?: string;
    readonly visitedAt: string;
};

export type LocalResearchTab = 'review' | 'evidence' | 'monitoring';
export type LocalResearchTag = 'Saved' | 'Thesis' | 'Evidence' | 'Citation' | 'Monitor';

export type LocalResearchHit = {
    readonly id: string;
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly title: string;
    readonly subtitle: string;
    readonly tag: LocalResearchTag;
    readonly tab?: LocalResearchTab;
    readonly score: number;
};

const triggerMetricLabels = new Map(
    researchStructuredTriggerDefinitions.map(def => [def.metric, def.label]),
);

const compactWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const truncateSnippet = (text: string, query: string): string => {
    const clean = compactWhitespace(text);
    if (clean.length <= MAX_SNIPPET_CHARS) return clean;
    const lower = clean.toLowerCase();
    const token = query.trim().toLowerCase().split(/\s+/)[0] ?? '';
    const idx = token ? lower.indexOf(token) : -1;
    if (idx <= 32) return `${clean.slice(0, MAX_SNIPPET_CHARS - 1).trimEnd()}…`;
    const start = Math.max(0, idx - 28);
    const slice = clean.slice(start, start + MAX_SNIPPET_CHARS - 2).trim();
    return `…${slice}…`;
};

const matchesFieldWithContext = (
    prefixLower: string,
    fieldText: string,
    needle: string,
    tokens: readonly string[],
): boolean => {
    if (!needle || !fieldText) return false;
    const fieldLower = fieldText.toLowerCase();
    if (tokens.length <= 1) return fieldLower.includes(needle);
    const combined = `${prefixLower} ${fieldLower}`;
    if (!tokens.every(token => combined.includes(token))) return false;
    const fieldOnlyTokens = tokens.filter(token => !prefixLower.includes(token));
    return fieldOnlyTokens.length > 0 && fieldOnlyTokens.every(token => fieldLower.includes(token));
};

export function parseRecentTickers(raw: string | null): RecentTicker[] {
    if (!raw) return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const seen = new Set<string>();
        const out: RecentTicker[] = [];
        for (const entry of parsed) {
            if (!entry || typeof entry !== 'object') continue;
            const candidate = entry as Record<string, unknown>;
            const symbol = typeof candidate.symbol === 'string' ? candidate.symbol.trim().toUpperCase() : '';
            const market = candidate.market === 'US' || candidate.market === 'MY' ? candidate.market : null;
            const visitedAt = typeof candidate.visitedAt === 'string' ? candidate.visitedAt : '';
            const companyName = typeof candidate.companyName === 'string' && candidate.companyName.trim()
                ? candidate.companyName.trim().slice(0, 120)
                : undefined;
            if (!symbol || symbol.length > 16 || !market || !visitedAt) continue;
            const key = `${market}:${symbol}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ symbol, market, ...(companyName ? { companyName } : {}), visitedAt });
            if (out.length >= MAX_RECENT_TICKERS) break;
        }
        return out;
    } catch {
        return [];
    }
}

export function mergeRecentTicker(
    current: readonly RecentTicker[],
    next: { readonly symbol: string; readonly market: ResearchMarket; readonly companyName?: string },
    nowIso: string,
): RecentTicker[] {
    const symbol = next.symbol.trim().toUpperCase();
    if (!symbol) return [...current].slice(0, MAX_RECENT_TICKERS);
    const key = `${next.market}:${symbol}`;
    const existing = current.find(item => `${item.market}:${item.symbol}` === key);
    const companyName = next.companyName?.trim() || existing?.companyName;
    const entry: RecentTicker = {
        symbol,
        market: next.market,
        ...(companyName ? { companyName: companyName.slice(0, 120) } : {}),
        visitedAt: nowIso,
    };
    const rest = current.filter(item => `${item.market}:${item.symbol}` !== key);
    return [entry, ...rest].slice(0, MAX_RECENT_TICKERS);
}

export function readRecentTickers(): RecentTicker[] {
    if (typeof window === 'undefined') return [];
    try {
        return parseRecentTickers(window.localStorage.getItem(RECENT_TICKERS_STORAGE_KEY));
    } catch {
        return [];
    }
}

export function writeRecentTicker(symbol: string, market: ResearchMarket, companyName?: string): void {
    if (typeof window === 'undefined') return;
    try {
        const current = parseRecentTickers(window.localStorage.getItem(RECENT_TICKERS_STORAGE_KEY));
        const next = mergeRecentTicker(current, { symbol, market, companyName }, new Date().toISOString());
        window.localStorage.setItem(RECENT_TICKERS_STORAGE_KEY, JSON.stringify(next));
    } catch {
        // Ignore storage quota or privacy-mode errors.
    }
}

function formatMonitoringSnippets(record: ResearchRecord): string[] {
    const snippets: string[] = [];
    const rules = record.monitoringRules;
    if (rules.buyZone) snippets.push(`Buy zone alert${record.targetBuyZone ? `: ${record.targetBuyZone}` : ''}`);
    if (rules.belowMa200) snippets.push('Price below 200-day moving average (MA200)');
    if (rules.rsiBelow !== null) snippets.push(`RSI(14) below ${rules.rsiBelow}`);
    if (rules.rsiAbove !== null) snippets.push(`RSI(14) above ${rules.rsiAbove}`);
    if (rules.earningsWithinDays !== null) snippets.push(`Earnings within ${rules.earningsWithinDays} days`);
    if (rules.reviewAgeDays !== null) snippets.push(`Review age above ${rules.reviewAgeDays} days`);
    for (const rule of rules.structuredTriggers?.rules ?? []) {
        const label = triggerMetricLabels.get(rule.metric) ?? rule.metric;
        const purpose = rule.purpose.replace(/-/g, ' ');
        snippets.push(`${label} ${rule.operator} ${rule.threshold} (${purpose}${rule.enabled ? '' : ', paused'})`);
    }
    return snippets;
}

/**
 * Pure, bounded, 100% browser-local search over loaded ResearchRecords.
 * Scans at most 200 records and jumps to overview, review, evidence, or monitoring tabs.
 */
export function searchLocalResearchRecords(
    records: readonly ResearchRecord[],
    query: string,
    maxResults = 12,
): LocalResearchHit[] {
    if (!records.length || maxResults <= 0) return [];
    const bounded = records.slice(0, MAX_RECORDS_SCANNED);
    const trimmed = compactWhitespace(query);
    const needle = trimmed.toLowerCase();
    const tokens = needle ? needle.split(/\s+/).filter(Boolean) : [];

    if (!needle) {
        return bounded.slice(0, Math.min(maxResults, 6)).map((record, index) => ({
            id: `saved:${record.market}:${record.symbol}`,
            symbol: record.symbol,
            market: record.market,
            title: `${record.symbol} · ${record.companyName || record.symbol}`,
            subtitle: `Saved ${record.market} research${record.status ? ` · ${record.status}` : ''}`,
            tag: 'Saved' as const,
            score: 50 - index,
        }));
    }

    const bestByTarget = new Map<string, LocalResearchHit>();
    const consider = (hit: LocalResearchHit) => {
        const targetKey = `${hit.market}:${hit.symbol}:${hit.tab ?? 'overview'}`;
        const prev = bestByTarget.get(targetKey);
        if (!prev || hit.score > prev.score) {
            bestByTarget.set(targetKey, hit);
        }
    };

    for (const record of bounded) {
        const symLower = record.symbol.toLowerCase();
        const nameLower = (record.companyName || '').toLowerCase();
        const prefix = `${record.symbol} ${record.companyName || ''}`;
        const prefixLower = prefix.toLowerCase();

        // 1. Company & symbol match
        if (symLower === needle) {
            consider({
                id: `saved:${record.market}:${record.symbol}`,
                symbol: record.symbol,
                market: record.market,
                title: `${record.symbol} · ${record.companyName || record.symbol}`,
                subtitle: `Saved ${record.market} research · overview & chart`,
                tag: 'Saved',
                score: 100,
            });
        } else if (symLower.startsWith(needle) || nameLower.startsWith(needle)) {
            consider({
                id: `saved:${record.market}:${record.symbol}`,
                symbol: record.symbol,
                market: record.market,
                title: `${record.symbol} · ${record.companyName || record.symbol}`,
                subtitle: `Saved ${record.market} research · overview & chart`,
                tag: 'Saved',
                score: 88,
            });
        } else if (prefixLower.includes(needle) || (tokens.length > 1 && tokens.every(token => prefixLower.includes(token)))) {
            consider({
                id: `saved:${record.market}:${record.symbol}`,
                symbol: record.symbol,
                market: record.market,
                title: `${record.symbol} · ${record.companyName || record.symbol}`,
                subtitle: `Saved ${record.market} research · overview & chart`,
                tag: 'Saved',
                score: 74,
            });
        }

        // 2. Thesis & decision journal fields -> Review tab
        const thesisFields: readonly { label: string; text: string }[] = [
            { label: 'Why interested', text: record.whyInterested },
            { label: 'Bull case', text: record.bullCase },
            { label: 'Bear case', text: record.bearCase },
            { label: 'Buy trigger', text: record.buyTrigger },
            { label: 'Sell trigger', text: record.sellTrigger },
            { label: 'Thesis break', text: record.thesisBreak },
            { label: 'Notes', text: record.notes },
            { label: 'Buy zone', text: record.targetBuyZone },
            { label: 'Decision', text: record.decisionJournal?.decision && record.decisionJournal.decision !== 'Not recorded' ? record.decisionJournal.decision : '' },
            { label: 'Outcome note', text: record.decisionJournal?.outcomeNote ?? '' },
        ];
        for (const field of thesisFields) {
            if (matchesFieldWithContext(prefixLower, field.text, needle, tokens)) {
                consider({
                    id: `thesis:${record.market}:${record.symbol}`,
                    symbol: record.symbol,
                    market: record.market,
                    title: `${record.symbol} · ${field.label}`,
                    subtitle: truncateSnippet(field.text, needle),
                    tag: 'Thesis',
                    tab: 'review',
                    score: field.text.toLowerCase().includes(needle) ? 68 : 60,
                });
            }
        }

        // 3. Accepted evidence -> Evidence tab
        for (const item of record.acceptedEvidence ?? []) {
            const sourceText = item.sources.map(s => `${s.label} ${s.source}`).join(' ');
            const combined = `${item.title} ${item.summary} ${sourceText}`.trim();
            if (matchesFieldWithContext(prefixLower, combined, needle, tokens)) {
                consider({
                    id: `evidence:${record.market}:${record.symbol}`,
                    symbol: record.symbol,
                    market: record.market,
                    title: `${record.symbol} · ${truncateSnippet(item.title || 'Accepted evidence', needle)}`,
                    subtitle: truncateSnippet(item.summary || sourceText, needle),
                    tag: 'Evidence',
                    tab: 'evidence',
                    score: combined.toLowerCase().includes(needle) ? 66 : 58,
                });
            }
        }

        // 4. Primary-document citations -> Evidence tab
        for (const citation of record.documentEvidence?.citations ?? []) {
            const combined = [
                citation.sourceKind,
                citation.title,
                citation.location,
                citation.excerpt,
                citation.providerLabel,
                citation.reportingPeriod ?? '',
            ].join(' ');
            if (matchesFieldWithContext(prefixLower, combined, needle, tokens)) {
                consider({
                    id: `citation:${record.market}:${record.symbol}`,
                    symbol: record.symbol,
                    market: record.market,
                    title: `${record.symbol} · ${citation.sourceKind} ${citation.reportingPeriod ?? citation.publicationDate}`.trim(),
                    subtitle: truncateSnippet(citation.excerpt || citation.title || citation.location, needle),
                    tag: 'Citation',
                    tab: 'evidence',
                    score: combined.toLowerCase().includes(needle) ? 67 : 59,
                });
            }
        }

        // 5. Monitoring rules & structured triggers -> Monitoring tab
        for (const ruleText of formatMonitoringSnippets(record)) {
            if (matchesFieldWithContext(prefixLower, ruleText, needle, tokens)) {
                consider({
                    id: `monitor:${record.market}:${record.symbol}`,
                    symbol: record.symbol,
                    market: record.market,
                    title: `${record.symbol} · Monitoring rule`,
                    subtitle: truncateSnippet(ruleText, needle),
                    tag: 'Monitor',
                    tab: 'monitoring',
                    score: ruleText.toLowerCase().includes(needle) ? 64 : 56,
                });
            }
        }
    }

    return [...bestByTarget.values()]
        .sort((left, right) => right.score - left.score || left.symbol.localeCompare(right.symbol) || left.market.localeCompare(right.market))
        .slice(0, maxResults);
}
