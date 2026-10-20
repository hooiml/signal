import { NextResponse } from 'next/server';

// Single-owner access boundary for saved research. The owner proves knowledge of
// OWNER_ACCESS_SECRET once; the server then issues an HttpOnly cookie carrying an
// HMAC-signed issue time. No account or user table is involved.

export const ownerAccessCookieName = 'signal_owner';
export const ownerAccessMaxAgeSeconds = 30 * 24 * 60 * 60;
const minSecretLength = 32;
const maxSecretLength = 256;
const allowedClockSkewMs = 5 * 60 * 1000;
const tokenVersion = 'v1';

export type OwnerAccessFailure = 'unconfigured' | 'unauthorized';

const encoder = new TextEncoder();

const toBase64Url = (bytes: ArrayBuffer): string =>
    Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromBase64Url = (value: string): Uint8Array<ArrayBuffer> | null => {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
    return Uint8Array.from(Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
};

export const readOwnerAccessSecret = (
    environment: Readonly<Record<string, string | undefined>> = process.env,
): string | null => {
    const secret = environment.OWNER_ACCESS_SECRET ?? '';
    return secret.length >= minSecretLength && secret.length <= maxSecretLength && /^[\x21-\x7e]+$/.test(secret)
        ? secret
        : null;
};

const signingKey = (secret: string): Promise<CryptoKey> =>
    crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

const payload = (issuedAt: number): Uint8Array<ArrayBuffer> => encoder.encode(`signal-owner:${tokenVersion}:${issuedAt}`);

const digest = async (value: string): Promise<Uint8Array> =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));

const constantTimeEqual = (left: Uint8Array, right: Uint8Array): boolean => {
    if (left.byteLength !== right.byteLength) return false;
    let difference = 0;
    for (let index = 0; index < left.byteLength; index += 1) difference |= left[index] ^ right[index];
    return difference === 0;
};

export const ownerSecretMatches = async (candidate: unknown, secret: string): Promise<boolean> =>
    typeof candidate === 'string'
    && candidate.length <= maxSecretLength
    && constantTimeEqual(await digest(candidate), await digest(secret));

export const issueOwnerAccessToken = async (secret: string, now = Date.now()): Promise<string> => {
    const signature = await crypto.subtle.sign('HMAC', await signingKey(secret), payload(now));
    return `${tokenVersion}.${now}.${toBase64Url(signature)}`;
};

export const verifyOwnerAccessToken = async (token: string | null | undefined, secret: string, now = Date.now()): Promise<boolean> => {
    const match = token?.match(/^v1\.(\d{13})\.([A-Za-z0-9_-]{43})$/);
    if (!match) return false;
    const issuedAt = Number(match[1]);
    if (issuedAt > now + allowedClockSkewMs || now - issuedAt > ownerAccessMaxAgeSeconds * 1000) return false;
    const signature = fromBase64Url(match[2]);
    if (!signature) return false;
    return crypto.subtle.verify('HMAC', await signingKey(secret), signature, payload(issuedAt));
};

const readCookie = (header: string | null, name: string): string | null => {
    for (const part of header?.split(';') ?? []) {
        const separator = part.indexOf('=');
        if (separator > 0 && part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
    }
    return null;
};

export const checkOwnerAccess = async (
    request: Request,
    environment: Readonly<Record<string, string | undefined>> = process.env,
    now = Date.now(),
): Promise<OwnerAccessFailure | null> => {
    const secret = readOwnerAccessSecret(environment);
    if (!secret) return 'unconfigured';
    return await verifyOwnerAccessToken(readCookie(request.headers.get('cookie'), ownerAccessCookieName), secret, now)
        ? null
        : 'unauthorized';
};

export const ownerAccessFailureResponse = (failure: OwnerAccessFailure): NextResponse =>
    failure === 'unconfigured'
        ? NextResponse.json({ success: false, error: 'Owner access is not configured on this server.', code: 'OWNER_ACCESS_UNCONFIGURED' }, { status: 503 })
        : NextResponse.json({ success: false, error: 'Unlock Signal to access saved research.', code: 'OWNER_ACCESS_REQUIRED' }, { status: 401 });

// Returns a response to send when access is denied, or null when the owner is verified.
export const requireOwnerAccess = async (request: Request): Promise<NextResponse | null> => {
    const failure = await checkOwnerAccess(request);
    return failure ? ownerAccessFailureResponse(failure) : null;
};

export const ownerAccessCookieOptions = (maxAge: number) => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
});
