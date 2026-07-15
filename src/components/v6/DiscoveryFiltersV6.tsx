import type { ChangeEvent } from 'react';
import type { DiscoveryFilters } from '@/lib/research/discovery-filters';
import type { DiscoveryRisk, EarlyTrendStage, ValuationGuardrail } from '@/lib/types/research-discovery';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

const riskValue = (value: string): DiscoveryRisk | 'all' => value === 'low' || value === 'moderate' || value === 'high' ? value : 'all';
const stageValue = (value: string): EarlyTrendStage | 'all' => value === 'emerging' || value === 'confirmed' || value === 'extended' || value === 'not ready' ? value : 'all';
const valuationValue = (value: string): ValuationGuardrail | 'all' => value === 'attractive' || value === 'fair' || value === 'expensive' || value === 'extreme' || value === 'unavailable' ? value : 'all';

export const DiscoveryFiltersV6 = ({ filters, sectors, resultCount, active, theme, onChange, onReset }: {
    readonly filters: DiscoveryFilters;
    readonly sectors: readonly string[];
    readonly resultCount: number;
    readonly active: boolean;
    readonly theme: ResearchThemeV6;
    readonly onChange: (filters: DiscoveryFilters) => void;
    readonly onReset: () => void;
}) => {
    const styles = getThemeV6(theme);
    const fieldClass = 'min-h-10 rounded border bg-transparent px-2 text-xs capitalize ' + styles.row;
    const updateRisk = (event: ChangeEvent<HTMLSelectElement>) => onChange({ ...filters, risk: riskValue(event.target.value) });
    const updateStage = (event: ChangeEvent<HTMLSelectElement>) => onChange({ ...filters, stage: stageValue(event.target.value) });
    const updateValuation = (event: ChangeEvent<HTMLSelectElement>) => onChange({ ...filters, valuation: valuationValue(event.target.value) });

    return (
        <div className={'flex flex-wrap items-end gap-2 border-b px-2 py-3 ' + styles.divider}>
            <label className={'grid gap-1 text-xs font-semibold uppercase ' + styles.textMuted}>Sector
                <select aria-label="Filter by sector" value={filters.sector} onChange={(event) => onChange({ ...filters, sector: event.target.value })} className={fieldClass}>
                    <option value="all">All sectors</option>
                    {sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
                </select>
            </label>
            <label className={'grid gap-1 text-xs font-semibold uppercase ' + styles.textMuted}>Risk
                <select aria-label="Filter by risk" value={filters.risk} onChange={updateRisk} className={fieldClass}>
                    <option value="all">All risks</option><option value="low">Low</option><option value="moderate">Moderate</option>
                </select>
            </label>
            <label className={'grid gap-1 text-xs font-semibold uppercase ' + styles.textMuted}>Trend stage
                <select aria-label="Filter by trend stage" value={filters.stage} onChange={updateStage} className={fieldClass}>
                    <option value="all">All stages</option><option value="emerging">Emerging</option><option value="confirmed">Confirmed</option><option value="extended">Extended</option><option value="not ready">Not ready</option>
                </select>
            </label>
            <label className={'grid gap-1 text-xs font-semibold uppercase ' + styles.textMuted}>Valuation
                <select aria-label="Filter by valuation" value={filters.valuation} onChange={updateValuation} className={fieldClass}>
                    <option value="all">All valuations</option><option value="attractive">Attractive</option><option value="fair">Fair</option><option value="expensive">Expensive</option><option value="extreme">Extreme</option><option value="unavailable">Unavailable</option>
                </select>
            </label>
            <span aria-live="polite" className={'min-h-10 content-center text-xs ' + styles.textMuted}>{resultCount} matches</span>
            {active ? <button type="button" onClick={onReset} className={'min-h-10 rounded border px-3 text-xs font-semibold ' + styles.row}>Reset</button> : null}
        </div>
    );
};
