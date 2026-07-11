import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ResearchDashboardV6 } from '@/components/v6/ResearchDashboardV6';

export const metadata: Metadata = {
    title: 'Research V6 | Signal',
    description: 'A focused investment research notebook for thesis and valuation review.',
};

export default function ResearchPageV6() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#0b1118] p-6 text-[#eef2f7]">Loading research...</div>}>
            <ResearchDashboardV6 />
        </Suspense>
    );
}
