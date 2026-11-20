import { parseResearchChartResponse } from '@/lib/research/snapshot-input';
import type { ResearchMarket } from '@/lib/types/research';
import { readData, readPolicies } from './read-data';

export async function readResearchChart(symbol: string, market: ResearchMarket, signal: AbortSignal) {
    const payload = await readData(`/api/research/chart/${encodeURIComponent(symbol)}?market=${market}`, signal, readPolicies.provider);
    const chart = parseResearchChartResponse(payload);
    const { data } = payload as { data: { symbol?: unknown; market?: unknown } };
    if (data.symbol !== symbol || data.market !== market) throw new Error('Chart security mismatch');
    return chart;
}
