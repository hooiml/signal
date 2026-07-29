import { NextResponse } from 'next/server';
import {
    getResearchQuoteBatch,
    parseResearchQuoteBatchRequest,
    ResearchQuoteBatchInputError,
    researchQuoteBatchLimits,
} from '@/lib/research/quote-batch';

export const POST = async (request: Request): Promise<NextResponse> => {
    try {
        const body = await request.text();
        if (new TextEncoder().encode(body).length > researchQuoteBatchLimits.maxBodyBytes) {
            return NextResponse.json({ success: false, error: 'Quote request is too large.' }, { status: 413 });
        }
        const payload: unknown = JSON.parse(body);
        const inputs = parseResearchQuoteBatchRequest(payload);
        return NextResponse.json({
            success: true,
            data: {
                fetchedAt: new Date().toISOString(),
                items: await getResearchQuoteBatch(inputs),
            },
        });
    } catch (error) {
        const invalidInput = error instanceof ResearchQuoteBatchInputError || error instanceof SyntaxError;
        return NextResponse.json({
            success: false,
            error: invalidInput ? error.message : 'Live quotes are temporarily unavailable.',
        }, { status: invalidInput ? 400 : 502 });
    }
};
