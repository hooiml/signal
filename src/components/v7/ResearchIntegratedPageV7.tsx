'use client';

import { Suspense } from 'react';
import { ResearchDashboardV7 } from '@/components/v6/ResearchDashboardV6';
import { ResearchLoadingV6 } from '@/components/v6/ThemeProviderV6';
import { ResearchMemoryDockV7 } from './ResearchMemoryDockV7';

export const ResearchIntegratedPageV7 = () => (
    <>
        <Suspense fallback={<ResearchLoadingV6 />}>
            <ResearchDashboardV7 />
        </Suspense>
        <Suspense fallback={null}>
            <ResearchMemoryDockV7 />
        </Suspense>
    </>
);
