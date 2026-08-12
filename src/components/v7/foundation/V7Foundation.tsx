'use client';

import Link from 'next/link';
import { useMemo, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { useThemeV6 } from '@/components/v6/ThemeProviderV6';
import { CommandPaletteV6, type AppCommandV6, type AppLocalSearchV6 } from '@/components/v6/CommandPaletteV6';
import styles from './v7-foundation.module.css';

export type V7Workspace = 'market' | 'research';
export type V7SurfaceTier = 'primary' | 'secondary' | 'utility' | 'action' | 'risk';
export type V7RowTone = 'neutral' | 'support' | 'caution' | 'risk';

type V7ShellProps = {
    readonly active: V7Workspace;
    readonly controls?: ReactNode;
    readonly children: ReactNode;
    readonly footer?: ReactNode;
    readonly testId?: string;
    readonly commands?: readonly AppCommandV6[];
    readonly localSearch?: AppLocalSearchV6;
};

const ThemeGlyph = ({ theme }: { readonly theme: 'light' | 'dark' }) => theme === 'light' ? (
    <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.64 5.64l1.42 1.42m9.88 9.88 1.42 1.42M18.36 5.64l-1.42 1.42M7.06 16.94l-1.42 1.42" /><circle cx="12" cy="12" r="3.5" /></svg>
) : (
    <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 15.2A8 8 0 0 1 8.8 4 8 8 0 1 0 20 15.2Z" /></svg>
);

const V7PrimaryNavigation = ({ active, mobile = false }: { readonly active: V7Workspace; readonly mobile?: boolean }) => (
    <nav className={mobile ? styles.mobileNav : styles.primaryNav} aria-label={mobile ? 'Primary mobile' : 'Primary'}>
        <Link href="/" prefetch={false} aria-current={active === 'market' ? 'page' : undefined}>Market</Link>
        <Link href="/research" prefetch={false} aria-current={active === 'research' ? 'page' : undefined}>Research</Link>
    </nav>
);

export const V7Shell = ({ active, controls, children, footer, testId, commands = [], localSearch }: V7ShellProps) => {
    const { theme, toggleTheme } = useThemeV6();
    const [paletteOpen, setPaletteOpen] = useState(false);
    const workspaceName = active === 'market' ? 'Market' : 'Research';
    const allCommands = useMemo<readonly AppCommandV6[]>(() => [
        { id: 'route-start', label: 'Go to Start', group: 'Route', keywords: ['guide onboarding today'], run: () => window.location.assign('/start') },
        { id: 'route-market', label: 'Go to Market', group: 'Route', keywords: ['home'], run: () => window.location.assign('/') },
        { id: 'route-research', label: 'Go to Research', group: 'Route', keywords: ['watchlist'], run: () => window.location.assign('/research') },
        { id: 'theme-toggle', label: `Use ${theme === 'light' ? 'dark' : 'light'} theme`, group: 'Appearance', keywords: ['theme mode'], run: toggleTheme },
        ...commands,
    ], [commands, theme, toggleTheme]);

    return (
        <div className={styles.scope} data-testid={testId} data-theme={theme}>
            <div className={styles.window}>
                <header className={styles.header}>
                    <div className={styles.headerPrimary}>
                        <Link className={styles.wordmark} href="/" prefetch={false}>Signal</Link>
                        <V7PrimaryNavigation active={active} />
                        <div className={styles.headerActions}>
                            <button className={styles.commandButton} type="button" onClick={() => setPaletteOpen(true)} aria-label="Open command palette">
                                <span className={styles.commandGlyph} aria-hidden="true">⌕</span><span className={styles.commandLabel}>Commands</span><kbd>Ctrl K</kbd>
                            </button>
                            <button className={styles.themeButton} type="button" onClick={toggleTheme} aria-label={`Use ${theme === 'light' ? 'dark' : 'light'} theme`}>
                                <ThemeGlyph theme={theme} />
                                <span>{theme === 'light' ? 'Light' : 'Dark'}</span>
                            </button>
                        </div>
                    </div>
                    <div className={styles.mobileNavRow}>
                        <V7PrimaryNavigation active={active} mobile />
                    </div>
                    {controls ? (
                        <div className={styles.routeControls} aria-label={`${workspaceName} controls`}>
                            {controls}
                        </div>
                    ) : null}
                </header>
                {children}
                {footer ? <footer className={styles.footer}>{footer}</footer> : null}
            </div>
            <CommandPaletteV6 commands={allCommands} localSearch={localSearch} theme={theme} open={paletteOpen} onOpenChange={setPaletteOpen} />
        </div>
    );
};

export const V7ControlGroup = ({ label, children }: { readonly label: ReactNode; readonly children: ReactNode }) => (
    <div className={styles.controlGroup}>
        <span>{label}</span>
        {children}
    </div>
);

export const V7StateChip = ({ children, strong = false }: { readonly children: ReactNode; readonly strong?: boolean }) => (
    <span className={styles.stateChip} data-emphasis={strong ? 'strong' : 'default'}>{children}</span>
);

type V7ButtonProps = ComponentPropsWithoutRef<'button'> & {
    readonly compactOnMobile?: boolean;
};

export const V7Button = ({ className, compactOnMobile = false, ...props }: V7ButtonProps) => (
    <button
        {...props}
        className={[styles.button, className].filter(Boolean).join(' ')}
        data-compact-mobile={compactOnMobile ? 'true' : undefined}
    />
);

type V7SurfaceProps = ComponentPropsWithoutRef<'section'> & {
    readonly tier?: V7SurfaceTier;
};

export const V7Surface = ({ className, tier = 'primary', ...props }: V7SurfaceProps) => (
    <section {...props} className={[styles.surface, className].filter(Boolean).join(' ')} data-tier={tier} />
);

export const V7FlatList = ({ className, ...props }: ComponentPropsWithoutRef<'div'>) => (
    <div {...props} className={[styles.flatList, className].filter(Boolean).join(' ')} role={props.role ?? 'list'} />
);

type V7FlatRowProps = ComponentPropsWithoutRef<'div'> & {
    readonly tone?: V7RowTone;
};

export const V7FlatRow = ({ className, tone = 'neutral', ...props }: V7FlatRowProps) => (
    <div
        {...props}
        className={[styles.flatRow, className].filter(Boolean).join(' ')}
        data-tone={tone}
        role={props.role ?? 'listitem'}
    />
);
