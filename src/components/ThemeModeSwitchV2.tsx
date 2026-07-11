export type ThemeMode = 'light' | 'dark';

type ThemeModeSwitchProps = {
    theme: ThemeMode;
    tone: ThemeMode;
    onToggle: () => void;
    className?: string;
};

export const ThemeModeSwitchV2 = ({ theme, tone, onToggle, className = '' }: ThemeModeSwitchProps) => {
    const isLightTone = tone === 'light';
    const shellClass = isLightTone
        ? 'border-[#cbd5e1] bg-white text-[#64748b] shadow-[0_10px_28px_rgba(15,23,42,0.06)]'
        : 'border-[#2a3948] bg-[#111a23] text-[#9aa8b8] shadow-[0_12px_30px_rgba(0,0,0,0.2)]';
    const activeClass = isLightTone
        ? 'bg-[#ecfdf5] text-[#047857] shadow-sm ring-1 ring-inset ring-[#a7f3d0]'
        : 'bg-emerald-300 text-slate-950 shadow-[0_0_0_1px_rgba(167,243,208,0.18)]';
    const inactiveClass = isLightTone
        ? 'text-[#64748b] hover:text-[#0f172a] hover:bg-slate-50'
        : 'text-[#9aa8b8] hover:text-[#eef2f7] hover:bg-slate-800/40';

    return (
        <button
            type="button"
            onClick={onToggle}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-pressed={theme === 'dark'}
            className={`inline-grid grid-cols-2 items-center rounded-xl border p-1 text-[11px] font-bold uppercase tracking-[0.14em] transition-all duration-300 active:scale-[0.98] ${shellClass} ${className}`}
        >
            <span className={`rounded-lg px-2 py-2 transition-all duration-300 sm:px-3 ${theme === 'light' ? activeClass : inactiveClass}`}>Light</span>
            <span className={`rounded-lg px-2 py-2 transition-all duration-300 sm:px-3 ${theme === 'dark' ? activeClass : inactiveClass}`}>Dark</span>
        </button>
    );
};
