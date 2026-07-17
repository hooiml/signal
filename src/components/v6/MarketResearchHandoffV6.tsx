import Link from 'next/link';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import {
    buildResearchHandoffHref,
    createMarketResearchHandoff,
    getMarketResearchEmphasis,
    type MarketResearchHandoff,
} from '@/lib/market-research-handoff';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

export const MarketToResearchLinkV6 = ({ signal, theme }: {
    readonly signal: MarketSignal;
    readonly theme: ResearchThemeV6;
}) => {
    const styles = getThemeV6(theme);
    const handoff = createMarketResearchHandoff(signal);

    return <section data-testid="market-research-handoff" aria-labelledby="market-research-handoff-title" className={'rounded-lg border p-5 backdrop-blur-md sm:p-6 ' + styles.panel}>
        <div className="grid gap-4 min-[700px]:grid-cols-[minmax(0,1fr)_auto] min-[700px]:items-center">
            <div>
                <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + styles.positive}>Continue the decision</p>
                <h2 id="market-research-handoff-title" className={'mt-1 text-lg font-bold ' + styles.textPrimary}>Carry this market context into Research</h2>
                <p className={'mt-2 max-w-3xl text-sm leading-6 ' + styles.textSecondary}>{getMarketResearchEmphasis(handoff)}</p>
                <p className={'mt-2 text-xs ' + styles.textMuted}>Context remains visible evidence only. It does not change any ticker decision or checklist answer.</p>
            </div>
            <Link href={buildResearchHandoffHref(handoff)} className={'inline-flex min-h-11 items-center justify-center rounded border px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ' + styles.selectedRow}>
                Review watchlist
            </Link>
        </div>
    </section>;
};

const formatMode = (mode: MarketResearchHandoff['mode']) => mode === 'standard' ? 'Momentum' : 'Contrarian';
const formatTier = (tier: MarketResearchHandoff['tier']) => tier.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');

const daysSince = (value: string) => {
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : Math.floor((Date.now() - time) / 86_400_000);
};

export const ResearchMarketContextV6 = ({ handoff, items, theme, onOpen }: {
    readonly handoff: MarketResearchHandoff;
    readonly items: readonly ResearchWatchlistItem[];
    readonly theme: ResearchThemeV6;
    readonly onOpen: (symbol: string) => void;
}) => {
    const styles = getThemeV6(theme);
    const matching = items.filter((item) => item.market === handoff.market);
    const reviewQueue = [...matching]
        .filter((item) => item.positionState === 'owned' || daysSince(item.lastReviewedAt) >= 30)
        .sort((left, right) => Number(right.positionState === 'owned') - Number(left.positionState === 'owned') || left.lastReviewedAt.localeCompare(right.lastReviewedAt));
    const next = reviewQueue[0] ?? matching[0];

    return <section data-testid="research-market-context" aria-labelledby="research-market-context-title" className={'mb-4 rounded-[10px] border p-4 backdrop-blur min-[700px]:p-5 ' + styles.panel}>
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
