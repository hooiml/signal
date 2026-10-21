import { useEffect, useState } from 'react';
import { nextHorizontalTabIndex } from '@/lib/research/tab-navigation';
import { researchLayoutWorkspaces, type ResearchLayoutWorkspace } from '@/lib/research/saved-layouts';
import {
    researchWorkspaceGroupFor,
    researchWorkspaceGroups,
    type ResearchWorkspaceGroupId,
} from '@/lib/research/workspace-navigation';
import {
    parsePinnedResearchWorkspaces,
    researchPinnedWorkspaceLimit,
    researchPinnedWorkspacesStorageKey,
    togglePinnedResearchWorkspace,
    type ResearchWorkspaceAttention,
} from '@/lib/research/workspace-pins';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

export type ResearchWorkspaceV6 = ResearchLayoutWorkspace;

export const isResearchWorkspaceV6 = (value: string | null): value is ResearchWorkspaceV6 =>
    value !== null && researchLayoutWorkspaces.some((workspace) => workspace === value);

const workspaceLabel = (workspace: ResearchWorkspaceV6) =>
    researchWorkspaceGroupFor(workspace).items.find((item) => item.id === workspace)?.label ?? workspace;

const readPins = (): readonly ResearchWorkspaceV6[] =>
    parsePinnedResearchWorkspaces(JSON.parse(window.localStorage.getItem(researchPinnedWorkspacesStorageKey) ?? '[]'));

const AttentionBadge = ({ attention }: { readonly attention: ResearchWorkspaceAttention | undefined }) => attention ? (
    <span data-testid="research-workspace-attention" title={attention.label} className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full border border-current px-1.5 text-[11px] font-bold leading-4">
        <span aria-hidden="true">{attention.count}</span><span className="sr-only">{attention.label}</span>
    </span>
) : null;

export const ResearchWorkspaceTabsV6 = ({ active, theme, onChange, attention = {} }: {
    readonly active: ResearchWorkspaceV6;
    readonly theme: ResearchThemeV6;
    readonly onChange: (workspace: ResearchWorkspaceV6) => void;
    readonly attention?: Partial<Record<ResearchWorkspaceV6, ResearchWorkspaceAttention>>;
}) => {
    const styles = getThemeV6(theme);
    const activeGroup = researchWorkspaceGroupFor(active);
    // Pins are a browser-local convenience; storage failures leave navigation unchanged.
    const [pins, setPins] = useState<readonly ResearchWorkspaceV6[]>([]);
    // Until browser storage is read (after hydration), show no pin state rather than a false "None yet".
    const [pinsLoaded, setPinsLoaded] = useState(false);
    useEffect(() => {
        try {
            setPins(readPins());
        } catch {
            setPins([]);
        } finally {
            setPinsLoaded(true);
        }
        const refresh = (event: StorageEvent) => {
            if (event.key !== researchPinnedWorkspacesStorageKey) return;
            try { setPins(readPins()); } catch { setPins([]); }
        };
        window.addEventListener('storage', refresh);
        return () => window.removeEventListener('storage', refresh);
    }, []);
    const savePins = (next: readonly ResearchWorkspaceV6[]) => {
        setPins(next);
        try { window.localStorage.setItem(researchPinnedWorkspacesStorageKey, JSON.stringify(next)); } catch { /* pins stay for this page view */ }
    };
    const activePinned = pins.includes(active);
    const pinLimitReached = !activePinned && pins.length >= researchPinnedWorkspaceLimit;
    const optionLabel = (workspace: ResearchWorkspaceV6, label: string) => attention[workspace] ? `${label} · ${attention[workspace].label}` : label;
    const changeGroup = (groupId: ResearchWorkspaceGroupId) => {
        const group = researchWorkspaceGroups.find((candidate) => candidate.id === groupId);
        if (group) onChange(group.defaultWorkspace);
    };

    return (
        <div className="mb-3 max-w-full">
            <div data-testid="research-pinned-workspaces" className="mb-2 flex min-h-9 min-w-0 flex-wrap items-center gap-1.5 text-xs">
                <span className={'font-semibold ' + styles.textMuted}>Pinned</span>
                {!pinsLoaded ? null : <>{pins.length === 0 ? <span className={styles.textMuted}>None yet · pin up to {researchPinnedWorkspaceLimit} workspaces</span> : pins.map((pin) => (
                    <button
                        key={pin}
                        type="button"
                        aria-current={active === pin ? 'page' : undefined}
                        onClick={() => onChange(pin)}
                        className={'inline-flex min-h-9 items-center rounded border px-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ' + (active === pin ? styles.selectedRow : styles.panelUtility + ' ' + styles.textPrimary)}
                    >
                        {workspaceLabel(pin)}<AttentionBadge attention={attention[pin]} />
                    </button>
                ))}
                <button
                    type="button"
                    aria-pressed={activePinned}
                    disabled={pinLimitReached}
                    title={pinLimitReached ? `Unpin a workspace first; up to ${researchPinnedWorkspaceLimit} can be pinned.` : undefined}
                    onClick={() => savePins(togglePinnedResearchWorkspace(pins, active))}
                    className={'min-h-9 rounded px-2 font-semibold underline underline-offset-2 disabled:no-underline disabled:opacity-60 ' + styles.textMuted}
                >
                    {activePinned ? `Unpin ${workspaceLabel(active)}` : pinLimitReached ? `${researchPinnedWorkspaceLimit} pinned (limit)` : `Pin ${workspaceLabel(active)}`}
                </button>
                {pins.length > 0 ? (
                    <button type="button" onClick={() => savePins([])} className={'min-h-9 rounded px-2 font-semibold underline underline-offset-2 ' + styles.textMuted}>Clear pins</button>
                ) : null}</>}
            </div>
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
                            {activeGroup.items.map((item) => <option key={item.id} value={item.id}>{optionLabel(item.id, item.label)}</option>)}
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
                            {item.label}<AttentionBadge attention={attention[item.id]} />
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
};
