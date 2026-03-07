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
                .select('id, slot_id, reservation_code, name, phone, email, memo, status, created_at, updated_at, tour_slots(tour_date, tour_time, time_label)')
                .order('created_at', { ascending: false }),
        ]);

        if (slotsResult.error) {
            console.error('관리자 슬롯 조회 실패:', slotsResult.error.message);
            return NextResponse.json({ error: '처리 중 오류가 발생했습니다' }, { status: 500 });
        }

        if (leadersResult.error) {
            console.error('관리자 조장 조회 실패:', leadersResult.error.message);
            return NextResponse.json({ error: '처리 중 오류가 발생했습니다' }, { status: 500 });
        }

        if (reservationsResult.error) {
            console.error('관리자 예약 조회 실패:', reservationsResult.error.message);
            return NextResponse.json({ error: '처리 중 오류가 발생했습니다' }, { status: 500 });
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
