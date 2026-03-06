import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { ENV_CONFIG, TABLES } from '@/lib/constants';
import { sanitizeInput } from '@/lib/validators';

function getServerClient() {
    const supabaseUrl = ENV_CONFIG.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ENV_CONFIG.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return null;
    return createClient(supabaseUrl, supabaseKey);
}

// POST: 예약번호 + 이름으로 조회
export async function POST(request: NextRequest) {
    try {
        const client = getServerClient();
        if (!client) {
            return NextResponse.json({ error: 'DB 연결 실패' }, { status: 500 });
        }

        const body = await request.json();
        const { reservation_code, name } = body;

        if (!reservation_code || !name) {
            return NextResponse.json({ error: '예약번호와 이름을 입력해주세요' }, { status: 400 });
        }

        const cleanCode = sanitizeInput(reservation_code.trim().toUpperCase());
        const cleanName = sanitizeInput(name.trim());

        const { data, error } = await client
            .from(TABLES.TOUR_RESERVATIONS)
            .select('*, tour_slots(tour_date, tour_time, time_label)')
            .eq('reservation_code', cleanCode)
            .eq('name', cleanName)
            .single();

        if (error || !data) {
            return NextResponse.json({ error: '일치하는 예약을 찾을 수 없습니다' }, { status: 404 });
        }

        return NextResponse.json({ data });
    } catch {
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}
