import type { Metadata } from 'next';
import { LearnDashboardV1 } from '@/components/learn/LearnDashboardV1';
import { parseLearnMetric } from '@/lib/learn/metric-links';

export const metadata: Metadata = {
    title: 'Learn | Signal',
    description: 'Evidence-based market education using business analysis, valuation, scenarios, trading process, risk, and hindsight-safe replay.',
};

export default async function LearnPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const concept = parseLearnMetric((await searchParams).concept);
    return <LearnDashboardV1 key={concept ?? 'courses'} initialConcept={concept} />;
}
