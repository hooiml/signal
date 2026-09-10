'use client';

import { usePathname } from 'next/navigation';
import styles from './version-switcher.module.css';

const routes = {
    '/main-v6': { version: 6, experience: 'Market' },
    '/main-v7': { version: 7, experience: 'Market' },
    '/main-v8': { version: 8, experience: 'Market' },
    '/research': { version: 7, experience: 'Research' },
    '/research-v6': { version: 6, experience: 'Research' },
    '/research-v7': { version: 7, experience: 'Research' },
    '/research-v8': { version: 8, experience: 'Research' },
} as const;

export function VersionSwitcher() {
    const pathname = usePathname();
    const current = routes[pathname as keyof typeof routes];
    if (!current) return null;

    const prefix = current.experience === 'Research' ? 'research' : 'main';
    return <nav className={styles.bar} aria-label="UI versions">
        <div className={styles.inner}>
            <span className={styles.label}>{current.experience}<span> · UI version</span></span>
            <div className={styles.versions}>
                {[6, 7, 8].map(version => <a key={version} href={`/${prefix}-v${version}`} aria-current={current.version === version ? 'page' : undefined} title={`Open ${current.experience} V${version}${version === 7 ? ' — previous homepage design' : version === 8 ? ' — default design' : ''}`}>
                    <b>V{version}</b>{version === 7 && <span>Previous home</span>}{version === 8 && <span>Default</span>}
                </a>)}
            </div>
        </div>
    </nav>;
}
