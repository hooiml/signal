import type { Metadata } from 'next';
import { ResearchOverviewPrototypeV7 } from '@/components/v7/V7Prototype';

export const metadata: Metadata = {
    title: 'Research Overview Prototype | Signal',
    description: 'A presentation-only prototype for the Signal investment research overview.',
};

export default function ResearchOverviewPrototypePageV7() {
    return <ResearchOverviewPrototypeV7 />;
}
