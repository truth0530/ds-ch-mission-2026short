import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getServerSupabaseClient, getRequestIp } from '@/lib/supabase-server';
import { formatTourReservation, toPublicReservation } from '@/lib/tour';
import { hashPin } from '@/lib/pin-hash';
import { sanitizeInput } from '@/lib/validators';
import type { TourReservationRpcRow } from '@/types';

// POST: 새 예약 생성
export async function POST(request: NextRequest) {
    try {
        const client = getServerSupabaseClient();
        if (!client) {
            return NextResponse.json({ error: 'DB 연결 실패' }, { status: 500 });
        }

        const ip = getRequestIp(request);
        if (!checkRateLimit(`tour:create:${ip}`, 5, 10 * 60 * 1000)) {
            return NextResponse.json({ error: '잠시 후 다시 시도해주세요' }, { status: 429 });
        }

        const body = await request.json();
        const { slot_id, name, pin, memo } = body;

        if (!slot_id || !name || !pin) {
            return NextResponse.json({ error: '필수 항목을 입력해주세요' }, { status: 400 });
        }

        if (!/^\d{4}$/.test(pin)) {
            return NextResponse.json({ error: '비밀번호는 숫자 4자리여야 합니다' }, { status: 400 });
        }

        const cleanName = sanitizeInput(name.trim());

        if (cleanName.length < 2) {
            return NextResponse.json({ error: '조장 이름을 선택해주세요' }, { status: 400 });
        }

        const { data: leader, error: leaderError } = await client
            .from('tour_leaders')
            .select('id')
            .eq('name', cleanName)
            .eq('is_active', true)
            .maybeSingle();

        if (leaderError) {
            return NextResponse.json({ error: leaderError.message }, { status: 500 });
        }

        if (!leader) {
            return NextResponse.json({ error: '조장 목록에서 이름을 선택해주세요' }, { status: 400 });
        }

        // Check for existing active reservation with the same name
        const { data: existing } = await client
            .from('tour_reservations')
            .select('id')
            .eq('name', cleanName)
            .eq('status', 'active')
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ error: '이미 신청된 조장입니다' }, { status: 409 });
        }

        const { data: reservation, error } = await client.rpc('create_tour_reservation', {
            p_slot_id: slot_id,
            p_name: cleanName,
            p_phone: null,
            p_email: null,
            p_memo: memo ? sanitizeInput(memo.trim()) : null,
            p_pin: hashPin(pin),
        });

        if (error) {
            if (error.message?.includes('DUPLICATE_LEADER')) {
                return NextResponse.json({ error: '이미 신청된 조장입니다' }, { status: 409 });
            }
            if (error.message?.includes('SLOT_FULL')) {
                return NextResponse.json({ error: '해당 일정은 마감되었습니다' }, { status: 409 });
            }
            if (error.message?.includes('INVALID_SLOT')) {
                return NextResponse.json({ error: '존재하지 않는 일정입니다' }, { status: 404 });
            }
            if (error.message?.includes('INACTIVE_SLOT')) {
                return NextResponse.json({ error: '비활성화된 일정입니다' }, { status: 400 });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const row = Array.isArray(reservation) ? reservation[0] : reservation;
        if (!row) {
            return NextResponse.json({ error: '예약 생성에 실패했습니다' }, { status: 500 });
        }

        const rpcRow = row as TourReservationRpcRow;
        const formatted = formatTourReservation(rpcRow);
        return NextResponse.json({ data: toPublicReservation(formatted) }, { status: 201 });
    } catch {
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}
