import type { Metadata } from 'next';
import { ResearchIntegratedPageV7 } from '@/components/v7/ResearchIntegratedPageV7';

export const metadata: Metadata = {
    title: 'Research | Signal',
    description: 'A focused investment research notebook for thesis, decision memory, and valuation review.',
};

export default function ResearchPage() {
    // The shared route boundary sends ordinary reading to V8 before rendering.
    // Advanced jobs remain owned by this controller until their explicit migration.
    return <ResearchIntegratedPageV7 />;
}
