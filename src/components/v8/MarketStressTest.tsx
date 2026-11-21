'use client';

import { getIndicatorBaseWeights } from '@/lib/indicator-registry';
import { calculateCompositeScoreV2 } from '@/lib/sentiment-calculator-v2';
import type { IndicatorData, MarketSignal } from '@/lib/types/signal-v2';
import layout from './market-v8-connected.module.css';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const normalizeVixLogistic = (vix: number) => Math.max(0, Math.min(100, Math.round((100 / (1 + Math.exp((vix - 24) / 6))) * 100) / 100));

export type StressSimulation = {
    vix: number;
    score: number;
    delta: number;
    active: boolean;
    vixWeightPct?: number;
};

/** Local-only sensitivity estimate using the production logistic VIX curve and smooth weight ramp. */
export function computeVixStress({
    liveScore,
    liveVix,
    simulatedVix,
    vixWeight,
    mode,
    signal,
}: {
    liveScore: number;
    liveVix: number;
    simulatedVix: number | null;
    vixWeight: number;
    mode: 'standard' | 'contrarian';
    signal?: MarketSignal;
}): StressSimulation {
    if (simulatedVix === null || Math.abs(simulatedVix - liveVix) < 0.2) {
        return { vix: liveVix, score: liveScore, delta: 0, active: false };
    }
    const simVixScore = normalizeVixLogistic(simulatedVix);
    if (signal && signal.metadata.market === 'US') {
        const enableSocial = signal.metadata.source_included ?? true;
        const components: IndicatorData[] = Object.values(signal.components).map(component =>
            component.name === 'vix'
                ? { ...component, value: simulatedVix, score: simVixScore }
                : component
        );
        const simulated = calculateCompositeScoreV2(components, { market: 'US', mode, enableSocial });
        const simWeight = getIndicatorBaseWeights('US', { vixValue: simulatedVix, enableSocial }).vix ?? vixWeight;
        return {
            vix: simulatedVix,
            score: simulated.composite_score,
            delta: simulated.composite_score - Math.round(liveScore),
            active: true,
            vixWeightPct: Math.round(simWeight * 100),
        };
    }
    // Fallback when full signal components are absent: numeric score always falls as VIX rises
    // (Contrarian mode flips tier interpretation, never the 0-100 score direction).
    const liveVixScore = normalizeVixLogistic(liveVix);
    const effectiveWeight = vixWeight > 0 ? vixWeight : 0.40;
    const rawDelta = (simVixScore - liveVixScore) * effectiveWeight;
    const score = clamp(Math.round(liveScore + rawDelta), 0, 100);
    return { vix: simulatedVix, score, delta: score - Math.round(liveScore), active: true };
}

export function MarketStressTest({
    liveVix,
    simulatedVix,
    simulation,
    onChange,
}: {
    liveVix: number;
    simulatedVix: number | null;
    simulation: StressSimulation;
    onChange: (next: number | null) => void;
}) {
    const currentVix = simulatedVix ?? liveVix;
    const presets = [
        { label: `Live (${liveVix.toFixed(1)})`, value: null as number | null, active: !simulation.active },
        { label: 'Dip (23)', value: 23, active: simulation.active && Math.abs(currentVix - 23) < 0.8 },
        { label: 'Stress (32)', value: 32, active: simulation.active && Math.abs(currentVix - 32) < 0.8 },
        { label: 'Panic (40)', value: 40, active: simulation.active && Math.abs(currentVix - 40) < 0.8 },
    ];

    return (
        <section className={layout.stressBar} aria-label="Volatility stress test">
            <div className={layout.stressHeader}>
                <b>What-if volatility stress test</b>
                <span>
                    {simulation.active
                        ? `Local preview: ${simulation.score}/100 (${simulation.delta >= 0 ? '+' : ''}${simulation.delta} pts${simulation.vixWeightPct ? ` · VIX weight ${simulation.vixWeightPct}%` : ''}) · live reading unchanged`
                        : 'Local assumption · preview how a VIX move shifts the composite score'}
                </span>
            </div>
            <div className={layout.stressControls}>
                <div className={layout.stressPresets}>
                    {presets.map(preset => (
                        <button
                            key={preset.label}
                            type="button"
                            className={layout.stressPresetBtn}
                            aria-pressed={preset.active}
                            onClick={() => onChange(preset.value)}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
                <label className={layout.stressSliderWrap}>
                    <span className={layout.stressReadout}>VIX {currentVix.toFixed(1)}</span>
                    <input
                        type="range"
                        min={11}
                        max={45}
                        step={0.5}
                        value={clamp(currentVix, 11, 45)}
                        aria-label="Simulated VIX level"
                        className={layout.stressSlider}
                        onChange={event => {
                            const next = Number.parseFloat(event.target.value);
                            if (Math.abs(next - liveVix) < 0.3) onChange(null);
                            else onChange(next);
                        }}
                    />
                </label>
            </div>
        </section>
    );
}
