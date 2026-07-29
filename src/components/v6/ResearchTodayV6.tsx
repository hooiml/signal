'use client';

import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import type { SinceLastVisitAction } from '@/lib/research/since-last-visit';
import type { ResearchRecord } from '@/lib/types/research';
import type { ResearchInboxSummaryV6 } from './ResearchInboxV6';
import { SinceLastVisitBriefingV6 } from './SinceLastVisitBriefingV6';
import type { ResearchThemeV6 } from './research-v6';

export const ResearchTodayV6 = ({
    records,
    items,
    inboxSummary,
    theme,
    onOpenAction,
}: {
    readonly records: readonly ResearchRecord[];
    readonly items: readonly ResearchWatchlistItem[];
    readonly inboxSummary: ResearchInboxSummaryV6 | null;
    readonly theme: ResearchThemeV6;
    readonly onOpenAction: (action: SinceLastVisitAction) => void;
}) => (
    <section className="min-w-0 flex-1" aria-labelledby="research-today-title">
        <h1 id="research-today-title" className="sr-only">Today</h1>
        <SinceLastVisitBriefingV6
            records={records}
            items={items}
            inboxSummary={inboxSummary}
            theme={theme}
            onOpenAction={onOpenAction}
            variant="today"
        />
    </section>
);
