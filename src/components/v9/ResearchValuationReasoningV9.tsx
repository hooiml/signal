'use client';

import { formatResearchPrice } from '@/lib/research/price-format';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { OwnerAccessNotice } from '@/components/OwnerAccessNotice';
import { ownerAccessIssue, type OwnerAccessIssue } from '@/lib/owner-access-client';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import {
    createResearchValuationPlan,
    evaluateResearchValuationPlan,
    parseResearchValuationPlan,
    type ResearchValuationPlan,
} from '@/lib/research/research-valuation-plan';
import styles from './research-valuation-v9.module.css';

type Props = {
    readonly ticker: string;
    readonly snapshot: ResearchSnapshot | null;
    /** Local-only exploration mode for guests or unsaved stocks (no owner API calls or saves). */
    readonly localOnly?: boolean;
};

const inputNumber = (value: number | null) => (value === null ? '' : String(value));

export const ResearchValuationReasoningV9 = ({ ticker, snapshot, localOnly = false }: Props) => {
    const [plan, setPlan] = useState<ResearchValuationPlan>(() => createResearchValuationPlan(ticker));
    const [loading, setLoading] = useState(!localOnly);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [accessIssue, setAccessIssue] = useState<OwnerAccessIssue | null>(null);
    const [planLoaded, setPlanLoaded] = useState(localOnly);

    const load = useCallback(async () => {
        if (localOnly) {
            setPlan(createResearchValuationPlan(ticker));
            setLoading(false);
            setPlanLoaded(true);
            setMessage(null);
            setAccessIssue(null);
            return;
        }
        setLoading(true);
        setMessage(null);
        setAccessIssue(null);
        try {
            const planResponse = await fetch(`/api/research/valuation-plan/${encodeURIComponent(ticker)}`, { cache: 'no-store' });
            const planPayload: unknown = await planResponse.json().catch(() => null);
            const issue = ownerAccessIssue(planResponse.status, typeof planPayload === 'object' && planPayload !== null ? Reflect.get(planPayload, 'code') : undefined);
            if (issue) { setAccessIssue(issue); return; }
            if (!planResponse.ok || typeof planPayload !== 'object' || planPayload === null || Array.isArray(planPayload)) throw new Error('Valuation assumptions are unavailable.');
            setPlan(parseResearchValuationPlan((planPayload as Record<string, unknown>).data));
            setPlanLoaded(true);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Valuation assumptions are unavailable.');
        } finally {
            setLoading(false);
        }
    }, [localOnly, ticker]);

    useEffect(() => { void load(); }, [load]);

    const marketPrice = snapshot?.symbol === ticker ? snapshot.quote.price ?? null : null;
    const currency = snapshot?.symbol === ticker ? snapshot.quote.currency : null;

    const evaluation = useMemo(() => {
        try {
            return { result: evaluateResearchValuationPlan(plan, marketPrice), error: null as string | null };
        } catch (error) {
            return { result: null, error: error instanceof Error ? error.message : 'Check the valuation assumptions.' };
        }
    }, [plan, marketPrice]);
    const result = evaluation.result;

    const rangePlot = useMemo(() => {
        if (!result || !result.scenarioResults.length) return null;
        const pvs = result.scenarioResults.map(item => item.presentValue).filter(val => Number.isFinite(val) && val > 0);
        if (!pvs.length) return null;
        const allVals = marketPrice && marketPrice > 0 ? [...pvs, marketPrice] : pvs;
        const minRaw = Math.min(...allVals);
        const maxRaw = Math.max(...allVals);
        const span = maxRaw - minRaw || Math.max(1, maxRaw * 0.2);
        const domainMin = Math.max(0, minRaw - span * 0.12);
        const domainMax = maxRaw + span * 0.12;
        const pctFor = (val: number) => Math.max(4, Math.min(96, ((val - domainMin) / (domainMax - domainMin || 1)) * 100));
        const lowPv = Math.min(...pvs);
        const highPv = Math.max(...pvs);
        return {
            leftPct: pctFor(lowPv),
            widthPct: Math.max(2, pctFor(highPv) - pctFor(lowPv)),
            marketPct: marketPrice && marketPrice > 0 ? pctFor(marketPrice) : null,
            points: result.scenarioResults.map(item => ({
                id: item.id,
                label: item.label,
                value: item.presentValue,
                pct: pctFor(item.presentValue),
            })),
        };
    }, [marketPrice, result]);

    const updateShared = (key: 'currentEps' | 'years' | 'annualDiscountRatePct', value: string) => {
        if (value.trim() === '') {
            if (key === 'currentEps') setPlan((current) => ({ ...current, currentEps: null, updatedAt: new Date().toISOString() }));
            return;
        }
        setPlan((current) => ({ ...current, [key]: Number(value), updatedAt: new Date().toISOString() }));
    };

    const updateScenario = (id: string, key: 'epsCagrPct' | 'terminalPe', value: string) => {
        if (value.trim() === '') return;
        setPlan((current) => ({
            ...current,
            scenarios: current.scenarios.map((scenario) => scenario.id === id ? { ...scenario, [key]: Number(value) } : scenario),
            updatedAt: new Date().toISOString(),
        }));
    };

    const save = async () => {
        if (localOnly) return;
        setSaving(true);
        setMessage(null);
        setAccessIssue(null);
        try {
            const normalized = parseResearchValuationPlan({ ...plan, ticker, updatedAt: new Date().toISOString() });
            const response = await fetch(`/api/research/valuation-plan/${encodeURIComponent(ticker)}`, {
                method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(normalized),
            });
            const payload: unknown = await response.json().catch(() => null);
            const issue = ownerAccessIssue(response.status, typeof payload === 'object' && payload !== null ? Reflect.get(payload, 'code') : undefined);
            if (issue) { setAccessIssue(issue); return; }
            if (!response.ok || typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new Error('Could not save valuation assumptions.');
            setPlan(parseResearchValuationPlan((payload as Record<string, unknown>).data));
            setMessage('Valuation assumptions saved.');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not save valuation assumptions.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <section data-testid="valuation-reasoning-v9" aria-busy="true" className={styles.section}><p className={styles.status}>Loading valuation reasoning…</p></section>;
    if (!planLoaded) return <section data-testid="valuation-reasoning-v9" className={styles.section}>
        <div className={styles.titleGroup}><h3>Valuation reasoning · {ticker}</h3></div>
        {accessIssue ? <OwnerAccessNotice issue={accessIssue} resource="Saved valuation model" onRetry={() => void load()} /> : <>
            <p role="status" className={styles.status}>{message ?? 'Valuation assumptions could not be loaded.'}</p>
            <button type="button" onClick={() => void load()} className={styles.retryBtn}>Retry valuation assumptions</button>
        </>}
    </section>;

    return (
        <section data-testid="valuation-reasoning-v9" className={styles.section} aria-label={`Valuation reasoning for ${ticker}`}>
            {!localOnly && accessIssue && <OwnerAccessNotice issue={accessIssue} resource="Saved valuation model" preserveDraft saveLabel="Save assumptions" />}
            <div className={styles.header}>
                <div className={styles.titleGroup}>
                    <h3>Valuation reasoning · What assumptions make today&apos;s price reasonable?</h3>
                    <p>This is an assumption model, not a fair-value oracle. Current EPS is explicit because Signal does not infer forward earnings from trailing P/E.</p>
                </div>
                <div className={styles.priceMeta}>
                    <span>Market price</span>
                    <strong>{formatResearchPrice(marketPrice, currency)}</strong>
                </div>
            </div>

            <div className={styles.inputGrid}>
                <label className={styles.field}>
                    <span>Current EPS {currency ? `(${currency})` : '(same currency as market price)'}</span>
                    <input aria-label="Current EPS" inputMode="decimal" value={inputNumber(plan.currentEps)} onChange={(event) => updateShared('currentEps', event.target.value)} className={styles.input} placeholder="Enter evidence-backed EPS" />
                </label>
                <label className={styles.field}>
                    <span>Forecast years</span>
                    <input aria-label="Forecast years" type="number" min="1" max="10" value={plan.years} onChange={(event) => updateShared('years', event.target.value)} className={styles.input} />
                </label>
                <label className={styles.field}>
                    <span>Discount rate %</span>
                    <input aria-label="Discount rate percent" inputMode="decimal" value={plan.annualDiscountRatePct} onChange={(event) => updateShared('annualDiscountRatePct', event.target.value)} className={styles.input} />
                </label>
            </div>

            {evaluation.error && <p role="alert" className={styles.error}>{evaluation.error} Adjust the assumptions before saving.</p>}

            {plan.currentEps === null ? (
                <p className={styles.notice}>Enter a current EPS supported by your source before scenario values are calculated. This prevents trailing P/E from being silently re-labeled as forward earnings evidence.</p>
            ) : result ? (
                <>
                    {rangePlot && (
                        <div
                            className={styles.rangeVisual}
                            role="img"
                            aria-label={`Scenario value range from ${rangePlot.points.map(p => `${p.label} ${formatResearchPrice(p.value, currency)}`).join(', ')}${marketPrice ? `, compared with market price ${formatResearchPrice(marketPrice, currency)}` : ''}.`}
                        >
                            <div className={styles.rangeHead}>
                                <strong>Scenario present-value range vs. market price</strong>
                                <span>Discounted at {plan.annualDiscountRatePct}% over {plan.years}y</span>
                            </div>
                            <div className={styles.rangeTrackWrap}>
                                {rangePlot.marketPct !== null && (
                                    <span className={styles.rangePinLabel} data-pos="top" style={{ left: `${rangePlot.marketPct}%` }}>
                                        Market {formatResearchPrice(marketPrice, currency)}
                                    </span>
                                )}
                                <div className={styles.rangeTrack}>
                                    <span className={styles.rangeSpan} style={{ left: `${rangePlot.leftPct}%`, width: `${rangePlot.widthPct}%` }} />
                                    {rangePlot.points.map(pt => (
                                        <span key={pt.id} className={styles.rangePin} style={{ left: `${pt.pct}%` }} title={`${pt.label}: ${formatResearchPrice(pt.value, currency)}`} />
                                    ))}
                                    {rangePlot.marketPct !== null && (
                                        <span className={styles.rangePin} data-kind="market" style={{ left: `${rangePlot.marketPct}%` }} title={`Market price: ${formatResearchPrice(marketPrice, currency)}`} />
                                    )}
                                </div>
                                {rangePlot.points.map(pt => (
                                    <span key={pt.id} className={styles.rangePinLabel} data-pos="bottom" style={{ left: `${pt.pct}%` }}>
                                        {pt.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className={styles.scenarioGrid}>
                        {plan.scenarios.map((scenario) => {
                            const evaluated = result.scenarioResults.find((item) => item.id === scenario.id);
                            const gapTone = evaluated && evaluated.gapPct !== null ? (evaluated.gapPct >= 0 ? 'up' : 'down') : undefined;
                            return (
                                <article key={scenario.id} className={styles.scenarioCol}>
                                    <div className={styles.scenarioHead}>
                                        <strong>{scenario.label}</strong>
                                        <span className={styles.scenarioValue}>{evaluated ? formatResearchPrice(evaluated.presentValue, currency) : '—'}</span>
                                    </div>
                                    <div className={styles.scenarioInputs}>
                                        <label className={styles.field}>
                                            <span>EPS CAGR %</span>
                                            <input aria-label={`${scenario.label} EPS CAGR percent`} inputMode="decimal" value={scenario.epsCagrPct} onChange={(event) => updateScenario(scenario.id, 'epsCagrPct', event.target.value)} className={styles.input} />
                                        </label>
                                        <label className={styles.field}>
                                            <span>Terminal P/E</span>
                                            <input aria-label={`${scenario.label} terminal PE`} inputMode="decimal" value={scenario.terminalPe} onChange={(event) => updateScenario(scenario.id, 'terminalPe', event.target.value)} className={styles.input} />
                                        </label>
                                    </div>
                                    {evaluated && (
                                        <p className={styles.scenarioFoot}>
                                            Terminal EPS {evaluated.terminalEps.toFixed(2)}
                                            {evaluated.gapPct !== null && (
                                                <> · <span className={styles.scenarioGap} data-tone={gapTone}>scenario value {evaluated.gapPct >= 0 ? '+' : ''}{evaluated.gapPct.toFixed(1)}% vs market</span></>
                                            )}
                                        </p>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                </>
            ) : null}

            <div className={styles.footerRow}>
                <div className={styles.impliedBlock}>
                    <strong>{!result || result.impliedEpsCagrPct === null ? 'Implied growth unavailable' : `Market-implied EPS CAGR: ${result.impliedEpsCagrPct.toFixed(1)}%`}</strong>
                    <p>Uses the Base terminal P/E, your forecast horizon and discount rate. Change those assumptions to see how sensitive the implied expectation is.</p>
                </div>
                {localOnly ? (
                    <span className={styles.localTag}>Exploring · not saved</span>
                ) : (
                    <button type="button" onClick={() => void save()} disabled={saving || Boolean(evaluation.error)} className={styles.saveBtn}>{saving ? 'Saving…' : 'Save assumptions'}</button>
                )}
            </div>
            {message && <p role="status" className={styles.status}>{message}</p>}
        </section>
    );
};
