import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient, requireAdminUser } from '@/lib/supabase-server';
import { sanitizeInput } from '@/lib/validators';

function validateLeaderPatch(body: unknown) {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const record = body as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  if ('group_number' in record) {
    const groupNumber = Number(record.group_number);
    if (!Number.isInteger(groupNumber) || groupNumber <= 0) {
      return null;
    }
    result.group_number = groupNumber;
  }

  if ('name' in record) {
    if (typeof record.name !== 'string') {
      return null;
    }

    const name = sanitizeInput(record.name.trim());
    if (name.length < 2) {
      return null;
    }
    result.name = name;
  }

  if ('is_active' in record) {
    if (typeof record.is_active !== 'boolean') {
      return null;
    }
    result.is_active = record.is_active;
  }

  if (Object.keys(result).length === 0) {
    return null;
  }

  return result;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const client = getServerSupabaseClient();
    if (!client) {
      return NextResponse.json({ error: 'DB 연결 실패' }, { status: 500 });
    }

    const payload = validateLeaderPatch(await request.json());
    if (!payload) {
      return NextResponse.json({ error: '수정할 값을 올바르게 입력해주세요' }, { status: 400 });
    }

    const { id } = await params;
    const { data, error } = await client
      .from('tour_leaders')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '같은 조 번호 또는 이름이 이미 존재합니다' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const client = getServerSupabaseClient();
    if (!client) {
      return NextResponse.json({ error: 'DB 연결 실패' }, { status: 500 });
    }

    const { id } = await params;
    const { error } = await client
      .from('tour_leaders')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
