import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ResearchDashboardV5 } from '@/components/v5/ResearchDashboardV5';

export const metadata: Metadata = {
    title: 'Research V5 | Workstation',
    description: 'Professional high-density investment research desk and watchlist review.',
};

export default function ResearchPageV5() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#f7f8f5] text-[#17201d] p-8 font-mono">Loading workstation...</div>}>
            <ResearchDashboardV5 />
        </Suspense>
    );
}
