import { getThemeV6, type ResearchThemeV6 } from './research-v6';

export type ResearchWorkspaceV6 = 'research' | 'compare' | 'discovery' | 'alerts';

export const ResearchWorkspaceTabsV6 = ({ active, theme, onChange }: {
    readonly active: ResearchWorkspaceV6;
    readonly theme: ResearchThemeV6;
    readonly onChange: (workspace: ResearchWorkspaceV6) => void;
}) => {
    const styles = getThemeV6(theme);
    const tabs: readonly { readonly id: ResearchWorkspaceV6; readonly label: string }[] = [
        { id: 'research', label: 'Research' }, { id: 'discovery', label: 'Discovery' },
        { id: 'compare', label: 'Compare' }, { id: 'alerts', label: 'Alerts' },
    ];
    return (
        <div className="research-scrollbar mb-3 max-w-full overflow-x-auto">
            <div role="tablist" aria-label="Research workspace" className={'flex w-fit rounded border p-1 ' + styles.panel}>
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        id={`research-workspace-tab-${tab.id}`}
                        role="tab"
                        aria-selected={active === tab.id}
                        aria-controls={`research-workspace-${tab.id}`}
                        type="button"
                        onClick={() => onChange(tab.id)}
                        className={'min-h-10 rounded px-3 text-xs font-semibold ' + (active === tab.id ? styles.selectedRow : styles.textMuted)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>
    );
};
