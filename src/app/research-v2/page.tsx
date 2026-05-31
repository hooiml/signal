import type { Metadata } from 'next';
import { ResearchDashboardV2 } from '@/components/research/ResearchDashboardV2';

export const metadata: Metadata = {
    title: 'Investment Research V2 | Signal',
    description: 'Long-horizon watchlist and investment research workspace.',
};

export default function ResearchPageV2() {
    return <ResearchDashboardV2 />;
}
