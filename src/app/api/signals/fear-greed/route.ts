import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type FearGreedHistoryPoint = {
    readonly date: string;
    readonly score: number;
    readonly rating: string;
};

export type FearGreedPayload =
    | {
          readonly available: true;
          readonly score: number;
          readonly rating: string;
          readonly previousClose: number | null;
          readonly oneWeekAgo: number | null;
          readonly oneMonthAgo: number | null;
          readonly updatedAt: string | null;
          readonly history: readonly FearGreedHistoryPoint[];
      }
    | {
          readonly available: false;
          readonly reason: string;
      };

const CNN_FEAR_GREED_URL = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';
const CACHE_TTL_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 3500;
const UNAVAILABLE_MESSAGE = 'CNN Fear & Greed feed is currently unavailable.';

let cachedEntry: { readonly payload: Extract<FearGreedPayload, { readonly available: true }>; readonly expiresAt: number } | null = null;

const finiteScore = (value: unknown): number | null => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return Math.min(100, Math.max(0, Math.round(value)));
};

const deriveRating = (score: number): string => {
    if (score < 25) return 'Extreme Fear';
    if (score < 45) return 'Fear';
    if (score <= 55) return 'Neutral';
    if (score <= 75) return 'Greed';
    return 'Extreme Greed';
};

const parseHistory = (raw: unknown): readonly FearGreedHistoryPoint[] => {
    if (typeof raw !== 'object' || raw === null) return [];
    const historical = Reflect.get(raw, 'fear_and_greed_historical');
    if (typeof historical !== 'object' || historical === null) return [];
    const rows = Reflect.get(historical, 'data');
    if (!Array.isArray(rows)) return [];

    const byDate = new Map<string, FearGreedHistoryPoint>();
    for (const row of rows) {
        if (typeof row !== 'object' || row === null) continue;
        const x = Reflect.get(row, 'x');
        const y = Reflect.get(row, 'y');
        if (typeof x !== 'number' || !Number.isFinite(x) || typeof y !== 'number' || !Number.isFinite(y)) continue;
        const parsedDate = new Date(x);
        if (Number.isNaN(parsedDate.getTime())) continue;
        const date = parsedDate.toISOString().slice(0, 10);
        const score = Math.round(Math.min(100, Math.max(0, y)) * 10) / 10;
        const ratingRaw = Reflect.get(row, 'rating');
        const rating = typeof ratingRaw === 'string' && ratingRaw.trim() ? ratingRaw.trim() : deriveRating(score);
        byDate.set(date, { date, score, rating });
    }

    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
};

const parseFearGreed = (raw: unknown): Extract<FearGreedPayload, { readonly available: true }> | null => {
    if (typeof raw !== 'object' || raw === null) return null;
    const node = Reflect.get(raw, 'fear_and_greed');
    if (typeof node !== 'object' || node === null) return null;

    const score = finiteScore(Reflect.get(node, 'score'));
    if (score === null) return null;

    const ratingRaw = Reflect.get(node, 'rating');
    const rating = typeof ratingRaw === 'string' && ratingRaw.trim() ? ratingRaw.trim() : 'Neutral';
    const updatedRaw = Reflect.get(node, 'timestamp');
    const updatedAt = typeof updatedRaw === 'string' && updatedRaw.trim() ? updatedRaw.trim() : null;

    return {
        available: true,
        score,
        rating,
        previousClose: finiteScore(Reflect.get(node, 'previous_close')),
        oneWeekAgo: finiteScore(Reflect.get(node, 'previous_1_week')),
        oneMonthAgo: finiteScore(Reflect.get(node, 'previous_1_month')),
        updatedAt,
        history: parseHistory(raw),
    };
};

export const GET = async (): Promise<NextResponse> => {
    const now = Date.now();
    if (cachedEntry && cachedEntry.expiresAt > now) {
        return NextResponse.json({ success: true, data: cachedEntry.payload });
    }

    try {
        const response = await fetch(CNN_FEAR_GREED_URL, {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            headers: {
                Accept: 'application/json',
                'User-Agent': 'Signal-Workspace/9.0',
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            return NextResponse.json({ success: true, data: { available: false, reason: UNAVAILABLE_MESSAGE } satisfies FearGreedPayload });
        }

        const parsed = parseFearGreed(await response.json());
        if (!parsed) {
            return NextResponse.json({ success: true, data: { available: false, reason: UNAVAILABLE_MESSAGE } satisfies FearGreedPayload });
        }

        cachedEntry = { payload: parsed, expiresAt: now + CACHE_TTL_MS };
        return NextResponse.json({ success: true, data: parsed satisfies FearGreedPayload });
    } catch {
        return NextResponse.json({ success: true, data: { available: false, reason: UNAVAILABLE_MESSAGE } satisfies FearGreedPayload });
    }
};
