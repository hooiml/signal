import { NextResponse } from 'next/server';
import { getResearchAlerts } from '@/lib/research/alert-service';
import type { AlertTickerInput } from '@/lib/types/research-alert';
import { parseResearchMonitoringRules, parseResearchUpdateInput, ResearchInputError } from '@/lib/research/input';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const isCalendarDate = (value: string) => {
    if (!datePattern.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const parseInput = (value: unknown): AlertTickerInput | null => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const input = Object.fromEntries(Object.entries(value));
    if (typeof input.symbol !== 'string' || !/^[A-Z0-9.-]{1,15}$/.test(input.symbol)) return null;
    if (input.market !== 'US' && input.market !== 'MY') return null;
    if (typeof input.targetBuyZone !== 'string' || input.targetBuyZone.length > 60) return null;
    if (typeof input.lastReviewedAt !== 'string' || !isCalendarDate(input.lastReviewedAt)) return null;
    try {
        return {
            symbol: input.symbol,
            market: input.market,
            targetBuyZone: input.targetBuyZone,
            lastReviewedAt: input.lastReviewedAt,
            acceptedEvidence: parseResearchUpdateInput({ acceptedEvidence: input.acceptedEvidence }).acceptedEvidence ?? [],
            monitoringRules: parseResearchMonitoringRules(input.monitoringRules),
        };
    } catch (error) {
        if (error instanceof ResearchInputError) return null;
        throw error;
    }
};

export const POST = async (request: Request): Promise<NextResponse> => {
    try {
        const payload: unknown = await request.json();
        if (!Array.isArray(payload) || payload.length === 0 || payload.length > 50) {
            return NextResponse.json({ success: false, error: 'Provide between 1 and 50 tickers.' }, { status: 400 });
        }
        const inputs = payload.map(parseInput);
        if (inputs.some((input) => input === null)) return NextResponse.json({ success: false, error: 'Invalid ticker alert input.' }, { status: 400 });
        const parsed = inputs.filter((input): input is AlertTickerInput => input !== null);
        return NextResponse.json({ success: true, data: await getResearchAlerts(parsed) });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Research alerts are temporarily unavailable.',
        }, { status: 502 });
    }
};
