import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getRequestIp, getServerSupabaseClient } from '@/lib/supabase-server';
import { formatTourReservation } from '@/lib/tour';
import { sanitizeInput } from '@/lib/validators';
import type { TourReservationRpcRow } from '@/types';

function validateManageFields(
  reservationCode: unknown,
  manageToken: unknown,
  name: unknown
) {
  if (
    typeof reservationCode !== 'string' ||
    typeof manageToken !== 'string' ||
    typeof name !== 'string'
  ) {
    return null;
  }

  return {
    reservationCode: sanitizeInput(reservationCode.trim().toUpperCase()),
    manageToken: sanitizeInput(manageToken.trim()),
    name: sanitizeInput(name.trim()),
  };
}

export async function POST(request: NextRequest) {
  try {
    const client = getServerSupabaseClient();
    if (!client) {
      return NextResponse.json({ error: 'DB 연결 실패' }, { status: 500 });
    }

    const ip = getRequestIp(request);
    if (!checkRateLimit(`tour:manage:${ip}`, 20, 10 * 60 * 1000)) {
      return NextResponse.json({ error: '잠시 후 다시 시도해주세요' }, { status: 429 });
    }

    const body = await request.json();
    const { action, reservation_code, manage_token, name, new_slot_id } = body;
    const fields = validateManageFields(reservation_code, manage_token, name);

    if (!fields) {
      return NextResponse.json({ error: '예약번호, 관리번호, 이름을 입력해주세요' }, { status: 400 });
    }

    if (action === 'cancel') {
      const { data, error } = await client.rpc('cancel_tour_reservation', {
        p_reservation_code: fields.reservationCode,
        p_manage_token: fields.manageToken,
        p_name: fields.name,
      });

      if (error) {
        if (error.message?.includes('RESERVATION_NOT_FOUND')) {
          return NextResponse.json({ error: '일치하는 예약을 찾을 수 없습니다' }, { status: 404 });
        }
        if (error.message?.includes('ALREADY_CANCELLED')) {
          return NextResponse.json({ error: '이미 취소된 예약입니다' }, { status: 400 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const row = Array.isArray(data) ? data[0] : data;
      return NextResponse.json({ data: formatTourReservation(row as TourReservationRpcRow) });
    }

    if (action === 'change_slot') {
      if (!new_slot_id || typeof new_slot_id !== 'string') {
        return NextResponse.json({ error: '변경할 일정을 선택해주세요' }, { status: 400 });
      }

      const { data, error } = await client.rpc('change_tour_reservation', {
        p_reservation_code: fields.reservationCode,
        p_manage_token: fields.manageToken,
        p_name: fields.name,
        p_new_slot_id: new_slot_id,
      });

      if (error) {
        if (error.message?.includes('RESERVATION_NOT_FOUND')) {
          return NextResponse.json({ error: '일치하는 예약을 찾을 수 없습니다' }, { status: 404 });
        }
        if (error.message?.includes('RESERVATION_CANCELLED')) {
          return NextResponse.json({ error: '취소된 예약은 변경할 수 없습니다' }, { status: 400 });
        }
        if (error.message?.includes('SAME_SLOT')) {
          return NextResponse.json({ error: '현재 일정과 같은 일정입니다' }, { status: 400 });
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

      const row = Array.isArray(data) ? data[0] : data;
      return NextResponse.json({ data: formatTourReservation(row as TourReservationRpcRow) });
    }

    return NextResponse.json({ error: '올바른 action을 지정해주세요 (cancel, change_slot)' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
