import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ResearchIntegratedPageV7 } from '@/components/v7/ResearchIntegratedPageV7';

export const metadata: Metadata = {
    title: 'Research | Signal',
    description: 'A focused investment research notebook for thesis, decision memory, and valuation review.',
};

export default async function ResearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const params = await searchParams;
    // Existing task/deep links keep their workspace; the ordinary entry is reading-first.
    if (Object.keys(params).every(key => key === 'ticker')) {
        const query = new URLSearchParams();
        if (typeof params.ticker === 'string') query.set('ticker', params.ticker.trim().toUpperCase());
        redirect(`/research-v8${query.size ? `?${query}` : ''}`);
    }
    return <ResearchIntegratedPageV7 />;
}
