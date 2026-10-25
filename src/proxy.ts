import { NextResponse, type NextRequest } from 'next/server';
import { legacyRouteDestination } from './lib/legacy-routes';

export function proxy(request: NextRequest) {
    const destination = legacyRouteDestination(request.nextUrl.pathname, request.nextUrl.searchParams);
    if (!destination) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = destination;
    // Do not rebuild the query: duplicate values and unknown safe keys belong to the link.
    // Fragments are browser-owned and are inherited by HTTP/client redirects.
    return NextResponse.redirect(url, 307);
}

export const config = {
    matcher: ['/', '/research', '/main-v2', '/main-v4', '/main-v5', '/main-v6', '/main-v7',
        '/research-v2', '/research-v4', '/research-v5', '/research-v6', '/research-v7',
        '/backup/main', '/backup/research'],
};
