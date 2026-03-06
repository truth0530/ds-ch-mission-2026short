import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { ENV_CONFIG, TABLES, TOUR_CONFIG } from '@/lib/constants';
import { sanitizeInput } from '@/lib/validators';

function getServerClient() {
    const supabaseUrl = ENV_CONFIG.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ENV_CONFIG.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return null;
    return createClient(supabaseUrl, supabaseKey);
}

function generateReservationCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < TOUR_CONFIG.RESERVATION_CODE_LENGTH; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function isValidPhone(phone: string): boolean {
    return /^[\d\-\s()+ ]{8,20}$/.test(phone);
}

// POST: 새 예약 생성
export async function POST(request: NextRequest) {
    try {
        const client = getServerClient();
        if (!client) {
            return NextResponse.json({ error: 'DB 연결 실패' }, { status: 500 });
        }

        const body = await request.json();
        const { slot_id, name, phone, email, memo } = body;

        if (!slot_id || !name || !phone) {
            return NextResponse.json({ error: '필수 항목을 입력해주세요 (이름, 연락처)' }, { status: 400 });
        }

        const cleanName = sanitizeInput(name.trim());
        const cleanPhone = sanitizeInput(phone.trim());

        if (cleanName.length < 2) {
            return NextResponse.json({ error: '이름을 2자 이상 입력해주세요' }, { status: 400 });
        }

        if (!isValidPhone(cleanPhone)) {
            return NextResponse.json({ error: '올바른 연락처를 입력해주세요' }, { status: 400 });
        }

        // 슬롯 잔여석 확인
        const { data: slot, error: slotError } = await client
            .from(TABLES.TOUR_SLOTS)
            .select('id, current_bookings, max_capacity, is_active')
            .eq('id', slot_id)
            .single();

        if (slotError || !slot) {
            return NextResponse.json({ error: '존재하지 않는 일정입니다' }, { status: 404 });
        }

        if (!slot.is_active) {
            return NextResponse.json({ error: '비활성화된 일정입니다' }, { status: 400 });
        }

        if (slot.current_bookings >= slot.max_capacity) {
            return NextResponse.json({ error: '해당 일정은 마감되었습니다' }, { status: 409 });
        }

        // 예약번호 생성 (중복 방지 재시도)
        let reservationCode = '';
        for (let i = 0; i < 5; i++) {
            const code = generateReservationCode();
            const { data: existing } = await client
                .from(TABLES.TOUR_RESERVATIONS)
                .select('id')
                .eq('reservation_code', code)
                .single();
            if (!existing) {
                reservationCode = code;
                break;
            }
        }

        if (!reservationCode) {
            return NextResponse.json({ error: '예약번호 생성에 실패했습니다. 다시 시도해주세요.' }, { status: 500 });
        }

        const { data: reservation, error: insertError } = await client
            .from(TABLES.TOUR_RESERVATIONS)
            .insert({
                slot_id,
                reservation_code: reservationCode,
                name: cleanName,
                phone: cleanPhone,
                email: email ? sanitizeInput(email.trim()) : null,
                memo: memo ? sanitizeInput(memo.trim()) : null,
            })
            .select('*, tour_slots(tour_date, tour_time, time_label)')
            .single();

        if (insertError) {
            if (insertError.message?.includes('check_capacity')) {
                return NextResponse.json({ error: '해당 일정은 마감되었습니다' }, { status: 409 });
            }
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        return NextResponse.json({ data: reservation }, { status: 201 });
    } catch {
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}
