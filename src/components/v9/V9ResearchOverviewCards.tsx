'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { ResearchRecord } from '@/lib/types/research';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import {
    annualMarginComparison,
    annualMarginSeries,
    annualShareSeries,
    balanceSheetCushion,
    cashDebtDisplay,
    compactFinancialAmount,
    compactShareCount,
    financialPercentage,
    positionPlanPriceContext,
} from '@/lib/research/financial-display';
import { V9SegmentedPill } from './V9Primitives';
import styles from './v9-workspace.module.css';

type FinancialsMode = 'revenue' | 'margins' | 'cushion';

const FINANCIALS_MODE_OPTIONS: readonly { readonly value: FinancialsMode; readonly label: string }[] = [
    { value: 'revenue', label: 'Revenue & FCF' },
    { value: 'margins', label: 'Margins %' },
    { value: 'cushion', label: 'Cushion & Shares' },
];

const isPositive = (value: number | null | undefined): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0;

export function V9AnnualFinancialsCard({
    snapshot,
    financialsHref,
    fmtCompact,
}: {
    readonly snapshot: ResearchSnapshot;
    readonly financialsHref: string;
    readonly fmtCompact: (value: number | null, currency?: string | null) => string;
}) {
    const [mode, setMode] = useState<FinancialsMode>('revenue');
    const fundamentals = snapshot.fundamentals;
    const sourceLabel = fundamentals.source ?? 'Provider statements';

    const annuals = useMemo(() => (fundamentals.history ?? []).slice(-5), [fundamentals.history]);
    const maxAnnualVal = useMemo(() => {
        const vals = annuals.flatMap(a => [a.annualRevenue ?? 0, Math.max(0, a.freeCashFlow ?? 0)]);
        return Math.max(1, ...vals);
    }, [annuals]);
    const hasNegativeFcf = useMemo(
        () => annuals.some(a => a.freeCashFlow !== null && a.freeCashFlow < 0),
        [annuals],
    );

    const grossSeries = useMemo(() => annualMarginSeries(fundamentals, 'grossMarginPercent'), [fundamentals]);
    const opSeries = useMemo(() => annualMarginSeries(fundamentals, 'operatingMarginPercent'), [fundamentals]);
    const grossComp = useMemo(() => annualMarginComparison(fundamentals, 'grossMarginPercent'), [fundamentals]);
    const opComp = useMemo(() => annualMarginComparison(fundamentals, 'operatingMarginPercent'), [fundamentals]);

    const marginPeriods = useMemo(() => {
        const map = new Map<string, { reportingPeriod: string; gross: number | null; operating: number | null }>();
        for (const pt of grossSeries?.points ?? []) {
            map.set(pt.reportingPeriod, { reportingPeriod: pt.reportingPeriod, gross: pt.value, operating: null });
        }
        for (const pt of opSeries?.points ?? []) {
            const existing = map.get(pt.reportingPeriod);
            if (existing) existing.operating = pt.value;
            else map.set(pt.reportingPeriod, { reportingPeriod: pt.reportingPeriod, gross: null, operating: pt.value });
        }
        return [...map.values()]
            .sort((a, b) => Date.parse(a.reportingPeriod) - Date.parse(b.reportingPeriod))
            .slice(-5);
    }, [grossSeries, opSeries]);

    const maxMarginAbs = useMemo(() => {
        const vals = marginPeriods.flatMap(p => [Math.abs(p.gross ?? 0), Math.abs(p.operating ?? 0)]);
        return Math.max(1, ...vals);
    }, [marginPeriods]);

    const cushion = useMemo(() => balanceSheetCushion(fundamentals), [fundamentals]);
    const shareSeries = useMemo(() => annualShareSeries(fundamentals), [fundamentals]);
    const sharePoints = useMemo(() => (shareSeries?.points ?? []).slice(-5), [shareSeries]);

    const subtitle = mode === 'revenue'
        ? `Revenue vs Free Cash Flow (${sourceLabel})`
        : mode === 'margins'
            ? `Gross & Operating Margins (${sourceLabel})`
            : `Balance Sheet Cushion & Share Count (${sourceLabel})`;

    const hasLatestMargins = fundamentals.grossMarginPercent !== null || fundamentals.operatingMarginPercent !== null;

    return (
        <section className={styles.card} aria-label="Annual financials" data-testid="v9-annual-financials">
            <div className={styles.sectionHead}>
                <div>
                    <h2>Annual Financials</h2>
                    <p>{subtitle}</p>
                </div>
                <div className={styles.finHeadActions}>
                    <div data-testid="v9-annual-financials-modes">
                        <V9SegmentedPill
                            ariaLabel="Annual financials view"
                            size="sm"
                            value={mode}
                            options={FINANCIALS_MODE_OPTIONS}
                            onChange={setMode}
                        />
                    </div>
                    <Link className={styles.textLink} href={financialsHref}>Financials &amp; valuation →</Link>
                </div>
            </div>

            {mode === 'revenue' && (
                annuals.length > 0 ? (
                    <>
                        <div className={styles.finLegend}>
                            <span><i className={styles.finSwatchRev} aria-hidden="true" />Revenue</span>
                            <span><i className={styles.finSwatchFcf} aria-hidden="true" />Free Cash Flow</span>
                        </div>
                        <div className={styles.finBars}>
                            {annuals.map(period => {
                                const revH = Math.max(8, Math.round(((period.annualRevenue ?? 0) / maxAnnualVal) * 106));
                                const fcfH = Math.max(6, Math.round((Math.max(0, period.freeCashFlow ?? 0) / maxAnnualVal) * 106));
                                return (
                                    <div key={period.reportingPeriod} className={styles.finCol} title={`Rev: ${fmtCompact(period.annualRevenue, period.currency)} · FCF: ${fmtCompact(period.freeCashFlow, period.currency)}`}>
                                        <div className={styles.finPair}>
                                            <span className={styles.finBarRev} style={{ height: revH }} />
                                            <span className={styles.finBarFcf} style={{ height: fcfH }} />
                                        </div>
                                        <small>{period.reportingPeriod.slice(0, 4)}</small>
                                    </div>
                                );
                            })}
                        </div>
                        {hasNegativeFcf && (
                            <p className={styles.finNote}>
                                Negative free cash flow years are floored at the baseline; check exact values in Financials &amp; valuation.
                            </p>
                        )}
                    </>
                ) : (
                    <p className={styles.finEmpty}>
                        Multi-year financial history was not returned for this listing.
                    </p>
                )
            )}

            {mode === 'margins' && (
                marginPeriods.length > 0 ? (
                    <>
                        <div className={styles.finLegendRow}>
                            <div className={styles.finLegend}>
                                {grossSeries && <span><i className={styles.finSwatchGross} aria-hidden="true" />Gross Margin %</span>}
                                {opSeries && <span><i className={styles.finSwatchOp} aria-hidden="true" />Operating Margin %</span>}
                            </div>
                            <div className={styles.finDeltaBadges}>
                                {grossComp && (
                                    <span
                                        className={styles.toneBadge}
                                        data-tone={grossComp.deltaPercentagePoints > 0 ? 'up' : grossComp.deltaPercentagePoints < 0 ? 'down' : 'neutral'}
                                    >
                                        Gross {grossComp.deltaPercentagePoints >= 0 ? '+' : ''}{grossComp.deltaPercentagePoints.toFixed(1)} pp YoY
                                    </span>
                                )}
                                {opComp && (
                                    <span
                                        className={styles.toneBadge}
                                        data-tone={opComp.deltaPercentagePoints > 0 ? 'up' : opComp.deltaPercentagePoints < 0 ? 'down' : 'neutral'}
                                    >
                                        Operating {opComp.deltaPercentagePoints >= 0 ? '+' : ''}{opComp.deltaPercentagePoints.toFixed(1)} pp YoY
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className={styles.finBars}>
                            {marginPeriods.map(period => {
                                const grossH = period.gross !== null ? Math.max(8, Math.round((Math.abs(period.gross) / maxMarginAbs) * 96)) : 0;
                                const opH = period.operating !== null ? Math.max(8, Math.round((Math.abs(period.operating) / maxMarginAbs) * 96)) : 0;
                                return (
                                    <div
                                        key={period.reportingPeriod}
                                        className={styles.finCol}
                                        title={`Gross: ${financialPercentage(period.gross)} · Operating: ${financialPercentage(period.operating)}`}
                                    >
                                        <div className={styles.finPair}>
                                            {period.gross !== null && (
                                                <span
                                                    className={styles.finBarGross}
                                                    data-negative={period.gross < 0 ? 'true' : undefined}
                                                    style={{ height: grossH }}
                                                />
                                            )}
                                            {period.operating !== null && (
                                                <span
                                                    className={styles.finBarOp}
                                                    data-negative={period.operating < 0 ? 'true' : undefined}
                                                    style={{ height: opH }}
                                                />
                                            )}
                                        </div>
                                        <small>{period.reportingPeriod.slice(0, 4)}</small>
                                        <span className={styles.finSubValue}>
                                            {period.operating !== null ? `${period.operating.toFixed(0)}%` : period.gross !== null ? `${period.gross.toFixed(0)}%` : '—'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : hasLatestMargins ? (
                    <div className={styles.finFallbackGrid}>
                        <div className={styles.finFallbackTile}>
                            <small>Latest Gross Margin</small>
                            <strong>{financialPercentage(fundamentals.grossMarginPercent)}</strong>
                        </div>
                        <div className={styles.finFallbackTile}>
                            <small>Latest Operating Margin</small>
                            <strong>{financialPercentage(fundamentals.operatingMarginPercent)}</strong>
                        </div>
                        <p className={styles.finNote}>
                            Comparable multi-year margin history was not supplied for this listing.
                        </p>
                    </div>
                ) : (
                    <p className={styles.finEmpty}>
                        Comparable multi-year margin history was not supplied for this listing.
                    </p>
                )
            )}

            {mode === 'cushion' && (
                <div className={styles.cushionGrid}>
                    <div className={styles.cushionPanel}>
                        <div className={styles.cushionHead}>
                            <strong>Balance-sheet cushion</strong>
                            {cushion && (() => {
                                const net = cashDebtDisplay(cushion.netCash, cushion.currency);
                                const tone = cushion.posture === 'net-cash' ? 'up' : cushion.posture === 'net-debt' ? 'down' : 'neutral';
                                return (
                                    <span className={styles.toneBadge} data-tone={tone}>
                                        {net.label}: {net.amount}
                                    </span>
                                );
                            })()}
                        </div>
                        {cushion ? (
                            <div className={styles.cushionRows}>
                                <div className={styles.cushionRow}>
                                    <div>
                                        <span>Cash &amp; equivalents</span>
                                        <b>{compactFinancialAmount(cushion.cash, cushion.currency)}</b>
                                    </div>
                                    <div className={styles.cushionTrack}>
                                        <span className={styles.cushionFillCash} style={{ width: `${cushion.cashWidthPercent}%` }} />
                                    </div>
                                </div>
                                <div className={styles.cushionRow}>
                                    <div>
                                        <span>Total debt</span>
                                        <b>{compactFinancialAmount(cushion.debt, cushion.currency)}</b>
                                    </div>
                                    <div className={styles.cushionTrack}>
                                        <span className={styles.cushionFillDebt} style={{ width: `${cushion.debtWidthPercent}%` }} />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className={styles.finEmpty}>
                                Cash and debt figures in a single confirmed currency were not supplied.
                            </p>
                        )}
                    </div>

                    <div className={styles.cushionPanel}>
                        <div className={styles.cushionHead}>
                            <strong>{shareSeries ? shareSeries.shareBasisLabel : 'Share count trend'}</strong>
                            {shareSeries && shareSeries.cumulativeChangePercent !== null && (
                                <span
                                    className={styles.toneBadge}
                                    data-tone={shareSeries.posture === 'buyback' ? 'up' : shareSeries.posture === 'dilution' ? 'down' : 'neutral'}
                                >
                                    {shareSeries.cumulativeChangePercent >= 0 ? '+' : ''}
                                    {shareSeries.cumulativeChangePercent.toFixed(2)}% ({shareSeries.startPeriod.slice(0, 4)}–{shareSeries.endPeriod.slice(0, 4)})
                                </span>
                            )}
                        </div>
                        {shareSeries && sharePoints.length > 0 ? (
                            <div className={styles.shareBars}>
                                {sharePoints.map(pt => (
                                    <div
                                        key={pt.reportingPeriod}
                                        className={styles.shareCol}
                                        title={`${pt.reportingPeriod}: ${compactShareCount(pt.shares)}`}
                                    >
                                        <div className={styles.shareBarWrap}>
                                            <span
                                                className={styles.shareBar}
                                                style={{ height: Math.max(10, Math.round(pt.heightPercent * 0.72)) }}
                                            />
                                        </div>
                                        <small>{pt.reportingPeriod.slice(0, 4)}</small>
                                        {pt.shareChangePercent !== null && (
                                            <span
                                                className={styles.shareDelta}
                                                data-tone={pt.shareChangePercent < 0 ? 'up' : pt.shareChangePercent > 0 ? 'down' : 'neutral'}
                                            >
                                                {pt.shareChangePercent >= 0 ? '+' : ''}{pt.shareChangePercent.toFixed(1)}%
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className={styles.finEmpty}>
                                Comparable multi-year share counts were not supplied.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}

const PIN_TONE: Record<'invalidation' | 'entry' | 'cost' | 'current', string> = {
    invalidation: 'down',
    entry: 'brand',
    cost: 'neutral',
    current: 'ink',
};

export function V9EntryGuardrailCard({
    snapshot,
    ownerRecord,
    reviewHref,
    fmtPrice,
}: {
    readonly snapshot: ResearchSnapshot;
    readonly ownerRecord: ResearchRecord | null;
    readonly reviewHref: string;
    readonly fmtPrice: (value: number | null, currency?: string | null) => string;
}) {
    const livePrice = snapshot.quote.price;
    const low52 = snapshot.technicals.low52Week;
    const high52 = snapshot.technicals.high52Week;

    const planContext = useMemo(
        () => positionPlanPriceContext(ownerRecord?.positionPlan, snapshot.quote, snapshot.technicals),
        [ownerRecord?.positionPlan, snapshot.quote, snapshot.technicals],
    );

    const has52Range = isPositive(low52) && isPositive(high52) && (high52 ?? 0) > (low52 ?? 0);
    const selectionKey = `${snapshot.market}:${snapshot.symbol}`;
    const [overrideTarget, setOverrideTarget] = useState<{ readonly key: string; readonly value: number } | null>(null);

    if (!isPositive(livePrice) || (!has52Range && !planContext)) {
        return null;
    }

    const planHasPrices = Boolean(
        ownerRecord && (
            ownerRecord.positionPlan.plannedEntryPrice !== null
            || ownerRecord.positionPlan.averageCost !== null
            || ownerRecord.positionPlan.invalidationPrice !== null
        ),
    );
    const currencyMismatch = planHasPrices && !planContext;

    const minCandidates = [has52Range ? low52 : null, planContext?.scaleLow].filter(isPositive);
    const maxCandidates = [has52Range ? high52 : null, planContext?.scaleHigh].filter(isPositive);
    const sliderMin = Math.max(0.01, Math.floor(Math.min(...minCandidates) * 100) / 100);
    const sliderMax = Math.max(sliderMin + 0.01, Math.ceil(Math.max(...maxCandidates) * 100) / 100);
    const sliderStep = sliderMax - sliderMin >= 1000 ? 1 : 0.01;

    const savedEntry = planContext && isPositive(ownerRecord?.positionPlan.plannedEntryPrice)
        ? ownerRecord!.positionPlan.plannedEntryPrice!
        : null;
    const savedInvalidation = planContext && isPositive(ownerRecord?.positionPlan.invalidationPrice)
        ? ownerRecord!.positionPlan.invalidationPrice!
        : null;
    const savedCost = planContext && isPositive(ownerRecord?.positionPlan.averageCost)
        ? ownerRecord!.positionPlan.averageCost!
        : null;

    const defaultTarget = savedEntry !== null
        ? Math.max(sliderMin, Math.min(sliderMax, savedEntry))
        : Math.max(sliderMin, Math.min(sliderMax, Number((livePrice * 0.9).toFixed(2))));

    const activeTarget = overrideTarget?.key === selectionKey ? overrideTarget.value : defaultTarget;
    const hasSavedDrift = savedEntry !== null && Math.abs(activeTarget - savedEntry) > 0.005;
    const isExploring = savedEntry !== null ? hasSavedDrift : overrideTarget?.key === selectionKey;

    const gapPct = activeTarget > 0 ? ((livePrice - activeTarget) / activeTarget) * 100 : null;
    const vsEntryPct = savedEntry !== null ? ((activeTarget - savedEntry) / savedEntry) * 100 : null;
    const stopBufferPct = savedInvalidation !== null && activeTarget > 0
        ? ((activeTarget - savedInvalidation) / activeTarget) * 100
        : null;
    const vsCostPct = savedCost !== null ? ((activeTarget - savedCost) / savedCost) * 100 : null;

    const pinSpan = sliderMax - sliderMin || 1;
    const trackPins = planContext
        ? planContext.markers
            .filter((marker): marker is typeof marker & { id: 'invalidation' | 'entry' | 'cost' | 'current' } =>
                marker.id === 'invalidation' || marker.id === 'entry' || marker.id === 'cost' || marker.id === 'current')
            .map(marker => ({
                ...marker,
                leftPercent: Math.max(2, Math.min(98, ((marker.price - sliderMin) / pinSpan) * 100)),
                tone: PIN_TONE[marker.id],
            }))
        : [];

    const subtitle = isExploring
        ? 'Exploring · not saved'
        : savedEntry !== null
            ? 'Anchored to saved position plan · drags are temporary'
            : 'Local planning slider · saves nothing';

    const targetZone = ownerRecord?.targetBuyZone?.trim() || null;

    return (
        <section className={styles.card} aria-label="Target entry guardrail" data-testid="v9-entry-guardrail">
            <div className={styles.sectionHead}>
                <div>
                    <h2>Target Entry Guardrail</h2>
                    <p>{subtitle}</p>
                </div>
                {gapPct !== null && (
                    <span className={styles.toneBadge} data-tone={gapPct <= 0 ? 'up' : 'neutral'}>
                        {gapPct >= 0 ? `${gapPct.toFixed(1)}% above` : `${Math.abs(gapPct).toFixed(1)}% below`} target
                    </span>
                )}
            </div>

            <div className={styles.guardrailTargetRow}>
                <span>{savedEntry !== null && !hasSavedDrift ? 'Saved Entry Target' : 'Your Calm Entry Target'}</span>
                <strong>{fmtPrice(activeTarget, snapshot.quote.currency)}</strong>
            </div>

            {trackPins.length > 0 && (
                <div className={styles.guardrailPins} data-testid="v9-guardrail-pins" aria-label="Saved position plan markers">
                    {trackPins.map(pin => (
                        <span
                            key={pin.id}
                            className={styles.guardrailPin}
                            data-pin={pin.id}
                            data-tone={pin.tone}
                            style={{ left: `${pin.leftPercent.toFixed(2)}%` }}
                            title={`${pin.label}: ${fmtPrice(pin.price, snapshot.quote.currency)}`}
                        />
                    ))}
                </div>
            )}

            <input
                type="range"
                className={styles.guardrailSlider}
                min={sliderMin}
                max={sliderMax}
                step={sliderStep}
                value={Math.max(sliderMin, Math.min(sliderMax, activeTarget))}
                onChange={event => setOverrideTarget({ key: selectionKey, value: Number(event.target.value) })}
                aria-label="Target entry price"
            />

            <div className={styles.guardrailRange}>
                <span>{has52Range ? `52W Low ${fmtPrice(low52, snapshot.quote.currency)}` : `Min ${fmtPrice(sliderMin, snapshot.quote.currency)}`}</span>
                <span>Now {fmtPrice(livePrice, snapshot.quote.currency)}</span>
                <span>{has52Range ? `52W High ${fmtPrice(high52, snapshot.quote.currency)}` : `Max ${fmtPrice(sliderMax, snapshot.quote.currency)}`}</span>
            </div>

            {trackPins.length > 0 && (
                <div className={styles.guardrailLegend}>
                    {trackPins.map(pin => (
                        <span key={pin.id} className={styles.guardrailLegendItem} data-tone={pin.tone}>
                            <i aria-hidden="true" />
                            <span>{pin.label}: <b>{fmtPrice(pin.price, snapshot.quote.currency)}</b></span>
                        </span>
                    ))}
                </div>
            )}

            {(vsEntryPct !== null || stopBufferPct !== null || vsCostPct !== null) && (
                <div className={styles.guardrailDistances} data-testid="v9-guardrail-distances">
                    {vsEntryPct !== null && (
                        <span>
                            vs. Saved entry: <b>{vsEntryPct >= 0 ? '+' : ''}{vsEntryPct.toFixed(1)}%</b>
                        </span>
                    )}
                    {stopBufferPct !== null && (
                        <span>
                            Stop buffer: <b>{stopBufferPct >= 0 ? `${stopBufferPct.toFixed(1)}% above stop` : `${Math.abs(stopBufferPct).toFixed(1)}% below stop`}</b>
                        </span>
                    )}
                    {vsCostPct !== null && (
                        <span>
                            vs. Avg cost: <b>{vsCostPct >= 0 ? '+' : ''}{vsCostPct.toFixed(1)}%</b>
                        </span>
                    )}
                </div>
            )}

            {targetZone && (
                <p className={styles.guardrailNote}>
                    Saved target zone: <b>{targetZone}</b>
                </p>
            )}

            {currencyMismatch && (
                <p className={styles.v9Caution} data-testid="v9-guardrail-currency-mismatch">
                    Saved plan currency does not match quote currency — markers hidden.
                </p>
            )}

            {(hasSavedDrift || ownerRecord) && (
                <div className={styles.guardrailActions}>
                    {hasSavedDrift && (
                        <button
                            type="button"
                            className={styles.ghostBtn}
                            onClick={() => setOverrideTarget(null)}
                        >
                            Reset to saved plan
                        </button>
                    )}
                    {ownerRecord && (
                        <Link className={styles.textLink} href={reviewHref}>Edit plan →</Link>
                    )}
                </div>
            )}
        </section>
    );
}
