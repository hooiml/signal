'use client';

import { useEffect, useState } from 'react';
import {
    parseResearchLayoutDensity,
    parseSavedResearchLayouts,
    removeSavedResearchLayout,
    researchDensityStorageKey,
    researchSavedLayoutLimit,
    researchSavedLayoutsStorageKey,
    upsertSavedResearchLayout,
    type ResearchLayoutDensity,
    type SavedResearchLayout,
} from '@/lib/research/saved-layouts';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

export const ResearchLayoutControlsV6 = ({ current, density, theme, onApply, onDensityChange, onLayoutsChange }: {
    readonly current: Omit<SavedResearchLayout, 'id' | 'name' | 'savedAt' | 'density'>;
    readonly density: ResearchLayoutDensity;
    readonly theme: ResearchThemeV6;
    readonly onApply: (layout: SavedResearchLayout) => void;
    readonly onDensityChange: (density: ResearchLayoutDensity) => void;
    readonly onLayoutsChange: (layouts: readonly SavedResearchLayout[]) => void;
}) => {
    const styles = getThemeV6(theme);
    const [loaded, setLoaded] = useState(false);
    const [name, setName] = useState('');
    const [layouts, setLayouts] = useState<readonly SavedResearchLayout[]>([]);

    useEffect(() => {
        try {
            const storedLayouts = parseSavedResearchLayouts(JSON.parse(window.localStorage.getItem(researchSavedLayoutsStorageKey) ?? '[]'));
            const storedDensity = parseResearchLayoutDensity(window.localStorage.getItem(researchDensityStorageKey));
            setLayouts(storedLayouts);
            onLayoutsChange(storedLayouts);
            onDensityChange(storedDensity);
        } catch {
            setLayouts([]);
            onLayoutsChange([]);
        } finally {
            setLoaded(true);
        }
    }, [onDensityChange, onLayoutsChange]);

    const persist = (next: readonly SavedResearchLayout[]) => {
        setLayouts(next);
        onLayoutsChange(next);
        window.localStorage.setItem(researchSavedLayoutsStorageKey, JSON.stringify(next));
    };

    const changeDensity = (next: ResearchLayoutDensity) => {
        onDensityChange(next);
        window.localStorage.setItem(researchDensityStorageKey, next);
    };

    const save = () => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const existing = layouts.find((layout) => layout.name.toLowerCase() === trimmed.toLowerCase());
        const next = upsertSavedResearchLayout(layouts, {
            ...current,
            id: existing?.id ?? globalThis.crypto.randomUUID(),
            name: trimmed,
            savedAt: new Date().toISOString(),
            density,
        });
        persist(next);
        setName('');
    };

    if (!loaded) return null;
    return (
        <details className={'mb-3 rounded-lg border ' + styles.panelUtility}>
            <summary className={'flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden ' + styles.textSecondary}>
                <span>Views & density</span>
                <span className={'text-xs ' + styles.textMuted}>{layouts.length}/{researchSavedLayoutLimit} saved · {density}</span>
            </summary>
            <div className={'border-t p-3 ' + styles.divider}>
                <div className="flex flex-wrap items-end gap-3">
                    <div>
                        <span className={'block text-xs font-semibold ' + styles.textMuted}>Density</span>
                        <div className="mt-1 flex rounded border p-0.5" role="group" aria-label="Research density">
                            {(['comfortable', 'compact'] as const).map((option) => <button key={option} type="button" aria-pressed={density === option} onClick={() => changeDensity(option)} className={'min-h-9 rounded px-3 text-xs font-semibold ' + (density === option ? styles.selectedRow : styles.textMuted)}>{option === 'comfortable' ? 'Comfortable' : 'Compact'}</button>)}
                        </div>
                    </div>
                    <label className={'min-w-[180px] flex-1 text-xs font-semibold ' + styles.textMuted}>Save current view
                        <input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') save(); }} placeholder="e.g. US ready list" className={'mt-1 h-10 w-full rounded border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ' + styles.panelSolid + ' ' + styles.textPrimary} />
                    </label>
                    <button type="button" disabled={!name.trim()} onClick={save} className="min-h-10 rounded bg-emerald-500 px-4 text-xs font-bold text-slate-950 disabled:opacity-50">Save view</button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    {layouts.map((layout) => (
                        <span key={layout.id} className={'inline-flex min-h-10 items-center rounded border ' + styles.panelSolid}>
                            <button type="button" onClick={() => onApply(layout)} className={'min-h-10 px-3 text-xs font-semibold ' + styles.textSecondary}>{layout.name}</button>
                            <button type="button" onClick={() => persist(removeSavedResearchLayout(layouts, layout.id))} aria-label={`Remove saved view ${layout.name}`} className={'min-h-10 border-l px-2 text-xs ' + styles.divider + ' ' + styles.risk}>×</button>
                        </span>
                    ))}
                    {layouts.length === 0 ? <span className={'text-xs ' + styles.textMuted}>No saved views yet. Current workspace, filters, ticker, detail tab, and density are captured.</span> : null}
                </div>
            </div>
        </details>
    );
};
