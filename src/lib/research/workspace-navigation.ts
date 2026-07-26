import type { ResearchLayoutWorkspace } from './saved-layouts';

export type ResearchWorkspaceGroupId =
    | 'watchlist'
    | 'discovery'
    | 'activity'
    | 'analyze'
    | 'portfolio'
    | 'review'
    | 'more';

export type ResearchWorkspaceNavigationItem = {
    readonly id: ResearchLayoutWorkspace;
    readonly label: string;
};

export type ResearchWorkspaceNavigationGroup = {
    readonly id: ResearchWorkspaceGroupId;
    readonly label: string;
    readonly defaultWorkspace: ResearchLayoutWorkspace;
    readonly items: readonly ResearchWorkspaceNavigationItem[];
};

export const researchWorkspaceGroups: readonly ResearchWorkspaceNavigationGroup[] = [
    {
        id: 'watchlist',
        label: 'Watchlist',
        defaultWorkspace: 'research',
        items: [{ id: 'research', label: 'Watchlist' }],
    },
    {
        id: 'discovery',
        label: 'Discovery',
        defaultWorkspace: 'discovery',
        items: [
            { id: 'discovery', label: 'Market scan' },
            { id: 'picker', label: 'Picker' },
        ],
    },
    {
        id: 'activity',
        label: 'Activity',
        defaultWorkspace: 'queue',
        items: [
            { id: 'queue', label: 'Queue' },
            { id: 'alerts', label: 'Alerts' },
            { id: 'calendar', label: 'Calendar' },
            { id: 'changes', label: 'Changes' },
            { id: 'filings', label: 'Filings' },
        ],
    },
    {
        id: 'analyze',
        label: 'Analyze',
        defaultWorkspace: 'compare',
        items: [
            { id: 'compare', label: 'Compare' },
            { id: 'peers', label: 'Peers' },
            { id: 'relationships', label: 'Map' },
            { id: 'currency', label: 'Currency' },
        ],
    },
    {
        id: 'portfolio',
        label: 'Portfolio',
        defaultWorkspace: 'portfolio',
        items: [{ id: 'portfolio', label: 'Portfolio' }],
    },
    {
        id: 'review',
        label: 'Review',
        defaultWorkspace: 'evidence',
        items: [
            { id: 'evidence', label: 'Evidence' },
            { id: 'policy', label: 'Policy' },
            { id: 'outcomes', label: 'Outcomes' },
            { id: 'replay', label: 'Replay' },
        ],
    },
    {
        id: 'more',
        label: 'More',
        defaultWorkspace: 'health',
        items: [
            { id: 'health', label: 'Sources' },
            { id: 'packets', label: 'Export' },
            { id: 'backup', label: 'Backup' },
            { id: 'usage', label: 'Usage' },
        ],
    },
];

export const researchWorkspaceGroupFor = (
    workspace: ResearchLayoutWorkspace,
): ResearchWorkspaceNavigationGroup => {
    const group = researchWorkspaceGroups.find((candidate) =>
        candidate.items.some((item) => item.id === workspace));
    if (!group) throw new Error(`Research workspace navigation is missing ${workspace}.`);
    return group;
};
