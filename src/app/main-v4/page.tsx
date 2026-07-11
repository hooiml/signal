import type { Metadata } from 'next';
import { SignalDashboardV4 } from '@/components/v4/SignalDashboardV4';

export const metadata: Metadata = {
    title: 'Signal V4 | Signal',
    description: 'A cleaner finance workspace for market signal review.',
};

export const revalidate = 60;

export default async function HomeV4() {
    return <SignalDashboardV4 />;
}
