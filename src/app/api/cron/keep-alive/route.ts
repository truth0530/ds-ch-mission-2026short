import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const client = getServerSupabaseClient();
        if (!client) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
        }

        const { count, error } = await client
            .from('tour_slots')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('Keep-alive query error:', error);
            return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Keep-alive ping successful',
            slotCount: count,
            timestamp: new Date().toISOString(),
        });
    } catch {
        return NextResponse.json({ error: 'Keep-alive failed' }, { status: 500 });
    }
}
