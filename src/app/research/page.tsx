import type { Metadata } from 'next';
import { AppNav } from '@/components/AppNav';
import { ResearchDashboard } from '@/components/research/ResearchDashboard';

export const metadata: Metadata = {
    title: 'Investment Research | Signal',
    description: 'Long-horizon watchlist and investment research workspace.',
};

export default function ResearchPage() {
    return (
        <main className="min-h-screen bg-[#f6f7f9] text-slate-950 selection:bg-emerald-200 selection:text-slate-950">
            <AppNav active="research" tone="light" />
            <ResearchDashboard />
        </main>
    );
}
