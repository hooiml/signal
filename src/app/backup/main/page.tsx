import type { Metadata } from 'next';
import { SignalDashboard } from '@/components/v2/SignalDashboard';

export const metadata: Metadata = {
    title: 'Previous Market Dashboard | Signal',
    description: 'The previous Signal market dashboard, retained as a backup.',
};

export const revalidate = 60;

export default function BackupMarketPage() {
    return <SignalDashboard />;
}
