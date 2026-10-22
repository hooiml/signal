import Link from 'next/link';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import {
    buildResearchHandoffHref,
    createMarketResearchHandoff,
    getMarketResearchEmphasis,
    type MarketResearchHandoff,
} from '@/lib/market-research-handoff';
import type { MarketSignal } from '@/lib/types/signal-v2';
import type { ResearchRecord } from '@/lib/types/research';
import { personalReviewAgeDays, personalReviewDate } from '@/lib/research/review-lifecycle';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';
import {
    setProductAnalyticsWorkflowSource,
    trackProductAnalyticsEvent,
} from '@/lib/product-analytics-client';

export const MarketToResearchLinkV6 = ({ signal, theme }: {
    readonly signal: MarketSignal;
    readonly theme: ResearchThemeV6;
}) => {
    const styles = getThemeV6(theme);
    const handoff = createMarketResearchHandoff(signal);

    return <section data-testid="market-research-handoff" aria-labelledby="market-research-handoff-title" data-surface-tier="action" className={'rounded-lg border p-5 backdrop-blur-sm sm:p-6 ' + styles.panelAction}>
        <div className="grid gap-4 min-[700px]:grid-cols-[minmax(0,1fr)_auto] min-[700px]:items-center">
            <div>
                <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + styles.positive}>Continue the decision</p>
                <h2 id="market-research-handoff-title" className={'mt-1 text-lg font-bold ' + styles.textPrimary}>Carry this market context into Research</h2>
                <p className={'mt-2 max-w-3xl text-sm leading-6 ' + styles.textSecondary}>{getMarketResearchEmphasis(handoff)}</p>
                <p className={'mt-2 text-xs ' + styles.textMuted}>Context remains visible evidence only. It does not change any ticker decision or checklist answer.</p>
            </div>
            <Link href={buildResearchHandoffHref(handoff)} onClick={() => {
                setProductAnalyticsWorkflowSource('market');
                trackProductAnalyticsEvent({
                    name: 'market_handoff_opened',
                    surface: 'market',
                    workspace: 'market_conditions',
                    source: 'market',
                    attributes: { market: handoff.market },
                });
            }} className={'inline-flex min-h-11 items-center justify-center rounded border px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ' + styles.selectedRow}>
                Review watchlist
            </Link>
        </div>
    </section>;
};

const formatMode = (mode: MarketResearchHandoff['mode']) => mode === 'standard' ? 'Momentum' : 'Contrarian';
const formatTier = (tier: MarketResearchHandoff['tier']) => tier.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');

export const ResearchMarketContextV6 = ({ handoff, items, records, theme, onOpen }: {
    readonly handoff: MarketResearchHandoff;
    readonly items: readonly ResearchWatchlistItem[];
    readonly records: readonly ResearchRecord[];
    readonly theme: ResearchThemeV6;
    readonly onOpen: (symbol: string) => void;
}) => {
    const styles = getThemeV6(theme);
    const recordsBySymbol = new Map(records.map((record) => [record.symbol, record]));
    const matching = items.filter((item) => item.market === handoff.market);
    const reviewQueue = [...matching]
        .map((item) => {
            const record = recordsBySymbol.get(item.symbol);
            return { ...item, reviewAgeDays: personalReviewAgeDays(record ? personalReviewDate(record) : null) };
        })
        .filter((item) => item.positionState === 'owned' || item.reviewAgeDays !== null && item.reviewAgeDays >= 30)
        .sort((left, right) => Number(right.positionState === 'owned') - Number(left.positionState === 'owned') || (right.reviewAgeDays ?? -1) - (left.reviewAgeDays ?? -1));
    const next = reviewQueue[0] ?? matching[0];

    return <section data-testid="research-market-context" aria-labelledby="research-market-context-title" data-surface-tier="utility" className={'mb-4 rounded-[10px] border p-4 backdrop-blur min-[700px]:p-5 ' + styles.panelUtility}>
        <div className="grid gap-4 min-[900px]:grid-cols-[minmax(0,1fr)_auto] min-[900px]:items-center">
            <div>
                <div className="flex flex-wrap items-center gap-2">
                    <p className={'text-xs font-bold uppercase tracking-[0.14em] ' + styles.positive}>Market context · evidence only</p>
                    <span className={'rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] ' + styles.row}>{handoff.market} · {formatMode(handoff.mode)}</span>
                </div>
                <h1 id="research-market-context-title" className={'mt-2 text-xl font-bold ' + styles.textPrimary}>{formatTier(handoff.tier)} · score {handoff.score}</h1>
                <p className={'mt-2 max-w-4xl text-sm leading-6 ' + styles.textSecondary}>{getMarketResearchEmphasis(handoff)}</p>
                <p className={'mt-2 text-xs leading-5 ' + styles.textMuted}>
                    {matching.length} {handoff.market} watchlist name{matching.length === 1 ? '' : 's'} · {reviewQueue.length} owned or stale review{reviewQueue.length === 1 ? '' : 's'} · freshness {handoff.freshness} · coverage {handoff.coverage}
                    {handoff.snapshotAt ? ' · snapshot ' + new Date(handoff.snapshotAt).toLocaleDateString() : ' · snapshot date unavailable'}
                    {handoff.conflicts.length > 0 ? ' · conflicts: ' + handoff.conflicts.join(', ') : ''}
                </p>
            </div>
            {next ? <button type="button" onClick={() => onOpen(next.symbol)} className={'min-h-11 rounded border px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ' + styles.selectedRow}>Review {next.symbol}</button> : <p className={'text-xs ' + styles.textMuted}>Add a {handoff.market} ticker to connect it to this context.</p>}
        </div>
    </section>;
};
