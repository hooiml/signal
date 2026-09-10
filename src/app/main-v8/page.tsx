import type { Metadata } from 'next';
import { MarketV8 } from '@/components/v8/MarketV8';

export const metadata: Metadata = { title: 'Market overview · Signal V8', robots: { index: false, follow: false } };

export default async function MarketPageV8({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
    const params = await searchParams;
    return <MarketV8 demo={params.demo === '1'} />;
}
