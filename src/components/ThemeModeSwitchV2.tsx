export type ThemeMode = 'light' | 'dark';

type ThemeModeSwitchProps = {
    theme: ThemeMode;
    tone: ThemeMode;
    onToggle: () => void;
    className?: string;
    variant?: 'default' | 'header';
};

export const ThemeModeSwitchV2 = ({ theme, tone, onToggle, className = '', variant = 'default' }: ThemeModeSwitchProps) => {
    const isLightTone = tone === 'light';
    const isHeader = variant === 'header';
    const shellClass = isHeader
        ? 'border-[var(--border)] bg-transparent text-[var(--text-muted)]'
        : isLightTone
            ? 'border-[#cbd5e1] bg-white text-[#64748b] shadow-[0_10px_28px_rgba(15,23,42,0.06)]'
            : 'border-[#2a3948] bg-[#111a23] text-[#9aa8b8] shadow-[0_12px_30px_rgba(0,0,0,0.2)]';
    const activeClass = isHeader
        ? 'bg-[var(--fill-success)] text-[var(--on-success)]'
        : isLightTone
            ? 'bg-[#ecfdf5] text-[#047857] shadow-sm ring-1 ring-inset ring-[#a7f3d0]'
            : 'bg-emerald-300 text-slate-950 shadow-[0_0_0_1px_rgba(167,243,208,0.18)]';
    const inactiveClass = isHeader
        ? 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
        : isLightTone
            ? 'text-[#64748b] hover:text-[#0f172a] hover:bg-slate-50'
            : 'text-[#9aa8b8] hover:text-[#eef2f7] hover:bg-slate-800/40';
    const rootClass = 'inline-grid grid-cols-2 items-center rounded-xl border p-1 text-[11px] font-bold uppercase tracking-[0.14em] transition-all duration-300 active:scale-[0.98]';
    const optionClass = 'rounded-lg px-2 py-2 transition-all duration-300 sm:px-3';

    if (isHeader) {
        return (
            <button
                type="button"
                onClick={onToggle}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-pressed={theme === 'dark'}
                title={theme === 'dark' ? 'Dark mode active. Switch to light mode' : 'Light mode active. Switch to dark mode'}
                className={`relative inline-flex h-7 w-[52px] items-center rounded-full border-[0.5px] border-[var(--border)] bg-transparent p-1 transition-all duration-300 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${className}`}
            >
                <span aria-hidden="true" className={`absolute inset-1 rounded-full transition-colors ${isLightTone ? 'bg-slate-200/70' : 'bg-slate-950/35'}`} />
                <span
                    aria-hidden="true"
                    className={`relative z-10 grid h-5 w-5 place-items-center rounded-full transition-transform duration-300 ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'} ${isLightTone ? 'bg-emerald-600 text-white' : 'bg-emerald-300 text-slate-950'}`}
                >
                    <ThemeModeGlyph theme={theme} />
                </span>
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={onToggle}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-pressed={theme === 'dark'}
            className={`${rootClass} ${shellClass} ${className}`}
        >
            <span className={`${optionClass} ${theme === 'light' ? activeClass : inactiveClass}`}>Light</span>
            <span className={`${optionClass} ${theme === 'dark' ? activeClass : inactiveClass}`}>Dark</span>
        </button>
    );
};

const ThemeModeGlyph = ({ theme }: { theme: ThemeMode }) => theme === 'dark' ? (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13.1 10.9A5.8 5.8 0 0 1 5.1 2.9a5.8 5.8 0 1 0 8 8Z" />
    </svg>
) : (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="2.5" />
        <path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.4 3.4l.9.9M11.7 11.7l.9.9M12.6 3.4l-.9.9M4.3 11.7l-.9.9" />
    </svg>
);
