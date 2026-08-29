'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { ResearchValuationReasoningV9 } from './ResearchValuationReasoningV9';

export const ResearchValuationDockV9 = () => {
    const searchParams = useSearchParams();
    const requested = searchParams.get('ticker')?.trim().toUpperCase();
    const ticker = requested && /^[A-Z0-9.-]{1,20}$/.test(requested) ? requested : 'MSFT';
    const [host, setHost] = useState<HTMLElement | null>(null);

    useEffect(() => {
        let mountedHost: HTMLElement | null = null;
        const mount = () => {
            const anchor = document.querySelector<HTMLElement>('[data-testid="since-last-visit"]');
            if (!anchor?.parentElement || mountedHost) return Boolean(mountedHost);
            mountedHost = document.createElement('div');
            mountedHost.dataset.testid = 'valuation-reasoning-slot';
            const expectationSlot = anchor.parentElement.querySelector<HTMLElement>('[data-testid="expectation-reality-slot"]');
            const memorySlot = anchor.parentElement.querySelector<HTMLElement>('[data-testid="research-memory-dock-slot"]');
            const prior = expectationSlot ?? memorySlot ?? anchor;
            prior.insertAdjacentElement('afterend', mountedHost);
            setHost(mountedHost);
            return true;
        };
        if (!mount()) {
            const observer = new MutationObserver(() => {
                if (mount()) observer.disconnect();
            });
            observer.observe(document.body, { childList: true, subtree: true });
            return () => { observer.disconnect(); setHost(null); mountedHost?.remove(); };
        }
        return () => { setHost(null); mountedHost?.remove(); };
    }, []);

    return host ? createPortal(<ResearchValuationReasoningV9 ticker={ticker} />, host) : null;
};
