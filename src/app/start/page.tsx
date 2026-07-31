import type { Metadata } from 'next';
import { StartGuideV6 } from '@/components/v6/StartGuideV6';

export const metadata: Metadata = {
    title: 'Start Here | Signal',
    description: 'A guided path from current market conditions to one evidence-led research action.',
};

export default function StartPage() {
    return <StartGuideV6 />;
}
