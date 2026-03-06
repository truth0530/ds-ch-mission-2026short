import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { ENV_CONFIG, TABLES } from '@/lib/constants';

function getServerClient() {
    const supabaseUrl = ENV_CONFIG.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ENV_CONFIG.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return null;
    return createClient(supabaseUrl, supabaseKey);
}

// PATCH: 예약 변경 (날짜 변경 또는 취소)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const client = getServerClient();
        if (!client) {
            return NextResponse.json({ error: 'DB 연결 실패' }, { status: 500 });
        }

        const body = await request.json();
        const { action, new_slot_id } = body;

        // 예약 존재 확인
        const { data: reservation, error: findError } = await client
            .from(TABLES.TOUR_RESERVATIONS)
            .select('*')
            .eq('id', id)
            .single();

        if (findError || !reservation) {
            return NextResponse.json({ error: '예약을 찾을 수 없습니다' }, { status: 404 });
        }

        if (action === 'cancel') {
            if (reservation.status === 'cancelled') {
                return NextResponse.json({ error: '이미 취소된 예약입니다' }, { status: 400 });
            }

            const { data, error } = await client
                .from(TABLES.TOUR_RESERVATIONS)
                .update({ status: 'cancelled' })
                .eq('id', id)
                .select('*, tour_slots(tour_date, tour_time, time_label)')
                .single();

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ data });
        }

        if (action === 'change_slot') {
            if (!new_slot_id) {
                return NextResponse.json({ error: '변경할 일정을 선택해주세요' }, { status: 400 });
            }

            if (reservation.status === 'cancelled') {
                return NextResponse.json({ error: '취소된 예약은 변경할 수 없습니다' }, { status: 400 });
            }

            // 새 슬롯 잔여석 확인
            const { data: newSlot, error: slotError } = await client
                .from(TABLES.TOUR_SLOTS)
                .select('id, current_bookings, max_capacity, is_active')
                .eq('id', new_slot_id)
                .single();

            if (slotError || !newSlot) {
                return NextResponse.json({ error: '존재하지 않는 일정입니다' }, { status: 404 });
            }

            if (!newSlot.is_active) {
                return NextResponse.json({ error: '비활성화된 일정입니다' }, { status: 400 });
            }

            if (newSlot.current_bookings >= newSlot.max_capacity) {
                return NextResponse.json({ error: '해당 일정은 마감되었습니다' }, { status: 409 });
            }

            const { data, error } = await client
                .from(TABLES.TOUR_RESERVATIONS)
                .update({ slot_id: new_slot_id })
                .eq('id', id)
                .select('*, tour_slots(tour_date, tour_time, time_label)')
                .single();

            if (error) {
                if (error.message?.includes('check_capacity')) {
                    return NextResponse.json({ error: '해당 일정은 마감되었습니다' }, { status: 409 });
                }
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ data });
        }

        return NextResponse.json({ error: '올바른 action을 지정해주세요 (cancel, change_slot)' }, { status: 400 });
    } catch {
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}
