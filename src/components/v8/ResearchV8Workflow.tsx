import { researchWorkspaceGroups } from '@/lib/research/workspace-navigation';
import { checklistLabelsV6 } from '@/components/v6/research-v6';
import type { InvestmentChecklist } from '@/lib/types/research';
import base from './market-v8.module.css';
import styles from './research-v8.module.css';

export const researchV8Tabs = ['Overview', 'Financials', 'Thesis', 'Valuation', 'Review'] as const;
export type ResearchV8Tab = typeof researchV8Tabs[number];

const checkDestinations: Record<keyof InvestmentChecklist, ResearchV8Tab> = {
    understandBusiness: 'Thesis', revenueGrowingOrStable: 'Financials', marginsHealthyOrImproving: 'Financials',
    debtManageable: 'Financials', freeCashFlowPositiveOrImproving: 'Financials', valuationReasonable: 'Valuation',
    catalystOrCompoundingReason: 'Review', downsideAcceptable: 'Valuation', betterThanCashOrIndex: 'Valuation',
};

export function ResearchToolsV8() {
    return <details className={styles.tools}>
        <summary>Research tools <span aria-hidden="true">＋</span></summary>
        <div className={styles.toolDirectory}>
            <div className={styles.panelHeading}><div><span className={base.eyebrow}>EXISTING SIGNAL WORKSPACES</span><h2>Find the right tool for the job.</h2></div></div>
            <p>These links open saved Research in a new tab. Its own selected security and saved records apply; this fictional company and your session drafts are not transferred.</p>
            <nav aria-label="Existing research tools" className={styles.toolGroups}>{researchWorkspaceGroups.map(group => <section key={group.id}><h3>{group.label}</h3><ul>{group.items.map(item => <li key={item.id}><a href={`/research?workspace=${item.id}`} target="_blank" rel="noopener noreferrer">{item.label}<span aria-hidden="true">↗</span><span className={base.visuallyHidden}> — existing app, new tab</span></a></li>)}</ul></section>)}</nav>
        </div>
    </details>;
}

export function ResearchChecksV8({ hasEvidence, blank, onNavigate }: { hasEvidence: boolean; blank: boolean; onNavigate: (tab: ResearchV8Tab) => void }) {
    return <details className={styles.researchChecks}>
        <summary><span><b>9 research checks</b><small>Inspect coverage before making a decision</small></span><span className={styles.checkBadge}>Not verified <span aria-hidden="true">＋</span></span></summary>
        <p className={styles.helper}>Questions to test business quality, valuation and downside. No check is verified by these synthetic examples; opening a section does not mark it complete.</p>
        <div className={styles.checkRows}>{(Object.keys(checkDestinations) as (keyof InvestmentChecklist)[]).map(key => {
            const label = checklistLabelsV6[key];
            const fixtureOnly = hasEvidence && (key === 'revenueGrowingOrStable' || key === 'freeCashFlowPositiveOrImproving');
            const authored = !blank && key === 'understandBusiness';
            return <button key={key} onClick={() => onNavigate(checkDestinations[key])}><span>{label}</span><small>{fixtureOnly ? 'Fixture only' : authored ? 'Example thesis' : 'Evidence needed'}</small><span aria-hidden="true">↗</span></button>;
        })}</div>
    </details>;
}

export function FinancialCoverageV8({ available, onReview }: { available: boolean; onReview: () => void }) {
    return <section className={styles.financialCoverage} aria-label="Fundamental coverage">
        <div className={styles.panelHeading}><div><span className={base.eyebrow}>WHAT THE NUMBERS DO NOT YET TELL US</span><h2>Fundamental coverage</h2></div><span className={base.tag}>FY2025 example</span></div>
        <dl className={styles.fundamentalGrid}>
            <div><dt>Revenue</dt><dd>{available ? '$120m' : 'Unavailable'}</dd><small>{available ? 'USD · synthetic annual value' : 'No comparable report'}</small></div>
            <div><dt>Free cash flow</dt><dd>{available ? '$8m' : 'Unavailable'}</dd><small>{available ? 'USD · synthetic annual value' : 'No comparable report'}</small></div>
            <div><dt>Margins</dt><dd>Unavailable</dd><small>Cost and profit detail needed</small></div>
            <div><dt>Debt & cash</dt><dd>Unavailable</dd><small>Balance sheet needed</small></div>
            <div><dt>Share count</dt><dd>Unavailable</dd><small>Dilution history needed</small></div>
            <div><dt>Working capital & capex</dt><dd>Unavailable</dd><small>Cash-flow bridge needed</small></div>
        </dl>
        <button className={base.textButton} onClick={onReview}>Draft the missing-data question ↗</button>
        <details className={styles.chartSource}><summary>What do these terms mean?</summary><p>Revenue is sales before expenses. Free cash flow is operating cash flow less capital spending. Margins show how much revenue remains after costs. Debt, cash and share count help test financial resilience and dilution. These measures answer different questions; revenue growth alone cannot establish business quality.</p></details>
        <div className={styles.connectedTool}><div><b>Price chart & technical context</b><p>No price history is connected to this fictional company. Saved Research provides candles, ranges, technical indicators and benchmark comparison for real securities.</p></div><a href="/research?workspace=research&tab=chart" target="_blank" rel="noopener noreferrer">Open real-security charts ↗<span className={base.visuallyHidden}> in the existing app, new tab</span></a></div>
    </section>;
}

export function ReviewCheckpointV8({ date, reason, onDate, onReason }: {
    date: string; reason: string; onDate: (value: string) => void; onReason: (value: string) => void;
}) {
    return <section className={styles.reviewCheckpoint} aria-label="Draft review checkpoint">
        <div className={styles.panelHeading}><div><span className={base.eyebrow}>WHEN WOULD YOU REVISIT THIS?</span><h2>Next review checkpoint</h2></div><span className={base.tag}>Draft · session only</span></div>
        <div className={styles.checkpointFields}><label>Draft review date<input type="date" value={date} onChange={event => onDate(event.target.value)} /></label><label>Reason to revisit<input value={reason} onChange={event => onReason(event.target.value)} maxLength={300} placeholder="For example: a new filing or a thesis-changing result" /></label></div>
        <p className={styles.helper}>This draft creates no reminder, calendar entry or monitoring rule. It resets with this case’s session. Earnings dates and events have not been supplied.</p>
        {(date || reason.trim()) && <output className={styles.checkpointPreview}>Draft checkpoint: {date || 'date undecided'}{reason.trim() ? ` · ${reason.trim()}` : ' · reason not written'}</output>}
        <div className={styles.connectedTool}><div><b>Saved history & monitoring</b><p>No saved reviews or triggers are connected here. Inspect prior decisions and scheduled events in the existing Research app.</p></div><div><a href="/research?workspace=replay" target="_blank" rel="noopener noreferrer">Saved decision history ↗</a><a href="/research?workspace=calendar" target="_blank" rel="noopener noreferrer">Review calendar ↗</a></div></div>
    </section>;
}
