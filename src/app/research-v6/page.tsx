import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ResearchDashboardV6 } from '@/components/v6/ResearchDashboardV6';
import { ResearchLoadingV6 } from '@/components/v6/ThemeProviderV6';

export const metadata: Metadata = {
    title: 'Research | Signal',
    description: 'A focused investment research notebook for thesis and valuation review.',
};

export default function ResearchPageV6() {
    return (
        <Suspense fallback={<ResearchLoadingV6 />}>
            <ResearchDashboardV6 />
        </Suspense>
    );
}
