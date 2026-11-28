'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { reconcilePortfolioHoldings } from '@/lib/portfolio/holdings';
import {
    loadPortfolioHoldingsSnapshot,
    PORTFOLIO_HOLDINGS_CHANGE_EVENT,
    type PortfolioHoldingsLoadResult,
} from '@/lib/portfolio/holdings-client';
import {
    buildPortfolioFactorExposure,
    researchFactorDirectionLabels,
    researchFactorMaterialityLabels,
    researchFactorTaxonomy,
    type PortfolioFactorGroup,
} from '@/lib/research/factor-exposure';
import { researchFactorIds, type ResearchFactorDirection, type ResearchFactorId, type ResearchMarket, type ResearchRecord } from '@/lib/types/research';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import { currencyMatchedHoldingPrices, type V9QuoteBatchStatus } from './useV9QuoteBatch';
import styles from './v9-workspace.module.css';

const directionShort = (direction: ResearchFactorDirection): string =>
    direction === 'benefits-when-rises' ? 'Benefits' : direction === 'harmed-when-rises' ? 'Harmed' : 'Mixed';

const directionTone = (direction: ResearchFactorDirection): 'up' | 'down' | 'neutral' =>
    direction === 'benefits-when-rises' ? 'up' : direction === 'harmed-when-rises' ? 'down' : 'neutral';

const formatMoney = (value: number, currency: string): string =>
    new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

export function V9FactorExposureView({
    records,
    quotes,
    quoteStatus,
    manageHref,
    onOpenStock,
}: {
    readonly records: readonly ResearchRecord[] | null;
    readonly quotes?: ReadonlyMap<string, ResearchSnapshot['quote']>;
    readonly quoteStatus?: V9QuoteBatchStatus;
    readonly manageHref: string;
    readonly onOpenStock: (symbol: string, market: ResearchMarket) => void;
}) {
    const [materialityFilter, setMaterialityFilter] = useState<'all' | 'high'>('all');
    const [selectedCell, setSelectedCell] = useState<{
        readonly account: string;
        readonly symbol: string;
        readonly factor: ResearchFactorId;
    } | null>(null);

    const [loaded, setLoaded] = useState<PortfolioHoldingsLoadResult | null>(null);

    useEffect(() => {
        const refresh = () => setLoaded(loadPortfolioHoldingsSnapshot());
        const timer = window.setTimeout(refresh, 0);
        window.addEventListener('storage', refresh);
        window.addEventListener(PORTFOLIO_HOLDINGS_CHANGE_EVENT, refresh);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('storage', refresh);
            window.removeEventListener(PORTFOLIO_HOLDINGS_CHANGE_EVENT, refresh);
        };
    }, []);

    const groups = useMemo<readonly PortfolioFactorGroup[]>(() => {
        if (!loaded || loaded.status !== 'ready') return [];
        const prices = quotes ? currencyMatchedHoldingPrices(loaded.snapshot.holdings, quotes) : new Map<string, number | null>();
        const reconciled = reconcilePortfolioHoldings(loaded.snapshot, records ?? [], prices);
        return buildPortfolioFactorExposure(reconciled);
    }, [loaded, quotes, records]);

    if (!loaded) {
        return (
            <section className={styles.card} aria-label="Portfolio factor exposure" data-testid="v9-factor-exposure">
                <p role="status" className={styles.factorEmpty}>Loading local holdings snapshot…</p>
            </section>
        );
    }

    if (loaded.status === 'empty') {
        return (
            <section className={styles.card} aria-label="Portfolio factor exposure" data-testid="v9-factor-exposure">
                <div className={styles.sectionHead}>
                    <div>
                        <h2>Factor Exposure Matrix</h2>
                        <p>Maps user-declared macro &amp; cycle assumptions onto your local holdings by account and currency.</p>
                    </div>
                </div>
                <p className={styles.factorEmpty}>
                    No local holdings snapshot has been imported in this browser yet. Import holdings first to map your declared factor exposures.
                </p>
                <div style={{ marginTop: 12 }}>
                    <Link className={styles.primaryBtn} href={manageHref}>Import holdings →</Link>
                </div>
            </section>
        );
    }

    if (loaded.status !== 'ready') {
        return (
            <section className={styles.card} aria-label="Portfolio factor exposure" data-testid="v9-factor-exposure">
                <div className={styles.sectionHead}>
                    <div>
                        <h2>Factor Exposure Matrix</h2>
                        <p>Local holdings snapshot could not be read.</p>
                    </div>
                </div>
                <p role="alert" className={styles.factorEmpty}>{loaded.message}</p>
            </section>
        );
    }

    const anyDeclaredFactors = groups.some(group => group.factors.length > 0);

    return (
        <section className={styles.card} aria-label="Portfolio factor exposure" data-testid="v9-factor-exposure">
            <div className={styles.factorHead}>
                <div>
                    <h2>Factor Exposure Matrix</h2>
                    <p>
                        User-declared exposures joined by exact market + symbol · Accounts and currencies stay separate · Never inferred from sector or price.
                        {quoteStatus === 'loading' ? ' · Loading live prices…' : ''}
                    </p>
                </div>
                {anyDeclaredFactors && (
                    <div className={styles.segWrap} role="group" aria-label="Materiality filter">
                        <button
                            type="button"
                            className={styles.segBtn}
                            aria-pressed={materialityFilter === 'all'}
                            onClick={() => setMaterialityFilter('all')}
                        >
                            All levels
                        </button>
                        <button
                            type="button"
                            className={styles.segBtn}
                            aria-pressed={materialityFilter === 'high'}
                            onClick={() => setMaterialityFilter('high')}
                        >
                            High materiality
                        </button>
                    </div>
                )}
            </div>

            {!anyDeclaredFactors ? (
                <div className={styles.factorTaxonomyEmpty}>
                    <p className={styles.factorEmpty}>
                        Your local holdings snapshot has {loaded.snapshot.holdings.length} {loaded.snapshot.holdings.length === 1 ? 'holding' : 'holdings'}, but none of their matched saved research records have declared factor assumptions yet.
                    </p>
                    <div className={styles.factorTaxonomyGrid} aria-label="Supported 10-factor taxonomy">
                        {researchFactorIds.map(factorId => (
                            <div key={factorId} className={styles.factorTaxonomyItem}>
                                <strong>{researchFactorTaxonomy[factorId].label}</strong>
                                <span>{researchFactorTaxonomy[factorId].description}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className={styles.factorGroups}>
                    {groups.map(group => {
                        const visibleFactors = group.factors.filter(factor =>
                            materialityFilter === 'all'
                            || group.rows.some(row => row.cells[factor]?.assumption.materiality === 'high'),
                        );
                        const activeDetail = selectedCell && selectedCell.account === `${group.accountLabel}:${group.currency}`
                            ? group.rows.find(row => row.holding.symbol === selectedCell.symbol)?.cells[selectedCell.factor] ?? null
                            : null;
                        const valueWeighted = group.knownValue > 0;

                        return (
                            <article key={`${group.accountLabel}:${group.currency}`} className={styles.factorGroup}>
                                <div className={styles.factorGroupHead}>
                                    <div>
                                        <h3>{group.accountLabel} · {group.currency}</h3>
                                        <p>
                                            {group.rows.length} {group.rows.length === 1 ? 'holding' : 'holdings'}
                                            {valueWeighted ? ` · Value-weighted (${formatMoney(group.knownValue, group.currency)} priced)` : ''}
                                            {group.unmatchedCount > 0 ? ` · ${group.unmatchedCount} unmatched` : ''}
                                            {group.noAssumptionCount > 0 ? ` · ${group.noAssumptionCount} without factors` : ''}
                                            {group.missingPriceCount > 0 ? ` · ${group.missingPriceCount} without live price${valueWeighted ? '' : ' (count-only view)'}` : ''}
                                        </p>
                                    </div>
                                </div>

                                {visibleFactors.length === 0 ? (
                                    <p className={styles.factorEmpty}>No {materialityFilter === 'high' ? 'high-materiality ' : ''}factor assumptions declared in this account.</p>
                                ) : (
                                    <>
                                        <div className={styles.factorSummaryBars} aria-label={`${group.accountLabel} factor concentration`}>
                                            {visibleFactors.map(factor => {
                                                const matchingCells = group.rows.flatMap(row => {
                                                    const cell = row.cells[factor];
                                                    if (!cell) return [];
                                                    if (materialityFilter === 'high' && cell.assumption.materiality !== 'high') return [];
                                                    return [cell];
                                                });
                                                const benefits = matchingCells.filter(c => c.assumption.direction === 'benefits-when-rises');
                                                const harmed = matchingCells.filter(c => c.assumption.direction === 'harmed-when-rises');
                                                const mixed = matchingCells.filter(c => c.assumption.direction === 'mixed');

                                                if (valueWeighted) {
                                                    const sumVal = (cells: typeof matchingCells) => cells.reduce((sum, cell) => sum + (cell.marketValue ?? 0), 0);
                                                    const benefitsVal = sumVal(benefits);
                                                    const harmedVal = sumVal(harmed);
                                                    const mixedVal = sumVal(mixed);
                                                    const coveredVal = benefitsVal + harmedVal + mixedVal;
                                                    const pct = (val: number) => Math.round((val / group.knownValue) * 100);
                                                    return (
                                                        <div key={factor} className={styles.factorBarRow}>
                                                            <div className={styles.factorBarLabel}>
                                                                <strong>{researchFactorTaxonomy[factor].label}</strong>
                                                                <span>
                                                                    {pct(coveredVal)}% of priced value · {matchingCells.length}/{group.rows.length} holdings
                                                                    {benefitsVal > 0 ? ` · ${pct(benefitsVal)}% benefits` : ''}
                                                                    {harmedVal > 0 ? ` · ${pct(harmedVal)}% harmed` : ''}
                                                                    {mixedVal > 0 ? ` · ${pct(mixedVal)}% mixed` : ''}
                                                                </span>
                                                            </div>
                                                            <div className={styles.factorBarTrack} aria-hidden="true">
                                                                {benefitsVal > 0 && <span className={styles.factorSegUp} style={{ width: `${(benefitsVal / group.knownValue) * 100}%` }} />}
                                                                {mixedVal > 0 && <span className={styles.factorSegMixed} style={{ width: `${(mixedVal / group.knownValue) * 100}%` }} />}
                                                                {harmedVal > 0 && <span className={styles.factorSegDown} style={{ width: `${(harmedVal / group.knownValue) * 100}%` }} />}
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                const total = Math.max(1, group.rows.length);
                                                return (
                                                    <div key={factor} className={styles.factorBarRow}>
                                                        <div className={styles.factorBarLabel}>
                                                            <strong>{researchFactorTaxonomy[factor].label}</strong>
                                                            <span>
                                                                {matchingCells.length}/{group.rows.length} holdings
                                                                {benefits.length > 0 ? ` · ${benefits.length} benefits` : ''}
                                                                {harmed.length > 0 ? ` · ${harmed.length} harmed` : ''}
                                                                {mixed.length > 0 ? ` · ${mixed.length} mixed` : ''}
                                                            </span>
                                                        </div>
                                                        <div className={styles.factorBarTrack} aria-hidden="true">
                                                            {benefits.length > 0 && <span className={styles.factorSegUp} style={{ width: `${(benefits.length / total) * 100}%` }} />}
                                                            {mixed.length > 0 && <span className={styles.factorSegMixed} style={{ width: `${(mixed.length / total) * 100}%` }} />}
                                                            {harmed.length > 0 && <span className={styles.factorSegDown} style={{ width: `${(harmed.length / total) * 100}%` }} />}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className={styles.factorTableScroll} tabIndex={0} aria-label={`${group.accountLabel} ${group.currency} factor table`}>
                                            <table className={styles.factorTable}>
                                                <thead>
                                                    <tr>
                                                        <th scope="col">Holding</th>
                                                        {visibleFactors.map(factor => (
                                                            <th scope="col" key={factor}>{researchFactorTaxonomy[factor].label}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {group.rows.map(row => (
                                                        <tr key={`${row.holding.market}:${row.holding.symbol}`}>
                                                            <th scope="row">
                                                                {row.matched ? (
                                                                    <button
                                                                        type="button"
                                                                        className={styles.textLink}
                                                                        onClick={() => onOpenStock(row.holding.symbol, row.holding.market)}
                                                                    >
                                                                        {row.holding.symbol}
                                                                    </button>
                                                                ) : (
                                                                    <span>{row.holding.symbol}</span>
                                                                )}
                                                                <small>{row.holding.market}{!row.matched ? ' · Unmatched' : ''}</small>
                                                            </th>
                                                            {visibleFactors.map(factor => {
                                                                const cell = row.cells[factor];
                                                                if (!cell || (materialityFilter === 'high' && cell.assumption.materiality !== 'high')) {
                                                                    return <td key={factor} className={styles.factorDash}>—</td>;
                                                                }
                                                                const isSelected = selectedCell?.account === `${group.accountLabel}:${group.currency}`
                                                                    && selectedCell.symbol === row.holding.symbol
                                                                    && selectedCell.factor === factor;
                                                                return (
                                                                    <td key={factor}>
                                                                        <button
                                                                            type="button"
                                                                            className={styles.factorCellBtn}
                                                                            data-tone={directionTone(cell.assumption.direction)}
                                                                            aria-pressed={isSelected}
                                                                            onClick={() => setSelectedCell(isSelected ? null : {
                                                                                account: `${group.accountLabel}:${group.currency}`,
                                                                                symbol: row.holding.symbol,
                                                                                factor,
                                                                            })}
                                                                        >
                                                                            <b>{directionShort(cell.assumption.direction)}</b>
                                                                            <small>{researchFactorMaterialityLabels[cell.assumption.materiality]}</small>
                                                                        </button>
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {activeDetail && selectedCell && (
                                            <div className={styles.factorDetailBar} role="status" data-testid="v9-factor-detail">
                                                <div>
                                                    <strong>
                                                        {selectedCell.symbol} · {researchFactorTaxonomy[selectedCell.factor].label}
                                                    </strong>
                                                    <span>
                                                        {researchFactorDirectionLabels[activeDetail.assumption.direction]} · {researchFactorMaterialityLabels[activeDetail.assumption.materiality]} materiality · Dated {activeDetail.assumption.evidenceDate}
                                                        {activeDetail.marketValue !== null ? ` · Market value ${formatMoney(activeDetail.marketValue, group.currency)}` : ''}
                                                    </span>
                                                    {activeDetail.assumption.evidenceNote && <p>{activeDetail.assumption.evidenceNote}</p>}
                                                </div>
                                                <button type="button" className={styles.ghostBtn} onClick={() => setSelectedCell(null)}>
                                                    Close detail
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
