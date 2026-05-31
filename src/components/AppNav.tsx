import Link from 'next/link';

type AppNavProps = {
    active: 'signal' | 'research';
    tone?: 'dark' | 'light';
    isV2?: boolean;
};

export const AppNav = ({ active, tone = 'dark', isV2 = false }: AppNavProps) => {
    const isDark = tone === 'dark';
    const activeDarkClass = 'bg-emerald-300 text-slate-950';
    const activeLightClass = 'bg-slate-950 text-slate-50';

    const items = isV2
        ? ([
              { key: 'signal', label: 'Signal V2', href: '/main-v2' },
              { key: 'research', label: 'Research V2', href: '/research-v2' },
          ] as const)
        : ([
              { key: 'signal', label: 'Signal', href: '/' },
              { key: 'research', label: 'Research', href: '/research' },
          ] as const);

    return (
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 pt-4 sm:px-6 lg:px-8" aria-label="Primary">
            <Link
                href={isV2 ? "/main-v2" : "/"}
                className={`text-sm font-bold uppercase tracking-[0.18em] ${isDark ? 'text-slate-100' : 'text-slate-950'}`}
            >
                Signal{isV2 && ' V2'}
            </Link>

            <div className={`flex items-center gap-1 rounded-lg border p-1 ${isDark ? 'border-[#2a3948] bg-[#111a23]' : 'border-slate-300 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.06)]'}`}>
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
                                        ? activeDarkClass
                                        : activeLightClass
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

