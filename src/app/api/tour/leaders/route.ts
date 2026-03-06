import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient, requireAdminUser } from '@/lib/supabase-server';
import { sanitizeInput } from '@/lib/validators';
import type { TourLeader } from '@/types';

function validateLeaderPayload(body: unknown) {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const record = body as Record<string, unknown>;
  const groupNumber = Number(record.group_number);
  const name = typeof record.name === 'string' ? sanitizeInput(record.name.trim()) : '';
  const isActive =
    typeof record.is_active === 'boolean'
      ? record.is_active
      : true;

  if (!Number.isInteger(groupNumber) || groupNumber <= 0 || name.length < 2) {
    return null;
  }

  return {
    group_number: groupNumber,
    name,
    is_active: isActive,
  };
}

export async function GET(request: NextRequest) {
  try {
    const client = getServerSupabaseClient();
    if (!client) {
      return NextResponse.json({ error: 'DB 연결 실패' }, { status: 500 });
    }

    const { data, error } = await client
      .from('tour_leaders')
      .select('*')
      .eq('is_active', true)
      .order('group_number', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // ?all=true skips filtering (used by /tour/my for lookup)
    const url = new URL(request.url);
    if (url.searchParams.get('all') === 'true') {
      return NextResponse.json({ data });
    }

    // Filter out leaders who already have an active reservation
    const { data: booked } = await client
      .from('tour_reservations')
      .select('name')
      .eq('status', 'active');

    const bookedNames = new Set((booked ?? []).map((r: { name: string }) => r.name));
    const available = (data as TourLeader[]).filter(l => !bookedNames.has(l.name));

    return NextResponse.json({ data: available });
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const client = getServerSupabaseClient();
    if (!client) {
      return NextResponse.json({ error: 'DB 연결 실패' }, { status: 500 });
    }

    const payload = validateLeaderPayload(await request.json());
    if (!payload) {
      return NextResponse.json({ error: '조 번호와 조장 이름을 올바르게 입력해주세요' }, { status: 400 });
    }

    const { data, error } = await client
      .from('tour_leaders')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '같은 조 번호 또는 이름이 이미 존재합니다' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
