import { NextRequest, NextResponse } from 'next/server';
import { TABLES } from '@/lib/constants';
import { getServerSupabaseClient, requireAdminUser } from '@/lib/supabase-server';

// GET: 모든 슬롯 + 예약 목록 (관리자용)
export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdminUser(request);
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const client = getServerSupabaseClient();
        if (!client) {
            return NextResponse.json({ error: 'DB 연결 실패' }, { status: 500 });
        }

        const [slotsResult, leadersResult, reservationsResult] = await Promise.all([
            client
                .from(TABLES.TOUR_SLOTS)
                .select('*')
                .order('tour_date', { ascending: true })
                .order('tour_time', { ascending: true }),
            client
                .from('tour_leaders')
                .select('*')
                .order('group_number', { ascending: true }),
            client
                .from(TABLES.TOUR_RESERVATIONS)
                .select('*, tour_slots(tour_date, tour_time, time_label)')
                .order('created_at', { ascending: false }),
        ]);

        if (slotsResult.error) {
            return NextResponse.json({ error: slotsResult.error.message }, { status: 500 });
        }

        if (leadersResult.error) {
            return NextResponse.json({ error: leadersResult.error.message }, { status: 500 });
        }

        if (reservationsResult.error) {
            return NextResponse.json({ error: reservationsResult.error.message }, { status: 500 });
        }

        return NextResponse.json({
            slots: slotsResult.data,
            leaders: leadersResult.data,
            reservations: reservationsResult.data,
        });
    } catch {
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}
