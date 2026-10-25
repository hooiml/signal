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
    return <section className={styles.callout} aria-label="First visit to V8" data-testid="v8-first-visit">
        <div className={styles.heading}><span className={styles.label}>{state ? `First visit · ${step} of 3` : 'First visit'}</span>{state && <button type="button" onClick={() => void advance(state, 'skipped')}>Skip tour</button>}</div>
        {state && <>
            <h2>{state.stage === 'market' ? 'Understand the Market score' : state.stage === 'stock' ? 'Open a stock' : 'Save a stock'}</h2>
            {state.stage === 'market' ? <>
                <p>The score summarizes available market conditions. {surface === 'market' ? mode === 'contrarian' ? 'In Contrarian mode, higher scores indicate crowding risk; lower scores can suggest opportunity.' : 'In Momentum mode, higher scores indicate stronger trend confirmation.' : 'Its meaning depends on the selected mode.'} It is context, not a price forecast. Check the date and evidence gaps.</p>
                {surface === 'market' ? <div className={styles.actions}><button className={styles.primary} type="button" disabled={!ready} onClick={() => void advance(state, 'stock')}>I understand</button>{!ready && <span>Waiting for a successful current Market reading.</span>}</div> : <a href="/main-v8" target="_blank" rel="noopener noreferrer">Open Market (new tab)</a>}
            </> : state.stage === 'stock' ? <>
                <p>Choose a company using search or your watchlist. Read its returned price and source limitations. Opening a stock does not save it.</p>
                {surface === 'market' ? <a href="/research-v8">Open Research</a> : <p>This step finishes when the selected stock has an available price reading.</p>}
            </> : <>
                <p>{surface === 'research' && saved ? 'This stock is already in your watchlist. You can finish with it; no new save or note change is needed.' : 'When you want to keep a stock, use its Save stock button. Reading alone saves nothing. A failed save will not finish this tour.'}</p>
                {surface === 'market' ? <a href="/research-v8">Open Research</a> : saved ? <button className={styles.primary} type="button" onClick={() => void advance(state, 'complete')}>Finish with this saved stock</button> : <p>Use Save stock beside the price after a reading is available.</p>}
            </>}
            <small>Progress stays in this browser on this device. Restart from Settings.</small>
        </>}
        {error && <div className={styles.error}><p role="alert">{error}</p>{state?.stage === 'stock' && surface === 'research' && ready && <button type="button" onClick={() => void advance(state, 'save')}>Retry progress</button>}<button type="button" onClick={() => setHiddenRevision(revision ?? 'invalid')}>Hide for this visit</button><small>Hiding here is temporary; progress has not been saved.</small></div>}
    </section>;
}
