import type { Metadata } from 'next';
import { MarketDashboardV6 } from '@/components/v6/MarketDashboardV6';

export const metadata: Metadata = {
    title: 'Signal V6 | Market Briefing',
    description: 'A decision-first market signal briefing with progressive evidence disclosure.',
};

export const revalidate = 60;

export default function MarketPageV6() {
    return <MarketDashboardV6 />;
}
