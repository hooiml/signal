'use client';

import type { ResearchActionFilterV6, ResearchMarketFilterV6 } from '@/components/v6/ResearchHeaderV6';
import styles from './v7-live.module.css';

const actionOptions: ReadonlyArray<{ readonly value: ResearchActionFilterV6; readonly label: string }> = [
    { value: 'ALL', label: 'All decisions' },
    { value: 'Ready', label: 'Ready' },
    { value: 'DCA', label: 'DCA' },
    { value: 'Wait for price', label: 'Wait for price' },
    { value: 'Watch', label: 'Watch' },
    { value: 'Avoid', label: 'Avoid' },
];

export const ResearchControlsV7 = ({ query, market, action, reviewedLabel, resultCount, showResearchControls, onQueryChange, onMarketChange, onActionChange }: {
    readonly query: string;
    readonly market: ResearchMarketFilterV6;
    readonly action: ResearchActionFilterV6;
    readonly reviewedLabel: string;
    readonly resultCount: number;
    readonly showResearchControls: boolean;
    readonly onQueryChange: (query: string) => void;
    readonly onMarketChange: (market: ResearchMarketFilterV6) => void;
    readonly onActionChange: (action: ResearchActionFilterV6) => void;
}) => {
    if (!showResearchControls) return <p className={styles.workspaceControlNote}>Review the evidence, outstanding work, and next action in this workspace.</p>;

    return (
        <div className={styles.researchControls}>
            <label className={styles.researchSearch}>
                <span>Ticker search</span>
                <input type="search" maxLength={80} value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Symbol or company" />
            </label>
            <fieldset className={styles.regionControl}>
                <legend>Region</legend>
                <div>
                    {(['ALL', 'US', 'MY'] as const).map((option) => (
                        <button key={option} type="button" aria-pressed={market === option} onClick={() => onMarketChange(option)}>{option === 'ALL' ? 'All' : option}</button>
                    ))}
                </div>
            </fieldset>
            <label className={styles.decisionControl}>
                <span>Decision</span>
                <select value={action} onChange={(event) => onActionChange(event.target.value as ResearchActionFilterV6)}>
                    {actionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
            </label>
            <p className={styles.researchControlMeta}>{resultCount} ticker{resultCount === 1 ? '' : 's'} · Last reviewed {reviewedLabel} UTC</p>
        </div>
    );
};
