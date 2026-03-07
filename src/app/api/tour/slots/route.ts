import { NextResponse } from 'next/server';
import { TABLES } from '@/lib/constants';
import { getServerSupabaseClient } from '@/lib/supabase-server';

export async function GET() {
    try {
        const client = getServerSupabaseClient();
        if (!client) {
            return NextResponse.json({ error: 'DB 연결 실패' }, { status: 500 });
        }

        const { data, error } = await client
            .from(TABLES.TOUR_SLOTS)
            .select('*')
            .eq('is_active', true)
            .order('tour_date', { ascending: true })
            .order('tour_time', { ascending: true });

        if (error) {
            console.error('슬롯 조회 실패:', error.message);
            return NextResponse.json({ error: '처리 중 오류가 발생했습니다' }, { status: 500 });
        }

        return NextResponse.json({ data });
    } catch {
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}
