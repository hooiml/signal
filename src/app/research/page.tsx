import type { Metadata } from 'next';
import { ResearchDashboard } from '@/components/research/ResearchDashboard';

export const metadata: Metadata = {
    title: 'Investment Research | Signal',
    description: 'Long-horizon watchlist and investment research workspace.',
};

export default function ResearchPage() {
    return <ResearchDashboard />;
}
