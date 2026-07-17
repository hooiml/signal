import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import { calculatePositionPlanRisk, calculateSectorConcentration } from '@/lib/research/position-plan';
import type { ResearchRecord } from '@/lib/types/research';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

export const PositionPlanOverviewV6 = ({ records, items, theme }: {
    readonly records: readonly ResearchRecord[];
    readonly items: readonly ResearchWatchlistItem[];
    readonly theme: ResearchThemeV6;
}) => {
    const styles = getThemeV6(theme);
    const itemBySymbol = new Map(items.map((item) => [item.symbol, item]));
    const sectors = new Map(items.map((item) => [item.symbol, item.sector]));
    const concentration = calculateSectorConcentration(records, sectors);
    const planned = records.filter((record) => record.positionPlan.plannedAllocationPercent !== null && record.positionPlan.plannedAllocationPercent > 0);
    const totalAllocation = planned.reduce((sum, record) => sum + (record.positionPlan.plannedAllocationPercent ?? 0), 0);
    const totalRisk = planned.reduce((sum, record) => sum + (calculatePositionPlanRisk(record.positionPlan, itemBySymbol.get(record.symbol)?.price ?? null)?.portfolioRiskPercent ?? 0), 0);
    const topSector = concentration[0];

    return <section data-testid="position-plan-overview" aria-labelledby="position-plan-overview-title" className={'mb-4 rounded-[10px] border p-4 backdrop-blur min-[700px]:p-5 ' + styles.panel}>
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className={'text-xs font-bold uppercase tracking-[0.14em] ' + styles.positive}>Portfolio guardrails</p><h2 id="position-plan-overview-title" className={'mt-1 text-lg font-bold ' + styles.textPrimary}>Position plan overview</h2></div>
            <p className={'max-w-xl text-xs leading-5 ' + styles.textMuted}>Planning estimates only. No brokerage balances, transactions, or automatic orders are stored.</p>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div><dt className={'text-xs font-semibold ' + styles.textMuted}>Planned names</dt><dd className={'mt-1 font-mono text-lg font-bold ' + styles.textPrimary}>{planned.length}</dd></div>
            <div><dt className={'text-xs font-semibold ' + styles.textMuted}>Planned allocation</dt><dd className={'mt-1 font-mono text-lg font-bold ' + (totalAllocation > 100 ? styles.risk : styles.textPrimary)}>{totalAllocation.toFixed(1)}%</dd></div>
            <div><dt className={'text-xs font-semibold ' + styles.textMuted}>Defined portfolio risk</dt><dd className={'mt-1 font-mono text-lg font-bold ' + styles.textPrimary}>{totalRisk.toFixed(2)}%</dd></div>
            <div><dt className={'text-xs font-semibold ' + styles.textMuted}>Largest owned sector</dt><dd className={'mt-1 text-sm font-bold ' + styles.textPrimary}>{topSector ? `${topSector.sector} · ${topSector.allocationPercent.toFixed(1)}%` : 'Not enough plan data'}</dd></div>
        </dl>
        {totalAllocation > 100 ? <p role="alert" className={'mt-3 text-xs ' + styles.risk}>Planned allocations exceed 100%. Reduce one or more position plans before treating this as a portfolio guardrail.</p> : null}
    </section>;
};
