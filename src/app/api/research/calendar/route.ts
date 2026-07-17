import { NextResponse } from 'next/server';
import { getResearchCalendar } from '@/lib/research/calendar';
import {
    parseResearchCalendarInputs,
    parseResearchCalendarQuery,
    ResearchCalendarInputError,
} from '@/lib/research/calendar-input';

export const POST = async (request: Request): Promise<NextResponse> => {
    try {
        const query = parseResearchCalendarQuery(new URL(request.url).searchParams);
        let payload: unknown;
        try {
            payload = await request.json();
        } catch {
            throw new ResearchCalendarInputError('Research calendar body must be valid JSON.');
        }
        const inputs = parseResearchCalendarInputs(payload);
        const data = await getResearchCalendar(inputs, query);
        return NextResponse.json({ success: true, data });
    } catch (error) {
        if (error instanceof ResearchCalendarInputError) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Research calendar is temporarily unavailable.',
        }, { status: 502 });
    }
};
