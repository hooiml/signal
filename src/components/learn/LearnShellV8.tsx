'use client';

import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { CommandPaletteV6, type AppCommandV6 } from '@/components/v6/CommandPaletteV6';
import { setV8ThemeChoice } from '@/components/v8/V8ThemeControl';
import { V8Settings } from '@/components/v8/V8Settings';
import base from '@/components/v8/market-v8.module.css';
import styles from './learn-v8.module.css';

// The existing command dialog follows the same resolved theme as the V8 header.
function subscribeTheme(notify: () => void) {
    const observer = new MutationObserver(notify);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-v8-theme'] });
    return () => observer.disconnect();
}
const readTheme = (): 'dark' | 'light' => document.documentElement.dataset.v8Theme === 'dark' ? 'dark' : 'light';

export function LearnShellV8({ children, commands, footer }: {
    children: ReactNode; commands: readonly AppCommandV6[]; footer: ReactNode;
}) {
    const [paletteOpen, setPaletteOpen] = useState(false);
    const theme = useSyncExternalStore(subscribeTheme, readTheme, (): 'light' => 'light');
    const allCommands: readonly AppCommandV6[] = [
        { id: 'route-start', label: 'Go to Start', group: 'Route', keywords: ['guide onboarding today'], run: () => window.location.assign('/start') },
        { id: 'route-learn', label: 'Go to Learn', group: 'Route', keywords: ['education valuation pe replay'], run: () => window.location.assign('/learn') },
        { id: 'theme-toggle', label: `Use ${theme === 'light' ? 'dark' : 'light'} theme`, group: 'Appearance', keywords: ['theme mode'], run: () => setV8ThemeChoice(theme === 'light' ? 'dark' : 'light') },
        ...commands,
    ];
    return <div className={`${base.tokens} ${styles.shell}`} data-testid="learn-shell">
        <a className={styles.skipLink} href="#learn-content">Skip to lesson</a>
        <header className={`${base.header} ${styles.header}`} aria-label="Signal application header">
            <a className={base.logo} href="/main-v8">∿ Signal</a>
            <nav aria-label="Primary"><a href="/main-v8">Market</a><a href="/research-v8">Research</a><a href="/learn" aria-current="page">Learn</a></nav>
            <V8Settings />
        </header>
        <div className={styles.utility}><span>Learn · Understand the evidence</span><button type="button" onClick={() => setPaletteOpen(true)} aria-label="Open command palette">Commands <kbd>Ctrl K</kbd></button></div>
        {children}
        <footer className={styles.footer}>{footer}</footer>
        <CommandPaletteV6 commands={allCommands} theme={theme} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>;
}
