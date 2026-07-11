import type { Metadata } from 'next';
import { ResearchDashboardV4 } from '@/components/v4/ResearchDashboardV4';

export const metadata: Metadata = {
    title: 'Research V4 | Signal',
    description: 'A cleaner investment research desk for watchlist review.',
};

export default function ResearchPageV4() {
    return <ResearchDashboardV4 />;
}
