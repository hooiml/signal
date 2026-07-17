import { useState, type ChangeEvent } from 'react';
import type { DiscoveryFilters } from '@/lib/research/discovery-filters';
import type { SavedDiscoveryView } from '@/lib/research/discovery-workspace';
import type { DiscoveryRisk, EarlyTrendStage, ValuationGuardrail } from '@/lib/types/research-discovery';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

const riskValue = (value: string): DiscoveryRisk | 'all' => value === 'low' || value === 'moderate' || value === 'high' ? value : 'all';
const stageValue = (value: string): EarlyTrendStage | 'all' => value === 'emerging' || value === 'confirmed' || value === 'extended' || value === 'not ready' ? value : 'all';
const valuationValue = (value: string): ValuationGuardrail | 'all' => value === 'attractive' || value === 'fair' || value === 'expensive' || value === 'extreme' || value === 'unavailable' ? value : 'all';

export const DiscoveryFiltersV6 = ({ filters, sectors, resultCount, active, savedViews, theme, onChange, onReset, onSaveView, onApplyView, onDeleteView }: {
    readonly filters: DiscoveryFilters;
    readonly sectors: readonly string[];
    readonly resultCount: number;
    readonly active: boolean;
    readonly savedViews: readonly SavedDiscoveryView[];
    readonly theme: ResearchThemeV6;
    readonly onChange: (filters: DiscoveryFilters) => void;
    readonly onReset: () => void;
    readonly onSaveView: (name: string) => void;
    readonly onApplyView: (view: SavedDiscoveryView) => void;
    readonly onDeleteView: (id: string) => void;
}) => {
    const [viewName, setViewName] = useState('');
    const styles = getThemeV6(theme);
    const fieldClass = 'min-h-10 rounded border bg-transparent px-2 text-xs capitalize ' + styles.row;
    const updateRisk = (event: ChangeEvent<HTMLSelectElement>) => onChange({ ...filters, risk: riskValue(event.target.value) });
    const updateStage = (event: ChangeEvent<HTMLSelectElement>) => onChange({ ...filters, stage: stageValue(event.target.value) });
    const updateValuation = (event: ChangeEvent<HTMLSelectElement>) => onChange({ ...filters, valuation: valuationValue(event.target.value) });

    return (
        <div className={'border-b px-2 py-3 ' + styles.divider}>
        <div className="flex flex-wrap items-end gap-2">
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
        <div className={'mt-3 flex flex-wrap items-end gap-2 border-t pt-3 ' + styles.divider}>
            <label className={'grid gap-1 text-xs font-semibold uppercase ' + styles.textMuted}>Saved view
                <select aria-label="Apply saved Discovery view" defaultValue="" onChange={(event) => {
                    const view = savedViews.find((candidate) => candidate.id === event.target.value);
                    if (view) onApplyView(view);
                    event.target.value = '';
                }} className={fieldClass}>
                    <option value="">Choose view</option>
                    {savedViews.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
                </select>
            </label>
            <label className={'grid gap-1 text-xs font-semibold uppercase ' + styles.textMuted}>View name
                <input aria-label="Discovery view name" value={viewName} maxLength={40} onChange={(event) => setViewName(event.target.value)} className={fieldClass} />
            </label>
            <button type="button" disabled={!viewName.trim()} onClick={() => { onSaveView(viewName); setViewName(''); }} className={'min-h-10 rounded border px-3 text-xs font-semibold disabled:opacity-50 ' + styles.row}>Save current</button>
            {savedViews.map((view) => <button key={view.id} type="button" onClick={() => onDeleteView(view.id)} className={'min-h-10 rounded px-2 text-xs ' + styles.risk} aria-label={`Delete saved view ${view.name}`}>Remove {view.name}</button>)}
        </div>
        </div>
    );
};
