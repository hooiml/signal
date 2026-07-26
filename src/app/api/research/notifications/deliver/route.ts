import { NextResponse } from 'next/server';
import { requireAnyBearerSecret } from '@/lib/route-auth';
import { getResearchInbox } from '@/lib/research/inbox';
import {
    buildResearchNotificationDigest,
    deliverResearchNotification,
    executeResearchNotificationDelivery,
    filterResearchNotificationItems,
    researchNotificationDigestKey,
} from '@/lib/research/notification-delivery';
import {
    getResearchNotificationSettings,
    markResearchNotificationDigestDelivered,
    recordResearchNotificationDelivery,
    releaseResearchNotificationDigest,
    reserveResearchNotificationDigest,
} from '@/lib/research/notification-store';
import { listResearchState } from '@/lib/research/store';
import { isResearchNotificationQuietHour } from '@/lib/types/research-notification-settings';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const GET = async (request: Request): Promise<NextResponse> => {
    const authError = requireAnyBearerSecret(
        request,
        [process.env.CRON_SECRET, process.env.ADMIN_SECRET],
        'CRON_SECRET or ADMIN_SECRET must be configured',
    );
    if (authError) return authError;

    let activeDigestKey: string | null = null;
    let activeItemCount = 0;
    try {
        const url = new URL(request.url);
        const dryRun = url.searchParams.get('dryRun') === 'true';
        const settings = await getResearchNotificationSettings();
        if (!dryRun && !settings.enabled) return NextResponse.json({ success: true, delivered: false, reason: 'disabled' });
        if (!dryRun && isResearchNotificationQuietHour(settings, new Date())) {
            return NextResponse.json({ success: true, delivered: false, reason: 'quiet-hours' });
        }
        const endpoint = process.env.RESEARCH_NOTIFICATION_WEBHOOK_URL;
        const webhookSecret = process.env.RESEARCH_NOTIFICATION_WEBHOOK_SECRET;
        if (!dryRun && (!endpoint || !webhookSecret)) {
            return NextResponse.json({ success: true, delivered: false, reason: 'not-configured' });
        }

        const { records } = await listResearchState();
        const inputs = records.map((record) => ({
            symbol: record.symbol,
            market: record.market,
            targetBuyZone: record.targetBuyZone,
            lastReviewedAt: record.lastReviewedAt,
            monitoringRules: record.monitoringRules,
        }));
        if (inputs.length === 0) return NextResponse.json({ success: true, delivered: false, reason: 'empty-watchlist' });

        const batches = Array.from({ length: Math.ceil(inputs.length / 50) }, (_, index) => inputs.slice(index * 50, index * 50 + 50));
        const inboxParts = await Promise.all(batches.map(getResearchInbox));
        const allItems = inboxParts.flatMap((part) => part.items);
        const inbox = {
            generatedAt: new Date().toISOString(),
            monitoredCount: inboxParts.reduce((sum, part) => sum + part.monitoredCount, 0),
            items: filterResearchNotificationItems(allItems, settings.mode),
            warnings: [...new Set(inboxParts.flatMap((part) => part.warnings))],
        };
        const dashboardUrl = new URL('/research?workspace=alerts', process.env.APP_URL || url.origin).toString();
        const digest = buildResearchNotificationDigest(inbox, dashboardUrl);
        const digestKey = researchNotificationDigestKey(digest);
        activeDigestKey = digestKey;
        activeItemCount = digest.items.length;
        if (digest.items.length === 0) return NextResponse.json({ success: true, delivered: false, reason: 'no-attention-items', digestKey });
        if (dryRun) return NextResponse.json({ success: true, delivered: false, reason: 'dry-run', digestKey, digest });

        const outcome = await executeResearchNotificationDelivery({
            digest,
            digestKey,
            reserve: reserveResearchNotificationDigest,
            deliver: () => deliverResearchNotification({ endpoint: endpoint!, secret: webhookSecret!, digest, digestKey }),
            markDelivered: markResearchNotificationDigestDelivered,
            release: releaseResearchNotificationDigest,
        });
        if (outcome === 'duplicate') {
            await recordResearchNotificationDelivery(digestKey, digest.items.length, 'duplicate', 'Digest already delivered.');
            return NextResponse.json({ success: true, delivered: false, reason: 'duplicate', digestKey });
        }
        await recordResearchNotificationDelivery(digestKey, digest.items.length, 'delivered');
        return NextResponse.json({ success: true, delivered: true, digestKey, itemCount: digest.items.length });
    } catch (error) {
        if (activeDigestKey) {
            try {
                await recordResearchNotificationDelivery(
                    activeDigestKey,
                    activeItemCount,
                    'failed',
                    error instanceof Error ? error.message : 'Notification delivery failed.',
                );
            } catch {
                // Preserve the delivery failure as the route's primary error.
            }
        }
        return NextResponse.json({ success: false, delivered: false, error: error instanceof Error ? error.message : 'Notification delivery failed.' }, { status: 502 });
    }
};
