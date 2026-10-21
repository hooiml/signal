'use client';

import { ownerAccessMessage, ownerUnlockHref, type OwnerAccessIssue } from '@/lib/owner-access-client';

export function OwnerAccessNotice({ issue, resource, preserveDraft = false, saveLabel = 'Save', onRetry }: {
    readonly issue: OwnerAccessIssue;
    readonly resource: string;
    readonly preserveDraft?: boolean;
    readonly saveLabel?: string;
    readonly onRetry?: () => void;
}) {
    const returnTo = typeof window === 'undefined' ? '/research-v8' : window.location.pathname + window.location.search + window.location.hash;
    return (
        <div role="status" data-testid="owner-access-notice" data-owner-access-issue={issue} className="mt-3 rounded-lg border border-amber-600/50 p-3 text-xs">
            <strong className="block">{resource} {issue === 'locked' ? 'is locked' : 'is unavailable'}</strong>
            <p className="mt-1">{ownerAccessMessage(issue)}</p>
            {preserveDraft && <p className="mt-2">Your draft remains in this tab and has not been saved. {issue === 'locked' ? `Unlock in a new tab, then return here and select “${saveLabel}” again.` : `After owner access is configured, select “${saveLabel}” again.`}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
                {issue === 'locked' && <a href={ownerUnlockHref(returnTo)} target={preserveDraft ? '_blank' : undefined} rel={preserveDraft ? 'noopener noreferrer' : undefined} className="inline-flex min-h-11 items-center rounded-lg border border-emerald-600 px-3 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-emerald-500">{preserveDraft ? 'Unlock Signal in a new tab' : 'Unlock Signal'}</a>}
                {onRetry && <button type="button" onClick={onRetry} className="min-h-11 rounded-lg border border-zinc-700 px-3 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-emerald-500">Retry saved research</button>}
            </div>
        </div>
    );
}
