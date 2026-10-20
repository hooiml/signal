import { NextResponse } from 'next/server';
import {
    checkOwnerAccess,
    issueOwnerAccessToken,
    ownerAccessCookieName,
    ownerAccessCookieOptions,
    ownerAccessFailureResponse,
    ownerAccessMaxAgeSeconds,
    ownerSecretMatches,
    readOwnerAccessSecret,
} from '@/lib/owner-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = async (request: Request) => {
    const failure = await checkOwnerAccess(request);
    return NextResponse.json({ success: true, data: { configured: failure !== 'unconfigured', unlocked: failure === null } });
};

export const POST = async (request: Request) => {
    const secret = readOwnerAccessSecret();
    if (!secret) return ownerAccessFailureResponse('unconfigured');
    let candidate: unknown = null;
    try {
        const body: unknown = await request.json();
        if (typeof body === 'object' && body !== null && !Array.isArray(body)) candidate = Object.fromEntries(Object.entries(body)).secret;
    } catch {
        return NextResponse.json({ success: false, error: 'Unlock request must be JSON.' }, { status: 400 });
    }
    if (!await ownerSecretMatches(candidate, secret)) {
        return NextResponse.json({ success: false, error: 'That access secret is not correct.' }, { status: 401 });
    }
    const response = NextResponse.json({ success: true, data: { configured: true, unlocked: true } });
    response.cookies.set(ownerAccessCookieName, await issueOwnerAccessToken(secret), ownerAccessCookieOptions(ownerAccessMaxAgeSeconds));
    return response;
};

export const DELETE = async () => {
    const response = NextResponse.json({ success: true, data: { configured: readOwnerAccessSecret() !== null, unlocked: false } });
    response.cookies.set(ownerAccessCookieName, '', ownerAccessCookieOptions(0));
    return response;
};
