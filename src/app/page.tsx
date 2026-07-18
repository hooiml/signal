import type { Metadata } from 'next';
import { MarketDashboardV6 } from '@/components/v6/MarketDashboardV6';

export const metadata: Metadata = {
    title: 'Signal | Market Conditions',
    description: 'A story-first view of current market conditions with progressive evidence disclosure.',
};

export const revalidate = 60;

export default function Home() {
    return <MarketDashboardV6 />;
}
