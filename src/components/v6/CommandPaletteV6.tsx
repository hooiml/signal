'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ResearchThemeV6 } from './research-v6';

export type AppCommandV6 = {
    readonly id: string;
    readonly label: string;
    readonly group: string;
    readonly keywords?: readonly string[];
    readonly run: () => void;
};

export const CommandPaletteV6 = ({ commands, theme, open, onOpenChange }: {
    readonly commands: readonly AppCommandV6[];
    readonly theme: ResearchThemeV6;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
}) => {
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const triggerRef = useRef<HTMLElement | null>(null);
    const isLight = theme === 'light';
    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return commands;
        return commands.filter((command) => `${command.label} ${command.group} ${(command.keywords ?? []).join(' ')}`.toLowerCase().includes(needle));
    }, [commands, query]);
    const safeActiveIndex = Math.min(activeIndex, Math.max(0, filtered.length - 1));

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                if (!open) triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
                setQuery('');
                setActiveIndex(0);
                onOpenChange(!open);
            } else if (open && event.key === 'Escape') {
                event.preventDefault();
                setQuery('');
                setActiveIndex(0);
                onOpenChange(false);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onOpenChange, open]);

    useEffect(() => {
        if (open) {
            window.setTimeout(() => inputRef.current?.focus(), 0);
        } else {
            triggerRef.current?.focus();
            triggerRef.current = null;
        }
    }, [open]);

    if (!open) return null;
    const execute = (command: AppCommandV6 | undefined) => {
        if (!command) return;
        setQuery('');
        setActiveIndex(0);
        onOpenChange(false);
        command.run();
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-950/55 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
                setQuery('');
                setActiveIndex(0);
                onOpenChange(false);
            }
        }}>
            <section role="dialog" aria-modal="true" aria-label="Signal command palette" className={'w-full max-w-2xl overflow-hidden rounded-xl border shadow-2xl ' + (isLight ? 'border-slate-200 bg-white' : 'border-[#344454] bg-[#0d151d]')}>
                <label className={'flex items-center gap-3 border-b px-4 ' + (isLight ? 'border-slate-200' : 'border-[#263442]')}>
                    <span aria-hidden="true" className={isLight ? 'text-slate-400' : 'text-slate-500'}>⌕</span>
                    <span className="sr-only">Search commands</span>
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
                        onKeyDown={(event) => {
                            if (event.key === 'ArrowDown') {
                                event.preventDefault();
                                setActiveIndex((current) => filtered.length ? (current + 1) % filtered.length : 0);
                            } else if (event.key === 'ArrowUp') {
                                event.preventDefault();
                                setActiveIndex((current) => filtered.length ? (current - 1 + filtered.length) % filtered.length : 0);
                            } else if (event.key === 'Enter') {
                                event.preventDefault();
                                execute(filtered[safeActiveIndex]);
                            }
                        }}
                        placeholder="Search routes, tickers, workspaces, or saved layouts"
                        className={'h-14 min-w-0 flex-1 bg-transparent text-base outline-none ' + (isLight ? 'text-slate-950 placeholder:text-slate-400' : 'text-slate-100 placeholder:text-slate-500')}
                    />
                    <kbd className={'rounded border px-2 py-1 text-[10px] ' + (isLight ? 'border-slate-200 text-slate-500' : 'border-slate-700 text-slate-400')}>ESC</kbd>
                </label>
                <div role="listbox" aria-label="Commands" className="research-scrollbar max-h-[55vh] overflow-y-auto p-2">
                    {filtered.map((command, index) => (
                        <button
                            key={command.id}
                            type="button"
                            role="option"
                            aria-selected={index === safeActiveIndex}
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => execute(command)}
                            className={'flex min-h-12 w-full items-center justify-between gap-4 rounded-lg px-3 text-left text-sm transition-colors ' + (index === safeActiveIndex
                                ? 'bg-emerald-500 text-slate-950'
                                : isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-200 hover:bg-slate-800')}
                        >
                            <span className="font-semibold">{command.label}</span>
                            <span className={'shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] ' + (index === safeActiveIndex ? 'text-slate-800' : isLight ? 'text-slate-400' : 'text-slate-500')}>{command.group}</span>
                        </button>
                    ))}
                    {filtered.length === 0 ? <p className={'px-3 py-8 text-center text-sm ' + (isLight ? 'text-slate-500' : 'text-slate-400')}>No matching commands.</p> : null}
                </div>
                <p className={'border-t px-4 py-2 text-[10px] ' + (isLight ? 'border-slate-200 text-slate-500' : 'border-[#263442] text-slate-500')}>↑↓ choose · Enter run · Esc close</p>
            </section>
        </div>
    );
};
