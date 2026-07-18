import { nextHorizontalTabIndex } from '@/lib/research/tab-navigation';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

export type ResearchWorkspaceV6 = 'research' | 'compare' | 'discovery' | 'calendar' | 'alerts';

export const isResearchWorkspaceV6 = (value: string | null): value is ResearchWorkspaceV6 =>
    value === 'research' || value === 'discovery' || value === 'compare' || value === 'calendar' || value === 'alerts';

export const ResearchWorkspaceTabsV6 = ({ active, theme, onChange }: {
    readonly active: ResearchWorkspaceV6;
    readonly theme: ResearchThemeV6;
    readonly onChange: (workspace: ResearchWorkspaceV6) => void;
}) => {
    const styles = getThemeV6(theme);
    const tabs: readonly { readonly id: ResearchWorkspaceV6; readonly label: string }[] = [
        { id: 'research', label: 'Watchlist' }, { id: 'discovery', label: 'Discovery' },
        { id: 'compare', label: 'Compare' }, { id: 'calendar', label: 'Calendar' }, { id: 'alerts', label: 'Alerts' },
    ];
    return (
        <div className="mb-3 max-w-full">
            <label className="block min-[700px]:hidden">
                <span className="sr-only">Research workspace</span>
                <select
                    aria-label="Research workspace"
                    value={active}
                    onChange={(event) => onChange(event.target.value as ResearchWorkspaceV6)}
                    className={'h-11 w-full rounded border px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ' + styles.panelUtility + ' ' + styles.textPrimary}
                >
                    {tabs.map((tab) => <option key={tab.id} value={tab.id}>{tab.label}</option>)}
                </select>
            </label>
            <div role="tablist" aria-label="Research workspace" data-surface-tier="utility" className={'hidden w-fit rounded border p-1 min-[700px]:flex ' + styles.panelUtility}>
                {tabs.map((tab, index) => (
                    <button
                        key={tab.id}
                        id={`research-workspace-tab-${tab.id}`}
                        role="tab"
                        aria-selected={active === tab.id}
                        aria-controls={`research-workspace-${tab.id}`}
                        tabIndex={active === tab.id ? 0 : -1}
                        type="button"
                        onClick={() => onChange(tab.id)}
                        onKeyDown={(event) => {
                            const container = event.currentTarget.parentElement;
                            if (!(container instanceof HTMLDivElement)) return;
                            const nextIndex = nextHorizontalTabIndex(index, event.key, tabs.length);
                            if (nextIndex === null) return;
                            const nextTab = tabs[nextIndex];
                            if (!nextTab) return;
                            event.preventDefault();
                            onChange(nextTab.id);
                            container.querySelector<HTMLButtonElement>(`#research-workspace-tab-${nextTab.id}`)?.focus();
                        }}
                        className={'min-h-10 rounded px-3 text-xs font-semibold ' + (active === tab.id ? styles.selectedRow : styles.textMuted)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>
    );
};
