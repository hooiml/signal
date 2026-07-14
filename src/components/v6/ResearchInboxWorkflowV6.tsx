'use client';

import { useState } from 'react';
import { appendQuickReviewNote } from '@/lib/research/records';
import type { ResearchRecord, ResearchUpdateMode } from '@/lib/types/research';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type Props = {
    readonly record: ResearchRecord;
    readonly theme: ResearchThemeV6;
    readonly onSave: (record: ResearchRecord, mode: ResearchUpdateMode) => Promise<boolean>;
};

type Feedback = { readonly tone: 'error' | 'success'; readonly message: string } | null;
type ThresholdKey = 'rsiBelow' | 'rsiAbove' | 'earningsWithinDays' | 'reviewAgeDays';

const thresholds: readonly {
    readonly key: ThresholdKey;
    readonly label: string;
    readonly fallback: number;
    readonly minimum: number;
    readonly maximum: number;
}[] = [
    { key: 'rsiBelow', label: 'RSI falls below', fallback: 30, minimum: 1, maximum: 50 },
    { key: 'rsiAbove', label: 'RSI rises above', fallback: 70, minimum: 50, maximum: 99 },
    { key: 'earningsWithinDays', label: 'Earnings within days', fallback: 21, minimum: 1, maximum: 21 },
    { key: 'reviewAgeDays', label: 'Review older than days', fallback: 30, minimum: 1, maximum: 365 },
];

export const ResearchInboxWorkflowV6 = ({ record, theme, onSave }: Props) => {
    const [note, setNote] = useState('');
    const [rules, setRules] = useState(record.monitoringRules);
    const [saving, setSaving] = useState<'review' | 'settings' | null>(null);
    const [feedback, setFeedback] = useState<Feedback>(null);
    const styles = getThemeV6(theme);
    const rulesValid = thresholds.every(({ key, minimum, maximum }) => {
        const value = rules[key];
        return value === null || Number.isInteger(value) && value >= minimum && value <= maximum;
    });

    const saveReview = async () => {
        setSaving('review');
        setFeedback(null);
        const reviewedOn = new Date().toISOString().slice(0, 10);
        const saved = await onSave({ ...record, notes: appendQuickReviewNote(record.notes, note, reviewedOn) }, 'review');
        setSaving(null);
        if (saved) {
            setNote('');
            setFeedback({ tone: 'success', message: 'Review saved for today.' });
        } else {
            setFeedback({ tone: 'error', message: 'Review could not be saved.' });
        }
    };

    const saveRules = async () => {
        if (!rulesValid) return;
        setSaving('settings');
        setFeedback(null);
        const saved = await onSave({ ...record, monitoringRules: rules }, 'settings');
        setSaving(null);
        setFeedback(saved
            ? { tone: 'success', message: 'Monitoring rules updated.' }
            : { tone: 'error', message: 'Monitoring rules could not be saved.' });
    };

    const setThreshold = (key: ThresholdKey, value: number | null) => setRules((current) => ({ ...current, [key]: value }));
    const toggleRule = (key: 'buyZone' | 'belowMa200') => setRules((current) => ({ ...current, [key]: !current[key] }));

    return <div className={'mt-3 border-t pt-3 ' + styles.divider}>
        <label className={'block text-xs font-semibold ' + styles.textSecondary} htmlFor={`review-note-${record.symbol}`}>Quick review note <span className={styles.textMuted}>(optional)</span></label>
        <div className="mt-2 grid gap-2 min-[700px]:grid-cols-[minmax(0,1fr)_auto]">
            <input id={`review-note-${record.symbol}`} value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder="What changed since the last review?" className={'min-h-10 min-w-0 rounded border bg-transparent px-3 text-sm outline-none focus:border-emerald-500 ' + styles.textPrimary} />
            <button type="button" disabled={saving !== null} onClick={() => void saveReview()} className={'min-h-10 rounded px-4 text-xs font-bold disabled:cursor-wait disabled:opacity-60 ' + styles.selectedRow}>{saving === 'review' ? 'Saving…' : 'Reviewed today'}</button>
        </div>

        <details className="mt-3">
            <summary className={'flex min-h-10 cursor-pointer items-center text-xs font-semibold ' + styles.textSecondary}>Monitoring rules</summary>
            <div className="grid gap-2 pb-1 pt-2 min-[700px]:grid-cols-2">
                <RuleToggle label="Price enters saved buy zone" checked={rules.buyZone} onChange={() => toggleRule('buyZone')} styles={styles} />
                <RuleToggle label="Price falls below MA200" checked={rules.belowMa200} onChange={() => toggleRule('belowMa200')} styles={styles} />
                {thresholds.map((threshold) => <ThresholdRule key={threshold.key} rule={threshold} value={rules[threshold.key]} onChange={(value) => setThreshold(threshold.key, value)} styles={styles} />)}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" disabled={saving !== null || !rulesValid} onClick={() => void saveRules()} className={'min-h-10 rounded px-4 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60 ' + styles.selectedRow}>{saving === 'settings' ? 'Saving…' : 'Save rules'}</button>
                <button type="button" disabled={saving !== null} onClick={() => { setRules(record.monitoringRules); setFeedback(null); }} className={'min-h-10 rounded px-4 text-xs font-semibold ' + styles.textSecondary}>Cancel changes</button>
            </div>
            {!rulesValid && <p role="alert" className={'mt-2 text-xs font-semibold ' + styles.risk}>Use a whole number inside each shown threshold range.</p>}
        </details>
        {feedback && <p role={feedback.tone === 'error' ? 'alert' : 'status'} className={'mt-2 text-xs font-semibold ' + (feedback.tone === 'error' ? styles.risk : styles.positive)}>{feedback.message}</p>}
    </div>;
};

const RuleToggle = ({ label, checked, onChange, styles }: { readonly label: string; readonly checked: boolean; readonly onChange: () => void; readonly styles: ReturnType<typeof getThemeV6> }) => <label className={'flex min-h-10 items-center gap-2 rounded border px-3 text-xs ' + styles.row}>
    <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-emerald-500" />
    <span className={styles.textSecondary}>{label}</span>
</label>;

const ThresholdRule = ({ rule, value, onChange, styles }: { readonly rule: typeof thresholds[number]; readonly value: number | null; readonly onChange: (value: number | null) => void; readonly styles: ReturnType<typeof getThemeV6> }) => <label className={'grid min-h-10 grid-cols-[auto_minmax(0,1fr)_72px] items-center gap-2 rounded border px-3 text-xs ' + styles.row}>
    <input type="checkbox" checked={value !== null} onChange={(event) => onChange(event.target.checked ? rule.fallback : null)} className="h-4 w-4 accent-emerald-500" />
    <span className={styles.textSecondary}>{rule.label}</span>
    <input type="number" aria-label={`${rule.label} threshold`} aria-invalid={value !== null && (!Number.isInteger(value) || value < rule.minimum || value > rule.maximum)} disabled={value === null} min={rule.minimum} max={rule.maximum} value={value ?? ''} onChange={(event) => onChange(Number(event.target.value))} className={'min-h-10 w-full rounded border bg-transparent px-2 text-right font-mono text-xs outline-none focus:border-emerald-500 disabled:opacity-40 ' + styles.textPrimary} />
</label>;
