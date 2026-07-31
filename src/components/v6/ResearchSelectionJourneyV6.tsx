import type { PickerSelectionTrace } from '@/lib/research/picker';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type JourneyStatus = 'pending' | 'available' | 'next' | 'current' | 'complete' | 'unavailable';

type JourneyStep = {
    readonly id: 'scan' | 'filter' | 'risk' | 'shortlist' | 'research' | 'measure';
    readonly label: string;
    readonly status: JourneyStatus;
    readonly detail: string;
};

const statusLabel: Readonly<Record<JourneyStatus, string>> = {
    pending: 'Pending',
    available: 'Available',
    next: 'Available next',
    current: 'In progress',
    complete: 'Complete',
    unavailable: 'Unavailable',
};

const journeySteps = (
    runStatus: 'setup' | 'loading' | 'ready' | 'error',
    trace: PickerSelectionTrace | null,
    basketAvailable: boolean,
): readonly JourneyStep[] => {
    if (runStatus !== 'ready' || trace === null) {
        return [
            { id: 'scan', label: 'Scan', status: runStatus === 'loading' ? 'current' : runStatus === 'error' ? 'unavailable' : 'next', detail: runStatus === 'loading' ? 'Scanning current data' : runStatus === 'error' ? 'Retry the scan' : 'Run the Picker' },
            { id: 'filter', label: 'Filter', status: 'pending', detail: 'Apply saved policy' },
            { id: 'risk', label: 'Risk-check', status: 'pending', detail: 'Apply risk and score' },
            { id: 'shortlist', label: 'Shortlist', status: 'pending', detail: 'Apply diversification' },
            { id: 'research', label: 'Research', status: 'pending', detail: 'Open a candidate' },
            { id: 'measure', label: 'Measure', status: 'pending', detail: 'Start a paper basket' },
        ];
    }

    const hasCandidates = trace.counts.shortlisted > 0;
    return [
        { id: 'scan', label: 'Scan', status: 'complete', detail: `${trace.counts.scanned} scanned` },
        { id: 'filter', label: 'Filter', status: 'complete', detail: `${trace.counts.policyEligible} policy eligible` },
        { id: 'risk', label: 'Risk-check', status: 'complete', detail: `${trace.counts.riskScoreEligible} eligible` },
        { id: 'shortlist', label: 'Shortlist', status: 'complete', detail: `${trace.counts.shortlisted} selected` },
        { id: 'research', label: 'Research', status: hasCandidates ? 'next' : 'unavailable', detail: hasCandidates ? 'Open a candidate' : 'No candidate to open' },
        { id: 'measure', label: 'Measure', status: basketAvailable ? 'available' : hasCandidates ? 'pending' : 'unavailable', detail: basketAvailable ? 'Basket tracking' : hasCandidates ? 'Start a paper basket' : 'No basket available' },
    ];
};

export const ResearchSelectionJourneyV6 = ({ theme, runStatus, trace, basketAvailable }: {
    readonly theme: ResearchThemeV6;
    readonly runStatus: 'setup' | 'loading' | 'ready' | 'error';
    readonly trace: PickerSelectionTrace | null;
    readonly basketAvailable: boolean;
}) => {
    const styles = getThemeV6(theme);
    const steps = journeySteps(runStatus, trace, basketAvailable);
    const toneFor = (status: JourneyStatus) => status === 'complete'
        ? styles.selectedRow
        : status === 'available' || status === 'next' || status === 'current'
            ? styles.panelAction
            : styles.panelUtility;

    return (
        <section data-testid="picker-journey" className={'mt-4 rounded-lg border p-3 ' + styles.panelSecondary} aria-labelledby="picker-journey-title">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <p className={'text-xs font-semibold uppercase tracking-[0.08em] ' + styles.textMuted}>Current research journey</p>
                    <h2 id="picker-journey-title" className={'mt-1 text-sm font-bold ' + styles.textPrimary}>From current scan to measured observation</h2>
                </div>
                <p className={'text-xs ' + styles.textMuted}>Stages describe workflow state, not investment confidence.</p>
            </div>
            <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                {steps.map((step, index) => (
                    <li
                        key={step.id}
                        data-testid={`picker-stage-${step.id}`}
                        data-status={step.status}
                        aria-current={step.status === 'current' ? 'step' : undefined}
                        className={'min-w-0 rounded-md border p-3 ' + toneFor(step.status)}
                    >
                        <span className={'block text-xs font-semibold uppercase tracking-[0.06em] ' + styles.textMuted}>{index + 1}. {step.label}</span>
                        <span className={'mt-2 block text-xs font-bold uppercase ' + (step.status === 'unavailable' ? styles.risk : step.status === 'complete' || step.status === 'available' || step.status === 'next' ? styles.positive : styles.textSecondary)}>{statusLabel[step.status]}</span>
                        <span className={'mt-1 block text-xs leading-5 ' + styles.textSecondary}>{step.detail}</span>
                    </li>
                ))}
            </ol>
            <p data-testid="picker-funnel-summary" role="status" aria-live="polite" className={'mt-3 min-h-5 text-xs font-semibold ' + styles.textSecondary}>
                {runStatus === 'loading'
                    ? 'Scanning the current Discovery universe…'
                    : runStatus === 'error'
                        ? 'The current scan is unavailable. Retry to continue the journey.'
                        : trace
                            ? `${trace.counts.scanned} scanned → ${trace.counts.policyEligible} policy eligible → ${trace.counts.riskScoreEligible} passed risk and score → ${trace.counts.shortlisted} shortlisted`
                            : 'Run the Picker to explain each stage with current deterministic counts.'}
            </p>
        </section>
    );
};
