'use client';

import { useCallback, useEffect, useState } from 'react';
import { advanceFirstVisit, readFirstVisit, subscribeFirstVisit, type FirstVisitRead, type FirstVisitStage, type FirstVisitState } from '@/lib/v8-first-visit';
import styles from './v8-first-visit.module.css';

export function useFirstVisit() {
    const [progress, setProgress] = useState<FirstVisitRead | null>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        const refresh = () => { setProgress(readFirstVisit()); setError(''); };
        const unsubscribe = subscribeFirstVisit(refresh);
        refresh();
        return unsubscribe;
    }, []);
    const advance = useCallback(async (expected: FirstVisitState, stage: FirstVisitStage) => {
        try { await advanceFirstVisit(expected, stage); setError(''); }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'Tour progress was not saved.'); }
        setProgress(readFirstVisit());
    }, []);
    return { progress, error, advance };
}

type Tour = ReturnType<typeof useFirstVisit>;
type Props = { surface: 'market' | 'research'; ready?: boolean; saved?: boolean; mode?: 'standard' | 'contrarian' };

export function V8FirstVisit(props: Props) {
    return <FirstVisitCallout {...props} tour={useFirstVisit()} />;
}

export function FirstVisitCallout({ tour, surface, ready = false, saved = false, mode = 'standard' }: Props & { tour: Tour }) {
    const [hiddenRevision, setHiddenRevision] = useState<number | 'invalid' | null>(null);
    const state = tour.progress?.state;
    const stage = state?.stage;
    const revision = state?.revision;
    const advance = tour.advance;
    // Only a resolved, identity-validated positive quote supplied by ConnectedCase can pass.
    useEffect(() => {
        if (surface === 'research' && ready && stage === 'stock' && revision !== undefined) void advance({ version: 1, stage, revision }, 'save');
    }, [surface, ready, stage, revision, advance]);

    if (!tour.progress || hiddenRevision === (revision ?? 'invalid') || state?.stage === 'skipped' || state?.stage === 'complete') return null;
    const error = tour.error || ('error' in tour.progress ? tour.progress.error : '');
    const step = state?.stage === 'market' ? 1 : state?.stage === 'stock' ? 2 : 3;
    const action = !state ? null : state.stage === 'market'
        ? surface === 'market'
            ? <button className={styles.primary} type="button" disabled={!ready} onClick={() => void advance(state, 'stock')}>I understand</button>
            : <a href="/main-v8" target="_blank" rel="noopener noreferrer">Open Market (new tab)</a>
        : surface === 'market' ? <a href="/research-v8">Open Research</a>
        : state.stage === 'save' && saved ? <button className={styles.primary} type="button" onClick={() => void advance(state, 'complete')}>Finish with this saved stock</button>
        : null;
    const text = !state ? '' : state.stage === 'market'
        ? `${surface === 'market' ? mode === 'contrarian' ? 'In Contrarian mode, higher scores mean crowding risk.' : 'In Momentum mode, higher scores mean stronger trend confirmation.' : 'Its meaning depends on the selected mode.'} It is context, not a forecast.${surface === 'market' && !ready ? ' Waiting for a current reading.' : ''}`
        : state.stage === 'stock'
            ? surface === 'market' ? 'Search or pick from your watchlist. Opening a stock saves nothing.' : 'This step finishes once the stock’s price loads. Opening it saves nothing.'
            : surface === 'research' && saved ? 'This stock is already in your watchlist; no new save is needed.' : 'Use Save stock beside the price to keep it. Reading alone saves nothing.';
    return <section className={styles.callout} aria-label="First visit to V8" data-testid="v8-first-visit">
        <div className={styles.text}>
            <div className={styles.title}><h2>{!state ? 'First visit' : state.stage === 'market' ? 'Understand the Market score' : state.stage === 'stock' ? 'Open a stock' : 'Save a stock'}</h2>{state && <span className={styles.step}>Tour {step} of 3</span>}</div>
            {text && <p>{text}</p>}
        </div>
        {state && <div className={styles.actions}>{action}<button type="button" className={styles.quiet} onClick={() => void advance(state, 'skipped')}>Skip tour</button></div>}
        {error && <div className={styles.error}><p role="alert">{error}</p>{state?.stage === 'stock' && surface === 'research' && ready && <button type="button" onClick={() => void advance(state, 'save')}>Retry progress</button>}<button type="button" onClick={() => setHiddenRevision(revision ?? 'invalid')}>Hide for this visit</button></div>}
    </section>;
}
