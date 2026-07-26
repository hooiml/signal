'use client';

import { useState } from 'react';
import {
    discoveryPolicyPreferences,
    type DiscoveryPolicyPreference,
    type DiscoveryUniversePolicy,
    type SavedDiscoveryUniverse,
} from '@/lib/research/discovery-policy';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

const preferenceLabels: Readonly<Record<DiscoveryPolicyPreference, string>> = {
    quality: 'Business quality',
    trend: 'Trend score',
    'sector-strength': 'Sector-relative strength',
    valuation: 'Valuation guardrail',
    catalyst: 'Upcoming earnings',
    liquidity: 'Dollar-volume liquidity',
};

export const DiscoveryUniversePolicyV6 = ({ policy, sectors, eligibleCount, excludedCount, saved, theme, onChange, onReset, onSave, onApply, onDelete }: {
    readonly policy: DiscoveryUniversePolicy;
    readonly sectors: readonly string[];
    readonly eligibleCount: number;
    readonly excludedCount: number;
    readonly saved: readonly SavedDiscoveryUniverse[];
    readonly theme: ResearchThemeV6;
    readonly onChange: (policy: DiscoveryUniversePolicy) => void;
    readonly onReset: () => void;
    readonly onSave: (name: string) => void;
    readonly onApply: (saved: SavedDiscoveryUniverse) => void;
    readonly onDelete: (id: string) => void;
}) => {
    const styles = getThemeV6(theme);
    const [name, setName] = useState('');
    const field = 'min-h-10 rounded border bg-transparent px-2 text-xs ' + styles.row;
    const toggleSector = (sector: string) => onChange({
        ...policy,
        sectors: policy.sectors.includes(sector) ? policy.sectors.filter((item) => item !== sector) : [...policy.sectors, sector],
    });
    const togglePreference = (preference: DiscoveryPolicyPreference) => {
        if (policy.preferences.includes(preference)) {
            onChange({ ...policy, preferences: policy.preferences.filter((item) => item !== preference) });
        } else if (policy.preferences.length < 3) {
            onChange({ ...policy, preferences: [...policy.preferences, preference] });
        }
    };

    return <details data-testid="discovery-universe-policy" className={'border-b px-2 py-3 ' + styles.divider}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 [&::-webkit-details-marker]:hidden">
            <span><strong className={'block text-sm ' + styles.textPrimary}>Custom universe and ranking policy</strong><span className={'mt-1 block text-xs ' + styles.textMuted}>{eligibleCount} eligible · {excludedCount} excluded · {policy.preferences.length} preference{policy.preferences.length === 1 ? '' : 's'}</span></span>
            <span className={'text-xs ' + styles.textMuted}>US scan only · configure</span>
        </summary>
        <div className={'mt-3 rounded border p-4 ' + styles.panelUtility}>
            <p className={'text-xs leading-5 ' + styles.textSecondary}>The provider scan remains the curated liquid US universe. Eligibility rules remove candidates first; up to three preferences add documented points to the unchanged default discovery score.</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <fieldset>
                    <legend className={'text-xs font-bold uppercase tracking-[0.08em] ' + styles.textMuted}>Eligible sectors <span className="font-normal normal-case">(none = all)</span></legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {sectors.map((sector) => <label key={sector} className={'flex min-h-9 items-center gap-2 text-xs ' + styles.textSecondary}><input type="checkbox" checked={policy.sectors.includes(sector)} onChange={() => toggleSector(sector)} />{sector}</label>)}
                    </div>
                </fieldset>
                <div className="grid content-start gap-3">
                    <label className={'grid gap-1 text-xs font-bold uppercase tracking-[0.08em] ' + styles.textMuted}>Minimum dollar volume
                        <select value={policy.minimumDollarVolume} onChange={(event) => onChange({ ...policy, minimumDollarVolume: Number(event.target.value) })} className={field}>
                            <option value={20_000_000}>$20M default</option><option value={50_000_000}>$50M</option><option value={100_000_000}>$100M</option>
                        </select>
                    </label>
                    <label className={'grid gap-1 text-xs font-bold uppercase tracking-[0.08em] ' + styles.textMuted}>Maximum risk
                        <select value={policy.maximumRisk} onChange={(event) => onChange({ ...policy, maximumRisk: event.target.value === 'low' ? 'low' : 'moderate' })} className={field}>
                            <option value="moderate">Moderate default</option><option value="low">Low only</option>
                        </select>
                    </label>
                    <label className={'flex min-h-10 items-center gap-2 text-xs font-semibold ' + styles.textSecondary}><input type="checkbox" checked={policy.excludeExtremeValuation} onChange={(event) => onChange({ ...policy, excludeExtremeValuation: event.target.checked })} />Exclude extreme valuation</label>
                </div>
            </div>
            <fieldset className={'mt-4 border-t pt-4 ' + styles.divider}>
                <legend className={'px-1 text-xs font-bold uppercase tracking-[0.08em] ' + styles.textMuted}>Ranking preferences <span className="font-normal normal-case">(choose up to 3)</span></legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {discoveryPolicyPreferences.map((preference) => <label key={preference} className={'flex min-h-9 items-center gap-2 text-xs ' + styles.textSecondary}><input type="checkbox" checked={policy.preferences.includes(preference)} disabled={!policy.preferences.includes(preference) && policy.preferences.length >= 3} onChange={() => togglePreference(preference)} />{preferenceLabels[preference]}</label>)}
                </div>
            </fieldset>
            <div className={'mt-4 flex flex-wrap items-end gap-2 border-t pt-4 ' + styles.divider}>
                <label className={'grid gap-1 text-xs font-bold uppercase tracking-[0.08em] ' + styles.textMuted}>Saved universe
                    <select aria-label="Apply saved Discovery universe" defaultValue="" onChange={(event) => {
                        const item = saved.find((candidate) => candidate.id === event.target.value);
                        if (item) onApply(item);
                        event.target.value = '';
                    }} className={field}><option value="">Choose universe</option>{saved.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                </label>
                <label className={'grid gap-1 text-xs font-bold uppercase tracking-[0.08em] ' + styles.textMuted}>Universe name
                    <input aria-label="Discovery universe name" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} className={field} />
                </label>
                <button type="button" disabled={!name.trim()} onClick={() => { onSave(name); setName(''); }} className={'min-h-10 rounded border px-3 text-xs font-semibold disabled:opacity-50 ' + styles.row}>Save policy</button>
                <button type="button" onClick={onReset} className={'min-h-10 rounded border px-3 text-xs font-semibold ' + styles.row}>Use default</button>
                {saved.map((item) => <button key={item.id} type="button" aria-label={`Delete saved universe ${item.name}`} onClick={() => onDelete(item.id)} className={'min-h-10 px-2 text-xs ' + styles.risk}>Remove {item.name}</button>)}
            </div>
        </div>
    </details>;
};
