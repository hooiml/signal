'use client';

import { Suspense } from 'react';
import { ResearchDashboardV7 } from '@/components/v6/ResearchDashboardV6';
import { ResearchLoadingV6 } from '@/components/v6/ThemeProviderV6';
import { ResearchExpectationDockV8 } from '@/components/v8/ResearchExpectationDockV8';
import { ResearchValuationDockV9 } from '@/components/v9/ResearchValuationDockV9';
import { ResearchDecisionCalibrationDockV10 } from '@/components/v10/ResearchDecisionCalibrationDockV10';

export const ResearchIntegratedPageV7 = () => (
    <>
        <Suspense fallback={<ResearchLoadingV6 />}>
            <ResearchDashboardV7 />
        </Suspense>
        <Suspense fallback={null}>
            <ResearchExpectationDockV8 />
            <ResearchValuationDockV9 />
            <ResearchDecisionCalibrationDockV10 />
        </Suspense>
    </>
);
