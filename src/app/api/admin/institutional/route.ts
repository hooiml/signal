
import { NextResponse } from 'next/server';
import { updateInstitutionalIndicator } from '@/lib/institutional-service';
import { requireBearerSecret } from '@/lib/route-auth';

export async function POST(request: Request) {
    const authError = requireBearerSecret(
        request,
        process.env.ADMIN_SECRET,
        'ADMIN_SECRET is not configured'
    );
    if (authError) {
        return authError;
    }

    try {
        const body = await request.json();
        const { name, value, date } = body;

        // Validation
        if (typeof name !== 'string' || value === undefined || typeof date !== 'string') {
            return NextResponse.json({ error: 'Missing required fields (name, value, date)' }, { status: 400 });
        }

        const validIndicators = ['aaii', 'bofa', 'naaim'];
        if (!validIndicators.includes(name.toLowerCase())) {
            return NextResponse.json({ error: `Invalid indicator name. Must be one of: ${validIndicators.join(', ')}` }, { status: 400 });
        }

        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
            return NextResponse.json({ error: 'value must be a finite number' }, { status: 400 });
        }

        const parsedDate = new Date(date);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime())) {
            return NextResponse.json({ error: 'date must use YYYY-MM-DD format' }, { status: 400 });
        }

        const success = await updateInstitutionalIndicator(name.toLowerCase(), numericValue, date);

        if (success) {
            return NextResponse.json({ success: true, message: `Updated ${name} to ${value} for ${date}` });
        }

        return NextResponse.json({ success: false, error: 'Failed to update database' }, { status: 500 });
    } catch (error) {
        console.error('Admin API error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
