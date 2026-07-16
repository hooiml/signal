import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { ThemeModeSwitchV2 } from '@/components/ThemeModeSwitchV2';
import type { ResearchThemeV6 } from './research-v6';

type AppNavV6Props = {
    active: 'market' | 'research' | 'analytics';
    theme: ResearchThemeV6;
    onThemeToggle: () => void;
    children?: ReactNode;
};

export const AppNavV6 = ({ active, theme, onThemeToggle, children }: AppNavV6Props) => {
    const headerVars = {
        '--border': theme === 'light' ? 'rgba(15, 23, 42, 0.12)' : 'rgba(148, 163, 184, 0.22)',
        '--fill-success': theme === 'light' ? '#059669' : '#6ee7b7',
        '--on-success': theme === 'light' ? '#ffffff' : '#0f172a',
        '--text-primary': theme === 'light' ? '#0f172a' : '#eef2f7',
        '--text-secondary': theme === 'light' ? '#475569' : '#c8d2dd',
        '--text-muted': theme === 'light' ? '#64748b' : '#9aa8b8',
        '--radius': '8px',
    } as CSSProperties;
    const items = [
        { key: 'market', label: 'Market', href: '/' },
        { key: 'research', label: 'Research', href: '/research' },
        { key: 'analytics', label: 'Analytics', href: '/research?workspace=discovery' },
    ] as const;

    return (
        <header
            className="relative z-20 w-full border-b-[0.5px] border-[var(--border)] bg-transparent px-6"
            aria-label="Signal application header"
            style={headerVars}
        >
            <div className="mx-auto w-full max-w-[1280px]">
                <div className="grid min-h-14 min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 min-[700px]:grid-cols-[1fr_auto_1fr] min-[700px]:gap-5">
                    <Link
                        href="/"
                        className="shrink-0 text-[13px] font-medium uppercase tracking-[0.05em] text-[var(--text-primary)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                    >
                        SIGNAL
                    </Link>
                    <nav className="research-scrollbar flex min-w-0 items-center justify-end gap-3 overflow-x-auto min-[700px]:justify-center min-[700px]:gap-5" aria-label="Primary">
                        {items.map((item) => {
                            const selected = item.key === active;
                            return (
                                <Link
                                    key={item.key}
                                    href={item.href}
                                    aria-current={selected ? 'page' : undefined}
                                    className={
                                        'flex min-h-10 shrink-0 items-center border-b-2 px-0 text-[13px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 min-[700px]:px-1 min-[700px]:text-sm '
                                        + (selected
                                            ? 'border-[var(--fill-success)] text-[var(--text-primary)]'
                                            : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]')
                                    }
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>
                    <ThemeModeSwitchV2 theme={theme} tone={theme} onToggle={onThemeToggle} variant="header" className="shrink-0 justify-self-end" />
                </div>
                {children ? <div className="border-t-[0.5px] border-[var(--border)] py-2">{children}</div> : null}
            </div>
        </header>
    );
};
