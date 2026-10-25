import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MarketDashboardV7 } from '@/components/v6/MarketDashboardV6';
import { ResearchLoadingV6 } from '@/components/v6/ThemeProviderV6';

export const metadata: Metadata = { title: 'Market tools | Signal', description: 'Market alerts, exposure reviews and detailed evidence.' };

export default function MarketToolsPage() {
    return <Suspense fallback={<ResearchLoadingV6 />}><MarketDashboardV7 /></Suspense>;
}
