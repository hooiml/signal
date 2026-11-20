'use client';

import { useRef, useState } from 'react';
import type { OwnerAccessIssue } from '@/lib/owner-access-client';
import { createOwnerResearchRecord, ResearchWriteAccessError, updateOwnerResearchRecord } from '@/lib/research/owner-record-client';
import type { ResearchCreateInput, ResearchRecord, ResearchUpdateMode } from '@/lib/types/research';

export function useV9OwnerResearch(owner: boolean, onSaved: (record: ResearchRecord) => void) {
    const pending = useRef(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [accessIssue, setAccessIssue] = useState<OwnerAccessIssue | null>(null);

    async function write(operation: () => Promise<ResearchRecord>) {
        if (!owner || pending.current) return false;
        pending.current = true;
        setSaving(true);
        setError(null);
        setAccessIssue(null);
        try {
            onSaved(await operation());
            return true;
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to save research.');
            if (cause instanceof ResearchWriteAccessError) setAccessIssue(cause.issue);
            return false;
        } finally {
            pending.current = false;
            setSaving(false);
        }
    }

    return {
        saving, error, accessIssue,
        create: (input: ResearchCreateInput) => write(() => createOwnerResearchRecord(input)),
        save: (record: ResearchRecord, mode: ResearchUpdateMode = 'review') => write(() => updateOwnerResearchRecord(record, mode)),
    };
}
