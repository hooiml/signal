import { NextResponse } from 'next/server';
import { buildResearchBenchmark } from '@/lib/research/benchmark';
import { fetchYahooResearch } from '@/lib/research/yahoo-research';

export async function GET(request: Request, context: { params: Promise<{ symbol: string }> }) {
    const symbol = (await context.params).symbol.trim().toUpperCase();
    if (!/^[A-Z0-9.-]{1,15}$/.test(symbol) || new URL(request.url).searchParams.get('market') !== 'US') return NextResponse.json({ success: false, error: 'Invalid US security.' }, { status: 400 });
    const [candidate, baseline] = await Promise.allSettled([fetchYahooResearch(symbol, 'US'), fetchYahooResearch('VOO', 'US')]);
    return NextResponse.json({ success: true, data: buildResearchBenchmark(candidate.status === 'fulfilled' ? candidate.value : null, baseline.status === 'fulfilled' ? baseline.value : null) });
}
