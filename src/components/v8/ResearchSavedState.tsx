import { ownerAccessMessage, type OwnerAccessIssue } from '@/lib/owner-access-client';
import base from './market-v8.module.css';
import connected from './research-v8-connected.module.css';

export function ResearchSavedState({ loading, error, issue, hasRecords, unlockHref, onRetry }: {
    loading: boolean;
    error: boolean;
    issue: OwnerAccessIssue | null;
    hasRecords: boolean;
    unlockHref: string;
    onRetry: () => void;
}) {
    return <div role="status">
        {loading ? <p>Refreshing saved research…</p> : issue ? <p className={connected.warning}>
            {ownerAccessMessage(issue)}{' '}
            {issue === 'locked' && <a className={base.textButton} href={unlockHref}>Unlock Signal</a>}
        </p> : error ? <p className={connected.warning}>
            Saved research could not be refreshed. {hasRecords ? 'Previously loaded records remain visible.' : 'Your public reading remains available.'}{' '}
            <button className={base.textButton} onClick={onRetry}>Retry saved research</button>
        </p> : null}
    </div>;
}
