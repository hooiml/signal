import { getThemeV6, type ResearchThemeV6 } from './research-v6';

export type ResearchWorkspaceV6 = 'research' | 'discovery' | 'alerts';

export const ResearchWorkspaceTabsV6 = ({ active, theme, onChange }: {
    readonly active: ResearchWorkspaceV6;
    readonly theme: ResearchThemeV6;
    readonly onChange: (workspace: ResearchWorkspaceV6) => void;
}) => {
    const styles = getThemeV6(theme);
    const tabs: readonly { readonly id: ResearchWorkspaceV6; readonly label: string }[] = [
        { id: 'research', label: 'Research' }, { id: 'discovery', label: 'Discovery' }, { id: 'alerts', label: 'Alerts' },
    ];
    return (
        <div className={'mb-3 flex w-fit rounded border p-1 ' + styles.panel}>
            {tabs.map((tab) => (
                <button key={tab.id} type="button" onClick={() => onChange(tab.id)} className={'rounded px-3 py-1.5 text-xs font-semibold ' + (active === tab.id ? styles.selectedRow : styles.textMuted)}>{tab.label}</button>
            ))}
        </div>
    );
};
