'use client';

import { useState } from 'react';

type Concept = 'put-call' | 'naaim';

const panel = 'rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4';

function PutCallLesson() {
    const [puts, setPuts] = useState(840);
    const [calls, setCalls] = useState(1200);
    const ratio = calls > 0 ? puts / calls : null;

    return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(250px,0.8fr)]">
        <div>
            <p className="text-sm leading-6 text-[var(--v7-text-secondary)]">A put/call volume ratio compares the number of put contracts traded with call contracts over the same market and time period.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-semibold text-[var(--v7-text)]">Put volume
                    <input aria-label="Illustrative put option volume" type="number" min="0" step="1" value={puts} onChange={(event) => setPuts(Math.max(0, Number(event.target.value) || 0))} className="min-h-11 min-w-0 rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface)] px-3 font-mono font-normal tabular-nums" />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold text-[var(--v7-text)]">Call volume
                    <input aria-label="Illustrative call option volume" type="number" min="0" step="1" value={calls} onChange={(event) => setCalls(Math.max(0, Number(event.target.value) || 0))} className="min-h-11 min-w-0 rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface)] px-3 font-mono font-normal tabular-nums" />
                </label>
            </div>
            <div aria-live="polite" className="mt-4 rounded-[9px] border border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] p-4">
                <p className="text-xs text-[var(--v7-text-muted)]">Puts ÷ calls · illustrative arithmetic</p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[var(--v7-text)]">{ratio === null ? 'Undefined' : ratio.toFixed(2)}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--v7-text-secondary)]">{ratio === null ? 'A zero call-volume denominator makes this ratio undefined.' : `Here, ${puts.toLocaleString()} ÷ ${calls.toLocaleString()} = ${ratio.toFixed(2)} puts per call.`}</p>
            </div>
        </div>
        <aside className="grid content-start gap-3 text-sm leading-6 text-[var(--v7-text-secondary)]">
            <div className={panel}><h3 className="font-bold text-[var(--v7-text)]">How to read it</h3><p className="mt-1">Higher values mean more puts traded relative to calls in the chosen sample. Some traders read a high ratio as caution or hedging demand, but that is an interpretation, not a forecast.</p></div>
            <div className={panel}><h3 className="font-bold text-[var(--v7-text)]">Limits</h3><p className="mt-1">Puts and calls can be bought or sold for many purposes. Product coverage, expiration activity, and the selected period change the result; compare like with like.</p></div>
        </aside>
    </div>;
}

function NaaimLesson() {
    const [exposure, setExposure] = useState(65);
    const description = exposure < 0 ? 'net short exposure in this simplified example' : exposure === 0 ? 'cash or market-neutral exposure in this simplified example' : exposure <= 100 ? 'long exposure up to a fully invested reference point in this simplified example' : 'leveraged long exposure in this simplified example';
    return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(250px,0.8fr)]">
        <div>
            <p className="text-sm leading-6 text-[var(--v7-text-secondary)]">The NAAIM Exposure Index averages participating active managers’ reported U.S. equity exposure for the week. Its scale can represent short, neutral, fully invested, or leveraged exposure.</p>
            <div className="mt-4 rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-4">
                <label htmlFor="naaim-exposure" className="flex flex-wrap items-baseline justify-between gap-2 text-sm font-semibold text-[var(--v7-text)]"><span>Hypothetical exposure</span><span className="font-mono text-lg tabular-nums">{exposure}%</span></label>
                <input id="naaim-exposure" aria-label="Hypothetical manager equity exposure" type="range" min="-200" max="200" step="5" value={exposure} onChange={(event) => setExposure(Number(event.target.value))} className="mt-3 min-h-10 w-full accent-[var(--v7-accent)]" />
                <div className="flex justify-between gap-2 text-xs text-[var(--v7-text-muted)]"><span>−200% leveraged short</span><span>0% neutral</span><span>+200% leveraged long</span></div>
                <p aria-live="polite" className="mt-3 text-sm leading-6 text-[var(--v7-text-secondary)]">At {exposure}%, this example represents {description}.</p>
            </div>
        </div>
        <aside className="grid content-start gap-3 text-sm leading-6 text-[var(--v7-text-secondary)]">
            <div className={panel}><h3 className="font-bold text-[var(--v7-text)]">What it describes</h3><p className="mt-1">A survey average of participating managers’ reported positioning—not a poll of their market predictions and not a measure of every investor’s holdings.</p></div>
            <div className={panel}><h3 className="font-bold text-[var(--v7-text)]">Limits</h3><p className="mt-1">An average can hide wide disagreement and varied strategies. It is a weekly snapshot of respondents, so it may not represent the broader market or future returns.</p></div>
        </aside>
    </div>;
}

export function LearnMarketMetricLesson({ concept }: { readonly concept: Concept }) {
    const isPutCall = concept === 'put-call';
    return <section aria-labelledby="market-metric-lesson-title" className="rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-4 sm:p-5 lg:p-6">
        <div className="border-b border-[var(--v7-border)] pb-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--v7-accent)]">Market Metric Lab</p>
            <h2 id="market-metric-lesson-title" className="mt-1 text-xl font-bold text-[var(--v7-text)]">{isPutCall ? 'Put/call volume ratio' : 'NAAIM Exposure Index'}</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--v7-text-secondary)]">Illustrative exercise only. These controls do not show current market readings and are not a trading recommendation.</p>
        </div>
        <div className="mt-4">{isPutCall ? <PutCallLesson /> : <NaaimLesson />}</div>
        <div className="mt-5 border-t border-[var(--v7-border)] pt-3 text-xs leading-5 text-[var(--v7-text-muted)]">
            <span>Sources: </span><a className="font-semibold text-[var(--v7-accent)] underline underline-offset-2" href={isPutCall ? 'https://www.cboe.com/insights/posts/how-early-exercise-order-flow-impacts-equity-option-put-call-ratios' : 'https://naaim.org/programs/naaim-exposure-index/faqs/'} target="_blank" rel="noreferrer">{isPutCall ? 'Cboe on put/call ratios' : 'NAAIM Exposure Index FAQs'}</a>
            {isPutCall ? <> · <a className="font-semibold text-[var(--v7-accent)] underline underline-offset-2" href="https://www.cboe.com/us/options/market_statistics/daily/" target="_blank" rel="noreferrer">Cboe daily statistics</a></> : <> · <a className="font-semibold text-[var(--v7-accent)] underline underline-offset-2" href="https://naaim.org/programs/naaim-exposure-index/" target="_blank" rel="noreferrer">NAAIM index overview and scale</a></>}
        </div>
    </section>;
}
