'use client';

import { useEffect, useMemo, useState } from 'react';
import { parseResearchSnapshotResponse } from '@/lib/research/snapshot-input';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import { calculatePositionSizeV04, isTradingDecisionV04, type TradingDecisionV04 } from '@/lib/learn/v0-4';

const symbols = ['MSFT', 'AAPL', 'NVDA'] as const;
type Lens = 'structure' | 'momentum' | 'participation' | 'volatility';

const number = (value: number | null, suffix = '') => value === null ? 'Unavailable' : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)}${suffix}`;
const money = (value: number | null, currency = 'USD') => value === null ? 'Unavailable' : new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

export const TradingApplyV4 = () => {
    const [symbol, setSymbol] = useState<(typeof symbols)[number]>('MSFT');
    const [snapshot, setSnapshot] = useState<ResearchSnapshot | null>(null);
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [error, setError] = useState<string | null>(null);
    const [lens, setLens] = useState<Lens>('structure');
    const [account, setAccount] = useState(10_000);
    const [riskPercent, setRiskPercent] = useState(1);
    const [entry, setEntry] = useState(100);
    const [stop, setStop] = useState(95);
    const [target, setTarget] = useState(110);
    const [slippage, setSlippage] = useState(0);
    const [context, setContext] = useState('');
    const [setup, setSetup] = useState('');
    const [trigger, setTrigger] = useState('');
    const [horizon, setHorizon] = useState('Several daily bars');
    const [confidence, setConfidence] = useState(50);
    const [noTrade, setNoTrade] = useState(false);
    const [noTradeReason, setNoTradeReason] = useState('');
    const [validation, setValidation] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        const load = async () => {
            setState('loading'); setError(null); setValidation(null);
            try {
                const response = await fetch(`/api/research/symbol/${symbol}?market=US`, { signal: controller.signal });
                const payload: unknown = await response.json();
                if (!response.ok) throw new Error('Current trading evidence is unavailable.');
                const next = parseResearchSnapshotResponse(payload);
                setSnapshot(next); setState('ready');
                const latest = next.chart.points.at(-1);
                const nextEntry = next.quote.price ?? latest?.close ?? 100;
                const atr = latest?.atr14 ?? Math.max(nextEntry * 0.03, 1);
                const nextStop = Math.max(0.01, nextEntry - atr * 1.5);
                setEntry(Number(nextEntry.toFixed(2)));
                setStop(Number(nextStop.toFixed(2)));
                setTarget(Number((nextEntry + ((nextEntry - nextStop) * 2)).toFixed(2)));
            } catch (caught) {
                if (controller.signal.aborted) return;
                setError(caught instanceof Error ? caught.message : 'Current trading evidence is unavailable.'); setState('error');
            }
        };
        void load(); return () => controller.abort();
    }, [symbol]);

    const latest = snapshot?.chart.points.at(-1) ?? null;
    const currency = snapshot?.quote.currency ?? 'USD';
    const evidence = useMemo(() => {
        if (!latest) return [] as readonly [string, string][];
        if (lens === 'structure') return [['Close', money(latest.close, currency)], ['SMA 50', money(latest.ma50, currency)], ['SMA 200', money(latest.ma200, currency)], ['EMA 20', money(latest.ema20, currency)], ['EMA 50', money(latest.ema50, currency)]] as const;
        if (lens === 'momentum') return [['RSI 14', number(latest.rsi14)], ['MACD', number(latest.macd)], ['MACD signal', number(latest.macdSignal)], ['MACD histogram', number(latest.macdHistogram)]] as const;
        if (lens === 'participation') return [['Volume', number(latest.volume)], ['20D average volume', number(latest.averageVolume20)], ['Range-start anchored VWAP', money(latest.anchoredVwap, currency)], ['ADX 14', number(latest.adx14)]] as const;
        return [['ATR 14', money(latest.atr14, currency)], ['ATR %', number(latest.atrPercent14, '%')], ['Supertrend reference', money(latest.supertrend, currency)], ['Supertrend direction', latest.supertrendDirection === 1 ? 'Up' : latest.supertrendDirection === -1 ? 'Down' : 'Unavailable']] as const;
    }, [currency, latest, lens]);
    const sizing = calculatePositionSizeV04(account, riskPercent, entry, stop, slippage);

    const validatePlan = () => {
        const decision: TradingDecisionV04 = noTrade
            ? { noTrade: true, reason: noTradeReason.trim(), confidence }
            : { noTrade: false, context: context.trim(), setup: setup.trim(), trigger: trigger.trim(), entry, stop, target, horizon: horizon.trim(), confidence };
        if (!isTradingDecisionV04(decision)) {
            setValidation(noTrade
                ? 'No Trade needs a reason and a valid confidence value.'
                : 'Complete context, setup, trigger, entry, invalidation, target, horizon, and confidence. For this long-practice plan, stop must be below entry and target above entry.');
            return;
        }
        if (!noTrade && !sizing.valid) {
            setValidation(sizing.error ?? 'Position sizing is invalid.');
            return;
        }
        setValidation(noTrade
            ? 'Valid practice decision: choosing No Trade is an explicit outcome when evidence is insufficient.'
            : `Valid practice plan: ${sizing.shares ?? 0} shares would keep estimated invalidation loss near the selected ${riskPercent}% account-risk budget.`);
    };

    return <div data-testid="trading-apply-v4" className="grid gap-4">
        <section className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-4 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-4 border-b border-[var(--v7-border)] pb-4 md:flex-row md:items-end md:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--v7-accent)]">Apply Today · v0.4</p><h2 className="mt-1 text-xl font-bold">Read technical evidence without turning it into a signal.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--v7-text-secondary)]">Technical indicators summarize historical price and volume; they are not independent predictions. Build the plan around context, invalidation, and risk—not a green/red indicator.</p></div><div className="flex gap-2">{symbols.map((candidate) => <button key={candidate} type="button" aria-pressed={symbol === candidate} onClick={() => setSymbol(candidate)} className={`min-h-10 rounded border px-3 text-xs font-bold ${symbol === candidate ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)]' : 'border-[var(--v7-border)]'}`}>{candidate}</button>)}</div></div>
            {state === 'loading' ? <p role="status" className="mt-4 rounded border border-[var(--v7-border)] p-4 text-sm">Loading current technical evidence…</p> : null}
            {state === 'error' ? <p role="alert" className="mt-4 rounded border border-[var(--v7-risk)] bg-[var(--v7-risk-quiet)] p-4 text-sm">{error}</p> : null}
            {state === 'ready' && snapshot && latest ? <><div className="mt-4 flex flex-col gap-2 rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">{snapshot.quote.name ?? symbol}</p><p className="mt-1 text-xs text-[var(--v7-text-muted)]">{symbol} · latest daily bar {latest.time} · fetched {new Date(snapshot.fetchedAt).toLocaleString()}</p></div><p className="text-xs text-[var(--v7-text-muted)]">{snapshot.sources.join(' · ') || 'No source labels returned'}</p></div><div className="mt-4 flex flex-wrap gap-2" aria-label="Technical evidence lens">{([
                ['structure', 'Structure'], ['momentum', 'Momentum'], ['participation', 'Participation'], ['volatility', 'Volatility'],
            ] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={lens === id} onClick={() => setLens(id)} className={`min-h-10 rounded border px-3 text-xs font-semibold ${lens === id ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)]' : 'border-[var(--v7-border)]'}`}>{label}</button>)}</div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">{evidence.map(([label, value]) => <article key={label} className="rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-3"><p className="text-[10px] uppercase tracking-[0.08em] text-[var(--v7-text-muted)]">Evidence · {label}</p><p className="mt-1 font-mono text-sm font-bold">{value}</p></article>)}</div></> : null}
        </section>

        <section data-testid="trade-plan-v4" className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-4 sm:p-5 lg:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--v7-accent)]">Practice trade construction</p><h3 className="mt-1 text-base font-bold">Plan first. Outcome later.</h3></div><label className="inline-flex min-h-10 items-center gap-2 rounded border border-[var(--v7-border)] px-3 text-xs font-semibold"><input type="checkbox" checked={noTrade} onChange={(event) => { setNoTrade(event.target.checked); setValidation(null); }} />No Trade</label></div>
            {noTrade ? <label className="mt-4 grid gap-1 text-xs font-semibold">Why is no trade the better decision?<textarea aria-label="No Trade reason" rows={4} maxLength={700} value={noTradeReason} onChange={(event) => setNoTradeReason(event.target.value)} className="rounded border border-[var(--v7-border)] bg-transparent p-3 text-sm" /></label> : <><div className="mt-4 grid gap-3 lg:grid-cols-3"><label className="grid gap-1 text-xs font-semibold">Context<textarea aria-label="Trade context" rows={3} value={context} onChange={(event) => setContext(event.target.value)} className="rounded border border-[var(--v7-border)] bg-transparent p-2 text-sm" /></label><label className="grid gap-1 text-xs font-semibold">Setup<textarea aria-label="Trade setup" rows={3} value={setup} onChange={(event) => setSetup(event.target.value)} className="rounded border border-[var(--v7-border)] bg-transparent p-2 text-sm" /></label><label className="grid gap-1 text-xs font-semibold">Trigger<textarea aria-label="Trade trigger" rows={3} value={trigger} onChange={(event) => setTrigger(event.target.value)} className="rounded border border-[var(--v7-border)] bg-transparent p-2 text-sm" /></label></div><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="grid gap-1 text-xs font-semibold">Entry<input aria-label="Trade entry" type="number" step="0.01" value={entry} onChange={(event) => setEntry(Number(event.target.value))} className="min-h-10 rounded border border-[var(--v7-border)] bg-transparent px-3 font-mono" /></label><label className="grid gap-1 text-xs font-semibold">Invalidation stop<input aria-label="Trade invalidation stop" type="number" step="0.01" value={stop} onChange={(event) => setStop(Number(event.target.value))} className="min-h-10 rounded border border-[var(--v7-border)] bg-transparent px-3 font-mono" /></label><label className="grid gap-1 text-xs font-semibold">Target<input aria-label="Trade target" type="number" step="0.01" value={target} onChange={(event) => setTarget(Number(event.target.value))} className="min-h-10 rounded border border-[var(--v7-border)] bg-transparent px-3 font-mono" /></label><label className="grid gap-1 text-xs font-semibold">Expected horizon<input aria-label="Trade horizon" value={horizon} maxLength={120} onChange={(event) => setHorizon(event.target.value)} className="min-h-10 rounded border border-[var(--v7-border)] bg-transparent px-3" /></label></div></>}
            <label className="mt-4 grid gap-1 text-xs font-semibold">Confidence · {confidence}%<input aria-label="Trade confidence" type="range" min="0" max="100" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} /></label>
            {!noTrade ? <div data-testid="current-risk-calculator-v4" className="mt-4 rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4"><p className="text-xs font-bold">Position sizing from risk</p><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="grid gap-1 text-[11px] font-semibold">Account value<input aria-label="Trading account value" type="number" value={account} onChange={(event) => setAccount(Number(event.target.value))} className="min-h-10 rounded border border-[var(--v7-border)] bg-transparent px-2 font-mono" /></label><label className="grid gap-1 text-[11px] font-semibold">Max risk %<input aria-label="Trading risk percent" type="number" step="0.25" value={riskPercent} onChange={(event) => setRiskPercent(Number(event.target.value))} className="min-h-10 rounded border border-[var(--v7-border)] bg-transparent px-2 font-mono" /></label><label className="grid gap-1 text-[11px] font-semibold">Slippage allowance / share<input aria-label="Trading slippage per share" type="number" step="0.05" value={slippage} onChange={(event) => setSlippage(Number(event.target.value))} className="min-h-10 rounded border border-[var(--v7-border)] bg-transparent px-2 font-mono" /></label><div className={`rounded border p-3 ${sizing.valid ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)]' : 'border-[var(--v7-risk)] bg-[var(--v7-risk-quiet)]'}`}><p className="text-[10px] text-[var(--v7-text-muted)]">Calculated size</p><p className="mt-1 font-mono text-sm font-bold">{sizing.valid ? `${sizing.shares} shares` : 'Invalid'}</p><p className="mt-1 text-[10px] text-[var(--v7-text-muted)]">{sizing.valid ? `Risk budget $${number(sizing.riskBudget)}` : sizing.error}</p></div></div></div> : null}
            <button type="button" onClick={validatePlan} className="mt-4 min-h-11 rounded border border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] px-4 text-sm font-bold">Validate practice decision</button>{validation ? <p role="status" data-testid="trade-plan-validation-v4" className={`mt-3 rounded border p-3 text-sm ${validation.startsWith('Valid') ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)]' : 'border-[var(--v7-caution)] bg-[var(--v7-caution-quiet)]'}`}>{validation}</p> : null}
        </section>
    </div>;
};
