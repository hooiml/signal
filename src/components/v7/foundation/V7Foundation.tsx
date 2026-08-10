'use client';

import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { useThemeV6 } from '@/components/v6/ThemeProviderV6';
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
};

const ThemeGlyph = ({ theme }: { readonly theme: 'light' | 'dark' }) => theme === 'light' ? (
    <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.64 5.64l1.42 1.42m9.88 9.88 1.42 1.42M18.36 5.64l-1.42 1.42M7.06 16.94l-1.42 1.42" /><circle cx="12" cy="12" r="3.5" /></svg>
) : (
    <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 15.2A8 8 0 0 1 8.8 4 8 8 0 1 0 20 15.2Z" /></svg>
);

const V7PrimaryNavigation = ({ active, mobile = false }: { readonly active: V7Workspace; readonly mobile?: boolean }) => (
    <nav className={mobile ? styles.mobileNav : styles.primaryNav} aria-label={mobile ? 'Primary mobile' : 'Primary'}>
        <Link href="/main-v7" prefetch={false} aria-current={active === 'market' ? 'page' : undefined}>Market</Link>
        <Link href="/research-v7" prefetch={false} aria-current={active === 'research' ? 'page' : undefined}>Research</Link>
    </nav>
);

export const V7Shell = ({ active, controls, children, footer, testId }: V7ShellProps) => {
    const { theme, toggleTheme } = useThemeV6();
    const workspaceName = active === 'market' ? 'Market' : 'Research';

    return (
        <div className={styles.scope} data-testid={testId} data-theme={theme}>
            <div className={styles.window}>
                <header className={styles.header}>
                    <div className={styles.headerPrimary}>
                        <Link className={styles.wordmark} href="/main-v7" prefetch={false}>Signal</Link>
                        <V7PrimaryNavigation active={active} />
                        <button className={styles.themeButton} type="button" onClick={toggleTheme} aria-label={`Use ${theme === 'light' ? 'dark' : 'light'} theme`}>
                            <ThemeGlyph theme={theme} />
                            <span>{theme === 'light' ? 'Light' : 'Dark'}</span>
                        </button>
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
