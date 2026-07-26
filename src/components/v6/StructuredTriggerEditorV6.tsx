'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    parseResearchStructuredTriggerSet,
    researchStructuredTriggerDefinitions,
    researchStructuredTriggerLimit,
    type ResearchStructuredTriggerError,
} from '@/lib/research/structured-triggers';
import type {
    ResearchStructuredTriggerMetric,
    ResearchStructuredTriggerPurpose,
    ResearchStructuredTriggerRule,
    ResearchStructuredTriggerSet,
} from '@/lib/types/research';
import { getThemeV6 } from './research-v6';

const purposeOptions: readonly { readonly value: ResearchStructuredTriggerPurpose; readonly label: string }[] = [
    { value: 'thesis-invalidation', label: 'Thesis invalidation review' },
    { value: 'opportunity-review', label: 'Opportunity review' },
    { value: 'scheduled-evidence-review', label: 'Scheduled evidence review' },
];

const defaults: Readonly<Record<ResearchStructuredTriggerMetric, number>> = {
    price: 100,
    rsi14: 30,
    'price-vs-ma50-percent': 0,
    'price-vs-ma200-percent': 0,
    'earnings-within-days': 21,
    'research-age-days': 30,
    'evidence-age-days': 90,
    'price-earnings': 20,
    'free-cash-flow-yield-percent': 5,
    'revenue-growth-percent': 10,
};

const unitLabel = (metric: ResearchStructuredTriggerMetric) => {
    const unit = researchStructuredTriggerDefinitions.find((definition) => definition.metric === metric)?.unit;
    if (unit === 'percent') return '%';
    if (unit === 'days') return 'days';
    if (unit === 'rsi') return 'RSI';
    if (unit === 'ratio') return 'x';
    return 'price';
};

type Props = {
    readonly value: ResearchStructuredTriggerSet;
    readonly saving: boolean;
    readonly saveError: string | null;
    readonly theme: Parameters<typeof getThemeV6>[0];
    readonly onSave: (value: ResearchStructuredTriggerSet) => Promise<boolean>;
};

export const StructuredTriggerEditorV6 = ({ value, saving, saveError, theme, onSave }: Props) => {
    const [rules, setRules] = useState<readonly ResearchStructuredTriggerRule[]>(value.rules);
    const [feedback, setFeedback] = useState<string | null>(null);
    const styles = getThemeV6(theme);
    const field = 'min-h-10 w-full min-w-0 rounded border bg-transparent px-2 text-xs outline-none focus:border-emerald-500 ' + styles.textPrimary;

    useEffect(() => {
        setRules(value.rules);
    }, [value]);

    const validation = useMemo(() => {
        try {
            return { valid: true as const, value: parseResearchStructuredTriggerSet({ version: 1, migrationState: 'current', rules }) };
        } catch (error) {
            return { valid: false as const, message: (error as ResearchStructuredTriggerError).message };
        }
    }, [rules]);

    const updateRule = (id: string, update: Partial<ResearchStructuredTriggerRule>) => {
        setFeedback(null);
        setRules((current) => current.map((rule) => rule.id === id ? { ...rule, ...update } : rule));
    };

    const changeMetric = (rule: ResearchStructuredTriggerRule, metric: ResearchStructuredTriggerMetric) => {
        const definition = researchStructuredTriggerDefinitions.find((candidate) => candidate.metric === metric)
            ?? researchStructuredTriggerDefinitions[0];
        updateRule(rule.id, {
            metric,
            operator: definition.operators[0],
            threshold: defaults[metric],
        });
    };

    const addRule = () => {
        if (rules.length >= researchStructuredTriggerLimit) return;
        setFeedback(null);
        setRules((current) => [...current, {
            id: crypto.randomUUID(),
            enabled: true,
            purpose: 'thesis-invalidation',
            metric: 'price',
            operator: 'below',
            threshold: defaults.price,
        }]);
    };

    const save = async () => {
        if (!validation.valid) return;
        setFeedback(null);
        const saved = await onSave(validation.value);
        setFeedback(saved ? 'Structured monitoring rules saved.' : null);
    };

    return (
        <section data-testid="structured-trigger-editor" className={'mt-3 rounded border p-3 ' + styles.panelUtility} aria-labelledby="structured-trigger-editor-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 id="structured-trigger-editor-title" className={'text-sm font-bold ' + styles.textPrimary}>Structured thesis triggers</h3>
                    <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Rules use fixed metrics and numeric thresholds. Nothing is extracted from authored thesis text, and a match only prompts review.</p>
                </div>
                <span className={'text-xs ' + styles.textMuted}>{rules.length}/{researchStructuredTriggerLimit} rules</span>
            </div>

            {value.migrationState === 'migrated-empty' ? <p role="status" className={'mt-3 text-xs ' + styles.textMuted}>This older record was migrated to an empty version-1 structured rule set.</p> : null}
            {value.migrationState === 'invalid-recovered' ? <p role="alert" className={'mt-3 text-xs font-semibold ' + styles.risk}>Malformed legacy structured rules were ignored to protect this record. Review and save a replacement rule set.</p> : null}

            {rules.length === 0 ? <p className={'mt-3 text-sm ' + styles.textMuted}>No structured review prompts are configured.</p> : (
                <ol className={'mt-3 divide-y border-y ' + styles.divider}>
                    {rules.map((rule) => {
                        const definition = researchStructuredTriggerDefinitions.find((candidate) => candidate.metric === rule.metric)
                            ?? researchStructuredTriggerDefinitions[0];
                        return <li key={rule.id} className="grid gap-2 py-3 min-[760px]:grid-cols-[auto_minmax(150px,1fr)_minmax(150px,1fr)_110px_minmax(110px,0.7fr)_auto]">
                            <label className={'flex min-h-10 items-center gap-2 text-xs ' + styles.textSecondary}>
                                <input aria-label={`Enable ${definition.label} rule`} type="checkbox" checked={rule.enabled} onChange={(event) => updateRule(rule.id, { enabled: event.target.checked })} className="size-4 accent-emerald-500" />
                                <span>{rule.enabled ? 'Enabled' : 'Disabled'}</span>
                            </label>
                            <label className={'text-[11px] font-medium ' + styles.textMuted}>Purpose
                                <select aria-label={`Purpose for ${definition.label}`} value={rule.purpose} onChange={(event) => updateRule(rule.id, { purpose: event.target.value as ResearchStructuredTriggerPurpose })} className={'mt-1 ' + field}>
                                    {purposeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                            </label>
                            <label className={'text-[11px] font-medium ' + styles.textMuted}>Metric
                                <select aria-label={`Metric for rule ${rule.id}`} value={rule.metric} onChange={(event) => changeMetric(rule, event.target.value as ResearchStructuredTriggerMetric)} className={'mt-1 ' + field}>
                                    {researchStructuredTriggerDefinitions.map((option) => <option key={option.metric} value={option.metric}>{option.label}</option>)}
                                </select>
                            </label>
                            <label className={'text-[11px] font-medium ' + styles.textMuted}>Operator
                                <select aria-label={`Operator for ${definition.label}`} value={rule.operator} onChange={(event) => updateRule(rule.id, { operator: event.target.value as ResearchStructuredTriggerRule['operator'] })} className={'mt-1 ' + field}>
                                    {definition.operators.map((operator) => <option key={operator} value={operator}>{operator}</option>)}
                                </select>
                            </label>
                            <label className={'text-[11px] font-medium ' + styles.textMuted}>Threshold ({unitLabel(rule.metric)})
                                <input
                                    aria-label={`Threshold for ${definition.label}`}
                                    type="number"
                                    min={definition.minimum}
                                    max={definition.maximum}
                                    step={definition.integer ? 1 : 0.01}
                                    value={rule.threshold}
                                    onChange={(event) => updateRule(rule.id, { threshold: Number(event.target.value) })}
                                    className={'mt-1 text-right font-mono ' + field}
                                />
                            </label>
                            <button type="button" onClick={() => { setFeedback(null); setRules((current) => current.filter((candidate) => candidate.id !== rule.id)); }} className={'min-h-10 self-end rounded px-2 text-xs font-semibold ' + styles.risk} aria-label={`Remove ${definition.label} rule`}>Remove</button>
                        </li>;
                    })}
                </ol>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={saving || rules.length >= researchStructuredTriggerLimit} onClick={addRule} className={'min-h-10 rounded border px-3 text-xs font-semibold disabled:opacity-50 ' + styles.row}>Add rule</button>
                <button type="button" disabled={saving || !validation.valid} onClick={() => void save()} className={'min-h-10 rounded px-4 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 ' + styles.selectedRow}>{saving ? 'Saving…' : 'Save structured rules'}</button>
                <button type="button" disabled={saving} onClick={() => { setRules(value.rules); setFeedback(null); }} className={'min-h-10 rounded px-3 text-xs font-semibold ' + styles.textSecondary}>Cancel changes</button>
            </div>
            {!validation.valid ? <p role="alert" className={'mt-2 text-xs font-semibold ' + styles.risk}>{validation.message}</p> : null}
            {saveError ? <p role="alert" className={'mt-2 text-xs font-semibold ' + styles.risk}>{saveError}</p> : null}
            {feedback ? <p role="status" className={'mt-2 text-xs font-semibold ' + styles.positive}>{feedback}</p> : null}
        </section>
    );
};

