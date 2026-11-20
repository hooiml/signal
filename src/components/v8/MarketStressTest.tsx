'use client';

import layout from './market-v8-connected.module.css';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export type StressSimulation = {
    vix: number;
    score: number;
    delta: number;
    active: boolean;
};

/** Local-only sensitivity estimate: never alters live API data or persisted state. */
export function computeVixStress({
    liveScore,
    liveVix,
    simulatedVix,
    vixWeight,
    mode,
}: {
    liveScore: number;
    liveVix: number;
    simulatedVix: number | null;
    vixWeight: number;
    mode: 'standard' | 'contrarian';
}): StressSimulation {
    if (simulatedVix === null || Math.abs(simulatedVix - liveVix) < 0.2) {
        return { vix: liveVix, score: liveScore, delta: 0, active: false };
    }
    const effectiveWeight = vixWeight > 0 ? vixWeight : 0.35;
    // Higher VIX lowers Momentum score and raises Contrarian opportunity score.
    const direction = mode === 'contrarian' ? 1 : -1;
    const rawDelta = (simulatedVix - liveVix) * 3.4 * effectiveWeight * direction;
    const score = clamp(Math.round(liveScore + rawDelta), 5, 95);
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
        { label: 'Panic (34)', value: 34, active: simulation.active && Math.abs(currentVix - 34) < 0.8 },
    ];

    return (
        <section className={layout.stressBar} aria-label="Volatility stress test">
            <div className={layout.stressHeader}>
                <b>What-if volatility stress test</b>
                <span>
                    {simulation.active
                        ? `Local preview: ${simulation.score}/100 (${simulation.delta >= 0 ? '+' : ''}${simulation.delta} pts) · live reading unchanged`
                        : 'Local assumption · preview how a VIX spike shifts this lens'}
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
                        max={36}
                        step={0.5}
                        value={clamp(currentVix, 11, 36)}
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
