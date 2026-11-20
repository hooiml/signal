import type { SignalConfig } from '../signal-config';
import type { SignalTier } from './signal-v2';

export type SignalIntradayReasonCode = 'baseline' | 'evidence-unavailable' | 'configuration-unknown' | 'configuration-changed'
    | 'vix-threshold-entered' | 'vix-threshold-exited' | 'coverage-or-weights' | 'inputs-changed' | 'observation-uncertain' | 'unchanged';

export type SignalIntradayEntry = {
    readonly id: string;
    readonly capturedAt: string;
    readonly score: number;
    readonly tier: SignalTier;
    readonly previousScore: number | null;
    readonly delta: number | null;
    readonly status: 'baseline' | 'changed' | 'unchanged' | 'unavailable';
    readonly reason: { readonly code: SignalIntradayReasonCode; readonly text: string };
    readonly accounting: {
        readonly componentDelta: number;
        readonly neutralDelta: number;
        readonly roundingResidual: number;
        readonly drivers: readonly {
            readonly key: string;
            readonly name: string;
            readonly delta: number;
            readonly beforeValue: number | null;
            readonly afterValue: number | null;
            readonly beforeWeight: number | null;
            readonly afterWeight: number | null;
            readonly scoreEffect: number | null;
            readonly weightEffect: number | null;
        }[];
    } | null;
};

export type SignalIntradayResponse = Readonly<SignalConfig> & {
    readonly day: string;
    readonly entries: readonly SignalIntradayEntry[];
    readonly hasEarlierCaptures: boolean;
};
