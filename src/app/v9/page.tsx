import type { Metadata } from 'next';
import { Suspense } from 'react';
import { V9Workspace } from '@/components/v9/V9Workspace';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Signal — Calm Investing Workspace',
    robots: { index: false, follow: false },
};

export default function SignalV9Page() {
    return (
        <Suspense fallback={<div style={{ padding: 24 }}>Loading Signal workspace…</div>}>
            <V9Workspace />
        </Suspense>
    );
}
