import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import { researchAvailability } from '@/lib/research/reading-display';
import styles from './research-v8-connected.module.css';

export function ResearchDataAvailability({ snapshot, section, loading, error }: {
    snapshot: ResearchSnapshot | null; section: 'Financials' | 'Valuation'; loading: boolean; error: boolean;
}) {
    if (!snapshot) return null;
    const note = researchAvailability(snapshot, section);
    if (!note) return null;
    return <section className={styles.availabilityNote} aria-label={`${section} availability`}>
        <h3>{note.heading}</h3>
        {(loading || error) && <p>These gaps describe the retained response, not a newly completed refresh.</p>}
        <p>{note.detail}</p>
        <details><summary>Why these values are unavailable</summary>{note.reasons.map(reason => <p key={reason}>{reason}</p>)}
            <p>Refresh provider data retries the existing sources; it does not guarantee additional coverage. Available values remain separate from these gaps.</p>
        </details>
    </section>;
}
