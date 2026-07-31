import type { Metadata } from 'next';
import { GuidedDemoV6 } from '@/components/v6/GuidedDemoV6';

export const metadata: Metadata = {
    title: 'Guided Demo | Signal',
    description: 'A read-only, isolated example of Signal Market, Research, and Portfolio workflows.',
};

export default function GuidedDemoPage() {
    return <GuidedDemoV6 />;
}
