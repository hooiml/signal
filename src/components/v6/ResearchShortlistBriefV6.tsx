import {
    buildPickerCandidateBrief,
    buildPickerRejectionSummary,
    type PickerCandidate,
    type PickerSelectionTrace,
} from '@/lib/research/picker';
import type { QualityDiscoveryResult } from '@/lib/types/research-discovery';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

export const ResearchShortlistBriefV6 = ({ theme, candidates, trace, savedSymbols, adding, onAdd, onOpen }: {
    readonly theme: ResearchThemeV6;
    readonly candidates: readonly PickerCandidate[];
    readonly trace: PickerSelectionTrace;
    readonly savedSymbols: readonly string[];
    readonly adding: boolean;
    readonly onAdd: (candidate: QualityDiscoveryResult) => void;
    readonly onOpen: (symbol: string) => void;
}) => {
    const styles = getThemeV6(theme);
    const rejections = buildPickerRejectionSummary(trace);

    return (
        <>
            <div data-testid="picker-shortlist" className="mt-3 grid gap-3 xl:grid-cols-2">
                {candidates.map((candidate, index) => {
                    const saved = savedSymbols.includes(candidate.symbol);
                    const brief = buildPickerCandidateBrief(candidate);
                    return (
                        <article data-testid={`picker-candidate-${candidate.symbol}`} key={candidate.symbol} className={'rounded-lg border p-4 ' + styles.row}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className={'text-xs font-semibold uppercase ' + styles.textMuted}>#{index + 1} · {candidate.sector}</p>
                                    <h3 className={'mt-1 truncate text-lg font-bold ' + styles.textPrimary}>{candidate.symbol} <span className={'text-sm font-normal ' + styles.textSecondary}>{candidate.name}</span></h3>
                                </div>
                                <span data-testid={`picker-evidence-${candidate.symbol}`} className={'rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ' + styles.divider + ' ' + styles.textSecondary}>
                                    Evidence {brief.evidenceStatus}
                                </span>
                            </div>
                            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                                <div className={'rounded-md border p-3 ' + styles.panelSecondary}>
                                    <dt className={'text-[10px] font-semibold uppercase ' + styles.textMuted}>Strongest support</dt>
                                    <dd data-testid={`picker-support-${candidate.symbol}`} className={'mt-1 text-xs leading-5 ' + styles.textPrimary}>{brief.support}</dd>
                                </div>
                                <div className={'rounded-md border p-3 ' + styles.panelUtility}>
                                    <dt className={'text-[10px] font-semibold uppercase ' + styles.textMuted}>Principal risk or unknown</dt>
                                    <dd data-testid={`picker-risk-${candidate.symbol}`} className={'mt-1 text-xs leading-5 ' + styles.textPrimary}>{brief.riskOrUnknown}</dd>
                                </div>
                            </dl>
                            {candidate.policyAdjustment !== 0 ? (
                                <p data-testid={`picker-policy-adjustment-${candidate.symbol}`} className={'mt-3 text-xs font-semibold ' + styles.textSecondary}>
                                    Saved policy adjustment: {candidate.policyAdjustment >= 0 ? '+' : ''}{candidate.policyAdjustment.toFixed(1)} points
                                </p>
                            ) : null}
                            <details className={'group mt-3 rounded-md border ' + styles.divider}>
                                <summary className={'flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-semibold [&::-webkit-details-marker]:hidden ' + styles.textSecondary}>
                                    <span>Scores and selection detail</span>
                                    <span aria-hidden="true" className={'text-base transition-transform group-open:rotate-45 ' + styles.textMuted}>+</span>
                                </summary>
                                <div className={'border-t p-3 ' + styles.divider}>
                                    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        <div><dt className={'text-[10px] uppercase ' + styles.textMuted}>Discovery</dt><dd className={'mt-1 font-mono text-sm font-semibold ' + styles.textPrimary}>{candidate.discoveryScore}</dd></div>
                                        <div><dt className={'text-[10px] uppercase ' + styles.textMuted}>Trend</dt><dd className={'mt-1 font-mono text-sm font-semibold ' + styles.textPrimary}>{candidate.trendScore}</dd></div>
                                        <div><dt className={'text-[10px] uppercase ' + styles.textMuted}>Quality</dt><dd className={'mt-1 font-mono text-sm font-semibold ' + styles.textPrimary}>{candidate.qualityScore ?? 'Unconfirmed'}</dd></div>
                                        <div><dt className={'text-[10px] uppercase ' + styles.textMuted}>Risk</dt><dd className={'mt-1 text-sm font-semibold capitalize ' + styles.textPrimary}>{candidate.risk}</dd></div>
                                    </dl>
                                    <p className={'mt-2 text-xs leading-5 ' + styles.textMuted}>Price ${candidate.price.toFixed(2)} · {candidate.outlook}</p>
                                    {candidate.policyReasons.length > 0 ? <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Saved policy: {candidate.policyReasons.join(' · ')}</p> : null}
                                </div>
                            </details>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button type="button" onClick={() => onOpen(candidate.symbol)} className={'min-h-10 rounded-md border px-3 text-xs font-bold ' + styles.row}>Open research</button>
                                <button type="button" disabled={adding || saved} onClick={() => onAdd(candidate)} className={'min-h-10 rounded-md border px-3 text-xs font-bold disabled:opacity-50 ' + styles.panelAction}>{saved ? 'In watchlist' : 'Add to watchlist'}</button>
                            </div>
                        </article>
                    );
                })}
            </div>
            {rejections.length > 0 ? (
                <details data-testid="picker-rejections" className={'group mt-3 rounded-lg border ' + styles.panelSecondary}>
                    <summary className={'flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-xs font-semibold [&::-webkit-details-marker]:hidden ' + styles.textSecondary}>
                        <span>Why other candidates did not make the shortlist</span>
                        <span aria-hidden="true" className={'text-base transition-transform group-open:rotate-45 ' + styles.textMuted}>+</span>
                    </summary>
                    <ul className={'border-t px-4 py-3 text-xs leading-5 ' + styles.divider + ' ' + styles.textMuted}>
                        {rejections.map((reason) => (
                            <li data-reason-code={reason.code} key={reason.code}>
                                <span className={'font-semibold ' + styles.textPrimary}>{reason.count} {reason.label}</span>
                                {reason.exampleSymbols.length > 0 ? ` — examples: ${reason.exampleSymbols.join(', ')}` : ''}
                            </li>
                        ))}
                    </ul>
                </details>
            ) : null}
        </>
    );
};
