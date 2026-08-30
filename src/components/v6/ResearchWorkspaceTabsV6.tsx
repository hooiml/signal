import { nextHorizontalTabIndex } from '@/lib/research/tab-navigation';
import { researchLayoutWorkspaces, type ResearchLayoutWorkspace } from '@/lib/research/saved-layouts';
import {
    researchWorkspaceGroupFor,
    researchWorkspaceGroups,
    type ResearchWorkspaceGroupId,
} from '@/lib/research/workspace-navigation';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

export type ResearchWorkspaceV6 = ResearchLayoutWorkspace;

export const isResearchWorkspaceV6 = (value: string | null): value is ResearchWorkspaceV6 =>
    value !== null && researchLayoutWorkspaces.some((workspace) => workspace === value);

export const ResearchWorkspaceTabsV6 = ({ active, theme, onChange }: {
    readonly active: ResearchWorkspaceV6;
    readonly theme: ResearchThemeV6;
    readonly onChange: (workspace: ResearchWorkspaceV6) => void;
}) => {
    const styles = getThemeV6(theme);
    const activeGroup = researchWorkspaceGroupFor(active);
    const changeGroup = (groupId: ResearchWorkspaceGroupId) => {
        const group = researchWorkspaceGroups.find((candidate) => candidate.id === groupId);
        if (group) onChange(group.defaultWorkspace);
    };

    return (
        <div className="mb-3 max-w-full">
            <div className="grid gap-2 min-[700px]:hidden">
                <label>
                    <span className="sr-only">Research section</span>
                    <select
                        aria-label="Research section"
                        value={activeGroup.id}
                        onChange={(event) => changeGroup(event.target.value as ResearchWorkspaceGroupId)}
                        className={'h-11 w-full rounded border px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ' + styles.panelUtility + ' ' + styles.textPrimary}
                    >
                        {researchWorkspaceGroups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
                    </select>
                </label>
                {activeGroup.items.length > 1 ? (
                    <label>
                        <span className="sr-only">{activeGroup.label} workspace</span>
                        <select
                            aria-label={`${activeGroup.label} workspace`}
                            value={active}
                            onChange={(event) => onChange(event.target.value as ResearchWorkspaceV6)}
                            className={'h-11 w-full rounded border px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ' + styles.panelUtility + ' ' + styles.textPrimary}
                        >
                            {activeGroup.items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                        </select>
                    </label>
                ) : null}
            </div>
            <nav
                aria-label="Research sections"
                data-surface-tier="utility"
                className={'hidden grid-cols-6 rounded border p-1 min-[700px]:grid ' + styles.panelUtility}
            >
                {researchWorkspaceGroups.map((group, index) => (
                    <button
                        key={group.id}
                        id={`research-section-${group.id}`}
                        aria-current={activeGroup.id === group.id ? 'page' : undefined}
                        type="button"
                        onClick={() => onChange(group.defaultWorkspace)}
                        onKeyDown={(event) => {
                            const container = event.currentTarget.parentElement;
                            if (!(container instanceof HTMLElement)) return;
                            const nextIndex = nextHorizontalTabIndex(index, event.key, researchWorkspaceGroups.length);
                            if (nextIndex === null) return;
                            const nextGroup = researchWorkspaceGroups[nextIndex];
                            if (!nextGroup) return;
                            event.preventDefault();
                            onChange(nextGroup.defaultWorkspace);
                            container.querySelector<HTMLButtonElement>(`#research-section-${nextGroup.id}`)?.focus();
                        }}
                        className={'min-h-10 min-w-0 rounded px-2 text-xs font-semibold ' + (activeGroup.id === group.id ? styles.selectedRow : styles.textMuted)}
                    >
                        {group.label}
                    </button>
                ))}
            </nav>
            {activeGroup.items.length > 1 ? (
                <div
                    role="tablist"
                    aria-label={`${activeGroup.label} workspaces`}
                    className={'mt-2 hidden min-h-11 flex-wrap items-center gap-1 rounded border p-1 min-[700px]:flex ' + styles.panelUtility}
                >
                    {activeGroup.items.map((item, index) => (
                        <button
                            key={item.id}
                            id={`research-workspace-tab-${item.id}`}
                            role="tab"
                            aria-selected={active === item.id}
                            aria-controls={`research-workspace-${item.id}`}
                            tabIndex={active === item.id ? 0 : -1}
                            type="button"
                            onClick={() => onChange(item.id)}
                            onKeyDown={(event) => {
                                const container = event.currentTarget.parentElement;
                                if (!(container instanceof HTMLDivElement)) return;
                                const nextIndex = nextHorizontalTabIndex(index, event.key, activeGroup.items.length);
                                if (nextIndex === null) return;
                                const nextItem = activeGroup.items[nextIndex];
                                if (!nextItem) return;
                                event.preventDefault();
                                onChange(nextItem.id);
                                container.querySelector<HTMLButtonElement>(`#research-workspace-tab-${nextItem.id}`)?.focus();
                            }}
                            className={'min-h-9 rounded px-3 text-xs font-semibold ' + (active === item.id ? styles.selectedRow : styles.textMuted)}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
};
