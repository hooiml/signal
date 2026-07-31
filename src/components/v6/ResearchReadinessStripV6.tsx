'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import { assessInvestmentPolicy, type InvestmentPolicy } from '@/lib/research/investment-policy';
import {
    INVESTMENT_POLICY_CHANGE_EVENT,
    readInvestmentPolicy,
} from '@/lib/research/investment-policy-client';
import {
    buildResearchReadiness,
    type ResearchReadinessDestination,
    type ResearchReadinessTone,
} from '@/lib/research/readiness';
import type { ResearchRecord } from '@/lib/types/research';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

export const ResearchReadinessStripV6 = ({ record, ticker, records, items, theme, onNavigate }: {
    readonly record: ResearchRecord;
    readonly ticker: ResearchWatchlistItem;
    readonly records: readonly ResearchRecord[];
    readonly items: readonly ResearchWatchlistItem[];
    readonly theme: ResearchThemeV6;
    readonly onNavigate: (destination: ResearchReadinessDestination) => void;
}) => {
    const styles = getThemeV6(theme);
    const [policy, setPolicy] = useState<InvestmentPolicy | null>(null);

    useEffect(() => {
        const refresh = () => setPolicy(readInvestmentPolicy());
        const timer = window.setTimeout(refresh, 0);
        window.addEventListener(INVESTMENT_POLICY_CHANGE_EVENT, refresh);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener(INVESTMENT_POLICY_CHANGE_EVENT, refresh);
        };
    }, []);

    const policyAssessment = useMemo(() => policy === null ? null : assessInvestmentPolicy(records.map((candidate) => ({
        record: candidate,
        sector: items.find((item) => item.symbol === candidate.symbol)?.sector ?? 'Unclassified',
    })), policy).find((assessment) => assessment.symbol === record.symbol) ?? null, [items, policy, record.symbol, records]);
    const readiness = useMemo(() => buildResearchReadiness({
        record,
        sector: ticker.sector,
        policyAssessment,
    }), [policyAssessment, record, ticker.sector]);
    const tone = (value: ResearchReadinessTone) => value === 'ready'
        ? styles.positive
        : value === 'attention'
            ? styles.risk
            : styles.textMuted;

    return (
        <section data-testid="research-readiness-strip" className={'mt-3 rounded-lg border p-2 sm:mt-4 sm:p-3 ' + styles.panelSecondary} aria-labelledby="research-readiness-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className={'hidden text-[10px] font-semibold uppercase tracking-[0.08em] sm:block ' + styles.textMuted}>{readiness.context}</p>
                    <h3 id="research-readiness-title" className={'text-sm font-bold sm:mt-1 ' + styles.textPrimary}>Research readiness</h3>
                    <p className={'mt-1 hidden text-xs sm:block ' + styles.textMuted}>Saved-state gaps only; this is not a recommendation or readiness score.</p>
                </div>
                <button data-testid="research-readiness-next" type="button" onClick={() => onNavigate(readiness.nextGap.destination)} className={'min-h-9 max-w-full rounded-md border px-2 text-left text-xs sm:min-h-10 sm:px-3 ' + styles.panelAction}>
                    <span className={'block font-bold ' + styles.textPrimary}>Review next gap: {readiness.nextGap.label}</span>
                    <span className={'mt-0.5 hidden leading-4 sm:block ' + styles.textMuted}>{readiness.nextGap.detail}</span>
                </button>
            </div>
            <details data-testid="research-readiness-details" className={'group mt-2 border-t pt-1 sm:mt-3 sm:pt-2 ' + styles.divider}>
                <summary className={'flex min-h-8 cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold sm:min-h-9 [&::-webkit-details-marker]:hidden ' + styles.textSecondary}>
                    <span>Review all 7 readiness signals</span>
                    <span aria-hidden="true" className={'text-base transition-transform group-open:rotate-45 ' + styles.textMuted}>+</span>
                </summary>
                <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {readiness.items.map((item) => (
                        <li key={item.id}>
                            <button data-testid={`research-readiness-${item.id}`} type="button" onClick={() => onNavigate(item.destination)} className={'h-full min-h-20 w-full rounded-md border p-3 text-left ' + styles.row}>
                                <span className={'block text-[10px] font-semibold uppercase ' + styles.textMuted}>{item.label}</span>
                                <span className={'mt-1 block text-xs font-bold capitalize ' + tone(item.tone)}>{item.status}</span>
                                <span className={'mt-1 block text-[11px] leading-4 ' + styles.textMuted}>{item.detail}</span>
                            </button>
                        </li>
                    ))}
                </ul>
                <p data-testid="research-readiness-method" className={'mt-2 text-xs leading-5 ' + styles.textMuted}>Fixed precedence: incomplete thesis/checklist → evidence gaps or conflicts → unknown valuation → saved-policy violations → no enabled structured trigger → missing or overdue next review → incomplete position plan. No AI model or composite score is used.</p>
            </details>
        </section>
    );
};
