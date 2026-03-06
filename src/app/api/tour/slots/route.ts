import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { ENV_CONFIG, TABLES } from '@/lib/constants';

function getServerClient() {
    const supabaseUrl = ENV_CONFIG.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ENV_CONFIG.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return null;
    return createClient(supabaseUrl, supabaseKey);
}

export async function GET() {
    try {
        const client = getServerClient();
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
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data });
    } catch {
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}
