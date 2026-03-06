import { NextResponse } from 'next/server';
import { TABLES } from '@/lib/constants';
import { getServerSupabaseClient } from '@/lib/supabase-server';

// GET: 공개 예약 현황 (이름 + 슬롯 정보만, 민감정보 제외)
export async function GET() {
    try {
        const client = getServerSupabaseClient();
        if (!client) {
            return NextResponse.json({ error: 'DB 연결 실패' }, { status: 500 });
        }

        const { data, error } = await client
            .from(TABLES.TOUR_RESERVATIONS)
            .select('name, slot_id, status, tour_slots(tour_date, tour_time, time_label)')
            .eq('status', 'active')
            .order('created_at', { ascending: true });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data });
    } catch {
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}
