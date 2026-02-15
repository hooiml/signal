
import { NextResponse } from 'next/server';
import { updateInstitutionalIndicator } from '@/lib/institutional-service';

export async function POST(request: Request) {
    const authHeader = request.headers.get('authorization');
    const adminSecret = process.env.ADMIN_SECRET || 'dev-secret';

    if (authHeader !== `Bearer ${adminSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { name, value, date } = body;

        // Validation
        if (!name || value === undefined || !date) {
            return NextResponse.json({ error: 'Missing required fields (name, value, date)' }, { status: 400 });
        }

        const validIndicators = ['aaii', 'bofa', 'naaim'];
        if (!validIndicators.includes(name.toLowerCase())) {
            return NextResponse.json({ error: `Invalid indicator name. Must be one of: ${validIndicators.join(', ')}` }, { status: 400 });
        }

        const success = await updateInstitutionalIndicator(name.toLowerCase(), value, date);

        if (success) {
            return NextResponse.json({ success: true, message: `Updated ${name} to ${value} for ${date}` });
        } else {
            return NextResponse.json({ success: false, error: 'Failed to update database' }, { status: 500 });
        }
    } catch (error) {
        console.error('Admin API error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
