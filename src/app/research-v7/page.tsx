import type { Metadata } from 'next';
import { ResearchDashboardV7 } from '@/components/v6/ResearchDashboardV6';

export const metadata: Metadata = {
    title: 'Research V7 | Signal',
    description: 'Live Signal Research V7 experience.',
};

export default function ResearchPageV7() {
    return <ResearchDashboardV7 />;
}
