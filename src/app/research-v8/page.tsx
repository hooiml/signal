import type { Metadata } from 'next';
import { ResearchV8 } from '@/components/v8/ResearchV8';
import { ResearchV8Connected } from '@/components/v8/ResearchV8Connected';

export const metadata: Metadata = { title: 'Company research · Signal V8', robots: { index: false, follow: false } };

export default async function ResearchPageV8({ searchParams }: { searchParams: Promise<{ demo?: string; ticker?: string | string[] }> }) {
    const params = await searchParams;
    const ticker = typeof params.ticker === 'string' ? params.ticker.trim().toUpperCase() : undefined;
    return params.demo === '1' ? <ResearchV8 /> : <ResearchV8Connected initialTicker={ticker} />;
}
