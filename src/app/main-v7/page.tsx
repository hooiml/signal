import type { Metadata } from 'next';
import { MarketDashboardV7 } from '@/components/v6/MarketDashboardV6';

export const metadata: Metadata = {
    title: 'Market V7 | Signal',
    description: 'Live Signal Market V7 experience.',
};

export default function MarketPageV7() {
    return <MarketDashboardV7 />;
}
