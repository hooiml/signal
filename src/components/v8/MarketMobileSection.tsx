'use client';

import { useId, useState, type ReactNode } from 'react';
import styles from './market-mobile-section.module.css';

/** Phone disclosures keep their content mounted and remain fully visible on larger screens. */
export function MarketMobileSection({ name, title, summary, className, id, open, onOpenChange, children }: {
    name: string;
    title: string;
    summary: string;
    className?: string;
    id?: string;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: ReactNode;
}) {
    const bodyId = useId();
    const [localOpen, setLocalOpen] = useState(false);
    const expanded = open ?? localOpen;
    return <section id={id} className={`${styles.section} ${className ?? ''}`} data-testid={`market-mobile-${name}`} data-expanded={expanded} aria-label={title}>
        <h2 className={styles.heading}><button type="button" aria-expanded={expanded} aria-controls={bodyId} onClick={() => (onOpenChange ?? setLocalOpen)(!expanded)}>
            <span><b>{title}</b><span className={styles.summary}>{summary}</span></span><span className={styles.chevron} aria-hidden="true">{expanded ? '−' : '+'}</span>
        </button></h2>
        <div id={bodyId} className={styles.body} data-mobile-section-body onFocusCapture={() => {
            // Keep a focused desktop link visible if the viewport becomes a phone layout.
            if (!expanded) (onOpenChange ?? setLocalOpen)(true);
        }}>{children}</div>
    </section>;
}
