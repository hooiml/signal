'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { ResearchTab } from './research-v8-connected-data';
import base from './market-v8.module.css';
import styles from './research-v8.module.css';

export const researchTabId = (value: ResearchTab) => `connected-tab-${value === 'Chart & technicals' ? 'Chart' : value}`;

export function ResearchInvestigationTabs({ tabs, activeTab, onChange }: {
    tabs: readonly ResearchTab[];
    activeTab: ResearchTab;
    onChange: (tab: ResearchTab) => void;
}) {
    const listRef = useRef<HTMLDivElement>(null);
    const [scroll, setScroll] = useState({ left: false, right: false });

    useEffect(() => {
        const list = listRef.current;
        if (!list) return;
        const update = () => {
            const left = list.scrollLeft > 1;
            const right = list.scrollWidth - list.clientWidth - list.scrollLeft > 1;
            setScroll(previous => previous.left === left && previous.right === right ? previous : { left, right });
        };
        const revealSelected = () => {
            const selected = list.querySelector<HTMLElement>('[aria-selected="true"]');
            if (selected) {
                const frame = list.getBoundingClientRect(), tab = selected.getBoundingClientRect();
                const delta = tab.left < frame.left ? tab.left - frame.left : tab.right > frame.right ? tab.right - frame.right : 0;
                // Move only this strip; opening a deep link must not jump the page past the quote.
                if (delta) list.scrollBy({ left: delta, behavior: 'instant' });
            }
            update();
        };
        const observer = new ResizeObserver(revealSelected);
        observer.observe(list);
        for (const tab of list.children) observer.observe(tab);
        list.addEventListener('scroll', update, { passive: true });
        revealSelected();
        return () => { observer.disconnect(); list.removeEventListener('scroll', update); };
    }, [activeTab, tabs.length]);

    function tabKeys(event: KeyboardEvent<HTMLDivElement>) {
        const index = tabs.indexOf(activeTab);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : null;
        if (next === null) return;
        event.preventDefault();
        onChange(tabs[next]);
        listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus({ preventScroll: true });
    }

    function scrollTabs(direction: number) {
        const list = listRef.current;
        if (list) list.scrollBy({ left: direction * list.clientWidth * 0.8, behavior: 'instant' });
    }

    return <div className={styles.tabNavigation} data-testid="research-tab-navigation" data-overflow={scroll.left || scroll.right}>
        <button type="button" className={styles.tabScrollButton} aria-label="Scroll research tabs left" aria-controls="research-investigation-tabs" disabled={!scroll.left} onClick={() => scrollTabs(-1)}><span aria-hidden="true">‹</span></button>
        <div ref={listRef} id="research-investigation-tabs" className={`${base.tabs} ${styles.tabs}`} role="tablist" aria-label="Research investigation" onKeyDown={tabKeys}>
            {tabs.map(value => <button type="button" id={researchTabId(value)} role="tab" aria-selected={activeTab === value} aria-controls="connected-panel" tabIndex={activeTab === value ? 0 : -1} key={value} onClick={() => onChange(value)}>{value}</button>)}
        </div>
        <button type="button" className={styles.tabScrollButton} aria-label="Scroll research tabs right" aria-controls="research-investigation-tabs" disabled={!scroll.right} onClick={() => scrollTabs(1)}><span aria-hidden="true">›</span></button>
    </div>;
}
