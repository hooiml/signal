import { NextResponse } from 'next/server';
import {
    getResearchNotificationSettings,
    listResearchNotificationHistory,
    saveResearchNotificationSettings,
} from '@/lib/research/notification-store';
import { ResearchNotificationSettingsError } from '@/lib/types/research-notification-settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const responseData = async () => ({
    settings: await getResearchNotificationSettings(),
    configured: Boolean(process.env.RESEARCH_NOTIFICATION_WEBHOOK_URL && process.env.RESEARCH_NOTIFICATION_WEBHOOK_SECRET),
    history: await listResearchNotificationHistory(),
});

export const GET = async (): Promise<NextResponse> => {
    try {
        return NextResponse.json({ success: true, data: await responseData() });
    } catch (error) {
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Notification settings unavailable.' }, { status: 503 });
    }
};

export const PUT = async (request: Request): Promise<NextResponse> => {
    try {
        await saveResearchNotificationSettings(await request.json());
        return NextResponse.json({ success: true, data: await responseData() });
    } catch (error) {
        const status = error instanceof ResearchNotificationSettingsError || error instanceof SyntaxError ? 400 : 503;
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Notification settings could not be saved.' }, { status });
    }
};
