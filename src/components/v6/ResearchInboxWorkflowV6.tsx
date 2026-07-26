'use client';

import { useState } from 'react';
import { appendQuickReviewNote } from '@/lib/research/records';
import type { ResearchRecord, ResearchStructuredTriggerSet, ResearchUpdateMode } from '@/lib/types/research';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';
import { StructuredTriggerEditorV6 } from './StructuredTriggerEditorV6';

type Props = {
    readonly record: ResearchRecord;
    readonly theme: ResearchThemeV6;
    readonly onSave: (record: ResearchRecord, mode: ResearchUpdateMode) => Promise<boolean>;
    readonly saveError: string | null;
};

type Feedback = { readonly tone: 'error' | 'success'; readonly message: string } | null;

export const ResearchInboxWorkflowV6 = ({ record, theme, onSave, saveError }: Props) => {
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState<'review' | 'settings' | null>(null);
    const [feedback, setFeedback] = useState<Feedback>(null);
    const styles = getThemeV6(theme);

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

    const saveRules = async (structuredTriggers: ResearchStructuredTriggerSet) => {
        setSaving('settings');
        setFeedback(null);
        const saved = await onSave({
            ...record,
            monitoringRules: { ...record.monitoringRules, structuredTriggers },
        }, 'settings');
        setSaving(null);
        if (!saved) setFeedback({ tone: 'error', message: 'Structured monitoring rules could not be saved.' });
        return saved;
    };

    return <div className={'mt-3 border-t pt-3 ' + styles.divider}>
        <label className={'block text-xs font-semibold ' + styles.textSecondary} htmlFor={`review-note-${record.symbol}`}>Quick review note <span className={styles.textMuted}>(optional)</span></label>
        <div className="mt-2 grid gap-2 min-[700px]:grid-cols-[minmax(0,1fr)_auto]">
            <input id={`review-note-${record.symbol}`} value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder="What changed since the last review?" className={'min-h-10 min-w-0 rounded border bg-transparent px-3 text-sm outline-none focus:border-emerald-500 ' + styles.textPrimary} />
            <button type="button" disabled={saving !== null} onClick={() => void saveReview()} className={'min-h-10 rounded px-4 text-xs font-bold disabled:cursor-wait disabled:opacity-60 ' + styles.selectedRow}>{saving === 'review' ? 'Saving…' : 'Reviewed today'}</button>
        </div>

        <details className="mt-3" open={record.monitoringRules.structuredTriggers.migrationState === 'invalid-recovered'}>
            <summary className={'flex min-h-10 cursor-pointer items-center text-xs font-semibold ' + styles.textSecondary}>Monitoring rules</summary>
            <StructuredTriggerEditorV6
                value={record.monitoringRules.structuredTriggers}
                saving={saving === 'settings'}
                saveError={saving === null && feedback?.tone === 'error' ? saveError : null}
                theme={theme}
                onSave={saveRules}
            />
        </details>
        {feedback && <p role={feedback.tone === 'error' ? 'alert' : 'status'} className={'mt-2 text-xs font-semibold ' + (feedback.tone === 'error' ? styles.risk : styles.positive)}>{feedback.message}</p>}
    </div>;
};
