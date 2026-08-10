import type { Metadata } from 'next';
import { MarketPrototypeV7 } from '@/components/v7/V7Prototype';

export const metadata: Metadata = {
    title: 'Market Conditions Prototype | Signal',
    description: 'A presentation-only prototype for the Signal market conditions workspace.',
};

export default function MarketPrototypePageV7() {
    return <MarketPrototypeV7 />;
}
