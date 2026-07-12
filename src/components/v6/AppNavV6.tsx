import Link from 'next/link';
import type { ResearchThemeV6 } from './research-v6';

type AppNavV6Props = {
    active: 'market' | 'research';
    theme: ResearchThemeV6;
};

export const AppNavV6 = ({ active, theme }: AppNavV6Props) => {
    const isLight = theme === 'light';
    const items = [
        { key: 'market', label: 'Market', href: '/' },
        { key: 'research', label: 'Research', href: '/research' },
    ] as const;
    const brandClass = 'text-sm font-bold uppercase tracking-[0.18em] ' + (isLight ? 'text-slate-950' : 'text-[#eef2f7]');
    const navClass = 'flex items-center gap-1 rounded-lg border p-1 ' + (isLight ? 'border-slate-300 bg-white/90' : 'border-[#2a3948] bg-[#111a23]/90');

    return (
        <nav className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 px-4 pt-4 min-[700px]:px-5" aria-label="Primary">
            <Link href="/" className={brandClass}>Signal</Link>
            <div className={navClass}>
                {items.map((item) => {
                    const selected = item.key === active;
                    const selectedClass = isLight ? 'bg-slate-950 text-white' : 'bg-emerald-300 text-slate-950';
                    const idleClass = isLight ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-950' : 'text-[#9aa8b8] hover:bg-slate-800/50 hover:text-[#eef2f7]';
                    return (
                        <Link
                            key={item.key}
                            href={item.href}
                            aria-current={selected ? 'page' : undefined}
                            className={'rounded-md px-3 py-2 text-sm font-semibold transition-colors ' + (selected ? selectedClass : idleClass)}
                        >
                            {item.label}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};
