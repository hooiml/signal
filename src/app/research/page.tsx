import type { Metadata } from 'next';
import { ResearchIntegratedPageV7 } from '@/components/v7/ResearchIntegratedPageV7';

export const metadata: Metadata = {
    title: 'Research | Signal',
    description: 'A focused investment research notebook for thesis, decision memory, and valuation review.',
};

export default function ResearchPage() {
    return <ResearchIntegratedPageV7 />;
}
