'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    compareMarketReplaySnapshots,
    parseMarketReplayIndex,
    parseMarketReplaySnapshot,
    type MarketReplayIndex,
    type MarketReplaySnapshot,
} from '@/lib/types/market-replay';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';
import { trackProductAnalyticsEvent } from '@/lib/product-analytics-client';

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const formatTier = (value: string) => value.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
const numberText = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : 'Unavailable';

export const HistoricalDecisionReplayV6 = ({ theme }: { readonly theme: ResearchThemeV6 }) => {
    const [market, setMarket] = useState<'US' | 'MY'>('US');
    const [mode, setMode] = useState<'standard' | 'contrarian'>('standard');
    const [enableSocial, setEnableSocial] = useState(true);
    const [primaryDate, setPrimaryDate] = useState('');
    const [comparisonDate, setComparisonDate] = useState('');
    const [indexState, setIndexState] = useState<{ readonly key: string; readonly value: MarketReplayIndex | null; readonly error: string | null }>({ key: '', value: null, error: null });
    const [detailState, setDetailState] = useState<{ readonly key: string; readonly primary: MarketReplaySnapshot | null; readonly comparison: MarketReplaySnapshot | null; readonly error: string | null }>({ key: '', primary: null, comparison: null, error: null });
    const styles = getThemeV6(theme);
    const configKey = `${market}|${mode}|${enableSocial}`;
    const detailKey = `${configKey}|${primaryDate}|${comparisonDate}`;
    const indexLoading = indexState.key !== configKey;
    const detailLoading = Boolean(primaryDate) && detailState.key !== detailKey;
    const currentIndex = indexState.key === configKey ? indexState.value : null;
    const currentDetail = detailState.key === detailKey ? detailState : null;

    useEffect(() => {
        if (indexState.key === configKey) return;
        const controller = new AbortController();
        const load = async () => {
            try {
                const response = await fetch(`/api/signals/replay?market=${market}&mode=${mode}&enableSocial=${enableSocial}`, { signal: controller.signal });
                const payload: unknown = await response.json();
                if (!response.ok && isRecord(payload) && typeof payload.error === 'string') throw new Error(payload.error);
                const value = parseMarketReplayIndex(payload);
                const observed = value.summaries.filter((summary) => summary.hasFullEvidence);
                setPrimaryDate(observed[0]?.date ?? '');
                setComparisonDate(observed[1]?.date ?? '');
                setIndexState({ key: configKey, value, error: null });
            } catch (caught) {
                if (!(caught instanceof DOMException && caught.name === 'AbortError')) {
                    setIndexState({ key: configKey, value: null, error: caught instanceof Error ? caught.message : 'Replay index unavailable.' });
                }
            }
        };
        void load();
        return () => controller.abort();
    }, [configKey, enableSocial, indexState.key, market, mode]);

    useEffect(() => {
        if (!primaryDate || detailState.key === detailKey) return;
        const controller = new AbortController();
        const load = async () => {
            try {
                const fetchDate = async (date: string) => {
                    const response = await fetch(`/api/signals/replay?market=${market}&mode=${mode}&enableSocial=${enableSocial}&date=${date}`, { signal: controller.signal });
                    const payload: unknown = await response.json();
                    if (!response.ok && isRecord(payload) && typeof payload.error === 'string') throw new Error(payload.error);
                    return parseMarketReplaySnapshot(payload);
                };
                const [primary, comparison] = await Promise.all([
                    fetchDate(primaryDate),
                    comparisonDate ? fetchDate(comparisonDate) : Promise.resolve(null),
                ]);
                setDetailState({ key: detailKey, primary, comparison, error: null });
            } catch (caught) {
                if (!(caught instanceof DOMException && caught.name === 'AbortError')) {
                    setDetailState({ key: detailKey, primary: null, comparison: null, error: caught instanceof Error ? caught.message : 'Replay snapshot unavailable.' });
                }
            }
        };
        void load();
        return () => controller.abort();
    }, [comparisonDate, detailKey, detailState.key, enableSocial, market, mode, primaryDate]);

    const comparison = useMemo(() => currentDetail?.primary && currentDetail.comparison
        ? compareMarketReplaySnapshots(currentDetail.primary, currentDetail.comparison)
        : null, [currentDetail]);
    const observedSummaries = currentIndex?.summaries.filter((summary) => summary.hasFullEvidence) ?? [];
    const reconstructedCount = currentIndex?.summaries.filter((summary) => summary.origin === 'reconstructed').length ?? 0;

    return (
        <section className="min-w-0 flex-1" aria-labelledby="historical-replay-title">
            <div>
                <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + styles.positive}>Point-in-time evidence</p>
                <h1 id="historical-replay-title" className={'mt-1 text-xl font-bold ' + styles.textPrimary}>Historical market decision replay</h1>
                <p className={'mt-1 max-w-3xl text-sm leading-6 ' + styles.textMuted}>Inspect what was stored for an observed market snapshot and compare two dates. Backfilled score-only rows remain listed as coverage context but cannot masquerade as full briefings.</p>
            </div>

            <div className={'mt-5 grid gap-3 rounded-lg border p-4 sm:grid-cols-2 xl:grid-cols-5 ' + styles.panelSecondary}>
                <label className={'text-xs font-semibold ' + styles.textMuted}>Market
                    <select value={market} onChange={(event) => setMarket(event.target.value === 'MY' ? 'MY' : 'US')} className={'mt-1 min-h-10 w-full rounded border bg-transparent px-3 ' + styles.textPrimary}><option value="US">US</option><option value="MY">Malaysia</option></select>
                </label>
                <label className={'text-xs font-semibold ' + styles.textMuted}>Interpretation
                    <select value={mode} onChange={(event) => setMode(event.target.value === 'contrarian' ? 'contrarian' : 'standard')} className={'mt-1 min-h-10 w-full rounded border bg-transparent px-3 ' + styles.textPrimary}><option value="standard">Momentum</option><option value="contrarian">Contrarian</option></select>
                </label>
                <label className={'flex min-h-10 items-center gap-2 self-end text-xs font-semibold ' + styles.textSecondary}><input type="checkbox" checked={enableSocial} onChange={(event) => setEnableSocial(event.target.checked)} />Include social/news source</label>
                <label className={'text-xs font-semibold ' + styles.textMuted}>Replay date
                    <select value={primaryDate} disabled={indexLoading || observedSummaries.length === 0} onChange={(event) => setPrimaryDate(event.target.value)} className={'mt-1 min-h-10 w-full rounded border bg-transparent px-3 disabled:opacity-45 ' + styles.textPrimary}>{observedSummaries.map((summary) => <option key={summary.date} value={summary.date}>{summary.date} · {summary.score}</option>)}</select>
                </label>
                <label className={'text-xs font-semibold ' + styles.textMuted}>Compare with
                    <select value={comparisonDate} disabled={indexLoading || observedSummaries.length < 2} onChange={(event) => {
                        const next = event.target.value;
                        setComparisonDate(next);
                        trackProductAnalyticsEvent({
                            name: 'replay_compared',
                            surface: 'research',
                            workspace: 'replay',
                            attributes: { comparison: next ? 'enabled' : 'disabled' },
                        });
                    }} className={'mt-1 min-h-10 w-full rounded border bg-transparent px-3 disabled:opacity-45 ' + styles.textPrimary}><option value="">No comparison</option>{observedSummaries.filter((summary) => summary.date !== primaryDate).map((summary) => <option key={summary.date} value={summary.date}>{summary.date} · {summary.score}</option>)}</select>
                </label>
            </div>

            {indexLoading ? <p className={'mt-5 text-sm ' + styles.textMuted}>Loading stored snapshot index…</p> : null}
            {indexState.key === configKey && indexState.error ? <p role="alert" className={'mt-5 text-sm ' + styles.risk}>{indexState.error}</p> : null}
            {currentIndex && observedSummaries.length === 0 ? <div className={'mt-5 rounded-lg border p-8 text-center ' + styles.panel}><h2 className={'text-base font-bold ' + styles.textPrimary}>No full observed snapshots</h2><p className={'mt-2 text-sm ' + styles.textMuted}>{reconstructedCount} reconstructed score row{reconstructedCount === 1 ? '' : 's'} may exist, but replay needs persisted components and quality evidence.</p></div> : null}
            {currentIndex && reconstructedCount > 0 ? <p className={'mt-3 text-xs ' + styles.textMuted}>{reconstructedCount} reconstructed score-only row{reconstructedCount === 1 ? '' : 's'} excluded from full replay selection.</p> : null}
            {detailLoading ? <p className={'mt-5 text-sm ' + styles.textMuted}>Loading point-in-time evidence…</p> : null}
            {currentDetail?.error ? <p role="alert" className={'mt-5 text-sm ' + styles.risk}>{currentDetail.error}</p> : null}

            {currentDetail?.primary ? (
                <>
                    <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        {[
                            ['Snapshot', currentDetail.primary.summary.date],
                            ['Stored posture', formatTier(currentDetail.primary.summary.tier)],
                            ['Score', currentDetail.primary.summary.score.toFixed(0)],
                            ['Evidence agreement', `${currentDetail.primary.agreementPercent.toFixed(0)}%`],
                            ['Versus comparison', comparison ? `${comparison.scoreDelta >= 0 ? '+' : ''}${comparison.scoreDelta.toFixed(0)} score` : 'Not selected'],
                        ].map(([label, value]) => <div key={label} className={'rounded-lg border p-4 ' + styles.panelUtility}><dt className={'text-xs font-semibold ' + styles.textMuted}>{label}</dt><dd className={'mt-2 font-mono text-lg font-bold ' + styles.textPrimary}>{value}</dd></div>)}
                    </dl>
                    {comparison ? <p className={'mt-3 text-xs ' + styles.textMuted}>{comparison.tierChanged ? 'Stored tier changed.' : 'Stored tier did not change.'} Agreement moved {comparison.agreementDelta >= 0 ? '+' : ''}{comparison.agreementDelta.toFixed(0)} points; {comparison.changedComponents} component{comparison.changedComponents === 1 ? '' : 's'} changed.</p> : null}

                    <section className={'mt-5 rounded-lg border p-4 ' + styles.panelSecondary}>
                        <h2 className={'text-sm font-bold ' + styles.textPrimary}>Stored score components</h2>
                        <div className="research-scrollbar mt-3 overflow-x-auto">
                            <table className="w-full min-w-[680px] text-left text-xs">
                                <thead><tr className={styles.textMuted}><th className="pb-2">Component</th><th className="pb-2 text-right">Raw value</th><th className="pb-2 text-right">Score</th><th className="pb-2 text-right">Weight</th><th className="pb-2 text-right">Signal</th><th className="pb-2 text-right">Updated</th></tr></thead>
                                <tbody>{currentDetail.primary.components.map((component) => <tr key={component.key} className={'border-t ' + styles.divider}><th className={'py-3 font-semibold ' + styles.textSecondary}>{component.displayName}</th><td className={'py-3 text-right font-mono ' + styles.textSecondary}>{numberText(component.rawValue)}</td><td className={'py-3 text-right font-mono ' + styles.textSecondary}>{numberText(component.score)}</td><td className={'py-3 text-right font-mono ' + styles.textSecondary}>{component.weight === null ? 'Unavailable' : `${(component.weight * 100).toFixed(1)}%`}</td><td className={'py-3 text-right ' + styles.textSecondary}>{component.signal ?? 'Unavailable'}</td><td className={'py-3 text-right ' + styles.textMuted}>{component.lastUpdated ?? 'Unavailable'}</td></tr>)}</tbody>
                            </table>
                        </div>
                    </section>

                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                        <section className={'rounded-lg border p-4 ' + styles.panelSecondary}><h2 className={'text-sm font-bold ' + styles.textPrimary}>Stored quality and limitations</h2><p className={'mt-2 text-xs leading-5 ' + styles.textSecondary}>{String(currentDetail.primary.interpretationContext.limitation ?? 'No limitation text was stored.')}</p><p className={'mt-2 text-xs ' + styles.textMuted}>Freshness: {String(currentDetail.primary.signalQuality.freshness ?? 'Unavailable')} · coverage: {String(currentDetail.primary.signalQuality.source_coverage ?? 'Unavailable')}</p></section>
                        <section className={'rounded-lg border p-4 ' + styles.panelSecondary}><h2 className={'text-sm font-bold ' + styles.textPrimary}>Decision boundary</h2><p className={'mt-2 text-xs leading-5 ' + styles.textSecondary}>This snapshot stored a market posture and evidence state. It did not store a ticker-level buy or sell instruction. Research decisions remain independent and must be reviewed in their own saved history.</p><p className={'mt-2 text-xs ' + styles.textMuted}>Model: {String(currentDetail.primary.metadata.scoring_model_version ?? 'Unavailable')} · origin: {currentDetail.primary.summary.origin}</p></section>
                    </div>
                </>
            ) : null}
        </section>
    );
};
