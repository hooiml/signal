import type { InstitutionalOwnershipEvidence } from '@/lib/types/research-discovery';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

const compactNumber = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const dateLabel = (date: string) => new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${date}T00:00:00Z`));

export const DiscoveryOwnershipEvidenceV6 = ({ ownership, theme, className = '' }: {
    readonly ownership: InstitutionalOwnershipEvidence | null;
    readonly theme: ResearchThemeV6;
    readonly className?: string;
}) => {
    const styles = getThemeV6(theme);
    if (ownership === null) return <p className={'text-[11px] ' + styles.textMuted + ' ' + className}>Ownership unavailable</p>;
    const tone = ownership.activity === 'increases-led' ? styles.positive
        : ownership.activity === 'decreases-led' ? styles.risk : styles.textSecondary;
    const activityLabel = ownership.activity === 'increases-led' ? 'increases led'
        : ownership.activity === 'decreases-led' ? 'decreases led' : 'mixed';
    return (
        <details className={className}>
            <summary className={'flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 py-1 text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-emerald-500 ' + tone}>
                <span>Disclosed share changes: {activityLabel} | {ownership.buyers.length} buyers</span>
                <span className={styles.textMuted}>Details</span>
            </summary>
            <div className={'border-t py-2 text-[11px] ' + styles.divider}>
                <p className={styles.textMuted}>{ownership.reportPeriod ? `Latest listed buyer report ${dateLabel(ownership.reportPeriod)}` : 'Latest listed buyer report unavailable'}</p>
                <p className={'mt-1 ' + styles.textMuted}>{ownership.institutionalOwnershipPercent === null
                    ? 'Reported institutional ownership unavailable'
                    : `Reported institutional ownership ${ownership.institutionalOwnershipPercent.toFixed(1)}% | summary date not supplied`}</p>
                {(ownership.increasedShares !== null || ownership.decreasedShares !== null) && <p className={'mt-1 ' + styles.textMuted}>
                    Increased shares {ownership.increasedShares === null ? 'unavailable' : compactNumber.format(ownership.increasedShares)} | Decreased shares {ownership.decreasedShares === null ? 'unavailable' : compactNumber.format(ownership.decreasedShares)}
                </p>}
                <ol className="mt-2 space-y-2">
                    {ownership.buyers.map((buyer) => (
                        <li key={`${buyer.name}-${buyer.reportDate}`} className={'border-t pt-2 first:border-t-0 first:pt-0 ' + styles.divider}>
                            <div className="flex items-start justify-between gap-3">
                                {buyer.sourceUrl ? <a href={buyer.sourceUrl} target="_blank" rel="noreferrer" className={'min-w-0 truncate font-semibold underline decoration-dotted underline-offset-2 ' + styles.textPrimary}>{buyer.name}</a>
                                    : <span className={'min-w-0 truncate font-semibold ' + styles.textPrimary}>{buyer.name}</span>}
                                <span className={'shrink-0 font-mono ' + styles.positive}>+{compactNumber.format(buyer.sharesAdded)}</span>
                            </div>
                            <p className={'mt-0.5 ' + styles.textMuted}>{buyer.newPosition ? 'New position' : buyer.positionChangePercent === null ? 'Increase disclosed' : `Position +${buyer.positionChangePercent.toFixed(1)}%`} | reported {dateLabel(buyer.reportDate)}</p>
                        </li>
                    ))}
                </ol>
                {ownership.buyers.length === 0 && <p className={'mt-2 ' + styles.textMuted}>No increased-position holders were returned for this snapshot.</p>}
                <p className={'mt-2 leading-4 ' + styles.textMuted}>Quarterly disclosures may be delayed. The change label compares disclosed increased and decreased share totals; it does not prove current buying or what caused the price move.</p>
                <a href={ownership.sourceUrl} target="_blank" rel="noreferrer" className={'mt-2 inline-block font-semibold underline decoration-dotted underline-offset-2 ' + styles.textSecondary}>Nasdaq source</a>
            </div>
        </details>
    );
};
