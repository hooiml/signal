import type { Metadata } from 'next';
import { LearnDashboardV1 } from '@/components/learn/LearnDashboardV1';

export const metadata: Metadata = {
    title: 'Learn | Signal',
    description: 'Evidence-based market education using business analysis, valuation, scenarios, trading process, risk, and hindsight-safe replay.',
};

export default function LearnPage() {
    return <LearnDashboardV1 />;
}
