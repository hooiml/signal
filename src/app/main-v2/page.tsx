import type { Metadata } from 'next';
import { SignalDashboardV2 } from '@/components/v2/SignalDashboardV2';

export const metadata: Metadata = {
    title: 'Signal Dashboard V2 | Signal',
    description: 'Next-generation cockpit display and indicator tracking.',
};

export const revalidate = 60;

export default async function HomeV2() {
    return <SignalDashboardV2 />;
}
