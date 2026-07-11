import type { Metadata } from 'next';
import { ResearchDashboard } from '@/components/research/ResearchDashboard';

export const metadata: Metadata = {
    title: 'Previous Research Workspace | Signal',
    description: 'The previous Signal research workspace, retained as a backup.',
};

export default function BackupResearchPage() {
    return <ResearchDashboard />;
}
