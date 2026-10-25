'use client';

import { Suspense, useSyncExternalStore } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { legacyMarketAnchors } from '@/lib/legacy-routes';
import styles from './version-switcher.module.css';

const routes = {
    '/main-v8': { tools: false, experience: 'Market', reading: '/main-v8', advanced: '/market/tools' },
    '/market/tools': { tools: true, experience: 'Market', reading: '/main-v8', advanced: '/market/tools' },
    '/research': { tools: true, experience: 'Research', reading: '/research-v8', advanced: '/research' },
    '/research-v8': { tools: false, experience: 'Research', reading: '/research-v8', advanced: '/research' },
} as const;

type Props = { placement?: 'top' | 'footer'; context?: Record<string, string> };

const readHash = () => window.location.hash;
const serverHash = () => '';
function subscribeHash(listener: () => void) {
    window.addEventListener('hashchange', listener);
    window.addEventListener('popstate', listener);
    return () => {
        window.removeEventListener('hashchange', listener);
        window.removeEventListener('popstate', listener);
    };
}

export function WorkspaceNavigation(props: Props) {
    return <Suspense fallback={null}><WorkspaceLinks {...props} /></Suspense>;
}

function WorkspaceLinks({ placement = 'top', context = {} }: Props) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const currentHash = useSyncExternalStore(subscribeHash, readHash, serverHash);
    const current = routes[pathname as keyof typeof routes];
    if (!current || searchParams.get('demo') === '1' || (current.tools ? placement === 'footer' : placement === 'top')) return null;

    function href(path: string) {
        let hash = currentHash;
        const params = new URLSearchParams(searchParams.toString());
        for (const [key, value] of Object.entries(context)) {
            // Keep repeated link values when the selected value has not changed.
            if (params.get(key) !== value) params.set(key, value);
        }
        if (path === '/research' && !params.has('workspace')) params.append('workspace', 'research');
        // Choosing the overview explicitly leaves a tool-only section behind.
        if (path === '/main-v8' && legacyMarketAnchors.has(hash.slice(1))) hash = '';
        return path + (params.size ? `?${params}` : '') + hash;
    }
    return <nav className={`${styles.bar} ${placement === 'footer' ? styles.footer : ''}`} aria-label="Workspace views">
        <div className={styles.inner}>
            <span className={styles.label}>{current.experience}</span>
            <div className={styles.versions}>
                <a href={href(current.reading)} aria-current={!current.tools ? 'page' : undefined}>Reading view</a>
                <a href={href(current.advanced)} aria-current={current.tools ? 'page' : undefined}>Advanced tools</a>
            </div>
        </div>
    </nav>;
}
