import type { Metadata } from 'next';
import { MarketDashboardV5 } from '@/components/v5/MarketDashboardV5';

export const metadata: Metadata = {
    title: 'Signal V5 | Market Dashboard',
    description: 'Next-generation decision-first financial signal workspace.',
};

export default function HomeV5() {
    return <MarketDashboardV5 />;
}
