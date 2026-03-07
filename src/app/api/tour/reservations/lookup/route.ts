import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getRequestIp, getServerSupabaseClient } from '@/lib/supabase-server';
import { hashPin } from '@/lib/pin-hash';
import { sanitizeInput } from '@/lib/validators';
import type { TourReservationManageView, TourReservationWithSlot } from '@/types';

// POST: 이름 + 비밀번호(PIN)로 조회
export async function POST(request: NextRequest) {
    try {
        const client = getServerSupabaseClient();
        if (!client) {
            return NextResponse.json({ error: 'DB 연결 실패' }, { status: 500 });
        }

        const ip = getRequestIp(request);
        if (!checkRateLimit(`tour:lookup:${ip}`, 20, 10 * 60 * 1000)) {
            return NextResponse.json({ error: '잠시 후 다시 시도해주세요' }, { status: 429 });
        }

        const body = await request.json();
        const { name, pin } = body;

        if (!name || !pin) {
            return NextResponse.json({ error: '이름과 비밀번호를 입력해주세요' }, { status: 400 });
        }

        const cleanName = sanitizeInput(name.trim());
        const cleanPin = sanitizeInput(pin.trim());

        const { data, error } = await client
            .from('tour_reservations')
            .select('*, tour_slots(tour_date, tour_time, time_label)')
            .eq('name', cleanName)
            .eq('manage_token', hashPin(cleanPin))
            .eq('status', 'active')
            .single();

        if (error || !data) {
            return NextResponse.json({ error: '일치하는 예약을 찾을 수 없습니다' }, { status: 404 });
        }

        const reservation = data as TourReservationWithSlot;
        const formatted: TourReservationManageView = {
            reservation_code: reservation.reservation_code,
            manage_token: reservation.manage_token,
            name: reservation.name,
            phone: reservation.phone,
            email: reservation.email,
            memo: reservation.memo,
            status: reservation.status,
            created_at: reservation.created_at,
            updated_at: reservation.updated_at,
            slot_id: reservation.slot_id,
            tour_slots: reservation.tour_slots,
        };

        return NextResponse.json({ data: formatted });
    } catch {
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}
