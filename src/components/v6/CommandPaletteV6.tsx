'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
    searchLocalResearchIndex,
    type LocalResearchSearchEntry,
    type LocalResearchSearchResult,
} from '@/lib/research/local-search';
import type { ResearchThemeV6 } from './research-v6';

export type AppCommandV6 = {
    readonly id: string;
    readonly label: string;
    readonly group: string;
    readonly keywords?: readonly string[];
    readonly run: () => void;
};

export type AppLocalSearchV6 = {
    readonly status: 'loading' | 'ready' | 'degraded' | 'error';
    readonly entries: readonly LocalResearchSearchEntry[];
    readonly message: string | null;
    readonly onSelect: (result: LocalResearchSearchResult) => void;
};

type PaletteCommandV6 = AppCommandV6 & {
    readonly description?: string;
    readonly destination?: string;
    readonly localResult?: boolean;
};

export const CommandPaletteV6 = ({ commands, localSearch, theme, open, onOpenChange }: {
    readonly commands: readonly AppCommandV6[];
    readonly localSearch?: AppLocalSearchV6;
    readonly theme: ResearchThemeV6;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
}) => {
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const dialogRef = useRef<HTMLElement>(null);
    const triggerRef = useRef<HTMLElement | null>(null);
    const isLight = theme === 'light';
    const localResponse = useMemo(
        () => localSearch ? searchLocalResearchIndex(localSearch.entries, query) : null,
        [localSearch, query],
    );
    const filtered = useMemo<readonly PaletteCommandV6[]>(() => {
        const needle = query.trim().toLowerCase();
        const matchingCommands = !needle
            ? commands
            : commands.filter((command) =>
                `${command.label} ${command.group} ${(command.keywords ?? []).join(' ')}`.toLowerCase().includes(needle));
        const merged = new Map<string, PaletteCommandV6>(matchingCommands.map((command) => [command.id, command]));
        for (const result of localResponse?.results ?? []) {
            merged.set(result.id, {
                id: result.id,
                label: result.label,
                group: result.group,
                keywords: [],
                description: result.snippet,
                destination: result.destinationLabel,
                localResult: true,
                run: () => localSearch?.onSelect(result),
            });
        }
        return [...merged.values()];
    }, [commands, localResponse?.results, localSearch, query]);
    const safeActiveIndex = Math.min(activeIndex, Math.max(0, filtered.length - 1));
    const grouped = useMemo(() => {
        const values = new Map<string, Array<{ readonly command: PaletteCommandV6; readonly index: number }>>();
        filtered.forEach((command, index) => {
            const group = values.get(command.group) ?? [];
            group.push({ command, index });
            values.set(command.group, group);
        });
        return [...values.entries()];
    }, [filtered]);

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
            } else if (open && event.key === 'Tab') {
                const dialog = dialogRef.current;
                if (!dialog) return;
                const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')]
                    .filter((element) => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true');
                const first = focusable[0];
                const last = focusable.at(-1);
                if (!first || !last) {
                    event.preventDefault();
                    inputRef.current?.focus();
                } else if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onOpenChange, open]);

    useEffect(() => {
        if (open) {
            if (!triggerRef.current && document.activeElement instanceof HTMLElement) {
                triggerRef.current = document.activeElement;
            }
            window.setTimeout(() => inputRef.current?.focus(), 0);
        } else {
            triggerRef.current?.focus();
            triggerRef.current = null;
        }
    }, [open]);

    useEffect(() => {
        if (!open || !overlayRef.current) return;
        const previousOverflow = document.body.style.overflow;
        const previousOverscroll = document.body.style.overscrollBehavior;
        const changed = new Map<HTMLElement, { readonly inert: boolean; readonly ariaHidden: string | null }>();
        let activeBranch: HTMLElement | null = overlayRef.current;
        while (activeBranch && activeBranch !== document.body) {
            const branchParent: HTMLElement | null = activeBranch.parentElement;
            if (!branchParent) break;
            for (const sibling of branchParent.children) {
                if (sibling === activeBranch || !(sibling instanceof HTMLElement) || changed.has(sibling)) continue;
                changed.set(sibling, { inert: sibling.inert, ariaHidden: sibling.getAttribute('aria-hidden') });
                sibling.inert = true;
                sibling.setAttribute('aria-hidden', 'true');
            }
            activeBranch = branchParent;
        }
        document.body.style.overflow = 'hidden';
        document.body.style.overscrollBehavior = 'none';
        return () => {
            for (const [element, previous] of changed) {
                element.inert = previous.inert;
                if (previous.ariaHidden === null) element.removeAttribute('aria-hidden');
                else element.setAttribute('aria-hidden', previous.ariaHidden);
            }
            document.body.style.overflow = previousOverflow;
            document.body.style.overscrollBehavior = previousOverscroll;
        };
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
        <div ref={overlayRef} className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-950/55 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
                setQuery('');
                setActiveIndex(0);
                onOpenChange(false);
            }
        }}>
            <section ref={dialogRef} role="dialog" aria-modal="true" aria-label="Signal command palette" className={'w-full max-w-2xl overflow-hidden rounded-xl border shadow-2xl ' + (isLight ? 'border-slate-200 bg-white' : 'border-[#344454] bg-[#0d151d]')}>
                <label className={'flex items-center gap-3 border-b px-4 ' + (isLight ? 'border-slate-200' : 'border-[#263442]')}>
                    <span aria-hidden="true" className={isLight ? 'text-slate-400' : 'text-slate-500'}>⌕</span>
                    <span className="sr-only">Search commands</span>
                    <input
                        ref={inputRef}
                        aria-controls="signal-command-palette-results"
                        aria-activedescendant={filtered[safeActiveIndex] ? `signal-command-${filtered[safeActiveIndex].id}` : undefined}
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
                        placeholder="Search commands or local research"
                        className={'h-14 min-w-0 flex-1 bg-transparent text-base outline-none ' + (isLight ? 'text-slate-950 placeholder:text-slate-400' : 'text-slate-100 placeholder:text-slate-500')}
                    />
                    <kbd className={'rounded border px-2 py-1 text-[10px] ' + (isLight ? 'border-slate-200 text-slate-500' : 'border-slate-700 text-slate-400')}>ESC</kbd>
                </label>
                <div id="signal-command-palette-results" role="listbox" aria-label="Commands and local research" className="research-scrollbar max-h-[55vh] overflow-y-auto p-2">
                    {query.trim() && query.trim().length < 2 && localSearch ? (
                        <p role="status" className={'px-3 py-2 text-xs ' + (isLight ? 'text-slate-500' : 'text-slate-400')}>
                            Type at least two characters to search saved research and Queue state.
                        </p>
                    ) : null}
                    {query.trim().length >= 2 && localSearch?.message ? (
                        <p role={localSearch.status === 'error' ? 'alert' : 'status'} className={'mx-1 mb-2 rounded border px-3 py-2 text-xs ' + (isLight ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-slate-700 bg-slate-900 text-slate-300')}>
                            {localSearch.message}
                        </p>
                    ) : null}
                    {grouped.map(([group, values]) => (
                        <div key={group} role="group" aria-labelledby={`signal-command-group-${group.replace(/\s+/g, '-').toLowerCase()}`} className="mb-2 last:mb-0">
                            <p id={`signal-command-group-${group.replace(/\s+/g, '-').toLowerCase()}`} className={'px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] ' + (isLight ? 'text-slate-400' : 'text-slate-500')}>{group}</p>
                            {values.map(({ command, index }) => (
                                <button
                                    id={`signal-command-${command.id}`}
                                    key={command.id}
                                    type="button"
                                    role="option"
                                    aria-selected={index === safeActiveIndex}
                                    data-command-id={command.id}
                                    data-local-search-result={command.localResult ? 'true' : undefined}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    onClick={() => execute(command)}
                                    className={'flex min-h-12 w-full min-w-0 items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ' + (index === safeActiveIndex
                                        ? 'bg-emerald-500 text-slate-950'
                                        : isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-200 hover:bg-slate-800')}
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block break-words font-semibold">{command.label}</span>
                                        {command.description ? <span className={'mt-0.5 block break-words text-xs leading-4 ' + (index === safeActiveIndex ? 'text-slate-800' : isLight ? 'text-slate-500' : 'text-slate-400')}>{command.description}</span> : null}
                                        {command.destination ? <span className={'mt-1 block text-[10px] font-bold uppercase tracking-[0.08em] ' + (index === safeActiveIndex ? 'text-slate-800' : isLight ? 'text-emerald-700' : 'text-emerald-300')}>Opens {command.destination}</span> : null}
                                    </span>
                                </button>
                            ))}
                        </div>
                    ))}
                    {localResponse?.truncated ? <p role="status" className={'px-3 py-2 text-xs ' + (isLight ? 'text-slate-500' : 'text-slate-400')}>Showing {localResponse.results.length} of {localResponse.totalMatches} deterministic local matches. Refine the query to narrow the result.</p> : null}
                    {filtered.length === 0 ? <p className={'px-3 py-8 text-center text-sm ' + (isLight ? 'text-slate-500' : 'text-slate-400')}>No matching commands or local research.</p> : null}
                </div>
                <p className={'border-t px-4 py-2 text-[10px] ' + (isLight ? 'border-slate-200 text-slate-500' : 'border-[#263442] text-slate-500')}>↑↓ choose · Enter run · Esc close</p>
            </section>
        </div>
    );
};
