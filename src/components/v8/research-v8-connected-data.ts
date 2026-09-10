import { parseResearchRecord } from '@/lib/research/input';
import type { ResearchRecord } from '@/lib/types/research';

export const researchTabs = ['Overview', 'Financials', 'Thesis', 'Valuation', 'Review'] as const;
export type ResearchTab = typeof researchTabs[number];

export function parseWatchlist(payload: unknown): ResearchRecord[] {
    if (!payload || typeof payload !== 'object' || !('success' in payload) || payload.success !== true || !('data' in payload) || !Array.isArray(payload.data)) throw new Error('Saved research could not be read.');
    const archived = 'archivedSymbols' in payload && Array.isArray(payload.archivedSymbols) ? payload.archivedSymbols : [];
    const records = payload.data.map(parseResearchRecord).filter(record => !archived.includes(record.symbol));
    if (new Set(records.map(record => record.symbol)).size !== records.length) throw new Error('Duplicate saved securities returned.');
    return records.sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function researchHref(symbol: string, destination = 'review') {
    const params = new URLSearchParams({ workspace: ['review', 'valuation', 'chart'].includes(destination) ? 'research' : destination, ticker: symbol });
    if (destination === 'review') params.set('review', 'edit');
    if (destination === 'valuation' || destination === 'chart') params.set('tab', destination);
    return `/research?${params}`;
}

export function number(value: number | null | undefined, suffix = '') {
    return value == null || !Number.isFinite(value) ? 'Unavailable' : `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix}`;
}

export function money(value: number | null | undefined, currency?: string | null) {
    return value == null ? 'Unavailable' : `${currency || 'Currency not supplied'} ${number(value)}`;
}

export function date(value: string | null | undefined) {
    if (!value || !Number.isFinite(Date.parse(value))) return 'Not recorded';
    return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function sourceHref(value: string | null) {
    try { const url = new URL(value ?? ''); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}

export function retrievedAt(value: string | undefined) {
    if (!value || !Number.isFinite(Date.parse(value))) return 'Not recorded';
    return `${new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC`;
}
