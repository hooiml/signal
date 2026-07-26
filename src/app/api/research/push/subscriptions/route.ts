import { NextResponse } from 'next/server';
import { ResearchSyncError } from '@/lib/research/sync-vault';
import {
    parseResearchPushRemoval,
    researchPushLimits,
    ResearchPushInputError,
} from '@/lib/pwa/push-contract';
import {
    authorizeResearchPushRequest,
    encryptResearchPushSubscription,
    readResearchPushConfiguration,
    requireSameOriginMutation,
    researchPushEndpointHash,
    ResearchPushConfigurationError,
} from '@/lib/pwa/push-security';
import {
    countActiveResearchPushSubscriptions,
    removeResearchPushSubscription,
    upsertResearchPushSubscription,
} from '@/lib/pwa/push-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const response = (data: unknown, status = 200): NextResponse => NextResponse.json(
    status < 400 ? { success: true, data } : { success: false, error: data },
    { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
);

const errorResponse = (error: unknown): NextResponse => {
    if (error instanceof ResearchPushInputError || error instanceof ResearchSyncError) {
        return response(error.message, error.status);
    }
    if (error instanceof ResearchPushConfigurationError) return response(error.message, 503);
    if (error instanceof SyntaxError) return response('Push subscription request must be valid JSON.', 400);
    return response('Web Push subscriptions are unavailable.', 503);
};

const readBoundedJson = async (request: Request): Promise<unknown> => {
    const length = Number(request.headers.get('content-length') ?? 0);
    if (Number.isFinite(length) && length > researchPushLimits.maxBodyBytes) {
        throw new ResearchPushInputError('Push subscription request is too large.', 413);
    }
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > researchPushLimits.maxBodyBytes) {
        throw new ResearchPushInputError('Push subscription request is too large.', 413);
    }
    return JSON.parse(body);
};

export const GET = async (request: Request): Promise<NextResponse> => {
    try {
        authorizeResearchPushRequest(request);
        const configuration = readResearchPushConfiguration();
        return response({
            configured: true,
            publicKey: configuration.publicKey,
            subscribedCount: await countActiveResearchPushSubscriptions(),
            maximumSubscriptions: researchPushLimits.maxSubscriptionsPerUser,
        });
    } catch (error) {
        return errorResponse(error);
    }
};

export const POST = async (request: Request): Promise<NextResponse> => {
    try {
        authorizeResearchPushRequest(request);
        requireSameOriginMutation(request);
        const configuration = readResearchPushConfiguration();
        const encrypted = encryptResearchPushSubscription(await readBoundedJson(request), configuration);
        const saved = await upsertResearchPushSubscription(encrypted);
        if (!saved) return response('This account has reached the Web Push device limit.', 409);
        return response({ subscribed: true });
    } catch (error) {
        return errorResponse(error);
    }
};

export const DELETE = async (request: Request): Promise<NextResponse> => {
    try {
        authorizeResearchPushRequest(request);
        requireSameOriginMutation(request);
        const { endpoint } = parseResearchPushRemoval(await readBoundedJson(request));
        await removeResearchPushSubscription(researchPushEndpointHash(endpoint));
        return response({ subscribed: false });
    } catch (error) {
        return errorResponse(error);
    }
};
