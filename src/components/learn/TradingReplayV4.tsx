'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    calculatePositionSizeV04,
    isTradingDecisionV04,
    type TradingDecisionV04,
    type TradingReplayIntroV04,
    type TradingReplayPointV04,
    type TradingReplayRevealV04,
} from '@/lib/learn/v0-4';

const money = (value: number | null) => value === null ? 'Unavailable' : `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)}`;
const number = (value: number | null, suffix = '') => value === null ? 'Unavailable' : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)}${suffix}`;

const MiniChart = ({ points }: { readonly points: readonly TradingReplayPointV04[] }) => {
    const selected = points.slice(-20);
    const closes = selected.map((point) => point.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const span = Math.max(max - min, 0.0001);
    const path = selected.map((point, index) => {
        const x = selected.length <= 1 ? 50 : (index / (selected.length - 1)) * 100;
        const y = 88 - (((point.close - min) / span) * 72);
        return `${x},${y}`;
    }).join(' ');
    return <div role="img" aria-label={`Recent daily closing prices through ${selected.at(-1)?.time ?? 'the replay cutoff'}: ${selected.map((point) => `${point.time} ${point.close}`).join('; ')}`} className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-3"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className="h-44 w-full"><line x1="0" y1="88" x2="100" y2="88" stroke="currentColor" opacity="0.16" strokeWidth="0.5" vectorEffect="non-scaling-stroke" /><polyline points={path} fill="none" stroke="var(--v7-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg><div className="mt-1 flex justify-between text-[10px] text-[var(--v7-text-muted)]"><span>{selected[0]?.time ?? ''}</span><span>{selected.at(-1)?.time ?? ''}</span></div></div>;
};

const BarTable = ({ points, label }: { readonly points: readonly TradingReplayPointV04[]; readonly label: string }) => <div className="research-scrollbar overflow-x-auto rounded-[11px] border border-[var(--v7-border)]"><table className="w-full min-w-[640px] text-left text-xs"><caption className="sr-only">{label}</caption><thead className="bg-[var(--v7-surface-quiet)]"><tr>{['Date', 'Open', 'High', 'Low', 'Close', 'Volume'].map((heading) => <th key={heading} className="border-b border-[var(--v7-border)] px-3 py-2 text-[var(--v7-text-muted)]">{heading}</th>)}</tr></thead><tbody>{points.map((point) => <tr key={point.time} className="border-b border-[var(--v7-border)] last:border-b-0"><th className="px-3 py-2 font-semibold">{point.time}</th><td className="px-3 py-2 font-mono">{money(point.open)}</td><td className="px-3 py-2 font-mono">{money(point.high)}</td><td className="px-3 py-2 font-mono">{money(point.low)}</td><td className="px-3 py-2 font-mono">{money(point.close)}</td><td className="px-3 py-2 font-mono">{number(point.volume)}</td></tr>)}</tbody></table></div>;

export const TradingReplayV4 = () => {
    const [intro, setIntro] = useState<TradingReplayIntroV04 | null>(null);
    const [reveal, setReveal] = useState<TradingReplayRevealV04 | null>(null);
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [error, setError] = useState<string | null>(null);
    const [noTrade, setNoTrade] = useState(false);
    const [noTradeReason, setNoTradeReason] = useState('');
    const [context, setContext] = useState('');
    const [setup, setSetup] = useState('');
    const [trigger, setTrigger] = useState('');
    const [entry, setEntry] = useState(100);
    const [stop, setStop] = useState(95);
    const [target, setTarget] = useState(110);
    const [horizon, setHorizon] = useState('Next several daily bars');
    const [confidence, setConfidence] = useState(50);
    const [account, setAccount] = useState(10_000);
    const [riskPercent, setRiskPercent] = useState(1);
    const [revealing, setRevealing] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        const load = async () => {
            try {
                const response = await fetch('/api/learn/trading-replay/MSFT?market=US', { signal: controller.signal });
                const payload = await response.json() as { success?: boolean; data?: TradingReplayIntroV04; error?: string };
                if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error ?? 'Trading Replay is unavailable.');
                setIntro(payload.data); setState('ready');
                const current = payload.data.current;
                const atr = current.atr14 ?? Math.max(current.close * 0.03, 1);
                const nextEntry = current.close;
                const nextStop = Math.max(0.01, nextEntry - (atr * 1.5));
                setEntry(Number(nextEntry.toFixed(2))); setStop(Number(nextStop.toFixed(2))); setTarget(Number((nextEntry + ((nextEntry - nextStop) * 2)).toFixed(2)));
            } catch (caught) {
                if (controller.signal.aborted) return;
                setError(caught instanceof Error ? caught.message : 'Trading Replay is unavailable.'); setState('error');
            }
        };
        void load(); return () => controller.abort();
    }, []);

    const sizing = calculatePositionSizeV04(account, riskPercent, entry, stop);
    const decision = useMemo<TradingDecisionV04>(() => noTrade
        ? { noTrade: true, reason: noTradeReason.trim(), confidence }
        : { noTrade: false, context: context.trim(), setup: setup.trim(), trigger: trigger.trim(), entry, stop, target, horizon: horizon.trim(), confidence },
    [confidence, context, entry, horizon, noTrade, noTradeReason, setup, stop, target, trigger]);
    const canReveal = Boolean(intro && isTradingDecisionV04(decision) && (noTrade || sizing.valid));

    const revealFuture = async () => {
        if (!intro || !canReveal) return;
        setRevealing(true); setError(null);
        try {
            const response = await fetch(`/api/learn/trading-replay/${intro.symbol}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ market: 'US', replayId: intro.replayId, decision }) });
            const payload = await response.json() as { success?: boolean; data?: TradingReplayRevealV04; error?: string };
            if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error ?? 'Trading Replay reveal failed.');
            setReveal(payload.data);
        } catch (caught) { setError(caught instanceof Error ? caught.message : 'Trading Replay reveal failed.'); }
        finally { setRevealing(false); }
    };

    return <section data-testid="trading-replay-v4" className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-4 sm:p-5 lg:p-6"><div className="border-b border-[var(--v7-border)] pb-4"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--v7-accent)]">Trading Replay · v0.4</p><h2 className="mt-1 text-xl font-bold">Decide at the cutoff. Then reveal later bars.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--v7-text-secondary)]">Daily OHLCV and technical values stop at one historical date. The later bars remain server-side until you commit a complete practice plan or an explicit No Trade decision.</p></div>
        {state === 'loading' ? <p role="status" className="mt-4 rounded border border-[var(--v7-border)] p-4 text-sm">Loading no-look-ahead daily replay…</p> : null}
        {state === 'error' ? <p role="alert" className="mt-4 rounded border border-[var(--v7-risk)] bg-[var(--v7-risk-quiet)] p-4 text-sm">{error}</p> : null}
        {state === 'ready' && intro ? <div className="mt-4 grid gap-4"><div className="flex flex-col gap-2 rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">{intro.symbol} · cutoff {intro.cutoffDate}</p><p className="mt-1 text-xs text-[var(--v7-text-muted)]">{intro.sources.join(' · ') || 'No source labels returned'} · data fetched {new Date(intro.fetchedAt).toLocaleString()}</p></div><span className="rounded-full border border-[var(--v7-caution)] bg-[var(--v7-caution-quiet)] px-3 py-1 text-xs font-bold">Future locked</span></div><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]"><MiniChart points={intro.points} /><aside className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4"><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--v7-text-muted)]">Evidence at cutoff</p><dl className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-[var(--v7-text-muted)]">Close</dt><dd className="mt-1 font-mono font-bold">{money(intro.current.close)}</dd></div><div><dt className="text-[var(--v7-text-muted)]">SMA 50</dt><dd className="mt-1 font-mono font-bold">{money(intro.current.ma50)}</dd></div><div><dt className="text-[var(--v7-text-muted)]">RSI 14</dt><dd className="mt-1 font-mono font-bold">{number(intro.current.rsi14)}</dd></div><div><dt className="text-[var(--v7-text-muted)]">ATR 14</dt><dd className="mt-1 font-mono font-bold">{money(intro.current.atr14)}</dd></div><div><dt className="text-[var(--v7-text-muted)]">Anchored VWAP</dt><dd className="mt-1 font-mono font-bold">{money(intro.current.anchoredVwap)}</dd></div><div><dt className="text-[var(--v7-text-muted)]">MACD</dt><dd className="mt-1 font-mono font-bold">{number(intro.current.macd)}</dd></div></dl></aside></div><BarTable points={intro.points.slice(-8)} label="Daily bars available before the trading replay commitment" />
            {!reveal ? <div data-testid="trading-replay-locked" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_290px]"><div className="grid gap-3"><label className="inline-flex min-h-10 w-fit items-center gap-2 rounded border border-[var(--v7-border)] px-3 text-xs font-semibold"><input type="checkbox" checked={noTrade} onChange={(event) => setNoTrade(event.target.checked)} />No Trade</label>{noTrade ? <label className="grid gap-1 text-xs font-semibold">Reason<textarea aria-label="Replay No Trade reason" rows={4} maxLength={700} value={noTradeReason} onChange={(event) => setNoTradeReason(event.target.value)} className="rounded border border-[var(--v7-border)] bg-transparent p-3 text-sm" /></label> : <><div className="grid gap-3 lg:grid-cols-3"><label className="grid gap-1 text-xs font-semibold">Context<textarea aria-label="Replay trade context" rows={3} value={context} onChange={(event) => setContext(event.target.value)} className="rounded border border-[var(--v7-border)] bg-transparent p-2 text-sm" /></label><label className="grid gap-1 text-xs font-semibold">Setup<textarea aria-label="Replay trade setup" rows={3} value={setup} onChange={(event) => setSetup(event.target.value)} className="rounded border border-[var(--v7-border)] bg-transparent p-2 text-sm" /></label><label className="grid gap-1 text-xs font-semibold">Trigger<textarea aria-label="Replay trade trigger" rows={3} value={trigger} onChange={(event) => setTrigger(event.target.value)} className="rounded border border-[var(--v7-border)] bg-transparent p-2 text-sm" /></label></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="grid gap-1 text-xs font-semibold">Entry<input aria-label="Replay trade entry" type="number" step="0.01" value={entry} onChange={(event) => setEntry(Number(event.target.value))} className="min-h-10 rounded border border-[var(--v7-border)] bg-transparent px-2 font-mono" /></label><label className="grid gap-1 text-xs font-semibold">Invalidation stop<input aria-label="Replay trade stop" type="number" step="0.01" value={stop} onChange={(event) => setStop(Number(event.target.value))} className="min-h-10 rounded border border-[var(--v7-border)] bg-transparent px-2 font-mono" /></label><label className="grid gap-1 text-xs font-semibold">Target<input aria-label="Replay trade target" type="number" step="0.01" value={target} onChange={(event) => setTarget(Number(event.target.value))} className="min-h-10 rounded border border-[var(--v7-border)] bg-transparent px-2 font-mono" /></label><label className="grid gap-1 text-xs font-semibold">Horizon<input aria-label="Replay trade horizon" value={horizon} onChange={(event) => setHorizon(event.target.value)} className="min-h-10 rounded border border-[var(--v7-border)] bg-transparent px-2" /></label></div><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-semibold">Practice account value<input aria-label="Replay account value" type="number" value={account} onChange={(event) => setAccount(Number(event.target.value))} className="min-h-10 rounded border border-[var(--v7-border)] bg-transparent px-2 font-mono" /></label><label className="grid gap-1 text-xs font-semibold">Max risk %<input aria-label="Replay risk percent" type="number" step="0.25" value={riskPercent} onChange={(event) => setRiskPercent(Number(event.target.value))} className="min-h-10 rounded border border-[var(--v7-border)] bg-transparent px-2 font-mono" /></label></div></>}<label className="grid gap-1 text-xs font-semibold">Confidence · {confidence}%<input aria-label="Replay trade confidence" type="range" min="0" max="100" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} /></label></div><aside className="rounded-[11px] border border-[var(--v7-caution)] bg-[var(--v7-caution-quiet)] p-4 text-sm leading-6 text-[var(--v7-text-secondary)]"><strong className="text-[var(--v7-text)]">No future bars are in this response.</strong><p className="mt-2">{noTrade ? 'Explain why evidence is insufficient or the setup is not worth taking.' : sizing.valid ? `Risk-derived size: ${sizing.shares} shares at ${riskPercent}% account risk.` : sizing.error}</p><button type="button" disabled={!canReveal || revealing} onClick={() => void revealFuture()} className="mt-4 min-h-11 w-full rounded border border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] px-3 font-bold disabled:opacity-50">{revealing ? 'Revealing…' : 'Commit decision & reveal'}</button></aside></div> : <div data-testid="trading-replay-revealed" className="grid gap-4"><div className="rounded-[11px] border border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] p-4 text-sm leading-6"><strong>Decision committed: {reveal.decision.noTrade ? 'No Trade' : 'Long practice plan'}.</strong><p className="mt-2 text-[var(--v7-text-secondary)]">The later bars describe this one historical path. Review rule adherence, invalidation, sizing, and management logic before judging P&amp;L.</p></div><BarTable points={reveal.nextPoints} label="Daily bars revealed only after the trading replay decision" /></div>}
            <details className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-3"><summary className="min-h-10 cursor-pointer py-2 text-xs font-bold">Replay limitations</summary><ul className="grid gap-1 py-2 text-xs leading-5 text-[var(--v7-text-muted)]">{intro.limitations.map((limitation) => <li key={limitation}>• {limitation}</li>)}</ul></details>{error ? <p role="alert" className="text-sm text-[var(--v7-risk)]">{error}</p> : null}</div> : null}
    </section>;
};
