/** Public error state only. This module never reads or stores the owner secret. */
export type OwnerAccessIssue = 'locked' | 'unconfigured';

export const ownerAccessIssue = (status: number, code?: unknown): OwnerAccessIssue | null =>
    status === 401 ? 'locked'
        : status === 503 && code === 'OWNER_ACCESS_UNCONFIGURED' ? 'unconfigured' : null;

export const ownerAccessMessage = (issue: OwnerAccessIssue): string => issue === 'locked'
    ? 'Saved research is locked on this browser. Unlock to view or save your research.'
    : 'Saved research is unavailable because owner access has not been configured on this deployment. Public readings remain available.';

export const safeOwnerReturnPath = (value: string | null | undefined): string => {
    if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return '/research-v8';
    try {
        const url = new URL(value, 'https://signal.invalid');
        return url.origin === 'https://signal.invalid' ? url.pathname + url.search + url.hash : '/research-v8';
    } catch { return '/research-v8'; }
};

export const ownerUnlockHref = (returnTo: string): string =>
    '/unlock?next=' + encodeURIComponent(safeOwnerReturnPath(returnTo));
