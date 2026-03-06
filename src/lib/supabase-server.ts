import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { ENV_CONFIG, TABLES } from '@/lib/constants';

function getSupabaseKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || ENV_CONFIG.SUPABASE_ANON_KEY;
}

export function getServerSupabaseClient() {
  const supabaseUrl = ENV_CONFIG.SUPABASE_URL;
  const supabaseKey = getSupabaseKey();

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice('Bearer '.length).trim();
}

export async function requireAdminUser(request: NextRequest) {
  const client = getServerSupabaseClient();
  if (!client) {
    return { error: 'DB 연결 실패', status: 500 as const, email: null };
  }

  const token = getBearerToken(request);
  if (!token) {
    return { error: '관리자 인증이 필요합니다', status: 401 as const, email: null };
  }

  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user?.email) {
    return { error: '관리자 인증이 유효하지 않습니다', status: 401 as const, email: null };
  }

  const email = userData.user.email.toLowerCase();
  const fallbackEmail = ENV_CONFIG.ADMIN_EMAIL.toLowerCase();

  if (fallbackEmail && email === fallbackEmail) {
    return { error: null, status: 200 as const, email };
  }

  const { data: adminData, error: adminError } = await client
    .from(TABLES.ADMIN_USERS)
    .select('email')
    .eq('email', email)
    .maybeSingle();

  if (adminError) {
    return { error: '권한 확인 중 오류가 발생했습니다', status: 500 as const, email: null };
  }

  if (!adminData) {
    return { error: '관리자 권한이 없습니다', status: 403 as const, email: null };
  }

  return { error: null, status: 200 as const, email };
}

export function getRequestIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
