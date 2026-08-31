import type { Metadata } from 'next';
import { LearnDashboardV1 } from '@/components/learn/LearnDashboardV1';

export const metadata: Metadata = {
    title: 'Learn | Signal',
    description: 'Evidence-based investing education using business analysis, valuation, scenarios, current-market evidence, and hindsight-safe historical replay.',
};

export default function LearnPage() {
    return <LearnDashboardV1 />;
}
