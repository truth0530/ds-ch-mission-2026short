import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { ENV_CONFIG, TABLES } from '@/lib/constants';

function getServerClient() {
    const supabaseUrl = ENV_CONFIG.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ENV_CONFIG.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return null;
    return createClient(supabaseUrl, supabaseKey);
}

// GET: 모든 슬롯 + 예약 목록 (관리자용)
export async function GET() {
    try {
        const client = getServerClient();
        if (!client) {
            return NextResponse.json({ error: 'DB 연결 실패' }, { status: 500 });
        }

        const [slotsResult, reservationsResult] = await Promise.all([
            client
                .from(TABLES.TOUR_SLOTS)
                .select('*')
                .order('tour_date', { ascending: true })
                .order('tour_time', { ascending: true }),
            client
                .from(TABLES.TOUR_RESERVATIONS)
                .select('*, tour_slots(tour_date, tour_time, time_label)')
                .order('created_at', { ascending: false }),
        ]);

        if (slotsResult.error) {
            return NextResponse.json({ error: slotsResult.error.message }, { status: 500 });
        }

        if (reservationsResult.error) {
            return NextResponse.json({ error: reservationsResult.error.message }, { status: 500 });
        }

        return NextResponse.json({
            slots: slotsResult.data,
            reservations: reservationsResult.data,
        });
    } catch {
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}
