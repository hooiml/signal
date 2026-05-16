import Link from 'next/link';

type AppNavProps = {
    active: 'signal' | 'research';
    tone?: 'dark' | 'light';
};

const items = [
    { key: 'signal', label: 'Signal', href: '/' },
    { key: 'research', label: 'Research', href: '/research' },
] as const;

export const AppNav = ({ active, tone = 'dark' }: AppNavProps) => {
    const isDark = tone === 'dark';

    return (
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 pt-4 sm:px-6 lg:px-8" aria-label="Primary">
            <Link
                href="/"
                className={`text-sm font-bold uppercase tracking-[0.18em] ${isDark ? 'text-slate-100' : 'text-slate-950'}`}
            >
                Signal
            </Link>

            <div className={`flex items-center gap-1 rounded-lg border p-1 ${isDark ? 'border-slate-800 bg-slate-950/70' : 'border-slate-200 bg-white'}`}>
                {items.map((item) => {
                    const isActive = active === item.key;

                    return (
                        <Link
                            key={item.key}
                            href={item.href}
                            aria-current={isActive ? 'page' : undefined}
                            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                                isActive
                                    ? isDark
                                        ? 'bg-sky-400 text-slate-950'
                                        : 'bg-slate-950 text-white'
                                    : isDark
                                        ? 'text-slate-400 hover:text-slate-100'
                                        : 'text-slate-500 hover:text-slate-950'
                            }`}
                        >
                            {item.label}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};
