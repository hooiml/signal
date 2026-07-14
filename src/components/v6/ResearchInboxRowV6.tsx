'use client';

import type { ReactNode } from 'react';
import type { ResearchInboxItem } from '@/lib/types/research-inbox';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type ResearchInboxRowV6Props = {
    readonly item: ResearchInboxItem;
    readonly theme: ResearchThemeV6;
    readonly unread: boolean;
    readonly change: string | null;
    readonly thesisChanges: readonly string[];
    readonly snoozed: boolean;
    readonly menuOpen: boolean;
    readonly onOpen: () => void;
    readonly onToggleMenu: () => void;
    readonly onMarkSeen: () => void;
    readonly onSnooze: (days: number) => void;
    readonly onWake: () => void;
    readonly workflow: ReactNode;
};

const categoryLabel = (item: ResearchInboxItem): string => {
    if (item.kind === 'risk') return 'Risk';
    if (item.kind === 'opportunity') return 'Opportunity';
    if (item.kind === 'catalyst') return 'Catalyst';
    return 'Stale review';
};

export const ResearchInboxRowV6 = ({ item, theme, unread, change, thesisChanges, snoozed, menuOpen, onOpen, onToggleMenu, onMarkSeen, onSnooze, onWake, workflow }: ResearchInboxRowV6Props) => {
    const styles = getThemeV6(theme);
    const tone = item.kind === 'risk' ? styles.risk : item.kind === 'opportunity' ? styles.positive : styles.textSecondary;
    return (
        <li className={'border-b py-3 ' + styles.divider}>
            <div className="relative min-[700px]:grid min-[700px]:grid-cols-[minmax(0,1fr)_auto] min-[700px]:items-start min-[700px]:gap-2">
                <button type="button" onClick={onOpen} aria-label={`Open ${item.symbol} research: ${item.title}`} className="min-h-10 w-full min-w-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 min-[700px]:grid min-[700px]:grid-cols-[88px_110px_minmax(0,1fr)] min-[700px]:gap-2">
                    <span className={'inline-flex items-center gap-2 font-mono text-sm font-bold min-[700px]:flex ' + styles.textPrimary}>
                        {unread && <span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />}{item.symbol}
                    </span>
                    <span className={'ml-3 inline text-xs font-semibold min-[700px]:ml-0 min-[700px]:block ' + tone}>{categoryLabel(item)}</span>
                    <span className="mt-2 block min-w-0 min-[700px]:mt-0">
                        <span className={'block text-sm font-semibold ' + styles.textPrimary}>{item.title}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2">
                            <span className={'text-xs font-semibold leading-5 ' + styles.textSecondary}>{item.proximity}</span>
                            <span className={'text-xs min-[700px]:hidden ' + styles.textMuted}>{item.source}{item.eventDate ? ` · ${item.eventDate}` : ''}</span>
                        </span>
                        {change && unread && <span className={'mt-1 block text-xs font-semibold leading-5 ' + styles.positive}>{change}</span>}
                        {thesisChanges.length > 0 && <span className={'mt-1 block text-xs leading-5 ' + styles.textSecondary}>Saved thesis · {thesisChanges.join(' · ')}</span>}
                        <span className={'mt-1 block line-clamp-1 text-xs leading-5 min-[700px]:line-clamp-none ' + styles.textMuted}>{item.detail}</span>
                        <span className={'mt-1 hidden text-xs min-[700px]:block ' + styles.textMuted}>{item.source}{item.eventDate ? ` · ${item.eventDate}` : ''}</span>
                    </span>
                </button>
                <button type="button" aria-expanded={menuOpen} aria-label={`Manage ${item.symbol} inbox item`} onClick={onToggleMenu} className={'absolute right-0 top-0 min-h-10 rounded border px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 min-[700px]:static ' + styles.row}>
                    Manage
                </button>
            </div>
            {menuOpen && <div className={'mt-2 rounded border p-2 min-[700px]:ml-[198px] ' + styles.row}>
                <div className="flex flex-wrap gap-1">
                {unread && <button type="button" onClick={onMarkSeen} className={'min-h-10 rounded px-3 text-xs font-semibold ' + styles.selectedRow}>Mark seen</button>}
                {snoozed ? <button type="button" onClick={onWake} className={'min-h-10 rounded px-3 text-xs font-semibold ' + styles.selectedRow}>Wake now</button> : <>
                    <button type="button" onClick={() => onSnooze(1)} className={'min-h-10 rounded px-3 text-xs font-semibold ' + styles.textSecondary}>Snooze 1 day</button>
                    <button type="button" onClick={() => onSnooze(7)} className={'min-h-10 rounded px-3 text-xs font-semibold ' + styles.textSecondary}>Snooze 7 days</button>
                </>}
                <button type="button" onClick={onOpen} className={'min-h-10 rounded px-3 text-xs font-semibold ' + styles.textSecondary}>Open research</button>
                </div>
                {workflow}
            </div>}
        </li>
    );
};
