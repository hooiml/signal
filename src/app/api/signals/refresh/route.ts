import { NextResponse } from 'next/server';
import { requireAnyBearerSecret } from '@/lib/route-auth';
import { getSmartSignal } from '@/lib/signal';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

type RefreshTarget = {
    market: 'US' | 'MY';
    mode: 'standard' | 'contrarian';
    enableSocial: boolean;
};

const DEFAULT_TARGETS: RefreshTarget[] = [
    { market: 'US', mode: 'standard', enableSocial: true },
    { market: 'US', mode: 'contrarian', enableSocial: true },
    { market: 'MY', mode: 'standard', enableSocial: true },
    { market: 'MY', mode: 'contrarian', enableSocial: true },
];

const SOURCE_OFF_TARGETS: RefreshTarget[] = [
    { market: 'US', mode: 'standard', enableSocial: false },
    { market: 'US', mode: 'contrarian', enableSocial: false },
    { market: 'MY', mode: 'standard', enableSocial: false },
    { market: 'MY', mode: 'contrarian', enableSocial: false },
];

export const GET = async (request: Request): Promise<NextResponse> => {
    const authError = requireAnyBearerSecret(
        request,
        [process.env.CRON_SECRET, process.env.ADMIN_SECRET],
        'CRON_SECRET or ADMIN_SECRET must be configured'
    );
    if (authError) {
        return authError;
    }

    const { searchParams } = new URL(request.url);
    const includeSourceOff = searchParams.get('includeSourceOff') === 'true';
    const targets = includeSourceOff
        ? [...DEFAULT_TARGETS, ...SOURCE_OFF_TARGETS]
        : DEFAULT_TARGETS;

    const startedAt = Date.now();
    const results: Array<RefreshTarget & {
        success: boolean;
        score?: number;
        tier?: string;
        confidence?: string;
        durationMs: number;
        error?: string;
    }> = [];

    for (const target of targets) {
        const stepStartedAt = Date.now();

        try {
            const signal = await getSmartSignal(target.market, target.mode, target.enableSocial);
            if (signal.meta.status === 'ERROR' || !signal.v2) {
                results.push({
                    ...target,
                    success: false,
                    durationMs: Date.now() - stepStartedAt,
                    error: signal.meta.error || 'Unknown signal refresh failure',
                });
                continue;
            }

            results.push({
                ...target,
                success: true,
                score: signal.v2.composite_score,
                tier: signal.v2.tier,
                confidence: signal.v2.confidence.level,
                durationMs: Date.now() - stepStartedAt,
            });
        } catch (error) {
            results.push({
                ...target,
                success: false,
                durationMs: Date.now() - stepStartedAt,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    const failures = results.filter(result => !result.success);
    const successful = results.filter(result => result.success);

    return NextResponse.json({
        success: failures.length === 0,
        refreshType: includeSourceOff ? 'v2-full-snapshot-warm' : 'v2-default-snapshot-warm',
        targetCount: targets.length,
        succeeded: successful.length,
        failed: failures.length,
        durationMs: Date.now() - startedAt,
        results,
    }, {
        status: failures.length === 0 ? 200 : 207,
    });
};
