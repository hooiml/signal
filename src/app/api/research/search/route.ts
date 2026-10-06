import { NextResponse } from 'next/server';
import { searchSecurities, validSecurityQuery } from '@/lib/research/security-search';

export async function GET(request: Request): Promise<NextResponse> {
    const params = new URL(request.url).searchParams;
    const query = params.get('q')?.trim() ?? '';
    const market = params.get('market');
    if (!validSecurityQuery(query) || (market !== 'US' && market !== 'MY')) {
        return NextResponse.json({ success: false, error: 'Enter a company name or ticker (up to 80 characters) and choose US or Malaysia.' }, { status: 400 });
    }
    try {
        return NextResponse.json({ success: true, data: await searchSecurities(query, market), source: 'Yahoo Finance' });
    } catch {
        return NextResponse.json({ success: false, error: 'Security search is temporarily unavailable. Retry or read a known ticker directly.' }, { status: 502 });
    }
}
