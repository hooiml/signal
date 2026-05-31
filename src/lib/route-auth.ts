import { NextResponse } from 'next/server';

const isConfiguredSecret = (secret: string | null | undefined): secret is string =>
    typeof secret === 'string' && secret.length > 0;

export function requireAnyBearerSecret(
    request: Request,
    secrets: Array<string | null | undefined>,
    missingConfigMessage: string,
    unauthorizedMessage = 'Unauthorized'
): NextResponse | null {
    const configuredSecrets = secrets.filter(isConfiguredSecret);

    if (configuredSecrets.length === 0) {
        return NextResponse.json({ error: missingConfigMessage }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');
    const isAuthorized = authHeader !== null
        && configuredSecrets.some(secret => authHeader === `Bearer ${secret}`);

    if (!isAuthorized) {
        return NextResponse.json({ error: unauthorizedMessage }, { status: 401 });
    }

    return null;
}

export function requireBearerSecret(
    request: Request,
    secret: string | null | undefined,
    missingConfigMessage: string,
    unauthorizedMessage = 'Unauthorized'
): NextResponse | null {
    return requireAnyBearerSecret(request, [secret], missingConfigMessage, unauthorizedMessage);
}
