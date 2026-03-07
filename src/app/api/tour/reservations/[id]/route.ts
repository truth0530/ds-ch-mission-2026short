import { NextRequest, NextResponse } from 'next/server';
import { TABLES } from '@/lib/constants';
import { getServerSupabaseClient, requireAdminUser } from '@/lib/supabase-server';

// PATCH: 관리자 예약 취소
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const auth = await requireAdminUser(request);
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const client = getServerSupabaseClient();
        if (!client) {
            return NextResponse.json({ error: 'DB 연결 실패' }, { status: 500 });
        }

        const { data: reservation, error: findError } = await client
            .from(TABLES.TOUR_RESERVATIONS)
            .select('*')
            .eq('id', id)
            .single();

        if (findError || !reservation) {
            return NextResponse.json({ error: '예약을 찾을 수 없습니다' }, { status: 404 });
        }

        if (reservation.status === 'cancelled') {
            return NextResponse.json({ error: '이미 취소된 예약입니다' }, { status: 400 });
        }

        const { data, error } = await client
            .from(TABLES.TOUR_RESERVATIONS)
            .update({ status: 'cancelled' })
            .eq('id', id)
            .select('id, slot_id, reservation_code, name, phone, email, memo, status, created_at, updated_at, tour_slots(tour_date, tour_time, time_label)')
            .single();

        if (error) {
            console.error('관리자 예약 취소 실패:', error.message);
            return NextResponse.json({ error: '처리 중 오류가 발생했습니다' }, { status: 500 });
        }

        return NextResponse.json({ data });
    } catch {
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}
