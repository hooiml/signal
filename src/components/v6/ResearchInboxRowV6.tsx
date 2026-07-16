import type { ResearchInboxItem } from '@/lib/types/research-inbox';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type ResearchInboxRowV6Props = {
    readonly item: ResearchInboxItem;
    readonly theme: ResearchThemeV6;
    readonly unread: boolean;
    readonly change: string | null;
    readonly onOpen: () => void;
    readonly className?: string;
};

export const researchInboxCategoryLabel = (item: ResearchInboxItem): string => {
    if (item.kind === 'risk') return 'Risk';
    if (item.kind === 'opportunity') return 'Opportunity';
    if (item.kind === 'catalyst') return 'Catalyst';
    return 'Stale review';
};

export const ResearchInboxRowV6 = ({ item, theme, unread, change, onOpen, className = '' }: ResearchInboxRowV6Props) => {
    const styles = getThemeV6(theme);
    const tone = item.kind === 'risk' ? styles.risk : item.kind === 'opportunity' ? styles.positive : styles.textSecondary;
    return (
        <li className={'rounded border px-3 py-2 ' + styles.divider + ' ' + className}>
            <button type="button" onClick={onOpen} aria-label={`Open ${item.symbol} research: ${item.title}`} className="min-h-10 w-full min-w-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500">
                <span className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <span className={'text-sm font-semibold ' + styles.textPrimary}>{item.title}</span>
                    <span className={'inline-flex items-center gap-1.5 text-xs font-semibold ' + tone}>
                        {unread && <span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />}
                        {researchInboxCategoryLabel(item)}
                    </span>
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2">
                    <span className={'text-xs font-semibold leading-5 ' + styles.textSecondary}>{item.proximity}</span>
                    <span className={'text-xs ' + styles.textMuted}>{item.source}{item.eventDate ? ` · ${item.eventDate}` : ''}</span>
                </span>
                {change && unread && <span className={'mt-1 block text-xs font-semibold leading-5 ' + styles.positive}>{change}</span>}
                <span className={'mt-1 block line-clamp-1 text-xs leading-5 ' + styles.textMuted}>{item.detail}</span>
            </button>
        </li>
    );
};
